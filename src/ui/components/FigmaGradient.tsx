import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A CSS-angle linear gradient, drawn as vector rather than shipped as a raster.
 *
 * ## Why vector
 *
 * V12 exported gradients as PNGs because `react-native-svg` could not be bundled: it imports
 * `buffer`, which was not installed, so `expo export` failed to resolve the module. Adding the
 * `buffer` polyfill fixes that at the root, and drawing the gradient instead of stretching a
 * raster removes the banding a stretched PNG shows on a 1080px-wide screen and keeps the exact
 * Figma stop values in the source where they can be read and checked.
 *
 * ## Angle conversion
 *
 * Figma emits CSS gradient syntax: `linear-gradient(A, ...)` where `A` is measured clockwise from
 * "up", so the gradient direction in screen coordinates (x right, y down) is `(sin A, -cos A)`.
 * CSS sizes the gradient line so it exactly spans the box:
 *
 *     L = |W sin A| + |H cos A|
 *     start = centre - (L / 2) * dir        end = centre + (L / 2) * dir
 *
 * Those endpoints are expressed here in object-bounding-box units so the gradient follows a box
 * whose height is decided at layout time. For the steep angles V13 uses on a tall phone column the
 * normalised endpoints sit within half a percent of the box corners across every plausible height,
 * so the box-relative form loses nothing and avoids a measure-then-paint round trip.
 */
export interface FigmaGradientProps {
  /** CSS angle in degrees, exactly as Figma emits it. */
  readonly angle: number;
  /** Ordered stops. `offset` is a fraction of the gradient line, `opacity` the stop's alpha. */
  readonly stops: readonly {
    readonly offset: number;
    readonly color: string;
    readonly opacity?: number;
  }[];
  /**
   * Colour painted under the gradient. Figma's translucent stops composite against the frame's
   * own fill, so reproducing that fill here keeps the resulting pixels identical.
   */
  readonly backdrop?: string | undefined;
  /** Nominal design box, used only to normalise the gradient line. */
  readonly designWidth: number;
  readonly designHeight: number;
  readonly style?: StyleProp<ViewStyle> | undefined;
  readonly children?: ReactNode;
  readonly testID?: string | undefined;
}

/** CSS gradient endpoints for `angle` over a `w` x `h` box, in object-bounding-box units. */
export function gradientEndpoints(
  angle: number,
  w: number,
  h: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const lineLength = Math.abs(w * dx) + Math.abs(h * dy);
  const halfX = (lineLength / 2) * dx;
  const halfY = (lineLength / 2) * dy;
  return {
    x1: (w / 2 - halfX) / w,
    y1: (h / 2 - halfY) / h,
    x2: (w / 2 + halfX) / w,
    y2: (h / 2 + halfY) / h,
  };
}

export function FigmaGradient({
  angle,
  stops,
  backdrop,
  designWidth,
  designHeight,
  style,
  children,
  testID,
}: FigmaGradientProps): React.ReactElement {
  const { x1, y1, x2, y2 } = gradientEndpoints(angle, designWidth, designHeight);
  return (
    <View style={style} testID={testID}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="figmaGradient" x1={x1} y1={y1} x2={x2} y2={y2}>
            {stops.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity ?? 1}
              />
            ))}
          </LinearGradient>
        </Defs>
        {backdrop !== undefined && <Rect x="0" y="0" width="100%" height="100%" fill={backdrop} />}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#figmaGradient)" />
      </Svg>
      {children}
    </View>
  );
}
