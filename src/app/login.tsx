import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
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
import { Button, color, fontFamily, fontSize, lineHeight, Text, useDesignScale } from '@ui';

/**
 * Page 1 — phone login (Figma `434:3280`).
 *
 * ## Composition
 *
 * Rebuilt against the V12 node tree rather than the previous approximation. The frame is 390x830
 * around a 370x810 application viewport; every coordinate below is stated in that viewport space
 * and scaled to the device by {@link useDesignScale}. Verified against a pixel scan of the V12
 * render — the phone field's top border lands on viewport y=628 and the CTA on y=687, which is
 * what the metadata declares.
 *
 * The Login flow is the one place in the app that is **white on yellow**. The rest of the product
 * is cream on lime, and those tokens are deliberately not touched here: `#ffd600` and `#ffffff`
 * are Login-specific, confirmed by sampling the V12 render directly.
 *
 * Three defects this replaces, all confirmed against `434:3280`: the hero photograph and the
 * Spoon wordmark were absent entirely, the background was cream instead of white, the CTA was
 * lime instead of yellow, and the phone number was split across two separate boxes where V12 uses
 * a single pill divided by a hairline.
 *
 * ## Behaviour
 *
 * Unchanged. Validation matches the backend contract (10 digits, leading 6-9); `Next` stays
 * disabled until the number is valid, so an invalid request is never sent.
 * `POST /v1/auth/otp/send` is sent with `audience: 'cook'`, and navigation happens only after the
 * backend accepts — never optimistically — so a cook never lands on an OTP screen for a code that
 * was never dispatched.
 */

/** Viewport-space geometry, read from the `434:3280` subtree. */
const D = {
  heroHeight: 329,
  heroToWordmark: 22,
  wordmarkWidth: 134,
  wordmarkHeight: 93,
  wordmarkToTitle: 6,
  titleToSubtitle: 2,
  subtitleToLogin: 36,
  loginToHint: 6,
  hintToField: 21,
  gutter: 20,
  fieldWidth: 325,
  fieldHeight: 43,
  fieldPadLeft: 13,
  prefixWidth: 65.78,
  prefixPadLeft: 16,
  dividerHeight: 24,
  inputPadLeft: 16,
  fieldToCta: 16,
  ctaHeight: 34,
  ctaToLegal: 27.5,
  legalGap: 2,
  legalToBottom: 31.5,
} as const;

export default function LoginScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { s, width } = useDesignScale();
  const beginOtp = useSession((state) => state.beginOtp);
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

  const ctaHeight = s(D.ctaHeight);

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
        {/* The V12 status bar is device chrome, not app content — the real inset stands in. */}
        <View style={{ height: insets.top }} />

        <Image
          source={require('../../assets/images/figma-v12/login-hero.png')}
          style={{ width, height: s(D.heroHeight) }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel="Spoon partner cook in a kitchen"
          testID="login-hero"
        />

        <Image
          source={require('../../assets/images/figma-v12/spoon-wordmark.png')}
          style={{
            width: s(D.wordmarkWidth),
            height: s(D.wordmarkHeight),
            marginTop: s(D.heroToWordmark),
            alignSelf: 'center',
          }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel="Spoon"
          testID="login-wordmark"
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

        {/* V12's form column is x=20 w=325 on a 370 viewport: the right margin is 25, not 20. */}
        <View
          testID="login-form-column"
          style={{ paddingLeft: s(D.gutter), width: s(D.gutter + D.fieldWidth) }}
        >
          <Text variant="body" style={{ marginTop: s(D.subtitleToLogin) }}>
            Login
          </Text>
          <Text
            variant="captionRegular"
            color={color.black70}
            style={{ marginTop: s(D.loginToHint) }}
          >
            Phone no. daale
          </Text>

          {/* One pill, split by a hairline — V12 `434:3297`. Never two boxes. */}
          <View
            testID="login-phone-field"
            style={[
              styles.field,
              {
                height: s(D.fieldHeight),
                borderRadius: s(D.fieldHeight) / 2,
                paddingLeft: s(D.fieldPadLeft),
                marginTop: s(D.hintToField),
              },
            ]}
          >
            <View style={{ width: s(D.prefixWidth), paddingLeft: s(D.prefixPadLeft) }}>
              <Text variant="title">+91</Text>
            </View>
            <View
              testID="login-phone-divider"
              style={[styles.divider, { height: s(D.dividerHeight) }]}
            />
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
              style={[styles.input, { paddingLeft: s(D.inputPadLeft) }]}
              accessibilityLabel="Phone number"
              onSubmitEditing={submit}
              returnKeyType="next"
            />
          </View>

          <Button
            label="Next"
            tone="accent"
            disabled={!isValid}
            loading={sending}
            onPress={submit}
            testID="login-next"
            hitSlop={12}
            style={{
              minHeight: ctaHeight,
              height: ctaHeight,
              borderRadius: ctaHeight / 2,
              paddingVertical: 0,
              marginTop: s(D.fieldToCta),
            }}
          />

          {error !== null && (
            <Text variant="caption" color={color.danger} align="center" testID="login-error">
              {error}
            </Text>
          )}
        </View>

        <Text
          variant="microRegular"
          align="center"
          color={color.black70}
          style={{ marginTop: s(D.ctaToLegal) }}
        >
          By continuing, I accept the
        </Text>
        <Text
          variant="microRegular"
          align="center"
          color={color.black}
          style={[styles.legalLink, { marginTop: s(D.legalGap) }]}
        >
          Terms of use &amp; Privacy policy
        </Text>

        {/* Trailing space in V12 is 31.5; anything the device has spare lands here. */}
        <View style={{ flex: 1, minHeight: s(D.legalToBottom) + insets.bottom }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.white },
  content: { flexGrow: 1, backgroundColor: color.white },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: color.yellow600,
    backgroundColor: color.white,
    overflow: 'hidden',
  },
  divider: { width: StyleSheet.hairlineWidth * 2, backgroundColor: color.yellow400 },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    color: color.textPrimary,
  },
  legalLink: { textDecorationLine: 'underline' },
});
