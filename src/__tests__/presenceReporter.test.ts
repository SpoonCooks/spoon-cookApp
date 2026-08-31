import {
  PRESENCE_PING_INTERVAL_MS,
  reportPresenceOnce,
  type PresenceReporterDependencies,
} from '@core/location/presenceReporter';

/**
 * The ping that keeps an idle cook bookable.
 *
 * Instant routes from the cook's current position, and `locationTracker` only streams while she
 * is travelling — so once she arrives her fix ages out and a present, free cook drops out of
 * instant entirely. These cases pin the two properties that make this safe to run on every screen:
 * it is silent about failure, and it never reports without permission.
 */

function deps(over: Partial<PresenceReporterDependencies> = {}): PresenceReporterDependencies {
  return {
    getForegroundPermission: async () => ({ granted: true }),
    getCurrentPosition: async () =>
      ({
        coords: { latitude: 28.5, longitude: 77.2, accuracy: 11 },
        timestamp: Date.parse('2026-08-31T12:00:00.000Z'),
      }) as never,
    report: jest.fn(async () => undefined),
    setInterval: (handler, ms) => setInterval(handler, ms),
    clearInterval: (handle) => clearInterval(handle),
    ...over,
  };
}

describe('idle presence reporting', () => {
  it('sends the fix the device actually recorded, not the time of upload', async () => {
    const report = jest.fn(async () => undefined);
    const sent = await reportPresenceOnce(deps({ report }));

    expect(sent).toBe(true);
    expect(report).toHaveBeenCalledWith({
      latitude: 28.5,
      longitude: 77.2,
      accuracyMetres: 11,
      recordedAtIso: '2026-08-31T12:00:00.000Z',
    });
  });

  it('reports nothing when location permission was never granted', async () => {
    // Reading the permission rather than requesting it is deliberate: a cook who merely opened
    // the app must not be shown a system dialog for a feature she did not invoke.
    const report = jest.fn(async () => undefined);
    const sent = await reportPresenceOnce(
      deps({ getForegroundPermission: async () => ({ granted: false }), report }),
    );

    expect(sent).toBe(false);
    expect(report).not.toHaveBeenCalled();
  });

  it('stays silent when the fix cannot be taken', async () => {
    // A cold GPS is not the cook doing anything wrong, and nothing downstream is waiting.
    await expect(
      reportPresenceOnce(
        deps({
          getCurrentPosition: async () => {
            throw new Error('location unavailable');
          },
        }),
      ),
    ).resolves.toBe(false);
  });

  it('stays silent when the upload fails', async () => {
    await expect(
      reportPresenceOnce(
        deps({
          report: async () => {
            throw new Error('network');
          },
        }),
      ),
    ).resolves.toBe(false);
  });

  it('refreshes inside the server freshness bound', () => {
    // The server treats a position older than five minutes as unusable. A slower interval than
    // that would guarantee windows where a reporting cook is still invisible to instant.
    expect(PRESENCE_PING_INTERVAL_MS).toBeLessThan(5 * 60 * 1000);
  });
});
