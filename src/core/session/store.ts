import { create } from 'zustand';

import {
  gateCookAccess,
  type AuthState,
  type CookProfile,
  type VerifyResult,
} from '../domain/auth';

/**
 * Central authenticated Cook session.
 *
 * Holds only identity and session lifecycle. Job, service, money and attendance data are fetched
 * per-screen and are never cached here — a stale copy of an active service is exactly the kind of
 * thing that would let the app render a screen the backend has already moved past.
 *
 * `signIn` routes through `gateCookAccess`, so a technically-valid OTP for a non-cook cannot
 * produce a signed-in session even if the backend hands back a token (see GAP-06).
 */
export interface SessionState {
  readonly auth: AuthState;
  readonly beginOtp: (phone: string) => void;
  readonly signIn: (result: VerifyResult) => AuthState;
  readonly signOut: () => void;
  readonly restoreComplete: (profile: CookProfile | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  auth: { kind: 'loading' },

  beginOtp: (phone) => set({ auth: { kind: 'otp_pending', phone } }),

  signIn: (result) => {
    const next = gateCookAccess(result);
    set({ auth: next });
    return next;
  },

  signOut: () => set({ auth: { kind: 'signed_out' } }),

  restoreComplete: (profile) =>
    set({ auth: profile === null ? { kind: 'signed_out' } : { kind: 'signed_in', profile } }),
}));

/** Convenience selector — true only for a fully gated, approved cook. */
export function selectIsSignedIn(state: SessionState): boolean {
  return state.auth.kind === 'signed_in';
}
