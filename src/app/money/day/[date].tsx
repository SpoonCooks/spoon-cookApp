import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { toBonusProgress, toEarningsPeriodView } from '@core/api/adapters';
import { apiErrorMessage } from '@core/api/errors';
import { useCookProfile, useEarnings, useEarningsDay } from '@core/api/queries';
import { formatOrdinalDate, type RatingView } from '@core/domain/money';
import { PastDayView } from '@features/performance/PerformanceViews';
import { ErrorState, LoadingState } from '@ui';

/**
 * `15- past daily` (`575:1922`) — `Din ki kamai`.
 *
 * ## Why this reads a dedicated endpoint
 *
 * The obvious shortcut is to filter the cycle's `events[]` on `createdAt` in the client, and this
 * screen has always refused to: reversals live in their own signed category, so re-bucketing raw
 * ledger rows by date would show a cook a base figure the payout will not honour.
 *
 * For a long time that left no honest option — the API only exposed `daily`, `sevenDay` and
 * `monthly`, all anchored to TODAY — so every other date rendered a plain statement of the gap
 * (`GAP-V12-01`). `GET /cook/earnings/day/:date` closes it: the server runs the SAME breakdown it
 * runs for `daily`, against the requested IST service date, so every signed category stays in its
 * own bucket and nothing is recomputed here.
 *
 * A day with no ledger rows is a real answer — a cook who did not work — not an error, so it
 * renders as a zeroed day rather than an empty state.
 */
export default function PastDayScreen(): React.ReactElement {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateIso = date ?? '';
  const valid = dateIso.length === 10;

  const day = useEarningsDay(dateIso, valid);
  // Only for bonus progress, which is a cycle-level figure and has no per-day equivalent.
  const earnings = useEarnings(valid);
  const profile = useCookProfile();

  const view = useMemo(
    () => (day.data === undefined ? null : toEarningsPeriodView('day', day.data)),
    [day.data],
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

  if (!valid) {
    return <ErrorState message="Din nahi mila." onRetry={() => router.back()} />;
  }
  if (day.isPending) return <LoadingState testID="day-loading" />;
  if (day.isError || view === null) {
    return (
      <ErrorState
        message={day.isError ? apiErrorMessage(day.error) : 'Din ka hisaab nahi mila.'}
        onRetry={() => void day.refetch()}
        testID="day-error"
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
