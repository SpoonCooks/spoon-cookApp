import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { areFixturesAvailable } from '@core/fixtures';
import { color, radius, spacing, Text } from '@ui';

/**
 * Development-only state switcher.
 *
 * Lets a reviewer step through every backend state a screen can be in, so each Figma frame can be
 * verified visually without a live backend that cannot yet produce these states.
 *
 * ## This is not functional progress
 *
 * Moving between fixtures proves only that the *presentation* for a given backend state is
 * correct. It does not exercise any API, and a fixture reaching `completed` does not mean the
 * completion flow works. In a release build `areFixturesAvailable()` is `false` and this component
 * renders nothing at all.
 */
export interface FixtureSwitcherProps<T extends string> {
  readonly current: T;
  readonly options: readonly T[];
  readonly onSelect: (next: T) => void;
}

export function FixtureSwitcher<T extends string>({
  current,
  options,
  onSelect,
}: FixtureSwitcherProps<T>): React.ReactElement | null {
  if (!areFixturesAvailable()) return null;

  return (
    <View style={styles.bar} testID="fixture-switcher">
      <Text variant="micro" color={color.white} style={styles.title}>
        DEV FIXTURES — not real data
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            accessibilityRole="button"
            testID={`fixture-${option}`}
            style={[styles.chip, option === current && styles.chipActive]}
          >
            <Text variant="label" color={option === current ? color.black : color.white}>
              {option}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.slate,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    gap: spacing.xs,
  },
  title: { opacity: 0.7 },
  row: { gap: spacing.s, paddingRight: spacing.m },
  chip: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.grey500,
  },
  chipActive: { backgroundColor: color.lime600, borderColor: color.lime600 },
});
