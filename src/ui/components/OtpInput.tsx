import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { color, radius, spacing } from '../theme/tokens';
import { useDesignScale } from '../theme/designScale';
import { Text } from '../primitives/Text';

/**
 * Which V12 treatment to draw.
 *
 * `tiles` is the Login flow's own: `434:3255` draws six flat 35x35 `#ffef99` squares with a 10dp
 * gap and a 5dp radius, and no stroke at all. `bordered` is the entry field used elsewhere.
 *
 * These are separate variants rather than one "generic" box because V12 genuinely draws them
 * differently — flattening them into a single component would make one of the two screens wrong.
 */
export type OtpInputVariant = 'bordered' | 'tiles';

export interface OtpInputProps {
  /** Number of digit boxes. Comes from `otpLength[kind]` — never hardcoded by a screen. */
  readonly length: number;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onComplete?: (code: string) => void;
  readonly hasError?: boolean;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
  readonly testID?: string;
  readonly variant?: OtpInputVariant | undefined;
}

/**
 * Fixed-length numeric OTP entry.
 *
 * ## Why one hidden input rather than N inputs
 *
 * Per-box `TextInput`s are the obvious approach and they break in predictable ways: backspace on
 * an empty box doesn't reach the previous one, SMS autofill delivers the whole code to a
 * single-character field and gets truncated, and paste fills only box one. A single hidden input
 * holding the whole string sidesteps all three — autofill and paste land intact, and deletion is
 * ordinary string editing. The visible boxes are pure presentation driven by `value`.
 *
 * The component is length-agnostic so the same code renders the 6-digit login OTP and the
 * Start/End service OTP, whose length is a contract value that may change.
 */
export function OtpInput({
  length,
  value,
  onChange,
  onComplete,
  hasError = false,
  disabled = false,
  autoFocus = false,
  testID,
  variant = 'bordered',
}: OtpInputProps): React.ReactElement {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const { s } = useDesignScale();

  const handleChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, '').slice(0, length);
      onChange(digits);
      if (digits.length === length) onComplete?.(digits);
    },
    [length, onChange, onComplete],
  );

  const boxes = useMemo(() => Array.from({ length }, (_, i) => i), [length]);
  const focus = useCallback(() => inputRef.current?.focus(), []);

  const isTiles = variant === 'tiles';
  // V12 `434:3256`: 35x35 at a 10dp gap, radius 5, flat fill, no stroke.
  const tileStyle = isTiles
    ? { width: s(TILE.size), height: s(TILE.size), borderRadius: s(TILE.radius) }
    : null;

  return (
    <Pressable
      onPress={disabled ? undefined : focus}
      accessibilityRole="none"
      testID={testID}
      style={styles.wrapper}
    >
      <View style={[styles.row, isTiles && { gap: s(TILE.gap) }]} pointerEvents="none">
        {boxes.map((index) => {
          const char = value[index] ?? '';
          const isCursor = focused && index === Math.min(value.length, length - 1);
          return (
            <View
              key={index}
              testID={`${testID ?? 'otp'}-box-${index}`}
              style={[
                isTiles ? styles.tile : styles.box,
                tileStyle,
                !isTiles && char !== '' && styles.boxFilled,
                !isTiles && isCursor && styles.boxFocused,
                isTiles && isCursor && styles.tileFocused,
                hasError && (isTiles ? styles.tileError : styles.boxError),
                disabled && styles.boxDisabled,
              ]}
            >
              <Text variant={isTiles ? 'headingLgBold' : 'headingLg'}>{char}</Text>
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        testID={`${testID ?? 'otp'}-field`}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        // Lets Android/iOS deliver the SMS code straight into the field.
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        // Visually hidden but focusable and still reachable by autofill; `opacity: 0` alone would
        // leave a tappable ghost overlapping the boxes.
        style={styles.hiddenInput}
        accessibilityLabel={`OTP, ${length} digits`}
      />
    </Pressable>
  );
}

/** V12 `434:3256` tile metrics, in design space. */
const TILE = { size: 35, gap: 10, radius: 5 } as const;

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.m },
  box: {
    width: 44,
    height: 52,
    borderRadius: radius.m,
    borderWidth: 2,
    borderColor: color.grey300,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    backgroundColor: color.yellow300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // V12 draws no focus or filled state for the tiles; these stay subtle so the resting frame
  // still matches the design exactly while entry remains legible.
  tileFocused: { backgroundColor: color.yellow400 },
  tileError: { backgroundColor: color.yellow200, borderWidth: 1, borderColor: color.danger },
  boxFilled: { borderColor: color.black },
  boxFocused: { borderColor: color.yellow600 },
  boxError: { borderColor: color.danger },
  boxDisabled: { opacity: 0.5 },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    color: 'transparent',
  },
});
