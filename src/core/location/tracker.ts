/**
 * Cook location reporting during travel.
 *
 * ## What this is for
 *
 * The backend commits arrival from GPS evidence: two consecutive accepted samples within 75 m of
 * the booking's OPERATIONAL GATE. Without a device sending samples, `cook_arrived` can only be
 * reached through the fallback `POST /cook/bookings/:id/arrive`, which itself refuses with
 * `409 ARRIVAL_PROXIMITY_NOT_CONFIRMED` when no recent in-radius sample exists. So this module is
 * what makes the whole arrival path work.
 *
 * ## Rules this module exists to enforce
 *
 * 1. **Reporting starts only after the SERVER confirmed Start Travel.** `start()` is called with a
 *    booking the projection reports as `cook_en_route`; it never anticipates the command.
 * 2. **The cadence is the server's.** Every response carries `nextReportAfterSeconds`, and that is
 *    what schedules the next fix. The constants below are only a first-tick value and a safety
 *    clamp — the client never invents a tracking frequency.
 * 3. **Reporting stops on arrival, cancellation, reassignment or completion.** `arrived: true`
 *    stops the loop immediately rather than waiting for the next projection poll.
 * 4. **No eligible job means no collection.** `stop()` is idempotent and the loop holds no timer
 *    once stopped, so a backgrounded app with no active assignment collects nothing.
 * 5. **Precise coordinates are never logged.** Diagnostics carry an outcome, never a fix.
 *
 * ## Why a hand-rolled loop rather than `watchPositionAsync`
 *
 * `watchPositionAsync` emits at ITS cadence, not the server's, and would have to be torn down and
 * rebuilt every time `nextReportAfterSeconds` changed. A single-fix-then-schedule loop follows the
 * server's interval exactly and leaves no subscription alive after `stop()`.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { reportLocation } from '../api/cook';
import { ApiError } from '../api/errors';

/** Used only for the FIRST fix. Every subsequent delay comes from the server's response. */
const FIRST_SAMPLE_DELAY_MS = 0;

/** Clamp on the server's cadence. Guards against a malformed value, not against the policy. */
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 300_000;

/** A fix older than this is stale — the backend would reject it, so it is not sent. */
const MAX_FIX_AGE_MS = 60_000;

/** Stable task name: the native registration survives screen unmounts and app restarts. */
export const LOCATION_TASK_NAME = 'spoon-cook-location-updates-v1';
const TRACKING_RECORD_KEY = 'spoon.cook.activeTracking.v1';

/** Android's foreground service receives fixes while the cook backgrounds the app. */
const LOCATION_TASK_OPTIONS = {
  accuracy: Location.Accuracy.High,
  timeInterval: MIN_INTERVAL_MS,
  distanceInterval: 0,
  pausesUpdatesAutomatically: false,
  ...(Platform.OS === 'android'
    ? {
        foregroundService: {
          notificationTitle: 'Spoon travel is active',
          notificationBody: 'Spoon is checking your route to the customer gate.',
          notificationColor: '#CFFF04',
          killServiceOnDestroy: false,
        },
      }
    : {}),
} satisfies Location.LocationTaskOptions;

export interface StoredTrackingRecord {
  readonly target: TrackingTarget;
  readonly enabled: boolean;
  readonly nextReportAtMs: number;
  readonly lastLocationTimestampMs: number | null;
}

async function loadTrackingRecord(): Promise<StoredTrackingRecord | null> {
  try {
    const value = await SecureStore.getItemAsync(TRACKING_RECORD_KEY);
    if (value === null) return null;
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const target = record.target;
    if (
      typeof target !== 'object' ||
      target === null ||
      typeof (target as Record<string, unknown>).bookingId !== 'string' ||
      typeof (target as Record<string, unknown>).assignmentVersion !== 'number'
    ) {
      return null;
    }
    return {
      target: {
        bookingId: (target as Record<string, unknown>).bookingId as string,
        assignmentVersion: (target as Record<string, unknown>).assignmentVersion as number,
      },
      enabled: record.enabled === true,
      nextReportAtMs: typeof record.nextReportAtMs === 'number' ? record.nextReportAtMs : 0,
      lastLocationTimestampMs:
        typeof record.lastLocationTimestampMs === 'number' ? record.lastLocationTimestampMs : null,
    };
  } catch {
    return null;
  }
}

async function saveTrackingRecord(record: StoredTrackingRecord): Promise<void> {
  await SecureStore.setItemAsync(TRACKING_RECORD_KEY, JSON.stringify(record));
}

async function clearTrackingRecord(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TRACKING_RECORD_KEY);
  } catch {
    // Cleanup is best effort; the next start overwrites the record before enabling the task.
  }
}

async function stopNativeLocationTask(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {
    // A missing native registration is already stopped. Do not turn cleanup into a new crash.
  }
}

export interface BackgroundTaskDependencies {
  readonly load: () => Promise<StoredTrackingRecord | null>;
  readonly save: (record: StoredTrackingRecord) => Promise<void>;
  readonly clear: () => Promise<void>;
  readonly report: typeof reportLocation;
  readonly stop: () => Promise<void>;
  readonly now: () => number;
}

const defaultBackgroundTaskDependencies: BackgroundTaskDependencies = {
  load: loadTrackingRecord,
  save: saveTrackingRecord,
  clear: clearTrackingRecord,
  report: reportLocation,
  stop: stopNativeLocationTask,
  now: () => Date.now(),
};

export type TrackingStatus =
  | 'idle'
  | 'ready'
  | 'permission_denied'
  | 'services_disabled'
  | 'reporting'
  | 'arrived'
  | 'stopped'
  | 'failed';

export interface TrackingState {
  readonly status: TrackingStatus;
  readonly bookingId: string | null;
  /** Last outcome the SERVER reported for a sample. Never a coordinate. */
  readonly lastReason: string | null;
  readonly samplesAccepted: number;
  readonly samplesRejected: number;
}

export interface TrackingTarget {
  readonly bookingId: string;
  readonly assignmentVersion: number;
}

export interface TrackerCallbacks {
  /** Fired once, when the BACKEND says this sample committed the arrival. */
  readonly onArrived?: (bookingId: string) => void;
  readonly onStateChange?: (state: TrackingState) => void;
}

/** Injectable so tests drive the loop without a device or real timers. */
export interface TrackerDependencies {
  readonly requestForegroundPermissions: () => Promise<{ granted: boolean }>;
  readonly requestBackgroundPermissions?: () => Promise<{ granted: boolean }>;
  readonly hasServicesEnabled: () => Promise<boolean>;
  readonly getCurrentPosition: () => Promise<Location.LocationObject>;
  readonly report: typeof reportLocation;
  readonly setTimer: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
  readonly now: () => number;
  /** Native task seams are optional so the existing deterministic loop tests stay device-free. */
  readonly startBackgroundUpdates?: () => Promise<void>;
  readonly hasStartedBackgroundUpdates?: () => Promise<boolean>;
  readonly stopBackgroundUpdates?: () => Promise<void>;
}

export const defaultTrackerDependencies: TrackerDependencies = {
  requestForegroundPermissions: async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    return { granted: result.granted };
  },
  requestBackgroundPermissions: async () => {
    const existing = await Location.getBackgroundPermissionsAsync();
    if (existing.granted) return { granted: true };
    const requested = await Location.requestBackgroundPermissionsAsync();
    return { granted: requested.granted };
  },
  hasServicesEnabled: () => Location.hasServicesEnabledAsync(),
  getCurrentPosition: () =>
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
  report: reportLocation,
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => {
    clearTimeout(handle);
  },
  now: () => Date.now(),
  startBackgroundUpdates: () =>
    Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_TASK_OPTIONS),
  hasStartedBackgroundUpdates: () => Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME),
  stopBackgroundUpdates: stopNativeLocationTask,
};

function clampInterval(seconds: number): number {
  const ms = seconds * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return MIN_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, ms));
}

/**
 * One tracking session per app instance.
 *
 * A class rather than a hook so the lifecycle survives a screen unmount: a cook who backgrounds
 * the app mid-travel must keep reporting, and a cook who navigates to Attendance must not stop.
 */
export class LocationTracker {
  private readonly deps: TrackerDependencies;
  private callbacks: TrackerCallbacks = {};
  private target: TrackingTarget | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private prepared = false;
  // Expo can report `unknown` before React Native publishes the first lifecycle event. Treat that
  // state as foreground so the deterministic first fix is not lost; the root bridge immediately
  // replaces it with the real AppState value on mount.
  private appIsActive = AppState.currentState !== 'background';
  private nativeStop: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(state: TrackingState) => void>();
  private state: TrackingState = {
    status: 'idle',
    bookingId: null,
    lastReason: null,
    samplesAccepted: 0,
    samplesRejected: 0,
  };

  constructor(deps: TrackerDependencies = defaultTrackerDependencies) {
    this.deps = deps;
  }

  getState(): TrackingState {
    return this.state;
  }

  subscribe(listener: (state: TrackingState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<TrackingState>): void {
    this.state = { ...this.state, ...patch };
    this.callbacks.onStateChange?.(this.state);
    for (const listener of this.listeners) listener(this.state);
  }

  /**
   * Verify permissions and register the persistent native task, but do not upload until the
   * backend accepts Start Travel. This prevents a failed command from being presented as travel.
   */
  async prepare(target: TrackingTarget): Promise<TrackingState> {
    if (
      this.prepared &&
      this.target?.bookingId === target.bookingId &&
      this.target.assignmentVersion === target.assignmentVersion
    ) {
      this.target = target;
      return this.state;
    }

    this.stop();
    await this.nativeStop;
    this.target = target;
    this.setState({
      status: 'ready',
      bookingId: target.bookingId,
      lastReason: null,
      samplesAccepted: 0,
      samplesRejected: 0,
    });

    const permission = await this.deps.requestForegroundPermissions();
    if (!permission.granted) {
      this.target = null;
      this.setState({ status: 'permission_denied' });
      return this.state;
    }

    const servicesOn = await this.deps.hasServicesEnabled();
    if (!servicesOn) {
      this.target = null;
      this.setState({ status: 'services_disabled' });
      return this.state;
    }

    const nativeTaskEnabled =
      this.deps.startBackgroundUpdates !== undefined &&
      this.deps.hasStartedBackgroundUpdates !== undefined;
    try {
      if (nativeTaskEnabled) {
        /*
         * Background permission is requested, never required.
         *
         * On Android 11+ `ACCESS_BACKGROUND_LOCATION` cannot be granted from an in-app dialog at
         * all: the OS refuses to show the prompt alongside the foreground request and sends the
         * user to Settings -> Location -> "Allow all the time". Treating a denial as fatal
         * therefore made Start Travel UNREACHABLE on every modern device — the cook tapped it,
         * got "Background location permission is required while you travel", and the booking
         * never left `assigned`.
         *
         * It is also not the permission this design needs. The foreground service declares
         * `foregroundServiceType="location"`, and while such a service is running Android counts
         * the app as in use, so `ACCESS_FINE_LOCATION` alone keeps updates flowing with the app
         * backgrounded or the screen off. `ACCESS_BACKGROUND_LOCATION` buys location access
         * WITHOUT a visible foreground service, which this app never wants — the cook should
         * always be able to see that Spoon is tracking them.
         *
         * So: ask (a granted "Allow all the time" is a genuine resilience win if the service is
         * ever killed), and carry on either way. The real gate is whether the native task
         * actually registers, which is checked immediately below and IS fatal.
         */
        try {
          await this.deps.requestBackgroundPermissions!();
        } catch {
          // Some OEM builds throw rather than returning a denial. Not fatal for the same reason.
        }

        await saveTrackingRecord({
          target,
          enabled: false,
          nextReportAtMs: 0,
          lastLocationTimestampMs: null,
        });
        await this.deps.startBackgroundUpdates!();
        if (!(await this.deps.hasStartedBackgroundUpdates!())) {
          throw new Error('background location task did not register');
        }
      }

      this.prepared = true;
      this.setState({ status: 'ready' });
    } catch {
      this.prepared = false;
      this.target = null;
      await clearTrackingRecord();
      this.setState({ status: 'failed', lastReason: 'background_task_unavailable' });
    }
    return this.state;
  }

  /** Enable uploads only after the Start Travel command returned successfully. */
  async activate(target: TrackingTarget, callbacks: TrackerCallbacks = {}): Promise<TrackingState> {
    if (
      !this.prepared ||
      this.target?.bookingId !== target.bookingId ||
      this.target?.assignmentVersion !== target.assignmentVersion
    ) {
      this.setState({ status: 'failed', lastReason: 'tracking_not_prepared' });
      return this.state;
    }
    this.target = target;
    this.callbacks = callbacks;
    this.running = true;
    this.setState({ status: 'reporting', bookingId: target.bookingId });
    try {
      const record = await loadTrackingRecord();
      if (record !== null) {
        await saveTrackingRecord({ ...record, target, enabled: true, nextReportAtMs: 0 });
      }
    } catch {
      this.running = false;
      this.setState({ status: 'failed', lastReason: 'tracking_persistence_unavailable' });
      return this.state;
    }
    if (this.appIsActive) this.schedule(FIRST_SAMPLE_DELAY_MS);
    return this.state;
  }

  /**
   * Begin reporting for a booking the SERVER has confirmed as travelling.
   *
   * Calling `start` for the booking already being tracked is a no-op, so a re-render or a
   * projection poll cannot spawn a second loop. A DIFFERENT booking replaces the session — a
   * reassignment must not leave the previous booking's samples in flight.
   */
  async start(target: TrackingTarget, callbacks: TrackerCallbacks = {}): Promise<TrackingState> {
    if (this.running && this.target?.bookingId === target.bookingId) {
      this.target = target;
      this.callbacks = callbacks;
      return this.state;
    }
    this.callbacks = callbacks;
    const prepared = await this.prepare(target);
    return prepared.status === 'ready' ? this.activate(target, callbacks) : prepared;
  }

  /** Idempotent. After this the tracker holds no timer and collects nothing. */
  stop(): void {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer);
      this.timer = null;
    }
    const wasRunning = this.running;
    const wasPrepared = this.prepared;
    this.running = false;
    this.prepared = false;
    this.target = null;
    if (wasRunning || wasPrepared) {
      this.setState({ status: 'stopped', bookingId: null });
    }
    this.nativeStop = this.nativeStop.then(async () => {
      await this.deps.stopBackgroundUpdates?.();
      await clearTrackingRecord();
    });
  }

  /** The root app shell mirrors AppState so native updates own background collection. */
  setAppState(active: boolean): void {
    this.appIsActive = active;
    if (!active) {
      if (this.timer !== null) this.deps.clearTimer(this.timer);
      this.timer = null;
    } else if (this.running) {
      this.schedule(FIRST_SAMPLE_DELAY_MS);
    }
  }

  private schedule(ms: number): void {
    if (!this.running || !this.appIsActive) return;
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.tick();
    }, ms);
  }

  private async tick(): Promise<void> {
    const target = this.target;
    if (!this.running || target === null) return;

    let fix: Location.LocationObject;
    try {
      fix = await this.deps.getCurrentPosition();
    } catch {
      // A single failed fix is not a reason to stop travelling. Retry at the floor interval.
      this.setState({ lastReason: 'fix_unavailable' });
      this.schedule(MIN_INTERVAL_MS);
      return;
    }

    // An out-of-order or stale reading cannot be true evidence, and the backend would drop it.
    // Skipping it locally saves a request without changing the outcome.
    const age = this.deps.now() - fix.timestamp;
    if (age > MAX_FIX_AGE_MS || age < -MAX_FIX_AGE_MS) {
      this.setState({ lastReason: 'stale_fix' });
      this.schedule(MIN_INTERVAL_MS);
      return;
    }

    try {
      const result = await this.deps.report({
        bookingId: target.bookingId,
        assignmentVersion: target.assignmentVersion,
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracyMetres: fix.coords.accuracy ?? 0,
        recordedAtIso: new Date(fix.timestamp).toISOString(),
        ...(fix.mocked === undefined ? {} : { mocked: fix.mocked }),
      });

      this.setState({
        lastReason: result.reason,
        samplesAccepted: this.state.samplesAccepted + (result.accepted ? 1 : 0),
        samplesRejected: this.state.samplesRejected + (result.accepted ? 0 : 1),
      });

      if (result.arrived) {
        // The BACKEND committed the transition. Stop before anything else so no further sample
        // is collected for a booking whose live tracking has ended.
        const bookingId = target.bookingId;
        this.running = false;
        this.prepared = false;
        this.target = null;
        if (this.timer !== null) {
          this.deps.clearTimer(this.timer);
          this.timer = null;
        }
        this.setState({ status: 'arrived' });
        this.nativeStop = this.nativeStop.then(async () => {
          await this.deps.stopBackgroundUpdates?.();
          await clearTrackingRecord();
        });
        this.callbacks.onArrived?.(bookingId);
        return;
      }

      // The server's cadence, not ours.
      this.schedule(clampInterval(result.nextReportAfterSeconds));
    } catch (error) {
      if (error instanceof ApiError) {
        // A superseded assignment or a booking that left `cook_en_route` means this cook is no
        // longer entitled to report. Stopping is the correct response, not a retry.
        if (error.kind === 'server' && error.status !== null && error.status < 500) {
          this.setState({ status: 'stopped', lastReason: error.code ?? 'rejected' });
          this.stop();
          return;
        }
        // Offline or a 5xx: the cook is still travelling. Keep trying at the floor interval.
        this.setState({ lastReason: error.kind });
        this.schedule(MIN_INTERVAL_MS);
        return;
      }
      this.setState({ status: 'failed', lastReason: 'unexpected' });
      this.stop();
    }
  }
}

/**
 * Headless/native location callback. The task is defined at module scope because Android can load
 * this module without mounting React. It reads only the persisted booking/assignment target and
 * never trusts a notification, local screen state, or a coordinate from storage.
 */
export async function processBackgroundLocations(
  data: unknown,
  deps: BackgroundTaskDependencies = defaultBackgroundTaskDependencies,
): Promise<void> {
  if (typeof data !== 'object' || data === null) return;
  const locations = (data as { locations?: unknown }).locations;
  if (!Array.isArray(locations)) return;

  const sorted = locations
    .filter((location): location is Location.LocationObject => {
      if (typeof location !== 'object' || location === null) return false;
      const value = location as Partial<Location.LocationObject>;
      return typeof value.timestamp === 'number' && typeof value.coords === 'object';
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  for (const fix of sorted) {
    const record = await deps.load();
    if (record === null || !record.enabled) return;

    const now = deps.now();
    const age = now - fix.timestamp;
    if (
      age > MAX_FIX_AGE_MS ||
      age < -MAX_FIX_AGE_MS ||
      (record.lastLocationTimestampMs !== null &&
        fix.timestamp <= record.lastLocationTimestampMs) ||
      record.nextReportAtMs > now
    ) {
      continue;
    }

    try {
      const result = await deps.report({
        bookingId: record.target.bookingId,
        assignmentVersion: record.target.assignmentVersion,
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracyMetres: fix.coords.accuracy ?? 0,
        recordedAtIso: new Date(fix.timestamp).toISOString(),
        ...(fix.mocked === undefined ? {} : { mocked: fix.mocked }),
      });

      if (result.arrived) {
        await deps.clear();
        await deps.stop();
        return;
      }

      await deps.save({
        ...record,
        lastLocationTimestampMs: fix.timestamp,
        nextReportAtMs: now + clampInterval(result.nextReportAfterSeconds),
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.kind === 'server' &&
        error.status !== null &&
        error.status < 500
      ) {
        // The assignment/status fence rejected this target. Stop the native service and discard
        // the target so a stale task cannot keep sending samples after reassignment/cancellation.
        await deps.clear();
        await deps.stop();
      }
      // Offline and 5xx errors keep the record. The next native fix retries at the floor interval.
      return;
    }
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error !== null && error !== undefined) return;
  // The foreground timer is the single reporter while the app is visible. The headless callback
  // takes over only once the app is backgrounded or relaunched by the native task manager.
  if (AppState.currentState === 'active') return;
  await processBackgroundLocations(data);
});

/** The app-wide tracker. One session at a time, by construction. */
export const locationTracker = new LocationTracker();
