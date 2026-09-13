/**
 * Attendance & Leaves domain types.
 *
 * Sourced from Figma `Page 11- attendance` (`506:1986`) and the Attendance & Leaves screen
 * (`505:1596`).
 *
 * ## Two rules that are easy to get wrong
 *
 * 1. `Present` on `506:1986` is a real BUTTON (`505:1661`, fill `#cfff04`), so the cook marks
 *    their own attendance. The app must never show it as marked until the backend confirms.
 *    No such endpoint exists yet — GAP-20.
 *
 * 2. The Figma legend reads `Present · On Leave · Scheduled`, but the backend
 *    `cook_attendance.status` vocabulary is only `present | absent | leave`. **`Scheduled` is not
 *    an attendance status** — it comes from shift/booking data and must never be written into
 *    `cook_attendance.status`. `DayMark` below keeps them in separate fields for that reason.
 */

/** Backend `cook_attendance.status`, exactly as stored. */
export const attendanceStatuses = ['present', 'absent', 'leave'] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

/**
 * What a calendar cell renders. `scheduled` is a SHIFT fact, not an attendance fact, which is why
 * it is a separate variant rather than a fourth `AttendanceStatus`.
 */
export type DayMark =
  | { readonly kind: 'attendance'; readonly status: AttendanceStatus }
  | { readonly kind: 'scheduled' }
  | { readonly kind: 'none' };

export interface AttendanceDay {
  /** `YYYY-MM-DD` in IST — the service date, never a UTC cast. */
  readonly dateIso: string;
  readonly mark: DayMark;
}

/**
 * One leave REQUEST, not one leave day.
 *
 * The deployed `GET /v1/cook/leaves` groups `cook_leaves` rows by `leave_request_id` and answers
 * with a range plus a rolled-up verdict, so a five-day request arrives as ONE row spanning
 * `startDateIso..endDateIso`. Modelling it per-day here would misreport a single request as five
 * separate chutties in the cook's list.
 *
 * `reason` is nullable in the contract and stays nullable here: an absent reason is a fact about
 * the request, and inventing `'Chutti'` for it would put words in the cook's mouth.
 */
export interface LeaveEntry {
  readonly id: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  /** Inclusive day count — display only (`Total din`). */
  readonly dayCount: number;
  readonly reason: string | null;
  /**
   * The server's roll-up. `cancelled` is included because the backend can report it and a value
   * this build cannot render must not be silently upgraded to `approved`.
   */
  readonly status: 'approved' | 'pending' | 'rejected' | 'cancelled';
}

/**
 * Monthly attendance projection.
 *
 * `onTimePercent` is the Figma `98% On-Time` tile. It must be backend-supplied — no such
 * aggregate exists today (GAP-22), and computing it client-side from visible days would be wrong
 * because the cook only ever sees a window.
 */
export interface AttendanceMonth {
  readonly monthLabel: string;
  readonly cycleLabel: string;
  readonly isCurrentMonth: boolean;
  readonly days: readonly AttendanceDay[];
  readonly presentCount: number;
  readonly leaveCount: number;
  readonly onTimePercent: number | null;
  readonly upcomingLeaves: readonly LeaveEntry[];
}

/** Today's attendance state, driving the `Present` button on `506:1986`. */
export interface TodayAttendance {
  readonly dateIso: string;
  readonly status: AttendanceStatus | null;
  /** Server says the cook may mark presence now. Never inferred client-side. */
  readonly canMarkPresent: boolean;
}
