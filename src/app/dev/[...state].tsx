import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { areFixturesAvailable } from '@core/fixtures';
import { bottomNavTabFor, galleryEntryFor } from '@features/dev/galleryStates';
import { BottomNav, color, Text } from '@ui';

/**
 * Renders one V14 state from the development gallery.
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
 *
 * ## Why the bottom nav is drawn HERE and not by the entries
 *
 * V14 puts the five-tab bar on **33 of the 47 frames**, but in the running app it is chrome owned
 * by the navigator (`(tabs)/_layout.tsx` supplies it through `tabBar`) or by the one route that
 * stands outside the tabs (`service/[bookingId].tsx` renders it directly). No feature view draws
 * its own, which is correct — a view that painted a tab bar would paint a second one inside the
 * tabs.
 *
 * The gallery bypasses both hosts: it renders the presentational view alone. Left that way, all
 * 33 nav-bearing frames capture WITHOUT the bar their reference draws, and each one scores a
 * 68-unit block of pure difference along its bottom edge — a harness artefact reported as an
 * implementation defect. So the host supplies the same production {@link BottomNav} the real
 * screens get, for exactly the frames the scope contract marks `bottomNav` — see
 * {@link bottomNavTabFor}, which decides that against the contract and is asserted against it.
 *
 * It is the real component with real props, not a stand-in: substituting a mock here would make
 * every one of those 33 comparisons meaningless.
 */

export default function DevGalleryState(): React.ReactElement | null {
  const params = useLocalSearchParams<{ state?: string | string[] }>();
  // The same insets the real routes apply, for entries that do not apply them themselves.
  // Without them a presentational view would render at y=0 and every comparison would inherit
  // that offset; with them applied twice it would render an inset too low. See `ownsSafeArea`.
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

  const activeTab = bottomNavTabFor(entry);

  return (
    <View
      style={[
        styles.host,
        entry.ownsSafeArea === true
          ? null
          : { paddingTop: insets.top, paddingBottom: insets.bottom },
        /*
         * The bar sits ABOVE the device's own navigation bar, exactly as
         * `service/[bookingId].tsx` places it. Without this the bar would be flush to the window
         * bottom, the capture would crop its lower third away with the system bars, and the whole
         * frame would compare one nav-height too low.
         *
         * Applied only when a bar is actually drawn, so the fourteen frames without one keep the
         * geometry their evidence was taken at.
         */
        activeTab !== null && entry.ownsSafeArea === true ? { paddingBottom: insets.bottom } : null,
      ]}
      testID={`gallery-${entry.id}`}
    >
      <View style={styles.body}>{entry.render()}</View>
      {activeTab !== null && <BottomNav active={activeTab} testID="gallery-bottom-nav" />}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: color.background },
  /** Holds the frame's own content; the nav is its sibling, never its child. */
  body: { flex: 1 },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: color.background,
  },
});
