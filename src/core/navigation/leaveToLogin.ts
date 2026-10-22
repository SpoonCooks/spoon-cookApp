import { router } from 'expo-router';

/**
 * Takes the cook to Login and drops every signed-in screen beneath it.
 *
 * A bare `router.replace('/login')` only swaps the TOP route. With the tabs underneath (Profile is
 * pushed over them) they stayed mounted behind Login, still holding authenticated queries. Back
 * on the OTP page, returning from the messages app made every one of those queries refetch on
 * focus, the 401s read as a lost session, and the cook was thrown back to Login mid-sign-in.
 */
export function leaveToLogin(): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/login');
}
