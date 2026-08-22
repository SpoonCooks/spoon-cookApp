import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { areFixturesAvailable, moneyFixtures } from '@core/fixtures';
import { EmptyState, MoneySummary, spacing, Text } from '@ui';

/**
 * Page 3c — past cycle (Figma `504:934`).
 *
 * Structurally identical to the monthly frame, headed by the cycle's date range
 * (`11th Jul - 17th Jul`), so it reuses `MoneySummary` rather than duplicating the breakdown.
 */
export default function PastCycleScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { cycleId } = useLocalSearchParams<{ cycleId?: string }>();

  // PHASE 2: GET /v1/cook/earnings/cycles/:cycleId — exists, but the id is only discoverable once
  // GAP-03's cycle list ships.
  const summary = areFixturesAvailable() ? moneyFixtures.month() : null;
  const label = areFixturesAvailable()
    ? (moneyFixtures.cycles().find((c) => c.cycleId === cycleId)?.label ?? '')
    : '';

  return (
    <View style={styles.flex}>
      <View style={[styles.banner, { paddingTop: insets.top + spacing.s }]}>
        <Text variant="headingLg">{label}</Text>
      </View>

      {summary === null ? (
        <EmptyState message="Cycle load nahi ho payi." />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
        >
          <MoneySummary
            summary={summary}
            workLabel="mahine ka kaam"
            grossLabel="mahine ki kamai"
            mistakesLabel="mahine ki galatiyaan"
            deductionsLabel="mahine ki katauti"
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { paddingHorizontal: spacing.xl, paddingBottom: spacing.m },
  content: { paddingHorizontal: spacing.xl, gap: spacing.l },
});
