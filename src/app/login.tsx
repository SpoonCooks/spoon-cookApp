import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage } from '@core/api/errors';
import { normalisePhone } from '@core/domain/auth';
import { sendLoginOtp } from '@core/session/auth';
import { useSession } from '@core/session/store';
import { Button, color, radius, spacing, Text } from '@ui';

/**
 * Page 1 — phone login (Figma `434:3280`).
 *
 * Copy is founder-approved Hinglish and reproduced verbatim.
 *
 * Validation matches the backend contract (10 digits, leading 6-9). `Next` stays disabled until
 * the number is valid, so an invalid request is never sent.
 *
 * `POST /v1/auth/otp/send` is sent with `audience: 'cook'`. Navigation happens only after the
 * backend accepts the request — never optimistically — so a cook never lands on an OTP screen for
 * a code that was never dispatched.
 */
export default function LoginScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const beginOtp = useSession((s) => s.beginOtp);
  const [raw, setRaw] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalised = normalisePhone(raw);
  const isValid = normalised !== null;

  const submit = (): void => {
    if (normalised === null || sending) return;
    setSending(true);
    setError(null);
    void sendLoginOtp(normalised)
      .then(() => {
        beginOtp(normalised);
        router.push({ pathname: '/otp', params: { phone: normalised } });
      })
      .catch((cause: unknown) => {
        setError(apiErrorMessage(cause));
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          <Text variant="displayLg">Partner</Text>
          <Text variant="bodyMuted">Spoon se jude aur zindagi behtar banaye</Text>
        </View>

        <View style={styles.formBlock}>
          <Text variant="headingLg">Login</Text>
          <Text variant="captionMuted">Phone no. daale</Text>

          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text variant="title">+91</Text>
            </View>
            <TextInput
              testID="login-phone-input"
              value={raw}
              onChangeText={setRaw}
              placeholder="9876543210"
              placeholderTextColor={color.textMuted}
              keyboardType="phone-pad"
              inputMode="numeric"
              maxLength={13}
              autoComplete="tel"
              textContentType="telephoneNumber"
              style={styles.phoneInput}
              accessibilityLabel="Phone number"
              onSubmitEditing={submit}
              returnKeyType="next"
            />
          </View>

          <Button
            label="Next"
            tone="action"
            disabled={!isValid}
            loading={sending}
            onPress={submit}
            testID="login-next"
          />

          {error !== null && (
            <Text variant="caption" color={color.danger} testID="login-error">
              {error}
            </Text>
          )}
        </View>

        <View style={styles.legal}>
          <Text variant="microRegular" align="center">
            By continuing, I accept the
          </Text>
          <Text variant="micro" align="center" color={color.textPrimary}>
            Terms of use &amp; Privacy policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xxxl },
  brandBlock: { gap: spacing.xs, marginTop: spacing.huge },
  formBlock: { gap: spacing.m },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  prefix: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    backgroundColor: color.surfaceMuted,
  },
  phoneInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.m,
    borderRadius: radius.m,
    borderWidth: 2,
    borderColor: color.grey300,
    backgroundColor: color.surface,
    fontFamily: 'Livvic-Bold',
    fontSize: 16,
    color: color.textPrimary,
  },
  legal: { marginTop: 'auto', gap: spacing.xxs },
});
