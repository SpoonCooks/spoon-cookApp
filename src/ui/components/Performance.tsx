import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import {
  formatDeduction,
  formatRupees,
  formatSignedRupees,
  unavailableFigure,
  type BonusProgress,
  type EarningsPeriodView,
  type PeriodCopy,
  type RatingView,
} from '@core/domain/money';

import { color, radius, spacing } from '../theme/tokens';
import { Text } from '../primitives/Text';

/**
 * Building blocks for the Figma V12 `performance` section (`575:1741`).
 *
 * The section replaced V11's `Performance & earnings` (`540:397`) wholesale: seven new frames at a
 * 370-wide content column, new Hinglish copy, and a card language of bordered white panels over
 * lime/yellow tints. Every frame is assembled from the pieces below, which is why they live here
 * rather than inside any one screen.
 *
 * ## Measurements
 *
 * Geometry is transcribed from the V12 node tree, colours sampled from the section's own renders:
 *
 *   - content column   `370`, cards inset `20` each side (frame `16` + card `4`)
 *   - card radius      `16` (`corner radius/16`), inner chips `12` (`corner radius/12`)
 *   - card strokes     `1` (`stroke weight/1`) — yellow `#ffd600`, red `#ff0000`, black `#000000`
 *   - section labels   Livvic Black 14/20, uppercased, `#ff0000`
 *
 * Cards are laid out fluid rather than pinned to `330`, so the design's proportions hold on a
 * 390–430pt device instead of floating in a fixed-width column.
 *
 * ## Figures the deployed contract does not expose
 *
 * Several prominent numerals in these frames have no field behind them. `buildBreakdown` in the
 * backend selects `event_count` per event type and then discards it, so "No show 1" / "Late 2"
 * have amounts but no counts; no cook route exposes worked duration, the extra-kaam multiplier, or
 * a per-day base. Those render {@link unavailableFigure} (`—`) rather than a plausible guess, and
 * each is recorded as a backend gap. The AMOUNTS beside them are real, server-computed and signed.
 */

const icons = {
  timerWide: require('../../../assets/icons/timer-wide.png') as ImageSourcePropType,
  timer: require('../../../assets/icons/timer.png') as ImageSourcePropType,
  noShow: require('../../../assets/icons/no-show.png') as ImageSourcePropType,
  lateClock: require('../../../assets/icons/late-clock.png') as ImageSourcePropType,
  starLg: require('../../../assets/icons/star-lg.png') as ImageSourcePropType,
  star: require('../../../assets/icons/star.png') as ImageSourcePropType,
  calendar: require('../../../assets/icons/calendar.png') as ImageSourcePropType,
  dayDone: require('../../../assets/icons/day-done.png') as ImageSourcePropType,
  dayMissed: require('../../../assets/icons/day-missed.png') as ImageSourcePropType,
  chevron: require('../../../assets/icons/chevron.png') as ImageSourcePropType,
} as const;

/**
 * A figure the deployed contract does not expose.
 *
 * Rendered at the same size as the real value so the layout does not jump when the backend starts
 * supplying it, but in the muted ink — an em dash in Livvic Black at 36pt is a solid bar, and a
 * cook should read "not available", not "redacted".
 */
function Unavailable({
  variant = 'displayXl',
  testID,
}: {
  variant?: 'displayXl' | 'displayLg';
  testID?: string;
}): React.ReactElement {
  return (
    <Text variant={variant} color={color.textMuted} testID={testID}>
      {unavailableFigure}
    </Text>
  );
}

/* ----------------------------------------------------------- period tabs --- */

export interface PeriodTabItem {
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
}

export interface PeriodTabsProps {
  readonly items: readonly PeriodTabItem[];
  readonly value: string;
  readonly onChange: (key: string) => void;
  readonly testID?: string;
}

/**
 * `Aaj · 1 din` / `Cycle · 7 din` / `Mahina · 28 din` (`434:2931`).
 *
 * A filter, not navigation: switching period must not push a route, because the three frames are
 * one screen reading three server-computed periods of the same payload.
 */
export function PeriodTabs({
  items,
  value,
  onChange,
  testID = 'period-tabs',
}: PeriodTabsProps): React.ReactElement {
  return (
    <View style={styles.tabRow} testID={testID} accessibilityRole="tablist">
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[styles.tab, selected ? styles.tabSelected : styles.tabIdle]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${item.title}, ${item.subtitle}`}
            testID={`${testID}-${item.key}`}
          >
            <Text variant="headingLgBold">{item.title}</Text>
            <Text variant="bodyMuted" color={color.textPrimary}>
              {item.subtitle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- date band --- */

/** The yellow banner heading a past period — `26th July`, `11th Jul - 17th Jul`. */
export function DateBanner({
  label,
  testID = 'date-banner',
}: {
  label: string;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.dateBanner} testID={testID}>
      <Text variant="headingLgBold" align="center">
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------- day strip --- */

export type DayState = 'present' | 'missed' | 'none';

export interface DayStripEntry {
  readonly label: string;
  readonly state: DayState;
}

/**
 * The `Mon…Sun` strip above the cycle frames (`13- money weekly`, `18- past weekly`).
 *
 * `state` comes from stored attendance for the cycle window. A day with no record is `none` — an
 * empty disc, never a cross: "nothing recorded" and "did not come" are different facts.
 */
export function DayStrip({
  days,
  testID = 'day-strip',
}: {
  days: readonly DayStripEntry[];
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.dayStrip} testID={testID}>
      {days.map((day, index) => (
        <View key={`${day.label}-${index}`} style={styles.dayCell}>
          <View
            style={[
              styles.dayDisc,
              day.state === 'present' && styles.dayDiscPresent,
              day.state === 'missed' && styles.dayDiscMissed,
            ]}
          >
            {day.state === 'present' && <Image source={icons.dayDone} style={styles.dayGlyph} />}
            {day.state === 'missed' && <Image source={icons.dayMissed} style={styles.dayGlyph} />}
          </View>
          <Text variant="micro">{day.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------ work cards --- */

/**
 * `AAJ KA KAAM` (`485:5066`) — the daily work panel.
 *
 * Worked hours/minutes and the extra-kaam multiplier are unavailable from the contract and show
 * `—`. The bonus bar's segment COUNT is `bonus.targetDays`, never a hardcoded seven, and its
 * threshold sentence takes the number from `bonus.thresholdDays`.
 */
export function DailyWorkCard({
  view,
  bonus,
  copy,
  testID = 'work-card',
}: {
  view: EarningsPeriodView;
  bonus: BonusProgress | null;
  copy: PeriodCopy;
  testID?: string;
}): React.ReactElement {
  const hours = view.workedMinutes === null ? null : Math.floor(view.workedMinutes / 60);
  const minutes = view.workedMinutes === null ? null : view.workedMinutes % 60;

  return (
    <View style={[styles.card, styles.cardYellow]} testID={testID}>
      <SectionLabel>{copy.work}</SectionLabel>

      <View style={styles.workRow}>
        <Image source={icons.timerWide} style={styles.timerWide} />
        <View style={styles.workUnit}>
          {hours === null ? <Unavailable /> : <Text variant="displayXl">{String(hours)}</Text>}
          <Text variant="bodyMuted" color={color.textPrimary}>
            ghante
          </Text>
        </View>
        <View style={styles.workUnit}>
          {minutes === null ? <Unavailable /> : <Text variant="displayXl">{String(minutes)}</Text>}
          <Text variant="bodyMuted" color={color.textPrimary}>
            mins
          </Text>
        </View>
      </View>

      {bonus !== null && <BonusBar bonus={bonus} />}

      <SectionLabel>Extra kaam bonus</SectionLabel>
      <View style={styles.formulaRow}>
        <Chip tone="lime200" muted testID={`${testID}-multiplier`}>
          {unavailableFigure}
        </Chip>
        <Text variant="headingBlack">x</Text>
        <Chip tone="lime200" muted testID={`${testID}-rate`}>
          {unavailableFigure}
        </Chip>
        <Text variant="headingBlack">=</Text>
        <Chip tone="lime400" testID={`${testID}-extra`}>
          {formatSignedRupees(view.breakdown.longHoursPaise)}
        </Chip>
      </View>
    </View>
  );
}

/**
 * The bonus progress bar (`434:2889`).
 *
 * Both the sentence and the geometry are backend-driven: `thresholdDays` supplies the number the
 * cook must beat and `targetDays` supplies the segment count, so a policy change in the earnings
 * config moves this bar without an app release. The design's literal `7` is copy, not policy.
 */
function BonusBar({ bonus }: { bonus: BonusProgress }): React.ReactElement {
  const segments = Math.max(1, Math.min(31, bonus.targetDays));
  const filled = Math.max(0, Math.min(segments, bonus.completedDays));

  return (
    <View style={styles.bonusBox} testID="bonus-bar">
      <Text variant="caption" testID="bonus-bar-hint">
        {'Bonus ke liye: '}
        <Text variant="caption" color={color.success}>
          {`${bonus.thresholdDays} se zyada`}
        </Text>
        {' din kaam'}
      </Text>
      <View
        style={styles.bonusTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: segments, now: filled }}
      >
        {Array.from({ length: segments }, (_, index) => (
          <View
            key={index}
            style={[styles.bonusSegment, index < filled && styles.bonusSegmentFilled]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * `CYCLE KA KAAM` / `MAHINE KA KAAM` (`575:1884`, `575:2013`).
 *
 * Two tiles over their amounts, then the rating strip and the earnings block. The tile COUNTS
 * (`5+` five-star days, long-hours days) are not exposed by the contract; their amounts are.
 */
export function CycleWorkCard({
  view,
  rating,
  copy,
  bonus,
  testID = 'work-card',
}: {
  view: EarningsPeriodView;
  rating: RatingView | null;
  copy: PeriodCopy;
  bonus: BonusProgress | null;
  testID?: string;
}): React.ReactElement {
  const thresholdLabel =
    bonus === null ? 'lambe ghante kaam' : `${bonus.thresholdDays} din se zyada kaam`;

  return (
    <View style={[styles.card, styles.cardYellow]} testID={testID}>
      <SectionLabel>{copy.work}</SectionLabel>

      <View style={styles.tileRow}>
        <View style={styles.tile}>
          <View style={styles.tileHead}>
            <Image source={icons.star} style={styles.starSmall} />
            <Text variant="heading">5+</Text>
          </View>
          <Text variant="captionMuted" color={color.textPrimary}>
            Bohot accha kaam
          </Text>
          <Unavailable testID={`${testID}-rating-count`} />
        </View>

        <View style={styles.tile}>
          <View style={styles.tileHead}>
            <Image source={icons.timer} style={styles.timerSmall} />
            <Text variant="heading">Ghante</Text>
          </View>
          <Text variant="captionMuted" color={color.textPrimary}>
            {thresholdLabel}
          </Text>
          <Unavailable testID={`${testID}-hours-count`} />
        </View>
      </View>

      <View style={styles.tileRow}>
        <Chip tone="lime100" flex testID={`${testID}-rating-bonus`}>
          {formatSignedRupees(view.breakdown.ratingBonusPaise)}
        </Chip>
        <Chip tone="lime100" flex testID={`${testID}-hours-bonus`}>
          {formatSignedRupees(view.breakdown.longHoursPaise)}
        </Chip>
      </View>

      {rating !== null && <RatingStrip rating={rating} />}

      <View style={styles.earningsBlock} testID={`${testID}-earnings`}>
        <SectionLabel>{copy.earnings}</SectionLabel>
        <Text variant="displayLg" testID={`${testID}-gross`}>
          {formatRupees(view.breakdown.grossPaise)}
        </Text>
        <View style={styles.tileRow}>
          <MiniStat label="Base" value={formatRupees(view.breakdown.basePaise)} />
          <MiniStat
            label="Bonus"
            value={formatRupees(view.breakdown.attendanceBonusPaise)}
            testID={`${testID}-bonus`}
          />
          <MiniStat label="Tip" value={formatRupees(view.breakdown.tipsPaise)} />
        </View>
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- rating --- */

/** `RATING · Last 50 kaam` + the average, straight from `/cook/me`. */
export function RatingStrip({
  rating,
  testID = 'rating-strip',
}: {
  rating: RatingView;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.ratingStrip} testID={testID}>
      <View style={styles.ratingText}>
        <SectionLabel>rating</SectionLabel>
        <Text variant="captionMuted" color={color.textPrimary}>
          {`Last ${rating.count} kaam`}
        </Text>
      </View>
      <View style={styles.ratingValue}>
        <Image source={icons.starLg} style={styles.starLarge} />
        <Text variant="display" testID={`${testID}-average`}>
          {rating.average.toFixed(1)}
        </Text>
      </View>
    </View>
  );
}

/**
 * The daily frame's closing panel: rating over `CYCLE BASE (PRATI DIN)`.
 *
 * A per-day base would be `base ÷ days`, which the contract does not provide and the app must not
 * divide into — so the figure shows `—`.
 */
export function DailyRatingCard({
  rating,
  perDayBasePaise,
  testID = 'rating-card',
}: {
  rating: RatingView | null;
  perDayBasePaise: number | null;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={[styles.card, styles.cardBlack]} testID={testID}>
      {rating !== null && <RatingStrip rating={rating} />}
      <View style={styles.baseBlock}>
        <SectionLabel>cycle base (prati din)</SectionLabel>
        {perDayBasePaise === null ? (
          <Unavailable variant="displayLg" testID={`${testID}-per-day`} />
        ) : (
          <Text variant="displayLg" testID={`${testID}-per-day`}>
            {formatRupees(perDayBasePaise)}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- mistakes --- */

/**
 * `AAJ KI GALATIYAAN` (`502:191`) — no-show and late, then the period's total katauti.
 *
 * The two counts show `—`: the backend aggregates penalties by amount and drops the per-type
 * count. `totalDeductionsPaise` IS server-computed (the signed sum of every negative row) and is
 * rendered as-is rather than added up here.
 */
export function MistakesCard({
  view,
  copy,
  testID = 'mistakes-card',
}: {
  view: EarningsPeriodView;
  copy: PeriodCopy;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={[styles.card, styles.cardRed]} testID={testID}>
      <SectionLabel>{copy.mistakes}</SectionLabel>

      <View style={styles.tileRow}>
        <MistakeTile
          icon={icons.noShow}
          title="No show"
          caption="Kaam pe NAHI gaye"
          count={view.noShow.count}
          testID={`${testID}-no-show`}
        />
        <MistakeTile
          icon={icons.lateClock}
          title="Late"
          caption="Kaam pe LATE gaye"
          count={view.late.count}
          testID={`${testID}-late`}
        />
      </View>

      <View style={styles.tileRow}>
        <Chip tone="yellow400" flex testID={`${testID}-no-show-amount`}>
          {formatDeduction(view.noShow.amountPaise)}
        </Chip>
        <Chip tone="yellow400" flex testID={`${testID}-late-amount`}>
          {formatDeduction(view.late.amountPaise)}
        </Chip>
      </View>

      <View style={styles.katautiBlock}>
        <SectionLabel>{copy.deductions}</SectionLabel>
        <Text variant="displayLg" testID={`${testID}-total`}>
          {formatDeduction(view.breakdown.totalDeductionsPaise)}
        </Text>
      </View>
    </View>
  );
}

function MistakeTile({
  icon,
  title,
  caption,
  count,
  testID,
}: {
  icon: ImageSourcePropType;
  title: string;
  caption: string;
  count: number | null;
  testID: string;
}): React.ReactElement {
  return (
    <View style={styles.mistakeTile} testID={testID}>
      <View style={styles.tileHead}>
        <Image source={icon} style={styles.mistakeIcon} />
        <Text variant="heading">{title}</Text>
      </View>
      <Text variant="captionMuted" color={color.textPrimary}>
        {caption}
      </Text>
      {count === null ? (
        <Unavailable testID={`${testID}-count`} />
      ) : (
        <Text variant="displayXl" testID={`${testID}-count`}>
          {String(count)}
        </Text>
      )}
    </View>
  );
}

/* ----------------------------------------------------------------- bands --- */

/**
 * `AAJ KI BASE KE UPAR KI KAMAI`.
 *
 * `aboveBasePaise` is `null` by design. Deriving it as `gross − base` would omit reversals, which
 * the backend keeps in their own signed category — a reversed bonus would still be counted here.
 */
export function AboveBaseBand({
  view,
  copy,
  testID = 'above-base',
}: {
  view: EarningsPeriodView;
  copy: PeriodCopy;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.limeBand} testID={testID}>
      <SectionLabel>{copy.aboveBase}</SectionLabel>
      {view.aboveBasePaise === null ? (
        <Unavailable variant="displayLg" testID={`${testID}-value`} />
      ) : (
        <Text variant="displayLg" testID={`${testID}-value`}>
          {formatSignedRupees(view.aboveBasePaise)}
        </Text>
      )}
    </View>
  );
}

/** `FINAL CYCLE KAMAI` / `FINAL KAMAI` — the server's signed net for the period. */
export function FinalBand({
  label,
  netPaise,
  testID = 'final-band',
}: {
  label: string;
  netPaise: number;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.limeBand} testID={testID}>
      <SectionLabel>{label}</SectionLabel>
      <Text variant="displayLg" testID={`${testID}-value`}>
        {formatRupees(netPaise)}
      </Text>
    </View>
  );
}

/** `SPOON SE AAJ TAK KI KAMAI` — the lifetime total heading the cycle history. */
export function LifetimeBand({
  netPaise,
  testID = 'lifetime-band',
}: {
  netPaise: number;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.limeBand} testID={testID}>
      <SectionLabel>Spoon se aaj tak ki kamai</SectionLabel>
      <Text variant="displayLg" testID={`${testID}-value`}>
        {formatRupees(netPaise)}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ rows --- */

/**
 * A tappable row — the `Cycle ke din` / `Pichle cycles` links and the history lists themselves.
 *
 * The chevron is decorative; the row carries the accessible label so a screen reader announces
 * the destination rather than "image, button".
 */
export function LinkRow({
  label,
  sublabel,
  onPress,
  testID,
}: {
  label: string;
  sublabel?: string | undefined;
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={styles.linkRow}
      accessibilityRole="button"
      accessibilityLabel={sublabel === undefined ? label : `${label}, ${sublabel}`}
      testID={testID}
    >
      <Image source={icons.calendar} style={styles.calendarIcon} />
      <View style={styles.linkRowText}>
        <Text variant="title">{label}</Text>
        {sublabel !== undefined && (
          <Text variant="captionMuted" color={color.textPrimary}>
            {sublabel}
          </Text>
        )}
      </View>
      <Image source={icons.chevron} style={styles.chevron} />
    </Pressable>
  );
}

/* ---------------------------------------------------------------- header --- */

/**
 * `‹ Cycle ke din` — the back header on every pushed Performance screen.
 *
 * The chevron and the title are ONE control with a 44pt target, so the whole affordance is
 * tappable rather than just the 28pt glyph.
 */
export function BackHeader({
  title,
  onBack,
  testID = 'back-header',
}: {
  title: string;
  onBack: () => void;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel={`Wapas, ${title}`}
        hitSlop={spacing.s}
        testID={testID}
      >
        <Image source={icons.chevron} style={styles.backGlyph} />
        <Text variant="headingLg">{title}</Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------- internals --- */

/** The red uppercase caption that opens every panel. */
function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Text variant="bodyStrong" color={color.danger} style={styles.sectionLabel}>
      {children}
    </Text>
  );
}

type ChipTone = 'lime100' | 'lime200' | 'lime400' | 'yellow400';

function Chip({
  children,
  tone,
  flex = false,
  muted = false,
  testID,
}: {
  children: React.ReactNode;
  tone: ChipTone;
  flex?: boolean;
  /** The chip holds a figure the contract does not expose. */
  muted?: boolean;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={[styles.chip, chipTone[tone], flex && styles.chipFlex]} testID={testID}>
      <Text variant="headingBlack" align="center" {...(muted ? { color: color.textMuted } : {})}>
        {children}
      </Text>
    </View>
  );
}

function MiniStat({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.miniStat} testID={testID}>
      <Text variant="captionMuted" color={color.textPrimary} align="center">
        {label}
      </Text>
      <Text variant="title" align="center">
        {value}
      </Text>
    </View>
  );
}

const chipTone: Record<ChipTone, { backgroundColor: string }> = {
  lime100: { backgroundColor: color.lime100 },
  lime200: { backgroundColor: color.lime200 },
  lime400: { backgroundColor: color.lime400 },
  yellow400: { backgroundColor: color.yellow400 },
};

const styles = StyleSheet.create({
  /* tabs */
  tabRow: { flexDirection: 'row', gap: spacing.s },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.s,
    borderRadius: radius.m,
    minHeight: 60,
  },
  tabSelected: { backgroundColor: color.yellow600 },
  tabIdle: { backgroundColor: color.yellow300 },

  /* date banner */
  dateBanner: {
    backgroundColor: color.yellow600,
    borderRadius: radius.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
  },

  /* day strip */
  dayStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { alignItems: 'center', gap: spacing.xs },
  dayDisc: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.yellow300,
  },
  dayDiscPresent: { backgroundColor: color.lime300 },
  dayDiscMissed: { backgroundColor: color.yellow300 },
  dayGlyph: { width: 26, height: 26, resizeMode: 'contain' },

  /* cards */
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    padding: spacing.m,
    gap: spacing.m,
  },
  cardYellow: { borderColor: color.yellow600 },
  cardRed: { borderColor: color.danger },
  cardBlack: { borderColor: color.black },

  sectionLabel: { textTransform: 'uppercase' },

  /* daily work */
  workRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  workUnit: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  timerWide: { width: 45, height: 38, resizeMode: 'contain' },

  bonusBox: {
    backgroundColor: color.lime50,
    borderRadius: radius.m,
    padding: spacing.m,
    gap: spacing.s,
  },
  bonusTrack: { flexDirection: 'row', gap: spacing.xs },
  bonusSegment: {
    flex: 1,
    height: 6,
    borderRadius: radius.xxs,
    backgroundColor: color.lime100,
  },
  bonusSegmentFilled: { backgroundColor: color.lime600 },

  formulaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },

  /* chips */
  chip: {
    borderRadius: radius.m,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    minWidth: 56,
    justifyContent: 'center',
  },
  chipFlex: { flex: 1 },

  /* cycle tiles */
  tileRow: { flexDirection: 'row', gap: spacing.s },
  tile: {
    flex: 1,
    backgroundColor: color.lime300,
    borderRadius: radius.m,
    padding: spacing.m,
    gap: spacing.xs,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  starSmall: { width: 25, height: 25, resizeMode: 'contain' },
  timerSmall: { width: 28, height: 28, resizeMode: 'contain' },

  earningsBlock: {
    backgroundColor: color.lime300,
    borderRadius: radius.m,
    padding: spacing.m,
    gap: spacing.s,
  },
  miniStat: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.m,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.xs,
    gap: spacing.xxs,
  },

  /* rating */
  ratingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.lime100,
    borderRadius: radius.m,
    padding: spacing.m,
    gap: spacing.m,
  },
  ratingText: { flex: 1, gap: spacing.xxs },
  ratingValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  starLarge: { width: 36, height: 36, resizeMode: 'contain' },

  baseBlock: {
    backgroundColor: color.yellow200,
    borderRadius: radius.m,
    padding: spacing.m,
    gap: spacing.xxs,
  },

  /* mistakes */
  mistakeTile: {
    flex: 1,
    backgroundColor: color.yellow300,
    borderRadius: radius.m,
    padding: spacing.m,
    gap: spacing.xs,
  },
  mistakeIcon: { width: 28, height: 28, resizeMode: 'contain' },
  katautiBlock: {
    backgroundColor: color.yellow200,
    borderRadius: radius.m,
    padding: spacing.m,
    gap: spacing.xxs,
  },

  /* bands */
  limeBand: {
    backgroundColor: color.lime300,
    borderRadius: radius.m,
    padding: spacing.l,
    gap: spacing.xxs,
  },

  /* header */
  header: { paddingBottom: spacing.s },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    minHeight: 44,
  },
  // The exported asset is the Figma `back` control — a chevron INSIDE its own ring — so no disc
  // is drawn around it here. It points right; the back affordance points left.
  backGlyph: { width: 33, height: 33, resizeMode: 'contain', transform: [{ scaleX: -1 }] },

  /* rows */
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: color.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: color.yellow600,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    minHeight: 64,
  },
  linkRowText: { flex: 1, gap: spacing.xxs },
  calendarIcon: { width: 35, height: 35, resizeMode: 'contain' },
  chevron: { width: 28, height: 28, resizeMode: 'contain' },
});
