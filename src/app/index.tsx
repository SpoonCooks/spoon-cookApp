import { router } from 'expo-router';
import { useEffect } from 'react';

import { getCurrentJob } from '@core/api/cook';
import { restoreSession } from '@core/session/auth';
import { readPendingOtp } from '@core/session/tokens';
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
/** The statuses in which a job is under way: she has set off and not yet finished. */
const ONGOING_STATUSES: ReadonlySet<string> = new Set(['cook_en_route', 'cook_arrived', 'cooking']);

/**
 * Where a signed-in cook lands: her ongoing job if she has one, otherwise Kaam.
 *
 * Decided here, behind the boot screen, so a cook whose app was killed mid-job (Sucharita,
 * 2026-10-24: she lost the screen after the Start OTP and never reached the End OTP) opens straight
 * onto the stage she was in, without Kaam being drawn first. A failed read lands on Kaam, which
 * itself sends her on to an ongoing job once its own read succeeds.
 */
async function routeSignedIn(): Promise<void> {
  try {
    const job = await getCurrentJob();
    if (job !== null && job.reassignment.current && ONGOING_STATUSES.has(job.status)) {
      router.replace({ pathname: '/service/[bookingId]', params: { bookingId: job.bookingId } });
      return;
    }
  } catch {
    // Fall through to Kaam.
  }
  router.replace('/jobs');
}

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
    if (auth.kind === 'signed_out') {
      router.replace('/login');
      // The app was reclaimed while the cook read their code: put them back on the OTP page.
      void readPendingOtp().then((phone) => {
        if (phone !== null) router.push({ pathname: '/otp', params: { phone } });
      });
    } else if (auth.kind === 'signed_in') {
      void routeSignedIn();
    }
  }, [auth.kind]);

  return <BootView />;
}
