/**
 * Cook-initiated leave requests ("Chutti lagaye").
 *
 * ## This flow is in scope, and it has no backend
 *
 * The approved Figma `Attendance` section (`540:416`) contains a complete cook-initiated leave
 * flow that no previous inventory covered:
 *
 *   `506:1986` Page 11        — `Chutti lagaye`, `1 din ki chutti` day chips, `lambi chutti`
 *   `528:483`  Page 14a       — `Chutti pakka hai?` + `Pakka`
 *   `529:1259` Page 14b       — the day now reads `Chutti lag gyi`
 *   `528:659`  Page 13a       — month grid, `Total din 0`, `Pakka`
 *   `530:1349` Page 13b       — days selected, `Total din 10`
 *   `530:1478` Page 13c       — `Aane wali chutti` → `16 Nov se 25 Nov tak`, `Dates badle`
 *
 * The backend exposes **no cook-side leave write**. `GET /v1/cook/leaves` reads APPROVED leaves
 * only, and the sole writer is `POST /v1/admin/cooks/:cookId/leaves` behind an admin principal.
 * There is no request table, no pending state and no approval transition for a cook-submitted
 * leave.
 *
 * Therefore the screens are built, the contract below is stated precisely, and **submission is
 * disabled**. Nothing in this app may report a leave as applied that the server has never seen —
 * a cook who believes `Chutti lag gyi` and does not turn up has been actively misled by the app.
 *
 * See `docs/COOK_APP_PHASE_1_BACKEND_READINESS_AND_GAP_REPORT.md` GAP-21 for the endpoint this
 * needs.
 */

/** What the cook is asking for. Both variants exist as separate Figma flows. */
export type LeaveRequestKind =
  /** `1 din ki chutti` — a single service date chosen from the day chips. */
  | { readonly kind: 'single_day'; readonly dateIso: string }
  /** `lambi chutti` — an inclusive range chosen on the month grid. */
  | { readonly kind: 'date_range'; readonly fromDateIso: string; readonly toDateIso: string };

/**
 * The request body the backend would need to accept.
 *
 * `idempotencyKey` is required for the same reason every other cook command requires one: a
 * double-tap must not create two leave requests.
 */
export interface LeaveRequestDraft {
  readonly selection: LeaveRequestKind;
  readonly idempotencyKey: string;
}

/** Lifecycle a cook-submitted leave would move through. `approved` is the only state today. */
export const leaveRequestStatuses = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveRequestStatus = (typeof leaveRequestStatuses)[number];

/** The response projection the screens are written against. */
export interface LeaveRequestResult {
  readonly id: string;
  readonly status: LeaveRequestStatus;
  readonly fromDateIso: string;
  readonly toDateIso: string;
  readonly totalDays: number;
  readonly submittedAtIso: string;
}

/**
 * Whether the app may submit a leave request.
 *
 * Hardcoded `false` deliberately: it is a single, greppable switch that flips when GAP-21 ships,
 * and a test asserts that no screen bypasses it. It is NOT a feature flag to be toggled on before
 * the endpoint exists.
 */
export function canSubmitLeaveRequest(): boolean {
  return false;
}

/** Copy shown where the Figma puts the submit affordance, while the contract is missing. */
export const leaveRequestUnavailableCopy =
  'Chutti ki request abhi app se nahi lag sakti. Apne manager ko bataye.';

/** Inclusive day count for a range — display only (`Total din`). */
export function countLeaveDays(selection: LeaveRequestKind): number {
  if (selection.kind === 'single_day') return 1;
  const from = Date.parse(`${selection.fromDateIso}T00:00:00Z`);
  const to = Date.parse(`${selection.toDateIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  return Math.round((to - from) / 86_400_000) + 1;
}
