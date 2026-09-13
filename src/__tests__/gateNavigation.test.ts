/**
 * Operational-gate navigation.
 *
 * The product rule under test is the one from the backend handoff: the cook's destination is the
 * immutable `booking_operational_snapshots.gate_point`, and "customer map pins, flat/tower,
 * mutable society configuration and dynamically selected nearest gates are not arrival authority."
 *
 * These tests exist because the previous build shipped a `Map dekhe` button with no handler at
 * all — the rule was stated in a comment and enforced by nothing.
 */

import {
  gateNavigationUrl,
  gateWebFallbackUrl,
  isNavigableGate,
  openGateNavigation,
} from '@core/location/navigation';
import type { GateTarget } from '@core/domain/serviceState';

const gate: GateTarget = {
  latitude: 28.4595,
  longitude: 77.0266,
  label: 'Society gate',
  accessInstructions: 'Guard ko booking ID bataye.',
};

describe('isNavigableGate', () => {
  it('accepts a real gate', () => {
    expect(isNavigableGate(gate)).toBe(true);
  });

  it('rejects a missing gate', () => {
    expect(isNavigableGate(null)).toBe(false);
  });

  it('rejects Null Island, which is what a dropped coordinate looks like', () => {
    expect(isNavigableGate({ ...gate, latitude: 0, longitude: 0 })).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(isNavigableGate({ ...gate, latitude: 91 })).toBe(false);
    expect(isNavigableGate({ ...gate, longitude: -181 })).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isNavigableGate({ ...gate, latitude: Number.NaN })).toBe(false);
  });
});

describe('gateNavigationUrl', () => {
  it('builds an Android geo: URI that repeats the coordinate', () => {
    // Without `q=<lat>,<lng>` many maps apps treat the label as a free-text search and recentre
    // on a different place with a similar name — which would send the cook to the wrong gate.
    expect(gateNavigationUrl(gate, 'android')).toBe(
      'geo:28.459500,77.026600?q=28.459500,77.026600(Society%20gate)',
    );
  });

  it('builds an Apple Maps driving URL on iOS', () => {
    expect(gateNavigationUrl(gate, 'ios')).toBe(
      'maps://?daddr=28.459500,77.026600&dirflg=d&q=Society%20gate',
    );
  });

  it('falls back to a universal https URL', () => {
    expect(gateWebFallbackUrl(gate)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=28.459500,77.026600&travelmode=driving',
    );
  });

  it('URI-encodes a label containing separators', () => {
    const url = gateNavigationUrl({ ...gate, label: 'Gate 2, A&B Block' }, 'android');
    expect(url).toContain('(Gate%202%2C%20A%26B%20Block)');
  });

  it('omits the caption when there is no label', () => {
    expect(gateNavigationUrl({ ...gate, label: null }, 'android')).toBe(
      'geo:28.459500,77.026600?q=28.459500,77.026600',
    );
  });

  it('returns null rather than a URL to nowhere for an unnavigable gate', () => {
    expect(gateNavigationUrl(null, 'android')).toBeNull();
    expect(gateNavigationUrl({ ...gate, latitude: 0, longitude: 0 }, 'ios')).toBeNull();
  });

  it('never routes to the flat — the builder accepts only a gate', () => {
    // A compile-time guarantee restated at runtime: every URL contains the gate coordinate and
    // nothing address-shaped can reach the destination parameter.
    const url = gateNavigationUrl(gate, 'web') ?? '';
    expect(url).toContain('28.459500,77.026600');
  });
});

describe('openGateNavigation', () => {
  it('opens the platform scheme when a handler exists', async () => {
    const openUrl = jest.fn().mockResolvedValue(true);
    const opened = await openGateNavigation(gate, {
      openUrl,
      canOpenUrl: async () => true,
      platform: 'android',
    });
    expect(opened).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('geo:28.459500,77.026600'));
  });

  it('falls back to https when the scheme has no handler', async () => {
    const openUrl = jest.fn().mockResolvedValue(true);
    const opened = await openGateNavigation(gate, {
      openUrl,
      canOpenUrl: async () => false,
      platform: 'android',
    });
    expect(opened).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('https://www.google.com/maps'));
  });

  it('falls back when canOpenURL throws (Android package visibility)', async () => {
    const openUrl = jest.fn().mockResolvedValue(true);
    const opened = await openGateNavigation(gate, {
      openUrl,
      canOpenUrl: async () => {
        throw new Error('package visibility');
      },
      platform: 'android',
    });
    expect(opened).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('https://'));
  });

  it('reports failure instead of silently doing nothing when the gate is unusable', async () => {
    const openUrl = jest.fn();
    const opened = await openGateNavigation(null, {
      openUrl,
      canOpenUrl: async () => true,
      platform: 'android',
    });
    expect(opened).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('reports failure when every open attempt throws', async () => {
    const opened = await openGateNavigation(gate, {
      openUrl: async () => {
        throw new Error('no activity found');
      },
      canOpenUrl: async () => false,
      platform: 'android',
    });
    expect(opened).toBe(false);
  });
});
