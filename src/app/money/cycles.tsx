import { router } from 'expo-router';
import { useMemo } from 'react';
import { toWeekRef } from '@core/api/adapters';
import { apiErrorMessage } from '@core/api/errors';
import { useEarnings, useEarningsWeeks } from '@core/api/queries';
import { formatRupees, unavailableFigure } from '@core/domain/money';
import { CycleHistoryView } from '@features/performance/PerformanceViews';
import { ErrorState, LoadingState } from '@ui';

/**
 * `17- weekly history` (`575:2032`) — `Pichle cycles`.
 *
 * Two backend reads, both authoritative:
 *
 *   - `GET /v1/cook/earnings/cycles` → the cycle list. The route answers a BARE ARRAY, not
 *     `{ cycles: [...] }`, which is what `cookCyclesSchema` validates.
 *   - `GET /v1/cook/earnings` → `totalPaise`, which the backend computes as
 *     `SUM(amount_paise) WHERE cook_id = $1` over the whole ledger. That is precisely
 *     `Spoon se aaj tak ki kamai`, so the lifetime band is a server figure rather than a sum of
 *     the rows on screen.
 *
 * `finalAmountPaise` is `null` until a cycle is closed for this cook. That renders `—`: an open
 * cycle has no settled payout, and printing its running total under `Kamai:` would look like one.
 */
export default function CycleHistoryScreen(): React.ReactElement {
  /*
   * WEEKS, not the 28-day payout cycles.
   *
   * This list feeds `Cycle ki kamai`, which is drawn as a week. Listing payout cycles here is
   * what sent a 28-day window into a seven-disc strip.
   */
  const cycles = useEarningsWeeks();
  const earnings = useEarnings();

  const rows = useMemo(() => (cycles.data ?? []).map(toWeekRef), [cycles.data]);

  if (cycles.isPending) return <LoadingState testID="cycles-loading" />;

  if (cycles.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(cycles.error)}
        onRetry={() => void cycles.refetch()}
        testID="cycles-error"
      />
    );
  }

  return (
    <CycleHistoryView
      lifetimePaise={earnings.data?.totalPaise ?? null}
      cycles={rows.map((cycle) => ({
        cycleId: cycle.cycleId,
        label: cycle.label,
        // `502:628` prints the settled amount beside a `Kamai:` label the row itself draws. A
        // cycle the backend has not closed returns `null`, not zero, and shows the em dash.
        earnings: cycle.finalPaise === null ? unavailableFigure : formatRupees(cycle.finalPaise),
      }))}
      emptyMessage="Koi pichla hafta nahi hai."
      onBack={() => router.back()}
      onOpenCycle={(cycleId) =>
        router.push({ pathname: '/money/cycle/[cycleId]', params: { cycleId } })
      }
    />
  );
}
