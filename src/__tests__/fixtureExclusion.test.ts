/**
 * Production fixture-exclusion guarantee.
 *
 * A development fixture harness is permitted, but production must never render invented jobs,
 * earnings or service progress. These tests assert the guard actually holds when `__DEV__` is
 * false, so a release build cannot silently fall back to placeholder data.
 *
 * The V12 money fixtures are GONE rather than guarded: every Performance screen now reads
 * `GET /v1/cook/earnings`, its cycle routes and `/cook/me`, so there is no earnings shape left for
 * a fixture to stand in for. `serviceFixtures` survives for the projection tests only — no screen
 * imports it any more, which {@link no screen imports a fixture} asserts directly.
 */

/**
 * The mock reads through to a variable in THIS file rather than baking a value into the factory.
 *
 * Each case calls `jest.resetModules()` so `@core/fixtures` re-evaluates its `__DEV__` branch, and
 * that also re-runs this factory — a literal here would be reset to its original value every time
 * and the environment under test would silently be discarded. The `mock` prefix is what lets jest
 * hoist the factory above the declaration.
 */
let mockExtra: Record<string, unknown> = { appEnv: 'production' };

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));

function setAppEnv(env: string): void {
  mockExtra = { appEnv: env };
}

describe('fixtures are unavailable in the production app', () => {
  const originalDev = (globalThis as { __DEV__?: boolean | undefined }).__DEV__;

  afterEach(() => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = originalDev;
    setAppEnv('production');
    jest.resetModules();
  });

  it('reports fixtures as available in development', () => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = true;
    setAppEnv('production');
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixtures = require('@core/fixtures') as typeof import('@core/fixtures');
    // `__DEV__` alone is enough, whatever the environment says.
    expect(fixtures.areFixturesAvailable()).toBe(true);
  });

  it('reports fixtures as UNAVAILABLE in a production release build', () => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = false;
    setAppEnv('production');
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixtures = require('@core/fixtures') as typeof import('@core/fixtures');
    expect(fixtures.areFixturesAvailable()).toBe(false);
  });

  it.each(['development', 'staging'])(
    'reports fixtures as available in a %s release build',
    (env) => {
      // This is the deliberate widening: a NON-production release build may carry the gallery, so
      // the 47 screens can be handed to someone without a laptop and a Metro process. Production
      // is a different application id and is covered by the test above.
      (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = false;
      setAppEnv(env);
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fixtures = require('@core/fixtures') as typeof import('@core/fixtures');
      expect(fixtures.areFixturesAvailable()).toBe(true);
    },
  );

  it.each([{}, { appEnv: 'prod' }, { appEnv: 42 }])(
    'denies fixtures when the build declares no usable environment (%p)',
    (extra) => {
      // The gate names the environments that MAY have fixtures rather than the one that may not,
      // so a missing or malformed `extra` block fails CLOSED. `appEnv()` would have defaulted
      // these to `development` and served them.
      (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = false;
      mockExtra = extra as Record<string, unknown>;
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fixtures = require('@core/fixtures') as typeof import('@core/fixtures');
      expect(fixtures.areFixturesAvailable()).toBe(false);
    },
  );

  it('still resolves appEnv itself to development when unset', () => {
    // The default is unchanged for everyone else; only the safety gate refuses to use it.
    mockExtra = {};
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('@core/config') as typeof import('@core/config');
    expect(config.appEnv()).toBe('development');
    expect(config.declaredAppEnv()).toBeUndefined();
  });

  it('throws rather than returning placeholder data when read in production', () => {
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = false;
    setAppEnv('production');
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixtures = require('@core/fixtures') as typeof import('@core/fixtures');

    // Every accessor must fail loudly. Returning empty-but-valid data would be worse: the screen
    // would render as though the backend had legitimately reported "no jobs".
    expect(() => fixtures.jobFixtures.singleCurrent()).toThrow(/development-only/);
    // The gate devOnly() uses must be the same one the routes use, or the gallery renders and
    // then throws on its first fixture read.
    expect(fixtures.areFixturesAvailable()).toBe(false);
    expect(() => fixtures.serviceFixtures.travelOnTime()).toThrow(/development-only/);
    expect(() => fixtures.attendanceFixtures.month()).toThrow(/development-only/);
  });

  it('no screen imports a fixture', () => {
    // The real guarantee, checked at the import graph rather than at the `__DEV__` flag: a screen
    // that imports fixtures can render them, and `__DEV__` only decides whether that throws.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');

    const roots = [path.join(__dirname, '..', 'app'), path.join(__dirname, '..', 'ui')];
    // `src/app/dev` is the development gallery. It reads fixtures by design, and its whole route
    // subtree is gated by `areFixturesAvailable()` in `src/app/dev/_layout.tsx`, so it renders
    // nothing in a release build. It is the ONLY exemption, and the next test proves the gate is
    // actually there rather than trusting this comment.
    const devGallery = path.join(__dirname, '..', 'app', 'dev');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      if (dir === devGallery) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (fs.readFileSync(full, 'utf8').includes('@core/fixtures')) offenders.push(full);
      }
    };
    for (const root of roots) walk(root);

    expect(offenders).toEqual([]);
  });

  it('gates the whole dev gallery subtree behind areFixturesAvailable', () => {
    // The gallery is the one place allowed to read fixtures, so its gate is the thing standing
    // between a debug harness and a release build. Assert the layout gate exists, and that every
    // route file under it is reachable only through that layout.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');

    const devGallery = path.join(__dirname, '..', 'app', 'dev');
    const layout = fs.readFileSync(path.join(devGallery, '_layout.tsx'), 'utf8');
    expect(layout).toContain('areFixturesAvailable()');
    expect(layout).toMatch(/if \(!areFixturesAvailable\(\)\) return null;/);

    // Every screen under the gallery also refuses on its own, so a future route that is rendered
    // outside this layout still cannot draw fixture data.
    for (const entry of fs.readdirSync(devGallery)) {
      if (!/\.tsx$/.test(entry) || entry === '_layout.tsx') continue;
      expect(fs.readFileSync(path.join(devGallery, entry), 'utf8')).toContain(
        'areFixturesAvailable()',
      );
    }
  });

  it('no screen imports the dev fixture switcher', () => {
    // `FixtureSwitcher` legitimately imports fixtures, so the import-graph check above cannot walk
    // `src/features`. The guarantee that matters is that nothing in the production graph mounts
    // it: an orphaned dev harness ships as dead code, a mounted one ships as a way to fake state.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');

    const roots = [
      path.join(__dirname, '..', 'app'),
      path.join(__dirname, '..', 'ui'),
      path.join(__dirname, '..', 'core'),
    ];
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (fs.readFileSync(full, 'utf8').includes('FixtureSwitcher')) offenders.push(full);
      }
    };
    for (const root of roots) walk(root);

    expect(offenders).toEqual([]);
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
