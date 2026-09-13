import { router } from 'expo-router';
import { useEffect } from 'react';

import { restoreSession } from '@core/session/auth';
import { useSession } from '@core/session/store';
import { BootView } from '@features/login/LoginViews';

/**
 * Page 0 — loading / boot (Figma `434:3330`, V13).
 *
 * The route owns behaviour only; the pixels live in `BootView` so `/dev` can render the identical
 * tree without this screen's redirect firing mid-capture.
 *
 * It restores any stored session and routes onward; it never decides authentication itself.
 * Restore re-validates a stored token against `GET /v1/cook/me` rather than trusting it, so a cook
 * whose approval was revoked while the app was closed does not get in on a stale token. A failure
 * resolves to signed-out, which is the safe direction.
 */
export default function BootScreen(): React.ReactElement {
  const auth = useSession((state) => state.auth);
  const restoreComplete = useSession((state) => state.restoreComplete);

  useEffect(() => {
    if (auth.kind !== 'loading') return;
    let cancelled = false;
    void restoreSession()
      .then((profile) => {
        if (!cancelled) restoreComplete(profile);
      })
      .catch(() => {
        if (!cancelled) restoreComplete(null);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.kind, restoreComplete]);

  useEffect(() => {
    if (auth.kind === 'signed_out') router.replace('/login');
    else if (auth.kind === 'signed_in') router.replace('/jobs');
  }, [auth.kind]);

  return <BootView />;
}
