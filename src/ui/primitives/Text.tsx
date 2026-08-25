import { useMemo } from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useDesignScale } from '../theme/designScale';
import { textStyle, type TextStyleToken } from '../theme/typography';

export interface TextProps extends RNTextProps {
  /** Named style from the Figma-derived type scale. */
  readonly variant?: TextStyleToken | undefined;
  readonly color?: string | undefined;
  readonly align?: TextStyle['textAlign'] | undefined;
}

/**
 * The app's only text component.
 *
 * Routing all copy through here guarantees Livvic is applied with a real bundled weight rather
 * than a synthesised one, and keeps the Hinglish strings on the Figma type scale.
 *
 * ## The variant metrics are design units, and are scaled here
 *
 * `textStyle` states sizes exactly as the Figma does — `18/28`, `12/16`, `9/13.5` — which are
 * **design-space** numbers against the 370-unit content column, not device dp. Every other
 * dimension in the app is passed through `screenWidth / 370` before it reaches a style; type was
 * not, so on the 392.7dp reference device every variant rendered about 6% small. That is invisible
 * on its own but it narrows each string, which walks the elements that follow it out of place — on
 * `434:3116` it left the edit glyph twelve units left of its design position.
 *
 * The scale is therefore applied to the variant's metrics here, in one place. Values supplied
 * through `style` are deliberately **not** touched: a caller passing an explicit `fontSize` is
 * working in device dp and has already scaled it (see the `otpFooterStyle` helpers), so scaling it
 * again would compound the factor.
 *
 * `fontSize` goes through `font` rather than `s` because Android ceilings type to a whole device
 * pixel and would otherwise draw a 14-unit style 2.8% large — see `snapFontSize` in
 * `designScale.ts`. `lineHeight` and `letterSpacing` keep their sub-pixel precision, which is what
 * React Native does with them.
 *
 * ## `textTransform: 'uppercase'` is applied in JS, not handed to the platform
 *
 * On Fabric Android the two halves of that style disagree: the text is MEASURED from the string as
 * written and RENDERED after transforming it. Uppercase is the wider of the two, so a string that
 * measured as fitting is drawn too wide for the box it was given, and the overflow is dropped at a
 * word boundary — silently, with no ellipsis and no wrap.
 *
 * It cost the last word of two screens before a pixel diff caught it. `575:2137` drew
 * `AAJ AAP KAAM PAI AAYE` where the design says `AAJ AAP KAAM PAI AAYE HAI.`, and `575:2138` lost
 * the same `HAI.`, while every short overline in the app was unaffected — the transformed width
 * only overflows once the string is long enough. Nothing about the source said so: the copy is
 * right, and `attendanceScreens.test.tsx` asserts the full string because the tree does contain it.
 *
 * Uppercasing here means the string that is measured is the string that is drawn. The style is
 * then removed so the platform cannot transform it a second time. `capitalize` is left to the
 * platform: its word splitting is locale-dependent and no variant in this app uses it.
 */
export function Text({
  variant = 'body',
  color,
  align,
  style,
  ...rest
}: TextProps): React.ReactElement {
  const { s, font } = useDesignScale();

  const scaled = useMemo(() => {
    const base = textStyle[variant];
    return {
      ...base,
      // Android reserves extra room above and below a line for the font's own ascent/descent
      // metrics unless this is off, which makes a text box taller than the `lineHeight` it was
      // given. Figma boxes a text node at exactly its line height, so with the padding on, every
      // label on a screen is a few units tall than the design and the error accumulates down the
      // column -- on `575:1744` it put `AAJ KI GALATIYAAN` sixteen rows below its design row while
      // each individual card was the right size. No effect on iOS, which never adds it.
      includeFontPadding: false,
      fontSize: font(base.fontSize),
      lineHeight: s(base.lineHeight),
      ...('letterSpacing' in base && typeof base.letterSpacing === 'number'
        ? { letterSpacing: s(base.letterSpacing) }
        : {}),
    };
  }, [variant, s, font]);

  const composed = StyleSheet.flatten([
    scaled,
    color !== undefined && { color },
    align !== undefined && { textAlign: align },
    style,
  ]) as TextStyle;

  // Only a plain string can be transformed safely. Children that are elements keep the platform
  // behaviour rather than being reached into and rewritten.
  const { children, ...props } = rest;
  const transform = composed.textTransform;
  if (typeof children === 'string' && (transform === 'uppercase' || transform === 'lowercase')) {
    const cased = transform === 'uppercase' ? children.toUpperCase() : children.toLowerCase();
    const { textTransform: _dropped, ...untransformed } = composed;
    return (
      <RNText {...props} style={untransformed}>
        {cased}
      </RNText>
    );
  }

  return (
    <RNText {...props} style={composed}>
      {children}
    </RNText>
  );
}
