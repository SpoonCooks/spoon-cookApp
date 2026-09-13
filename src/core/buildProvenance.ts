import Constants from 'expo-constants';

import { apiBaseUrl } from './config';

export interface BuildProvenance {
  readonly releaseSha: string;
  readonly buildTimestamp: string;
  readonly environment: string;
  readonly apiBaseUrlLabel: string;
  readonly expoRuntimeVersion: string;
  readonly expoUpdateId: string;
}

const UNKNOWN = 'unknown';

function readString(value: unknown, fallback = UNKNOWN): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function getBuildProvenance(): BuildProvenance {
  const extra = Constants.expoConfig?.extra as { buildProvenance?: unknown } | undefined;
  const value = extra?.buildProvenance;
  if (typeof value !== 'object' || value === null) {
    return {
      releaseSha: UNKNOWN,
      buildTimestamp: UNKNOWN,
      environment: UNKNOWN,
      apiBaseUrlLabel: UNKNOWN,
      expoRuntimeVersion: UNKNOWN,
      expoUpdateId: UNKNOWN,
    };
  }

  const provenance = value as Record<string, unknown>;
  return {
    releaseSha: readString(provenance.releaseSha),
    buildTimestamp: readString(provenance.buildTimestamp),
    environment: readString(provenance.environment),
    apiBaseUrlLabel: readString(provenance.apiBaseUrlLabel),
    expoRuntimeVersion: readString(provenance.expoRuntimeVersion),
    expoUpdateId: readString(provenance.expoUpdateId),
  };
}

/**
 * Non-sensitive startup evidence for identifying a locally installed dev/staging artifact.
 *
 * The resolved API base URL is logged alongside it, and that is the important half.
 *
 * `extra.apiBaseUrl` is fixed when `app.config.ts` is evaluated — during the native build — so a
 * handset keeps whatever backend it was BUILT against. Setting `EXPO_PUBLIC_API_BASE_URL` when
 * Metro starts changes nothing, which is not obvious and is easy to get wrong in the other
 * direction: a local build aimed at a mock will happily keep talking to the deployed backend while
 * every local request log stays empty. That happened during the 2026-09-13 device run, where a
 * login OTP was dispatched against the real backend before anyone noticed.
 *
 * Printing the actual URL at startup makes the mistake visible in one line instead of after a
 * request has already gone out. Suppressed in production, where the value is not news and the log
 * is not read.
 */
export function logBuildProvenance(): void {
  const provenance = getBuildProvenance();
  if (provenance.environment !== 'production') {
    console.info('[spoon-build-provenance]', { ...provenance, apiBaseUrl: apiBaseUrl() ?? 'unset' });
  }
}
