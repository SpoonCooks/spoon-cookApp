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

import * as Location from 'expo-location';

import { reportLocation } from '../api/cook';
import { ApiError } from '../api/errors';

/** Used only for the FIRST fix. Every subsequent delay comes from the server's response. */
const FIRST_SAMPLE_DELAY_MS = 0;

/** Clamp on the server's cadence. Guards against a malformed value, not against the policy. */
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 300_000;

/** A fix older than this is stale — the backend would reject it, so it is not sent. */
const MAX_FIX_AGE_MS = 60_000;

export type TrackingStatus =
  | 'idle'
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
  readonly hasServicesEnabled: () => Promise<boolean>;
  readonly getCurrentPosition: () => Promise<Location.LocationObject>;
  readonly report: typeof reportLocation;
  readonly setTimer: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
  readonly now: () => number;
}

export const defaultTrackerDependencies: TrackerDependencies = {
  requestForegroundPermissions: async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    return { granted: result.granted };
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

  private setState(patch: Partial<TrackingState>): void {
    this.state = { ...this.state, ...patch };
    this.callbacks.onStateChange?.(this.state);
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
    this.stop();
    this.callbacks = callbacks;
    this.target = target;
    this.setState({
      status: 'reporting',
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

    this.running = true;
    this.schedule(FIRST_SAMPLE_DELAY_MS);
    return this.state;
  }

  /** Idempotent. After this the tracker holds no timer and collects nothing. */
  stop(): void {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer);
      this.timer = null;
    }
    const wasRunning = this.running;
    this.running = false;
    this.target = null;
    if (wasRunning && this.state.status === 'reporting') {
      this.setState({ status: 'stopped', bookingId: null });
    }
  }

  private schedule(ms: number): void {
    if (!this.running) return;
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
        this.target = null;
        if (this.timer !== null) {
          this.deps.clearTimer(this.timer);
          this.timer = null;
        }
        this.setState({ status: 'arrived' });
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

/** The app-wide tracker. One session at a time, by construction. */
export const locationTracker = new LocationTracker();
