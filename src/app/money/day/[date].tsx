import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { toBonusProgress, toEarningsPeriodView } from '@core/api/adapters';
import { apiErrorMessage } from '@core/api/errors';
import { useCookProfile, useEarnings } from '@core/api/queries';
import { formatOrdinalDate, type RatingView } from '@core/domain/money';
import { PastDayView } from '@features/performance/PerformanceViews';
import { EmptyState, ErrorState, LoadingState } from '@ui';

/**
 * `15- past daily` (`575:1922`) — `Din ki kamai`.
 *
 * ## The one screen in this section without a full contract
 *
 * The deployed API exposes exactly three earnings windows — `daily`, `sevenDay`, `monthly` — all
 * anchored to TODAY's IST service date, plus per-cycle detail. There is no
 * `GET /cook/earnings/day/:date`, so a breakdown for an arbitrary past date cannot be read.
 *
 * It could be faked by filtering the cycle's `events[]` on `createdAt`, and that is exactly what
 * this screen refuses to do: reversals live in their own signed category, so re-bucketing raw
 * ledger rows by date would show a cook a base figure the payout will not honour.
 *
 * So the screen renders in full for TODAY, where `earnings.daily` is authoritative, and states the
 * gap plainly for any other date. Recorded as `GAP-V12-01`.
 */
export default function PastDayScreen(): React.ReactElement {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateIso = date ?? '';

  const earnings = useEarnings();
  const profile = useCookProfile();

  // The server's own service date for the daily window — never the device clock.
  const todayIso = earnings.data?.daily.startDate ?? null;
  const isToday = todayIso !== null && dateIso === todayIso;

  const view = useMemo(
    () =>
      earnings.data === undefined || !isToday
        ? null
        : toEarningsPeriodView('day', earnings.data.daily),
    [earnings.data, isToday],
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

  if (dateIso.length !== 10) {
    return <ErrorState message="Din nahi mila." onRetry={() => router.back()} />;
  }
  if (earnings.isPending) return <LoadingState testID="day-loading" />;
  if (earnings.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(earnings.error)}
        onRetry={() => void earnings.refetch()}
        testID="day-error"
      />
    );
  }

  if (view === null) {
    return (
      <EmptyState
        message="Purane din ka hisaab abhi nahi dikh sakta. Poore cycle ka hisaab dekhein."
        testID="day-unavailable"
      />
    );
  }

  return (
    <PastDayView
      label={formatOrdinalDate(dateIso)}
      view={view}
      bonus={bonus}
      rating={rating}
      onBack={() => router.back()}
    />
  );
}
