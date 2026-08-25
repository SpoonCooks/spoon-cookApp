import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  defaultJobUrgency,
  formatDurationHours,
  formatMinutes,
  type JobCardModel,
  type JobUrgency,
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
 *   * `583:375` (`4a- jobs log out`) — the list alone, no break card, no CTA.
 *   * `583:401` (`4b- job log in`) — the same list under an `aaj ka break` window.
 *   * `583:427` / `583:453` / `583:479` — break card, then a **lead card** carrying the countdown
 *     and the `CHALO` CTA, then the rest of the list. These three are one layout in three
 *     colourways; a structural diff of all 121 nodes finds only the countdown value and the CTA
 *     label differ, so the tier drives style and copy and nothing else.
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

/** `573:1205` — the jobs `aaj ka break` window. */
const BREAK = {
  gap: 16,
  radius: 16,
  cellGap: 2,
  cellRadius: 7,
  cellPadding: 6,
  cellBorderWidth: 2,
} as const;

const timerGlyph = require('@/assets/images/figma-v14/timer-2.png');

/**
 * Per-tier fills for the lead card.
 *
 * Transcribed from `575:1350` and `575:1489`; the `soon` row is `572:1076`. `ctaLabel` keeps the
 * design's literal casing even though every tier also sets `text-transform: uppercase` — the
 * stored string is what Figma holds, and the transform is applied at render so the two cannot
 * disagree.
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
    }
  >
> = {
  soon: {
    border: color.yellow600,
    disc: color.yellow400,
    chip: color.yellow300,
    cta: color.yellow600,
    ctaText: color.black,
    ctaLabel: 'Chalo',
  },
  imminent: {
    border: color.lime600,
    disc: color.lime300,
    chip: color.lime300,
    cta: color.lime600,
    ctaText: color.black,
    ctaLabel: 'chalo!!',
  },
  critical: {
    border: color.danger,
    disc: color.dangerSoft,
    chip: color.dangerSoft,
    cta: color.danger,
    ctaText: color.white,
    ctaLabel: 'CHALO!!',
  },
};

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
   * Explicit rather than derived: the design's three tiers name thresholds its own mock values
   * contradict (see `jobUrgencies`), so fixtures set the tier per frame and production passes
   * `defaultJobUrgency`.
   */
  readonly leadUrgency?: JobUrgency | undefined;
  readonly jobs: readonly JobCardModel[];
  readonly breakWindow: BreakWindowModel | null;
  readonly onStartTravel?: ((bookingId: string) => void) | undefined;
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
  submittingId,
  onHelp,
  banner,
  scrollProps,
}: JobsViewProps): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const insets = useSafeAreaInsets();

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
          {leadJob !== null && (
            <LeadJobCard
              job={leadJob}
              urgency={leadUrgency}
              scale={scale}
              onStartTravel={onStartTravel}
              isSubmitting={submittingId === leadJob.bookingId}
            />
          )}
          {jobs.map((job) => (
            <JobTile key={job.bookingId} job={job} scale={scale} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** `572:819` — a job the cook cannot act on yet: start time, duration, building. */
function JobTile({ job, scale }: { job: JobCardModel; scale: DesignScale }): React.ReactElement {
  const { s } = scale;
  return (
    <View
      style={[
        styles.card,
        figmaStroke(scale, {
          width: CARD.borderWidth,
          paddingH: CARD.paddingH,
          paddingV: CARD.paddingV,
        }),
        { borderRadius: s(CARD.radius), borderColor: color.yellow600 },
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
            <IconDisc size={CARD.disc} fill={color.yellow400} scale={scale} />
            <Text variant="cardTime" numberOfLines={1}>
              {formatClock(job.scheduledStartIso)}
            </Text>
          </View>
          <DurationChip minutes={job.serviceDurationMinutes} fill={color.yellow300} scale={scale} />
        </View>
        <Text variant="cardTitle" color={color.black}>
          {job.societyOrBuilding}
        </Text>
      </View>
    </View>
  );
}

/** `572:1076` / `575:1350` / `575:1489` — the actionable card, in one of three colourways. */
function LeadJobCard({
  job,
  urgency,
  scale,
  onStartTravel,
  isSubmitting,
}: {
  job: JobCardModel;
  urgency: JobUrgency;
  scale: DesignScale;
  onStartTravel?: ((bookingId: string) => void) | undefined;
  isSubmitting: boolean;
}): React.ReactElement {
  const { s } = scale;
  const tier = TIER[urgency];

  return (
    <View
      style={[
        styles.card,
        figmaStroke(scale, {
          width: CARD.borderWidth,
          paddingH: CARD.paddingH,
          paddingV: CARD.paddingV,
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
              {job.minutesToDeadline === null
                ? formatClock(job.scheduledStartIso)
                : formatMinutes(job.minutesToDeadline)}
            </Text>
          </View>
          <DurationChip minutes={job.serviceDurationMinutes} fill={tier.chip} scale={scale} />
        </View>
        <Text variant="headingLg" color={color.black}>
          {job.societyOrBuilding}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !job.isActionable || isSubmitting }}
          disabled={!job.isActionable || isSubmitting}
          onPress={onStartTravel ? () => onStartTravel(job.bookingId) : undefined}
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
          <Text variant="ctaLabelTight" color={tier.ctaText} align="center" style={styles.upper}>
            {tier.ctaLabel}
          </Text>
        </Pressable>
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
      style={[styles.breakCard, { gap: s(BREAK.gap), borderRadius: s(BREAK.radius) }]}
      testID="jobs-break-card"
    >
      <Text variant="overlineLg" color={color.danger} style={styles.upper}>
        aaj ka break
      </Text>
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
        figmaStroke(scale, { width: BREAK.cellBorderWidth, padding: BREAK.cellPadding }),
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
  chip: { alignItems: 'center', justifyContent: 'center' },
  cta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakCard: { alignSelf: 'stretch', alignItems: 'flex-start' },
  breakGrid: { alignSelf: 'stretch', flexDirection: 'row' },
  breakCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  upper: { textTransform: 'uppercase' },
});
