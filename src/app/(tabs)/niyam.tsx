import { router } from 'expo-router';

import { NiyamIndexView } from '@features/info/InfoViews';

/**
 * NIYAM — the V14 `Info` destination (`597:1131`).
 *
 * New in V14, and the only route to the five rule sheets. The screen itself is static: it is a
 * table of contents for published policy, so it reads nothing and can render before any query
 * settles.
 *
 * The rule sheets are pushed over it as bottom sheets (`/niyam/[rule]`), which is why they draw no
 * bottom nav — the same relationship `leave` has with its two pickers.
 */
export default function NiyamScreen(): React.ReactElement {
  return (
    <NiyamIndexView
      onOpenRule={(rule) => router.push({ pathname: '/niyam/[rule]', params: { rule } })}
    />
  );
}
