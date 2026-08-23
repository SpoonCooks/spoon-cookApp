/**
 * Turn-by-turn navigation to the OPERATIONAL GATE.
 *
 * ## The product rule this module exists to enforce
 *
 * The cook's destination is the backend's immutable `booking_operational_snapshots.gate_point` —
 * the same coordinate that drives ETA, arrival distance and the 75 m arrival radius. It is NOT the
 * customer's map pin, the flat, the tower, or anything geocoded from the address text.
 *
 * That is why {@link gateNavigationUrl} takes a {@link GateTarget} and nothing else. There is no
 * overload that accepts an address, so a future edit cannot quietly start routing a cook to a
 * doorstep: the only thing this file can build a URL from is the coordinate the backend nominated.
 * Sending a cook to a pin 200 m from the gate would also mean their GPS never satisfies the
 * arrival rule, so this is a fulfilment correctness issue and not only a UX one.
 *
 * ## Why a `geo:` URI on Android
 *
 * `geo:` opens the system chooser, so a cook who uses a different maps app is not forced into
 * Google Maps. The `q=` parameter repeats the coordinate — without it, Android drops a pin at the
 * lat/lng but many apps then search the label as free text and recentre on a *different* place
 * with a similar name. Repeating the coordinate keeps the pin authoritative and reduces the label
 * to a caption.
 *
 * The label is placed in parentheses after the coordinate, which is the documented `geo:` caption
 * form. It is URI-encoded because a society name legitimately contains spaces, commas and `&`.
 */

import { Linking, Platform } from 'react-native';

import type { GateTarget } from '../domain/serviceState';

/** A coordinate that could not be a real gate is not navigable. */
export function isNavigableGate(gate: GateTarget | null): gate is GateTarget {
  if (gate === null) return false;
  const { latitude, longitude } = gate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  // Null Island is what a dropped/zeroed coordinate looks like. Never route a cook to it.
  return !(latitude === 0 && longitude === 0);
}

/**
 * The platform's navigation URL for a gate.
 *
 * Returns `null` when the gate is not navigable, so a caller cannot open a maps app pointed at a
 * coordinate the backend never supplied.
 *
 * Kept pure and platform-parameterised so the Android and iOS forms are both unit-testable on a
 * single host — `Platform.OS` is read only by {@link openGateNavigation}.
 */
export function gateNavigationUrl(
  gate: GateTarget | null,
  platform: 'android' | 'ios' | 'web' = 'android',
): string | null {
  if (!isNavigableGate(gate)) return null;

  // Fixed precision keeps the URL stable and avoids float formatting like `28.459500000000002`.
  const lat = gate.latitude.toFixed(6);
  const lng = gate.longitude.toFixed(6);
  const label = gate.label === null || gate.label.length === 0 ? null : gate.label;

  if (platform === 'android') {
    const caption = label === null ? '' : `(${encodeURIComponent(label)})`;
    return `geo:${lat},${lng}?q=${lat},${lng}${caption}`;
  }

  if (platform === 'ios') {
    // Apple Maps. `daddr` is the DESTINATION and `dirflg=d` requests driving directions; omitting
    // `saddr` lets Maps use the device's current position rather than a guessed origin.
    const name = label === null ? '' : `&q=${encodeURIComponent(label)}`;
    return `maps://?daddr=${lat},${lng}&dirflg=d${name}`;
  }

  // Universal fallback. Works in any browser and on any platform whose scheme handler is missing.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/** Always resolvable — used when the platform scheme has no handler. */
export function gateWebFallbackUrl(gate: GateTarget | null): string | null {
  return gateNavigationUrl(gate, 'web');
}

export interface NavigationDependencies {
  readonly openUrl: (url: string) => Promise<unknown>;
  readonly canOpenUrl: (url: string) => Promise<boolean>;
  readonly platform: 'android' | 'ios' | 'web';
}

const defaultNavigationDependencies: NavigationDependencies = {
  openUrl: (url) => Linking.openURL(url),
  canOpenUrl: (url) => Linking.canOpenURL(url),
  platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
};

/**
 * Open the device's maps app at the operational gate.
 *
 * Resolves `false` when there is nothing safe to open — an unnavigable gate, or no handler for
 * either the platform scheme or the https fallback. The caller surfaces that to the cook rather
 * than leaving a button that silently does nothing, which is exactly the defect this replaces.
 */
export async function openGateNavigation(
  gate: GateTarget | null,
  deps: NavigationDependencies = defaultNavigationDependencies,
): Promise<boolean> {
  const primary = gateNavigationUrl(gate, deps.platform);
  if (primary === null) return false;

  try {
    if (await deps.canOpenUrl(primary)) {
      await deps.openUrl(primary);
      return true;
    }
  } catch {
    // A throwing `canOpenURL` (an Android package-visibility refusal, for instance) is not a
    // reason to give up — the https fallback below is handled by every browser.
  }

  const fallback = gateWebFallbackUrl(gate);
  if (fallback === null || fallback === primary) return false;
  try {
    await deps.openUrl(fallback);
    return true;
  } catch {
    return false;
  }
}
