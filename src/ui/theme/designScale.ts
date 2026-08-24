import { PixelRatio, Platform, useWindowDimensions } from 'react-native';

import { layout } from './tokens';

/**
 * Maps the Figma V12 design viewport onto the physical screen.
 *
 * ## Why a scale factor exists at all
 *
 * Every V12 frame is 390x830 and draws a phone mockup inside itself: a black bezel with a 10pt
 * gutter, so the actual application viewport is the inner **370x810** area. All content
 * coordinates in the design are therefore expressed against a 370-wide column.
 *
 * The verified target device (vivo iQOO I2403) is 393dp wide. Using the raw design numbers on a
 * 393dp screen would leave the 325-wide CTA with a 34dp margin instead of the design's 20dp — a
 * 14dp displacement on every horizontal edge, which is exactly the kind of mismatch the pixel
 * audit is meant to eliminate. Scaling by `screenWidth / 370` reproduces the design's proportions
 * at any width, and on the target device it also lands the 810-tall design column within ~10dp of
 * the available height, so the vertical composition needs no separate correction.
 *
 * Values are rounded to the nearest 1/3 dp. React Native lays out in dp and rasterises at the
 * device pixel ratio (2.75 here), so sub-dp precision would only produce irrational widths that
 * round inconsistently between siblings.
 *
 * Passing the raw unrounded product instead — letting Yoga round only the final absolute positions,
 * which in principle should stop the per-element error accumulating — was measured and is worse on
 * every section: `575:1744` 7.90% -> 10.23%, `575:2013` 14.55% -> 18.16%, `575:1884` 15.61% ->
 * 18.84%, `575:2135` 5.03% -> 5.27%. Only `592:488` improved, by 0.16. The 1/3-dp grid is kept
 * because it is what the reference agrees with, not because it is theoretically tidier.
 */
export interface DesignScale {
  /** `screenWidth / 370`. */
  readonly factor: number;
  /** Scales a design-space length to device dp. */
  readonly s: (designValue: number) => number;
  /**
   * Scales a design-space **font** size to device dp, snapped so it rasterises on a whole device
   * pixel. Use this for every `fontSize`; use `s` for every other length.
   */
  readonly font: (designValue: number) => number;
  /** Full screen width in dp. */
  readonly width: number;
  /** Full screen height in dp. */
  readonly height: number;
}

const PRECISION = 3;

/**
 * Why font sizes do not go through `s`.
 *
 * React Native on Android does not rasterise type at the size it is given. `TextAttributes`
 * resolves `effectiveFontSize` as
 *
 *     Math.ceil(PixelUtil.toPixelFromSP(fontSize))   // -> Int
 *
 * so the size is **ceilinged to a whole device pixel**, while `effectiveLineHeight` and
 * `effectiveLetterSpacing` keep their sub-pixel precision. A fractional dp therefore always
 * rounds *up*, and never down, however close it sits to the pixel below it.
 *
 * That interacts badly with `s`, which snaps to 1/3 dp. A 14-unit design size scales to 14.86dp,
 * which `s` rounds up to 15.0dp = 41.25 device px, which Android then ceilings to **42** — against
 * the 40.87 the design asks for, a 2.8% overshoot. It is invisible on a single glyph and obvious
 * over a sentence: measured against the reference render, `592:488`'s two SemiBold-14 runs came
 * out 3.1% long, enough that every glyph past the first few lands on the wrong pixel and scores as
 * a hard miss rather than as antialiasing.
 *
 * So the size is resolved in device pixels — round to the nearest whole pixel, which is the
 * closest the hardware can actually draw — and then expressed as the dp value that lands there:
 * half a pixel below on Android, where the ceiling will take it back up, and exactly on it
 * everywhere else, where the value is used as given.
 */
export function snapFontSize(
  designValue: number,
  factor: number,
  pixelRatio: number,
  platform: string = Platform.OS,
): number {
  const px = Math.max(1, Math.round(designValue * factor * pixelRatio));
  // Half a pixel below the target on Android, so the ceiling above lands exactly on it and cannot
  // be tipped onto the next pixel by the float error in `dp * pixelRatio`. Everywhere else the
  // value is rasterised as given, so it is stated exactly.
  return (platform === 'android' ? px - 0.5 : px) / pixelRatio;
}

/**
 * The device pixel React Native's Android text stack will actually rasterise `dp` at, transcribed
 * from `TextAttributes.effectiveFontSize`. Exported so the rule `snapFontSize` is written against
 * is stated once and can be asserted, rather than restated by hand in a test.
 */
export function androidRasterisedFontPx(dp: number, pixelRatio: number): number {
  return Math.ceil(dp * pixelRatio);
}

export function makeDesignScale(
  width: number,
  height: number,
  pixelRatio: number = PixelRatio.get(),
): DesignScale {
  const factor = width / layout.contentWidth;
  return {
    factor,
    width,
    height,
    s: (designValue: number) => Math.round(designValue * factor * PRECISION) / PRECISION,
    font: (designValue: number) => snapFontSize(designValue, factor, pixelRatio),
  };
}

/**
 * Hook form. Re-renders on rotation and on foldable resize, so a screen never keeps a stale
 * factor after the window changes.
 */
export function useDesignScale(): DesignScale {
  const { width, height } = useWindowDimensions();
  return makeDesignScale(width, height);
}
