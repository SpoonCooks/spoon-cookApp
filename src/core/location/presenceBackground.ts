import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { reportPresenceLocation } from '@core/api/cook';

/**
 * Keeps an idle cook's position fresh while the app is not on screen.
 *
 * ## Why this exists
 *
 * Instant offers a cook only if the backend can work out where she is starting from. Her
 * position came from one of two places: samples written while travelling to a job, or the
 * foreground ping in `presenceReporter`, which stops the moment the app leaves the screen. So
 * a cook who marked present and put her phone in her pocket became invisible — no origin, no
 * route requested, and instant reporting that nobody was available while she sat waiting for
 * work. That was the single largest cause of instant failing.
 *
 * ## Why a second task rather than a mode on the first
 *
 * `tracker.ts` is arrival evidence. Its samples decide whether a booking becomes `cook_arrived`
 * and whether a no-show is charged, and it carries an assignment fence, a version check and an
 * arrival response that stops the service. Threading a second purpose through that is how you
 * break arrival detection. This is a separate task name with its own options and its own
 * endpoint; the two never share state, and by construction they never run at once — presence
 * is active only while no assignment owns her position.
 *
 * ## Cost
 *
 * Balanced accuracy, not High, and minutes rather than seconds. This answers "roughly where is
 * she" for a travel estimate, not "is she at the gate", so a cell-tower-grade fix is enough and
 * a GPS lock every five seconds would flatten her battery across a seventeen-hour shift.
 */

export const PRESENCE_TASK_NAME = 'spoon-presence-location';

/**
 * Three minutes.
 *
 * The server keeps an origin usable for forty-five, so this is far tighter than it needs to be
 * and leaves room for several missed fixes before she goes stale. Slower would save little —
 * the radio wakes either way — and faster buys nothing the estimate can use.
 */
export const PRESENCE_BACKGROUND_INTERVAL_MS = 3 * 60 * 1000;

const PRESENCE_TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: PRESENCE_BACKGROUND_INTERVAL_MS,
  distanceInterval: 0,
  pausesUpdatesAutomatically: false,
  ...(Platform.OS === 'android'
    ? {
        /*
         * Android will not deliver background location reliably without a foreground service,
         * and a foreground service must show a notification. It is written for the cook: it
         * says she is online and able to receive work, because that is what it is for and
         * because a persistent notification she cannot explain is one she will silence.
         */
        foregroundService: {
          notificationTitle: 'Aap online hai',
          notificationBody: 'Spoon aapko kaam de sakta hai.',
          notificationColor: '#CFFF04',
          killServiceOnDestroy: false,
        },
      }
    : {}),
};

export interface PresenceBackgroundDependencies {
  readonly getBackgroundPermission: () => Promise<{ granted: boolean }>;
  readonly requestBackgroundPermission: () => Promise<{ granted: boolean }>;
  readonly hasStarted: () => Promise<boolean>;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
}

export const defaultPresenceBackgroundDependencies: PresenceBackgroundDependencies = {
  getBackgroundPermission: async () => {
    const result = await Location.getBackgroundPermissionsAsync();
    return { granted: result.granted };
  },
  requestBackgroundPermission: async () => {
    const result = await Location.requestBackgroundPermissionsAsync();
    return { granted: result.granted };
  },
  hasStarted: () => Location.hasStartedLocationUpdatesAsync(PRESENCE_TASK_NAME),
  start: () => Location.startLocationUpdatesAsync(PRESENCE_TASK_NAME, PRESENCE_TASK_OPTIONS),
  stop: () => Location.stopLocationUpdatesAsync(PRESENCE_TASK_NAME),
};

/**
 * Starts background presence reporting, asking for the permission if it is not already held.
 *
 * Asking is right here and nowhere else: marking present is the cook saying she is available
 * for work, so a prompt about reporting her location while the app is closed is about the thing
 * she just did. A refusal is not a failure — she keeps the foreground ping, and the backend's
 * hub fallback still offers her — so nothing here throws or blocks.
 */
export async function startPresenceBackground(
  deps: PresenceBackgroundDependencies = defaultPresenceBackgroundDependencies,
): Promise<boolean> {
  try {
    const existing = await deps.getBackgroundPermission();
    const permission = existing.granted ? existing : await deps.requestBackgroundPermission();
    if (!permission.granted) return false;
    // Starting twice throws on iOS and silently restarts the service on Android.
    if (await deps.hasStarted()) return true;
    await deps.start();
    return true;
  } catch {
    return false;
  }
}

export async function stopPresenceBackground(
  deps: PresenceBackgroundDependencies = defaultPresenceBackgroundDependencies,
): Promise<void> {
  try {
    if (!(await deps.hasStarted())) return;
    await deps.stop();
  } catch {
    // A service that will not stop is not something a cook can act on, and the next start is
    // idempotent. Leaving it running costs battery; throwing here would cost her the screen.
  }
}

/** The newest fix in a batch. Android may deliver several at once after a doze window. */
export function newestFix(
  locations: readonly Location.LocationObject[],
): Location.LocationObject | null {
  let newest: Location.LocationObject | null = null;
  for (const fix of locations) {
    if (newest === null || fix.timestamp > newest.timestamp) newest = fix;
  }
  return newest;
}

export async function processPresenceLocations(
  data: unknown,
  report: typeof reportPresenceLocation = reportPresenceLocation,
): Promise<void> {
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!Array.isArray(locations) || locations.length === 0) return;

  /*
   * Only the newest is sent. These are position samples for an origin estimate, not evidence —
   * nobody will ever ask what her whole afternoon looked like, and posting a backlog after a
   * doze window would spend her data to tell the server five stale things it cannot use.
   */
  const fix = newestFix(locations);
  if (fix === null) return;

  try {
    await report({
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      accuracyMetres: fix.coords.accuracy ?? 0,
      recordedAtIso: new Date(fix.timestamp).toISOString(),
    });
  } catch {
    // Nothing downstream waits on this and no cook can see it. The next fix retries.
  }
}

TaskManager.defineTask(PRESENCE_TASK_NAME, async ({ data, error }) => {
  if (error !== null && error !== undefined) return;
  /*
   * The foreground ping owns the visible case, exactly as the assignment tracker does. Without
   * this the two would both report while the app is open, doubling her data use to say the
   * same thing twice.
   */
  if (AppState.currentState === 'active') return;
  await processPresenceLocations(data);
});
