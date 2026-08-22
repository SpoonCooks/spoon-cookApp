/**
 * OTP contract configuration.
 *
 * ## The three mechanisms are not interchangeable
 *
 * Login OTP, Start OTP and End OTP have different lengths, different issuers and different
 * verification endpoints. They must never share a code path that could let one satisfy another.
 *
 *   login  → `POST /v1/auth/otp/verify`                        (MSG91, via Spoon's backend)
 *   start  → `POST /v1/cook/bookings/:id/verify-start-otp`     (customer reads it to the cook)
 *   end    → `POST /v1/cook/bookings/:id/verify-end-otp`       (customer reads it to the cook)
 *
 * ## The 3-vs-4 conflict is RESOLVED (2026-08-21)
 *
 * Phase 1 shipped `start`/`end` as 4 because the backend then validated `^[0-9]{4}$` while Figma
 * drew three boxes. Both sides have since moved to THREE and now agree:
 *
 *   - Backend: `SERVICE_OTP_DIGITS = 3` (`src/fulfilment/service-otp.ts:47`), enforced by
 *     `otp: { type: 'string', pattern: '^[0-9]{3}$' }` on both verify routes
 *     (`src/api/routes/v1/index.ts:2272` and `:2314`) and by `ServiceOtpRequest` in `openapi.yaml`.
 *   - Figma: `Page 6b- Start OTP` (`482:4656`) contains exactly three digit boxes
 *     (`478:4283`, `478:4286`, `478:4289`).
 *
 * Login stays 6 on both sides: Figma `Page 2a- Login OTP` (`434:3224`) draws six boxes
 * (`434:3258`…`434:3273`), and the backend default is `LOGIN_OTP_LENGTH … .default(6)`
 * (`src/config/env.ts:389`).
 *
 * Every screen reads its length from here, so a future change stays a one-line edit.
 */

export const otpKinds = ['login', 'start', 'end'] as const;
export type OtpKind = (typeof otpKinds)[number];

/**
 * Digit counts per OTP kind. Verified against backend source AND Figma on 2026-08-21.
 *
 * `login`: 6 — Figma `434:3224` six boxes; backend `LOGIN_OTP_LENGTH` default 6.
 * `start`: 3 — Figma `482:4656` three boxes; backend `^[0-9]{3}$`.
 * `end`:   3 — Figma `484:4875` three boxes; backend `^[0-9]{3}$`.
 */
export const otpLength: Record<OtpKind, number> = {
  login: 6,
  start: 3,
  end: 3,
};

/**
 * What the Figma actually draws. Kept as a separate record so a future divergence is detected by
 * a test rather than discovered by a cook who cannot enter the code the backend issued.
 */
export const otpFigmaBoxCount: Record<OtpKind, number> = {
  login: 6,
  start: 3,
  end: 3,
};

/** True when the implemented length disagrees with the design. Currently false for all kinds. */
export function hasOtpFigmaConflict(kind: OtpKind): boolean {
  return otpLength[kind] !== otpFigmaBoxCount[kind];
}

/**
 * The backend's service-OTP length, restated so a mismatch between what this app accepts and what
 * the API validates is caught by a test instead of by a 400 in the cook's hand.
 *
 * Source: `SERVICE_OTP_DIGITS = 3`, `pattern: '^[0-9]{3}$'`.
 */
export const backendServiceOtpDigits = 3;

/** The backend's default login OTP length (`LOGIN_OTP_LENGTH`, min 4, max 8, default 6). */
export const backendLoginOtpDigits = 6;

/** Resend cooldown shown as `Resend OTP in 25s` on `Page 2a` (`434:3274`). Presentation only. */
export const loginResendSeconds = 25;
