import { useMemo } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

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
 */
export function Text({
  variant = 'body',
  color,
  align,
  style,
  ...rest
}: TextProps): React.ReactElement {
  const { s } = useDesignScale();

  const scaled = useMemo(() => {
    const base = textStyle[variant];
    return {
      ...base,
      fontSize: s(base.fontSize),
      lineHeight: s(base.lineHeight),
      ...('letterSpacing' in base && typeof base.letterSpacing === 'number'
        ? { letterSpacing: s(base.letterSpacing) }
        : {}),
    };
  }, [variant, s]);

  return (
    <RNText
      {...rest}
      style={[
        scaled,
        color !== undefined && { color },
        align !== undefined && { textAlign: align },
        style,
      ]}
    />
  );
}
