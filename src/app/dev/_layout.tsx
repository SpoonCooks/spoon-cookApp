import { Stack } from 'expo-router';

import { areFixturesAvailable } from '@core/fixtures';

/**
 * Gate for the whole development gallery.
 *
 * `areFixturesAvailable()` is `__DEV__`, which Metro's release transform replaces with `false`, so
 * in a production bundle this layout renders nothing and every `/dev/*` route below it is
 * unreachable. The gate lives at the layout rather than on each screen so a new gallery route
 * cannot be added without inheriting it.
 */
export default function DevLayout(): React.ReactElement | null {
  if (!areFixturesAvailable()) return null;
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
