import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRupees } from '@core/domain/money';
import { areFixturesAvailable, moneyFixtures } from '@core/fixtures';
import { color, EmptyState, radius, spacing, Text } from '@ui';

/**
 * Page 4 — cycle history (Figma `502:442`).
 *
 * Founder comment #143: "Probably have final payouts against each one here — baar baar khol
 * kholke thori na dekhenge". Each row therefore has a slot for the settled amount so the cook does
 * not have to open every cycle.
 *
 * That amount is **not available from the backend today** (GAP-18: the proposed
 * `GET /v1/cook/earnings/cycles` must return a final figure per cycle). Rows render `—` rather
 * than a computed or guessed number.
 */
export default function CycleHistoryScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();

  // PHASE 2: GET the cook's earnings cycles (GAP-03/GAP-18).
  const cycles = areFixturesAvailable() ? moneyFixtures.cycles() : null;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.banner, { paddingTop: insets.top + spacing.s }]}>
        <Text variant="headingLg">Pichle cycles</Text>
      </View>

      {cycles === null || cycles.length === 0 ? (
        <EmptyState message="Koi pichla cycle nahi hai." />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
        >
          {cycles.map((cycle) => (
            <Pressable
              key={cycle.cycleId}
              accessibilityRole="button"
              testID={`cycle-${cycle.cycleId}`}
              onPress={() =>
                router.push({
                  pathname: '/money/cycle/[cycleId]',
                  params: { cycleId: cycle.cycleId },
                })
              }
              style={[styles.row, cycle.isCurrent && styles.rowCurrent]}
            >
              <View style={styles.rowLabel}>
                <Text variant="body">{cycle.label}</Text>
                {cycle.isCurrent && <Text variant="label">Current</Text>}
              </View>
              <Text variant="bodyStrong">
                {cycle.finalPaise === null ? '—' : formatRupees(cycle.finalPaise)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { paddingHorizontal: spacing.xl, paddingBottom: spacing.m },
  content: { paddingHorizontal: spacing.xl, gap: spacing.m },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.l,
    padding: spacing.l,
  },
  rowCurrent: { borderWidth: 2, borderColor: color.black },
  rowLabel: { gap: spacing.xxs },
});
