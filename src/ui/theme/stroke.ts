import { PixelRatio, type ViewStyle } from 'react-native';

import type { DesignScale } from './designScale';

/**
 * Reproducing a Figma stroke in React Native.
 *
 * ## Why this is not just `borderWidth`
 *
 * A Figma stroke is **centre-aligned**: it straddles the frame's edge, half inside and half out,
 * and it does **not** change the frame's size. A 68-unit row with a 2-unit stroke lays out as 68
 * units in its parent and paints 70 units of ink.
 *
 * Yoga's `borderWidth` behaves like padding: it is part of the box, so the same row lays out as
 * **72** units — two too tall, and two too wide. On a screen that stacks bordered rows inside
 * bordered cards that error compounds. It is what put the `leave` frames nine design units out of
 * place by the bottom of the screen, in a render whose every element was individually the right
 * size.
 *
 * ## The correction
 *
 * Take half the stroke out of the padding so the painted box is the right size, and half out of the
 * margin so the laid-out box is the right size:
 *
 *     padding = P - W/2        margin = -W/2
 *
 * which gives a border box of `2W + 2(P - W/2) + C = 2P + C + W` — the ink — sitting in a flow box
 * of `2P + C` — the frame. Both match Figma, and the stroke overflows its parent exactly as it does
 * in the design.
 */
/**
 * Which side of its frame edge a stroke sits on.
 *
 * Figma has three (`strokeAlign: CENTER | INSIDE | OUTSIDE`) and the choice is per node, so a file
 * mixes them. It changes the arithmetic completely and the two cases here are not interchangeable:
 *
 *   - `center` — the stroke straddles the edge and does NOT grow the frame. Yoga's `borderWidth`
 *     does grow it, so the correction below takes the width back out of the padding and the
 *     margin. This is what the `leave` cards do, and getting it wrong put their rows nine design
 *     units out of place by the bottom of the screen.
 *   - `inside` — the stroke is painted within the frame, which is exactly Yoga's own model: the
 *     border is part of the box and the padding is measured from inside it. No correction at all.
 *   - `outside` — the stroke is painted entirely beyond the frame edge, so it adds `2W` to the ink
 *     and nothing to the flow. Same painted box as `inside`, but the whole stroke comes back off
 *     the layout instead of none of it.
 *
 * Which one a node uses is settled by measuring the reference render, never assumed. On
 * `575:1903` the design's `gap-16` produces **16** clear pixels between two painted row borders
 * and a painted row **49** tall over 47 of content — both of which are the `inside` model. Applying
 * the centre correction there pulled each row half a unit into the gap on each side and walked the
 * seventh row fourteen pixels up the screen.
 *
 * The three 2-unit strokes in `leave` and `job flow` measure `outside`, on their own renders and in
 * both axes. `583:427`'s break cell paints **112 x 44** over a 108.67 x 40 grid frame; `592:488`'s
 * day rows paint **72** tall on a 68-unit frame and leave **8** clear units of a 12-unit gap; the
 * `Dates chunein` row paints **51** on 47. Every one of those is `frame + 2W`. Drawn centre they
 * came out 110 x 41, 70 with an 11-unit gap, and 49 — `frame + W`, two units of ink short on every
 * bordered row of both sections.
 *
 * `center` and `outside` lay out identically (`2P + C`); they differ only in how much ink spills
 * past the frame, which is why swapping between them cannot move anything downstream.
 */
export type FigmaStrokeAlign = 'center' | 'inside' | 'outside';

export interface FigmaStrokeOptions {
  /** Stroke width in design units. */
  readonly width: number;
  /** The frame's padding in design units, before the correction. */
  readonly padding?: number | undefined;
  readonly paddingH?: number | undefined;
  readonly paddingV?: number | undefined;
  /** Defaults to `center`, the alignment the `leave` and `log in flow` sections verified. */
  readonly align?: FigmaStrokeAlign | undefined;
}

export function figmaStroke(
  scale: DesignScale,
  { width, padding, paddingH, paddingV, align = 'center' }: FigmaStrokeOptions,
): ViewStyle {
  const { s, factor } = scale;
  const half = width / 2;
  // The border width is snapped to a whole device pixel rather than to `s()`'s 1/3 dp. A hairline
  // is the one dimension where that rounding is visible: `s(1)` lands on 1.0dp, which Android
  // draws as two device pixels -- 0.69 design units against the 1 the design asks for.
  // `roundToNearestPixel` on the exact scaled width draws three, i.e. 1.09. Both land within a
  // third of a unit of the target and the measured difference is inside the comparison's noise;
  // this is the arithmetically closer of the two, not a fix for a visible defect.
  const style: ViewStyle = { borderWidth: PixelRatio.roundToNearestPixel(width * factor) };
  // How much of the stroke comes back off the flow: half of it when it straddles the edge, all of
  // it when it sits beyond the edge, none when it is painted inside.
  if (align === 'center') style.margin = -s(half);
  else if (align === 'outside') style.margin = -s(width);
  const inset = align === 'center' ? half : 0;
  if (padding !== undefined) style.padding = s(padding - inset);
  if (paddingH !== undefined) style.paddingHorizontal = s(paddingH - inset);
  if (paddingV !== undefined) style.paddingVertical = s(paddingV - inset);
  return style;
}
