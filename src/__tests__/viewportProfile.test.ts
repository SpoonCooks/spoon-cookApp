import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DIRECT_STATUS_BAND_HEIGHT,
  HOME_INDICATOR_HEIGHT,
  LEAVE_STATUS_BAND_HEIGHT,
  STATUS_BAND_HEIGHT,
  viewportProfile,
  viewportProfileBySection,
} from '@ui';

/**
 * The runtime's viewport model and the evidence harness's must not drift apart.
 *
 * `scripts/visual/compare.py` decides which rows of a Figma render count as application content.
 * `src/ui/theme/viewport.ts` states the same thing for the code that draws it. If the two ever
 * disagree, every comparison in the section silently scores the app against rows it was never
 * asked to draw — which is exactly how run 1 shipped a 25px displacement on the bezel sections and
 * still read it as a failure of the app.
 *
 * So the numbers are asserted against the Python source itself rather than restated by hand.
 */
const comparePy = readFileSync(
  join(__dirname, '..', '..', 'scripts', 'visual', 'compare.py'),
  'utf-8',
);

function pythonConstant(name: string): number {
  const match = new RegExp(`^${name} = ([0-9.]+)$`, 'm').exec(comparePy);
  if (match?.[1] === undefined) throw new Error(`compare.py has no constant ${name}`);
  return Number(match[1]);
}

describe('viewport profiles', () => {
  it('states the same bezel status band as the comparison harness', () => {
    expect(pythonConstant('STATUS_BAND_HEIGHT')).toBe(STATUS_BAND_HEIGHT);
  });

  it('states the same direct status band as the comparison harness', () => {
    expect(pythonConstant('DIRECT_STATUS_BAND_HEIGHT')).toBe(DIRECT_STATUS_BAND_HEIGHT);
  });

  it('states the same leave status band as the comparison harness', () => {
    expect(pythonConstant('LEAVE_STATUS_BAND_HEIGHT')).toBe(LEAVE_STATUS_BAND_HEIGHT);
  });

  it('keeps all three bands distinct, so no section can inherit another one', () => {
    const bands = [STATUS_BAND_HEIGHT, DIRECT_STATUS_BAND_HEIGHT, LEAVE_STATUS_BAND_HEIGHT];
    expect(new Set(bands).size).toBe(3);
  });

  it('gives every finalized section a profile', () => {
    expect(Object.keys(viewportProfileBySection).sort()).toEqual(
      ['434:3115', '485:4971', '540:416', '575:1741', '592:1068'].sort(),
    );
  });

  it('applies the bezel convention only to the two phone-mockup sections', () => {
    const bezel = Object.entries(viewportProfileBySection)
      .filter(([, profile]) => profile.convention === 'bezel')
      .map(([section]) => section)
      .sort();
    expect(bezel).toEqual(['434:3115', '485:4971']);
  });

  it('draws a home indicator only in the bezel sections', () => {
    expect(viewportProfile('434:3115').homeIndicatorHeight).toBe(HOME_INDICATOR_HEIGHT);
    expect(viewportProfile('485:4971').homeIndicatorHeight).toBe(HOME_INDICATOR_HEIGHT);
    for (const section of ['540:416', '592:1068', '575:1741']) {
      expect(viewportProfile(section).homeIndicatorHeight).toBe(0);
    }
  });

  it('gives the direct sections the direct band and the bezel sections the bezel band', () => {
    expect(viewportProfile('434:3115').statusBandHeight).toBe(STATUS_BAND_HEIGHT);
    expect(viewportProfile('485:4971').statusBandHeight).toBe(STATUS_BAND_HEIGHT);
    for (const section of ['592:1068', '575:1741']) {
      expect(viewportProfile(section).statusBandHeight).toBe(DIRECT_STATUS_BAND_HEIGHT);
    }
    expect(viewportProfile('540:416').statusBandHeight).toBe(LEAVE_STATUS_BAND_HEIGHT);
  });

  it('lists the leave sheets as bottom-anchored, and nothing else', () => {
    // The three sheets are 96 design units taller than the emulator can show. Aligning them by
    // their first row would displace every element in them; the harness aligns them by the last.
    const match = /BOTTOM_ANCHORED_NODES = frozenset\(\{([^}]*)\}\)/.exec(comparePy);
    const nodes = (match?.[1] ?? '')
      .split(',')
      .map((entry) => entry.trim().replace(/"/g, ''))
      .filter((entry) => entry.length > 0)
      .sort();
    expect(nodes).toEqual(['592:563', '592:639', '592:888']);
  });

  it('rejects an unknown section rather than guessing a convention', () => {
    expect(() => viewportProfile('0:0')).toThrow(/No viewport profile/);
  });

  it('maps each section name in the harness to the profile its node id carries', () => {
    // `compare.py` keys by section NAME and `viewport.ts` by node id; this pins the pairing so a
    // renamed section cannot quietly fall back to a default.
    const byName: Record<string, string> = {
      'Login flow': '434:3115',
      'Service flow': '485:4971',
      leave: '540:416',
      'log in flow': '592:1068',
      performance: '575:1741',
    };
    for (const [name, nodeId] of Object.entries(byName)) {
      expect(comparePy).toContain(`"${name}"`);
      expect(viewportProfileBySection[nodeId]).toBeDefined();
    }
  });
});
