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
  it('builds a Google Maps URL on Android that opens on Walk', () => {
    // A `geo:` URI cannot carry a travel mode, so Google Maps opened it on Drive. The URL API can.
    const url = gateNavigationUrl(gate, 'android');
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=28.459500,77.026600&travelmode=walking',
    );
    expect(url).not.toContain('driving');
  });

  it('builds an Apple Maps walking URL on iOS', () => {
    expect(gateNavigationUrl(gate, 'ios')).toBe(
      'maps://?daddr=28.459500,77.026600&dirflg=w&q=Society%20gate',
    );
  });

  it('falls back to a universal https URL on Walk', () => {
    expect(gateWebFallbackUrl(gate)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=28.459500,77.026600&travelmode=walking',
    );
  });

  it('URI-encodes a label containing separators on iOS', () => {
    const url = gateNavigationUrl({ ...gate, label: 'Gate 2, A&B Block' }, 'ios');
    expect(url).toContain('&q=Gate%202%2C%20A%26B%20Block');
  });

  it('routes to the coordinate only: the Android URL carries no label to search for', () => {
    const named = gateNavigationUrl(gate, 'android');
    const unnamed = gateNavigationUrl({ ...gate, label: null }, 'android');
    expect(named).toBe(unnamed);
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
  it('opens the Android Walk link without probing canOpenURL', async () => {
    const openUrl = jest.fn().mockResolvedValue(true);
    const canOpenUrl = jest.fn().mockResolvedValue(false);
    const opened = await openGateNavigation(gate, { openUrl, canOpenUrl, platform: 'android' });
    expect(opened).toBe(true);
    expect(canOpenUrl).not.toHaveBeenCalled();
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('travelmode=walking'));
  });

  it('opens the iOS scheme when a handler exists', async () => {
    const openUrl = jest.fn().mockResolvedValue(true);
    const opened = await openGateNavigation(gate, {
      openUrl,
      canOpenUrl: async () => true,
      platform: 'ios',
    });
    expect(opened).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('dirflg=w'));
  });

  it('falls back to https when the scheme has no handler', async () => {
    const openUrl = jest.fn().mockResolvedValue(true);
    const opened = await openGateNavigation(gate, {
      openUrl,
      canOpenUrl: async () => false,
      platform: 'ios',
    });
    expect(opened).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('https://www.google.com/maps'));
  });

  it('falls back when canOpenURL throws', async () => {
    const openUrl = jest.fn().mockResolvedValue(true);
    const opened = await openGateNavigation(gate, {
      openUrl,
      canOpenUrl: async () => {
        throw new Error('package visibility');
      },
      platform: 'ios',
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
