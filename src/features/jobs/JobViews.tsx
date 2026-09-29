import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  defaultJobUrgency,
  formatDurationHours,
  formatMinutes,
  type JobCardModel,
  type JobUrgency,
  startTravelBlockedNote,
} from '@core/domain/job';
import { color, figmaStroke, HelpPill, Text, useDesignScale, type DesignScale } from '@ui';

/**
 * The V14 `job flow` section (`592:1070`) — five renderings of the Kaam tab.
 *
 * ## Why this is new code rather than an edit
 *
 * V13 excluded `job flow` by brief, so `(tabs)/jobs.tsx` still drew the V12 screen: a `Namaste,
 * <name>` banner over `@ui/JobCard`. V14 finalizes the section and it shares nothing with that
 * layout — the banner is replaced by a dated top nav with a Help pill, and the card is a bordered
 * `rounded-20` tile with an icon disc, a duration chip and a title, none of which the V12 card
 * draws. So the section is transcribed from V14 and the old card is retired.
 *
 * ## The five frames are three layouts
 *
 * Revised in file `cCQlzTeiObQkpVBzwI8mZi` (2026-09-29):
 *
 *   * `285:742` (`4a- jobs log out`) — the list alone, no break card, no CTA.
 *   * `285:847` (`4b- job log in`) — the same list under an `aaj ka break` window. Also the frame
 *     that draws the ENDED cards: cancelled (`285:922`, pink with a cross) and done (`285:934`,
 *     grey with a tick). Neither opens anything; only the lead card does.
 *   * `1:13010` / `1:13132` / `1:13254` — break card, then a **lead card** carrying the countdown
 *     and the `CHALO` CTA, then the rest of the list. Lime under 45 mins, a louder lime CTA under
 *     10, red under 5 -- where the card also leaves the jobs column and runs the body's width.
 *
 * ## The break card here is NOT the leave section's
 *
 * `leave` draws `528:465`: a `#ecff9b` filled card carrying a `Duration: 2 hrs` line, both time
 * chips outlined in `#cfff04`. The jobs break (`573:1205`) has **no fill**, **no duration line**,
 * and outlines its opening chip in `#ffd600` against the closing chip's `#cfff04`. Routing both
 * through one component would need three flags to express two cards, so they stay separate.
 */

/** `583:350` — the dated top nav. Same shape as `TopNavBar` but 20/28 rather than the leave 20. */
const NAV = { height: 47, paddingH: 16, innerPaddingH: 4, paddingV: 6, titleWidth: 179 } as const;

/** `434:3089` — the scrolling body. */
const BODY = { padding: 16, gap: 16 } as const;

/** `572:918` — the jobs column. `340` wide inside the body's 16pt padding. */
const LIST = { width: 340, paddingH: 4, paddingV: 6, gap: 14.01 } as const;

/** `572:819` — a standard job tile. */
const CARD = {
  radius: 20,
  paddingH: 8,
  paddingV: 12,
  borderWidth: 1,
  innerWidth: 315,
  innerGap: 12,
  innerPaddingBottom: 6,
  disc: 30,
  discRadius: 100,
  glyph: 28,
  headGap: 12,
  headWidth: 165,
  chipRadius: 10,
  chipPadding: 6,
} as const;

/** `572:1076` — the lead card. A larger disc, a 30/36 countdown and a full-width CTA. */
const LEAD = {
  disc: 36,
  ctaRadius: 16,
  ctaPaddingH: 4,
  ctaPaddingV: 6,
  ctaGap: 8,
} as const;

/** `573:1204` / `573:1205` — the jobs `aaj ka break` window and the block that holds it. */
const BREAK = {
  blockPaddingH: 4,
  blockPaddingV: 6,
  gap: 16,
  radius: 16,
  cellGap: 2,
  cellRadius: 7,
  cellPadding: 6,
  cellBorderWidth: 2,
} as const;

const timerGlyph = require('@/assets/images/figma-v14/timer-2.png');
const multiplyGlyph = require('@/assets/images/figma-v14/multiply-black.png');
const doneGlyph = require('@/assets/images/figma-v14/done-icon.png');

/**
 * Per-tier fills for the lead card.
 *
 * Transcribed from `1:13037` (`4c`, under 45 mins), `1:13159` (`4d`, under 10) and `1:13280`
 * (`4e`, under 5). `4c` and `4d` share the lime border, disc and chip and differ only in the CTA:
 * `4c` is a soft `#e2ff68` with a black 24/30 `chalO`, `4d` the full `#cfff04` with a red 30/35
 * `Chalo!!`. `4e` turns the whole card red. `ctaLabel` keeps the design's literal casing; the
 * uppercase transform is applied at render.
 */
const TIER: Readonly<
  Record<
    JobUrgency,
    {
      readonly border: string;
      readonly disc: string;
      readonly chip: string;
      readonly cta: string;
      readonly ctaText: string;
      readonly ctaLabel: string;
      readonly ctaVariant: 'actionLabel' | 'ctaAlarm';
    }
  >
> = {
  soon: {
    border: color.lime600,
    disc: color.lime300,
    chip: color.lime300,
    cta: color.lime400,
    ctaText: color.black,
    ctaLabel: 'chalO',
    ctaVariant: 'actionLabel',
  },
  imminent: {
    border: color.lime600,
    disc: color.lime300,
    chip: color.lime300,
    cta: color.lime600,
    ctaText: color.danger,
    ctaLabel: 'Chalo!!',
    ctaVariant: 'ctaAlarm',
  },
  critical: {
    border: color.danger,
    disc: color.dangerTint,
    chip: color.dangerTint,
    cta: color.danger,
    ctaText: color.white,
    ctaLabel: 'Chalo!!',
    ctaVariant: 'ctaAlarm',
  },
};

/**
 * `285:922` / `285:934` — a job that is over. Neither card has a border; the disc carries a cross
 * or a tick instead of the timer, and the chip takes the card's own tint.
 */
const ENDED = {
  cancelled: {
    card: color.dangerTint,
    disc: color.danger,
    chip: color.dangerTint,
    glyph: multiplyGlyph,
    // `285:928` — 26x28, centred in the disc.
    glyphBox: { width: 26, height: 28, left: 2, top: 1 },
  },
  finished: {
    card: color.smoke,
    disc: color.lime600,
    chip: color.lime300,
    glyph: doneGlyph,
    // `285:940` — 20x30 at x=5, top-aligned.
    glyphBox: { width: 20, height: 30, left: 5, top: 0 },
  },
} as const;

export interface BreakWindowModel {
  readonly fromLabel: string;
  readonly toLabel: string;
}

export interface JobsViewProps {
  /** The dated title, e.g. `7 November`. Server date, formatted by the caller. */
  readonly dateLabel: string;
  /** The card carrying the countdown and CTA, when the server says one is actionable. */
  readonly leadJob: JobCardModel | null;
  /**
   * Which colourway the lead card is drawn in.
   *
   * The SERVER's ruling, from DEC-044/DEC-059's departure plan: `soon` before the cook should set
   * off, `imminent` once she should have, `critical` past the last departure that still arrives on
   * time. Production used to pass `defaultJobUrgency` for every job because the projection
   * published no ruling, so two of the three designed states were unreachable.
   */
  readonly leadUrgency?: JobUrgency | undefined;
  readonly jobs: readonly JobCardModel[];
  readonly breakWindow: BreakWindowModel | null;
  readonly onStartTravel?: ((bookingId: string) => void) | undefined;
  /** Back to the Active Job screen, from `CHALO` on a job she is already on. */
  readonly onOpenJob?: ((bookingId: string) => void) | undefined;
  readonly submittingId?: string | null | undefined;
  readonly onHelp?: (() => void) | undefined;
  /** Rendered between the nav and the list — command errors, refresh controls. */
  readonly banner?: React.ReactNode;
  readonly scrollProps?: React.ComponentProps<typeof ScrollView> | undefined;
}

export function JobsView({
  dateLabel,
  leadJob,
  leadUrgency = defaultJobUrgency,
  jobs,
  breakWindow,
  onStartTravel,
  onOpenJob,
  submittingId,
  onHelp,
  banner,
  scrollProps,
}: JobsViewProps): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const insets = useSafeAreaInsets();
  const leadOutsideList = leadJob !== null && leadUrgency === 'critical';
  const leadCard =
    leadJob === null ? null : (
      <LeadJobCard
        job={leadJob}
        urgency={leadUrgency}
        scale={scale}
        onStartTravel={onStartTravel}
        onOpenJob={onOpenJob}
        isSubmitting={submittingId === leadJob.bookingId}
      />
    );

  return (
    <View style={styles.flex}>
      {/*
       * The OS owns the status band; this screen starts below it.
       *
       * `583:*` draws a 32-unit status mock at y=0 the way every `direct` frame does, and the app
       * must never reproduce it — it has to sit below the real inset instead. Without this the top
       * nav was drawn over the system clock and the whole screen rendered one status-bar height
       * high, which the V14 pixel run measured as a 10-unit displacement on all five job frames.
       * Every other section already did this; `jobs` was the one that did not.
       */}
      <View style={{ height: insets.top }} />
      <View
        style={[
          styles.nav,
          { height: s(NAV.height), paddingHorizontal: s(NAV.paddingH + NAV.innerPaddingH) },
        ]}
      >
        <View style={{ width: s(NAV.titleWidth) }}>
          <Text variant="headingLg" testID="jobs-nav-title">
            {dateLabel}
          </Text>
        </View>
        <HelpPill onPress={onHelp} testID="jobs-nav-help" />
      </View>

      {banner}

      <ScrollView
        contentContainerStyle={[styles.body, { padding: s(BODY.padding), gap: s(BODY.gap) }]}
        testID="jobs-scroll"
        {...scrollProps}
      >
        {breakWindow !== null && <JobsBreakCard window={breakWindow} scale={scale} />}

        {/*
         * `1:13280` — under five minutes the lead card leaves the jobs column and sits directly in
         * the body, so it runs the body's full width rather than the column's inset one.
         */}
        {leadOutsideList && leadCard}

        <View
          style={[
            styles.list,
            {
              width: s(LIST.width),
              paddingHorizontal: s(LIST.paddingH),
              paddingVertical: s(LIST.paddingV),
              gap: s(LIST.gap),
            },
          ]}
        >
          {leadJob !== null && !leadOutsideList && leadCard}
          {jobs.map((job) => (
            <JobTile key={job.bookingId} job={job} scale={scale} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * `285:874` / `285:922` / `285:934` — a job on the list that is not the lead: upcoming, cancelled
 * or done.
 *
 * Not pressable in any state. Only the lead card opens a job: an upcoming tile is not hers to act
 * on yet, and an ended one now says everything it has to on its face -- the cross or the tick, in
 * the card's own colour -- so there is nothing behind it worth a tap.
 */
function JobTile({ job, scale }: { job: JobCardModel; scale: DesignScale }): React.ReactElement {
  const { s } = scale;
  const ended = job.isCancelled ? ENDED.cancelled : job.isFinished ? ENDED.finished : null;
  return (
    <View
      accessibilityLabel={
        job.isCancelled
          ? `${job.societyOrBuilding} job cancelled`
          : job.isFinished
            ? `${job.societyOrBuilding} job done`
            : job.societyOrBuilding
      }
      style={[
        styles.card,
        /*
         * `inside`, not the default `center`.
         *
         * `572:819` and `572:1076` lay out as `2W + 2P + C` — a card pitch of 122.2 units on the
         * reference, measured — which is Yoga's own model with no correction at all. Taking the
         * centre correction out of the padding and the margin made every card 1.9 units short,
         * and six of them stacked put the bottom of the list nine units up the screen. The `leave`
         * cards genuinely are centre-aligned; this is why the choice is per call site.
         *
         * The ended cards have no stroke, but keep the same 1-unit inset in a transparent border
         * so every card on the list has the same pitch.
         */
        figmaStroke(scale, {
          width: CARD.borderWidth,
          paddingH: CARD.paddingH,
          paddingV: CARD.paddingV,
          align: 'inside',
        }),
        {
          borderRadius: s(CARD.radius),
          borderColor: ended === null ? color.yellow600 : 'transparent',
          backgroundColor: ended === null ? color.white : ended.card,
        },
      ]}
      testID={`job-tile-${job.bookingId}`}
    >
      <View
        style={[
          styles.cardInner,
          { gap: s(CARD.innerGap), paddingBottom: s(CARD.innerPaddingBottom) },
        ]}
      >
        <View style={styles.headRow}>
          <View style={[styles.headLeft, { width: s(CARD.headWidth), gap: s(CARD.headGap) }]}>
            {ended === null ? (
              <IconDisc size={CARD.disc} fill={color.yellow400} scale={scale} />
            ) : (
              <EndedDisc
                fill={ended.disc}
                glyph={ended.glyph}
                box={ended.glyphBox}
                scale={scale}
                testID={job.isCancelled ? 'job-mark-cancelled' : 'job-mark-done'}
              />
            )}
            <Text variant="cardTime" numberOfLines={1}>
              {formatClock(job.scheduledStartIso)}
            </Text>
          </View>
          <DurationChip
            minutes={job.serviceDurationMinutes}
            fill={ended === null ? color.yellow300 : ended.chip}
            scale={scale}
          />
        </View>
        <Text variant="cardTitle" color={color.black}>
          {job.societyOrBuilding}
        </Text>
      </View>
    </View>
  );
}

/**
 * Below this many minutes to the reach-by time the lead card counts down; at or above it, it
 * shows the clock time. A countdown of several hours is harder to read than the time itself.
 */
export const LEAD_COUNTDOWN_THRESHOLD_MINUTES = 45;

/**
 * `20 mins` close to the reach-by time, `7:55 AM` otherwise.
 *
 * Both halves describe the SAME moment — the reach-by time — so the switch is seamless: `8:40 AM`
 * becomes `44 mins` at 7:56. They are usually the same instant, but matching may set the reach-by
 * later than the booking when the cook cannot get there sooner; showing the booking time as the
 * clock would then make the card jump — `4:45 PM` turning into `44 mins` pointing at 5:00.
 *
 * Falls back to the booking time only when the server sent no reach-by time at all.
 */
export function leadCardTimeLabel(job: JobCardModel): string {
  if (job.minutesToDeadline !== null && job.minutesToDeadline < LEAD_COUNTDOWN_THRESHOLD_MINUTES) {
    return formatMinutes(job.minutesToDeadline);
  }
  return formatClock(job.reachByIso ?? job.scheduledStartIso);
}

/** `572:1076` / `575:1350` / `575:1489` — the actionable card, in one of three colourways. */
function LeadJobCard({
  job,
  urgency,
  scale,
  onStartTravel,
  onOpenJob,
  isSubmitting,
}: {
  job: JobCardModel;
  urgency: JobUrgency;
  scale: DesignScale;
  onStartTravel?: ((bookingId: string) => void) | undefined;
  onOpenJob?: ((bookingId: string) => void) | undefined;
  isSubmitting: boolean;
}): React.ReactElement {
  const { s } = scale;
  const tier = TIER[urgency];
  /*
   * `CHALO` is the card's only control (founder, 2026-09-29): the card itself opens nothing.
   *
   * On a job she has not set off for it starts travel, as the server allows. On one she is already
   * on -- travelling, arrived, cooking -- there is nothing left to start, so it takes her back to
   * the Active Job screen instead. Without that, a cook who backed out mid-travel, or whose app was
   * killed, would have no way back to the job she is driving to.
   */
  const resumes = job.isInProgress;
  const enabled = resumes || (job.isActionable && !isSubmitting);
  const blockedNote =
    resumes || job.isActionable ? null : startTravelBlockedNote(job.blockedReason);
  const press = resumes
    ? onOpenJob === undefined
      ? undefined
      : () => onOpenJob(job.bookingId)
    : onStartTravel === undefined
      ? undefined
      : () => onStartTravel(job.bookingId);

  return (
    <View
      accessibilityLabel={job.societyOrBuilding}
      style={[
        styles.card,
        figmaStroke(scale, {
          width: CARD.borderWidth,
          paddingH: CARD.paddingH,
          paddingV: CARD.paddingV,
          align: 'inside',
        }),
        { borderRadius: s(CARD.radius), borderColor: tier.border },
      ]}
      testID="job-lead-card"
    >
      <View
        style={[
          styles.cardInner,
          { gap: s(CARD.innerGap), paddingBottom: s(CARD.innerPaddingBottom) },
        ]}
      >
        <View style={styles.headRow}>
          <View style={[styles.headLeft, { width: s(CARD.headWidth), gap: s(CARD.headGap) }]}>
            <IconDisc size={LEAD.disc} fill={tier.disc} scale={scale} />
            <Text variant="cardCountdown" numberOfLines={1} testID="job-lead-countdown">
              {leadCardTimeLabel(job)}
            </Text>
          </View>
          <DurationChip minutes={job.serviceDurationMinutes} fill={tier.chip} scale={scale} />
        </View>
        <Text variant="headingLg" color={color.black}>
          {job.societyOrBuilding}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          onPress={press}
          style={[
            styles.cta,
            {
              backgroundColor: tier.cta,
              borderRadius: s(LEAD.ctaRadius),
              paddingHorizontal: s(LEAD.ctaPaddingH),
              paddingVertical: s(LEAD.ctaPaddingV),
              gap: s(LEAD.ctaGap),
            },
          ]}
          testID="job-lead-cta"
        >
          <Text variant={tier.ctaVariant} color={tier.ctaText} align="center" style={styles.upper}>
            {tier.ctaLabel}
          </Text>
        </Pressable>
        {/*
         * Why she cannot press it.
         *
         * A greyed button with no explanation is only marginally better than a missing one, and
         * the commonest case here -- the departure window has not opened -- is not a failure at
         * all. Saying so is the difference between "the app is broken" and "not yet".
         */}
        {blockedNote === null ? null : (
          <Text
            variant="noteMuted"
            color={color.textSecondary}
            align="center"
            testID="job-lead-blocked"
          >
            {blockedNote}
          </Text>
        )}
      </View>
    </View>
  );
}

function IconDisc({
  size,
  fill,
  scale,
}: {
  size: number;
  fill: string;
  scale: DesignScale;
}): React.ReactElement {
  const { s } = scale;
  return (
    <View
      style={[
        styles.disc,
        {
          width: s(size),
          height: s(size),
          borderRadius: s(CARD.discRadius),
          backgroundColor: fill,
        },
      ]}
    >
      <Image
        source={timerGlyph}
        style={{ width: s(CARD.glyph), height: s(CARD.glyph) }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** `285:939` / `285:927` — the disc on an ended card, carrying the tick or the cross. */
function EndedDisc({
  fill,
  glyph,
  box,
  scale,
  testID,
}: {
  fill: string;
  glyph: number;
  box: {
    readonly width: number;
    readonly height: number;
    readonly left: number;
    readonly top: number;
  };
  scale: DesignScale;
  testID: string;
}): React.ReactElement {
  const { s } = scale;
  return (
    <View
      style={[
        styles.disc,
        {
          width: s(CARD.disc),
          height: s(CARD.disc),
          borderRadius: s(CARD.discRadius),
          backgroundColor: fill,
        },
      ]}
      testID={testID}
    >
      <Image
        source={glyph}
        style={[
          styles.endedGlyph,
          { width: s(box.width), height: s(box.height), left: s(box.left), top: s(box.top) },
        ]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function DurationChip({
  minutes,
  fill,
  scale,
}: {
  minutes: number;
  fill: string;
  scale: DesignScale;
}): React.ReactElement {
  const { s } = scale;
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: fill, borderRadius: s(CARD.chipRadius), padding: s(CARD.chipPadding) },
      ]}
    >
      <Text variant="title">{formatDurationHours(minutes)}</Text>
    </View>
  );
}

/** `573:1205` — the unfilled jobs break window. */
function JobsBreakCard({
  window,
  scale,
}: {
  window: BreakWindowModel;
  scale: DesignScale;
}): React.ReactElement {
  const { s } = scale;
  return (
    <View
      style={[
        styles.breakBlock,
        {
          paddingHorizontal: s(BREAK.blockPaddingH),
          paddingVertical: s(BREAK.blockPaddingV),
        },
      ]}
    >
      <View
        style={[styles.breakCard, { gap: s(BREAK.gap), borderRadius: s(BREAK.radius) }]}
        testID="jobs-break-card"
      >
        {/*
         * `573:1208` — the headline sits in a FULL-WIDTH box, and that is load-bearing.
         *
         * As a direct child of a `flex-start` column the label is sized to what Android measures
         * the string to be, and Android under-measures a run carrying `letterSpacing` by about
         * the trailing character's worth. `AAJ KA BREAK` then draws wider than the box it was
         * given and loses its last word at the word boundary — silently, with no ellipsis and no
         * wrap. The leave screen never showed it because `528:465` already wraps this label in a
         * stretched row; the jobs card did not.
         *
         * Stretching the WRAPPER was not enough, and the card still read `AAJ KA` on the handset
         * on 2026-09-02: `alignItems: 'flex-start'` sized the Text back down to the same
         * under-measured width the wrapper was introduced to escape. The width has to reach the
         * Text itself, so it is the Text that stretches now.
         */}
        <View style={styles.stretch}>
          <Text variant="overlineLg" color={color.danger} style={[styles.upper, styles.fullWidth]}>
            aaj ka break
          </Text>
        </View>
        <View style={[styles.breakGrid, { columnGap: s(BREAK.cellGap) }]}>
          <BreakCell
            label={window.fromLabel}
            border={color.yellow600}
            scale={scale}
            testID="jobs-break-from"
          />
          <View style={[styles.breakCell, { padding: s(BREAK.cellPadding) }]}>
            <Text variant="headingLgBold" align="center">
              TO
            </Text>
          </View>
          <BreakCell
            label={window.toLabel}
            border={color.lime600}
            filled
            scale={scale}
            testID="jobs-break-to"
          />
        </View>
      </View>
    </View>
  );
}

function BreakCell({
  label,
  border,
  filled,
  scale,
  testID,
}: {
  label: string;
  border: string;
  filled?: boolean;
  scale: DesignScale;
  testID: string;
}): React.ReactElement {
  const { s } = scale;
  return (
    <View
      style={[
        styles.breakCell,
        figmaStroke(scale, {
          width: BREAK.cellBorderWidth,
          padding: BREAK.cellPadding,
          align: 'outside',
        }),
        {
          borderRadius: s(BREAK.cellRadius),
          borderColor: border,
          ...(filled === true ? { backgroundColor: color.white } : {}),
        },
      ]}
      testID={testID}
    >
      <Text variant="timeStrong" align="center">
        {label}
      </Text>
    </View>
  );
}

/**
 * `8:30 AM` from an ISO instant, in IST.
 *
 * The job list is authored against Indian local time and the device may be anywhere, so the zone
 * is pinned rather than taken from the device.
 */
export function formatClock(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
    .replace(/ /g, ' ');
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.white },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: color.white,
  },
  body: { alignItems: 'flex-start', backgroundColor: color.white },
  list: { alignItems: 'flex-start' },
  card: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    backgroundColor: color.white,
    overflow: 'hidden',
  },
  cardInner: { alignSelf: 'stretch', alignItems: 'flex-start' },
  headRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headLeft: { flexDirection: 'row', alignItems: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  endedGlyph: { position: 'absolute' },
  chip: { alignItems: 'center', justifyContent: 'center' },
  cta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakBlock: { alignSelf: 'stretch', alignItems: 'flex-start' },
  breakCard: { alignSelf: 'stretch', alignItems: 'flex-start' },
  stretch: { alignSelf: 'stretch', alignItems: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  breakGrid: { alignSelf: 'stretch', flexDirection: 'row' },
  breakCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  upper: { textTransform: 'uppercase' },
});
