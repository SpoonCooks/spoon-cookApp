/**
 * Production fixture-exclusion guarantee.
 *
 * Phase 1 permits a development fixture harness, but production must never render invented jobs,
 * earnings or service progress. These tests assert the guard actually holds when `__DEV__` is
 * false, so a release build cannot silently fall back to placeholder data.
 */

describe('fixtures are unavailable in a release build', () => {
  const originalDev = (globalThis as { __DEV__?: boolean | undefined }).__DEV__;

  afterEach(() => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = originalDev;
    jest.resetModules();
  });

  it('reports fixtures as available in development', () => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = true;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixtures = require('@core/fixtures') as typeof import('@core/fixtures');
    expect(fixtures.areFixturesAvailable()).toBe(true);
  });

  it('reports fixtures as unavailable in release', () => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = false;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixtures = require('@core/fixtures') as typeof import('@core/fixtures');
    expect(fixtures.areFixturesAvailable()).toBe(false);
  });

  it('throws rather than returning placeholder data when read in release', () => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = false;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixtures = require('@core/fixtures') as typeof import('@core/fixtures');

    // Every accessor must fail loudly. Returning empty-but-valid data would be worse: the screen
    // would render as though the backend had legitimately reported "no jobs".
    expect(() => fixtures.jobFixtures.singleCurrent()).toThrow(/development-only/);
    expect(() => fixtures.serviceFixtures.travelOnTime()).toThrow(/development-only/);
    expect(() => fixtures.moneyFixtures.day()).toThrow(/development-only/);
    expect(() => fixtures.attendanceFixtures.month()).toThrow(/development-only/);
  });

  it('exposes every service fixture in development, one per Figma state', () => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = true;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { serviceFixtures } = require('@core/fixtures') as typeof import('@core/fixtures');

    // Guards against a Figma frame quietly losing its fixture and its visual verification.
    expect(Object.keys(serviceFixtures)).toEqual(
      expect.arrayContaining([
        'travelOnTime',
        'travelAtRisk',
        'travelLate',
        'arrivedOnTime',
        'arrivedLate',
        'startOtpOnTime',
        'startOtpLate',
        'cooking',
        'cookingEndingSoon',
        'cookingExtended',
        'cookingThreeDigitTimer',
        'endOtp',
        'completed',
        'cancelledWhileTravelling',
      ]),
    );
  });
});
