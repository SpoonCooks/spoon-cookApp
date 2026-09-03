import { textStyle } from '@ui/theme/typography';

/**
 * Every text variant must have room for its own descenders.
 *
 * `Text` keeps Android's font padding enabled so Livvic ascenders and descenders remain inside
 * the line box. This test guards the typography table: a newly introduced tight variant should
 * be reviewed explicitly instead of relying on platform clipping behaviour.
 *
 * `textAlignVertical: 'center'` splits the overflow across both edges, but it cannot rescue a box
 * that was too short to begin with. It has been hand-fixed four times:
 *
 *   `0 ghanta`                              — unitLabel, 2026-09-01
 *   `AAJ KA BREAK`                          — a width problem, same family of symptom
 *   `Aap LATE hai!`                         — travelPill, 20 on a 16 line
 *   `Agle booking mein bhi accha kaam kare!` — completedHeadline, 30 on 36
 *   `Rating`                                — screenTitle, 24 on 30
 *
 * Each was found by someone looking at a phone. This finds the next one first.
 */

/**
 * Livvic needs about 1.25x its size to clear a descender with the font padding off. 1.2 is the
 * bound asserted here rather than 1.25: it is the level below which clipping was actually
 * OBSERVED, and holding the scale to a stricter ratio than the evidence supports would mean
 * rewriting line heights the design got right.
 */
const MIN_RATIO = 1.2;

/**
 * What is still below the bound.
 *
 * This was nineteen entries, held on the argument that a tight line only clips when the text
 * carries a descender and that most of these never would. The argument did not survive being
 * checked against what each variant actually renders: `bodyMuted` draws "Aaj ka kaam khatam ho
 * gaya, aaram kare!" and `overlineLg` draws "aaj ka break" — a g, a y and a j, all below the
 * bound. Worse, seven variants set a line SHORTER than their own font size, `extensionLabel`
 * worst at 24px on a 16px line, and a box that small crops a glyph whether or not it descends.
 *
 * Fifteen were widened on 2026-09-03, each checked against its container first so nothing is
 * merely clipped one level up instead: the policy row is 35pt around a 25pt line, the countdown
 * box 103pt around 40, the shift pill 32 around 25.
 */
const KNOWN_TIGHT: ReadonlySet<string> = new Set([
  // Both are UNUSED: no component names either one. They are left tight rather than "fixed"
  // blind, because changing a variant nothing renders proves nothing and the numbers are the
  // frames' own. Whoever first renders one of these has to give it room at that point.
  'hero',
  'displayXl',
]);

function tightVariants(): readonly string[] {
  return Object.entries(textStyle)
    .map(([name, style]) => {
      const size = (style as { fontSize?: number }).fontSize;
      const line = (style as { lineHeight?: number }).lineHeight;
      if (typeof size !== 'number' || typeof line !== 'number') return null;
      return line / size < MIN_RATIO
        ? `${name}: ${size}px on a ${line}px line (${(line / size).toFixed(2)}x)`
        : null;
    })
    .filter((entry): entry is string => entry !== null);
}

describe('no NEW text variant sets a line shorter than its glyphs need', () => {
  it('adds nothing to the known-tight list', () => {
    const unexpected = tightVariants().filter(
      (entry) => !KNOWN_TIGHT.has(entry.slice(0, entry.indexOf(':'))),
    );

    expect(unexpected).toEqual([]);
  });

  it('keeps the three that were clipping on a handset above the bound', () => {
    // travelPill 20/16, completedHeadline 30/36, screenTitle 24/30 — all reported 2026-09-02.
    const names = tightVariants().map((entry) => entry.slice(0, entry.indexOf(':')));
    expect(names).not.toContain('travelPill');
    expect(names).not.toContain('completedHeadline');
    expect(names).not.toContain('screenTitle');
  });
});
