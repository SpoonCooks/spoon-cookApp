import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DIRECT_STATUS_BAND_HEIGHT,
  HOME_INDICATOR_HEIGHT,
  LEAVE_STATUS_BAND_HEIGHT,
  SERVICE_STATUS_BAND_HEIGHT,
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

  it('states the same Service status band as the comparison harness', () => {
    expect(pythonConstant('SERVICE_STATUS_BAND_HEIGHT')).toBe(SERVICE_STATUS_BAND_HEIGHT);
  });

  it('makes Service flow a DIRECT section in V14, not a bezel one', () => {
    // V13 authored this section as 390x830 phone-mockup frames drawing the 36.198 `leave` mock.
    // V14 re-authored all thirteen as 371-wide direct frames on the 32-unit `phone bar`. Applying
    // the V13 profile would offset every Service comparison by the bezel origin AND drop four
    // design rows too many from the top, so the change is asserted rather than assumed.
    expect(viewportProfile('485:4971').convention).toBe('direct');
    expect(viewportProfile('485:4971').statusBandHeight).toBe(DIRECT_STATUS_BAND_HEIGHT);
    expect(viewportProfile('485:4971').statusBandHeight).not.toBe(SERVICE_STATUS_BAND_HEIGHT);
    expect(viewportProfile('485:4971').homeIndicatorHeight).toBe(0);
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
      ['434:3115', '485:4971', '540:416', '575:1741', '592:1068', '592:1070', '611:398'].sort(),
    );
  });

  it('applies the bezel convention only to Login flow, the last phone-mockup section', () => {
    const bezel = Object.entries(viewportProfileBySection)
      .filter(([, profile]) => profile.convention === 'bezel')
      .map(([section]) => section)
      .sort();
    expect(bezel).toEqual(['434:3115']);
  });

  it('draws a home indicator only in the bezel section', () => {
    expect(viewportProfile('434:3115').homeIndicatorHeight).toBe(HOME_INDICATOR_HEIGHT);
    for (const section of ['540:416', '592:1068', '575:1741', '592:1070', '611:398', '485:4971']) {
      expect(viewportProfile(section).homeIndicatorHeight).toBe(0);
    }
  });

  it('gives the direct sections the direct band and the bezel sections the bezel band', () => {
    expect(viewportProfile('434:3115').statusBandHeight).toBe(STATUS_BAND_HEIGHT);
    for (const section of ['592:1068', '575:1741']) {
      expect(viewportProfile(section).statusBandHeight).toBe(DIRECT_STATUS_BAND_HEIGHT);
    }
    expect(viewportProfile('540:416').statusBandHeight).toBe(LEAVE_STATUS_BAND_HEIGHT);
  });

  it('lists every bottom sheet as bottom-anchored, and nothing else', () => {
    // A sheet is 96 design units taller than the emulator can show, and the rows that cannot be
    // shown are at the TOP, where they are scrim. Aligning one by its first row would displace
    // every element in it, so the harness aligns them by their last.
    //
    // The five `Info` rule sheets belong here for exactly the reason the three `leave` sheets do:
    // in the committed canvas dump each is a 36.198 status mock at y=0, one content child over a
    // scrim, and no nav of any kind. They were missing, and all five were reported displaced.
    const match = /BOTTOM_ANCHORED_NODES = frozenset\(\s*\{([\s\S]*?)\}\s*\)/.exec(comparePy);
    const nodes = (match?.[1] ?? '')
      // `\r?\n`, not `\n`: the file is checked out CRLF, and a stray `\r` is a line terminator
      // that `.` will not match — so `#.*$` would silently strip no comment at all.
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*$/, '').trim())
      .join('')
      .split(',')
      .map((entry) => entry.trim().replace(/"/g, ''))
      .filter((entry) => /^\d+:\d+$/.test(entry))
      .sort();
    expect(nodes).toEqual(
      [
        '592:563',
        '592:639',
        '592:888',
        '597:1221',
        '603:1865',
        '603:1924',
        '605:2027',
        '605:2094',
      ].sort(),
    );
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
