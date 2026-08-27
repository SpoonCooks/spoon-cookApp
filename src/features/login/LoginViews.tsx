import { useEffect, useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SvgXml } from 'react-native-svg';

import { FigmaGradient, Text, color, fontFamily, useDesignScale, type DesignScale } from '@ui';
import { editIcon } from '@ui/icons/figmaV13Icons';

/**
 * Presentational views for the V13 `Login flow` section (`434:3115`).
 *
 * ## Why the views are separated from the routes
 *
 * The routes own behaviour — session restore, OTP requests, navigation — and none of that can run
 * during a visual capture: `BootScreen` redirects as soon as the session resolves, so a screenshot
 * of the route would catch whichever screen it redirected to. Splitting the pixels from the
 * behaviour lets `/dev` render the exact same element tree the route renders, from a fixed input,
 * and lets the view tests assert geometry without mounting a router.
 *
 * This mirrors `features/service/ServiceViews.tsx`, which already does the same for the twelve
 * Service frames.
 *
 * ## Safe area
 *
 * Every view here applies its own top inset. The design's 33-unit status-bar mock is system
 * chrome the app must not draw, so a view's first application-owned row is placed immediately
 * below `insets.top`, and the pixel harness aligns that row against design row 33. Getting this
 * wrong by even a few units shifts the whole screen, so it lives in one place rather than being
 * repeated per route.
 *
 * ## Why positions are measured, not derived
 *
 * Vertical positions below are stated as **content-space offsets** — distance from the first row
 * the application owns — and were read off the reference render rather than computed from the
 * frame's CSS. The frames nest up to seven flex wrappers whose declared heights overflow their
 * parents (`434:3290` is 172 tall inside a 144-unit box), so unwinding the cascade reproduces the
 * *stated* layout and not the *rendered* one; on `434:3280` the two disagree by about 19 units by
 * the time the legal copy is reached. Every number here is checkable by re-running the same scan
 * against the committed `figma.png`.
 */

/** `434:3330` viewport geometry. */
const BOOT = {
  /** Gap between the status band and the top of `434:3334`. */
  gradientTop: 4,
  /** Gap between the bottom of `434:3334` and the home-indicator strip. */
  gradientBottom: 2,
  /**
   * `434:3335`, a 370x370 box at viewport y=231 — 194 units below the gradient's own top edge.
   *
   * Pinned to that offset rather than centred. Centring looks equivalent on paper (the design
   * leaves 194 units above the mark and 197 below) but it is measured against the *gradient's*
   * height, and the gradient flexes: the emulator gives 750 design units of content height where
   * the frame assumes 767, so a centred mark lands 4 units low. Pinning makes the mark's position
   * independent of the available height, which is what the design actually specifies.
   */
  logoSize: 370,
  logoTopFromGradient: 194,
  /** `434:3334`'s nominal box, used only to normalise the gradient angle. */
  gradientDesignWidth: 370,
  gradientDesignHeight: 761,
  /** `434:3334`'s fill, transcribed from the frame's own CSS. */
  angle: 154.26259710299553,
  stops: [
    { offset: 0, color: '#ffd600', opacity: 0.7 },
    { offset: 0.98789, color: '#cfff04', opacity: 0.7 },
  ],
} as const;

/**
 * Page 0 — loading / boot (`434:3330`).
 *
 * Three bands against the 370x810 viewport: frame fill under the status bar, a full-bleed
 * gradient carrying the brand mark, and the home-indicator strip the OS owns. The gradient is
 * drawn rather than exported so the exact Figma stops stay readable in source; compositing
 * `rgba(255,214,0,.7)` and `rgba(207,255,4,.7)` over the white card beneath gives `#ffe24d` and
 * `#ddff4f`, which is what the reference render samples at both corners.
 *
 * The gradient flexes instead of taking its design height of 761: the verified emulator offers 750
 * design units between its system bars against the frame's 767, so a fixed height would be clipped
 * at the bottom. The mark is pinned to its design offset within the gradient rather than centred
 * in it, so the flexing height cannot move it.
 */
export function BootView(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { s } = useDesignScale();

  return (
    <View style={styles.bootContainer} testID="boot-screen">
      <View style={{ height: insets.top }} />
      <FigmaGradient
        angle={BOOT.angle}
        stops={BOOT.stops}
        backdrop={color.white}
        designWidth={BOOT.gradientDesignWidth}
        designHeight={BOOT.gradientDesignHeight}
        style={[
          styles.bootGradient,
          {
            marginTop: s(BOOT.gradientTop),
            marginBottom: s(BOOT.gradientBottom),
            paddingTop: s(BOOT.logoTopFromGradient),
          },
        ]}
        testID="boot-gradient"
      >
        <Image
          source={require('@/assets/images/figma-v13/spoon-brand-logo.png')}
          style={{ width: s(BOOT.logoSize), height: s(BOOT.logoSize) }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel="Spoon"
          testID="boot-logo"
        />
      </FigmaGradient>
    </View>
  );
}

/** `434:3280` geometry, in content space. */
const PHONE = {
  /** `434:3324`. The image box is 371 wide against a 370 viewport and is clipped to 329 tall. */
  heroHeight: 329,
  heroImageWidth: 371,
  heroImageHeight: 343.31,
  heroImageLeft: -0.48,
  heroImageTop: -0.03,

  /** `434:3283` — a 134x93 window onto a square logo, centred on the 370 column. */
  logoTop: 351.22,
  logoLeft: 118,
  logoBoxWidth: 134,
  logoBoxHeight: 93,
  /** `h-[143.37%]` and `top-[-14.87%]` of the 93-unit box. */
  logoImageHeight: 133.33,
  logoImageTop: -13.83,

  /** `434:3286` Livvic Bold 18/28, and `434:3287` Livvic SemiBold 15/16. */
  titleTop: 450.22,
  taglineTop: 480.22,

  /** `434:3294` Bold 14/20 and `434:3296` Regular 12/16. */
  labelTop: 532.22,
  hintTop: 558.22,

  /** `434:3297`. Corner radius is a literal 15 — not a pill, which is what V12 drew. */
  fieldTop: 595.22,
  fieldHeight: 43,
  fieldRadius: 15,
  fieldPadding: 12,
  /**
   * `434:3298`: 16 units of padding either side of `+91`, then a 1.778-unit `#ffe666` rule.
   *
   * The rule is the right *border of the `+91` span*, and that span is a flex column sized to its
   * own text — so the rule is one 24-unit line box tall, centred, not the full 43-unit field. V12
   * stretched it edge to edge, which is the single visible defect the overlay showed on this
   * screen once the geometry was right.
   */
  prefixPadding: 16,
  dividerWidth: 1.778,
  dividerHeight: 24,
  inputPadding: 16,

  /** `434:3303`. Radius 16 on a 34-tall button, so the ends are not semicircular. */
  ctaTop: 654.22,
  ctaHeight: 34,
  ctaRadius: 16,

  /**
   * Clear space kept under `Next` when the keyboard pushes the screen up. Not a design value —
   * the design has no keyboard — just enough that the button does not sit flush on the IME.
   */
  keyboardGap: 12,

  /** `434:3307` / `434:3309`, Livvic Regular 9/13.5. */
  legalTop: 731.5,
  legalLineHeight: 13.5,
  legalGap: 2,

  /** `434:3291` — the form column is x=20 w=325, so the right margin is 25, not 20. */
  gutter: 20,
  columnWidth: 325,
} as const;

export interface PhoneViewProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onSubmit: () => void;
  readonly canSubmit: boolean;
  readonly isSending: boolean;
  readonly error: string | null;
  /** Opens the Terms of use document. Optional so the `/dev` gallery can render without a router. */
  readonly onOpenTerms?: (() => void) | undefined;
  /** Opens the Privacy policy document. */
  readonly onOpenPrivacy?: (() => void) | undefined;
}

/**
 * Page 1 — phone login (`434:3280`).
 *
 * The Login flow is the one place in the app that is **white on yellow**; the rest of the product
 * is cream on lime. `#ffd600` and `#ffffff` here are Login-specific and are not the shared surface
 * tokens.
 *
 * Elements are positioned absolutely against the measured content offsets rather than stacked with
 * margins. A margin stack accumulates every rounding error in the chain — with fourteen elements
 * at a 1.0614 scale factor that is enough to walk the legal copy off its row — whereas an absolute
 * offset is wrong only by its own rounding.
 *
 * Behaviour lives in the route. Validation matches the backend contract (10 digits, leading 6-9);
 * `Next` stays inert until the number is valid, so an invalid request is never sent.
 */
/**
 * How far `PhoneView` must ride up so the keyboard does not bury the field it belongs to.
 *
 * ## Why this is needed at all, when the manifest already says `adjustResize`
 *
 * It does, and under Expo SDK 57 / RN 0.86 it no longer means anything: the activity is
 * **edge-to-edge**, so the window is not resized when the IME appears — the app is expected to
 * draw behind it and consume the inset itself. Measured on the reference device, the IME takes
 * `[0,1554][1080,2392]` and the window frame does not move, which is exactly what a cook sees:
 * the hero, the wordmark and the tagline, and then the keyboard, with `Login`, the `+91` field
 * and `Next` all behind it. You cannot see the number you are typing.
 *
 * ## Why a shift rather than a ScrollView
 *
 * `PhoneView` is an absolutely positioned transcription — every element is pinned at its own
 * design offset (`titleTop`, `fieldTop`, `ctaTop`). Nothing has intrinsic height, so a
 * `ScrollView` has nothing to scroll and a `KeyboardAvoidingView` has no flow to compress. A
 * translation is also the only thing that CANNOT disturb the geometry: it moves the whole pinned
 * block as one, so every element keeps its exact relationship to every other, and the screen is
 * pixel-identical to `434:3280` whenever the keyboard is down.
 *
 * The shift is whatever it takes to get `Next`'s bottom edge above the keyboard, and no more.
 * With the keyboard closed it is 0.
 */
function useKeyboardShift(scale: DesignScale, topInset: number): number {
  const { s } = scale;
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    // `screenY` is the keyboard's top edge in dp, which is directly comparable to the inset and
    // to `s()`. `did`-events rather than `will`-events: Android only reports the former.
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardTop(null);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  if (keyboardTop === null) return 0;
  const ctaBottom = topInset + s(PHONE.ctaTop + PHONE.ctaHeight + PHONE.keyboardGap);
  return Math.max(0, ctaBottom - keyboardTop);
}

export function PhoneView({
  value,
  onChange,
  onSubmit,
  canSubmit,
  isSending,
  error,
  onOpenTerms,
  onOpenPrivacy,
}: PhoneViewProps): React.ReactElement {
  const scale = useDesignScale();
  const insets = useSafeAreaInsets();
  const { s } = scale;
  const keyboardShift = useKeyboardShift(scale, insets.top);

  return (
    <View style={styles.phoneRoot} testID="login-screen">
      <View style={{ height: insets.top }} />
      <View
        style={[styles.phoneContent, { transform: [{ translateY: -keyboardShift }] }]}
        testID="login-content"
      >
        <View style={[styles.clip, { height: s(PHONE.heroHeight) }]}>
          <Image
            source={require('@/assets/images/figma-v13/login-hero.png')}
            style={{
              width: s(PHONE.heroImageWidth),
              height: s(PHONE.heroImageHeight),
              marginLeft: s(PHONE.heroImageLeft),
              marginTop: s(PHONE.heroImageTop),
            }}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
            accessible
            accessibilityRole="image"
            accessibilityLabel="Spoon partner cook in a kitchen"
            testID="login-hero"
          />
        </View>

        <View
          style={[
            styles.clip,
            {
              position: 'absolute',
              top: s(PHONE.logoTop),
              left: s(PHONE.logoLeft),
              width: s(PHONE.logoBoxWidth),
              height: s(PHONE.logoBoxHeight),
            },
          ]}
        >
          <Image
            source={require('@/assets/images/figma-v13/spoon-logo.png')}
            style={{
              width: s(PHONE.logoBoxWidth),
              height: s(PHONE.logoImageHeight),
              marginTop: s(PHONE.logoImageTop),
            }}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
            accessible
            accessibilityRole="image"
            accessibilityLabel="Spoon"
            testID="login-wordmark"
          />
        </View>

        <Text
          variant="heading"
          align="center"
          style={[styles.row, { top: s(PHONE.titleTop) }]}
          testID="login-title"
        >
          Partner
        </Text>
        <Text
          align="center"
          color={color.black70}
          style={[styles.row, taglineStyle(scale), { top: s(PHONE.taglineTop) }]}
          testID="login-tagline"
        >
          Spoon se jude aur zindagi behtar banaye
        </Text>

        <Text variant="body" style={[columnStyle(scale), { top: s(PHONE.labelTop) }]}>
          Login
        </Text>
        <Text
          variant="captionRegular"
          color={color.black70}
          style={[columnStyle(scale), { top: s(PHONE.hintTop) }]}
        >
          Phone no. daale
        </Text>

        <View
          testID="login-phone-field"
          style={[
            styles.field,
            columnStyle(scale),
            {
              top: s(PHONE.fieldTop),
              height: s(PHONE.fieldHeight),
              borderRadius: s(PHONE.fieldRadius),
              paddingHorizontal: s(PHONE.fieldPadding),
            },
          ]}
        >
          <View style={{ paddingHorizontal: s(PHONE.prefixPadding) }}>
            <Text style={fieldTextStyle(scale)}>+91</Text>
          </View>
          <View
            testID="login-phone-divider"
            style={{
              width: s(PHONE.dividerWidth),
              height: s(PHONE.dividerHeight),
              backgroundColor: color.yellow400,
            }}
          />
          <TextInput
            testID="login-phone-input"
            value={value}
            onChangeText={onChange}
            placeholder="9876543210"
            placeholderTextColor={color.textMuted}
            keyboardType="phone-pad"
            inputMode="numeric"
            maxLength={13}
            autoComplete="tel"
            textContentType="telephoneNumber"
            style={[
              fieldTextStyle(scale),
              {
                flex: 1,
                height: '100%',
                paddingVertical: 0,
                paddingHorizontal: s(PHONE.inputPadding),
              },
            ]}
            accessibilityLabel="Phone number"
            onSubmitEditing={onSubmit}
            returnKeyType="next"
            editable={!isSending}
          />
        </View>

        <Pressable
          testID="login-next"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || isSending }}
          disabled={!canSubmit || isSending}
          onPress={onSubmit}
          hitSlop={12}
          style={[
            styles.cta,
            columnStyle(scale),
            {
              top: s(PHONE.ctaTop),
              height: s(PHONE.ctaHeight),
              borderRadius: s(PHONE.ctaRadius),
              opacity: canSubmit && !isSending ? 1 : 0.55,
            },
          ]}
        >
          <Text align="center" style={ctaLabelStyle(scale)}>
            Next
          </Text>
        </Pressable>

        <Text
          align="center"
          color={color.black70}
          style={[styles.row, legalStyle(scale), { top: s(PHONE.legalTop) }]}
        >
          By continuing, I accept the
        </Text>
        {/*
          One rendered line, two press targets. The design draws a single underlined string, so the
          pixels stay exactly that — a centred Text with the whole line underlined — but the two
          document names are separate nested spans with their own `onPress`, which is what lets
          "Terms of use" and "Privacy policy" open their own documents without changing the UI.
        */}
        <Text
          align="center"
          color={color.black}
          style={[
            styles.row,
            legalStyle(scale),
            styles.underline,
            { top: s(PHONE.legalTop + PHONE.legalLineHeight + PHONE.legalGap) },
          ]}
        >
          <Text
            color={color.black}
            style={[legalStyle(scale), styles.underline]}
            onPress={onOpenTerms}
            accessibilityRole="link"
            testID="login-terms-link"
          >
            Terms of use
          </Text>
          {' & '}
          <Text
            color={color.black}
            style={[legalStyle(scale), styles.underline]}
            onPress={onOpenPrivacy}
            accessibilityRole="link"
            testID="login-privacy-link"
          >
            Privacy policy
          </Text>
        </Text>

        {error !== null && (
          <Text
            variant="caption"
            color={color.danger}
            align="center"
            style={[styles.row, { top: s(PHONE.ctaTop + PHONE.ctaHeight + 4) }]}
            testID="login-error"
          >
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * `434:3224` / `434:3174` / `434:3116` geometry, in content space.
 *
 * These three frames are one screen. Their subtrees are identical down to the OTP block, where
 * `434:3246` grows from 160 to 192 units to make room for the error line — so only the footer
 * moves, and only on the error state. Every offset below derives cleanly from the frames' own
 * flex cascade (unlike `434:3280`, these do not overflow their wrappers) and each one was checked
 * against the ink rows scanned from all three reference renders.
 */
const OTP = {
  /** `434:3241`, the same 134x93 logo window the phone screen uses, 27 units below the status band. */
  logoTop: 27,
  logoLeft: 118,

  /** `434:3244` Bold 18/28 and `434:3245` SemiBold 14/16 — 14 here, not the phone screen's 15. */
  titleTop: 126,
  taglineTop: 156,

  /** `434:3249` Bold 14/20. */
  labelTop: 221,
  /** `434:3251` Regular 12/16 with the 14x14 `434:3252` edit glyph 12 units after it. */
  infoTop: 247,
  editIconSize: 14,
  infoIconGap: 12,

  /** `434:3148` — six 35-unit tiles, 10 apart, a 260-wide row centred on the 370 column. */
  boxesTop: 291,
  boxSize: 35,
  boxGap: 10,
  boxRadius: 5,
  boxRowWidth: 260,

  /** `434:3167`, present only on `434:3116`. Livvic Medium 12/16. */
  errorTop: 336,

  /** `434:3274` / `434:3218` SemiBold 14/20, and where `434:3116` pushes it to. */
  footerTop: 338,
  footerTopWithError: 370,

  /** `434:3246` is inset 4 from the root's own 16, so the column is x=20 w=330. */
  columnLeft: 20,
  columnWidth: 330,
} as const;

/**
 * `434:3167`'s ink is `#ff0404` and `434:3149`'s tile fill composites to `#ffdcdc`.
 *
 * Neither is `semantic.danger` (`#ff0000`). The difference is small but real and measurable, and
 * the brief asks for the design's colours rather than the nearest token — so these stay local to
 * the frames that use them instead of quietly widening the palette.
 *
 * The tile is **not** a single `rgba(255,4,4,0.07)` layer. `434:3149` carries that fill and so
 * does its child `434:3150`, so the tint is applied twice: 7% over 7% over white resolves to 221
 * in green and blue, and the reference render samples 220. A single layer gives `#ffeded`, which
 * is visibly too pale and is what the first attempt drew.
 */
const OTP_ERROR_INK = '#ff0404';
const OTP_ERROR_TILE = '#ffdcdc';

export interface OtpViewProps {
  readonly phone: string;
  readonly code: string;
  readonly onChange: (next: string) => void;
  readonly onSubmit: () => void;
  readonly onEditPhone: () => void;
  readonly onResend: () => void;
  readonly secondsLeft: number;
  readonly error: string | null;
  readonly isSubmitting: boolean;
  readonly length: number;
}

/**
 * Pages 2a / 2b / 2c — OTP verification (`434:3224`, `434:3174`, `434:3116`).
 *
 * One screen, three states, because the frames differ only in the tile fill, the presence of the
 * error line, and the resend affordance:
 *
 *   2a — countdown running, tiles `#ffef99`, footer `Resend OTP in 25s`
 *   2b — countdown finished, tiles empty, footer `Resend OTP via SMS` underlined
 *   2c — wrong code, tiles `#ffeded`, red error line, footer `Resend OTP via SMS` underlined
 *
 * The tiles are drawn rather than composed from the shared `OtpInput`, and entry is captured by a
 * transparent full-width `TextInput` laid over them. A per-tile input would give Android six focus
 * targets and six carets to place, none of which the design draws; one field keeps the pixels
 * under this component's control while leaving paste and SMS autofill working.
 */
export function OtpView({
  phone,
  code,
  onChange,
  onSubmit,
  onEditPhone,
  onResend,
  secondsLeft,
  error,
  isSubmitting,
  length,
}: OtpViewProps): React.ReactElement {
  const scale = useDesignScale();
  const insets = useSafeAreaInsets();
  const { s } = scale;
  const hasError = error !== null;
  const canResend = secondsLeft <= 0;
  const rowLeft = (370 - OTP.boxRowWidth) / 2;

  return (
    <View style={styles.otpRoot} testID="otp-screen">
      <View style={{ height: insets.top }} />
      <View style={styles.phoneContent}>
        <View
          style={[
            styles.clip,
            {
              position: 'absolute',
              top: s(OTP.logoTop),
              left: s(OTP.logoLeft),
              width: s(PHONE.logoBoxWidth),
              height: s(PHONE.logoBoxHeight),
            },
          ]}
        >
          <Image
            source={require('@/assets/images/figma-v13/spoon-logo.png')}
            style={{
              width: s(PHONE.logoBoxWidth),
              height: s(PHONE.logoImageHeight),
              marginTop: s(PHONE.logoImageTop),
            }}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
            accessible
            accessibilityRole="image"
            accessibilityLabel="Spoon"
            testID="otp-wordmark"
          />
        </View>

        <Text variant="heading" align="center" style={[styles.row, { top: s(OTP.titleTop) }]}>
          Partner
        </Text>
        <Text
          align="center"
          color={color.black70}
          style={[styles.row, otpTaglineStyle(scale), { top: s(OTP.taglineTop) }]}
        >
          Spoon se jude aur zindagi behtar banaye
        </Text>

        <Text variant="body" style={[otpColumnStyle(scale), { top: s(OTP.labelTop) }]}>
          OTP verification
        </Text>

        <View
          style={[
            otpColumnStyle(scale),
            styles.infoRow,
            { top: s(OTP.infoTop), gap: s(OTP.infoIconGap) },
          ]}
        >
          <Text variant="captionRegular" color={color.black70} testID="otp-hint">
            {`OTP bhej diya gaya hai +91 ${phone}`}
          </Text>
          <Pressable
            onPress={onEditPhone}
            accessibilityRole="button"
            accessibilityLabel="Change phone number"
            hitSlop={12}
            testID="otp-edit-phone"
          >
            <SvgXml
              xml={editIcon}
              width={s(OTP.editIconSize)}
              height={s(OTP.editIconSize)}
              testID="otp-edit-icon"
            />
          </Pressable>
        </View>

        <View
          testID="otp-tiles"
          style={[
            styles.tileRow,
            {
              top: s(OTP.boxesTop),
              left: s(rowLeft),
              width: s(OTP.boxRowWidth),
              height: s(OTP.boxSize),
              gap: s(OTP.boxGap),
            },
          ]}
        >
          {Array.from({ length }, (_, index) => (
            <View
              key={index}
              testID={`login-otp-box-${index}`}
              style={{
                width: s(OTP.boxSize),
                height: s(OTP.boxSize),
                borderRadius: s(OTP.boxRadius),
                backgroundColor: hasError ? OTP_ERROR_TILE : color.yellow300,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text align="center" style={otpDigitStyle(scale)}>
                {code[index] ?? ''}
              </Text>
            </View>
          ))}
        </View>

        <TextInput
          testID="login-otp-field"
          value={code}
          onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={length}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          autoFocus={false}
          editable={!isSubmitting}
          onSubmitEditing={onSubmit}
          accessibilityLabel="OTP code"
          // Invisible but live. `color: 'transparent'` is not enough — Android still painted the
          // value across the first tile, overflowing it — so the field is taken to zero opacity.
          // A zero-opacity view still receives touches and still accepts paste and SMS autofill,
          // which is the whole reason the input exists.
          caretHidden
          selectionColor="transparent"
          style={[
            styles.tileInput,
            {
              top: s(OTP.boxesTop),
              left: s(rowLeft),
              width: s(OTP.boxRowWidth),
              height: s(OTP.boxSize),
            },
          ]}
        />

        {hasError && (
          <Text
            align="center"
            color={OTP_ERROR_INK}
            style={[otpColumnStyle(scale), otpErrorStyle(scale), { top: s(OTP.errorTop) }]}
            testID="login-otp-error"
          >
            {error}
          </Text>
        )}

        {/*
          The pressable wraps only the text, not the full-width row.

          A row-wide `Pressable` painted a full-bleed `#ececec` band across content rows 337-357 on
          Android — 28% of the differing pixels on this screen — which the design does not draw. A
          content-sized target with an explicit transparent background removes it, and it is the
          better hit target regardless: the design's affordance is the words, not the whole row.
        */}
        <View
          style={[
            styles.row,
            styles.footerRow,
            { top: s(hasError ? OTP.footerTopWithError : OTP.footerTop) },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onResend}
            disabled={!canResend}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canResend }}
            hitSlop={12}
            // The id names the STATE, so a test asserting `2a` cannot pass against `2b`: the
            // countdown line and the resend affordance are different frames, not one element with
            // different text.
            testID={canResend ? 'login-otp-resend' : 'login-otp-timer'}
            style={styles.footerTarget}
          >
            <Text align="center" color={color.black70} style={otpFooterStyle(scale)}>
              {canResend ? (
                <>
                  <Text style={[otpFooterStyle(scale), styles.underline]} color={color.black70}>
                    Resend OTP{' '}
                  </Text>
                  <Text style={[otpFooterBoldStyle(scale), styles.underline]} color={color.black70}>
                    via SMS
                  </Text>
                </>
              ) : (
                <>
                  <Text style={otpFooterStyle(scale)} color={color.black70}>
                    Resend OTP in{' '}
                  </Text>
                  <Text style={otpFooterBoldStyle(scale)} color={color.black70}>
                    {secondsLeft}s
                  </Text>
                </>
              )}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Scale-dependent styles.
 *
 * These cannot live in `StyleSheet.create` because every value depends on the device's
 * `screenWidth / 370` factor, which is only known at render time.
 */
function otpColumnStyle(scale: DesignScale) {
  return {
    position: 'absolute' as const,
    left: scale.s(OTP.columnLeft),
    width: scale.s(OTP.columnWidth),
  };
}

function otpTaglineStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.semibold,
    fontSize: scale.font(14),
    lineHeight: scale.s(16),
  };
}

function otpDigitStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.bold,
    fontSize: scale.font(18),
    lineHeight: scale.s(28),
    color: color.black70,
  };
}

function otpErrorStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.medium,
    fontSize: scale.font(12),
    lineHeight: scale.s(16),
  };
}

function otpFooterStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.semibold,
    fontSize: scale.font(14),
    lineHeight: scale.s(20),
  };
}

function otpFooterBoldStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.bold,
    fontSize: scale.font(14),
    lineHeight: scale.s(20),
  };
}

function columnStyle(scale: DesignScale) {
  return {
    position: 'absolute' as const,
    left: scale.s(PHONE.gutter),
    width: scale.s(PHONE.columnWidth),
  };
}

function taglineStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.semibold,
    fontSize: scale.font(15),
    lineHeight: scale.s(16),
  };
}

function fieldTextStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.bold,
    fontSize: scale.font(16),
    lineHeight: scale.s(24),
    letterSpacing: scale.s(1.6),
    color: color.black,
  };
}

function ctaLabelStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.black,
    fontSize: scale.font(16),
    lineHeight: scale.s(24),
    letterSpacing: scale.s(-0.4),
    color: color.black,
  };
}

function legalStyle(scale: DesignScale) {
  return {
    fontFamily: fontFamily.regular,
    fontSize: scale.font(9),
    lineHeight: scale.s(13.5),
  };
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: color.cream,
  },
  bootGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  phoneRoot: { flex: 1, backgroundColor: color.white },
  phoneContent: { flex: 1 },
  clip: { overflow: 'hidden' },
  row: { position: 'absolute', left: 0, right: 0 },
  underline: { textDecorationLine: 'underline' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.yellow600,
    backgroundColor: color.white,
    overflow: 'hidden',
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.yellow600,
  },
  otpRoot: { flex: 1, backgroundColor: color.white },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  tileRow: { position: 'absolute', flexDirection: 'row' },
  tileInput: { position: 'absolute', opacity: 0 },
  footerRow: { alignItems: 'center' },
  footerTarget: { backgroundColor: 'transparent' },
});
