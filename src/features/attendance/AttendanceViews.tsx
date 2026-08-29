import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SvgXml } from 'react-native-svg';

import { Text, color, dropShadow, figmaStroke, useDesignScale } from '@ui';
import { checkTick, crossTick, ellipse4 } from '@ui/icons/figmaV13Icons';

/**
 * Presentational views for the V13 `log in flow` section (`592:1068`).
 *
 * Four frames — `575:2135` daily log in, `575:2137` present, `575:2138` absent, `575:2136` log
 * out — are four STATES of one screen. They share a status band, a top nav and a greeting block,
 * and differ only in the card below.
 *
 * ## This section uses the `direct` viewport convention
 *
 * Unlike `Login flow`, these frames are **370x753 and carry no decorative phone bezel**: the frame
 * *is* the application viewport and the status-bar mock is a real child at y=0. Measuring the
 * frame confirms that mock is **32** design units tall here, not the 33 the bezel sections use —
 * the notch island in every reference render occupies rows 0..23, and `bottom-1/4` of a 32-unit
 * band is exactly 24. `comparisonProfile.ts` types that per section so a bezel crop can never be
 * applied to these frames.
 *
 * Content offsets below are therefore stated in **content space**: distance from the first row the
 * application owns, which is design y=32. The pixel harness aligns that row against the emulator's
 * first row below the status bar.
 *
 * ## Positions are measured, not derived
 *
 * As with `LoginViews`, every number here was checked against the committed `figma.png` rather
 * than unwound from the frame's CSS cascade. The checkpoints that pin the layout are: the top-nav
 * avatar at content y=6, the greeting pill's bottom edge at content y=288, the card's top edge at
 * content y=322, the green window row at 376.9..416.9 and the present-verdict circle at
 * 376.9..440.9. All five reproduce to within a pixel.
 */

/** `575:2140` — the top nav, identical on all four frames. */
const NAV = {
  /** 16 units of frame padding plus 4 of banner padding. */
  paddingH: 20,
  paddingV: 6,
  height: 54,
  avatarSize: 42,
  avatarGlyph: 30,
  helpWidth: 98,
  helpHeight: 35,
  helpPaddingH: 8,
  helpLabelWidth: 48,
  whatsAppSize: 28,
} as const;

/** `571:511` and its siblings — the scrolling content area under the nav. */
const PAGE = {
  padding: 16,
  gap: 16,
  /** The design's fixed content height. Recorded for the harness; the view flexes instead. */
  contentHeight: 667,
} as const;

/** `571:589` — praying hands, greeting and shift pill. */
const GREETING = {
  paddingH: 4,
  paddingV: 6,
  gap: 12,
  iconWidth: 128,
  iconHeight: 124,
  innerGap: 10,
  pillHeight: 32,
  pillPaddingH: 16,
  pillRadius: 20,
} as const;

/** `505:1643` / `526:297` / `525:221` — the attendance card. All three share this shell. */
const CARD = {
  width: 334,
  padding: 19.889,
  radius: 24,
  gap: 14,
  borderWidth: 1,
  /**
   * `shadow-[0px_8px_30px_0px_rgba(255,214,0,0.22)]` — with the alpha the design's own render
   * actually produces, not the alpha the CSS states.
   *
   * Figma clips the effect against the `overflow-auto` content frame the card sits in, so the
   * exported PNG carries a far weaker glow than a literal 22% fill: sampled down the card's centre
   * line, the reference peaks at **2.75%** one unit below the border and is fully gone 24 units
   * out. Drawing the stated 22% put a 28/255 yellow wash across seventeen rows below the card and
   * a 14/255 wash above it — visible, and wrong against the frame it is meant to match. 5% here
   * reproduces the reference to within 5/255 everywhere.
   */
  /** `0 8px 30px rgba(255,214,0,0.05)` — see `dropShadow` for why this is not a `boxShadow`. */
  shadowBlur: 30,
  shadowAlpha: 0.05,
  shadowOffsetY: 8,
} as const;

/** `540:402` — the white-on-green check-in window row. */
const WINDOW_ROW = {
  width: 292,
  paddingH: 12,
  paddingV: 8,
  radius: 20,
  noteWidth: 178,
} as const;

/** `507:10` + `505:1654` — the `Mark Present` row. */
const MARK_ROW = {
  height: 52,
  glyphBoxWidth: 60,
  ellipseSize: 50,
  ellipseLeft: 5.11,
  ellipseTop: 1.11,
  badgeSize: 35,
  badgeLeft: 13.11,
  badgeTop: 8.11,
  gap: 12,
} as const;

/** `505:1661` / `572:700` — the lime call to action. */
const CTA = {
  paddingV: 10,
  radius: 20,
  gap: 12,
  arrowWidth: 51,
  arrowHeight: 49,
} as const;

/** `526:302` / `526:279` — the verdict disc. */
const VERDICT = {
  discSize: 64,
  tickSize: 40,
  crossSize: 42,
  gap: 6,
} as const;

/** `572:760` + `572:778` — the log-out photograph and its caption. */
const RESTING = {
  imageHeight: 264.778,
  radius: 24,
  gap: 10,
} as const;

const prayingHands = require('@/assets/images/figma-v13/praying-hands.png');
const customerGlyph = require('@/assets/images/figma-v13/customer.png');
const whatsAppGlyph = require('@/assets/images/figma-v13/whats-app.png');
const checkedUserMale = require('@/assets/images/figma-v13/checked-user-male.png');
const arrowRight = require('@/assets/images/figma-v13/arrow-right.png');
/**
 * `572:760` — V14 re-shot this photograph.
 *
 * The V13 file is a different frame entirely: same cook and apron, a different set, pose and
 * props. Comparing the V14 render against it scored 30% on `575:2136` with the layout perfectly
 * placed, because the largest element on the screen was simply the wrong picture.
 */
const cookResting = require('@/assets/images/figma-v14/cook-resting.png');

export interface TopNavProps {
  readonly onHelp?: (() => void) | undefined;
  readonly onProfile?: (() => void) | undefined;
}

/**
 * `575:2140`. A 42-unit avatar on the left, the yellow WhatsApp help pill on the right.
 *
 * Both glyphs are the exported Figma bitmaps. Neither is redrawn, and neither is swapped for a
 * vector-icon-set lookalike: `@expo/vector-icons` has a WhatsApp mark, but it is a different
 * glyph from the one the design ships.
 */
export function TopNav({ onHelp, onProfile }: TopNavProps): React.ReactElement {
  const { s } = useDesignScale();

  return (
    <View
      style={[
        styles.nav,
        {
          height: s(NAV.height),
          paddingHorizontal: s(NAV.paddingH),
          paddingVertical: s(NAV.paddingV),
        },
      ]}
      testID="attendance-top-nav"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile"
        onPress={onProfile}
        style={[
          styles.avatar,
          { width: s(NAV.avatarSize), height: s(NAV.avatarSize), borderRadius: s(NAV.avatarSize) },
        ]}
        testID="attendance-profile"
      >
        <Image
          source={customerGlyph}
          style={{ width: s(NAV.avatarGlyph), height: s(NAV.avatarGlyph) }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Help"
        onPress={onHelp}
        style={[
          styles.help,
          {
            width: s(NAV.helpWidth),
            height: s(NAV.helpHeight),
            borderRadius: s(16),
            paddingHorizontal: s(NAV.helpPaddingH),
          },
        ]}
        testID="attendance-help"
      >
        <Text variant="title" align="center" style={{ width: s(NAV.helpLabelWidth) }}>
          Help
        </Text>
        <Image
          source={whatsAppGlyph}
          style={{ width: s(NAV.whatsAppSize), height: s(NAV.whatsAppSize) }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    </View>
  );
}

export interface GreetingProps {
  /** `571:593` — the cook's name, from the backend profile. */
  readonly name: string;
  /** `571:601` — today's shift window, e.g. `6 AM se 6 PM`. Hidden when the server has no shift. */
  readonly shiftWindow: string | null;
}

/** `571:589` — praying hands, `Namaste, <name>!`, and the shift pill. */
function Greeting({ name, shiftWindow }: GreetingProps): React.ReactElement {
  const { s } = useDesignScale();

  return (
    <View
      style={[
        styles.greeting,
        {
          paddingHorizontal: s(GREETING.paddingH),
          paddingVertical: s(GREETING.paddingV),
          gap: s(GREETING.gap),
        },
      ]}
      testID="attendance-greeting"
    >
      <Image
        source={prayingHands}
        style={{ width: s(GREETING.iconWidth), height: s(GREETING.iconHeight) }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible
        accessibilityRole="image"
        accessibilityLabel="Namaste"
        testID="attendance-namaste-icon"
      />
      <View
        style={[
          styles.greetingInner,
          {
            paddingHorizontal: s(GREETING.paddingH),
            paddingVertical: s(GREETING.paddingV),
            gap: s(GREETING.innerGap),
          },
        ]}
      >
        <Text
          variant="headingLgBold"
          align="center"
          style={styles.fullWidth}
          testID="attendance-name"
        >
          {`Namaste, ${name}!`}
        </Text>
        {shiftWindow !== null && (
          <View
            style={[
              styles.shiftPill,
              {
                height: s(GREETING.pillHeight),
                paddingHorizontal: s(GREETING.pillPaddingH),
                borderRadius: s(GREETING.pillRadius),
              },
            ]}
            testID="attendance-shift-pill"
          >
            <Text variant="pillLabel" align="center">
              {shiftWindow}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** The shared card shell: 1px lime border, 24 radius, yellow glow. */
function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  return (
    <View
      style={[
        styles.card,
        // The 1-unit lime stroke is centre-aligned in Figma: it overflows the 334-unit card
        // rather than making it 336. See `figmaStroke`.
        figmaStroke(scale, { width: CARD.borderWidth, padding: CARD.padding }),
        // The width is the PAINTED width, so the centred stroke is added to the frame's 334.
        // `figmaStroke`'s negative margin takes it back off the laid-out width.
        { width: s(CARD.width + CARD.borderWidth), borderRadius: s(CARD.radius), gap: s(CARD.gap) },
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/** The `px-4 py-6` wrapper every content block sits in. */
function Block({
  children,
  full = false,
  gap,
}: {
  children: React.ReactNode;
  full?: boolean;
  gap?: number;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.block,
        {
          paddingHorizontal: s(GREETING.paddingH),
          paddingVertical: s(GREETING.paddingV),
        },
        full && styles.fullWidth,
        gap !== undefined && { gap: s(gap) },
      ]}
    >
      {children}
    </View>
  );
}

/** `523:14` / `526:299` / `525:223` — the red headline. */
function Headline({ children, testID }: { children: string; testID?: string }): React.ReactElement {
  return (
    <Text variant="overline" color={color.danger} style={styles.upper} testID={testID}>
      {children}
    </Text>
  );
}

/** The lime CTA with its exported arrow. */
function LimeCta({
  label,
  onPress,
  disabled = false,
  testID,
}: {
  label: string;
  onPress?: (() => void) | undefined;
  disabled?: boolean;
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      // Android paints a ripple across the whole pressable; the design draws a flat lime pill, so
      // the ripple is suppressed rather than left to show up as a band in the diff.
      android_ripple={null}
      style={[
        styles.cta,
        {
          paddingVertical: s(CTA.paddingV),
          borderRadius: s(CTA.radius),
          gap: s(CTA.gap),
        },
        disabled && styles.ctaDisabled,
      ]}
      testID={testID}
    >
      <Text variant="actionLabel" align="center" style={styles.upper}>
        {label}
      </Text>
      <Image
        source={arrowRight}
        style={{ width: s(CTA.arrowWidth), height: s(CTA.arrowHeight) }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}

/** Shell shared by all four frames: nav, greeting, then whatever the state draws. */
function Screen({
  name,
  shiftWindow,
  onHelp,
  onProfile,
  children,
  testID,
}: {
  name: string;
  shiftWindow: string | null;
  onHelp?: (() => void) | undefined;
  onProfile?: (() => void) | undefined;
  children: React.ReactNode;
  testID: string;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { s } = useDesignScale();

  return (
    <View style={styles.screen} testID={testID}>
      <View style={{ height: insets.top }} />
      <TopNav onHelp={onHelp} onProfile={onProfile} />
      <View style={[styles.content, { padding: s(PAGE.padding), gap: s(PAGE.gap) }]}>
        <Greeting name={name} shiftWindow={shiftWindow} />
        {children}
      </View>
    </View>
  );
}

export interface DailyLogInViewProps extends GreetingProps {
  /**
   * `540:415` — the clock time the cook must press by, formatted by the caller from the server's
   * `checkInOpensAt`/shift. `null` hides the whole window row rather than inventing a deadline.
   */
  readonly markByTime: string | null;
  readonly onMarkPresent?: (() => void) | undefined;
  readonly isSubmitting?: boolean;
  readonly onHelp?: (() => void) | undefined;
  readonly onProfile?: (() => void) | undefined;
  /**
   * Whether the SERVER says this cook may check in today.
   *
   * `575:2135` only draws the eligible state, so a refusal is outside the frame. When the backend
   * withholds check-in the call to action is removed rather than drawn dead: an earlier build
   * offered it to a cook on approved leave and let the server reject the tap with a 400.
   */
  readonly canMark?: boolean;
}

/**
 * `575:2135` — 3a, daily log in.
 *
 * The card asks the question, states the window the backend enforces, and offers `PRESENT`.
 * Pressing it submits; nothing is marked locally.
 */
export function DailyLogInView({
  name,
  shiftWindow,
  markByTime,
  onMarkPresent,
  isSubmitting = false,
  onHelp,
  onProfile,
  canMark = true,
}: DailyLogInViewProps): React.ReactElement {
  const { s } = useDesignScale();

  return (
    <Screen
      name={name}
      shiftWindow={shiftWindow}
      onHelp={onHelp}
      onProfile={onProfile}
      testID="attendance-daily"
    >
      <Block>
        <Card testID="attendance-card">
          <Headline testID="attendance-headline">aaj aap kaam pai aaye hai?</Headline>

          {markByTime !== null && (
            <View
              style={[
                styles.windowRow,
                {
                  width: s(WINDOW_ROW.width),
                  paddingHorizontal: s(WINDOW_ROW.paddingH),
                  paddingVertical: s(WINDOW_ROW.paddingV),
                  borderRadius: s(WINDOW_ROW.radius),
                },
              ]}
              testID="attendance-window"
            >
              <Text variant="title" color={color.white} align="center">
                {markByTime}
              </Text>
              <Text
                variant="noteMuted"
                color={color.white}
                align="center"
                style={{ width: s(WINDOW_ROW.noteWidth) }}
              >
                se pehle tak button dabaye
              </Text>
            </View>
          )}

          <View style={[styles.markRow, { height: s(MARK_ROW.height), gap: s(MARK_ROW.gap) }]}>
            <View style={{ width: s(MARK_ROW.glyphBoxWidth), height: s(MARK_ROW.height) }}>
              <SvgXml
                xml={ellipse4}
                width={s(MARK_ROW.ellipseSize)}
                height={s(MARK_ROW.ellipseSize)}
                style={{
                  position: 'absolute',
                  left: s(MARK_ROW.ellipseLeft),
                  top: s(MARK_ROW.ellipseTop),
                }}
              />
              <Image
                source={checkedUserMale}
                style={{
                  position: 'absolute',
                  left: s(MARK_ROW.badgeLeft),
                  top: s(MARK_ROW.badgeTop),
                  width: s(MARK_ROW.badgeSize),
                  height: s(MARK_ROW.badgeSize),
                }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>
            <View style={styles.markLabel}>
              <Text variant="headingLgBold" testID="attendance-mark-label">
                Mark Present
              </Text>
            </View>
          </View>

          {canMark && (
            <LimeCta
              label="Present"
              onPress={onMarkPresent}
              disabled={isSubmitting}
              testID="attendance-mark-present"
            />
          )}
        </Card>
      </Block>
    </Screen>
  );
}

export interface VerdictViewProps extends GreetingProps {
  readonly onHelp?: (() => void) | undefined;
  readonly onProfile?: (() => void) | undefined;
}

export interface PresentViewProps extends VerdictViewProps {
  readonly onSeeWork?: (() => void) | undefined;
}

/** `575:2137` — 3b, marked present. The disc, the verdict, and `KAAM DEKHE`. */
export function PresentView({
  name,
  shiftWindow,
  onSeeWork,
  onHelp,
  onProfile,
}: PresentViewProps): React.ReactElement {
  const { s } = useDesignScale();

  return (
    <Screen
      name={name}
      shiftWindow={shiftWindow}
      onHelp={onHelp}
      onProfile={onProfile}
      testID="attendance-present"
    >
      <Block>
        <Card testID="attendance-card">
          <Headline testID="attendance-headline">aaj aap kaam pai aaye hai.</Headline>
          <View style={[styles.verdict, { gap: s(VERDICT.gap) }]}>
            <View
              style={[
                styles.disc,
                styles.discPresent,
                {
                  width: s(VERDICT.discSize),
                  height: s(VERDICT.discSize),
                  borderRadius: s(VERDICT.discSize),
                },
              ]}
              testID="attendance-verdict-disc"
            >
              <SvgXml xml={checkTick} width={s(VERDICT.tickSize)} height={s(VERDICT.tickSize)} />
            </View>
            <Text variant="headingLgBold" align="center" testID="attendance-verdict">
              Aaj ke liye PRESENT!
            </Text>
          </View>
        </Card>
      </Block>
      <Block full>
        <LimeCta label="kaam dekhe" onPress={onSeeWork} testID="attendance-see-work" />
      </Block>
    </Screen>
  );
}

/** `575:2138` — 3c, absent. Same card shell, red disc, no call to action. */
export function AbsentView({
  name,
  shiftWindow,
  onHelp,
  onProfile,
}: VerdictViewProps): React.ReactElement {
  const { s } = useDesignScale();

  return (
    <Screen
      name={name}
      shiftWindow={shiftWindow}
      onHelp={onHelp}
      onProfile={onProfile}
      testID="attendance-absent"
    >
      <Block>
        <Card testID="attendance-card">
          <Headline testID="attendance-headline">aaj aap kaam pai NAHI aaye hai.</Headline>
          <View style={[styles.verdict, { gap: s(VERDICT.gap) }]}>
            <View
              style={[
                styles.disc,
                styles.discAbsent,
                {
                  width: s(VERDICT.discSize),
                  height: s(VERDICT.discSize),
                  borderRadius: s(VERDICT.discSize),
                },
              ]}
              testID="attendance-verdict-disc"
            >
              <SvgXml xml={crossTick} width={s(VERDICT.crossSize)} height={s(VERDICT.crossSize)} />
            </View>
            <Text variant="headingLgBold" align="center" testID="attendance-verdict">
              Aaj ke liye ABSENT!
            </Text>
          </View>
        </Card>
      </Block>
    </Screen>
  );
}

/** `575:2136` — 3d, shift finished. The photograph is the exported Figma original. */
export function ShiftEndedView({
  name,
  shiftWindow,
  onHelp,
  onProfile,
}: VerdictViewProps): React.ReactElement {
  const { s } = useDesignScale();

  return (
    <Screen
      name={name}
      shiftWindow={shiftWindow}
      onHelp={onHelp}
      onProfile={onProfile}
      testID="attendance-shift-ended"
    >
      <Block gap={RESTING.gap}>
        <Image
          source={cookResting}
          style={{
            width: s(CARD.width),
            height: s(RESTING.imageHeight),
            borderRadius: s(RESTING.radius),
          }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel="Aaj ka kaam khatam"
          testID="attendance-rest-photo"
        />
        <View style={[styles.restCaption, { width: s(CARD.width) }]}>
          <Text
            variant="bodyMuted"
            color={color.black}
            align="center"
            testID="attendance-rest-caption"
          >
            Aaj ka kaam khatam ho gaya, aaram kare!
          </Text>
        </View>
      </Block>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.white,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: color.yellow400,
  },
  help: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.yellow600,
    ...dropShadow(2, 0.15),
  },
  content: { flex: 1, backgroundColor: color.white, alignItems: 'flex-start' },
  greeting: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  greetingInner: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
  shiftPill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.yellow500,
  },
  block: { alignItems: 'flex-start' },
  card: {
    alignItems: 'flex-start',
    borderColor: color.lime600,
    backgroundColor: color.white,
    ...dropShadow(30, 0.05, 8),
  },
  upper: { textTransform: 'uppercase' },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.springGreen30,
  },
  markRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  markLabel: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', alignSelf: 'stretch' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: color.lime600,
  },
  ctaDisabled: { opacity: 0.6 },
  verdict: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  discPresent: { backgroundColor: color.springGreen30 },
  discAbsent: { backgroundColor: color.dangerDisc },
  restCaption: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
