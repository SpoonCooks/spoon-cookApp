import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  periodResponseFor,
  serviceDatesBetween,
  toBonusProgress,
  toEarningsPeriodView,
} from '@core/api/adapters';
import { apiErrorMessage, isSessionExpired } from '@core/api/errors';
import { useAttendanceRange, useCookProfile, useEarnings } from '@core/api/queries';
import {
  earningsPeriodLabels,
  earningsPeriods,
  periodCopy,
  type EarningsPeriod,
  type RatingView,
} from '@core/domain/money';
import { useSession } from '@core/session/store';
import {
  AboveBaseBand,
  color,
  CycleWorkCard,
  DailyRatingCard,
  DailyWorkCard,
  DayStrip,
  ErrorState,
  FinalBand,
  LinkRow,
  LoadingState,
  MistakesCard,
  PeriodTabs,
  spacing,
  type DayStripEntry,
} from '@ui';

/**
 * My Money — Figma V12 section `performance` (`575:1741`).
 *
 * Three frames, one screen, selected by the `Aaj / Cycle / Mahina` control:
 *
 *   `575:1744` `12- money daily`   → `earnings.daily`     (today, IST service date)
 *   `575:1884` `13- money weekly`  → `earnings.sevenDay`  (today-6 … today)
 *   `575:2013` `16- money monthly` → `earnings.monthly`   (month start … today)
 *
 * ## V11 → V12
 *
 * The old `Performance & earnings` section (`540:397`) was deleted from the file, not edited: all
 * seven of its 390-wide frames are gone and seven new 370-wide frames replace them under a new
 * section id. This screen is therefore a rebuild rather than a restyle.
 *
 * ## Every figure here is the server's
 *
 * The period totals come from `GET /v1/cook/earnings`, whose `breakdown` is the backend's
 * reversal-safe `CookEarningsBreakdown`: fourteen signed categories where a reversal keeps its own
 * bucket. Nothing on this screen adds those categories together — `grossPaise`, `netPaise` and
 * `totalDeductionsPaise` are all computed by the ledger query itself.
 *
 * The bonus bar's threshold and segment count come from `bonus.thresholdDays` / `bonus.targetDays`,
 * so neither the design's literal `7` nor the disputed five-hour variant is hardcoded.
 *
 * ## `Mahina — 28 din`
 *
 * The tab is labelled `28 din` but the deployed `monthly` period is month-start-to-today, not a
 * rolling 28 days. The label is the design's; the window is the server's, and the frame prints the
 * real `startDate`/`endDate` beneath it rather than implying 28 days were measured.
 */
export default function MoneyScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const signOut = useSession((s) => s.signOut);
  const [period, setPeriod] = useState<EarningsPeriod>('day');

  const earnings = useEarnings();
  const profile = useCookProfile();

  // The Mon–Sun strip is stored attendance for the seven-day window, not an earnings fact.
  const week = earnings.data?.sevenDay ?? null;
  const attendance = useAttendanceRange(
    { from: week?.startDate ?? '', to: week?.endDate ?? '' },
    period === 'cycle' && week !== null,
  );

  const view = useMemo(
    () =>
      earnings.data === undefined
        ? null
        : toEarningsPeriodView(period, periodResponseFor(earnings.data, period)),
    [earnings.data, period],
  );

  const bonus = useMemo(
    () => (earnings.data === undefined ? null : toBonusProgress(earnings.data)),
    [earnings.data],
  );

  const rating: RatingView | null = useMemo(
    () =>
      profile.data === undefined
        ? null
        : { average: profile.data.cook.rating.average, count: profile.data.cook.rating.count },
    [profile.data],
  );

  const days: readonly DayStripEntry[] = useMemo(() => {
    if (week === null) return [];
    const marks = new Map((attendance.data ?? []).map((row) => [row.serviceDate, row.status]));
    return serviceDatesBetween(week.startDate, week.endDate).map((dateIso) => {
      const status = marks.get(dateIso);
      return {
        label: weekdayLabel(dateIso),
        // A date with no stored record is `none`, never `missed`: the backend only returns days
        // it actually has a record for, so absence of a row is absence of information.
        state:
          status === 'present'
            ? ('present' as const)
            : status === undefined
              ? ('none' as const)
              : ('missed' as const),
      };
    });
  }, [week, attendance.data]);

  if (earnings.isPending) return <LoadingState testID="money-loading" />;

  if (earnings.isError) {
    if (isSessionExpired(earnings.error)) {
      signOut();
      router.replace('/login');
    }
    return (
      <ErrorState
        message={apiErrorMessage(earnings.error)}
        onRetry={() => void earnings.refetch()}
        testID="money-error"
      />
    );
  }

  if (view === null) return <LoadingState testID="money-loading" />;

  const copy = periodCopy[period];
  const tabs = earningsPeriods.map((key) => ({
    key,
    title: earningsPeriodLabels[key].title,
    subtitle: earningsPeriodLabels[key].subtitle,
  }));

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.m, paddingBottom: insets.bottom + spacing.huge },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={earnings.isFetching}
            onRefresh={() => void earnings.refetch()}
          />
        }
        testID="money-scroll"
      >
        <PeriodTabs
          items={tabs}
          value={period}
          onChange={(key) => setPeriod(key as EarningsPeriod)}
        />

        {period === 'cycle' && days.length > 0 && <DayStrip days={days} />}

        {period === 'day' ? (
          <DailyWorkCard view={view} bonus={bonus} copy={copy} />
        ) : (
          <CycleWorkCard
            view={view}
            // The monthly frame carries no rating strip; the weekly one does.
            rating={period === 'cycle' ? rating : null}
            copy={copy}
            bonus={bonus}
          />
        )}

        <MistakesCard view={view} copy={copy} />

        {period === 'day' ? (
          <>
            <AboveBaseBand view={view} copy={copy} />
            <DailyRatingCard rating={rating} perDayBasePaise={view.perDayBasePaise} />
          </>
        ) : (
          <FinalBand label={copy.final} netPaise={view.breakdown.netPaise} />
        )}

        {period === 'cycle' && (
          <LinkRow
            label="Cycle ke din"
            onPress={() => router.push('/money/days')}
            testID="money-cycle-days"
          />
        )}
        {period === 'month' && (
          <LinkRow
            label="Pichle cycles"
            onPress={() => router.push('/money/cycles')}
            testID="money-past-cycles"
          />
        )}
      </ScrollView>
    </View>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'] as const;

/**
 * `2026-07-24` → `Fri`, using the Figma's own abbreviations.
 *
 * Parsed as UTC midnight so the label is a property of the service DATE rather than of the
 * device's timezone — a cook in a different offset must not see the strip shift by a day.
 */
function weekdayLabel(dateIso: string): string {
  const at = Date.parse(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(at)) return '';
  return WEEKDAYS[new Date(at).getUTCDay()] ?? '';
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.background },
  content: { paddingHorizontal: spacing.xl, gap: spacing.l },
});
