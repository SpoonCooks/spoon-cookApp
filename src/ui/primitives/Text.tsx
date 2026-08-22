import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

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
 * `allowFontScaling` is left at the platform default so the app honours accessibility text size;
 * layouts are built to wrap rather than truncate, because Hinglish lines like
 * `Bonus ke liye: 5 se zyada ghante kaam` are long.
 */
export function Text({
  variant = 'body',
  color,
  align,
  style,
  ...rest
}: TextProps): React.ReactElement {
  return (
    <RNText
      {...rest}
      style={[
        textStyle[variant],
        color !== undefined && { color },
        align !== undefined && { textAlign: align },
        style,
      ]}
    />
  );
}
