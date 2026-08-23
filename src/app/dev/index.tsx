import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { figmaScreens } from '@core/figma/scope';
import { areFixturesAvailable } from '@core/fixtures';
import { galleryEntries } from '@features/dev/galleryStates';
import { color, radius, spacing, Text } from '@ui';

/**
 * Index of the development gallery.
 *
 * Lists every finalized V13 screen, INCLUDING the ones with no gallery entry yet. An unbuilt
 * screen shows as `not implemented` rather than being omitted, so this page reports real coverage
 * instead of flattering it.
 */
export default function DevGalleryIndex(): React.ReactElement | null {
  if (!areFixturesAvailable()) return null;

  const built = new Set(galleryEntries.map((entry) => entry.id));
  const bySection = new Map<string, typeof figmaScreens>();
  for (const screen of figmaScreens) {
    const section = sectionNameFor(screen.sectionNodeId);
    bySection.set(section, [...(bySection.get(section) ?? []), screen]);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text variant="heading">V13 gallery</Text>
      <Text variant="bodyMuted">
        {built.size} of {figmaScreens.length} finalized screens reachable
      </Text>

      {[...bySection.entries()].map(([section, screens]) => (
        <View key={section} style={styles.section}>
          <Text variant="label">{section.toUpperCase()}</Text>
          {screens.map((screen) => {
            const ready = built.has(screen.galleryState);
            return ready ? (
              <Link
                key={screen.nodeId}
                href={`/dev/${screen.galleryState}`}
                style={styles.row}
                testID={`gallery-link-${screen.galleryState}`}
              >
                <Text variant="body">
                  {screen.name} — {screen.nodeId}
                </Text>
              </Link>
            ) : (
              <View key={screen.nodeId} style={[styles.row, styles.rowMissing]}>
                <Text variant="bodyMuted">
                  {screen.name} — {screen.nodeId} · not implemented
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

function sectionNameFor(sectionNodeId: string): string {
  switch (sectionNodeId) {
    case '434:3115':
      return 'Login flow';
    case '540:416':
      return 'leave';
    case '592:1068':
      return 'log in flow';
    case '575:1741':
      return 'performance';
    case '485:4971':
      return 'Service flow';
    default:
      return sectionNodeId;
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  content: { padding: spacing.l, gap: spacing.m, paddingBottom: spacing.huge },
  section: { gap: spacing.xs, marginTop: spacing.m },
  row: {
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
  },
  rowMissing: { backgroundColor: color.surfaceMuted, opacity: 0.6 },
});
