import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { SvgXml } from 'react-native-svg';

import { formatDurationHours } from '@core/domain/job';
import type { ArrivalTiming, JobSummary, TravelTiming } from '@core/domain/serviceState';
import {
  color,
  figmaStroke,
  HelpPill,
  OtpInput,
  Text,
  useDesignScale,
  type DesignScale,
} from '@ui';
import { arrivalCheck, callIcon, mapPin } from '@ui/icons/figmaV14Icons';

/**
 * The V14 `Service flow` (`485:4971`) — thirteen renderings of one booking.
 *
 * ## Why this is a new file rather than an edit of `ServiceViews.tsx`
 *
 * V14 deleted all twelve V13 service frames and rebuilt the section on a different authoring
 * convention. V13's frames were **390x830 with a decorative phone bezel** and a 36.198-unit status
 * mock; V14's are **371-wide `direct` frames** with the 32-unit `phone bar` and a 68-unit bottom
 * nav. Every measurement in the old views describes a frame that no longer exists, so the old file
 * is left in place for its still-valid state plumbing and the drawing starts again here.
 *
 * ## Six layouts, thirteen frames
 *
 * | layout | frames |
 * | --- | --- |
 * | travel | `614:453` on time, `622:597` at risk, `622:530` late |
 * | travel cancelled | `622:913` |
 * | arrival | `622:664` on time, `622:733` late |
 * | start OTP | `622:801` |
 * | cooking | `622:1036` hours, `622:1085` minutes, `622:1125` ending, `622:1163` extension |
 * | end | `628:1249` end OTP, `628:1293` completed |
 *
 * Every body is `p-16` with a **21-unit gap** — except `628:1293`, which sets 16. Both are
 * measured from child positions in the committed canvas dump rather than assumed.
 *
 * ## Nothing here decides anything
 *
 * These are presentational. Timing tiers, OTP eligibility, the countdown and the extension window
 * all arrive as props from `projectServiceState`, which derives them from server data. A view can
 * change a colour; it can never change what the booking is.
 */

/** `614:429` — the top nav. Titled `Active job`, at 24/30 rather than the leave section's 20/28. */
const NAV = { height: 47, paddingH: 16, innerPaddingH: 4, titleWidth: 179 } as const;

/** `462:3620` — the scrolling body. */
const BODY = { padding: 16, gap: 21, endGap: 16 } as const;

/** The `px-4 py-6` wrapper every block sits in. */
const BLOCK = { paddingH: 4, paddingV: 6 } as const;

/** `464:3856` — the travel status banner: illustration beside a headline and a countdown. */
const TRAVEL = {
  artWidth: 112,
  artHeight: 150,
  gap: 10,
  columnWidth: 206,
  headlineRadius: 15,
  headlinePaddingH: 12,
  headlinePaddingV: 8,
  countdownHeight: 103,
  countdownRadius: 15,
  lateBorderWidth: 1.5,
} as const;

/**
 * `1:10172` / `1:10712` — the arrival banner. The travel banner's layout: the cook's photo beside a
 * headline pill over a tick (on time) or the minutes late.
 */
const ARRIVAL = {
  /** `1:10173` — the cook photo, the travel banner's 112 x 150 box. */
  artWidth: 112,
  artHeight: 150,
  gap: 10,
  columnWidth: 206,
  /** `1:10175` — the headline pill: 20/28 in `px-12 py-8`, 44 tall. */
  headlineRadius: 15,
  headlinePaddingH: 12,
  headlinePaddingV: 8,
  /** `1:10177` — the on-time tick: a 100 disc of `#cfff04`, the 90 glyph inset 5. */
  tickDisc: 100,
  tickGlyph: 90,
  /** `1:10717` / `1:10719` — the late box: 103 tall, a `#ffd7d7` fill inset `px-12 py-8`. */
  lateHeight: 103,
  lateRadius: 15,
  latePaddingH: 12,
  latePaddingV: 8,
} as const;

/** `468:4045` — `Pahauch gaye`. */
const ARRIVED_CTA = { radius: 15, paddingH: 12, paddingV: 6, gap: 12, glyph: 40 } as const;

/** `462:3579` — the customer card. */
const DETAILS = {
  width: 332,
  radius: 24,
  padding: 12,
  gap: 16,
  borderWidth: 1,
  actionHeight: 35,
  actionRadius: 15,
  actionPaddingH: 12,
  actionPaddingV: 6,
  actionGap: 8,
  /** `462:3596` — the gutter between the grid's two columns. */
  actionColumnGap: 10,
  actionGlyph: 16,
  addressPaddingH: 12,
  addressPaddingV: 8,
  addressGap: 16,
  /*
   * 30, not the frame's 25. The address line is 18px Livvic and the row is a FIXED height, so
   * widening the line alone would have moved the crop one level up and changed nothing on screen.
   * A cook reads a street address off this row; it is the last thing that should lose its
   * descenders, and "Gurgaon" has two.
   */
  addressRowHeight: 30,
  addressRowGap: 12,
  addressIcon: 25,
  durationRadius: 5,
  durationPaddingH: 11.889,
  durationPaddingV: 3.889,
} as const;

/** `476:4234` — the OTP block. Absolutely composed, so the numbers are positions not paddings. */
const OTP_BLOCK = {
  width: 330,
  height: 152,
  bodyTop: 20,
  bodyWidth: 320,
  bodyHeight: 130,
  bodyRadius: 20,
  labelLeft: 16,
  labelTop: 73,
  labelWidth: 129,
  gridLeft: 160,
  gridTop: 36,
  gridWidth: 148,
  gridHeight: 74,
  pillLeft: 38,
  pillWidth: 254,
  pillHeight: 40,
  pillRadius: 26,
} as const;

/** `473:4192` — the promo block under the OTP. */
/**
 * `473:4193`, `628:1252`, `485:4930` — the promo art blocks.
 *
 * All three are `Frame 50`, all three are **314** wide, and only the height changes: 217 on
 * `622:801`, 245 on `628:1249`, 336 on `628:1293`.
 */
/**
 * `485:4929` — the celebration block on `628:1293`.
 *
 * `width` and `height` are both the design's own fixed numbers, and `justifyContent: 'center'`
 * is what they are for: 63 + 50 + 336 is 449 units of content inside a 535-unit box, so the
 * design leaves 43 units of white above the headline and 43 below the art. Letting the block size
 * itself removed both, which lifted the headline, the artwork and the CTA about sixty units up
 * the screen and left the slack in one lump above the bottom nav instead.
 */
const PROMO = {
  gap: 6,
  /** `485:4929` — the End block's own gap between headline and art. NOT `PromoBlock`'s. */
  completedGap: 50,
  paddingH: 12,
  paddingV: 6,
  radius: 20,
  width: 338,
  height: 535,
  // The headline wraps to two 40-unit lines. 63 clipped the second line and its descenders on
  // Android, so the fixed promo slot must hold the complete text block.
  headlineHeight: 84,
  artWidth: 314,
} as const;

/**
 * `622:1022` — the cancelled-booking art.
 *
 * Every art box in this file states its size in NUMBERS rather than filling its parent with
 * `StyleSheet.absoluteFill`. That was the original port of the design's `absolute inset-0`, and on
 * this Fabric build it does not measure: the celebration art on `628:1293` rendered at roughly
 * four times its box and overflowed it, and this one drew behind the CTA and the customer card.
 * The same failure blanked all five bottom-nav glyphs. An absolutely-positioned child leaves
 * nothing in the box's flow, and what the box then measures to is not the design's.
 */
const CANCEL_ART = { width: 328, height: 214 } as const;

/** `622:1023` — the cancelled banner's caption box, and its gap from the art above it. */
const CANCEL_BANNER = {
  /** `622:1022` ends at 214 and `622:1023` starts at 220. */
  gap: 6,
  captionWidth: 326,
  captionHeight: 70,
  /** The text is at y=14 in a 70-unit box holding a 28-unit line: 14 above, 28 below. */
  captionTop: 14,
} as const;

/** `485:4930` — the celebration art on `628:1293`, the tallest of the three `Frame 50`s. */
const COMPLETED_ART_HEIGHT = 336;

/** `479:4353` — the cooking card. */
const COOK = {
  cardWidth: 330,
  cardRadius: 24,
  cardPadding: 12,
  cardGap: 16,
  headingPaddingV: 6,
  timerHeight: 178,
  timerRadius: 15,
  timerPadding: 12,
  cellRadius: 15,
  cellPaddingH: 6,
  cellPaddingV: 12,
  cellGap: 12,
  hoursColumn: 104,
  /** `628:1228` — the extension row, present only on `622:1163`. */
  extensionGap: 16,
  extensionPaddingV: 12,
  extensionArt: 122,
  extensionArtHeight: 123,
  extensionColumn: 168,
  extensionColumnGap: 10,
  extensionChipRadius: 15,
  extensionChipPaddingH: 12,
  extensionChipPaddingV: 8,
  extensionLabelWidth: 147,
  extensionValueWidth: 156,
  bannerGap: 10,
} as const;

/** `628:1338` — `Kaam dekhe`. */
const DONE_CTA = { radius: 20, paddingV: 10, gap: 12, arrowW: 51, arrowH: 49 } as const;

const art = {
  travelOnTime: require('@/assets/images/figma-v14/cook-walking.png') as ImageSourcePropType,
  travelLate: require('@/assets/images/figma-v14/travel-late.png') as ImageSourcePropType,
  arrivalOnTime: require('@/assets/images/figma-v14/arrival-on-time.png') as ImageSourcePropType,
  arrivalLate: require('@/assets/images/figma-v14/arrival-late.png') as ImageSourcePropType,
  cancelled: require('@/assets/images/figma-v14/cancel-art.png') as ImageSourcePropType,
  startJob: require('@/assets/images/figma-v14/start-job-art.png') as ImageSourcePropType,
  reset: require('@/assets/images/figma-v14/reset-icon.png') as ImageSourcePropType,
  endOtp: require('@/assets/images/figma-v14/end-otp-art.png') as ImageSourcePropType,
  completed: require('@/assets/images/figma-v14/end-art.png') as ImageSourcePropType,
  extensionClock: require('@/assets/images/figma-v14/extension-clock.png') as ImageSourcePropType,
  done: require('@/assets/images/figma-v14/done-icon.png') as ImageSourcePropType,
  camera: require('@/assets/images/figma-v14/camera.png') as ImageSourcePropType,
  arrow: require('@/assets/images/figma-v14/arrow-right.png') as ImageSourcePropType,

  building: require('@/assets/images/figma-v14/city-buildings.png') as ImageSourcePropType,
  tower: require('@/assets/images/figma-v14/building-icon.png') as ImageSourcePropType,
  floor: require('@/assets/images/figma-v14/stairs-up.png') as ImageSourcePropType,
  flat: require('@/assets/images/figma-v14/home-page.png') as ImageSourcePropType,
};

/**
 * Travel copy and colourway per server timing.
 *
 * `at_risk` and `late` share an illustration (verified: the two exports are byte-identical) and
 * differ in headline, fill and whether the countdown card is outlined.
 */
const TRAVEL_TIER: Readonly<
  Record<
    TravelTiming,
    {
      readonly headline: string;
      readonly art: ImageSourcePropType;
      readonly fill: string;
      readonly countdownColor: string;
      readonly outlined: boolean;
    }
  >
> = {
  on_time: {
    headline: 'Location ki duri',
    art: art.travelOnTime,
    fill: color.lime300,
    countdownColor: color.black,
    outlined: false,
  },
  // `1:10873` — full lime, red figure.
  at_risk: {
    headline: 'LATE ho raha hai',
    art: art.travelLate,
    fill: color.lime600,
    countdownColor: color.danger,
    outlined: false,
  },
  // `1:10796` — solid red, white figure, no outline.
  late: {
    headline: 'Aap LATE hai!',
    art: art.travelLate,
    fill: color.danger,
    countdownColor: color.white,
    outlined: false,
  },
};

const ARRIVAL_HEADLINE: Readonly<Record<ArrivalTiming, string>> = {
  on_time: 'Time par!',
  late: 'LATE',
};

const ARRIVAL_ART: Readonly<Record<ArrivalTiming, ImageSourcePropType>> = {
  on_time: art.arrivalOnTime,
  late: art.arrivalLate,
};

/* ------------------------------------------------------------------ shell --- */

/**
 * How far the open keyboard reaches up into the shell's content area, in dp. 0 while it is shut.
 *
 * The activity declares `adjustResize`, but under Android's edge-to-edge the window is no longer
 * resized for the keyboard: it is simply drawn over the screen. On the Start / End job screens that
 * hid the code tiles AND the fixed `Start` / `End` button the moment a cook tapped a tile to type,
 * and nothing scrolled (founder, 2026-09-30). The shell therefore measures the overlap itself and
 * lifts its footer and its scroll room by exactly that much.
 */
function useKeyboardOverlap(content: React.RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    // `did`-events: Android reports only these. `screenY` is the keyboard's top edge in dp.
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      content.current?.measureInWindow((_x, y, _width, height) => {
        setOverlap(Math.max(0, y + height - keyboardTop));
      });
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      setOverlap(0);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [content]);
  return overlap;
}

function ServiceShell({
  children,
  footer,
  gap = BODY.gap,
  onHelp,
  testID,
  title = 'Active job',
  onMeasure,
  footerPaddingBottom = 21,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Space under the fixed footer. The `1:10313` family's button area is `p-24` all round. */
  footerPaddingBottom?: number;
  /** Reports the height under the nav and the fixed footer's height, for a screen that must fit. */
  onMeasure?: ((contentHeight: number, footerHeight: number) => void) | undefined;
  gap?: number;
  onHelp?: (() => void) | undefined;
  testID?: string;
  /**
   * The nav title. `Active job` on twelve of the thirteen Service frames, and `Jaankari` on
   * `622:913` — read out of the reference renders rather than the layer names, which are stale in
   * this file (`628:1316` is NAMED `Serving at` and READS `Active job`).
   */
  title?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  const contentHeight = useRef(0);
  const footerHeight = useRef(0);
  const content = useRef<View | null>(null);
  const scroll = useRef<ScrollView | null>(null);
  const keyboardOverlap = useKeyboardOverlap(content);

  /*
   * Once the room is there, bring the end of the screen into view. On every screen that types
   * into a field -- the Start and End job tiles -- the field is the last thing on it, so the end
   * is where the cook's eyes need to be, right above the lifted button.
   */
  useEffect(() => {
    if (keyboardOverlap <= 0) return;
    const handle = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(handle);
  }, [keyboardOverlap]);

  return (
    <View style={styles.screen} testID={testID}>
      <View
        style={[
          styles.nav,
          { height: s(NAV.height), paddingHorizontal: s(NAV.paddingH + NAV.innerPaddingH) },
        ]}
      >
        <View style={{ width: s(NAV.titleWidth) }}>
          <Text variant="screenTitle" color={color.black} testID="service-nav-title">
            {title}
          </Text>
        </View>
        <HelpPill onPress={onHelp} testID="service-nav-help" />
      </View>
      <View
        ref={content}
        style={styles.shellContent}
        onLayout={(event) => {
          contentHeight.current = event.nativeEvent.layout.height;
          onMeasure?.(contentHeight.current, footerHeight.current);
        }}
      >
        <ScrollView
          ref={scroll}
          // A tap on `Start` / `End` with the keyboard up must press the button, not just close it.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.body,
            {
              padding: s(BODY.padding),
              gap: s(gap),
              paddingBottom: (footer === undefined ? s(BODY.padding) : s(100)) + keyboardOverlap,
            },
          ]}
          testID="service-scroll"
        >
          {children}
        </ScrollView>
        {footer !== undefined && (
          <View
            style={[
              styles.fixedFooter,
              { paddingBottom: s(footerPaddingBottom), bottom: keyboardOverlap },
            ]}
            onLayout={(event) => {
              footerHeight.current = event.nativeEvent.layout.height;
              onMeasure?.(contentHeight.current, footerHeight.current);
            }}
          >
            {footer}
          </View>
        )}
      </View>
    </View>
  );
}

function Block({
  children,
  paddingV = BLOCK.paddingV,
}: {
  children: React.ReactNode;
  paddingV?: number;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[styles.block, { paddingHorizontal: s(BLOCK.paddingH), paddingVertical: s(paddingV) }]}
    >
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- details --- */

/** `462:3579` — the address, the customer and the two actions. */
function UserDetailsCard({
  job,
  onMap,
  onCall,
  callError = null,
  showCall = true,
  showMap = true,
}: {
  job: JobSummary;
  onMap?: (() => void) | undefined;
  onCall?: (() => void) | undefined;
  /**
   * Why a failed "Call kare" is drawn HERE rather than raised as an alert.
   *
   * FIGMA_PENDING -- no frame draws a failed call. A cook is usually at a gate with one hand free
   * when she presses it, so a modal she must dismiss is the wrong shape: this caption sits under
   * the button that failed and leaves the rest of the screen, the arrival CTA included, reachable.
   * It renders nothing until something fails, so no frame's normal state changes.
   */
  callError?: string | null;
  showCall?: boolean;
  /**
   * `622:913` draws the card WITHOUT `Map dekhe`, which is why this exists alongside `showCall`.
   * The booking is cancelled: there is nowhere left to navigate to, and the design's own card is
   * 230 units tall there against 332 everywhere else — the difference is this row.
   */
  showMap?: boolean;
}): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  /*
   * TWO rows, because an address in this product has two parts.
   *
   * The frame draws four -- building, tower, floor, flat -- and it is a mock with a placeholder in
   * every one. The customer's own form (`60:655`) collects a flat and ONE combined
   * "Building/ Tower name or Plot no.", stored as the society. There is no separate tower field
   * and no floor field anywhere in the product, so two of the four rows could only ever render as
   * an icon with nothing beside it, on every job.
   *
   * Collapsed rather than filtered. A four-row list that usually drops two is still a card built
   * around data that does not exist; two rows is what the address IS.
   *
   * `tower` is appended rather than discarded. The column exists and Ops can populate it, and the
   * customer's field is named "Building/ Tower name" -- so when both are present they are one
   * line, and nothing a human typed is silently thrown away.
   */
  const buildingLine = [job.address.buildingName, job.address.towerOrBlock]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(', ');
  const flatLine = job.address.flatOrHouse?.trim() ?? '';
  const rows = (
    [
      { icon: art.building, text: buildingLine },
      { icon: art.flat, text: flatLine },
    ] as readonly { icon: ImageSourcePropType; text: string }[]
  ).filter((row) => row.text !== '');

  return (
    <Block>
      <View
        style={[
          styles.detailsCard,
          figmaStroke(scale, { width: DETAILS.borderWidth, padding: DETAILS.padding }),
          { width: s(DETAILS.width), borderRadius: s(DETAILS.radius), gap: s(DETAILS.gap) },
        ]}
        testID="service-details"
      >
        {showMap && (
          <ActionButton
            label="Map dekhe"
            glyph={mapPin}
            fill={color.lime600}
            onPress={onMap}
            scale={scale}
            testID="service-map"
          />
        )}

        <View
          style={[
            styles.address,
            {
              paddingHorizontal: s(DETAILS.addressPaddingH),
              paddingVertical: s(DETAILS.addressPaddingV),
              gap: s(DETAILS.addressGap),
            },
          ]}
          testID="service-details-rows"
        >
          {rows.map((row, index) => (
            <View
              key={index}
              style={[
                styles.addressRow,
                { height: s(DETAILS.addressRowHeight), gap: s(DETAILS.addressRowGap) },
              ]}
            >
              <Image
                source={row.icon}
                style={{ width: s(DETAILS.addressIcon), height: s(DETAILS.addressIcon) }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              {/* A missing line renders as nothing rather than as a placeholder a cook might act on. */}
              <Text variant="addressLine" color={color.black} style={styles.flexOne}>
                {row.text ?? ''}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.customerRow}>
          <Text variant="title" style={styles.flexOne} testID="service-customer">
            {job.address.customerName ?? ''}
          </Text>
          <View
            style={[
              styles.durationChip,
              {
                borderRadius: s(DETAILS.durationRadius),
                paddingHorizontal: s(DETAILS.durationPaddingH),
                paddingVertical: s(DETAILS.durationPaddingV),
              },
            ]}
          >
            <Text variant="durationChip">{formatDurationHours(job.serviceDurationMinutes)}</Text>
          </View>
        </View>

        {showCall && (
          <ActionButton
            label="Call kare"
            glyph={callIcon}
            fill={color.lime400}
            onPress={onCall}
            scale={scale}
            testID="service-call"
          />
        )}
        {showCall && callError !== null && (
          <Text variant="caption" color={color.danger} testID="service-call-error">
            {callError}
          </Text>
        )}
      </View>
    </Block>
  );
}

/**
 * `462:3597` / `614:405` — one of the two half-width actions.
 *
 * Each sits in a two-column grid occupying only column one, so the button is half the card's
 * inner width rather than full-width.
 */
function ActionButton({
  label,
  glyph,
  fill,
  onPress,
  scale,
  testID,
}: {
  label: string;
  /**
   * Inlined SVG markup, NOT an image source.
   *
   * `map-pin.svg` and `call-icon.svg` were `require()`d and handed to an `<Image>`, which cannot
   * decode an SVG on Android — both buttons drew their label with an empty space where the glyph
   * belongs, on every Service frame that has them.
   */
  glyph: string;
  fill: string;
  onPress?: (() => void) | undefined;
  scale: DesignScale;
  testID: string;
}): React.ReactElement {
  const { s } = scale;
  return (
    /*
     * A two-column grid with the button in column ONE, and an empty column two.
     *
     * `462:3596` and `614:400` are `grid-cols-[repeat(2,minmax(0,1fr))]` holding a single
     * `justify-self-stretch` child, so each button is half the card's inner width less half the
     * 10-unit gutter — 148 units, which is what the reference draws. The app gave the button
     * `flex: 1` in a plain row, so both actions spanned the full 306-unit card on all eleven
     * Service frames that draw them. The spacer reproduces the empty cell rather than hardcoding
     * 148, so the halves stay halves if the card is ever resized.
     */
    <View style={[styles.actionGrid, { columnGap: s(DETAILS.actionColumnGap) }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[
          styles.action,
          {
            backgroundColor: fill,
            height: s(DETAILS.actionHeight),
            borderRadius: s(DETAILS.actionRadius),
            paddingHorizontal: s(DETAILS.actionPaddingH),
            paddingVertical: s(DETAILS.actionPaddingV),
            gap: s(DETAILS.actionGap),
          },
        ]}
        testID={testID}
      >
        <SvgXml xml={glyph} width={s(DETAILS.actionGlyph)} height={s(DETAILS.actionGlyph)} />
        <Text variant="actionChip" color={color.black} align="center">
          {label}
        </Text>
      </Pressable>
      <View style={styles.flexOne} />
    </View>
  );
}

/* ----------------------------------------------------------------- travel --- */

export interface TravelViewProps {
  readonly job: JobSummary;
  readonly timing: TravelTiming;
  /** Server-computed. NEGATIVE past the deadline — `622:538` draws `-6 mins`. Never clamped. */
  readonly minutesToDeadline: number;
  /**
   * `ETA_running` — the cook's TRAVEL time to the gate, which is what "Location ki duri" says.
   *
   * Preferred over `minutesToDeadline` whenever the server has one. The two are different
   * questions and were being confused: a countdown to the service time falls whether or not the
   * cook moves, and goes negative once it passes, so a cook standing still watched "13 mins"
   * become "-1" without having gone anywhere. Her distance had not changed at all.
   *
   * `null` when the server has no usable ETA. The card then shows `--` rather than substituting the
   * booking deadline, because that is a different measurement.
   */
  readonly minutesToArrival?: number | null | undefined;
  readonly onMap?: (() => void) | undefined;
  readonly onCall?: (() => void) | undefined;
  readonly callError?: string | null;
  readonly onArrived?: (() => void) | undefined;
  /** Server permission: fresh accepted evidence is within the 75 m gate radius. */
  readonly canMarkArrived?: boolean;
  readonly isSubmitting?: boolean;
  readonly onHelp?: (() => void) | undefined;
}

/**
 * `468:4045` — "Pahauch gaye", the arrival CTA.
 *
 * Drawn on the TRAVEL frames as well as the arrival one. All four travel frames in `707:435`
 * carry it at the same geometry. This product flow makes it the handoff from travel to the next
 * server state, so it is fixed above the bottom nav and remains available while the cook travels.
 *
 * ## What actually enables it
 *
 * The flow document says "enabled when the cook's `ETA_running` < 1 min". The BACKEND refuses a
 * manual arrival unless it has a fresh position within `TRACKING_GATE_ARRIVAL_RADIUS_METERS`
 * (75 m) of the gate -- `ARRIVAL_PROXIMITY_NOT_CONFIRMED`. Those are not the same rule, and an ETA
 * of one minute is not a guarantee of being inside 75 m: enabling on the ETA would hand the cook a
 * button that errors when she presses it.
 *
 * The route wires this control to the same proximity-validated fallback command used by the
 * arrival screen. The backend publishes `commandEligibility.markArrived` from that evidence, so
 * the button is visibly disabled until the server has a fresh accepted sample within 75 m. The
 * command remains evidence-checked on the write path as well.
 */
function ArrivedCta({
  onPress,
  disabled = false,
  testID,
}: {
  readonly onPress?: (() => void) | undefined;
  readonly disabled?: boolean;
  readonly testID: string;
}): React.ReactElement {
  const { s } = useDesignScale();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      // Announced rather than left for the cook to work out from the colour alone.
      accessibilityHint={disabled ? 'Location par pahauchne ke baad chalu hoga' : undefined}
      disabled={disabled}
      {...(disabled || onPress === undefined ? {} : { onPress })}
      style={[
        styles.arrivedCta,
        disabled ? styles.arrivedCtaDisabled : null,
        {
          borderRadius: s(ARRIVED_CTA.radius),
          paddingHorizontal: s(ARRIVED_CTA.paddingH),
          paddingVertical: s(ARRIVED_CTA.paddingV),
          gap: s(ARRIVED_CTA.gap),
        },
      ]}
      testID={testID}
    >
      <Image
        source={art.done}
        style={{ width: s(ARRIVED_CTA.glyph), height: s(ARRIVED_CTA.glyph) }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text variant="cardCountdown" color={color.black} align="center">
        Pahauch gaye
      </Text>
    </Pressable>
  );
}

/** `614:453` / `622:597` / `622:530`. */
export function TravelView({
  job,
  timing,
  minutesToDeadline,
  minutesToArrival,
  onMap,
  onCall,
  callError = null,
  onArrived,
  canMarkArrived = false,
  isSubmitting = false,
  onHelp,
}: TravelViewProps): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const tier = TRAVEL_TIER[timing];
  /*
   * The travel time, or nothing — never the deadline countdown in its place.
   *
   * This used to fall back to `minutesToDeadline`, and the two are different quantities under one
   * label. On 2026-09-02 a cook opened an 08:30 job at 07:32 before the first ETA had been
   * computed: the card showed "57 mins", which was the time until her BOOKING, and three seconds
   * later the real ETA arrived at one minute. The number collapsed by an hour and read as broken.
   *
   * It was not broken, and that is the point — a card labelled "Location ki duri" that silently
   * swaps in a different measurement cannot be read at all. With no ETA the honest answer is that
   * we do not know yet, and `--` says so.
   *
   * `minutesToDeadline` stays on the props: it is still the right number for a screen that asks
   * how long until the booking, and removing it would only push this confusion somewhere else.
   */
  const shown =
    minutesToArrival === null || minutesToArrival === undefined ? null : minutesToArrival;

  return (
    <ServiceShell
      onHelp={onHelp}
      footer={
        <Block>
          <ArrivedCta
            onPress={onArrived}
            disabled={isSubmitting || onArrived === undefined || !canMarkArrived}
            testID="service-travel-arrived"
          />
        </Block>
      }
      testID={`service-travel-${timing}`}
    >
      <Block>
        <View style={[styles.travelBanner, { gap: s(TRAVEL.gap) }]}>
          {/*
           * The photograph fills the box; the box's 10-unit padding does NOT indent it.
           *
           * `464:3858` writes the image as `absolute inset-0 size-full`, which in the design
           * covers the padding as well. Laying it out as a padded child instead started it ten
           * units in and ten units down on every travel frame, so the cook walked out of her own
           * frame — and because the box is fixed at 112x150 the overflow was invisible in review.
           */}
          <View style={{ width: s(TRAVEL.artWidth), height: s(TRAVEL.artHeight) }}>
            <Image
              source={tier.art}
              style={{ width: s(TRAVEL.artWidth), height: s(TRAVEL.artHeight) }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <View
            style={[
              styles.travelColumn,
              { width: s(TRAVEL.columnWidth), height: s(TRAVEL.artHeight) },
            ]}
          >
            <View
              style={[
                styles.travelHeadline,
                {
                  borderRadius: s(TRAVEL.headlineRadius),
                  paddingHorizontal: s(TRAVEL.headlinePaddingH),
                  paddingVertical: s(TRAVEL.headlinePaddingV),
                },
              ]}
            >
              <Text variant="travelPill" color={color.black} align="center">
                {tier.headline}
              </Text>
            </View>
            <View
              style={[
                styles.travelCountdown,
                tier.outlined
                  ? figmaStroke(scale, {
                      width: TRAVEL.lateBorderWidth,
                      paddingH: TRAVEL.headlinePaddingH,
                      paddingV: TRAVEL.headlinePaddingV,
                    })
                  : {
                      paddingHorizontal: s(TRAVEL.headlinePaddingH),
                      paddingVertical: s(TRAVEL.headlinePaddingV),
                    },
                {
                  height: s(TRAVEL.countdownHeight),
                  borderRadius: s(TRAVEL.countdownRadius),
                  backgroundColor: tier.fill,
                  ...(tier.outlined ? { borderColor: color.danger } : {}),
                },
              ]}
            >
              <Text
                variant="travelCountdown"
                color={tier.countdownColor}
                align="center"
                testID="service-travel-countdown"
              >
                {shown === null ? '--' : `${shown} mins`}
              </Text>
            </View>
          </View>
        </View>
      </Block>
      <UserDetailsCard job={job} onMap={onMap} onCall={onCall} callError={callError} />
    </ServiceShell>
  );
}

/**
 * `1:10098` — the booking was cancelled while the cook was on the way. Titled `Active job` like
 * every other Service frame; the old `622:913` titled it `Jaankari`.
 */
export function TravelCancelledView({
  job,
  onSeeJobs,
  onMap,
  onHelp,
}: {
  job: JobSummary;
  onSeeJobs?: (() => void) | undefined;
  onMap?: (() => void) | undefined;
  onHelp?: (() => void) | undefined;
}): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  return (
    <ServiceShell onHelp={onHelp} testID="service-travel-cancelled">
      <Block>
        {/*
         * `622:1022` sits 6 units above `622:1023`, and the caption is at y=14 inside that
         * 70-unit box, NOT centred in it: 14 above the line and 28 below.
         *
         * Drawn flush and centred, the two errors cancelled on the caption — 0 + 21 lands within
         * a unit of the design's 6 + 14 — and then took the whole `Kaam dekhe` CTA six units up
         * the screen, because the box's own bottom slack fell from 28 to 21. The headline
         * residual stayed under the rule the entire time; only the displacement probe showed it.
         */}
        <View style={[styles.cancelBanner, { gap: s(CANCEL_BANNER.gap) }]}>
          <View style={{ width: s(CANCEL_ART.width), height: s(CANCEL_ART.height) }}>
            <Image
              source={art.cancelled}
              style={{ width: s(CANCEL_ART.width), height: s(CANCEL_ART.height) }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <View
            style={{
              width: s(CANCEL_BANNER.captionWidth),
              height: s(CANCEL_BANNER.captionHeight),
              paddingTop: s(CANCEL_BANNER.captionTop),
            }}
          >
            <Text variant="travelHeadline" color={color.black} align="center">
              Sorry, ye job CANCEL ho gayi hai
            </Text>
          </View>
        </View>
      </Block>
      <Block>
        <DoneButton
          label="Kaam dekhe"
          onPress={onSeeJobs}
          scale={scale}
          testID="service-see-jobs"
        />
      </Block>
      {/*
       * The cancelled frame drops BOTH actions. There is no longer a customer to ring, and
       * nowhere to navigate to — `622:923` draws neither row, which is why its card is 230 units
       * tall where every other Service frame's is 332.
       */}
      <UserDetailsCard job={job} showCall={false} showMap={false} />
    </ServiceShell>
  );
}

/* ---------------------------------------------------------------- arrival --- */

/**
 * `1:10162` (on time) / `1:10702` (late) — shown once she has pressed `Pahauch gaye`.
 *
 * No CTA yet: the way on to the Start OTP is still to be designed (founder, 2026-09-29).
 */
export function ArrivalView({
  job,
  timing,
  lateByMinutes = null,
  onMap,
  onCall,
  callError = null,
  onHelp,
  onTakeSelfie,
}: {
  job: JobSummary;
  timing: ArrivalTiming;
  /** Minutes late at the gate, from the server's arrival record. */
  lateByMinutes?: number | null;
  onMap?: (() => void) | undefined;
  onCall?: (() => void) | undefined;
  callError?: string | null;
  onHelp?: (() => void) | undefined;
  /** `308:1408` — `Aage`, which opens the arrival selfie (`1:10236`). */
  onTakeSelfie?: (() => void) | undefined;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <ServiceShell
      onHelp={onHelp}
      testID={`service-arrival-${timing}`}
      {...(onTakeSelfie === undefined
        ? {}
        : {
            footerPaddingBottom: 0,
            footer: (
              <JobActionFooter
                label="Aage"
                onPress={onTakeSelfie}
                disabled={false}
                testID="service-arrival-selfie"
              />
            ),
          })}
    >
      <Block>
        <View style={[styles.travelBanner, { gap: s(ARRIVAL.gap) }]}>
          {/* `1:10173` is `absolute inset-0 object-cover` over the 112 x 150 box. */}
          <View style={{ width: s(ARRIVAL.artWidth), height: s(ARRIVAL.artHeight) }}>
            <Image
              source={ARRIVAL_ART[timing]}
              style={{ width: s(ARRIVAL.artWidth), height: s(ARRIVAL.artHeight) }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
          <View
            style={[
              styles.arrivalColumn,
              { width: s(ARRIVAL.columnWidth), height: s(ARRIVAL.artHeight) },
            ]}
          >
            <View
              style={[
                styles.travelHeadline,
                {
                  borderRadius: s(ARRIVAL.headlineRadius),
                  paddingHorizontal: s(ARRIVAL.headlinePaddingH),
                  paddingVertical: s(ARRIVAL.headlinePaddingV),
                },
              ]}
            >
              <Text
                variant="travelHeadline"
                color={color.black}
                align="center"
                testID="service-arrival-headline"
              >
                {ARRIVAL_HEADLINE[timing]}
              </Text>
            </View>
            {timing === 'on_time' ? (
              <View
                style={[
                  styles.arrivalTick,
                  {
                    width: s(ARRIVAL.tickDisc),
                    height: s(ARRIVAL.tickDisc),
                    borderRadius: s(ARRIVAL.tickDisc / 2),
                  },
                ]}
                testID="service-arrival-tick"
              >
                <SvgXml
                  xml={arrivalCheck}
                  width={s(ARRIVAL.tickGlyph)}
                  height={s(ARRIVAL.tickGlyph)}
                />
              </View>
            ) : (
              <View
                style={[
                  styles.arrivalLate,
                  {
                    height: s(ARRIVAL.lateHeight),
                    paddingHorizontal: s(ARRIVAL.latePaddingH),
                    paddingVertical: s(ARRIVAL.latePaddingV),
                  },
                ]}
              >
                <View style={[styles.arrivalLateFill, { borderRadius: s(ARRIVAL.lateRadius) }]}>
                  <Text
                    variant="travelCountdown"
                    color={color.black}
                    align="center"
                    testID="service-arrival-late-by"
                  >
                    {lateByMinutes === null ? '--' : `${lateByMinutes} mins`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Block>
      <UserDetailsCard job={job} onMap={onMap} onCall={onCall} callError={callError} />
    </ServiceShell>
  );
}

/* --------------------------------------------------------------- selfie --- */

/**
 * `1:10247` — the camera box: 483 tall, `rounded-24`, a 1-unit black edge. `308:1611` — the
 * shutter under it, an 80-unit disc with the 40-unit camera glyph.
 */
const SELFIE = {
  boxHeight: 483,
  boxRadius: 24,
  boxBorder: 1,
  shutter: 80,
  shutterGlyph: 40,
} as const;

/** `309:1640` — the fixed button area under the selfie preview: `p-24`, `gap-24`. */
const JOB_FOOTER = { padding: 24, gap: 24 } as const;

/**
 * `297:1261` — the `Start` / `End` button area. The frame pads it 24 all round; on the handset
 * that stacked 48 units of white on top of the nav bar and hid too much of the screen (founder,
 * 2026-09-30), so it is tightened to 16 at the sides and 8 above and below.
 */
const JOB_ACTION = { paddingH: 16, paddingV: 8 } as const;

/** `1:10323` — the Start job photo: 314 x 278, `rounded-20`, in a `px-12 py-6` block. */
const START_JOB_ART = { width: 314, height: 278, radius: 20, paddingH: 12, paddingV: 6 } as const;

/** `308:1412` — the job OTP block: title over the tiles, 10 apart, in a `px-4 py-6` block. */
const JOB_OTP = { gap: 10, rowPaddingV: 8 } as const;

/** `1:10285` — the confirmation: tick disc over the headline, 21 apart. */
const SELFIE_DONE = { gap: 21, tickDisc: 100, tickGlyph: 90 } as const;

/**
 * `1:10249` — the lime `Photo` button, the same control as `Pahauch gaye` with a camera glyph.
 */
function LimeCta({
  glyph,
  label,
  onPress,
  disabled = false,
  fill,
  testID,
}: {
  /** Omitted on the job buttons (`297:1262`), which carry the label alone. */
  readonly glyph?: ImageSourcePropType | undefined;
  /** `309:1641` — Retake is `#ffe666`; everything else is the lime default. */
  readonly fill?: string | undefined;
  readonly label: string;
  readonly onPress?: (() => void) | undefined;
  readonly disabled?: boolean;
  readonly testID: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      {...(disabled || onPress === undefined ? {} : { onPress })}
      style={[
        styles.arrivedCta,
        disabled
          ? styles.arrivedCtaDisabled
          : fill === undefined
            ? null
            : { backgroundColor: fill },
        {
          borderRadius: s(ARRIVED_CTA.radius),
          paddingHorizontal: s(ARRIVED_CTA.paddingH),
          paddingVertical: s(ARRIVED_CTA.paddingV),
          gap: s(ARRIVED_CTA.gap),
        },
      ]}
      testID={testID}
    >
      {glyph === undefined ? null : (
        <Image
          source={glyph}
          style={{ width: s(ARRIVED_CTA.glyph), height: s(ARRIVED_CTA.glyph) }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      )}
      <Text variant="cardCountdown" color={color.black} align="center">
        {label}
      </Text>
    </Pressable>
  );
}

export interface CapturedPhoto {
  readonly uri: string;
  readonly mimeType: string;
}

/**
 * `1:10236` — the arrival selfie.
 *
 * The front camera opens with the screen; `Photo` takes the picture. Retake is not drawn in the
 * frame (founder, 2026-09-29: required, retake allowed), so once a photo is taken the same box
 * shows it and the button row becomes `Dobara` / `Bheje`. Nothing is uploaded until she presses
 * `Bheje`.
 */
export function SelfieCaptureView({
  onSubmit,
  isSubmitting = false,
  error = null,
  onHelp,
}: {
  onSubmit?: ((photo: CapturedPhoto) => void) | undefined;
  isSubmitting?: boolean;
  error?: string | null;
  onHelp?: (() => void) | undefined;
}): React.ReactElement {
  const { s } = useDesignScale();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  /**
   * The box is 582 on the 716-unit frame; a phone shorter than the frame cannot hold that above
   * the fixed button, and the bottom of the photo slid under it. It takes what is left instead,
   * never more than the design's 582.
   */
  const [room, setRoom] = useState<number | null>(null);
  const boxHeight =
    room === null ? s(SELFIE.boxHeight) : Math.min(s(SELFIE.boxHeight), Math.max(0, room));

  // Asked for the moment the screen opens, so the camera is simply on when she gets here.
  const granted = permission?.granted === true;
  const canAsk = permission !== null && !granted && permission.canAskAgain;
  useEffect(() => {
    if (canAsk) void requestPermission();
    // Once per screen: a refusal is not re-asked in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAsk]);

  const capture = (): void => {
    if (camera.current === null || capturing) return;
    setCapturing(true);
    setCaptureError(null);
    void camera.current
      .takePictureAsync({ quality: 0.5, skipProcessing: false })
      .then((taken) => {
        setPhoto({ uri: taken.uri, mimeType: 'image/jpeg' });
      })
      .catch(() => {
        setCaptureError('Photo nahi khichi. Dobara try kare.');
      })
      .finally(() => {
        setCapturing(false);
      });
  };

  const message = error ?? captureError;
  const messageLine =
    message === null ? null : (
      <Text variant="caption" color={color.danger} align="center" testID="selfie-error">
        {message}
      </Text>
    );

  const footer =
    photo === null ? (
      <View
        style={[
          styles.selfieShutterArea,
          { paddingHorizontal: s(JOB_ACTION.paddingH), paddingVertical: s(JOB_ACTION.paddingV) },
        ]}
      >
        {messageLine}
        {/* `308:1611` — an 80-unit lime disc carrying the camera glyph; no label. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Photo"
          accessibilityState={{ disabled: capturing }}
          disabled={capturing}
          onPress={granted ? capture : () => void requestPermission()}
          style={[
            styles.selfieShutter,
            {
              width: s(SELFIE.shutter),
              height: s(SELFIE.shutter),
              borderRadius: s(SELFIE.shutter / 2),
            },
          ]}
          testID="selfie-capture"
        >
          <Image
            source={art.camera}
            style={{ width: s(SELFIE.shutterGlyph), height: s(SELFIE.shutterGlyph) }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
      </View>
    ) : (
      <View style={[styles.stretch, { padding: s(JOB_FOOTER.padding), gap: s(JOB_FOOTER.gap) }]}>
        {messageLine}
        <LimeCta
          glyph={art.reset}
          label="Retake"
          fill={color.yellow400}
          onPress={() => setPhoto(null)}
          disabled={isSubmitting}
          testID="selfie-retake"
        />
        <LimeCta
          glyph={art.done}
          label="Submit"
          onPress={() => onSubmit?.(photo)}
          disabled={isSubmitting}
          testID="selfie-submit"
        />
      </View>
    );

  return (
    <ServiceShell
      onHelp={onHelp}
      footer={footer}
      footerPaddingBottom={0}
      testID="service-selfie"
      onMeasure={(contentHeight, footerHeight) => {
        // Body padding above, the block's own padding, and a gap before the button.
        setRoom(contentHeight - footerHeight - s(BODY.padding) - s(BLOCK.paddingV * 2) - s(12));
      }}
    >
      <Block>
        <View
          style={[
            styles.selfieBox,
            {
              height: boxHeight,
              borderRadius: s(SELFIE.boxRadius),
              borderWidth: s(SELFIE.boxBorder),
            },
          ]}
          testID="selfie-box"
        >
          {photo !== null ? (
            <Image
              source={{ uri: photo.uri }}
              style={styles.selfieFill}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              testID="selfie-preview"
            />
          ) : granted ? (
            <CameraView
              ref={camera}
              style={styles.selfieFill}
              facing="front"
              testID="selfie-camera"
            />
          ) : permission !== null && !permission.canAskAgain ? (
            <View style={styles.selfieNotice}>
              <Text variant="title" color={color.white} align="center" testID="selfie-denied">
                Camera ki permission band hai. Phone ki Settings me Spoon Partner ko Camera ki
                permission de.
              </Text>
            </View>
          ) : null}
        </View>
      </Block>
    </ServiceShell>
  );
}

/** `1:10275` — the selfie is on record. */
export function SelfieDoneView({
  onHelp,
}: {
  onHelp?: (() => void) | undefined;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <ServiceShell onHelp={onHelp} testID="service-selfie-done">
      <View style={[styles.selfieDone, { gap: s(SELFIE_DONE.gap) }]}>
        <View
          style={[
            styles.arrivalTick,
            {
              width: s(SELFIE_DONE.tickDisc),
              height: s(SELFIE_DONE.tickDisc),
              borderRadius: s(SELFIE_DONE.tickDisc / 2),
            },
          ]}
        >
          <SvgXml
            xml={arrivalCheck}
            width={s(SELFIE_DONE.tickGlyph)}
            height={s(SELFIE_DONE.tickGlyph)}
          />
        </View>
        <Text variant="cardCountdown" color={color.black} align="center">
          Photo jama ho gyi hai.
        </Text>
      </View>
    </ServiceShell>
  );
}

/* -------------------------------------------------------------------- otp --- */

/** `476:4234` / `628:1256` — the absolutely-composed OTP block. */
function OtpBlock({
  label,
  action,
  code,
  onChange,
  onSubmit,
  isSubmitting,
  hasError,
  length,
  testID,
}: {
  label: string;
  action: string;
  code: string;
  onChange: (next: string) => void;
  onSubmit?: (() => void) | undefined;
  isSubmitting: boolean;
  hasError: boolean;
  length: number;
  testID: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <Block>
      <View style={{ width: s(OTP_BLOCK.width), height: s(OTP_BLOCK.height) }} testID={testID}>
        <View
          style={[
            styles.otpBody,
            {
              top: s(OTP_BLOCK.bodyTop),
              width: s(OTP_BLOCK.bodyWidth),
              height: s(OTP_BLOCK.bodyHeight),
              borderRadius: s(OTP_BLOCK.bodyRadius),
            },
          ]}
        >
          <Text
            variant="otpLabel"
            color={color.black}
            style={{
              position: 'absolute',
              left: s(OTP_BLOCK.labelLeft),
              top: s(OTP_BLOCK.labelTop - 15),
              width: s(OTP_BLOCK.labelWidth),
            }}
          >
            {label}
          </Text>
          <View
            style={{
              position: 'absolute',
              left: s(OTP_BLOCK.gridLeft),
              top: s(OTP_BLOCK.gridTop),
              width: s(OTP_BLOCK.gridWidth),
              height: s(OTP_BLOCK.gridHeight),
              justifyContent: 'center',
            }}
          >
            <OtpInput
              variant="service"
              length={length}
              value={code}
              onChange={onChange}
              hasError={hasError}
              disabled={isSubmitting}
              testID={`${testID}-input`}
            />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting || code.length < length }}
          disabled={isSubmitting || code.length < length}
          onPress={onSubmit}
          style={[
            styles.otpPill,
            {
              left: s(OTP_BLOCK.pillLeft),
              width: s(OTP_BLOCK.pillWidth),
              height: s(OTP_BLOCK.pillHeight),
              borderRadius: s(OTP_BLOCK.pillRadius),
            },
          ]}
          testID={`${testID}-submit`}
        >
          <Text variant="otpAction" color={color.black} align="center">
            {action}
          </Text>
        </Pressable>
      </View>
    </Block>
  );
}

/**
 * `308:1412` / `303:1394` — `Start job` / `End job` over three big code tiles.
 *
 * Replaces the V14 card that held the label, a small keypad and its own pill: the action is now
 * the full-width button in the fixed footer (`JobActionFooter`).
 */
function JobOtpBlock({
  title,
  code,
  onChange,
  isSubmitting,
  hasError,
  length,
  testID,
}: {
  title: string;
  code: string;
  onChange: (next: string) => void;
  isSubmitting: boolean;
  hasError: boolean;
  length: number;
  testID: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <Block>
      <View style={[styles.stretch, { gap: s(JOB_OTP.gap) }]} testID={testID}>
        <Text variant="cardCountdown" color={color.black} align="center" style={styles.stretch}>
          {title}
        </Text>
        <View style={[styles.stretch, { paddingVertical: s(JOB_OTP.rowPaddingV) }]}>
          <OtpInput
            variant="job"
            length={length}
            value={code}
            onChange={onChange}
            hasError={hasError}
            disabled={isSubmitting}
            testID={`${testID}-input`}
          />
        </View>
      </View>
    </Block>
  );
}

/** `297:1261` / `297:1359` — `Start` / `End`, the full-width button in the fixed footer. */
function JobActionFooter({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress?: (() => void) | undefined;
  disabled: boolean;
  testID: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.stretch,
        { paddingHorizontal: s(JOB_ACTION.paddingH), paddingVertical: s(JOB_ACTION.paddingV) },
      ]}
    >
      <LimeCta label={label} onPress={onPress} disabled={disabled} testID={testID} />
    </View>
  );
}

/** `473:4192` / `628:1251` — the promo image and its caption. */
function PromoBlock({
  source,
  caption,
  height,
  captionFirst = false,
  gap = PROMO.gap,
  coverHeight,
  testID,
}: {
  source: ImageSourcePropType;
  caption: string;
  height: number;
  captionFirst?: boolean;
  gap?: number;
  testID?: string;
  /**
   * The height the covering image is DRAWN at, when the design pins it to the top of its box
   * rather than centring the overflow. Omit for the centred default.
   *
   * `resizeMode="cover"` always centres, so on a box whose aspect differs sharply from the
   * source's it crops equally from both ends. A Figma image fill carries its own transform and
   * can sit anywhere in the frame, which is not something the CSS dump records — only the render
   * shows it.
   */
  coverHeight?: number;
}): React.ReactElement {
  const { s } = useDesignScale();
  const image = (
    <View
      key="image"
      style={{
        width: s(PROMO.artWidth),
        height: s(height),
        borderRadius: s(PROMO.radius),
        overflow: 'hidden',
      }}
    >
      <Image
        source={source}
        style={{ width: s(PROMO.artWidth), height: s(coverHeight ?? height) }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
  const text = (
    <Text
      key="text"
      variant="travelHeadline"
      color={color.black}
      align="center"
      style={styles.stretch}
    >
      {caption}
    </Text>
  );
  return (
    <View
      style={[
        styles.promo,
        { gap: s(gap), paddingHorizontal: s(PROMO.paddingH), paddingVertical: s(PROMO.paddingV) },
      ]}
      testID={testID}
    >
      {captionFirst ? [text, image] : [image, text]}
    </View>
  );
}

export interface OtpViewProps {
  readonly code: string;
  readonly onChange: (next: string) => void;
  readonly onSubmit?: (() => void) | undefined;
  readonly isSubmitting?: boolean;
  readonly error?: string | null;
  readonly length: number;
  readonly onHelp?: (() => void) | undefined;
}

/** `1:10313` — the Start job photo, the code tiles, and `Start` fixed at the bottom. */
export function StartOtpView({
  code,
  onChange,
  onSubmit,
  isSubmitting = false,
  error = null,
  length,
  onHelp,
}: OtpViewProps): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <ServiceShell
      onHelp={onHelp}
      gap={JOB_FOOTER.gap}
      footerPaddingBottom={0}
      footer={
        <JobActionFooter
          label="Start"
          onPress={onSubmit}
          disabled={isSubmitting || code.length < length}
          testID="start-otp-submit"
        />
      }
      testID="service-start-otp"
    >
      <View
        style={[
          styles.startJobArt,
          {
            paddingHorizontal: s(START_JOB_ART.paddingH),
            paddingVertical: s(START_JOB_ART.paddingV),
          },
        ]}
        testID="start-otp-promo"
      >
        <Image
          source={art.startJob}
          style={{
            width: s(START_JOB_ART.width),
            height: s(START_JOB_ART.height),
            borderRadius: s(START_JOB_ART.radius),
          }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>
      <JobOtpBlock
        title="Start job"
        code={code}
        onChange={onChange}
        isSubmitting={isSubmitting}
        hasError={error !== null}
        length={length}
        testID="start-otp"
      />
      {error !== null && <ErrorLine message={error} testID="start-otp-error" />}
    </ServiceShell>
  );
}

/** `628:1249` — the promo first, then the End OTP block. */
export function EndOtpView({
  code,
  onChange,
  onSubmit,
  isSubmitting = false,
  error = null,
  length,
  onHelp,
}: OtpViewProps): React.ReactElement {
  return (
    <ServiceShell onHelp={onHelp} testID="service-end-otp">
      <PromoBlock source={art.endOtp} caption="OTP daalke job end kare" height={245} />
      <OtpBlock
        label="End OTP"
        action="End"
        code={code}
        onChange={onChange}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        hasError={error !== null}
        length={length}
        testID="end-otp"
      />
      {error !== null && <ErrorLine message={error} testID="end-otp-error" />}
    </ServiceShell>
  );
}

function ErrorLine({ message, testID }: { message: string; testID: string }): React.ReactElement {
  return (
    <Block>
      <Text variant="caption" color={color.danger} testID={testID}>
        {message}
      </Text>
    </Block>
  );
}

/* ---------------------------------------------------------------- cooking --- */

export interface CookingViewProps {
  /**
   * The End OTP, available for the WHOLE of the service rather than only its last minutes.
   *
   * The keypad used to replace the timer five minutes before the end (founder, 2026-08-31), and
   * before that it replaced the timer from the first second — which is why the timer, the
   * last-seven-minutes state and the extension banner were all unreachable. Neither shape is what
   * a cook needs: she wants to see how long is left AND be able to close the job the moment the
   * customer is ready.
   *
   * So it is drawn BESIDE the timer (founder, 2026-09-02), not instead of it. Ending early is
   * safe because the code is the CUSTOMER's — she reads it out — so the OTP is their consent, not
   * the cook's shortcut. `otpEligibility.end` has always been true for the whole of `cooking`, so
   * the server was never the thing holding this back.
   *
   * `null` hides the block entirely, which is what an already-used End OTP looks like.
   */
  readonly endOtp?: {
    readonly code: string;
    readonly onChange: (next: string) => void;
    readonly onSubmit: () => void;
    readonly isSubmitting: boolean;
    readonly error: string | null;
    readonly length: number;
  } | null;
  /** Whole hours remaining, or `null` when the design shows minutes alone. */
  readonly hoursRemaining: number | null;
  readonly minutesRemaining: number;
  /** Server ruling. `622:1125` paints the card `#ffd600` with red type. */
  readonly isEndingSoon: boolean;
  /**
   * Minutes the confirmed extension added, shown only while the five-minute window is open.
   *
   * `null` hides the `628:1228` row entirely, which is the normal Active Job screen. The caller
   * derives this from `extensionBannerMsRemaining`; this view never times anything itself.
   */
  /** Confirmed extension minutes, oldest first; null hides the temporary extension banner. */
  readonly extensionMinutes: readonly number[] | null;
  readonly onHelp?: (() => void) | undefined;
}

/** `622:1036` / `622:1085` / `622:1125` / `622:1163`. */
export function CookingView({
  endOtp = null,
  hoursRemaining,
  minutesRemaining,
  isEndingSoon,
  extensionMinutes,
  onHelp,
}: CookingViewProps): React.ReactElement {
  const { s } = useDesignScale();
  const showExtension = extensionMinutes !== null && extensionMinutes.length > 0;
  const timerFill = isEndingSoon ? color.yellow600 : color.lime400;
  const timerColor = isEndingSoon ? color.danger : color.black;

  const heading = (
    <View key="heading" style={[styles.stretch, { paddingVertical: s(COOK.headingPaddingV) }]}>
      <Text variant="screenTitle" color={color.slate} align="center" style={styles.stretch}>
        Cooking time ...
      </Text>
    </View>
  );

  const timer = (
    <View
      key="timer"
      style={[
        styles.timer,
        {
          height: s(COOK.timerHeight),
          borderRadius: s(COOK.timerRadius),
          padding: s(COOK.timerPadding),
          backgroundColor: timerFill,
          gap: s(COOK.cellGap),
        },
      ]}
      testID="service-timer"
    >
      {hoursRemaining !== null && (
        <TimerCell text={`${hoursRemaining} hr`} width={COOK.hoursColumn} textColor={timerColor} />
      )}
      <TimerCell text={`${minutesRemaining} mins`} flex textColor={timerColor} />
    </View>
  );

  return (
    <ServiceShell
      onHelp={onHelp}
      testID="service-cooking"
      {...(endOtp === null
        ? {}
        : {
            footerPaddingBottom: 0,
            footer: (
              <JobActionFooter
                label="End"
                onPress={endOtp.onSubmit}
                disabled={endOtp.isSubmitting || endOtp.code.length < endOtp.length}
                testID="cooking-end-otp-submit"
              />
            ),
          })}
    >
      <View
        style={[
          styles.block,
          { paddingHorizontal: s(BLOCK.paddingH), paddingVertical: s(BLOCK.paddingV) },
        ]}
      >
        {showExtension ? (
          /*
           * `622:1163` drops the white `rounded-24` card the other three timer frames wrap their
           * heading and timer in, and lays the three blocks out directly at a 10-unit gap. That is
           * a real difference in the design, not an oversight, so the wrapper is conditional.
           */
          <View style={[styles.stretch, { gap: s(COOK.bannerGap) }]}>
            {heading}
            <ExtensionRows minutes={extensionMinutes ?? []} />
            {timer}
          </View>
        ) : (
          <View
            style={[
              styles.cookCard,
              {
                width: s(COOK.cardWidth),
                borderRadius: s(COOK.cardRadius),
                padding: s(COOK.cardPadding),
                gap: s(COOK.cardGap),
              },
            ]}
          >
            {heading}
            {timer}
          </View>
        )}
      </View>
      {/*
       * `303:1394` — the End job tiles share the live cooking screen with the timer; `End` is the
       * fixed footer button (`297:1359`).
       */}
      {endOtp !== null && (
        <>
          <JobOtpBlock
            title="End job"
            code={endOtp.code}
            onChange={endOtp.onChange}
            isSubmitting={endOtp.isSubmitting}
            hasError={endOtp.error !== null}
            length={endOtp.length}
            testID="cooking-end-otp"
          />
          {endOtp.error !== null && (
            <ErrorLine message={endOtp.error} testID="cooking-end-otp-error" />
          )}
        </>
      )}
    </ServiceShell>
  );
}

function TimerCell({
  text,
  width,
  flex,
  textColor,
}: {
  text: string;
  width?: number;
  flex?: boolean;
  textColor: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.timerCell,
        flex === true ? styles.flexOne : { width: s(width ?? 0) },
        {
          borderRadius: s(COOK.cellRadius),
          paddingHorizontal: s(COOK.cellPaddingH),
          paddingVertical: s(COOK.cellPaddingV),
        },
      ]}
    >
      {/*
       * `alignSelf: 'stretch'`, NOT `flex: 1`.
       *
       * `flex: 1` made the label fill the cell's 154 units of height, and Android draws a text
       * box's glyphs against its TOP edge — so `59 mins` sat forty units above the centre the
       * design puts it on, on all four cooking frames, while the cell it sits in was exactly
       * right. Stretching the cross axis gives the same full width without touching the height,
       * and the cell's own `justifyContent: 'center'` then does the centring.
       */}
      <Text variant="timerValue" color={textColor} align="center" style={styles.stretch}>
        {text}
      </Text>
    </View>
  );
}

/** `628:1228` — the clock, the `Extension` label and the granted minutes. */
function ExtensionRows({ minutes }: { minutes: readonly number[] }): React.ReactElement {
  return (
    <>
      {minutes.map((item, index) => (
        <ExtensionRow key={`${item}-${index}`} minutes={item} index={index} />
      ))}
    </>
  );
}

function ExtensionRow({ minutes, index }: { minutes: number; index: number }): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.extensionRow,
        { gap: s(COOK.extensionGap), paddingVertical: s(COOK.extensionPaddingV) },
      ]}
      testID={index === 0 ? 'service-extension-banner' : `service-extension-banner-${index + 1}`}
    >
      <Image
        source={art.extensionClock}
        style={{ width: s(COOK.extensionArt), height: s(COOK.extensionArtHeight) }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View
        style={[
          styles.extensionColumn,
          {
            width: s(COOK.extensionColumn),
            height: s(COOK.extensionArtHeight),
            gap: s(COOK.extensionColumnGap),
          },
        ]}
      >
        <View
          style={[
            styles.extensionChip,
            {
              width: s(COOK.extensionLabelWidth),
              backgroundColor: color.white,
              borderRadius: s(COOK.extensionChipRadius),
              paddingHorizontal: s(COOK.extensionChipPaddingH),
              paddingVertical: s(COOK.extensionChipPaddingV),
            },
          ]}
        >
          <Text variant="extensionLabel" color={color.black} align="center" style={styles.stretch}>
            Extension
          </Text>
        </View>
        <View
          style={[
            styles.extensionChip,
            {
              width: s(COOK.extensionValueWidth),
              backgroundColor: color.yellow400,
              borderRadius: s(COOK.extensionChipRadius),
              paddingHorizontal: s(COOK.extensionChipPaddingH),
              paddingVertical: s(COOK.extensionChipPaddingV),
            },
          ]}
        >
          <Text
            variant="extensionValue"
            color={color.black}
            align="center"
            style={styles.stretch}
            testID={
              index === 0 ? 'service-extension-minutes' : `service-extension-minutes-${index + 1}`
            }
          >
            {`${minutes} mins`}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- completed --- */

/** `628:1293` — the job is done. Body gap is 16 here, not the 21 every other frame uses. */
export function CompletedView({
  onSeeJobs,
  onHelp,
}: {
  onSeeJobs?: (() => void) | undefined;
  onHelp?: (() => void) | undefined;
}): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  return (
    <ServiceShell gap={BODY.endGap} onHelp={onHelp} testID="service-completed">
      <View
        style={[
          styles.promo,
          {
            width: s(PROMO.width),
            height: s(PROMO.height),
            gap: s(PROMO.completedGap),
            paddingHorizontal: s(PROMO.paddingH),
            paddingVertical: s(PROMO.paddingV),
          },
        ]}
      >
        {/* `485:4932` is a fixed slot large enough for the complete two-line headline. */}
        <View style={[styles.headlineBox, { height: s(PROMO.headlineHeight) }]}>
          <Text
            variant="completedHeadline"
            color={color.black}
            align="center"
            style={styles.stretch}
          >
            Agle booking mein bhi accha kaam kare!
          </Text>
        </View>
        <View style={{ width: s(PROMO.artWidth), height: s(COMPLETED_ART_HEIGHT) }}>
          <Image
            source={art.completed}
            style={{ width: s(PROMO.artWidth), height: s(COMPLETED_ART_HEIGHT) }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
      </View>
      <DoneButton label="Kaam dekhe" onPress={onSeeJobs} scale={scale} testID="service-done" />
    </ServiceShell>
  );
}

/** `628:1338` / `622:1032` — `Kaam dekhe` with its arrow. */
function DoneButton({
  label,
  onPress,
  scale,
  testID,
}: {
  label: string;
  onPress?: (() => void) | undefined;
  scale: DesignScale;
  testID: string;
}): React.ReactElement {
  const { s } = scale;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.doneCta,
        {
          borderRadius: s(DONE_CTA.radius),
          paddingVertical: s(DONE_CTA.paddingV),
          gap: s(DONE_CTA.gap),
        },
      ]}
      testID={testID}
    >
      <Text variant="cardCountdown" color={color.black} align="center">
        {label}
      </Text>
      <Image
        source={art.arrow}
        style={{ width: s(DONE_CTA.arrowW), height: s(DONE_CTA.arrowH) }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  shellContent: { flex: 1, position: 'relative' },
  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.white,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: color.white,
  },
  body: { alignItems: 'flex-start', backgroundColor: color.white },
  block: { alignSelf: 'stretch', alignItems: 'flex-start' },
  stretch: { alignSelf: 'stretch' },
  flexOne: { flex: 1 },

  travelBanner: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  travelColumn: { justifyContent: 'space-between' },
  travelHeadline: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
  },
  travelCountdown: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },

  cancelBanner: { alignSelf: 'stretch', alignItems: 'center' },
  arrivalColumn: { alignItems: 'center', justifyContent: 'space-between' },
  arrivalTick: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lime600,
  },
  arrivalLate: { alignSelf: 'stretch' },
  selfieBox: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderColor: color.black,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  selfieFill: { flex: 1 },
  selfieShutterArea: { alignSelf: 'stretch', alignItems: 'center' },
  selfieShutter: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.lime600 },
  startJobArt: { alignSelf: 'stretch', alignItems: 'center' },
  selfieNotice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  selfieDone: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 560,
  },
  arrivalLateFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.dangerTint,
  },
  arrivedCta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lime600,
  },
  /** `1:9955` — the same control, greyed while the cook is still travelling. */
  arrivedCtaDisabled: { backgroundColor: color.smoke },

  detailsCard: {
    alignItems: 'flex-start',
    backgroundColor: color.white,
    borderColor: color.yellow600,
  },
  actionGrid: { alignSelf: 'stretch', flexDirection: 'row' },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  address: { alignSelf: 'stretch', alignItems: 'flex-start', justifyContent: 'center' },
  addressRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  customerRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationChip: {
    backgroundColor: color.yellow400,
    alignItems: 'center',
    justifyContent: 'center',
  },

  otpBody: { position: 'absolute', left: 0, backgroundColor: 'rgba(236, 255, 155, 0.7)' },
  otpPill: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lime400,
    overflow: 'hidden',
  },
  promo: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.white },
  headlineBox: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  cookCard: { alignItems: 'flex-start', backgroundColor: color.white },
  timer: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'stretch' },
  timerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
    overflow: 'hidden',
  },
  extensionRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start' },
  extensionColumn: { alignItems: 'center', justifyContent: 'center' },
  extensionChip: { alignItems: 'center', justifyContent: 'center' },

  doneCta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lime600,
  },
});
