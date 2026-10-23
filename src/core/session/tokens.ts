/**
 * Session token persistence.
 *
 * Tokens live in the OS keystore via `expo-secure-store` — never in AsyncStorage, never in Zustand,
 * never in a log line. The in-memory cache exists so the hot path of every request is not an
 * async keystore read; it is populated from the keystore on start and cleared on sign-out.
 *
 * ## What is deliberately NOT here
 *
 * No refresh logic. `client.ts` owns rotation so that exactly one place can serialise concurrent
 * 401s into a single refresh attempt. This module only stores and retrieves.
 */

import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'spoon.cook.accessToken';
const REFRESH_KEY = 'spoon.cook.refreshToken';
const EXPIRES_KEY = 'spoon.cook.accessTokenExpiresAt';
const DEVICE_KEY = 'spoon.cook.deviceId';
const PENDING_OTP_KEY = 'spoon.cook.pendingOtp';
/** The backend's `LOGIN_OTP_TTL_SECONDS` default (300): after this the code is dead, so resuming is pointless. */
const PENDING_OTP_TTL_MS = 5 * 60 * 1000;
const LAST_PHONE_KEY = 'spoon.cook.lastPhone';

export interface StoredSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresAt: string;
}

let cache: StoredSession | null = null;
let loaded = false;

async function readKey(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // A keystore that cannot be read is indistinguishable from "no session" for our purposes:
    // the cook is sent to Login rather than the app crashing on start.
    return null;
  }
}

/** Load once from the keystore. Subsequent calls are served from memory. */
export async function loadSession(): Promise<StoredSession | null> {
  if (loaded) return cache;
  const [accessToken, refreshToken, accessTokenExpiresAt] = await Promise.all([
    readKey(ACCESS_KEY),
    readKey(REFRESH_KEY),
    readKey(EXPIRES_KEY),
  ]);
  loaded = true;
  cache =
    accessToken !== null && refreshToken !== null && accessTokenExpiresAt !== null
      ? { accessToken, refreshToken, accessTokenExpiresAt }
      : null;
  return cache;
}

/** Synchronous read of the cached session. `null` before `loadSession()` has run. */
export function peekSession(): StoredSession | null {
  return cache;
}

export async function saveSession(session: StoredSession): Promise<void> {
  cache = session;
  loaded = true;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken),
    SecureStore.setItemAsync(EXPIRES_KEY, session.accessTokenExpiresAt),
  ]);
}

export async function clearSession(): Promise<void> {
  cache = null;
  loaded = true;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(EXPIRES_KEY),
  ]);
}

/**
 * A stable per-install device id.
 *
 * `POST /auth/otp/verify` requires one and binds the refresh-token family to it, so it must
 * survive app restarts. It is not a secret, but it lives beside the tokens for simplicity.
 */
export async function deviceId(): Promise<string> {
  const existing = await readKey(DEVICE_KEY);
  if (existing !== null && existing.length > 0) return existing;
  const generated = `cook-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  await SecureStore.setItemAsync(DEVICE_KEY, generated);
  return generated;
}

/**
 * The number an OTP was just sent to, kept so the cook lands back on the OTP page if Android
 * reclaims the app while they are in their messages app reading the code. Without it a cold
 * start has nothing but the Login screen to offer, and the code they are holding is orphaned.
 *
 * Holds the phone only — never a code or a token — and expires, so a stale entry from days ago
 * cannot hijack a normal launch.
 */
export async function savePendingOtp(
  localTenDigits: string,
  now: number = Date.now(),
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      PENDING_OTP_KEY,
      JSON.stringify({ phone: localTenDigits, at: now }),
    );
  } catch {
    // Resume is a convenience; sending the code already succeeded.
  }
}

export async function readPendingOtp(now: number = Date.now()): Promise<string | null> {
  const raw = await readKey(PENDING_OTP_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { phone?: unknown; at?: unknown };
    if (
      typeof parsed.phone === 'string' &&
      typeof parsed.at === 'number' &&
      now - parsed.at >= 0 &&
      now - parsed.at < PENDING_OTP_TTL_MS
    ) {
      return parsed.phone;
    }
  } catch {
    // Fall through to clearing the unreadable entry.
  }
  await clearPendingOtp();
  return null;
}

export async function clearPendingOtp(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_OTP_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The ten-digit number from this install's last successful sign-in, so Login can prefill it.
 *
 * Deliberately outside `clearSession` — sign-out removes only the three token keys, so a signed-out
 * cook still finds their own number waiting. Best-effort both ways: a keystore failure must never
 * block sign-in or Login.
 */
export async function readLastPhone(): Promise<string | null> {
  return readKey(LAST_PHONE_KEY);
}

export async function writeLastPhone(localTenDigits: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_PHONE_KEY, localTenDigits);
  } catch {
    // Convenience only; the sign-in already succeeded.
  }
}

/** Test seam — resets the module-level cache between tests. */
export function __resetSessionCacheForTests(): void {
  cache = null;
  loaded = false;
}
