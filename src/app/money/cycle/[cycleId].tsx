import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { serviceDatesBetween, toCycleDetailView } from '@core/api/adapters';
import { apiErrorMessage } from '@core/api/errors';
import { useAttendanceRange, useCookProfile, useEarningsCycle } from '@core/api/queries';
import { formatDateRange, periodCopy, type RatingView } from '@core/domain/money';
import {
  BackHeader,
  color,
  CycleWorkCard,
  DateBanner,
  DayStrip,
  ErrorState,
  FinalBand,
  LinkRow,
  LoadingState,
  MistakesCard,
  spacing,
  type DayStripEntry,
} from '@ui';

/**
 * `18- past weekly` (`575:2098`) — `Cycle ki kamai`.
 *
 * The same anatomy as the live weekly frame, headed by the cycle's own date range.
 *
 * `GET /v1/cook/earnings/cycles/:cycleId` answers a DIFFERENT shape from `/cook/earnings`:
 * `{ cycleId, startDate, endDate, status, breakdown, summary, totalPaise, events }`. `summary` is
 * the reversal-safe aggregate and is what this screen renders; `breakdown` is a raw
 * `eventType → paise` map that must never be re-bucketed here.
 *
 * `bonus` is deliberately `null`: bonus PROGRESS is a property of the CURRENT cycle, and showing a
 * live progress bar on a settled one would misreport a closed period.
 */
export default function PastCycleScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { cycleId } = useLocalSearchParams<{ cycleId?: string }>();
  const id = cycleId ?? '';

  const cycle = useEarningsCycle(id, id.length > 0);
  const profile = useCookProfile();

  const attendance = useAttendanceRange(
    { from: cycle.data?.startDate ?? '', to: cycle.data?.endDate ?? '' },
    cycle.data !== undefined,
  );

  const view = useMemo(
    () => (cycle.data === undefined ? null : toCycleDetailView(cycle.data)),
    [cycle.data],
  );

  const rating: RatingView | null = useMemo(
    () =>
      profile.data === undefined
        ? null
        : { average: profile.data.cook.rating.average, count: profile.data.cook.rating.count },
    [profile.data],
  );

  const days: readonly DayStripEntry[] = useMemo(() => {
    if (cycle.data === undefined) return [];
    const marks = new Map((attendance.data ?? []).map((row) => [row.serviceDate, row.status]));
    return serviceDatesBetween(cycle.data.startDate, cycle.data.endDate).map((dateIso) => {
      const status = marks.get(dateIso);
      return {
        label: weekdayLabel(dateIso),
        state:
          status === 'present'
            ? ('present' as const)
            : status === undefined
              ? ('none' as const)
              : ('missed' as const),
      };
    });
  }, [cycle.data, attendance.data]);

  if (id.length === 0) {
    return <ErrorState message="Cycle nahi mili." onRetry={() => router.back()} />;
  }
  if (cycle.isPending) return <LoadingState testID="cycle-loading" />;
  if (cycle.isError || view === null || cycle.data === undefined) {
    return (
      <ErrorState
        message={apiErrorMessage(cycle.error)}
        onRetry={() => void cycle.refetch()}
        testID="cycle-error"
      />
    );
  }

  const copy = periodCopy.cycle;

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.m, paddingBottom: insets.bottom + spacing.huge },
        ]}
        refreshControl={
          <RefreshControl refreshing={cycle.isFetching} onRefresh={() => void cycle.refetch()} />
        }
        testID="cycle-scroll"
      >
        <BackHeader title="Cycle ki kamai" onBack={() => router.back()} />
        <DateBanner label={formatDateRange(cycle.data.startDate, cycle.data.endDate)} />

        {days.length > 0 && <DayStrip days={days} />}

        <CycleWorkCard view={view} rating={rating} copy={copy} bonus={null} />
        <MistakesCard view={view} copy={copy} />
        <FinalBand label={copy.final} netPaise={view.breakdown.netPaise} />

        <LinkRow
          label="Cycle ke din"
          onPress={() =>
            router.push({ pathname: '/money/days', params: { cycleId: cycle.data.cycleId } })
          }
          testID="cycle-days"
        />
      </ScrollView>
    </View>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'] as const;

function weekdayLabel(dateIso: string): string {
  const at = Date.parse(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(at)) return '';
  return WEEKDAYS[new Date(at).getUTCDay()] ?? '';
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.background },
  content: { paddingHorizontal: spacing.xl, gap: spacing.l },
});
