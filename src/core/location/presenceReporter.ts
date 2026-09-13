import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';

import { reportPresenceLocation } from '@core/api/cook';
import { startPresenceBackground, stopPresenceBackground } from './presenceBackground';

/**
 * Keeps an idle cook reachable by instant.
 *
 * ## The hole this closes
 *
 * Instant availability routes from the cook's CURRENT position. The backend finds one in a
 * current or previous commitment's gate, or in a live GPS fix inside its freshness bound — and
 * `locationTracker` only streams while a cook is TRAVELLING to a job. So the moment she arrives
 * the stream stops, the last fix ages out within minutes, and a cook who is present, on shift and
 * completely free has no origin at all. Discovery requests no route, the candidate collapses, and
 * instant tells the customer no cook is available. Observed end-to-end on 2026-08-31, where the
 * cook was standing at the customer's own address.
 *
 * ## Why this is a foreground ping and not a background task
 *
 * `locationTracker` exists for evidence: it runs a registered background task, survives the app
 * being backgrounded, and persists every sample against an assignment because an arrival dispute
 * is settled from those rows. None of that is wanted here. A presence ping proves nothing, only
 * the latest one matters, and the server keeps exactly one per cook.
 *
 * So this asks for a single position on a slow interval while the app is open, using the
 * foreground permission the cook has already granted for travel. It adds no background execution
 * and no new permission prompt — which also means it reports only while she has the app open.
 * That is a deliberate V0 limit, not an oversight: widening it to background is a battery and
 * permissions decision, and the app is useful without it.
 *
 * ## What it will not do
 *
 * It never reports while a job is live — `locationTracker` owns the cook's position then, and two
 * writers would race. It never blocks the UI and never surfaces an error: a cook who has denied
 * location, or whose GPS is cold, is not doing anything wrong.
 */

/**
 * How often an idle position is refreshed.
 *
 * The server keeps an origin usable for forty-five minutes now, so this no longer races a
 * five-minute bound. Two minutes is kept anyway: it is nearly free while the app is already
 * awake on screen, and it means a cook who has just marked present is bookable immediately
 * rather than after the background service's first slower tick.
 */
export const PRESENCE_PING_INTERVAL_MS = 2 * 60 * 1000;

export interface PresenceReporterDependencies {
  readonly getForegroundPermission: () => Promise<{ granted: boolean }>;
  readonly getCurrentPosition: () => Promise<Location.LocationObject>;
  readonly report: typeof reportPresenceLocation;
  readonly setInterval: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  readonly clearInterval: (handle: ReturnType<typeof setInterval>) => void;
}

export const defaultPresenceReporterDependencies: PresenceReporterDependencies = {
  getForegroundPermission: async () => {
    // Only ever READS the permission. Asking here would put a system dialog in front of a cook
    // who has merely opened the app, for a feature she did not invoke.
    const result = await Location.getForegroundPermissionsAsync();
    return { granted: result.granted };
  },
  getCurrentPosition: () =>
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
  report: reportPresenceLocation,
  setInterval: (handler, ms) => setInterval(handler, ms),
  clearInterval: (handle) => clearInterval(handle),
};

/** One attempt. Swallows everything: nothing downstream is waiting and no cook may see an error. */
export async function reportPresenceOnce(
  deps: PresenceReporterDependencies = defaultPresenceReporterDependencies,
): Promise<boolean> {
  try {
    const permission = await deps.getForegroundPermission();
    if (!permission.granted) return false;
    const fix = await deps.getCurrentPosition();
    await deps.report({
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      accuracyMetres: fix.coords.accuracy ?? 0,
      recordedAtIso: new Date(fix.timestamp).toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reports the cook's position on an interval while `active` holds.
 *
 * `active` is the caller's ruling on "present, and not on a job" — this hook does not decide it,
 * for the same reason nothing else in the app decides attendance locally.
 */
export function usePresenceReporter(
  active: boolean,
  deps: PresenceReporterDependencies = defaultPresenceReporterDependencies,
): void {
  // Synced in an effect, never during render: a ref written while rendering is a side effect in
  // a phase React may run more than once. The interval reads through the ref so a caller passing
  // a fresh object each render cannot restart the timer.
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  }, [deps]);

  /*
   * The background service runs alongside the foreground timer, and covers the case the timer
   * cannot: the app off screen. Without it a cook who marked present and pocketed her phone
   * went stale within minutes and stopped being offered instant work — the timer below only
   * ticks while she is looking at the app.
   *
   * Deliberately not awaited into the render path and deliberately unable to fail loudly: a
   * refused permission leaves her with the foreground ping and the backend's hub fallback,
   * which is worse than having it and much better than a blocked screen.
   */
  useEffect(() => {
    if (!active) {
      void stopPresenceBackground();
      return;
    }
    void startPresenceBackground();
    return () => {
      void stopPresenceBackground();
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const tick = (): void => {
      if (stopped) return;
      void reportPresenceOnce(depsRef.current);
    };
    // One immediately, so a cook who has just marked present is bookable now rather than in two
    // minutes — the gap that made instant look broken in the first place.
    tick();
    const handle = depsRef.current.setInterval(tick, PRESENCE_PING_INTERVAL_MS);
    return () => {
      stopped = true;
      depsRef.current.clearInterval(handle);
    };
  }, [active]);
}
