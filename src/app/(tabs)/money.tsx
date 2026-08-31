import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';

import {
  periodResponseFor,
  serviceDatesBetween,
  toBonusProgress,
  toDailyHoursView,
  toEarningsPeriodView,
} from '@core/api/adapters';
import { apiErrorMessage, isSessionExpired } from '@core/api/errors';
import { useAttendanceRange, useCookProfile, useEarnings } from '@core/api/queries';
import {
  earningsPeriodLabels,
  earningsPeriods,
  type EarningsPeriod,
  type RatingView,
} from '@core/domain/money';
import { useSession } from '@core/session/store';
import { MoneyPeriodView } from '@features/performance/PerformanceViews';
import { ErrorState, LoadingState, type DayStripEntry } from '@ui';

/**
 * My Money — Figma V13 section `performance` (`575:1741`).
 *
 * Three frames, one screen, selected by the `Aaj / Cycle / Mahina` control:
 *
 *   `575:1744` `12- money daily`   → `earnings.daily`     (today, IST service date)
 *   `575:1884` `13- money weekly`  → `earnings.sevenDay`  (today-6 … today)
 *   `575:2013` `16- money monthly` → `earnings.monthly`   (month start … today)
 *
 * ## Composition
 *
 * The frames themselves live in `@features/performance/PerformanceViews` so `/dev` can render the
 * identical screen from a fixture. This route owns only the data: which period is selected, what
 * the contract returned, and where a tap navigates.
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

  const hoursBonus = useMemo(
    () => (earnings.data === undefined ? null : toDailyHoursView(earnings.data)),
    [earnings.data],
  );

  const view = useMemo(
    () =>
      earnings.data === undefined
        ? null
        : toEarningsPeriodView(
            period,
            periodResponseFor(earnings.data, period),
            hoursBonus,
            // `536:207` — the rate the ledger would pay her today, not a total divided by days.
            earnings.data.perDayBasePaise,
          ),
    [earnings.data, period, hoursBonus],
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

  const tabs = earningsPeriods.map((key) => ({
    key,
    title: earningsPeriodLabels[key].title,
    subtitle: earningsPeriodLabels[key].subtitle,
  }));

  return (
    <MoneyPeriodView
      period={period}
      view={view}
      bonus={bonus}
      hoursBonus={hoursBonus}
      rating={rating}
      days={days}
      tabs={tabs}
      onChangePeriod={setPeriod}
      onOpenDays={() => router.push('/money/days')}
      onOpenCycles={() => router.push('/money/cycles')}
      refreshControl={
        <RefreshControl
          refreshing={earnings.isFetching}
          onRefresh={() => void earnings.refetch()}
        />
      }
    />
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
