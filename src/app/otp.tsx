import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
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
import { color, OtpInput, Text, useDesignScale } from '@ui';

/**
 * Pages 2a / 2b / 2c — login OTP (Figma `434:3224`, `434:3174`, `434:3116`).
 *
 * All three frames are one screen with three states, because they differ only in the resend
 * affordance and the error line:
 *   2a — countdown running (`Resend OTP in 25s`)
 *   2b — countdown finished (`Resend OTP via SMS`), tiles empty
 *   2c — wrong code (`Galat OTP. Firse koshish kare`) + resend available
 *
 * ## Composition
 *
 * Rebuilt against V12. The screen is white — not the app's cream — and carries the Spoon wordmark
 * but, unlike Login, no hero photograph. Coordinates below are viewport space (370x810) taken from
 * the `434:3224` subtree.
 *
 * **There is no Verify button in any of the three frames.** The previous implementation drew one;
 * all three V12 states end at the resend line. Verification already fires from `onComplete` when
 * the sixth digit lands, so removing the button costs no behaviour — and a control the design
 * does not have is exactly the kind of drift this pass exists to remove.
 *
 * Length comes from `otpLength.login` (6), matching both the six `digits` frames in V12 and the
 * backend `LOGIN_OTP_LENGTH` default.
 *
 * ## A valid OTP is not, by itself, entry
 *
 * Verification goes through `completeLogin`, which persists the session, reads the cook profile
 * and runs it through `gateCookAccess`. Only a `signed_in` result navigates. A denial shows the
 * reason and leaves no session behind, so there is no path where "the code was right" alone opens
 * the app.
 */

/** Viewport-space geometry, read from the `434:3224` subtree. */
const D = {
  statusBarToWordmark: 27,
  wordmarkWidth: 134,
  wordmarkHeight: 93,
  wordmarkToTitle: 6,
  titleToSubtitle: 2,
  subtitleToHeading: 49,
  headingToHint: 6,
  hintToTiles: 27.5,
  tilesToResend: 12,
  gutter: 20,
  columnWidth: 330,
  editIconSize: 14,
  editIconGap: 12,
} as const;

export default function OtpScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const { s } = useDesignScale();

  const signIn = useSession((state) => state.signIn);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(loginResendSeconds);
  // Guards against a double resend while one is already in flight.
  const resendInFlight = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={{ height: insets.top }} />

        <Image
          source={require('../../assets/images/figma-v12/spoon-wordmark.png')}
          style={{
            width: s(D.wordmarkWidth),
            height: s(D.wordmarkHeight),
            marginTop: s(D.statusBarToWordmark),
            alignSelf: 'center',
          }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel="Spoon"
          testID="otp-wordmark"
        />

        <Text variant="heading" align="center" style={{ marginTop: s(D.wordmarkToTitle) }}>
          Partner
        </Text>
        <Text
          variant="captionRegular"
          align="center"
          color={color.black70}
          style={{ marginTop: s(D.titleToSubtitle) }}
        >
          Spoon se jude aur zindagi behtar banaye
        </Text>

        <View
          testID="otp-form-column"
          style={{ paddingLeft: s(D.gutter), width: s(D.gutter + D.columnWidth) }}
        >
          <Text variant="body" style={{ marginTop: s(D.subtitleToHeading) }}>
            OTP verification
          </Text>

          <View style={[styles.hintRow, { marginTop: s(D.headingToHint) }]}>
            <Text variant="captionRegular" color={color.black70} testID="otp-hint">
              {`OTP bhej diya gaya hai +91 ${phone ?? ''}`}
            </Text>
            <Image
              source={require('../../assets/images/figma-v12/edit-phone.png')}
              style={{
                width: s(D.editIconSize),
                height: s(D.editIconSize),
                marginLeft: s(D.editIconGap),
              }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              testID="otp-edit-icon"
            />
          </View>

          <View style={{ marginTop: s(D.hintToTiles) }}>
            <OtpInput
              testID="login-otp"
              variant="tiles"
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
          </View>

          {error !== null && (
            <Text
              variant="caption"
              color={color.danger}
              align="center"
              style={{ marginTop: s(D.tilesToResend) }}
              testID="login-otp-error"
            >
              {error}
            </Text>
          )}

          {canResend ? (
            <Pressable
              onPress={resend}
              accessibilityRole="button"
              testID="login-otp-resend"
              hitSlop={12}
              style={{ marginTop: s(D.tilesToResend) }}
            >
              <Text variant="body" align="center">
                Resend OTP via SMS
              </Text>
            </Pressable>
          ) : (
            <Text
              variant="body"
              align="center"
              style={{ marginTop: s(D.tilesToResend) }}
              testID="login-otp-timer"
            >
              {`Resend OTP in ${secondsLeft}s`}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, minHeight: insets.bottom }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.white },
  content: { flexGrow: 1, backgroundColor: color.white },
  hintRow: { flexDirection: 'row', alignItems: 'center' },
});
