import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toCycleRef } from '@core/api/adapters';
import { apiErrorMessage } from '@core/api/errors';
import { useEarnings, useEarningsCycles } from '@core/api/queries';
import { formatRupees, unavailableFigure } from '@core/domain/money';
import {
  BackHeader,
  color,
  EmptyState,
  ErrorState,
  LifetimeBand,
  LinkRow,
  LoadingState,
  spacing,
} from '@ui';

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
  const insets = useSafeAreaInsets();

  const cycles = useEarningsCycles();
  const earnings = useEarnings();

  const rows = useMemo(() => (cycles.data ?? []).map(toCycleRef), [cycles.data]);

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
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.m, paddingBottom: insets.bottom + spacing.huge },
        ]}
        refreshControl={
          <RefreshControl refreshing={cycles.isFetching} onRefresh={() => void cycles.refetch()} />
        }
        testID="cycles-scroll"
      >
        <BackHeader title="Pichle cycles" onBack={() => router.back()} />

        {earnings.data !== undefined && <LifetimeBand netPaise={earnings.data.totalPaise} />}

        {rows.length === 0 ? (
          <EmptyState message="Koi pichla cycle nahi hai." />
        ) : (
          rows.map((cycle) => (
            <LinkRow
              key={cycle.cycleId}
              label={cycle.label}
              sublabel={`Kamai:  ${cycle.finalPaise === null ? unavailableFigure : formatRupees(cycle.finalPaise)}`}
              onPress={() =>
                router.push({
                  pathname: '/money/cycle/[cycleId]',
                  params: { cycleId: cycle.cycleId },
                })
              }
              testID={`cycle-${cycle.cycleId}`}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.background },
  content: { paddingHorizontal: spacing.xl, gap: spacing.m },
});
