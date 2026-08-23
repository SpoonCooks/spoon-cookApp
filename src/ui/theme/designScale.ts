import { useWindowDimensions } from 'react-native';

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
 */
export interface DesignScale {
  /** `screenWidth / 370`. */
  readonly factor: number;
  /** Scales a design-space length to device dp. */
  readonly s: (designValue: number) => number;
  /** Full screen width in dp. */
  readonly width: number;
  /** Full screen height in dp. */
  readonly height: number;
}

const PRECISION = 3;

export function makeDesignScale(width: number, height: number): DesignScale {
  const factor = width / layout.contentWidth;
  return {
    factor,
    width,
    height,
    s: (designValue: number) => Math.round(designValue * factor * PRECISION) / PRECISION,
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
