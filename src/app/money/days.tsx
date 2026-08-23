import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { serviceDatesBetween } from '@core/api/adapters';
import { apiErrorMessage } from '@core/api/errors';
import { useEarnings, useEarningsCycle } from '@core/api/queries';
import { formatShortDate } from '@core/domain/money';
import { BackHeader, color, EmptyState, ErrorState, LinkRow, LoadingState, spacing } from '@ui';

/**
 * `14- day history` (`575:1903`) — `Cycle ke din`.
 *
 * A list of the service DATES in a cycle. Dates are not money: the window comes from the server
 * (`startDate`/`endDate` on the cycle, or the live seven-day period) and the rows are just those
 * dates enumerated, so nothing here aggregates a ledger.
 *
 * Reached two ways, which is why `cycleId` is optional:
 *
 *   - from `13- money weekly` with no id → the live `sevenDay` window
 *   - from `18- past weekly` with an id  → that settled cycle's window
 */
export default function CycleDaysScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { cycleId } = useLocalSearchParams<{ cycleId?: string }>();
  const id = cycleId ?? '';

  const cycle = useEarningsCycle(id, id.length > 0);
  const earnings = useEarnings(id.length === 0);

  const window = useMemo(() => {
    if (id.length > 0) {
      return cycle.data === undefined
        ? null
        : { from: cycle.data.startDate, to: cycle.data.endDate };
    }
    return earnings.data === undefined
      ? null
      : { from: earnings.data.sevenDay.startDate, to: earnings.data.sevenDay.endDate };
  }, [id, cycle.data, earnings.data]);

  const dates = useMemo(
    () => (window === null ? [] : serviceDatesBetween(window.from, window.to)),
    [window],
  );

  const active = id.length > 0 ? cycle : earnings;

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

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.m, paddingBottom: insets.bottom + spacing.huge },
        ]}
        testID="days-scroll"
      >
        <BackHeader title="Cycle ke din" onBack={() => router.back()} />

        {dates.length === 0 ? (
          <EmptyState message="Is cycle mein koi din nahi hai." />
        ) : (
          // Newest first — a cook checking "what did I earn yesterday" should not scroll a week.
          [...dates]
            .reverse()
            .map((dateIso) => (
              <LinkRow
                key={dateIso}
                label={formatShortDate(dateIso)}
                onPress={() =>
                  router.push({ pathname: '/money/day/[date]', params: { date: dateIso } })
                }
                testID={`day-${dateIso}`}
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
