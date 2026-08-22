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

export interface LeaveEntry {
  readonly id: string;
  readonly dateIso: string;
  /** Figma shows `Planned Leave`. */
  readonly label: string;
  /** Figma shows `Approved`. Leave *creation* is Ops-only — GAP-21. */
  readonly status: 'approved' | 'pending' | 'rejected';
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
