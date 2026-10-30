import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { ApiError } from '@core/api/errors';
import { reportTaskError } from '@core/crash/reportTaskError';
import { PRESENCE_TASK_NAME } from '@core/location/presenceBackground';
import {
  LOCATION_TASK_NAME,
  processBackgroundLocations,
  type BackgroundTaskDependencies,
} from '@core/location/tracker';

/**
 * The headless location tasks run with no screen and no cook watching, so a failure in them is
 * otherwise invisible: it shows up only as a cook who "stopped being tracked". These pin WHICH
 * failures are reported. Expected ones (offline, 5xx, 401, 429 -- the next fix retries, which is
 * what #29 made them do) must stay silent, or this becomes noise nobody reads.
 */

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('@core/crash/reportTaskError', () => ({ reportTaskError: jest.fn() }));

const mockedReport = jest.mocked(reportTaskError);

type TaskBody = (args: { data?: unknown; error?: unknown }) => Promise<void>;

/** The callback a module registered with `TaskManager.defineTask` under a task name. */
function registeredTask(name: string): TaskBody {
  const call = jest
    .mocked(TaskManager.defineTask)
    .mock.calls.find(([taskName]) => taskName === name);
  if (call === undefined) throw new Error(`no task registered as ${name}`);
  return call[1] as unknown as TaskBody;
}

function appIs(state: 'active' | 'background'): void {
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true });
}

const LOCATION = {
  coords: {
    latitude: 12.9,
    longitude: 77.6,
    accuracy: 8,
    altitude: null,
    heading: null,
    speed: null,
    altitudeAccuracy: null,
  },
  timestamp: 1_700_000_000_000,
  mocked: false,
};

function backgroundDeps(
  overrides: Partial<BackgroundTaskDependencies>,
): BackgroundTaskDependencies {
  return {
    load: async () => ({
      target: { bookingId: 'b1', assignmentVersion: 3 },
      enabled: true,
      nextReportAtMs: 0,
      lastLocationTimestampMs: null,
    }),
    save: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    report: jest.fn(async () => ({
      accepted: true,
      reason: null,
      confidence: 'high' as const,
      persisted: true,
      etaRevised: false,
      arrived: false,
      nextReportAfterSeconds: 30,
    })),
    now: () => 1_700_000_000_000,
    ...overrides,
  } as BackgroundTaskDependencies;
}

beforeEach(() => {
  mockedReport.mockClear();
  appIs('background');
});

afterEach(() => {
  appIs('active');
});

describe('location task: what gets reported from processBackgroundLocations', () => {
  it('stays silent for an expected API failure, whatever its kind', async () => {
    const failures = [
      new ApiError({ kind: 'offline', message: 'no signal' }),
      new ApiError({ kind: 'timeout' as never, message: 'slow' }),
      new ApiError({
        kind: 'server',
        message: 'down',
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
      }),
      new ApiError({ kind: 'server', message: 'expired', status: 401, code: 'UNAUTHENTICATED' }),
      new ApiError({ kind: 'server', message: 'slow down', status: 429, code: 'RATE_LIMITED' }),
    ];

    for (const failure of failures) {
      await processBackgroundLocations(
        { locations: [LOCATION] },
        backgroundDeps({ report: jest.fn(async () => Promise.reject(failure)) as never }),
      );
    }

    expect(mockedReport).not.toHaveBeenCalled();
  });

  it('reports a local fault that is not an API failure, such as storage failing', async () => {
    const storage = new Error('SecureStore write failed');

    await processBackgroundLocations(
      { locations: [LOCATION] },
      backgroundDeps({ save: jest.fn(async () => Promise.reject(storage)) }),
    );

    expect(mockedReport).toHaveBeenCalledWith('location', storage);
  });

  it('still stops tracking on a terminal rejection, and does not report that either', async () => {
    const clear = jest.fn(async () => undefined);
    const stop = jest.fn(async () => undefined);
    const terminal = new ApiError({
      kind: 'server',
      message: 'changed',
      status: 409,
      code: 'ACTIVE_ASSIGNMENT_CHANGED',
    });

    await processBackgroundLocations(
      { locations: [LOCATION] },
      backgroundDeps({
        clear,
        stop,
        report: jest.fn(async () => Promise.reject(terminal)) as never,
      }),
    );

    expect(clear).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(mockedReport).not.toHaveBeenCalled();
  });
});

describe('location task callback', () => {
  it("reports the task manager's own error and stops there", async () => {
    const nativeError = { code: 'E_TASK', message: 'location service died' };

    await registeredTask(LOCATION_TASK_NAME)({ error: nativeError });

    expect(mockedReport).toHaveBeenCalledWith('location', nativeError);
  });

  it('does nothing in the foreground, where the timer owns reporting', async () => {
    appIs('active');

    await registeredTask(LOCATION_TASK_NAME)({ data: { locations: [LOCATION] } });

    expect(mockedReport).not.toHaveBeenCalled();
  });
});

describe('presence task callback', () => {
  it("reports the task manager's own error and stops there", async () => {
    const nativeError = { code: 'E_TASK', message: 'presence service died' };

    await registeredTask(PRESENCE_TASK_NAME)({ error: nativeError });

    expect(mockedReport).toHaveBeenCalledWith('presence', nativeError);
  });

  it('reports an exception that escapes, then rethrows it so behaviour is unchanged', async () => {
    // `newestFix` reads `.timestamp` of every entry after the first: a null entry throws a TypeError.
    const data = { locations: [{ timestamp: 1 }, null] };

    await expect(registeredTask(PRESENCE_TASK_NAME)({ data })).rejects.toThrow(TypeError);

    expect(mockedReport).toHaveBeenCalledWith('presence', expect.any(TypeError));
  });

  it('does nothing in the foreground', async () => {
    appIs('active');

    await registeredTask(PRESENCE_TASK_NAME)({ data: { locations: [{ timestamp: 1 }, null] } });

    expect(mockedReport).not.toHaveBeenCalled();
  });
});
