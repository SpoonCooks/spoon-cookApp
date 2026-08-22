import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toBonusProgress } from '@core/api/adapters';
import { apiErrorMessage, isSessionExpired } from '@core/api/errors';
import { useEarnings } from '@core/api/queries';
import {
  earningsPeriodLabels,
  earningsPeriods,
  formatRupees,
  type EarningsPeriod,
} from '@core/domain/money';
import { useSession } from '@core/session/store';
import { color, EmptyState, ErrorState, LoadingState, radius, spacing, Text } from '@ui';

/**
 * My Money — "Kaam aur Paise". Figma section `Performance & earnings` (`540:397`).
 *
 *   `Aaj — 1 din`     → `Page 3- money daily`   (`485:5062`)
 *   `Cycle — 7 din`   → `Page 4 - money 7 days` (`492:5336`)
 *   `Mahina — 28 din` → `Page 7- money monthly` (`502:192`)
 *
 * ## What is connected, and what is not
 *
 * `GET /v1/cook/earnings` supplies server-computed period totals (`daily`, `sevenDay`,
 * `currentCycle`) and `bonus`, all of which are rendered directly. The bonus threshold comes from
 * `bonus.thresholdDays` — no screen hardcodes 5, 7 or 27.
 *
 * The Figma frames additionally show a CATEGORISED breakdown — base, bonus, tips, no-show and late
 * deductions, and a `final kamai`. The backend returns only a flat `events[]` ledger plus totals;
 * it computes no such categories.
 *
 * Summing that ledger by `eventType` here would be wrong, not merely disallowed: a `reversal`
 * carries its own type, so a reversed `base_earning` would leave "base" overstated while the
 * offsetting line landed in a different bucket. The categories are therefore left unrendered and
 * recorded as GAP-25 rather than approximated. `totalPaise` IS the server's net and is shown as-is.
 */
export default function MoneyScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const signOut = useSession((s) => s.signOut);
  const [period, setPeriod] = useState<EarningsPeriod>('day');

  const earnings = useEarnings();

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

  const data = earnings.data;
  const bonus = toBonusProgress(data);

  // Each period total is a distinct server figure, never a slice of another one.
  const periodTotal =
    period === 'day'
      ? data.daily.totalPaise
      : period === 'cycle'
        ? data.sevenDay.totalPaise
        : (data.currentCycle?.finalAmountPaise ?? data.totalPaise);

  const periodCount =
    period === 'day' ? data.daily.eventCount : period === 'cycle' ? data.sevenDay.eventCount : null;

  const isMonthly = period === 'month';
  const grossLabel = isMonthly
    ? 'mahine ki kamai'
    : period === 'cycle'
      ? 'cycle ki kamai'
      : 'Aaj ki kamaai';

  return (
    <View style={styles.flex}>
      <View style={[styles.banner, { paddingTop: insets.top + spacing.s }]}>
        <Text variant="headingLg">Kaam aur Paise</Text>
      </View>

      <View style={styles.filterRow} accessibilityRole="tablist">
        {earningsPeriods.map((value) => {
          const isActive = value === period;
          const label = earningsPeriodLabels[value];
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => setPeriod(value)}
              testID={`money-filter-${value}`}
              style={[styles.filter, isActive && styles.filterActive]}
            >
              <Text variant="captionStrong">{label.title}</Text>
              <Text variant="label">{label.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
        refreshControl={
          <RefreshControl
            refreshing={earnings.isFetching}
            onRefresh={() => void earnings.refetch()}
          />
        }
        testID="money-scroll"
      >
        <View style={styles.card}>
          <Text variant="label">{grossLabel}</Text>
          <Text variant="displayLg" testID="money-period-total">
            {formatRupees(periodTotal)}
          </Text>
          {periodCount !== null && <Text variant="captionMuted">{`${periodCount} entries`}</Text>}
        </View>

        {bonus !== null ? (
          <View style={styles.card} testID="money-bonus">
            <Text variant="label">Bonus</Text>
            <Text variant="bodyStrong">
              {`${bonus.completedHours}/${bonus.thresholdHours} din`}
            </Text>
            <Text variant="captionMuted">
              {bonus.remainingHours === 0
                ? 'Bonus pura ho gaya'
                : `Bonus ke liye ${bonus.remainingHours} din aur`}
            </Text>
          </View>
        ) : (
          <View style={styles.card} testID="money-bonus-unavailable">
            <Text variant="label">Bonus</Text>
            <Text variant="captionMuted">Abhi koi cycle chalu nahi hai.</Text>
          </View>
        )}

        {data.events.length === 0 ? (
          <EmptyState message="Abhi koi kamaai nahi hai." />
        ) : (
          <View style={styles.card} testID="money-events">
            <Text variant="labelStrong">Entries</Text>
            {data.events.slice(0, 20).map((event) => (
              <View key={event.id} style={styles.eventRow} testID={`money-event-${event.id}`}>
                <View style={styles.eventLabel}>
                  <Text variant="caption">{event.eventType.replace(/_/g, ' ')}</Text>
                  {event.reason.length > 0 && <Text variant="captionMuted">{event.reason}</Text>}
                </View>
                <Text
                  variant="captionStrong"
                  color={event.amountPaise < 0 ? color.danger : color.textPrimary}
                >
                  {formatRupees(event.amountPaise)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/money/cycles')}
          testID="money-past-cycles"
          style={styles.linkRow}
        >
          <Text variant="bodyStrong">Pichle cycles</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { paddingHorizontal: spacing.xl, paddingBottom: spacing.m },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.m,
  },
  filter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.s,
    borderRadius: radius.m,
    backgroundColor: color.surface,
    borderWidth: 2,
    borderColor: color.grey100,
  },
  filterActive: { backgroundColor: color.yellow300, borderColor: color.black },
  content: { paddingHorizontal: spacing.xl, gap: spacing.l },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    padding: spacing.l,
    gap: spacing.xs,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  eventLabel: { flex: 1, paddingRight: spacing.m },
  linkRow: {
    paddingVertical: spacing.l,
    alignItems: 'center',
    borderRadius: radius.xxl,
    backgroundColor: color.surface,
  },
});
