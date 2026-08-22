/**
 * Cook authentication flow.
 *
 * Composes the three steps that must happen together and in order:
 *   1. verify the login OTP with `audience: 'cook'`
 *   2. persist the returned tokens in the OS keystore
 *   3. read `GET /v1/cook/me` and run the result through `gateCookAccess`
 *
 * Step 3 is not optional. A 200 from verify proves the phone belongs to an active cook, but the
 * app still needs the profile to render anything, and routing the profile through the gate keeps
 * a single decision point for "may this person enter".
 *
 * ## Denial reasons are only as specific as the server allows
 *
 * The backend deliberately refuses to distinguish "unknown phone" from "known but not eligible"
 * for a cook audience — that distinction would let an attacker enumerate cook phone numbers. So:
 *
 *   `400 INVALID_REQUEST` → wrong or expired OTP (not a denial; the cook retries)
 *   `401 UNAUTHENTICATED` → not a provisioned cook
 *   `403 FORBIDDEN`       → a cook exists but is not active
 *
 * The app must not invent a more specific reason than it was given.
 */

import { getCookProfile, logout, requestLoginOtp, verifyLoginOtp } from '../api/cook';
import { isApiError } from '../api/errors';
import { gateCookAccess, type AuthState, type CookProfile } from '../domain/auth';
import { clearSession, deviceId, loadSession, saveSession } from './tokens';

/** `9876543210` → `+919876543210`, the format both OTP routes validate. */
export function toE164(localTenDigits: string): string {
  return `+91${localTenDigits}`;
}

export async function sendLoginOtp(localTenDigits: string): Promise<void> {
  await requestLoginOtp(toE164(localTenDigits));
}

function profileFrom(
  response: Awaited<ReturnType<typeof getCookProfile>>,
  phone: string,
): CookProfile {
  return {
    cookId: response.cook.id,
    name: response.cook.name,
    photoUrl: response.cook.photoUrl,
    phone,
    rating: response.cook.rating.count > 0 ? response.cook.rating.average : null,
  };
}

/**
 * Verify an OTP and open a gated session.
 *
 * Returns the resulting `AuthState` so the caller can route. On any denial the stored session is
 * cleared, because a token that cannot open the app must not survive to be refreshed later.
 */
export async function completeLogin(input: {
  readonly localTenDigits: string;
  readonly otp: string;
}): Promise<AuthState> {
  const phoneE164 = toE164(input.localTenDigits);
  const device = await deviceId();

  let session;
  try {
    session = await verifyLoginOtp({ phoneE164, otp: input.otp, deviceId: device });
  } catch (error) {
    if (isApiError(error) && error.kind === 'server') {
      if (error.status === 401) return { kind: 'denied', reason: 'not_provisioned' };
      // The server will not say whether this is pending, suspended or rejected. `inactive` is the
      // honest projection: the account is not usable, without claiming which reason applies.
      if (error.status === 403) return { kind: 'denied', reason: 'inactive' };
    }
    throw error;
  }

  await saveSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
  });

  let profileResponse;
  try {
    profileResponse = await getCookProfile();
  } catch (error) {
    await clearSession();
    if (isApiError(error) && error.kind === 'server' && error.status === 403) {
      return { kind: 'denied', reason: 'inactive' };
    }
    throw error;
  }

  const state = gateCookAccess({
    role: session.user.role,
    userStatus: session.user.status,
    cookProfileStatus: profileResponse.cook.status,
    profile: profileFrom(profileResponse, phoneE164),
  });

  if (state.kind !== 'signed_in') await clearSession();
  return state;
}

/**
 * Restore a session on cold start.
 *
 * `null` means "go to Login". Any stored token is re-validated against `GET /v1/cook/me` rather
 * than trusted, so a cook whose approval was revoked while the app was closed does not get in on
 * a stale token. A transport failure is NOT treated as a revoked session — the tokens are kept and
 * the error is propagated, so a cook with no signal is not silently logged out.
 */
export async function restoreSession(): Promise<CookProfile | null> {
  const stored = await loadSession();
  if (stored === null) return null;

  const profileResponse = await getCookProfile();
  const state = gateCookAccess({
    role: 'cook',
    userStatus: 'active',
    cookProfileStatus: profileResponse.cook.status,
    // The phone is not part of the profile projection; it is not needed after login.
    profile: profileFrom(profileResponse, ''),
  });

  if (state.kind !== 'signed_in') {
    await clearSession();
    return null;
  }
  return state.profile;
}

/** Revoke server-side, then clear locally. Local state is cleared even if the call fails. */
export async function endSession(): Promise<void> {
  try {
    await logout();
  } catch {
    // A network failure must not strand the cook in a session they asked to leave.
  } finally {
    await clearSession();
  }
}
