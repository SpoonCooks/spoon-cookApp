/**
 * Runtime configuration read back from `app.config.ts` via `expo-constants`.
 *
 * `extra` is embedded in the JS bundle in plaintext, so only non-secret values live here. The
 * base URL is deliberately NOT defaulted in production: `app.config.ts` leaves `apiBaseUrl`
 * undefined unless `EXPO_PUBLIC_API_BASE_URL` is supplied, and `requireApiBaseUrl()` throws
 * rather than letting a release build silently point at a development host.
 */

import Constants from 'expo-constants';

export const appEnvs = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof appEnvs)[number];

interface ExtraShape {
  readonly appEnv?: unknown;
  readonly apiBaseUrl?: unknown;
}

function extra(): ExtraShape {
  const value: unknown = Constants.expoConfig?.extra;
  return typeof value === 'object' && value !== null ? (value as ExtraShape) : {};
}

export function appEnv(): AppEnv {
  const value = extra().appEnv;
  const found = appEnvs.find((env) => env === value);
  return found ?? 'development';
}

/** `undefined` when unset — callers decide whether that is fatal. */
export function apiBaseUrl(): string | undefined {
  const value = extra().apiBaseUrl;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * The API base URL, or a thrown error.
 *
 * Failing loudly is the point: an app that cannot name its backend must not start making
 * requests against a guessed one.
 */
export function requireApiBaseUrl(): string {
  const value = apiBaseUrl();
  if (value === undefined) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not set. The app cannot choose a backend on its own.',
    );
  }
  return value.replace(/\/+$/, '');
}

/** All Spoon v1 routes live under this prefix. */
export const apiPathPrefix = '/v1';

/** Request timeout. Cook devices are frequently on poor mobile data. */
export const requestTimeoutMs = 15_000;
