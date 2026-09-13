import {
  LocationTracker,
  processBackgroundLocations,
  type BackgroundTaskDependencies,
  type TrackerDependencies,
} from '@core/location/tracker';
import { ApiError } from '@core/api/errors';

/**
 * GPS reporting lifecycle.
 *
 * The backend commits arrival from two consecutive accepted samples inside 75 m of the operational
 * GATE, so this loop is what makes the whole arrival path work. These tests drive it through
 * injected dependencies — no device, no real timers — and assert the four properties that keep it
 * honest:
 *
 *   1. it never reports without a granted permission and enabled services
 *   2. the cadence is the SERVER's, never a client-chosen interval
 *   3. it stops the instant the backend says `arrived`, and on any terminal rejection
 *   4. once stopped it holds no timer, so a backgrounded app with no eligible job collects nothing
 */

interface Harness {
  readonly tracker: LocationTracker;
  readonly deps: TrackerDependencies;
  readonly report: jest.Mock;
  readonly timers: { run: () => void; ms: number }[];
  /** Fire the pending timer, driving exactly one sample. */
  tick(): Promise<void>;
  readonly cleared: number[];
}

function harness(
  overrides: Partial<TrackerDependencies> = {},
  fix: Partial<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    ageMs: number;
  }> = {},
): Harness {
  const timers: { run: () => void; ms: number }[] = [];
  const cleared: number[] = [];
  let handle = 0;
  const now = 1_700_000_000_000;

  const report = jest.fn(async () => ({
    accepted: true,
    reason: null,
    confidence: 'high',
    persisted: true,
    etaRevised: false,
    arrived: false,
    nextReportAfterSeconds: 30,
  }));

  const deps: TrackerDependencies = {
    requestForegroundPermissions: async () => ({ granted: true }),
    hasServicesEnabled: async () => true,
    getCurrentPosition: async () =>
      ({
        coords: {
          latitude: fix.latitude ?? 28.4595,
          longitude: fix.longitude ?? 77.0266,
          accuracy: fix.accuracy === undefined ? 12 : fix.accuracy,
          altitude: null,
          heading: null,
          speed: null,
          altitudeAccuracy: null,
        },
        timestamp: now - (fix.ageMs ?? 0),
        mocked: false,
      }) as never,
    report: report as unknown as TrackerDependencies['report'],
    setTimer: (run, ms) => {
      handle += 1;
      timers.push({ run, ms });
      return handle as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (h) => {
      cleared.push(h as unknown as number);
    },
    now: () => now,
    ...overrides,
  };

  const tracker = new LocationTracker(deps);
  return {
    tracker,
    deps,
    report,
    timers,
    cleared,
    async tick() {
      const next = timers.pop();
      next?.run();
      // Let the async tick body settle.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

const target = { bookingId: 'b1', assignmentVersion: 3 };

describe('background permission is asked for, never required', () => {
  /*
   * The blocker this pins.
   *
   * `prepare` used to treat a denied ACCESS_BACKGROUND_LOCATION as fatal. On Android 11+ that
   * permission cannot be granted from an in-app dialog at all — the OS refuses to prompt for it
   * alongside the foreground request and sends the user to Settings. So on every modern device
   * Start Travel was unreachable: tap, refusal, booking never leaves `assigned`.
   *
   * It is also the wrong permission to demand. The foreground service declares
   * `foregroundServiceType="location"`, and Android counts an app with such a service running as
   * in use, so ACCESS_FINE_LOCATION alone keeps updates flowing while backgrounded.
   */
  const nativeDeps = () => ({
    startBackgroundUpdates: jest.fn(async () => undefined),
    hasStartedBackgroundUpdates: jest.fn(async () => true),
    stopBackgroundUpdates: jest.fn(async () => undefined),
  });

  it('still becomes ready when the OS refuses background location', async () => {
    const native = nativeDeps();
    const { tracker } = harness({
      ...native,
      requestBackgroundPermissions: async () => ({ granted: false }),
    });

    const state = await tracker.prepare(target);

    expect(state.status).toBe('ready');
    // The native task is what actually matters, and it was started.
    expect(native.startBackgroundUpdates).toHaveBeenCalledTimes(1);
  });

  it('still becomes ready when the request throws, as some OEM builds do', async () => {
    const native = nativeDeps();
    const { tracker } = harness({
      ...native,
      requestBackgroundPermissions: async () => {
        throw new Error('OEM refused to prompt');
      },
    });

    expect((await tracker.prepare(target)).status).toBe('ready');
    expect(native.startBackgroundUpdates).toHaveBeenCalledTimes(1);
  });

  it('DOES fail when the native task will not register, which is the real gate', async () => {
    const { tracker } = harness({
      startBackgroundUpdates: async () => undefined,
      // Registration silently did not take: tracking would be a promise the app cannot keep.
      hasStartedBackgroundUpdates: async () => false,
      stopBackgroundUpdates: async () => undefined,
      requestBackgroundPermissions: async () => ({ granted: true }),
    });

    expect((await tracker.prepare(target)).status).not.toBe('ready');
  });

  it('still refuses when FOREGROUND permission is denied', async () => {
    // The one location permission that is genuinely required stays required.
    const { tracker } = harness({
      ...nativeDeps(),
      requestForegroundPermissions: async () => ({ granted: false }),
    });

    expect((await tracker.prepare(target)).status).toBe('permission_denied');
  });
});

describe('permission and service gates', () => {
  it('does not report when foreground permission is denied', async () => {
    const h = harness({ requestForegroundPermissions: async () => ({ granted: false }) });
    const state = await h.tracker.start(target);
    expect(state.status).toBe('permission_denied');
    expect(h.timers).toHaveLength(0);
    expect(h.report).not.toHaveBeenCalled();
  });

  it('does not report when location services are off', async () => {
    const h = harness({ hasServicesEnabled: async () => false });
    const state = await h.tracker.start(target);
    expect(state.status).toBe('services_disabled');
    expect(h.report).not.toHaveBeenCalled();
  });

  it('reports once both gates pass', async () => {
    const h = harness();
    const state = await h.tracker.start(target);
    expect(state.status).toBe('reporting');
    await h.tick();
    expect(h.report).toHaveBeenCalledTimes(1);
  });
});

describe('the sample it sends', () => {
  it('carries the booking, assignment version, accuracy and capture time', async () => {
    const h = harness();
    await h.tracker.start(target);
    await h.tick();
    expect(h.report).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'b1',
        assignmentVersion: 3,
        latitude: 28.4595,
        longitude: 77.0266,
        accuracyMetres: 12,
        recordedAtIso: expect.any(String),
      }),
    );
  });

  it('sends accuracy 0 rather than dropping the field when the device reports none', async () => {
    const h = harness({}, { accuracy: null });
    await h.tracker.start(target);
    await h.tick();
    expect(h.report.mock.calls[0]?.[0]).toMatchObject({ accuracyMetres: 0 });
  });

  it('skips a stale fix instead of sending evidence the backend would reject', async () => {
    const h = harness({}, { ageMs: 120_000 });
    await h.tracker.start(target);
    await h.tick();
    expect(h.report).not.toHaveBeenCalled();
    expect(h.tracker.getState().lastReason).toBe('stale_fix');
    // Still travelling, so it retries rather than giving up.
    expect(h.timers).toHaveLength(1);
  });

  it('skips a fix dated in the future by more than the tolerance', async () => {
    const h = harness({}, { ageMs: -120_000 });
    await h.tracker.start(target);
    await h.tick();
    expect(h.report).not.toHaveBeenCalled();
    expect(h.tracker.getState().lastReason).toBe('stale_fix');
  });

  it('retries at the floor interval when a fix cannot be obtained', async () => {
    const h = harness({
      getCurrentPosition: async () => {
        throw new Error('no fix');
      },
    });
    await h.tracker.start(target);
    await h.tick();
    expect(h.report).not.toHaveBeenCalled();
    expect(h.tracker.getState().lastReason).toBe('fix_unavailable');
    expect(h.timers).toHaveLength(1);
  });
});

describe('cadence is the server’s', () => {
  it('schedules the next sample from nextReportAfterSeconds', async () => {
    const h = harness();
    h.report.mockResolvedValue({
      accepted: true,
      reason: null,
      confidence: 'high',
      persisted: true,
      etaRevised: false,
      arrived: false,
      nextReportAfterSeconds: 45,
    });
    await h.tracker.start(target);
    await h.tick();
    expect(h.timers.at(-1)?.ms).toBe(45_000);
  });

  it('clamps an absurd server interval rather than sleeping forever', async () => {
    const h = harness();
    h.report.mockResolvedValue({
      accepted: true,
      reason: null,
      confidence: 'high',
      persisted: true,
      etaRevised: false,
      arrived: false,
      nextReportAfterSeconds: 999_999,
    });
    await h.tracker.start(target);
    await h.tick();
    expect(h.timers.at(-1)?.ms).toBe(300_000);
  });

  it('clamps a zero interval up to the floor rather than busy-looping', async () => {
    const h = harness();
    h.report.mockResolvedValue({
      accepted: true,
      reason: null,
      confidence: 'high',
      persisted: true,
      etaRevised: false,
      arrived: false,
      nextReportAfterSeconds: 0,
    });
    await h.tracker.start(target);
    await h.tick();
    expect(h.timers.at(-1)?.ms).toBe(5_000);
  });
});

describe('stopping', () => {
  it('stops the moment the BACKEND commits the arrival', async () => {
    const h = harness();
    const onArrived = jest.fn();
    h.report.mockResolvedValue({
      accepted: true,
      reason: null,
      confidence: 'high',
      persisted: true,
      etaRevised: false,
      arrived: true,
      nextReportAfterSeconds: 30,
    });
    await h.tracker.start(target, { onArrived });
    await h.tick();

    expect(onArrived).toHaveBeenCalledWith('b1');
    expect(h.tracker.getState().status).toBe('arrived');
    // No further sample is scheduled: live tracking ends at the gate.
    expect(h.timers).toHaveLength(0);
  });

  it('stops on a terminal 4xx rather than retrying a rejected assignment', async () => {
    const h = harness();
    h.report.mockRejectedValue(
      new ApiError({
        kind: 'server',
        message: 'stale assignment',
        status: 409,
        code: 'ACTIVE_ASSIGNMENT_CHANGED',
      }),
    );
    await h.tracker.start(target);
    await h.tick();
    expect(h.tracker.getState().status).toBe('stopped');
    expect(h.timers).toHaveLength(0);
  });

  it('keeps trying while offline, because the cook is still travelling', async () => {
    const h = harness();
    h.report.mockRejectedValue(new ApiError({ kind: 'offline', message: 'offline' }));
    await h.tracker.start(target);
    await h.tick();
    expect(h.tracker.getState().status).toBe('reporting');
    expect(h.timers).toHaveLength(1);
  });

  it('keeps trying on a 5xx', async () => {
    const h = harness();
    h.report.mockRejectedValue(
      new ApiError({ kind: 'server', message: 'unavailable', status: 503 }),
    );
    await h.tracker.start(target);
    await h.tick();
    expect(h.timers).toHaveLength(1);
  });

  it('holds no timer once stopped, so no eligible job means no collection', async () => {
    const h = harness();
    await h.tracker.start(target);
    h.tracker.stop();
    await h.tick();
    expect(h.report).not.toHaveBeenCalled();
    expect(h.tracker.getState().bookingId).toBeNull();
  });

  it('is idempotent', async () => {
    const h = harness();
    await h.tracker.start(target);
    h.tracker.stop();
    expect(() => {
      h.tracker.stop();
      h.tracker.stop();
    }).not.toThrow();
  });
});

describe('one session at a time', () => {
  it('does not spawn a second loop for the booking already being tracked', async () => {
    const h = harness();
    await h.tracker.start(target);
    const before = h.timers.length;
    await h.tracker.start(target);
    expect(h.timers).toHaveLength(before);
  });

  it('replaces the session when a DIFFERENT booking starts', async () => {
    const h = harness();
    await h.tracker.start(target);
    await h.tracker.start({ bookingId: 'b2', assignmentVersion: 1 });
    await h.tick();
    // A reassignment must not leave the previous booking's samples in flight.
    expect(h.report.mock.calls[0]?.[0]).toMatchObject({ bookingId: 'b2' });
  });
});

describe('native background callback', () => {
  const location = {
    coords: {
      latitude: 28.4595,
      longitude: 77.0266,
      accuracy: 8,
      altitude: null,
      heading: null,
      speed: null,
      altitudeAccuracy: null,
    },
    timestamp: 1_700_000_000_000,
    mocked: false,
  };

  function backgroundHarness(arrived = false) {
    const record = {
      target,
      enabled: true,
      nextReportAtMs: 0,
      lastLocationTimestampMs: null,
    } as const;
    const report = jest.fn(async () => ({
      accepted: true,
      reason: null,
      confidence: 'high' as const,
      persisted: true,
      etaRevised: false,
      arrived,
      nextReportAfterSeconds: 30,
    }));
    const save = jest.fn(async () => undefined);
    const clear = jest.fn(async () => undefined);
    const stop = jest.fn(async () => undefined);
    const deps: BackgroundTaskDependencies = {
      load: async () => record,
      save,
      clear,
      report: report as unknown as BackgroundTaskDependencies['report'],
      stop,
      now: () => 1_700_000_000_000,
    };
    return { deps, report, save, clear, stop };
  }

  it('uses the persisted assignment and stores the server cadence', async () => {
    const h = backgroundHarness();
    await processBackgroundLocations({ locations: [location] }, h.deps);

    expect(h.report).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'b1', assignmentVersion: 3, accuracyMetres: 8 }),
    );
    expect(h.save).toHaveBeenCalledWith(
      expect.objectContaining({
        target,
        enabled: true,
        lastLocationTimestampMs: location.timestamp,
        nextReportAtMs: 1_700_000_030_000,
      }),
    );
    expect(h.clear).not.toHaveBeenCalled();
  });

  it('clears the persisted target only after the backend commits arrival', async () => {
    const h = backgroundHarness(true);
    await processBackgroundLocations({ locations: [location] }, h.deps);

    expect(h.clear).toHaveBeenCalledTimes(1);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(h.save).not.toHaveBeenCalled();
  });
});
