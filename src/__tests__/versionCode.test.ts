/**
 * `versionCode` — the number Play uses to decide whether an upload is new.
 *
 * It was unset, which means 1 for every build ever made. The FIRST upload would have succeeded and
 * the second would have been rejected, with nothing in the repo explaining why. That is a failure
 * that only appears once you are already shipping, so it is pinned here.
 */

function load(env: Record<string, string | undefined>) {
  const previous = { ...process.env };
  Object.assign(process.env, { APP_ENV: 'production', ...env });
  jest.resetModules();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const factory = require('../../app.config').default as (c: unknown) => {
      android?: { versionCode?: number };
    };
    return factory({ config: {} });
  } finally {
    process.env = previous;
  }
}

describe('versionCode', () => {
  it('defaults to the build date, so it rises without anyone bumping it', () => {
    const now = new Date();
    const expected =
      (now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()) * 10;

    const config = load({ EXPO_PUBLIC_API_BASE_URL: 'https://api.test.invalid' });

    expect(config.android?.versionCode).toBe(expected);
  });

  it('stays inside the ceiling Play enforces', () => {
    // 2,100,000,000 is the hard limit. A date-derived code passes it only after the year 2100.
    const config = load({ EXPO_PUBLIC_API_BASE_URL: 'https://api.test.invalid' });

    expect(config.android?.versionCode).toBeLessThan(2_100_000_000);
  });

  it('lets an explicit value win, for a second upload on the same day', () => {
    const config = load({
      EXPO_PUBLIC_API_BASE_URL: 'https://api.test.invalid',
      SPOON_VERSION_CODE: '202609171',
    });

    expect(config.android?.versionCode).toBe(202_609_171);
  });

  it('refuses a value Play could not accept rather than shipping it', () => {
    for (const bad of ['0', '-5', 'latest', '1.2']) {
      expect(() =>
        load({ EXPO_PUBLIC_API_BASE_URL: 'https://api.test.invalid', SPOON_VERSION_CODE: bad }),
      ).toThrow(/positive integer/);
    }
  });
});
