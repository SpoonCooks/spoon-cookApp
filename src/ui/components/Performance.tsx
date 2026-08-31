import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { SvgXml } from 'react-native-svg';

import {
  formatDeduction,
  formatRupees,
  formatSignedRupees,
  unavailableFigure,
  type BonusProgress,
  type DailyHoursView,
  type EarningsPeriodView,
  type PeriodCopy,
  type RatingView,
} from '@core/domain/money';

import * as v13 from '../icons/figmaV13Icons';
import { Text } from '../primitives/Text';
import { useDesignScale, type DesignScale } from '../theme/designScale';
import { figmaStroke } from '../theme/stroke';
import { color, dropShadow } from '../theme/tokens';

/**
 * Building blocks for the Figma **V13** `performance` section (`575:1741`).
 *
 * Seven frames — `575:1744`, `575:1884`, `575:1903`, `575:1922`, `575:2013`, `575:2032`,
 * `575:2098` — are assembled from the pieces below, which is why they live here rather than
 * inside any one screen. Every measurement is transcribed from the design context persisted in
 * `docs/design-context/v13/`, and the node that supplied it is named beside the constant.
 *
 * ## Design units, not device dp
 *
 * The `performance` frames are authored against a **370-unit** content column, the same one
 * `leave` and `log in flow` use. Every length below is therefore stated in design units and
 * passed through `DesignScale.s` at render time, exactly as the verified sections do. The earlier
 * build stated them as raw dp in a static `StyleSheet`, which drew the whole section ~6% small on
 * the 392.7dp reference device — each card looked right on its own and the column they stacked
 * into did not.
 *
 * ## Every visible glyph is the Figma export
 *
 * Icons come from `assets/images/figma-v13/`, downloaded from the design context's own asset URLs
 * and hashed in `ASSETS.json`. The previous build drew `assets/icons/*`, which are 1x rasters at
 * their design size — a 28x28 PNG on a 2.75x display is 77 device pixels stretched from 28, which
 * is exactly the "no 1x V12 render on a high-density device" case the brief names. The V13
 * exports are 90x90 for the same glyphs.
 *
 * ## Figures the deployed contract does not expose
 *
 * Several prominent numerals have no field behind them. `buildBreakdown` in the backend selects
 * `event_count` per event type and then discards it, so `No show 1` / `Late 2` have amounts but no
 * counts; no cook route exposes worked duration, the extra-kaam multiplier, or a per-day base.
 * Those render {@link unavailableFigure} (`—`) rather than a plausible guess, and each is recorded
 * as a backend gap. The AMOUNTS beside them are real, server-computed and signed.
 */

/* ------------------------------------------------------------ design constants --- */

/** `485:5065` — the screen body every frame scrolls. */
const SCREEN = { padding: 16, gap: 16 } as const;

/** The `px-4 py-6` wrapper the design puts around every panel. */
const BLOCK = { paddingH: 4, paddingV: 6 } as const;

/** `434:2931` / `502:196` — the period control. */
const TABS = { padding: 4, radius: 20, gap: 10, buttonRadius: 12, buttonPaddingV: 8 } as const;

/**
 * `434:2870` / `502:8` — a bordered work/mistakes panel.
 *
 * `gap` is the DAILY card's. The cycle and monthly work cards (`492:5390`, `502:207`) set 16 on
 * the same shell, which is why `CycleWorkCard` passes its own.
 */
const CARD = { radius: 15, padding: 12, gap: 12, stroke: 1, cycleGap: 16 } as const;

/**
 * The daily work card is not a flat stack. `434:2872` groups the `AAJ KA KAAM` label with the
 * hours row at **6**, and `531:1693` groups `EXTRA KAAM BONUS` with the formula at **2** — neither
 * is the card's own 12. Laying all four out as siblings put six units under the first label and
 * ten under the second, which is what walked the rating card sixteen rows down the screen while
 * every card above it measured correctly on its own.
 */
const WORK_GROUP = { labelGap: 6, formulaGap: 2 } as const;

/** `502:40` / `536:218` — a filled band inside or below a card. */
const BAND = { radius: 16, padding: 16, gap: 9.99 } as const;

/** `434:2889` — the bonus panel and its seven-segment track. */
const BONUS = {
  radius: 16,
  padding: 11.889,
  gap: 6,
  trackHeight: 10,
  trackPadding: 2,
  segmentGap: 6,
} as const;

/** `531:1703` — `1.75  x  ₹150  =  +₹263`. */
const FORMULA = {
  height: 56,
  padding: 6,
  cellRadius: 5,
  multiplierWidth: 55,
  operatorWidth: 41.356,
  rateWidth: 60,
  resultWidth: 85,
  resultHeight: 44,
} as const;

/** `502:13` / `502:212` — a two-up tile and the grid that holds it. */
const TILE = {
  radius: 7,
  paddingH: 12,
  paddingV: 8,
  gap: 6,
  headGap: 12,
  disc: 28,
  columnGap: 21,
  /**
   * `540:279` / `502:180` — `Frame 59`'s own gap between the tile pair and the amount chips. The
   * card's is 16; this group's is 10.
   */
  groupGap: 10,
  /**
   * `540:281` / `502:213` — the LEAD tile's stated height.
   *
   * The pair is not symmetrical and that is the design's, not a rounding artefact: the `5+` tile
   * is **113** and the `Ghante` tile **109.77**, both in a 113-unit row. The reference renders
   * agree on all three money frames — 113 on the left and 109 on the right — while the app drew
   * both at its own content height of 108. Only the lead tile carries the number, which is why
   * the row is `flex-start` rather than `stretch`: stretching would take `Ghante` to 113 too.
   */
  leadHeight: 113,
} as const;

/** `434:2875` — the timer and the `8 ghante 45 mins` group. */
const WORK = { timerWidth: 45, timerHeight: 38, rowGap: 12, unitGap: 6, groupGap: 16 } as const;

/** `536:212` — the rating disc and its numeral. `headGap` is the 2-unit label/figure gap. */
const RATING = { disc: 38, star: 36, gap: 12, valueWidth: 93, headGap: 2 } as const;

/** `532:109` — a `Base` / `Bonus` / `Tip` cell. Its stroke is **2**, not the card's 1. */
const MINI = { radius: 7, padding: 6, columnGap: 12, stroke: 2 } as const;

/** `505:1241` — one `Mon…Sun` cell. */
const DAYSTRIP = { disc: 35, tick: 30, cross: 34, gap: 6 } as const;

/** `537:491` / `502:434` — a tappable history row. */
const ROW = {
  radius: 15,
  paddingH: 12,
  paddingV: 6,
  gap: 7,
  calendar: 35,
  chevron: 32,
  stroke: 1,
} as const;

/** `502:628` — a past-cycle row, which is taller and rounder than a day row. */
const CYCLE_ROW = { radius: 20, height: 62, innerGap: 10 } as const;

/** `537:488` — the back header on every pushed frame. */
const NAV = { height: 45, gap: 12, glyph: 32 } as const;

const images = {
  /** `502:62` — the wide timer over `8 ghante 45 mins`. 90x90 export drawn at 45x38. */
  timer: require('../../../assets/images/figma-v13/timer.png') as ImageSourcePropType,
  /** `502:860` — the red cross on a no-show tile, and the cross on a missed day. */
  multiply: require('../../../assets/images/figma-v13/multiply.png') as ImageSourcePropType,
  /** `502:861` — the red clock on a late tile. */
  clock: require('../../../assets/images/figma-v13/clock.png') as ImageSourcePropType,
  /** `536:215` — the star inside the rating disc. */
  star: require('../../../assets/images/figma-v13/star.png') as ImageSourcePropType,
  /** `502:626` — the yellow calendar on a history row. */
  calendar: require('../../../assets/images/figma-v13/calendar-yellow.png') as ImageSourcePropType,
  /** `506:1868` — the tick on a present day. */
  dayDone: require('../../../assets/images/figma-v13/day-done.png') as ImageSourcePropType,
} as const;

/**
 * A figure the deployed contract does not expose.
 *
 * Rendered at the same size as the real value so the layout does not jump when the backend starts
 * supplying it, but in the muted ink — an em dash in Livvic Black at 30pt is a solid bar, and a
 * cook should read "not available", not "redacted".
 */
function Unavailable({
  variant = 'displayLg',
  testID,
}: {
  variant?: 'displayLg' | 'display';
  testID?: string | undefined;
}): React.ReactElement {
  return (
    <Text variant={variant} color={color.textMuted} testID={testID}>
      {unavailableFigure}
    </Text>
  );
}

/* ----------------------------------------------------------------- period tabs --- */

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
 * The fill V13 gives a **selected** tab, per tab.
 *
 * Not one colour: `434:2932` (`Aaj`) and `492:5344` (`Cycle`) select to `#ffde33`, while
 * `502:203` (`Mahina`) selects to `#ffd600`. The two differ by 51 levels of blue — four times the
 * comparison tolerance — so collapsing them would score one of the three frames as a mismatch.
 * Stated per key rather than smoothed over, because V13 is the authority on what it draws.
 */
const SELECTED_FILL: Record<string, string> = {
  day: color.yellow500,
  cycle: color.yellow500,
  month: color.yellow600,
};

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
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.tabRow,
        { padding: s(TABS.padding), borderRadius: s(TABS.radius), gap: s(TABS.gap) },
      ]}
      testID={testID}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[
              styles.tab,
              {
                paddingVertical: s(TABS.buttonPaddingV),
                borderRadius: s(TABS.buttonRadius),
                backgroundColor: selected
                  ? (SELECTED_FILL[item.key] ?? color.yellow500)
                  : color.yellow300,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${item.title}, ${item.subtitle}`}
            testID={`${testID}-${item.key}`}
          >
            <Text variant="tabLabel" align="center">
              {item.title}
            </Text>
            <Text variant="tabSubLabel" align="center">
              {item.subtitle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- date band --- */

/**
 * `537:336` — the yellow banner heading a past period (`26th July`, `11th Jul - 17th Jul`).
 *
 * Same shell as {@link PeriodTabs} with a single full-width button, which is how V13 draws it:
 * `537:336` is the `timline` frame with one child instead of three.
 */
export function DateBanner({
  label,
  testID = 'date-banner',
}: {
  label: string;
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[styles.tabRow, { padding: s(TABS.padding), borderRadius: s(TABS.radius) }]}
      testID={testID}
    >
      <View
        style={[
          styles.tab,
          {
            paddingVertical: s(TABS.buttonPaddingV),
            borderRadius: s(TABS.buttonRadius),
            backgroundColor: color.yellow500,
          },
        ]}
      >
        <Text variant="chipLabel" align="center">
          {label}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- day strip --- */

export type DayState = 'present' | 'missed' | 'none';

export interface DayStripEntry {
  readonly label: string;
  readonly state: DayState;
}

/**
 * The `Mon…Sun` strip above the cycle frames (`505:1240`).
 *
 * `state` comes from stored attendance for the cycle window. A day with no record is `none` — an
 * empty `#ffef99` disc, never a cross: "nothing recorded" and "did not come" are different facts,
 * and the design gives them different artwork (`506:1905` vs `506:1869`).
 */
export function DayStrip({
  days,
  testID = 'day-strip',
}: {
  days: readonly DayStripEntry[];
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  const disc = s(DAYSTRIP.disc);
  return (
    <View style={styles.dayStrip} testID={testID}>
      {days.map((day, index) => (
        <View key={`${day.label}-${index}`} style={[styles.dayCell, { gap: s(DAYSTRIP.gap) }]}>
          <View style={{ width: disc, height: disc }}>
            <SvgXml xml={discFor(day.state)} width={disc} height={disc} />
            {day.state === 'present' && (
              <Image
                source={images.dayDone}
                style={[styles.dayGlyph, { width: s(DAYSTRIP.tick), height: s(DAYSTRIP.tick) }]}
                resizeMode="contain"
              />
            )}
            {day.state === 'missed' && (
              <Image
                source={images.multiply}
                style={[styles.dayGlyph, { width: s(DAYSTRIP.cross), height: s(DAYSTRIP.cross) }]}
                resizeMode="contain"
              />
            )}
          </View>
          <Text variant="dayStripLabel" align="center">
            {day.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function discFor(state: DayState): string {
  if (state === 'present') return v13.dayPresentDisc;
  if (state === 'missed') return v13.dayMissedDisc;
  return v13.dayEmptyDisc;
}

/* ------------------------------------------------------------------ work cards --- */

/**
 * `AAJ KA KAAM` (`434:2870`) — the daily work panel.
 *
 * With the GAP-19 `dailyHours` figures present, this card finally renders the design's own
 * dimension: worked time, an HOURS meter ("N se zyada ghante kaam", where N is the policy's
 * long-hours threshold), and the extra-kaam formula — every number the backend's. Against an
 * older deployment `hoursBonus` is null and the card falls back to what it always showed: `—`
 * for the unavailable figures and the day-cycle meter for the bar.
 */
export function DailyWorkCard({
  view,
  bonus,
  hoursBonus = null,
  copy,
  testID = 'work-card',
}: {
  view: EarningsPeriodView;
  bonus: BonusProgress | null;
  hoursBonus?: DailyHoursView | null;
  copy: PeriodCopy;
  testID?: string;
}): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const hours = view.workedMinutes === null ? null : Math.floor(view.workedMinutes / 60);
  const minutes = view.workedMinutes === null ? null : view.workedMinutes % 60;

  return (
    <Card tone="yellow" testID={testID}>
      <View style={[styles.stretch, { gap: s(WORK_GROUP.labelGap) }]}>
        <SectionLabel>{copy.work}</SectionLabel>
        <View style={[styles.row, { gap: s(WORK.rowGap) }]}>
          <Image
            source={images.timer}
            style={{ width: s(WORK.timerWidth), height: s(WORK.timerHeight) }}
            resizeMode="contain"
          />
          <View style={[styles.row, { gap: s(WORK.groupGap) }]}>
            <WorkUnit value={hours} word="ghante" scale={scale} />
            <WorkUnit value={minutes} word="mins" scale={scale} />
          </View>
        </View>
      </View>

      {hoursBonus !== null ? (
        <BonusBar
          threshold={Math.floor(hoursBonus.thresholdMinutes / 60)}
          target={Math.floor(hoursBonus.targetMinutes / 60)}
          completed={Math.floor(hoursBonus.workedMinutes / 60)}
          unitWord="ghante"
        />
      ) : (
        bonus !== null && (
          <BonusBar
            threshold={bonus.thresholdDays}
            target={bonus.targetDays}
            completed={bonus.completedDays}
            unitWord="din"
          />
        )
      )}

      <View style={[styles.stretch, { gap: s(WORK_GROUP.formulaGap) }]}>
        <SectionLabel>Extra kaam bonus</SectionLabel>
        <View
          style={[styles.formulaRow, { height: s(FORMULA.height), padding: s(FORMULA.padding) }]}
        >
          <FormulaCell
            width={FORMULA.multiplierWidth}
            fill={color.lime200}
            muted={view.extraKaamMultiplier === null}
            testID={`${testID}-multiplier`}
          >
            {view.extraKaamMultiplier === null
              ? unavailableFigure
              : view.extraKaamMultiplier.toFixed(2)}
          </FormulaCell>
          <FormulaCell width={FORMULA.operatorWidth}>x</FormulaCell>
          <FormulaCell
            width={FORMULA.rateWidth}
            fill={color.lime200}
            muted={view.extraKaamRatePaise === null}
            testID={`${testID}-rate`}
          >
            {view.extraKaamRatePaise === null
              ? unavailableFigure
              : formatRupees(view.extraKaamRatePaise)}
          </FormulaCell>
          <FormulaCell width={FORMULA.operatorWidth}>=</FormulaCell>
          <FormulaCell
            width={FORMULA.resultWidth}
            height={FORMULA.resultHeight}
            fill={color.lime400}
            testID={`${testID}-extra`}
          >
            {formatSignedRupees(view.breakdown.longHoursPaise)}
          </FormulaCell>
        </View>
      </View>
    </Card>
  );
}

/** `532:95` — one `8 ghante` pair. The numeral and the word share a baseline. */
function WorkUnit({
  value,
  word,
  scale,
}: {
  value: number | null;
  word: string;
  scale: DesignScale;
}): React.ReactElement {
  return (
    <View style={[styles.unit, { gap: scale.s(WORK.unitGap) }]}>
      {value === null ? <Unavailable /> : <Text variant="displayLg">{String(value)}</Text>}
      <Text variant="unitLabel">{word}</Text>
    </View>
  );
}

/**
 * The bonus panel (`434:2889`).
 *
 * Sentence and geometry are backend-driven: the caller supplies the threshold number, the
 * segment count and the fill from whichever server rule the panel is showing, so a policy change
 * moves this bar without an app release.
 *
 * ## The unit word is the caller's, because GAP-19 got its ruling
 *
 * `434:2892` reads `Bonus ke liye: 7 se zyada ghante kaam` — hours — while the original deployed
 * contract only exposed the day-cycle bonus, so this bar once printed `din` as a documented
 * deviation (`docs/COOK_APP_V13_PIXEL_PERFECT_CLOSURE.md`). The contract has since grown
 * `dailyHours` — the ledger's own hours rule — so the daily card passes `ghante` with the
 * policy's threshold, and the cycle meter keeps `din` with the cycle's. Each word is only ever
 * paired with figures from the rule it names.
 */
function BonusBar({
  threshold,
  target,
  completed,
  unitWord,
}: {
  threshold: number;
  target: number;
  completed: number;
  unitWord: 'din' | 'ghante';
}): React.ReactElement {
  const { s } = useDesignScale();
  const segments = Math.max(1, Math.min(31, target));
  const filled = Math.max(0, Math.min(segments, completed));

  return (
    <View
      style={[
        styles.bonusBox,
        { borderRadius: s(BONUS.radius), padding: s(BONUS.padding), gap: s(BONUS.gap) },
        dropShadow(2, 0.05, 1),
      ]}
      testID="bonus-bar"
    >
      <Text variant="bonusHint" testID="bonus-bar-hint">
        {'Bonus ke liye: '}
        <Text variant="bonusHint" color={color.success}>
          {`${threshold} se zyada`}
        </Text>
        {` ${unitWord} kaam`}
      </Text>
      <View
        style={[
          styles.bonusTrack,
          {
            height: s(BONUS.trackHeight),
            padding: s(BONUS.trackPadding),
            gap: s(BONUS.segmentGap),
            borderRadius: s(BONUS.trackHeight),
          },
        ]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: segments, now: filled }}
      >
        {Array.from({ length: segments }, (_, index) => (
          <View
            key={index}
            style={[
              styles.bonusSegment,
              { backgroundColor: index < filled ? color.lime600 : color.yellow200 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * `CYCLE KA KAAM` / `MAHINE KA KAAM` (`492:5352`, `502:207`).
 *
 * Two tiles over their amounts, then the rating strip and the earnings block. The tile COUNTS
 * (`5+` five-star days, long-hours days) are not exposed by the contract; their amounts are.
 */
export function CycleWorkCard({
  view,
  rating,
  copy,
  bonus,
  hoursBonus = null,
  testID = 'work-card',
}: {
  view: EarningsPeriodView;
  rating: RatingView | null;
  copy: PeriodCopy;
  bonus: BonusProgress | null;
  hoursBonus?: DailyHoursView | null;
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  /*
   * `5 hr ke upar kaam` — number AND unit finally from the same rule.
   *
   * GAP-19's backend ruling (`dailyHours`) publishes the long-hours threshold in minutes, so the
   * caption pairs the policy's own number with the design's hour word. Against an older
   * deployment the field is absent and the caption falls back to the old uncomfortable pairing
   * (the day-cycle number with `hr`), which was the documented pre-ruling behaviour.
   */
  const thresholdLabel =
    hoursBonus !== null
      ? `${Math.floor(hoursBonus.thresholdMinutes / 60)} hr ke upar kaam`
      : bonus === null
        ? 'Lambe din kaam'
        : `${bonus.thresholdDays} hr ke upar kaam`;

  return (
    <Card tone="yellow" gap={CARD.cycleGap} testID={testID}>
      <SectionLabel>{copy.work}</SectionLabel>

      {/*
       * `540:279` / `502:180` — `Frame 59` groups the tile pair with the amount chips at **10**,
       * which is NOT the card's 16. Laid out as siblings of the label they took the card's gap and
       * put six extra units between the tiles and the chips.
       *
       * The two errors were cancelling: the tiles were also five units short, so the chips landed
       * on their design row with a sixteen-unit gap above a hundred-and-eight-unit tile instead of
       * a ten-unit gap above a hundred-and-thirteen. Either fix alone moves them off it.
       */}
      <View style={{ gap: s(TILE.groupGap) }}>
        <View style={[styles.tileRow, styles.tileRowTop, { gap: s(TILE.columnGap) }]}>
          <StatTile
            fill={color.lime300}
            glyph={<GlyphOnDisc image={images.star} inset={1} size={25} />}
            title="5+"
            caption="Bohot accha kaam"
            count={view.fiveStarDays}
            height={TILE.leadHeight}
            testID={`${testID}-rating`}
          />
          <StatTile
            fill={color.lime300}
            glyph={<GlyphOnDisc image={images.timer} size={28} />}
            title="Ghante"
            caption={thresholdLabel}
            count={view.longHoursDays}
            testID={`${testID}-hours`}
          />
        </View>

        <View style={[styles.tileRow, { gap: s(TILE.columnGap) }]}>
          <AmountChip fill={color.lime100} testID={`${testID}-rating-bonus`}>
            {formatSignedRupees(view.breakdown.ratingBonusPaise)}
          </AmountChip>
          <AmountChip fill={color.lime100} testID={`${testID}-hours-bonus`}>
            {formatSignedRupees(view.breakdown.longHoursPaise)}
          </AmountChip>
        </View>
      </View>

      {rating !== null && (
        // `502:106` — on a cycle or monthly frame the rating sits on its own lime band. The daily
        // frame's `536:208` does not: there it is a bare row inside the black-bordered card.
        <View
          style={[
            styles.band,
            {
              backgroundColor: color.lime300,
              borderRadius: s(BAND.radius),
              padding: s(BAND.padding),
            },
          ]}
        >
          <RatingStrip rating={rating} />
        </View>
      )}

      <View
        style={[
          styles.band,
          {
            backgroundColor: color.lime300,
            borderRadius: s(BAND.radius),
            padding: s(BAND.padding),
            gap: s(BAND.gap),
          },
        ]}
        testID={`${testID}-earnings`}
      >
        <View style={{ gap: s(RATING.headGap) }}>
          <SectionLabel>{copy.earnings}</SectionLabel>
          <Text variant="display" testID={`${testID}-gross`}>
            {formatRupees(view.breakdown.grossPaise)}
          </Text>
        </View>
        <View style={[styles.tileRow, { gap: s(MINI.columnGap) }]}>
          <MiniStat label="Base" value={formatRupees(view.breakdown.basePaise)} />
          <MiniStat
            label="Bonus"
            value={formatRupees(view.breakdown.attendanceBonusPaise)}
            testID={`${testID}-bonus`}
          />
          <MiniStat label="Tip" value={formatRupees(view.breakdown.tipsPaise)} />
        </View>
      </View>
    </Card>
  );
}

/* ----------------------------------------------------------------------- rating --- */

/** `536:208` — `RATING · Last 50 kaam` + the average, straight from `/cook/me`. */
export function RatingStrip({
  rating,
  testID = 'rating-strip',
}: {
  rating: RatingView;
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  const disc = s(RATING.disc);
  // `cook_profiles.rating_avg` defaults to 0, so an unrated cook arrives here as `{average: 0,
  // count: 0}`. Printing that as `0.0` beside a star tells a cook on her first day that she is
  // rated the worst possible score. `count` is what separates "rated 0" from "never rated", and
  // only the second is representable — so below one rating this shows `—`, the same figure every
  // other unavailable value in this file uses.
  const rated = rating.count > 0;
  return (
    <View style={[styles.row, { gap: s(RATING.headGap) }]} testID={testID}>
      <View style={styles.ratingText}>
        {/* Centred on founder instruction (2026-08-31): the word sat hard left of a block whose
            figure and caption both read centred, so the row looked misaligned on the device. */}
        <SectionLabel align="center">rating</SectionLabel>
        <Text variant="captionMuted" color={color.black80}>
          {rated ? `Last ${rating.count} kaam` : 'Abhi koi rating nahi'}
        </Text>
      </View>
      <View style={[styles.ratingValue, { width: s(RATING.valueWidth), gap: s(RATING.gap) }]}>
        <View style={{ width: disc, height: disc }}>
          <SvgXml xml={v13.ratingDisc} width={disc} height={disc} />
          <Image
            source={images.star}
            style={[
              styles.discGlyph,
              { left: s(1), top: s(1), width: s(RATING.star), height: s(RATING.star) },
            ]}
            resizeMode="contain"
          />
        </View>
        {rated ? (
          <Text variant="display" testID={`${testID}-average`}>
            {rating.average.toFixed(1)}
          </Text>
        ) : (
          <Unavailable variant="display" testID={`${testID}-average`} />
        )}
      </View>
    </View>
  );
}

/**
 * `536:207` — the daily frame's closing panel: rating over `CYCLE BASE (PRATI DIN)`.
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
  const { s } = useDesignScale();
  return (
    <Card tone="black" radius={BAND.radius} padding={BAND.padding} gap={BAND.gap} testID={testID}>
      {rating !== null && <RatingStrip rating={rating} />}
      <View
        style={[
          styles.band,
          {
            backgroundColor: color.yellow200,
            borderRadius: s(BAND.radius),
            padding: s(BAND.padding),
            gap: s(RATING.headGap),
          },
        ]}
      >
        <SectionLabel>cycle base (prati din)</SectionLabel>
        {perDayBasePaise === null ? (
          <Unavailable variant="display" testID={`${testID}-per-day`} />
        ) : (
          <Text variant="display" testID={`${testID}-per-day`}>
            {formatRupees(perDayBasePaise)}
          </Text>
        )}
      </View>
    </Card>
  );
}

/* --------------------------------------------------------------------- mistakes --- */

/**
 * `AAJ KI GALATIYAAN` (`502:8`) — no-show and late, then the period's total katauti.
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
  const { s } = useDesignScale();
  return (
    <Card tone="red" testID={testID}>
      <SectionLabel>{copy.mistakes}</SectionLabel>

      <View style={[styles.tileRow, { gap: s(TILE.columnGap) }]}>
        <StatTile
          fill={color.yellow300}
          glyph={<GlyphOnDisc image={images.multiply} size={TILE.disc} />}
          title="No show"
          titleVariant="timeStrong"
          caption="Kaam pe NAHI gaye"
          count={view.noShow.count}
          testID={`${testID}-no-show`}
        />
        <StatTile
          fill={color.yellow300}
          glyph={<GlyphOnDisc image={images.clock} size={TILE.disc} />}
          title="Late"
          titleVariant="timeStrong"
          caption="Kaam pe LATE gaye"
          /*
           * V14 draws MINUTES here — `8 min`, `20 min`, `2 min` — not a count of late arrivals.
           * The deployed contract exposes only the count, so that is what production still shows;
           * the moment `lateMinutes` appears on the projection the tile reads the way the design
           * does, with no client release. See `EarningsPeriodView.lateMinutes`.
           */
          count={view.lateMinutes === null ? view.late.count : `${view.lateMinutes} min`}
          testID={`${testID}-late`}
        />
      </View>

      <View style={[styles.tileRow, { gap: s(TILE.columnGap) }]}>
        <AmountChip fill={color.yellow400} testID={`${testID}-no-show-amount`}>
          {formatDeduction(view.noShow.amountPaise)}
        </AmountChip>
        <AmountChip fill={color.yellow400} testID={`${testID}-late-amount`}>
          {formatDeduction(view.late.amountPaise)}
        </AmountChip>
      </View>

      <View
        style={[
          styles.band,
          {
            backgroundColor: color.yellow200,
            borderRadius: s(BAND.radius),
            padding: s(BAND.padding),
            gap: s(RATING.headGap),
          },
        ]}
      >
        <SectionLabel>{copy.deductions}</SectionLabel>
        <Text variant="display" testID={`${testID}-total`}>
          {formatDeduction(view.breakdown.totalDeductionsPaise)}
        </Text>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------------ bands --- */

/**
 * `492:5296` — `AAJ KI BASE KE UPAR KI KAMAI`.
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
    <LimeBand testID={testID}>
      <SectionLabel>{copy.aboveBase}</SectionLabel>
      {view.aboveBasePaise === null ? (
        <Unavailable variant="display" testID={`${testID}-value`} />
      ) : (
        <Text variant="display" testID={`${testID}-value`}>
          {formatSignedRupees(view.aboveBasePaise)}
        </Text>
      )}
    </LimeBand>
  );
}

/** `540:105` — `FINAL CYCLE KAMAI` / `FINAL KAMAI`. `netPaise` is the ledger's own net. */
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
    <LimeBand testID={testID}>
      <SectionLabel>{label}</SectionLabel>
      <Text variant="display" testID={`${testID}-value`}>
        {formatRupees(netPaise)}
      </Text>
    </LimeBand>
  );
}

/** `502:301` — `SPOON SE AAJ TAK KI KAMAI`, the lifetime total on the cycle-history frame. */
export function LifetimeBand({
  netPaise,
  testID = 'lifetime-band',
}: {
  netPaise: number;
  testID?: string;
}): React.ReactElement {
  return (
    <LimeBand testID={testID}>
      <SectionLabel>Spoon se aaj tak ki kamai</SectionLabel>
      <Text variant="display" testID={`${testID}-value`}>
        {formatRupees(netPaise)}
      </Text>
    </LimeBand>
  );
}

/* ------------------------------------------------------------------------- rows --- */

/**
 * `502:434` / `537:491` / `502:628` — a tappable row: the `Cycle ke din` / `Pichle cycles` links
 * and the history lists themselves.
 *
 * With a `sublabel` the row is a past **cycle** (`502:628`): rounder, taller, and stacking the
 * range over `Kamai: ₹7,839`. Without one it is a link or a past **day** (`537:491`).
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
  const scale = useDesignScale();
  const { s } = scale;
  const isCycle = sublabel !== undefined;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.linkRow,
        figmaStroke(scale, {
          width: ROW.stroke,
          paddingH: ROW.paddingH,
          paddingV: ROW.paddingV,
          align: 'inside',
        }),
        {
          borderRadius: s(isCycle ? CYCLE_ROW.radius : ROW.radius),
          gap: s(ROW.gap),
          ...(isCycle ? { minHeight: s(CYCLE_ROW.height) } : {}),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={sublabel === undefined ? label : `${label}, ${sublabel}`}
      testID={testID}
    >
      <Image
        source={images.calendar}
        style={{ width: s(ROW.calendar), height: s(ROW.calendar) }}
        resizeMode="contain"
      />
      <View style={styles.linkRowText}>
        {isCycle ? (
          <View style={{ gap: s(CYCLE_ROW.innerGap) }}>
            <Text variant="cycleRowTitle">{label}</Text>
            <View style={[styles.row, { gap: s(CYCLE_ROW.innerGap) }]}>
              <Text variant="unitLabel">Kamai:</Text>
              <Text variant="title">{sublabel}</Text>
            </View>
          </View>
        ) : (
          <Text variant="headingBlack">{label}</Text>
        )}
      </View>
      <View style={styles.rowChevron}>
        <SvgXml xml={v13.rowChevron} width={s(ROW.chevron)} height={s(ROW.chevron)} />
      </View>
    </Pressable>
  );
}

/* ----------------------------------------------------------------------- header --- */

/**
 * `537:488` — `‹ Cycle ke din`, the back header on every pushed Performance frame.
 *
 * The glyph and the title are ONE control with a 44pt target, so the whole affordance is tappable
 * rather than just the 32-unit glyph.
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
  const { s } = useDesignScale();
  return (
    <View style={[styles.header, { height: s(NAV.height) }]}>
      <Pressable
        onPress={onBack}
        style={[
          styles.backButton,
          {
            gap: s(NAV.gap),
            paddingHorizontal: s(BLOCK.paddingH),
            paddingVertical: s(BLOCK.paddingV),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Wapas, ${title}`}
        hitSlop={8}
        testID={testID}
      >
        <SvgXml xml={v13.navBack} width={s(NAV.glyph)} height={s(NAV.glyph)} />
        <Text variant="headingLg">{title}</Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------- internals --- */

/** The red uppercase caption that opens every panel (`502:371`). */
function SectionLabel({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}): React.ReactElement {
  return (
    <Text
      variant="overline"
      color={color.danger}
      style={styles.upper}
      {...(align === undefined ? {} : { align })}
    >
      {children}
    </Text>
  );
}

/** `434:2870` — a bordered panel. The stroke is centre-aligned, so it goes through `figmaStroke`. */
function Card({
  children,
  tone,
  radius = CARD.radius,
  padding = CARD.padding,
  gap = CARD.gap,
  testID,
}: {
  children: React.ReactNode;
  tone: 'yellow' | 'red' | 'black';
  radius?: number;
  padding?: number;
  gap?: number;
  testID?: string;
}): React.ReactElement {
  const scale = useDesignScale();
  const border = tone === 'yellow' ? color.yellow600 : tone === 'red' ? color.danger : color.black;
  return (
    <View
      style={[
        styles.card,
        figmaStroke(scale, { width: CARD.stroke, padding, align: 'inside' }),
        { borderColor: border, borderRadius: scale.s(radius), gap: scale.s(gap) },
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/** `492:5296` — a filled lime panel with a label over one figure. */
function LimeBand({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.band,
        {
          backgroundColor: color.lime300,
          borderRadius: s(CARD.radius),
          padding: s(CARD.padding),
          gap: s(RATING.headGap),
        },
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/** `502:852` — a 28-unit white disc with a Figma glyph centred on it. */
function GlyphOnDisc({
  image,
  size,
  inset = 0,
}: {
  image: ImageSourcePropType;
  size: number;
  inset?: number;
}): React.ReactElement {
  const { s } = useDesignScale();
  const disc = s(TILE.disc);
  return (
    <View style={{ width: disc, height: disc }}>
      <SvgXml xml={v13.mistakeDisc} width={disc} height={disc} />
      <Image
        source={image}
        style={[
          styles.discGlyph,
          { left: s(inset), top: s(inset), width: s(size), height: s(size) },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

/** `502:13` / `502:212` — a two-up tile: glyph + title, caption, then a figure. */
function StatTile({
  fill,
  glyph,
  title,
  titleVariant = 'headingLgBold',
  caption,
  count,
  height,
  testID,
}: {
  fill: string;
  glyph: React.ReactElement;
  title: string;
  titleVariant?: 'headingLgBold' | 'timeStrong';
  caption: string;
  /** A number, or an already-formatted value where the design states a unit (`20 min`). */
  count?: number | string | null;
  /** A fixed height, where the frame states one. Omit to size to content. */
  height?: number;
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: fill,
          borderRadius: s(TILE.radius),
          paddingHorizontal: s(TILE.paddingH),
          paddingVertical: s(TILE.paddingV),
          gap: s(TILE.gap),
          ...(height === undefined ? {} : { height: s(height) }),
        },
      ]}
      testID={testID}
    >
      <View style={{ gap: s(TILE.gap) }}>
        <View style={[styles.row, { gap: s(TILE.headGap) }]}>
          {glyph}
          <Text variant={titleVariant} color={color.grey900}>
            {title}
          </Text>
        </View>
        <Text variant="captionMuted" color={color.black80}>
          {caption}
        </Text>
      </View>
      <View style={styles.tileCount}>
        {count === undefined || count === null ? (
          <Unavailable testID={testID === undefined ? undefined : `${testID}-count`} />
        ) : (
          <Text variant="displayLg" testID={`${testID}-count`}>
            {String(count)}
          </Text>
        )}
      </View>
    </View>
  );
}

/** `502:36` / `502:236` — a filled amount cell under a tile pair. */
function AmountChip({
  children,
  fill,
  testID,
}: {
  children: React.ReactNode;
  fill: string;
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.amountChip,
        {
          backgroundColor: fill,
          borderRadius: s(TILE.radius),
          paddingHorizontal: s(TILE.paddingH),
          paddingVertical: s(TILE.paddingV),
        },
      ]}
      testID={testID}
    >
      <Text variant="headingLgBold" align="center">
        {children}
      </Text>
    </View>
  );
}

/** `531:1703` — one cell of the extra-kaam formula. Operators have no fill. */
function FormulaCell({
  children,
  width,
  height,
  fill,
  muted = false,
  testID,
}: {
  children: React.ReactNode;
  width: number;
  height?: number;
  fill?: string;
  muted?: boolean;
  testID?: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.formulaCell,
        { width: s(width) },
        height === undefined ? styles.formulaCellStretch : { height: s(height) },
        fill === undefined ? null : { backgroundColor: fill, borderRadius: s(FORMULA.cellRadius) },
      ]}
      testID={testID}
    >
      <Text variant="timeStrong" align="center" {...(muted ? { color: color.textMuted } : {})}>
        {children}
      </Text>
    </View>
  );
}

/** `532:109` — a `Base` / `Bonus` / `Tip` cell. White, with a 2-unit lime stroke. */
function MiniStat({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}): React.ReactElement {
  const scale = useDesignScale();
  return (
    <View
      style={[
        styles.miniStat,
        figmaStroke(scale, { width: MINI.stroke, padding: MINI.padding, align: 'outside' }),
        { borderRadius: scale.s(MINI.radius) },
      ]}
      testID={testID}
    >
      <Text variant="captionMuted" color={color.black} align="center">
        {label}
      </Text>
      <Text variant="timeStrong" align="center">
        {value}
      </Text>
    </View>
  );
}

/** Design-space measurements the screens need when they lay these pieces out. */
export const performanceLayout = {
  screen: SCREEN,
  block: BLOCK,
  nav: NAV,
} as const;

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', alignItems: 'stretch' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // `505:1240` is a seven-column grid, not a spaced row: every cell is exactly a seventh of the
  // width and its disc is centred inside it. `space-between` instead pins the first and last cells
  // to the edges, which put `Mon` four units left of its design column and left the strip a few
  // units short — enough to walk the card below it off its row.
  dayStrip: { flexDirection: 'row', alignItems: 'flex-start' },
  dayCell: { flex: 1, alignItems: 'center' },
  dayGlyph: { position: 'absolute', alignSelf: 'center', top: '7%' },

  card: { backgroundColor: color.surface, alignSelf: 'stretch' },
  stretch: { alignSelf: 'stretch' },
  upper: { textTransform: 'uppercase' },

  row: { flexDirection: 'row', alignItems: 'center' },
  unit: { flexDirection: 'row', alignItems: 'center' },

  bonusBox: { backgroundColor: color.lime100, alignSelf: 'stretch' },
  bonusTrack: { flexDirection: 'row', backgroundColor: color.surface, overflow: 'hidden' },
  bonusSegment: { flex: 1, borderRadius: 999 },

  formulaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  formulaCell: { alignItems: 'center', justifyContent: 'center' },
  formulaCellStretch: { alignSelf: 'stretch' },

  tileRow: { flexDirection: 'row', alignItems: 'stretch' },
  /** The money tile pair, where the design's two tiles are DIFFERENT heights. See `TILE.leadHeight`. */
  tileRowTop: { alignItems: 'flex-start' },
  tile: { flex: 1 },
  tileCount: { alignItems: 'center', justifyContent: 'center' },
  amountChip: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  band: { alignSelf: 'stretch' },

  ratingText: { flex: 1 },
  ratingValue: { flexDirection: 'row', alignItems: 'center' },
  discGlyph: { position: 'absolute' },

  miniStat: {
    flex: 1,
    backgroundColor: color.surface,
    alignItems: 'center',
    borderColor: color.lime600,
  },

  header: { justifyContent: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center' },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderColor: color.yellow600,
    overflow: 'hidden',
  },
  linkRowText: { flex: 1 },
  // `502:438` — the exported `back` glyph turned into the row's forward chevron.
  rowChevron: { transform: [{ rotate: '179.55deg' }] },
});
