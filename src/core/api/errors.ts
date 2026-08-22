/**
 * Typed API failures.
 *
 * The backend answers every failure with one canonical envelope
 * (`src/shared/errors/error-response.ts`):
 *
 *     { "error": { "code": "...", "message": "...", "requestId": "..." } }
 *
 * `code` is the stable contract; `message` is English prose meant for operators, so the app maps
 * `code` onto its own Hinglish copy rather than surfacing the server string to a cook.
 *
 * Transport failures (offline, DNS, timeout) are NOT server errors and must stay distinguishable:
 * a cook with no signal has a different problem from a cook whose session expired.
 */

/** Exactly the codes in `src/shared/errors/error-codes.ts`. */
export const apiErrorCodes = [
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'ADDRESS_NOT_SERVICEABLE',
  'SLOT_UNAVAILABLE',
  'NO_ELIGIBLE_COOK',
  'INVALID_BOOKING_STATE',
  'ACTIVE_ASSIGNMENT_CHANGED',
  'ARRIVAL_PROXIMITY_NOT_CONFIRMED',
  'INVALID_SERVICE_OTP',
  'PAYMENT_NOT_VERIFIED',
  'PAYMENT_AMOUNT_MISMATCH',
  'REFUND_ALREADY_REQUESTED',
  'REFUND_NOT_ALLOWED',
  'EXTENSION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'RATE_LIMITED',
  'PROVIDER_TEMPORARILY_UNAVAILABLE',
  'DEPENDENCY_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof apiErrorCodes)[number];

/** Local-only failure kinds that never come from the server. */
export type ApiFailureKind =
  | 'server'
  /** Request never reached the server, or no reply arrived. */
  | 'offline'
  /** Exceeded `requestTimeoutMs`. */
  | 'timeout'
  /** The caller aborted (screen unmounted, newer request superseded this one). */
  | 'cancelled'
  /** A 2xx body that did not match the schema — a genuine contract mismatch worth reporting. */
  | 'contract';

export class ApiError extends Error {
  readonly kind: ApiFailureKind;
  readonly code: ApiErrorCode | null;
  readonly status: number | null;
  readonly requestId: string | null;
  /** Zod issue summary for `contract` failures. Never contains response values. */
  readonly contractDetail: string | null;

  constructor(init: {
    kind: ApiFailureKind;
    message: string;
    code?: ApiErrorCode | null;
    status?: number | null;
    requestId?: string | null;
    contractDetail?: string | null;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.code = init.code ?? null;
    this.status = init.status ?? null;
    this.requestId = init.requestId ?? null;
    this.contractDetail = init.contractDetail ?? null;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** True when the session is gone and the app must return to Login. */
export function isSessionExpired(error: unknown): boolean {
  return isApiError(error) && error.kind === 'server' && error.code === 'UNAUTHENTICATED';
}

export function isCancelled(error: unknown): boolean {
  return isApiError(error) && error.kind === 'cancelled';
}

/** A stale assignment version — the app is acting on authority it no longer has. */
export function isAssignmentChanged(error: unknown): boolean {
  return isApiError(error) && error.code === 'ACTIVE_ASSIGNMENT_CHANGED';
}

/**
 * Hinglish copy for a failure.
 *
 * Deliberately conservative: anything unrecognised gets the generic retry line rather than an
 * invented explanation.
 */
export function apiErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Kuch gadbad ho gayi. Firse koshish kare.';

  switch (error.kind) {
    case 'offline':
      return 'Internet nahi mil raha. Connection check kare.';
    case 'timeout':
      return 'Server jawab nahi de raha. Firse koshish kare.';
    case 'cancelled':
      return 'Request rok di gayi.';
    case 'contract':
      return 'App update chahiye. Support se baat kare.';
    case 'server':
      break;
  }

  switch (error.code) {
    case 'UNAUTHENTICATED':
      return 'Aapka session khatam ho gaya. Firse login kare.';
    case 'FORBIDDEN':
      return 'Iski permission nahi hai.';
    case 'RESOURCE_NOT_FOUND':
      return 'Yeh mila nahi.';
    case 'INVALID_SERVICE_OTP':
      return 'OTP galat hai. Customer se firse puche.';
    case 'INVALID_BOOKING_STATE':
      return 'Yeh abhi nahi ho sakta. Screen refresh kare.';
    case 'ACTIVE_ASSIGNMENT_CHANGED':
      return 'Yeh kaam badal gaya hai. Jobs firse dekhe.';
    case 'ARRIVAL_PROXIMITY_NOT_CONFIRMED':
      return 'Aap gate ke paas nahi dikh rahe. Gate pe pahauch kar firse kare.';
    case 'RATE_LIMITED':
      return 'Bahut requests. Thodi der baad kare.';
    case 'PROVIDER_TEMPORARILY_UNAVAILABLE':
    case 'DEPENDENCY_UNAVAILABLE':
      return 'Service abhi available nahi hai. Thodi der baad kare.';
    case 'INVALID_REQUEST':
      return 'Yeh request sahi nahi hai.';
    default:
      return 'Kuch gadbad ho gayi. Firse koshish kare.';
  }
}
