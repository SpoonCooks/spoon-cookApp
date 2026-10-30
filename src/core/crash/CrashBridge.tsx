import { useEffect } from 'react';

import { useSession } from '@core/session/store';

import { crashReporter } from './crashReporter';

/**
 * Names the signed-in cook to crash reporting, by her opaque id only.
 *
 * A component rather than a call in `RootLayout`, like `TrackingBridge` and `PushBridge` beside it:
 * it follows the session store, so one place covers every way a session starts or ends (sign-in,
 * a restored session, sign-out, Ops revoking it) instead of each of those having to remember to
 * call crash reporting. It draws nothing.
 *
 * The id is `cookId`, the backend's opaque id. Never `name` or `phone`, which sit on the same
 * profile object: a report leaves the device, and this app handles customers' details too.
 * (`crashReporter.setUser` also refuses anything shaped like a phone number or e-mail.)
 *
 * The build tags (`crashReporter.init`) are NOT set here: `RootLayout` renders nothing until the
 * fonts load, and a failure during that wait should still say which build it came from.
 */
export function CrashBridge(): null {
  const cookId = useSession((state) =>
    state.auth.kind === 'signed_in' ? state.auth.profile.cookId : null,
  );

  useEffect(() => {
    if (cookId === null) {
      crashReporter.clearUser();
      return;
    }
    crashReporter.setUser(cookId);
  }, [cookId]);

  return null;
}
