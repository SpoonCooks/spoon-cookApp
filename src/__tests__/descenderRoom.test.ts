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
 * Variants transcribed below the bound and NOT yet observed clipping.
 *
 * A tight line only clips when the text actually carries a descender, and most of these never do:
 * `30 mins`, `11:30 AM`, `₹1,175` have no g, j, p, q or y in them. That is why the list is
 * "not yet observed" rather than "verified safe" — nobody has proved these are fine, only that
 * nothing has been reported.
 *
 * The list is the point of the test. It locks today's state so a NEW variant cannot quietly join
 * it, and it is the backlog for anyone widening a line later: each entry is a frame's literal
 * transcription, and the three removed from it on 2026-09-02 were all found on a handset first.
 */
const KNOWN_TIGHT: ReadonlySet<string> = new Set([
  'hero',
  'displayXl',
  'pillLabel',
  'overlineXl',
  'overlineLg',
  'cardTime',
  'ruleCell',
  'policyCell',
  'policyCellSm',
  'addressLine',
  'durationChip',
  'actionChip',
  'travelCountdown',
  'otpAction',
  'timerValue',
  'extensionLabel',
  'extensionValue',
  'dayStripLabel',
  'bodyMuted',
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
