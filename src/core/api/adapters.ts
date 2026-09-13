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
import type {
  BonusProgress,
  DailyHoursView,
  EarningsBreakdown,
  EarningsCycleRef,
  EarningsPeriod,
  EarningsPeriodView,
} from '../domain/money';
import { formatDateRange } from '../domain/money';
import { toLeaveRequestStatus } from '../domain/leave';
import { jobUrgencyFrom } from '../domain/job';
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
  CookCycleDetailResponse,
  CookCycleSummaryResponse,
  CookWeekSummaryResponse,
  CookWeekDetailResponse,
  CookEarningsBreakdownResponse,
  CookEarningsPeriodResponse,
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
    /*
     * The person at the door -- the address's receiver when the customer named one, else the
     * account holder. This was hardcoded `null`, so the card's name row rendered blank on every
     * job and a cook arrived without knowing who to ask for. The name existed all along; the
     * projection simply never carried it.
     */
    customerName: job.destination.customerName ?? null,
  };
}

/**
 * Tracking, navigation and arrival target. Always the OPERATIONAL GATE — never the flat.
 *
 * The backend derives `destination.latitude/longitude` from
 * `booking_operational_snapshots.gate_point`, which is also what its 75 m arrival check measures
 * against. Mapping any other coordinate here would send the cook somewhere their own GPS could
 * never satisfy the arrival rule from.
 */
function toGate(job: CookJobResponse): GateTarget {
  return {
    latitude: job.destination.latitude,
    longitude: job.destination.longitude,
    label: job.destination.label,
    accessInstructions: job.destination.accessInstructions,
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
  /*
   * The SERVER decides whether she may set off.
   *
   * `startCommute` refuses a cook who has not marked present for this booking's service date, so
   * deciding it here would offer a CTA the endpoint rejects. An older deployment sends no ruling,
   * and the status-only rule it used before is the fallback.
   */
  const statusStartable = status === 'assigned' || status === 'created';
  const actionable =
    job.reassignment.current && (job.commandEligibility?.startTravel ?? statusStartable);
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
    blockedReason: actionable
      ? null
      : ((job.commandEligibility?.startTravelBlockedReason ??
          null) as JobCardModel['blockedReason']),
    isRunningLate: job.timing.riskState === 'TRAVEL_LATE',
    // A cancelled job cannot also be running late — there is nothing left to be late for — and the
    // card draws one marker, so the two are read in that order where it is rendered.
    isCancelled: status === 'cancelled',
    // Terminal the other way. Both are history; neither is work she still has to do.
    isFinished: status === 'completed',
    // `4c` / `4d` / `4e`: the server's ruling, never the handset's clock.
    urgency: jobUrgencyFrom(job.departure?.urgency),
    address: toAddress(job),
    gate: toGate(job),
  };
}

/* -------------------------------------------------------- service state --- */

function toExtension(job: CookJobResponse): ExtensionProjection {
  const isExtended = job.extension.state === 'confirmed' || job.extension.state === 'active';
  const extensions = (job.extensions ?? [])
    .filter((item) => item.state === 'confirmed' || item.state === 'active')
    .map((item) => ({
      state: item.state,
      minutes: item.minutes,
      newExpectedEndIso: item.expectedEnd,
      confirmedAtIso: item.confirmedAt,
    }));

  // Older Render deployments expose only the singular extension object. Preserve the single-row
  // design there without fabricating a second row or a confirmation timestamp.
  if (extensions.length === 0 && isExtended && job.extension.minutes !== null) {
    extensions.push({
      state: job.extension.state ?? 'confirmed',
      minutes: job.extension.minutes,
      newExpectedEndIso: job.extension.expectedEnd,
      confirmedAtIso: job.extension.confirmedAt ?? null,
    });
  }

  return {
    isExtended,
    extendedByMinutes: job.extension.minutes,
    newExpectedEndIso: job.extension.expectedEnd,
    // Absent on today's API. Left null rather than substituted, so the banner stays dark until
    // the backend can say when the extension was actually confirmed.
    confirmedAtIso: job.extension.confirmedAt ?? null,
    extensions,
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
    // `ETA_running`: the arrival instant the server projected, expressed as the travel time left.
    // Same two-server-timestamp subtraction as above, so the device clock is still never consulted.
    minutesToArrival:
      job.timing.eta === null ? null : minutesBetween(job.serverTime, job.timing.eta),
    arrivalTiming,
    startOtpReady: job.otpEligibility.start,
    endOtpReady: job.otpEligibility.end,
    actualStartIso: job.timer.serviceStartedAt,
    expectedEndIso: job.timer.expectedEnd,
    // Sign preserved — a service running past its expected end reports a negative remainder.
    minutesRemaining: remaining === null ? null : Math.round(remaining / 60),
    // The API keeps the historical `tenMinuteState` wire name; warning now means the Figma
    // last-seven-minutes treatment. The threshold itself remains backend-owned.
    isEndingSoon: job.timer.tenMinuteState === 'warning',
    extension: toExtension(job),
    canStartTravel:
      job.reassignment.current &&
      (job.commandEligibility?.startTravel ?? (status === 'assigned' || status === 'created')),
    canMarkArrived: job.reassignment.current && (job.commandEligibility?.markArrived ?? false),
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

  // A request is "upcoming" while its LAST day is still ahead: a chutti already running today is
  // still relevant to the cook, so filtering on `startDate` would hide it mid-leave.
  const upcomingLeaves: readonly LeaveEntry[] =
    leaves === null
      ? []
      : leaves.leaves
          .filter((leave) => leave.endDate >= todayIso)
          .map((leave) => ({
            id: leave.leaveId,
            startDateIso: leave.startDate,
            endDateIso: leave.endDate,
            dayCount: inclusiveDayCount(leave.startDate, leave.endDate),
            reason: leave.reason,
            // The roll-up is a free string in the contract. Anything this build does not
            // recognise is shown as still-undecided — never upgraded to `approved`.
            status: toLeaveRequestStatus(leave.status),
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

/** Rename the backend's fourteen categories. No arithmetic — this is a field mapping. */
export function toEarningsBreakdown(breakdown: CookEarningsBreakdownResponse): EarningsBreakdown {
  return {
    basePaise: breakdown.baseEarningsPaise,
    ratingBonusPaise: breakdown.ratingBonusPaise,
    longHoursPaise: breakdown.longHoursEarningsPaise,
    attendanceBonusPaise: breakdown.attendanceBonusPaise,
    paidLeavePaise: breakdown.paidLeaveEarningsPaise,
    tipsPaise: breakdown.tipsPaise,
    lateDeductionsPaise: breakdown.lateDeductionsPaise,
    noShowDeductionsPaise: breakdown.noShowDeductionsPaise,
    otherDeductionsPaise: breakdown.otherDeductionsPaise,
    adjustmentsPaise: breakdown.adjustmentsPaise,
    reversalsPaise: breakdown.reversalsPaise,
    grossPaise: breakdown.grossEarningsPaise,
    totalDeductionsPaise: breakdown.totalDeductionsPaise,
    netPaise: breakdown.netEarningsPaise,
    bonusPaise: breakdown.bonusEarningsPaise ?? null,
    aboveBasePaise: breakdown.aboveBaseEarningsPaise ?? null,
  };
}

/**
 * One Performance period.
 *
 * The remaining `null`s are the deployed contract's gaps, not omissions here: worked duration,
 * the "above base" figure and the per-day base rate have no field on any cook route. They are
 * deliberately not reconstructed — see the header of `domain/money.ts`.
 *
 * The four COUNTS are no longer among them. `breakdown.counts` carries them, excluding events a
 * reversal cancelled, so a penalty that was reversed is not reported as an occurrence. When the
 * field is absent — an older deployment — every count stays `null` and the tiles render `—`,
 * because `0` would assert the cook was never late rather than admit the figure is unknown.
 */
export function toEarningsPeriodView(
  period: EarningsPeriod,
  response: CookEarningsPeriodResponse,
  dailyHours?: DailyHoursView | null,
  /**
   * `536:207` — her CURRENT per-day base rate, published by the summary.
   *
   * Passed in rather than derived: `base / days` would invent a rate that matches no tariff and
   * moves every time a day is added, which is why this drew a dash for so long.
   */
  perDayBasePaise?: number | null,
): EarningsPeriodView {
  const breakdown = toEarningsBreakdown(response.breakdown);
  const counts = response.breakdown.counts;
  // The GAP-19 figures apply to TODAY only: the summary's `dailyHours` describes the current
  // service date, so it must never leak into the seven-day or monthly projection of this view.
  const hours = period === 'day' ? (dailyHours ?? null) : null;
  return {
    period,
    startDateIso: response.startDate,
    endDateIso: response.endDate,
    eventCount: response.eventCount,
    breakdown,
    noShow: {
      count: counts === undefined ? null : counts.noShowEvents,
      amountPaise: breakdown.noShowDeductionsPaise,
    },
    late: {
      count: counts === undefined ? null : counts.lateEvents,
      amountPaise: breakdown.lateDeductionsPaise,
    },
    workedMinutes: hours === null ? null : hours.workedMinutes,
    lateMinutes: null,
    aboveBasePaise: breakdown.aboveBasePaise,
    perDayBasePaise: perDayBasePaise ?? null,
    extraKaamMultiplier: hours === null ? null : hours.bonusMinutes / 60,
    extraKaamRatePaise: hours === null ? null : hours.ratePerHourPaise,
    fiveStarDays: counts === undefined ? null : counts.ratingBonusDays,
    longHoursDays: counts === undefined ? null : counts.longHoursDays,
  };
}

/** The GAP-19 daily-hours figures, or null while the deployed API predates the field. */
export function toDailyHoursView(response: CookEarningsResponse): DailyHoursView | null {
  const hours = response.dailyHours;
  if (hours === undefined || hours === null) return null;
  return {
    workedMinutes: hours.workedMinutes,
    thresholdMinutes: hours.thresholdMinutes,
    targetMinutes: hours.targetMinutes,
    ratePerHourPaise: hours.ratePerHourPaise,
    bonusMinutes: hours.bonusMinutes,
  };
}

/** Pick the period the `Aaj / Cycle / Mahina` control selects. */
export function periodResponseFor(
  response: CookEarningsResponse,
  period: EarningsPeriod,
): CookEarningsPeriodResponse {
  if (period === 'day') return response.daily;
  if (period === 'cycle') return response.sevenDay;
  return response.monthly;
}

/**
 * A past cycle, rendered with the SAME structure as a live period.
 *
 * `getCookCycle` supplies `summary` — the reversal-safe aggregate — so this needs no arithmetic
 * either. `eventCount` is the real line count for the cycle, which that endpoint does return.
 */
/**
 * One WEEK, in the same shape a period view arrives in.
 *
 * `18- past weekly` is drawn as a week, so this is what `Cycle ki kamai` renders. The week read
 * carries no event list — the screen shows aggregates, not a ledger — so `eventCount` is zero
 * rather than invented.
 */
export function toWeekDetailView(detail: CookWeekDetailResponse): EarningsPeriodView {
  const breakdown = toEarningsBreakdown(detail.breakdown);
  const counts = detail.breakdown.counts;
  return {
    period: 'cycle',
    startDateIso: detail.startDate,
    endDateIso: detail.endDate,
    eventCount: 0,
    breakdown,
    noShow: {
      count: counts === undefined ? null : counts.noShowEvents,
      amountPaise: breakdown.noShowDeductionsPaise,
    },
    late: {
      count: counts === undefined ? null : counts.lateEvents,
      amountPaise: breakdown.lateDeductionsPaise,
    },
    workedMinutes: null,
    lateMinutes: null,
    aboveBasePaise: breakdown.aboveBasePaise,
    perDayBasePaise: null,
    extraKaamMultiplier: null,
    extraKaamRatePaise: null,
    fiveStarDays: counts === undefined ? null : counts.ratingBonusDays,
    longHoursDays: counts === undefined ? null : counts.longHoursDays,
  };
}

export function toCycleDetailView(detail: CookCycleDetailResponse): EarningsPeriodView {
  const breakdown = toEarningsBreakdown(detail.summary);
  const counts = detail.summary.counts;
  return {
    period: 'cycle',
    startDateIso: detail.startDate,
    endDateIso: detail.endDate,
    eventCount: detail.events.length,
    breakdown,
    noShow: {
      count: counts === undefined ? null : counts.noShowEvents,
      amountPaise: breakdown.noShowDeductionsPaise,
    },
    late: {
      count: counts === undefined ? null : counts.lateEvents,
      amountPaise: breakdown.lateDeductionsPaise,
    },
    workedMinutes: null,
    lateMinutes: null,
    aboveBasePaise: breakdown.aboveBasePaise,
    perDayBasePaise: null,
    extraKaamMultiplier: null,
    extraKaamRatePaise: null,
    fiveStarDays: counts === undefined ? null : counts.ratingBonusDays,
    longHoursDays: counts === undefined ? null : counts.longHoursDays,
  };
}

/**
 * Bonus progress, in DAYS.
 *
 * The threshold, the target and both amounts are whatever the backend's earnings policy says.
 * `available: false` means the cook has no current cycle, which is a real state — not a zero, and
 * not a reason to invent the design's seven-hour copy.
 */
export function toBonusProgress(response: CookEarningsResponse): BonusProgress | null {
  const bonus = response.bonus;
  if (
    !bonus.available ||
    bonus.thresholdDays === null ||
    bonus.currentProgressDays === null ||
    bonus.targetDays === null
  ) {
    return null;
  }
  const completed = bonus.currentProgressDays;
  const threshold = bonus.thresholdDays;
  const target = bonus.targetDays;
  return {
    thresholdDays: threshold,
    targetDays: target,
    completedDays: completed,
    remainingDays: Math.max(0, threshold - completed),
    progressRatio: target === 0 ? 0 : Math.min(1, Math.max(0, completed / target)),
    thresholdAchieved: bonus.thresholdAchieved ?? completed >= threshold,
    bonusAmountPaise: bonus.bonusAmountPaise,
    targetBonusAmountPaise: bonus.targetBonusAmountPaise,
  };
}

/**
 * A WEEK as a history row.
 *
 * `17- weekly history` lists the periods `Cycle ki kamai` opens, and that screen is drawn as a
 * week (`11th Jul - 17th Jul`, seven discs Mon to Sun). It used to list the 28-day payout cycles
 * instead, which is why the detail screen showed a month of days in a seven-column strip.
 *
 * The week's own start date is its identity — there is no row to have an id — and a week always
 * has a total, so unlike a cycle there is no unsettled `null` to render as a dash.
 */
export function toWeekRef(week: CookWeekSummaryResponse): EarningsCycleRef {
  return {
    cycleId: week.startDate,
    label: formatDateRange(week.startDate, week.endDate),
    startDateIso: week.startDate,
    endDateIso: week.endDate,
    finalPaise: week.totalPaise,
    isCurrent: week.current,
  };
}

export function toCycleRef(cycle: CookCycleSummaryResponse): EarningsCycleRef {
  return {
    cycleId: cycle.cycleId,
    label: formatDateRange(cycle.startDate, cycle.endDate),
    startDateIso: cycle.startDate,
    endDateIso: cycle.endDate,
    finalPaise: cycle.finalAmountPaise,
    isCurrent: cycle.current,
  };
}

/**
 * Inclusive day span of a leave request.
 *
 * Display only — the backend already decided which dates the request covers. A malformed or
 * inverted range yields `0` rather than a negative count.
 */
function inclusiveDayCount(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  return Math.round((to - from) / 86_400_000) + 1;
}

/** Every service date in an inclusive range. Dates are not money — no financial ruling here. */
export function serviceDatesBetween(fromIso: string, toIso: string): readonly string[] {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return [];
  const days: string[] = [];
  // Bounded so a malformed range cannot render an unbounded list.
  for (let at = from; at <= to && days.length < 62; at += 86_400_000) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}
