import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { color, fontFamily, fontSize, layout } from '@ui';

/**
 * Main app shell — the Figma `nav.fixed` bottom navigation (`434:2822`).
 *
 * Four destinations: `Jobs · Attendance · Chutti · My money`.
 *
 * `Chutti` is new in V13. The `leave` section (`540:416`) draws it with a title and a Help button
 * and no back arrow — the same shape the attendance screen has — which is what a peer destination
 * looks like, not a pushed sub-screen. Its two pickers (`/leave/single`, `/leave/range`) are
 * bottom sheets pushed over it.
 *
 * A single tab navigator owns all three, so there is one back stack rather than three competing
 * ones. The active service flow lives OUTSIDE this navigator (pushed over it), which is what keeps
 * tab switching from disturbing an in-progress job: the service route stays mounted and its state
 * is re-derived from the backend regardless.
 */
export default function TabsLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.black,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopWidth: 1,
          borderTopColor: color.grey100,
          height: layout.navHeight,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.black,
          fontSize: fontSize.s,
        },
        sceneStyle: { backgroundColor: color.background },
      }}
    >
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="briefcase" color={c} size={size} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="calendar-clear" color={c} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chutti"
        options={{
          title: 'Chutti',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="sunny" color={c} size={size} />,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'My money',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="wallet" color={c} size={size} />,
        }}
      />
    </Tabs>
  );
}
