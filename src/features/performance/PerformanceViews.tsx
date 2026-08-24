import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  periodCopy,
  type BonusProgress,
  type EarningsPeriod,
  type EarningsPeriodView,
  type RatingView,
} from '@core/domain/money';
import {
  AboveBaseBand,
  BackHeader,
  color,
  CycleWorkCard,
  DailyRatingCard,
  DailyWorkCard,
  DateBanner,
  DayStrip,
  EmptyState,
  FinalBand,
  LifetimeBand,
  LinkRow,
  MistakesCard,
  PeriodTabs,
  useDesignScale,
  type DayStripEntry,
} from '@ui';

/**
 * The seven V13 `performance` frames as presentational views.
 *
 * ## Why these are not inside the routes
 *
 * Every frame has to be reachable twice: once from `src/app/money/*` against the live contract,
 * and once from `/dev` against a fixed fixture, and the two must be the *same pixels*. Keeping the
 * composition here means the gallery renders what a cook renders — it supplies different data, not
 * a different screen. A view that existed only for `/dev` would prove nothing.
 *
 * Nothing in this file fetches, mutates or navigates on its own: every figure arrives as a prop
 * and every tap leaves through a callback.
 *
 * ## Geometry
 *
 * `485:5065` — the scrolling body is **white** (not the app's cream), `p-16`, `gap-16`; and every
 * panel sits in its own `px-4 py-6` block (`485:5066`). Those three numbers are what put 28 design
 * units between two cards rather than 16, and the horizontal inset at 20 rather than 16.
 */

/** `485:5065` — the screen body. */
const PAGE = { padding: 16, gap: 16 } as const;

/** `485:5066` — the `px-4 py-6` wrapper every panel sits in. */
const BLOCK = { paddingH: 4, paddingV: 6 } as const;

/** Design widths V13 pins on individual blocks, where it pins one at all. */
const WIDTH = { panel: 340, nav: 338, cycleRow: 330 } as const;

export interface PerformanceScreenProps {
  readonly children: React.ReactNode;
  readonly header?: React.ReactNode | undefined;
  readonly testID: string;
  readonly refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}

/**
 * The scrolling shell every Performance frame shares.
 *
 * The safe-area inset is applied here rather than by the caller so a frame cannot pick it up
 * twice — a double inset renders the whole screen ~49dp low, which reads in a diff as if every
 * element were misplaced rather than as one wrong padding.
 */
export function PerformanceScreen({
  children,
  header,
  testID,
  refreshControl,
}: PerformanceScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { s } = useDesignScale();
  return (
    <View style={styles.screen} testID={testID}>
      <View style={{ height: insets.top }} />
      {header !== undefined && (
        <View style={{ paddingHorizontal: s(PAGE.padding), width: s(WIDTH.nav) }}>{header}</View>
      )}
      <ScrollView
        contentContainerStyle={{
          padding: s(PAGE.padding),
          gap: s(PAGE.gap),
          paddingBottom: insets.bottom + s(PAGE.padding),
        }}
        {...(refreshControl === undefined ? {} : { refreshControl })}
        testID={`${testID}-scroll`}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** `485:5066` — one `px-4 py-6` block. `width` is set only where V13 pins one. */
export function Block({
  children,
  width,
  gap,
}: {
  children: React.ReactNode;
  width?: number | undefined;
  gap?: number | undefined;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        { paddingHorizontal: s(BLOCK.paddingH), paddingVertical: s(BLOCK.paddingV) },
        width === undefined ? styles.fullWidth : { width: s(width) },
        gap === undefined ? null : { gap: s(gap) },
      ]}
    >
      {children}
    </View>
  );
}

export interface MoneyPeriodViewProps {
  readonly period: EarningsPeriod;
  readonly view: EarningsPeriodView;
  readonly bonus: BonusProgress | null;
  readonly rating: RatingView | null;
  readonly days: readonly DayStripEntry[];
  readonly tabs: readonly { key: string; title: string; subtitle: string }[];
  readonly onChangePeriod: (period: EarningsPeriod) => void;
  readonly onOpenDays?: (() => void) | undefined;
  readonly onOpenCycles?: (() => void) | undefined;
  readonly refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}

/**
 * `575:1744` / `575:1884` / `575:2013` — the three period frames, which are one screen.
 *
 * Switching period must not push a route: all three read different server-computed windows of the
 * same `GET /cook/earnings` payload.
 */
export function MoneyPeriodView({
  period,
  view,
  bonus,
  rating,
  days,
  tabs,
  onChangePeriod,
  onOpenDays,
  onOpenCycles,
  refreshControl,
}: MoneyPeriodViewProps): React.ReactElement {
  const copy = periodCopy[period];
  return (
    <PerformanceScreen testID="money" {...(refreshControl === undefined ? {} : { refreshControl })}>
      <PeriodTabs
        items={tabs}
        value={period}
        onChange={(key) => onChangePeriod(key as EarningsPeriod)}
      />

      {period === 'cycle' && days.length > 0 && (
        <Block>
          <DayStrip days={days} />
        </Block>
      )}

      <Block width={WIDTH.panel}>
        {period === 'day' ? (
          <DailyWorkCard view={view} bonus={bonus} copy={copy} />
        ) : (
          <CycleWorkCard
            view={view}
            // `502:195` carries no rating strip; `492:5339` does.
            rating={period === 'cycle' ? rating : null}
            copy={copy}
            bonus={bonus}
          />
        )}
      </Block>

      <Block>
        <MistakesCard view={view} copy={copy} />
      </Block>

      {period === 'day' ? (
        <>
          <Block width={WIDTH.panel}>
            <AboveBaseBand view={view} copy={copy} />
          </Block>
          <DailyRatingCard rating={rating} perDayBasePaise={view.perDayBasePaise} />
        </>
      ) : (
        <Block width={WIDTH.panel}>
          <FinalBand label={copy.final} netPaise={view.breakdown.netPaise} />
        </Block>
      )}

      {period === 'cycle' && onOpenDays !== undefined && (
        <Block>
          <LinkRow label="Cycle ke din" onPress={onOpenDays} testID="money-cycle-days" />
        </Block>
      )}
      {period === 'month' && onOpenCycles !== undefined && (
        <Block>
          <LinkRow label="Pichle cycles" onPress={onOpenCycles} testID="money-past-cycles" />
        </Block>
      )}
    </PerformanceScreen>
  );
}

/** `575:1922` `15- past daily` — the daily frame behind a back header and a date banner. */
export function PastDayView({
  label,
  view,
  bonus,
  rating,
  onBack,
}: {
  label: string;
  view: EarningsPeriodView;
  bonus: BonusProgress | null;
  rating: RatingView | null;
  onBack: () => void;
}): React.ReactElement {
  const copy = periodCopy['day'];
  return (
    <PerformanceScreen
      testID="past-day"
      header={<BackHeader title="Din ki kamai" onBack={onBack} />}
    >
      <DateBanner label={label} />
      <Block width={WIDTH.panel}>
        <DailyWorkCard view={view} bonus={bonus} copy={copy} />
      </Block>
      <Block>
        <MistakesCard view={view} copy={copy} />
      </Block>
      <Block width={WIDTH.panel}>
        <AboveBaseBand view={view} copy={copy} />
      </Block>
      <DailyRatingCard rating={rating} perDayBasePaise={view.perDayBasePaise} />
    </PerformanceScreen>
  );
}

/** `575:2098` `18- past weekly` — the cycle frame behind a back header and a date banner. */
export function PastCycleView({
  label,
  view,
  rating,
  days,
  onBack,
  onOpenDays,
}: {
  label: string;
  view: EarningsPeriodView;
  rating: RatingView | null;
  days: readonly DayStripEntry[];
  onBack: () => void;
  onOpenDays: () => void;
}): React.ReactElement {
  const copy = periodCopy['cycle'];
  return (
    <PerformanceScreen
      testID="past-cycle"
      header={<BackHeader title="Cycle ki kamai" onBack={onBack} />}
    >
      <DateBanner label={label} />
      {days.length > 0 && (
        <Block>
          <DayStrip days={days} />
        </Block>
      )}
      <Block width={WIDTH.panel}>
        <CycleWorkCard view={view} rating={rating} copy={copy} bonus={null} />
      </Block>
      <Block>
        <MistakesCard view={view} copy={copy} />
      </Block>
      <Block width={WIDTH.panel}>
        <FinalBand label={copy.final} netPaise={view.breakdown.netPaise} />
      </Block>
      <Block>
        <LinkRow label="Cycle ke din" onPress={onOpenDays} testID="past-cycle-days" />
      </Block>
    </PerformanceScreen>
  );
}

/** `575:1903` `14- day history` — the cycle's days, one tappable row each. */
export function DayHistoryView({
  days,
  emptyMessage,
  onBack,
  onOpenDay,
}: {
  days: readonly { dateIso: string; label: string }[];
  emptyMessage: string;
  onBack: () => void;
  onOpenDay: (dateIso: string) => void;
}): React.ReactElement {
  return (
    <PerformanceScreen
      testID="day-history"
      header={<BackHeader title="Cycle ke din" onBack={onBack} />}
    >
      {days.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <Block width={WIDTH.nav} gap={PAGE.gap}>
          {days.map((day, index) => (
            <LinkRow
              key={`${day.dateIso}-${index}`}
              label={day.label}
              onPress={() => onOpenDay(day.dateIso)}
              testID={`day-${day.dateIso}`}
            />
          ))}
        </Block>
      )}
    </PerformanceScreen>
  );
}

/** `575:2032` `17- weekly history` — the lifetime total, then one row per closed cycle. */
export function CycleHistoryView({
  lifetimePaise,
  cycles,
  emptyMessage,
  onBack,
  onOpenCycle,
}: {
  lifetimePaise: number | null;
  cycles: readonly { cycleId: string; label: string; earnings: string }[];
  emptyMessage: string;
  onBack: () => void;
  onOpenCycle: (cycleId: string) => void;
}): React.ReactElement {
  return (
    <PerformanceScreen
      testID="cycle-history"
      header={<BackHeader title="Pichle cycles" onBack={onBack} />}
    >
      {lifetimePaise !== null && (
        <Block width={WIDTH.panel}>
          <LifetimeBand netPaise={lifetimePaise} />
        </Block>
      )}
      {cycles.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <Block gap={PAGE.gap}>
          {cycles.map((cycle) => (
            <Block key={cycle.cycleId} width={WIDTH.cycleRow}>
              <LinkRow
                label={cycle.label}
                sublabel={cycle.earnings}
                onPress={() => onOpenCycle(cycle.cycleId)}
                testID={`cycle-${cycle.cycleId}`}
              />
            </Block>
          ))}
        </Block>
      )}
    </PerformanceScreen>
  );
}

const styles = StyleSheet.create({
  // `485:5065` — white, not the app's cream background.
  screen: { flex: 1, backgroundColor: color.surface },
  fullWidth: { width: '100%' },
});
