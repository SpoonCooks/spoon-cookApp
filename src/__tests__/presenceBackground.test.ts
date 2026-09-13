import {
  newestFix,
  processPresenceLocations,
  startPresenceBackground,
  stopPresenceBackground,
  PRESENCE_BACKGROUND_INTERVAL_MS,
  type PresenceBackgroundDependencies,
} from '@core/location/presenceBackground';

/**
 * Keeping an idle cook's position fresh while the app is off screen.
 *
 * The foreground ping stops the moment she leaves the app, so a cook who marked present and
 * pocketed her phone went stale within minutes and instant stopped offering her — while she sat
 * waiting for exactly that work. These cover the parts that decide whether the service runs at
 * all, because a background service that silently fails to start looks identical to the bug it
 * was written to fix.
 */

function deps(overrides: Partial<PresenceBackgroundDependencies> = {}) {
  const calls = { started: 0, stopped: 0, requested: 0 };
  const base: PresenceBackgroundDependencies = {
    getBackgroundPermission: async () => ({ granted: true }),
    requestBackgroundPermission: async () => {
      calls.requested += 1;
      return { granted: true };
    },
    hasStarted: async () => false,
    start: async () => {
      calls.started += 1;
    },
    stop: async () => {
      calls.stopped += 1;
    },
    ...overrides,
  };
  return { deps: base, calls };
}

describe('presence background service', () => {
  it('starts when the permission is already held, without asking again', async () => {
    const { deps: d, calls } = deps();

    await expect(startPresenceBackground(d)).resolves.toBe(true);
    expect(calls.started).toBe(1);
    expect(calls.requested).toBe(0);
  });

  it('asks for the permission when it is not held yet', async () => {
    const { deps: d, calls } = deps({
      getBackgroundPermission: async () => ({ granted: false }),
    });

    await expect(startPresenceBackground(d)).resolves.toBe(true);
    expect(calls.requested).toBe(1);
    expect(calls.started).toBe(1);
  });

  /*
   * A refusal is a real answer, not a failure. She keeps the foreground ping and the backend's
   * hub fallback still offers her, so this must return quietly rather than throw into a screen
   * she is standing in front of.
   */
  it('gives up quietly when the cook refuses', async () => {
    const { deps: d, calls } = deps({
      getBackgroundPermission: async () => ({ granted: false }),
      requestBackgroundPermission: async () => ({ granted: false }),
    });

    await expect(startPresenceBackground(d)).resolves.toBe(false);
    expect(calls.started).toBe(0);
  });

  it('does not start a service that is already running', async () => {
    const { deps: d, calls } = deps({ hasStarted: async () => true });

    await expect(startPresenceBackground(d)).resolves.toBe(true);
    expect(calls.started).toBe(0);
  });

  it('swallows a start that throws rather than breaking the screen behind it', async () => {
    const { deps: d } = deps({
      start: async () => {
        throw new Error('native module unavailable');
      },
    });

    await expect(startPresenceBackground(d)).resolves.toBe(false);
  });

  it('stops only a service that is running', async () => {
    const running = deps({ hasStarted: async () => true });
    await stopPresenceBackground(running.deps);
    expect(running.calls.stopped).toBe(1);

    const idle = deps({ hasStarted: async () => false });
    await stopPresenceBackground(idle.deps);
    expect(idle.calls.stopped).toBe(0);
  });
});

describe('what gets reported', () => {
  const fix = (timestamp: number, latitude: number) =>
    ({
      timestamp,
      coords: { latitude, longitude: 77.6, accuracy: 12 },
    }) as never;

  it('takes the newest of a batch', () => {
    const newest = newestFix([fix(1_000, 12.1), fix(3_000, 12.3), fix(2_000, 12.2)]);
    expect(newest?.timestamp).toBe(3_000);
  });

  /*
   * One report, not five. Android hands over a backlog after a doze window, and these are
   * origin estimates rather than evidence — nobody will ask what her afternoon looked like, so
   * posting the whole queue would spend her data telling the server stale things it cannot use.
   */
  it('sends one sample for a whole backlog', async () => {
    const sent: { latitude: number }[] = [];
    await processPresenceLocations(
      { locations: [fix(1_000, 12.1), fix(3_000, 12.3), fix(2_000, 12.2)] },
      async (body) => {
        sent.push({ latitude: body.latitude });
      },
    );

    expect(sent).toEqual([{ latitude: 12.3 }]);
  });

  it('reports nothing when the batch is empty or malformed', async () => {
    let calls = 0;
    const count = async () => {
      calls += 1;
    };

    await processPresenceLocations({ locations: [] }, count);
    await processPresenceLocations({}, count);
    await processPresenceLocations(undefined, count);

    expect(calls).toBe(0);
  });

  it('does not throw when the report fails', async () => {
    await expect(
      processPresenceLocations({ locations: [fix(1_000, 12.1)] }, async () => {
        throw new Error('offline');
      }),
    ).resolves.toBeUndefined();
  });
});

describe('the interval', () => {
  /*
   * Minutes, not seconds. The assignment tracker samples every five seconds at High accuracy
   * because it is deciding whether she is at a gate; reusing those numbers for a whole
   * seventeen-hour shift would flatten her phone to answer a question that tolerates minutes.
   */
  it('is slow enough to live on a phone all day', () => {
    expect(PRESENCE_BACKGROUND_INTERVAL_MS).toBeGreaterThanOrEqual(60_000);
    // Well inside the server's forty-five minute origin window, with room for missed fixes.
    expect(PRESENCE_BACKGROUND_INTERVAL_MS).toBeLessThanOrEqual(10 * 60_000);
  });
});
