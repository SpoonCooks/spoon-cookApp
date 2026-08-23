import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { areFixturesAvailable } from '@core/fixtures';
import { galleryEntryFor } from '@features/dev/galleryStates';
import { color, Text } from '@ui';

/**
 * Renders one V13 state from the development gallery.
 *
 * Reached by deep link so a screenshot run needs no taps:
 *
 *     adb shell am start -a android.intent.action.VIEW \
 *       -d "spooncook://dev/service/cooking" com.spoonhelp.cookapp.dev
 *
 * The catch-all segment is what lets a state id contain a slash (`service/cooking`), which keeps
 * the ids identical to `FigmaScreen.galleryState` in `@core/figma/scope` — the two are asserted
 * equal by `gallery.test.tsx`, so a renamed state cannot silently orphan its Figma frame.
 *
 * The screen draws NO chrome of its own: no header, no state label, no debug banner. Anything
 * drawn here would land in the emulator screenshot and be compared against the Figma frame as if
 * it were part of the design.
 */
export default function DevGalleryState(): React.ReactElement | null {
  const params = useLocalSearchParams<{ state?: string | string[] }>();
  // The same insets the real routes apply. Without them the gallery would render each screen
  // 24dp higher than production does and every comparison would inherit that offset.
  const insets = useSafeAreaInsets();

  if (!areFixturesAvailable()) return null;

  const segments = params.state;
  const id = Array.isArray(segments) ? segments.join('/') : (segments ?? '');
  const entry = galleryEntryFor(id);

  if (entry === null) {
    return (
      <View style={styles.missing} testID="gallery-missing">
        <Text variant="heading">No gallery state</Text>
        <Text variant="bodyMuted">{id.length > 0 ? id : '(empty)'}</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.host, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      testID={`gallery-${entry.id}`}
    >
      {entry.render()}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: color.background },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: color.background,
  },
});
