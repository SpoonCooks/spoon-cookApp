import { figmaStroke, makeDesignScale } from '@ui';

/**
 * The three Figma stroke alignments, pinned against numbers measured off the V14 reference
 * renders rather than quoted from the design.
 *
 * A stroke alignment is invisible to the component tree — every one of these renders perfectly
 * well while painting two units of ink too few — so nothing but an arithmetic assertion catches a
 * regression here without an emulator run.
 *
 * The verified reference device: 1080px at 440dpi, 392.727dp against the design's 370-unit column.
 */
const REF_WIDTH = 1080 / 2.75;
const REF_HEIGHT = 2392 / 2.75;
const scale = makeDesignScale(REF_WIDTH, REF_HEIGHT);
const { s } = scale;

/**
 * What a `figmaStroke`d box paints and what it occupies, in design units.
 *
 * Every assertion below is to the nearest half unit, not closer: `s` snaps to a third of a dp and
 * the border to a whole device pixel, so a 44-unit box lands on 43.65 and a 72 on 71.60. What is
 * being pinned is which multiple of the stroke width the ink carries over the frame — 2W, W or
 * none — and that survives the rounding grid intact.
 */
function boxes(
  style: ReturnType<typeof figmaStroke>,
  contentUnits: number,
): { readonly ink: number; readonly flow: number } {
  const border = (style.borderWidth ?? 0) as number;
  const padding = (style.padding ?? style.paddingVertical ?? 0) as number;
  const margin = (style.margin ?? 0) as number;
  const inkDp = 2 * border + 2 * padding + s(contentUnits);
  return { ink: inkDp / scale.factor, flow: (inkDp + 2 * margin) / scale.factor };
}

describe('figmaStroke alignment arithmetic', () => {
  /**
   * `583:427`'s break cell: a 2-unit stroke on a 6-unit padding over a 28-unit line, in a grid
   * frame 108.67 wide. The reference paints **112 x 44** — `frame + 2W` on both axes — and the
   * app drew 110 x 41 until these cells were told the stroke sits outside the edge.
   */
  it('paints frame + 2W and lays out frame, for an outside stroke', () => {
    const { ink, flow } = boxes(figmaStroke(scale, { width: 2, padding: 6, align: 'outside' }), 28);
    expect(ink).toBeCloseTo(44, 0);
    expect(flow).toBeCloseTo(40, 0);
  });

  /** The same cell drawn centre — `frame + W` — which is what measured 41 units of ink. */
  it('paints frame + W and lays out frame, for a centre stroke', () => {
    const { ink, flow } = boxes(figmaStroke(scale, { width: 2, padding: 6 }), 28);
    expect(ink).toBeCloseTo(42, 0);
    expect(flow).toBeCloseTo(40, 0);
  });

  /** An inside stroke is Yoga's own model: it grows the flow box as well as the ink. */
  it('paints and lays out frame + 2W, for an inside stroke', () => {
    const { ink, flow } = boxes(figmaStroke(scale, { width: 2, padding: 6, align: 'inside' }), 28);
    expect(ink).toBeCloseTo(44, 0);
    expect(flow).toBeCloseTo(44, 0);
  });

  /**
   * Centre and outside must lay out identically. This is what makes the `leave` swap safe: it
   * changes how far the ink spills past each row's edge and moves nothing below it.
   */
  it('lays a centre and an outside stroke out at the same height', () => {
    const centre = boxes(figmaStroke(scale, { width: 2, paddingV: 8 }), 52);
    const outside = boxes(figmaStroke(scale, { width: 2, paddingV: 8, align: 'outside' }), 52);
    expect(outside.flow).toBeCloseTo(centre.flow, 3);
    expect(outside.ink - centre.ink).toBeCloseTo(2, 0);
  });

  /**
   * `592:488`'s day rows: a 2-unit stroke, 8-unit vertical padding, 52 units of content. The
   * reference paints **72** tall and leaves **8** clear units inside the card's 12-unit gap;
   * centre painted 70 and left 10.
   */
  it('reproduces the leave day row: 72 units of ink in an 8-unit gap', () => {
    const { ink, flow } = boxes(
      figmaStroke(scale, { width: 2, paddingV: 8, align: 'outside' }),
      52,
    );
    expect(ink).toBeCloseTo(72, 0);
    expect(flow).toBeCloseTo(68, 0);
    // Two rows 12 units apart in the flow leave `12 - 2W` of visible background between the ink.
    expect(12 - (ink - flow)).toBeCloseTo(8, 0);
  });
});
