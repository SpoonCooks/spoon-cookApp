/**
 * Cook authentication and the approved-cook gate.
 *
 * ## Product rule
 *
 * Cook self-registration does not exist. Every cook is created and approved by Ops. A valid OTP
 * alone must NOT grant access to an unknown, unprovisioned, pending, suspended or rejected phone.
 *
 * ## Known backend gap this models around (GAP-06)
 *
 * `POST /v1/auth/otp/verify` currently upserts `role='user', status='active'` for ANY phone that
 * passes OTP (`src/api/routes/v1/index.ts:593`), so an unknown number receives a valid token as a
 * *customer* and a stray `users` row is created. The per-route `requireCook` guard still protects
 * all cook DATA, but login itself is role-blind.
 *
 * Until the backend gains a cook `audience` and explicit rejection codes, the app performs the
 * gate CLIENT-SIDE as a second line of defence: a session is only accepted when the verify
 * response identifies an approved cook. This is a UX gate, not a security boundary — the security
 * boundary remains `requireCook` on the server. It must never be relaxed into "OTP succeeded, so
 * let them in".
 */

/** Why a cook may be refused entry after a technically-valid OTP. */
export const cookAccessDenials = [
  'not_provisioned',
  'pending_approval',
  'suspended',
  'rejected',
  'inactive',
] as const;
export type CookAccessDenial = (typeof cookAccessDenials)[number];

/** Hinglish copy for each denial. Placeholder wording — no Figma frame covers these states. */
export const cookAccessDenialCopy: Record<CookAccessDenial, string> = {
  not_provisioned: 'Yeh number Spoon partner ke roop me registered nahi hai.',
  pending_approval: 'Aapka account abhi approval ka intezaar kar raha hai.',
  suspended: 'Aapka account filhaal band hai. Support se baat kare.',
  rejected: 'Aapka account approve nahi hua hai. Support se baat kare.',
  inactive: 'Aapka account active nahi hai. Support se baat kare.',
};

export interface CookProfile {
  readonly cookId: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly phone: string;
  /** Figma Attendance & Leaves shows a rating (`4.9`). Needs GAP-02/GAP-24. */
  readonly rating: number | null;
}

export type AuthState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'otp_pending'; readonly phone: string }
  | { readonly kind: 'denied'; readonly reason: CookAccessDenial }
  | { readonly kind: 'signed_in'; readonly profile: CookProfile };

/** Raw verify-response shape the gate inspects. */
export interface VerifyResult {
  readonly role: string;
  readonly userStatus: string;
  readonly cookProfileStatus: string | null;
  readonly profile: CookProfile | null;
}

/**
 * Decide whether a verified identity may enter the Cook App.
 *
 * Deliberately allowlist-shaped: anything not explicitly an active cook with an active profile is
 * refused. A future backend status this code has never seen falls through to a denial rather than
 * being admitted by default.
 */
export function gateCookAccess(result: VerifyResult): AuthState {
  if (result.role !== 'cook') return { kind: 'denied', reason: 'not_provisioned' };

  if (result.userStatus === 'suspended') return { kind: 'denied', reason: 'suspended' };
  if (result.userStatus === 'pending') return { kind: 'denied', reason: 'pending_approval' };
  if (result.userStatus !== 'active') return { kind: 'denied', reason: 'inactive' };

  switch (result.cookProfileStatus) {
    case 'active':
      break;
    case 'pending':
      return { kind: 'denied', reason: 'pending_approval' };
    case 'rejected':
      return { kind: 'denied', reason: 'rejected' };
    case 'paused':
    case 'suspended':
      return { kind: 'denied', reason: 'suspended' };
    default:
      return { kind: 'denied', reason: 'not_provisioned' };
  }

  if (result.profile === null) return { kind: 'denied', reason: 'not_provisioned' };
  return { kind: 'signed_in', profile: result.profile };
}

/**
 * Indian mobile validation matching the backend's expectation: 10 digits starting 6-9.
 * Accepts an optional `+91`/`91`/`0` prefix and normalises it away.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local =
    digits.startsWith('91') && digits.length === 12
      ? digits.slice(2)
      : digits.startsWith('0') && digits.length === 11
        ? digits.slice(1)
        : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}
