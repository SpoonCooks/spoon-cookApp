import Constants from 'expo-constants';

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

/** Non-sensitive startup evidence for identifying a locally installed dev/staging artifact. */
export function logBuildProvenance(): void {
  const provenance = getBuildProvenance();
  if (provenance.environment !== 'production') {
    console.info('[spoon-build-provenance]', provenance);
  }
}
