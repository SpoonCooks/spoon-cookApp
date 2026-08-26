import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
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
import { callIcon, mapPin } from '@ui/icons/figmaV14Icons';

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

/** `468:3940` — the arrival banner: a full-width illustration over a centred headline. */
/**
 * `468:3941` — the arrival art, `330 x 150` inside the 338-wide status banner.
 *
 * The width is STATED, not stretched. See `promoArt` below for what stretching cost.
 */
const ARRIVAL = { artWidth: 330, artHeight: 150, gap: 10 } as const;

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
  addressRowHeight: 25,
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
  headlineHeight: 63,
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

/**
 * `473:4193` — the drawn height of `622:801`'s art, which its box crops from the BOTTOM only.
 *
 * `start-otp-art.png` is 1402x1122 and the box is 314x217, so covering it draws
 * `314 x 1122 / 1402` = **251.3** units and leaves 34 to crop. `resizeMode="cover"` splits that
 * 17 above and 17 below; the design's fill takes all 34 off the bottom.
 *
 * Measured, not inferred. Fitting the asset to the reference's own art region scores 9.83% when
 * the image is pinned to the top of the box and 13.10% centred, both locating the box at the same
 * row — and aligning the two renders directly needs the app's artwork moved **18 units down**,
 * which takes that region from 24.53% to 8.27%. The other five art frames all measure a best
 * shift of **0** and keep the centred default: their boxes sit within a few units of the source
 * aspect, so there is almost no overflow to place.
 */
const START_OTP_ART_COVER_HEIGHT = 251.3;

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
  arrival: require('@/assets/images/figma-v14/arrival-art.png') as ImageSourcePropType,
  cancelled: require('@/assets/images/figma-v14/cancel-art.png') as ImageSourcePropType,
  startOtp: require('@/assets/images/figma-v14/start-otp-art.png') as ImageSourcePropType,
  endOtp: require('@/assets/images/figma-v14/end-otp-art.png') as ImageSourcePropType,
  completed: require('@/assets/images/figma-v14/end-art.png') as ImageSourcePropType,
  cooking: require('@/assets/images/figma-v14/cook-photo.png') as ImageSourcePropType,
  /**
   * `622:1125` draws a DIFFERENT photograph from the other three cooking frames — the cook wiping
   * a hob, not stirring a pan. One `art.cooking` for all four put the wrong picture on the frame
   * a cook sees in her last seven minutes, and it is 314x276 of the screen.
   */
  cookingEnding: require('@/assets/images/figma-v14/cooking-ending.png') as ImageSourcePropType,
  extensionClock: require('@/assets/images/figma-v14/extension-clock.png') as ImageSourcePropType,
  done: require('@/assets/images/figma-v14/done-icon.png') as ImageSourcePropType,
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
  at_risk: {
    headline: 'LATE ho raha hai',
    art: art.travelLate,
    fill: color.yellow400,
    countdownColor: color.danger,
    outlined: false,
  },
  late: {
    headline: 'Aap LATE hai!',
    art: art.travelLate,
    fill: color.yellow600,
    countdownColor: color.danger,
    outlined: true,
  },
};

const ARRIVAL_HEADLINE: Readonly<Record<ArrivalTiming, string>> = {
  on_time: 'Very good! Aap time pe hai',
  late: 'Aap LATE pahauchi hai!',
};

/* ------------------------------------------------------------------ shell --- */

function ServiceShell({
  children,
  gap = BODY.gap,
  onHelp,
  testID,
  title = 'Active job',
}: {
  children: React.ReactNode;
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
      <ScrollView
        contentContainerStyle={[styles.body, { padding: s(BODY.padding), gap: s(gap) }]}
        testID="service-scroll"
      >
        {children}
      </ScrollView>
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
  showCall = true,
  showMap = true,
}: {
  job: JobSummary;
  onMap?: (() => void) | undefined;
  onCall?: (() => void) | undefined;
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
  const rows: readonly { icon: ImageSourcePropType; text: string | null }[] = [
    { icon: art.building, text: job.address.buildingName },
    { icon: art.tower, text: job.address.towerOrBlock },
    { icon: art.floor, text: job.address.floor },
    { icon: art.flat, text: job.address.flatOrHouse },
  ];

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
  readonly onMap?: (() => void) | undefined;
  readonly onCall?: (() => void) | undefined;
  readonly onHelp?: (() => void) | undefined;
}

/** `614:453` / `622:597` / `622:530`. */
export function TravelView({
  job,
  timing,
  minutesToDeadline,
  onMap,
  onCall,
  onHelp,
}: TravelViewProps): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const tier = TRAVEL_TIER[timing];

  return (
    <ServiceShell onHelp={onHelp} testID={`service-travel-${timing}`}>
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
                {`${minutesToDeadline} mins`}
              </Text>
            </View>
          </View>
        </View>
      </Block>
      <UserDetailsCard job={job} onMap={onMap} onCall={onCall} />
    </ServiceShell>
  );
}

/** `622:913` — the booking was cancelled while the cook was on the way. */
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
    <ServiceShell title="Jaankari" onHelp={onHelp} testID="service-travel-cancelled">
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
              Ye booking CANCEL ho gayi hai
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

export function ArrivalView({
  job,
  timing,
  onArrived,
  onMap,
  onCall,
  onHelp,
  isSubmitting = false,
}: {
  job: JobSummary;
  timing: ArrivalTiming;
  onArrived?: (() => void) | undefined;
  onMap?: (() => void) | undefined;
  onCall?: (() => void) | undefined;
  onHelp?: (() => void) | undefined;
  isSubmitting?: boolean;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <ServiceShell onHelp={onHelp} testID={`service-arrival-${timing}`}>
      <Block>
        <View style={[styles.arrivalBanner, { gap: s(ARRIVAL.gap) }]}>
          {/* `468:3941` is the same `absolute inset-0 size-full` as the travel photo. */}
          <View style={{ width: s(ARRIVAL.artWidth), height: s(ARRIVAL.artHeight) }}>
            <Image
              source={art.arrival}
              style={{ width: s(ARRIVAL.artWidth), height: s(ARRIVAL.artHeight) }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <Text variant="travelHeadline" color={color.black} align="center" style={styles.stretch}>
            {ARRIVAL_HEADLINE[timing]}
          </Text>
        </View>
      </Block>
      <Block>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          onPress={onArrived}
          style={[
            styles.arrivedCta,
            {
              borderRadius: s(ARRIVED_CTA.radius),
              paddingHorizontal: s(ARRIVED_CTA.paddingH),
              paddingVertical: s(ARRIVED_CTA.paddingV),
              gap: s(ARRIVED_CTA.gap),
            },
          ]}
          testID="service-arrived"
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
      </Block>
      <UserDetailsCard job={job} onMap={onMap} onCall={onCall} />
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

/** `473:4192` / `628:1251` — the promo image and its caption. */
function PromoBlock({
  source,
  caption,
  height,
  captionFirst = false,
  gap = PROMO.gap,
  coverHeight,
}: {
  source: ImageSourcePropType;
  caption: string;
  height: number;
  captionFirst?: boolean;
  gap?: number;
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

/** `622:801` — details, then the Start OTP block, then the promo. */
export function StartOtpView({
  job,
  code,
  onChange,
  onSubmit,
  isSubmitting = false,
  error = null,
  length,
  onMap,
  onCall,
  onHelp,
}: OtpViewProps & {
  job: JobSummary;
  onMap?: (() => void) | undefined;
  onCall?: (() => void) | undefined;
}): React.ReactElement {
  return (
    <ServiceShell onHelp={onHelp} testID="service-start-otp">
      <UserDetailsCard job={job} onMap={onMap} onCall={onCall} />
      <OtpBlock
        label="Start OTP"
        action="Start"
        code={code}
        onChange={onChange}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        hasError={error !== null}
        length={length}
        testID="start-otp"
      />
      <PromoBlock
        source={art.startOtp}
        caption="OTP daalke job start kare"
        height={217}
        coverHeight={START_OTP_ART_COVER_HEIGHT}
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
  readonly extensionMinutes: number | null;
  readonly onHelp?: (() => void) | undefined;
}

/** `622:1036` / `622:1085` / `622:1125` / `622:1163`. */
export function CookingView({
  hoursRemaining,
  minutesRemaining,
  isEndingSoon,
  extensionMinutes,
  onHelp,
}: CookingViewProps): React.ReactElement {
  const { s } = useDesignScale();
  const showExtension = extensionMinutes !== null;
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
    <ServiceShell onHelp={onHelp} testID="service-cooking">
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
            <ExtensionRow minutes={extensionMinutes} />
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
      <PromoBlock
        source={isEndingSoon ? art.cookingEnding : art.cooking}
        caption="5+ rating ki koshish kare"
        height={276}
        captionFirst
        gap={12}
      />
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
function ExtensionRow({ minutes }: { minutes: number }): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.extensionRow,
        { gap: s(COOK.extensionGap), paddingVertical: s(COOK.extensionPaddingV) },
      ]}
      testID="service-extension-banner"
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
            testID="service-extension-minutes"
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
        {/* `485:4932` is a 63-unit box holding a 72-unit two-line run, centred and clipped. */}
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
  arrivalBanner: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  arrivedCta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lime600,
  },

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
