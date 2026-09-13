/**
 * Cook-initiated leave requests ("Chutti lagaye").
 *
 * ## The backend now exists — and was verified deployed
 *
 * `POST /v1/cook/leaves` is registered on the live API (`spoon-api-kalc.onrender.com`, probed
 * 2026-08-23: `401 UNAUTHENTICATED`, not `404`). It is one of the routes that exist ONLY in the
 * backend commit deployed to that host, which is how the deployed build was fingerprinted.
 *
 * The submission gate that stood here while the endpoint was missing is therefore lifted. What it
 * protected against still holds and is enforced elsewhere:
 *
 *   - the request lands as `pending`; Ops/Admin decide. No screen may say `Chutti lag gyi`.
 *   - the app never marks the leave locally — every screen re-reads `GET /cook/leaves`.
 *
 * `GET /cook/leaves` returns REQUESTS grouped by `leave_request_id`, including pending and
 * rejected ones, so a submitted request is visible to the cook immediately in its real state.
 */

/** What the cook is asking for. Both variants exist as separate Figma flows. */
export type LeaveRequestKind =
  /** `1 din ki chutti` — a single service date chosen from the day chips. */
  | { readonly kind: 'single_day'; readonly dateIso: string }
  /** `lambi chutti` — an inclusive range chosen on the month grid. */
  | { readonly kind: 'date_range'; readonly fromDateIso: string; readonly toDateIso: string };

/** Lifecycle a cook-submitted leave moves through. Submission always yields `pending`. */
export const leaveRequestStatuses = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveRequestStatus = (typeof leaveRequestStatuses)[number];

export function toLeaveRequestStatus(value: string): LeaveRequestStatus {
  // An unrecognised roll-up is treated as still-undecided rather than as approved: telling a cook
  // their leave is granted when it is not is the failure this whole flow is built to avoid.
  return leaveRequestStatuses.find((status) => status === value) ?? 'pending';
}

/** The endpoint body, in the shape `POST /cook/leaves` validates. */
export interface LeaveRequestDraft {
  readonly selection: LeaveRequestKind;
  readonly idempotencyKey: string;
  readonly reason?: string;
}

/** `{ startDate, endDate }` — the only two fields the route requires. */
export function toLeaveRequestRange(selection: LeaveRequestKind): {
  readonly startDateIso: string;
  readonly endDateIso: string;
} {
  if (selection.kind === 'single_day') {
    return { startDateIso: selection.dateIso, endDateIso: selection.dateIso };
  }
  return { startDateIso: selection.fromDateIso, endDateIso: selection.toDateIso };
}

/**
 * Whether this selection is valid to send.
 *
 * Mirrors the server's own rules so an obviously-doomed request is not spent: the backend rejects
 * `endDate < startDate` with `400`, and a `startDate` before today's Asia/Kolkata service date
 * with `400`. `todayIso` is supplied by the CALLER from `serverTime` — the device clock never
 * decides a service date.
 */
export function validateLeaveSelection(
  selection: LeaveRequestKind,
  todayIso: string,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const { startDateIso, endDateIso } = toLeaveRequestRange(selection);
  if (startDateIso.length !== 10 || endDateIso.length !== 10) {
    return { ok: false, message: 'Dates chunein.' };
  }
  if (endDateIso < startDateIso) {
    return { ok: false, message: 'Aakhri din pehle din se pehle nahi ho sakta.' };
  }
  if (todayIso.length === 10 && startDateIso < todayIso) {
    return { ok: false, message: 'Guzre hue din ki chutti nahi lag sakti.' };
  }
  return { ok: true };
}

/** Shown after a successful submission. Deliberately not "chutti lag gyi". */
export const leaveRequestPendingCopy = 'Chutti ki request bhej di. Manager approve karenge.';

/** Inclusive day count for a range — display only (`Total din`). */
export function countLeaveDays(selection: LeaveRequestKind): number {
  if (selection.kind === 'single_day') return 1;
  const from = Date.parse(`${selection.fromDateIso}T00:00:00Z`);
  const to = Date.parse(`${selection.toDateIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  return Math.round((to - from) / 86_400_000) + 1;
}
