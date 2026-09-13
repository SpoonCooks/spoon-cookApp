/**
 * API base URL regression guard.
 *
 * A release build that quietly points at a development host is the worst kind of configuration
 * bug: everything works in QA, and production traffic silently lands somewhere else. Two things
 * are asserted here —
 *
 *   1. `app.config.ts` refuses to invent a base URL for a production build, and
 *   2. no placeholder or developer host is hardcoded anywhere in the shipped source.
 */

import { appEnv, apiBaseUrl, apiPathPrefix, requireApiBaseUrl } from '@core/config';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Constants = require('expo-constants') as {
  default: { expoConfig: { extra: Record<string, unknown> } };
};

function setExtra(extra: Record<string, unknown>): void {
  Constants.default.expoConfig.extra = extra;
}

describe('runtime base URL', () => {
  afterEach(() => {
    setExtra({});
  });

  it('is read from the Expo config', () => {
    setExtra({ apiBaseUrl: 'https://api.example.test' });
    expect(apiBaseUrl()).toBe('https://api.example.test');
    expect(requireApiBaseUrl()).toBe('https://api.example.test');
  });

  it('throws rather than guessing a backend when unset', () => {
    setExtra({});
    expect(apiBaseUrl()).toBeUndefined();
    expect(() => requireApiBaseUrl()).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });

  it('treats an empty string as unset', () => {
    setExtra({ apiBaseUrl: '' });
    expect(() => requireApiBaseUrl()).toThrow();
  });

  it('strips trailing slashes so paths do not double up', () => {
    setExtra({ apiBaseUrl: 'https://api.example.test///' });
    expect(requireApiBaseUrl()).toBe('https://api.example.test');
  });

  it('defaults the environment to development rather than production', () => {
    setExtra({});
    expect(appEnv()).toBe('development');
    setExtra({ appEnv: 'nonsense' });
    expect(appEnv()).toBe('development');
  });

  it('uses the v1 prefix', () => {
    expect(apiPathPrefix).toBe('/v1');
  });
});

describe('app.config.ts', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  function loadConfig(): { extra?: Record<string, unknown>; android?: { package?: string } } {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../app.config.ts') as {
      default: (ctx: { config: Record<string, unknown> }) => {
        extra?: Record<string, unknown>;
        android?: { package?: string };
      };
    };
    return mod.default({ config: {} });
  }

  /**
   * It used to leave the url undefined and let the build continue, and this asserted that.
   *
   * The refusal to GUESS a backend was always right -- a build that guesses can silently talk to
   * the wrong environment. Letting it build with none was the worse half of the same trade, and
   * that is the half that shipped: a production APK went out with no api base url anywhere in it,
   * and the only symptom on the handset was every request failing as "Internet nahi mil raha.
   * Connection check kare." on a phone with four bars of 4G. The url had been present in the
   * previous build only because the variable happened to be exported in the shell that made it.
   *
   * So the rule is now stronger, not weaker: still never defaulted, and no longer buildable
   * without. The failure lands at build time carrying the name of the missing variable.
   */
  it('refuses to build for production without a base URL', () => {
    process.env.APP_ENV = 'production';
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(loadConfig).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });

  /* The message has to be actionable at 2am, so it names the variable AND the consequence. */
  it('says what is missing and what happens without it', () => {
    process.env.APP_ENV = 'production';
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(loadConfig).toThrow(/offline/);
  });

  it('honours an explicit production base URL', () => {
    process.env.APP_ENV = 'production';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.spoonhelp.com';
    expect(loadConfig().extra?.apiBaseUrl).toBe('https://api.spoonhelp.com');
  });

  it('does not carry the User App identity', () => {
    process.env.APP_ENV = 'production';
    // A production config cannot be built without this at all now, so the case has to supply it
    // to ask its own question, which is about the package name.
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.spoonhelp.com';
    expect(loadConfig().android?.package).toBe('com.spoonhelp.cookapp');
  });

  it('suffixes non-production bundle ids so builds cannot collide', () => {
    process.env.APP_ENV = 'staging';
    expect(loadConfig().android?.package).toBe('com.spoonhelp.cookapp.staging');
  });
});

describe('no host is hardcoded in shipped source', () => {
  it('contains no placeholder or developer host under src/', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');

    // `spoon.invalid` was the Phase-1 placeholder; the others are hosts that must only ever
    // arrive through the environment.
    const forbidden = [/spoon\.invalid/, /localhost:\d+/, /127\.0\.0\.1/, /10\.0\.2\.2/, /ngrok/];

    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        // The test file naming these patterns is not itself an offender.
        if (full.includes('__tests__')) continue;
        // Comments are stripped first: a hardcoded host is only dangerous if it can be REACHED.
        // Provenance notes (`scope.ts` records the Figma MCP server's loopback address) document
        // where a value came from and are never dialled.
        const source = fs
          .readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        for (const pattern of forbidden) {
          if (pattern.test(source)) offenders.push(`${full} :: ${pattern.source}`);
        }
      }
    };
    walk(path.join(__dirname, '..'));

    expect(offenders).toEqual([]);
  });
});
