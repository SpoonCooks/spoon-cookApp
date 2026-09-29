import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { serviceDatesBetween } from '@core/api/adapters';
import { apiErrorMessage } from '@core/api/errors';
import { useCookProfile, useEarnings, useEarningsWeek } from '@core/api/queries';
import { formatShortDate } from '@core/domain/money';
import { DayHistoryView } from '@features/performance/PerformanceViews';
import { ErrorState, LoadingState } from '@ui';

/**
 * `14- day history` (`575:1903`) — `Cycle ke din`.
 *
 * A list of the service DATES in a week. Dates are not money: the window comes from the server
 * (`startDate`/`endDate` on the week, or the live seven-day period) and the rows are just those
 * dates enumerated, so nothing here aggregates a ledger.
 *
 * Reached two ways, which is why `weekStart` is optional:
 *
 *   - from `13- money weekly` with no param   → the live `sevenDay` window
 *   - from `18- past weekly` with `weekStart` → that week, read from `/cook/earnings/weeks/:date`
 *
 * `18- past weekly` shows a WEEK identified by its start date, not a 28-day payout cycle. This
 * screen used to take that date as a `cycleId` and ask `/cook/earnings/cycles/:cycleId` for it;
 * the route only accepts a cycle's UUID, so the request was refused and `Cycle ke din` opened on
 * an error every time. It reads the same week endpoint the past-week screen does.
 */
export default function CycleDaysScreen(): React.ReactElement {
  const { weekStart } = useLocalSearchParams<{ weekStart?: string }>();
  const id = weekStart ?? '';

  // The server's own date, which is what decides whether a day has happened yet.
  const profile = useCookProfile();
  const week = useEarningsWeek(id, id.length > 0);
  const earnings = useEarnings(id.length === 0);

  const window = useMemo(() => {
    if (id.length > 0) {
      return week.data === undefined ? null : { from: week.data.startDate, to: week.data.endDate };
    }
    return earnings.data === undefined
      ? null
      : { from: earnings.data.sevenDay.startDate, to: earnings.data.sevenDay.endDate };
  }, [id, week.data, earnings.data]);

  /**
   * Never list a day that has not happened.
   *
   * The window is the CYCLE's, and an open cycle runs to its scheduled end -- so on 31 August a
   * cycle ending 22 September enumerated three weeks of future dates, each opening a day screen
   * with nothing in it. A settled cycle is unaffected: its end is already in the past, so the
   * clamp does nothing.
   *
   * The bound is the SERVER's service date, never the handset's -- the same rule the rest of the
   * app follows, because a phone on the wrong day must not add or remove a row.
   */
  const today = profile.data?.serverTime?.slice(0, 10) ?? null;
  const dates = useMemo(() => {
    if (window === null) return [];
    const end = today !== null && today < window.to ? today : window.to;
    return end < window.from ? [] : serviceDatesBetween(window.from, end);
  }, [window, today]);

  const active = id.length > 0 ? week : earnings;

  if (active.isPending) return <LoadingState testID="days-loading" />;
  if (active.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(active.error)}
        onRetry={() => void active.refetch()}
        testID="days-error"
      />
    );
  }

  // Newest first — a cook checking "what did I earn yesterday" should not scroll a week.
  const rows = [...dates]
    .reverse()
    .map((dateIso) => ({ dateIso, label: formatShortDate(dateIso) }));

  return (
    <DayHistoryView
      days={rows}
      emptyMessage="Is cycle mein koi din nahi hai."
      onBack={() => router.back()}
      onOpenDay={(dateIso) =>
        router.push({ pathname: '/money/day/[date]', params: { date: dateIso } })
      }
    />
  );
}
