import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage, isApiError } from '@core/api/errors';
import { cookAccessDenialCopy } from '@core/domain/auth';
import { loginResendSeconds, otpLength } from '@core/domain/otp';
import { completeLogin, sendLoginOtp } from '@core/session/auth';
import { useSession } from '@core/session/store';
import { Button, color, spacing, Text, OtpInput } from '@ui';

/**
 * Pages 2a / 2b / 2c — login OTP (Figma `434:3224`, `434:3174`, `434:3116`).
 *
 * All three Figma frames are one screen with three states, because they differ only in the resend
 * affordance and the error line:
 *   2a — countdown running (`Resend OTP in 25s`)
 *   2b — countdown finished (`Resend OTP via SMS`)
 *   2c — wrong code (`Galat OTP. Firse koshish kare`) + resend available
 *
 * Length comes from `otpLength.login` (6), which matches both the Figma (six `digits` frames) and
 * the backend `LOGIN_OTP_LENGTH` default.
 *
 * ## A valid OTP is not, by itself, entry
 *
 * Verification goes through `completeLogin`, which persists the session, reads the cook profile
 * and runs it through `gateCookAccess`. Only a `signed_in` result navigates. A denial shows the
 * reason and leaves no session behind, so there is no path where "the code was right" alone opens
 * the app.
 */
export default function OtpScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone?: string }>();

  const signIn = useSession((s) => s.signIn);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(loginResendSeconds);
  // Guards against a double resend while one is already in flight.
  const resendInFlight = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = useCallback(
    (entered: string) => {
      if (entered.length !== otpLength.login) return;
      if (typeof phone !== 'string' || phone.length === 0) return;
      setSubmitting(true);
      setError(null);
      void completeLogin({ localTenDigits: phone, otp: entered })
        .then((state) => {
          if (state.kind === 'signed_in') {
            signIn({
              role: 'cook',
              userStatus: 'active',
              cookProfileStatus: 'active',
              profile: state.profile,
            });
            router.replace('/jobs');
            return;
          }
          if (state.kind === 'denied') {
            setError(cookAccessDenialCopy[state.reason]);
            setCode('');
          }
        })
        .catch((cause: unknown) => {
          // A rejected code is `400 INVALID_REQUEST`; anything else keeps its own message.
          setError(
            isApiError(cause) && cause.status === 400
              ? 'Galat OTP. Firse koshish kare'
              : apiErrorMessage(cause),
          );
          setCode('');
        })
        .finally(() => {
          setSubmitting(false);
        });
    },
    [phone, signIn],
  );

  const resend = useCallback(() => {
    if (secondsLeft > 0 || resendInFlight.current) return;
    if (typeof phone !== 'string' || phone.length === 0) return;
    resendInFlight.current = true;
    setError(null);
    void sendLoginOtp(phone)
      .then(() => {
        // The timer restarts only on a real success, so a failed resend does not look like one.
        setSecondsLeft(loginResendSeconds);
        setCode('');
      })
      .catch((cause: unknown) => {
        setError(apiErrorMessage(cause));
      })
      .finally(() => {
        resendInFlight.current = false;
      });
  }, [phone, secondsLeft]);

  const canResend = secondsLeft <= 0;

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
          <Text variant="headingLg">OTP verification</Text>
          <Text variant="captionMuted">{`OTP bhej diya gaya hai +91 ${phone ?? ''}`}</Text>

          <OtpInput
            testID="login-otp"
            length={otpLength.login}
            value={code}
            onChange={(next) => {
              setCode(next);
              if (error !== null) setError(null);
            }}
            onComplete={verify}
            hasError={error !== null}
            disabled={submitting}
            autoFocus
          />

          {error !== null && (
            <Text variant="caption" color={color.danger} align="center" testID="login-otp-error">
              {error}
            </Text>
          )}

          {canResend ? (
            <Pressable onPress={resend} accessibilityRole="button" testID="login-otp-resend">
              <Text variant="caption" align="center" color={color.textPrimary}>
                Resend OTP via SMS
              </Text>
            </Pressable>
          ) : (
            <Text variant="captionMuted" align="center" testID="login-otp-timer">
              {`Resend OTP in ${secondsLeft}s`}
            </Text>
          )}

          <Button
            label="Verify"
            tone="action"
            disabled={code.length !== otpLength.login}
            loading={submitting}
            onPress={() => verify(code)}
            testID="login-otp-verify"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xxxl },
  brandBlock: { gap: spacing.xs, marginTop: spacing.huge },
  formBlock: { gap: spacing.l },
});
