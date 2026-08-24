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
export interface FigmaStrokeOptions {
  /** Stroke width in design units. */
  readonly width: number;
  /** The frame's padding in design units, before the correction. */
  readonly padding?: number | undefined;
  readonly paddingH?: number | undefined;
  readonly paddingV?: number | undefined;
}

export function figmaStroke(
  scale: DesignScale,
  { width, padding, paddingH, paddingV }: FigmaStrokeOptions,
): ViewStyle {
  const { s, factor } = scale;
  const half = width / 2;
  // The border width is snapped to a whole device pixel rather than to `s()`'s 1/3 dp. A hairline
  // is the one dimension where that rounding is visible: `s(1)` lands on 1.0dp, which Android
  // draws as two device pixels -- 0.69 design units against the 1 the design asks for.
  // `roundToNearestPixel` on the exact scaled width draws three, i.e. 1.09. Both land within a
  // third of a unit of the target and the measured difference is inside the comparison's noise;
  // this is the arithmetically closer of the two, not a fix for a visible defect.
  const style: ViewStyle = {
    borderWidth: PixelRatio.roundToNearestPixel(width * factor),
    margin: -s(half),
  };
  if (padding !== undefined) style.padding = s(padding - half);
  if (paddingH !== undefined) style.paddingHorizontal = s(paddingH - half);
  if (paddingV !== undefined) style.paddingVertical = s(paddingV - half);
  return style;
}
