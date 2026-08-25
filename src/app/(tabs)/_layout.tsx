import { Tabs } from 'expo-router';

import { BottomNav, type BottomNavTab } from '@ui';
import { color } from '@ui';

/**
 * Main app shell — the V14 five-tab bottom navigation (`634:2478`).
 *
 * Five destinations: `Hazri · Kaam · Chutti · Kamai · Niyam`.
 *
 * ## What changed from V13
 *
 * V13 drew React Navigation's default bar with four `Ionicons`, because no V13 frame contained a
 * designed nav. V14 draws a real one on 33 of its 47 frames, so the bar is now a transcribed
 * component ({@link BottomNav}) supplied through `tabBar` rather than a themed default. Nothing
 * about the bar is left to the navigator: it owns its own 68-unit height, its `#ffef99` active
 * pill and the five exported Figma glyphs.
 *
 * `Niyam` is the new fifth destination and the only route to the `Info` section (`611:398`).
 *
 * A single tab navigator owns all five, so there is one back stack rather than five competing
 * ones. The active service flow lives OUTSIDE this navigator (pushed over it), which is what keeps
 * tab switching from disturbing an in-progress job: the service route stays mounted and its state
 * is re-derived from the backend regardless.
 */

/**
 * Route name → nav destination.
 *
 * The two disagree by design: the routes keep the names the rest of the app already links to
 * (`attendance`, `money`), while the bar shows the Hinglish labels V14 draws (`Hazri`, `Kamai`).
 * Renaming the routes to match would break every existing `router.push` for no visual gain.
 */
const TAB_FOR_ROUTE: Readonly<Record<string, BottomNavTab>> = {
  attendance: 'hazri',
  jobs: 'kaam',
  chutti: 'chutti',
  money: 'kamai',
  niyam: 'niyam',
};

const ROUTE_FOR_TAB: Readonly<Record<BottomNavTab, string>> = {
  hazri: 'attendance',
  kaam: 'jobs',
  chutti: 'chutti',
  kamai: 'money',
  niyam: 'niyam',
};

export default function TabsLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.background },
      }}
      tabBar={({ state, navigation }) => {
        const routeName = state.routes[state.index]?.name ?? '';
        return (
          <BottomNav
            active={TAB_FOR_ROUTE[routeName] ?? null}
            onSelect={(tab) => {
              const target = ROUTE_FOR_TAB[tab];
              if (target !== routeName) navigation.navigate(target);
            }}
            testID="bottom-nav"
          />
        );
      }}
    >
      <Tabs.Screen name="attendance" options={{ title: 'Hazri' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Kaam' }} />
      <Tabs.Screen name="chutti" options={{ title: 'Chutti' }} />
      <Tabs.Screen name="money" options={{ title: 'Kamai' }} />
      <Tabs.Screen name="niyam" options={{ title: 'Niyam' }} />
    </Tabs>
  );
}
