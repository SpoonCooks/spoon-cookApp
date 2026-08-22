import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { color, radius, spacing } from '../theme/tokens';
import { Text } from '../primitives/Text';

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
}: OtpInputProps): React.ReactElement {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

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

  return (
    <Pressable
      onPress={disabled ? undefined : focus}
      accessibilityRole="none"
      testID={testID}
      style={styles.wrapper}
    >
      <View style={styles.row} pointerEvents="none">
        {boxes.map((index) => {
          const char = value[index] ?? '';
          const isCursor = focused && index === Math.min(value.length, length - 1);
          return (
            <View
              key={index}
              testID={`${testID ?? 'otp'}-box-${index}`}
              style={[
                styles.box,
                char !== '' && styles.boxFilled,
                isCursor && styles.boxFocused,
                hasError && styles.boxError,
                disabled && styles.boxDisabled,
              ]}
            >
              <Text variant="headingLg">{char}</Text>
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
