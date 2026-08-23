import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type Insets,
  type ViewStyle,
} from 'react-native';

import { color, layout, radius, spacing } from '../theme/tokens';
import { Text } from '../primitives/Text';

export type ButtonTone = 'action' | 'accent' | 'dark' | 'ghost';

export interface ButtonProps {
  readonly label: string;
  readonly onPress?: (() => void) | undefined;
  readonly tone?: ButtonTone | undefined;
  readonly disabled?: boolean | undefined;
  readonly loading?: boolean | undefined;
  readonly fullWidth?: boolean | undefined;
  readonly testID?: string | undefined;
  readonly style?: ViewStyle | undefined;
  /**
   * Extends the touch target beyond the painted bounds.
   *
   * Some V12 CTAs are shorter than the 44dp minimum — Login's is 34 — and the painted geometry is
   * authoritative. `hitSlop` restores an accessible target without displacing a single edge.
   */
  readonly hitSlop?: number | Insets | undefined;
}

const toneStyles: Record<ButtonTone, { background: string; text: string }> = {
  // `#cfff04` — the Figma `Present` and primary CTA fill.
  action: { background: color.lime600, text: color.black },
  accent: { background: color.yellow600, text: color.black },
  dark: { background: color.black, text: color.white },
  ghost: { background: 'transparent', text: color.textPrimary },
};

/**
 * Primary CTA.
 *
 * A disabled button stays visible but non-pressable and is announced as disabled — the Figma
 * shows inactive CTAs rather than hiding them, and a cook needs to see that an action exists
 * before it becomes available.
 *
 * `loading` blocks presses so a slow network cannot produce a duplicate command. This matters for
 * OTP verification and `start-commute`, which must not be sent twice.
 */
export function Button({
  label,
  onPress,
  tone = 'action',
  disabled = false,
  loading = false,
  fullWidth = true,
  testID,
  style,
  hitSlop,
}: ButtonProps): React.ReactElement {
  const isInert = disabled || loading;
  const palette = toneStyles[tone];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      accessibilityLabel={label}
      disabled={isInert}
      onPress={onPress}
      {...(hitSlop !== undefined ? { hitSlop } : {})}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.background },
        fullWidth && styles.fullWidth,
        isInert && styles.inert,
        pressed && !isInert && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text variant="titleBlack" color={palette.text}>
          {label}
        </Text>
      )}
      {/* Keeps height stable between label and spinner states. */}
      <View style={styles.spacer} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  inert: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  spacer: { height: 0 },
});
