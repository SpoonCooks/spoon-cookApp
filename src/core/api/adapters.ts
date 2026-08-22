/**
 * Backend projection → domain model.
 *
 * This is the only layer allowed to know both vocabularies. Screens consume the domain types and
 * never see a raw API shape, so a backend field rename is a change here rather than across twelve
 * components.
 *
 * ## The one arithmetic this file performs, and why it is legitimate
 *
 * `minutesToDeadline` is derived as `customerCommitmentAt − serverTime`. Both operands are SERVER
 * timestamps from the same payload, so this is unit conversion, not a ruling: the device clock is
 * never consulted, and the sign is preserved so `-2 mins` survives to the screen. The actual
 * lateness VERDICT is `timing.riskState`, which the backend owns and this file only translates.
 */

import type { AttendanceDay, AttendanceMonth, DayMark, LeaveEntry } from '../domain/attendance';
import type { BonusProgress, EarningsCycleRef } from '../domain/money';
import type { JobAction, JobCardModel } from '../domain/job';
import type {
  ArrivalTiming,
  BookingStatus,
  CustomerAddressSnapshot,
  ExtensionProjection,
  GateTarget,
  JobSummary,
  ServiceSnapshot,
  TravelTiming,
} from '../domain/serviceState';
import { bookingStatuses } from '../domain/serviceState';
import type {
  CookCycleSummaryResponse,
  CookEarningsResponse,
  CookJobResponse,
  CookLeavesResponse,
  MonthlyAttendanceResponse,
} from './schemas';

/* --------------------------------------------------------------- shared --- */

/** Whole minutes between two ISO instants, sign preserved. */
function minutesBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 60_000);
}

/**
 * Narrow the backend's `status` string to the closed set the projection switches on.
 *
 * A status this build has never seen returns `null`, which callers surface as a contract failure
 * rather than guessing a screen. Silently defaulting would be the exact bug the exhaustiveness
 * guard in `projectServiceState` exists to prevent.
 */
export function toBookingStatus(value: string): BookingStatus | null {
  return bookingStatuses.find((status) => status === value) ?? null;
}

/** The backend's travel ruling → the Figma variant selector. `UNKNOWN` yields `null`. */
export function toTravelTiming(riskState: string): TravelTiming | null {
  switch (riskState) {
    case 'TRAVEL_ON_TIME':
      return 'on_time';
    case 'TRAVEL_RISK':
      return 'at_risk';
    case 'TRAVEL_LATE':
      return 'late';
    default:
      // `UNKNOWN` means the server has no ruling. Absence of evidence is not lateness.
      return null;
  }
}

function toAddress(job: CookJobResponse): CustomerAddressSnapshot {
  return {
    buildingName: job.destination.society,
    towerOrBlock: job.destination.tower,
    // The backend projection carries no separate floor field; flat covers it.
    floor: null,
    flatOrHouse: job.destination.flat,
    customerName: null,
  };
}

/** Tracking and arrival target. Always the booking coordinate — never the flat. */
function toGate(job: CookJobResponse): GateTarget {
  return {
    latitude: job.destination.latitude,
    longitude: job.destination.longitude,
    label: job.destination.label,
  };
}

export function toJobSummary(job: CookJobResponse): JobSummary {
  return {
    bookingId: job.bookingId,
    assignmentVersion: job.assignmentVersion,
    societyOrBuilding: job.destination.society ?? job.destination.label,
    serviceDurationMinutes: job.durationMinutes,
    scheduledStartIso: job.serviceStart,
    reachByIso: job.timing.customerCommitmentAt,
    address: toAddress(job),
    gate: toGate(job),
  };
}

/* ----------------------------------------------------------------- jobs --- */

/**
 * A job list card.
 *
 * `isActionable` is `assigned && current assignment` — the server decides both. The countdown is
 * only meaningful once there is a commitment to count toward, so it is null before assignment.
 */
export function toJobCard(job: CookJobResponse): JobCardModel {
  const status = toBookingStatus(job.status);
  const actionable = job.reassignment.current && (status === 'assigned' || status === 'created');
  const action: JobAction = actionable ? 'start_travel' : 'none';

  return {
    bookingId: job.bookingId,
    assignmentVersion: job.assignmentVersion,
    societyOrBuilding: job.destination.society ?? job.destination.label,
    serviceDurationMinutes: job.durationMinutes,
    scheduledStartIso: job.serviceStart,
    reachByIso: job.timing.customerCommitmentAt,
    minutesToDeadline: minutesBetween(job.serverTime, job.timing.customerCommitmentAt),
    // The projection exposes no separate travel-duration estimate; `null` renders no `12 min dur`
    // chip rather than an invented number.
    travelMinutes: null,
    action,
    isActionable: actionable,
    isRunningLate: job.timing.riskState === 'TRAVEL_LATE',
    address: toAddress(job),
    gate: toGate(job),
  };
}

/* -------------------------------------------------------- service state --- */

function toExtension(job: CookJobResponse): ExtensionProjection {
  const isExtended = job.extension.state === 'confirmed' || job.extension.state === 'active';
  return {
    isExtended,
    extendedByMinutes: job.extension.minutes,
    newExpectedEndIso: job.extension.expectedEnd,
  };
}

/**
 * Build the snapshot `projectServiceState` consumes.
 *
 * `arrivalTiming` reuses the travel ruling: the backend does not publish a separate arrival
 * verdict, and whether the cook arrived late is exactly whether they were late in transit.
 * `interruption` is set when the booking was cancelled or the cook no longer holds the current
 * assignment — either way the actionable flow must stop.
 */
export function toServiceSnapshot(
  job: CookJobResponse | null,
  receivedAtMs: number,
): ServiceSnapshot | null {
  if (job === null) {
    return null;
  }
  const status = toBookingStatus(job.status);
  if (status === null) return null;

  const travelTiming = toTravelTiming(job.timing.riskState);
  const arrivalTiming: ArrivalTiming | null =
    travelTiming === null ? null : travelTiming === 'late' ? 'late' : 'on_time';

  const interruption =
    status === 'cancelled'
      ? ('cancelled' as const)
      : !job.reassignment.current
        ? ('reassigned' as const)
        : null;

  const remaining = job.timer.remainingSeconds;

  return {
    status,
    job: toJobSummary(job),
    clock: { serverNowIso: job.serverTime, receivedAtMs },
    travelTiming,
    minutesToDeadline: minutesBetween(job.serverTime, job.timing.customerCommitmentAt),
    arrivalTiming,
    startOtpReady: job.otpEligibility.start,
    endOtpReady: job.otpEligibility.end,
    actualStartIso: job.timer.serviceStartedAt,
    expectedEndIso: job.timer.expectedEnd,
    // Sign preserved — a service running past its expected end reports a negative remainder.
    minutesRemaining: remaining === null ? null : Math.round(remaining / 60),
    isEndingSoon: job.timer.tenMinuteState === 'warning',
    extension: toExtension(job),
    canStartTravel: job.reassignment.current && (status === 'assigned' || status === 'created'),
    interruption,
  };
}

/* ----------------------------------------------------------- attendance --- */

/**
 * One calendar cell.
 *
 * `scheduled` is a SHIFT fact and is only used when there is no attendance record, so a scheduled
 * day the cook actually attended renders as `present` rather than `scheduled`. This is what keeps
 * `scheduled` out of the attendance-status vocabulary.
 */
export function toDayMark(day: MonthlyAttendanceResponse['days'][number]): DayMark {
  if (day.status !== null) return { kind: 'attendance', status: day.status };
  if (day.approvedLeave) return { kind: 'attendance', status: 'leave' };
  if (day.scheduled) return { kind: 'scheduled' };
  return { kind: 'none' };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function monthLabel(month: string): string {
  const [yearText, monthText] = month.split('-');
  const index = Number(monthText) - 1;
  const name = MONTH_NAMES[index] ?? monthText ?? '';
  return `${name} ${yearText ?? ''}`.trim();
}

export function toAttendanceMonth(
  response: MonthlyAttendanceResponse,
  leaves: CookLeavesResponse | null,
  todayIso: string,
): AttendanceMonth {
  const days: readonly AttendanceDay[] = response.days.map((day) => ({
    dateIso: day.date,
    mark: toDayMark(day),
  }));

  const upcomingLeaves: readonly LeaveEntry[] =
    leaves === null
      ? []
      : leaves.leaves
          .filter((leave) => leave.serviceDate >= todayIso)
          .map((leave) => ({
            id: leave.id,
            dateIso: leave.serviceDate,
            label: leave.reason.length > 0 ? leave.reason : 'Chutti',
            status: leave.status === 'approved' ? ('approved' as const) : ('pending' as const),
          }));

  return {
    monthLabel: monthLabel(response.month),
    cycleLabel: `${monthLabel(response.month)} Attendance Cycle`,
    isCurrentMonth: response.month === todayIso.slice(0, 7),
    days,
    presentCount: response.presentTotal,
    leaveCount: response.leaveTotal,
    // Server-computed. `null` renders `--`, never `0%`.
    onTimePercent: response.onTimePercentage,
    upcomingLeaves,
  };
}

/* ------------------------------------------------------------- earnings --- */

/**
 * Bonus progress.
 *
 * The threshold is whatever the backend's policy says. `available: false` means the cook has no
 * current cycle, which is a real state — not a zero.
 */
export function toBonusProgress(response: CookEarningsResponse): BonusProgress | null {
  const bonus = response.bonus;
  if (!bonus.available || bonus.thresholdDays === null || bonus.currentProgressDays === null) {
    return null;
  }
  const completed = bonus.currentProgressDays;
  const threshold = bonus.thresholdDays;
  return {
    thresholdHours: threshold,
    completedHours: completed,
    remainingHours: Math.max(0, threshold - completed),
    progressRatio: threshold === 0 ? 0 : Math.min(1, completed / threshold),
    message: null,
  };
}

export function toCycleRef(cycle: CookCycleSummaryResponse): EarningsCycleRef {
  return {
    cycleId: cycle.cycleId,
    label: `${cycle.startDate} – ${cycle.endDate}`,
    startDateIso: cycle.startDate,
    endDateIso: cycle.endDate,
    finalPaise: cycle.finalAmountPaise,
    isCurrent: cycle.current,
  };
}
