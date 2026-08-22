/**
 * Development-only visual fixtures.
 *
 * ## Hard rules
 *
 * 1. **Never a fallback.** Nothing here is used when an API call fails. A failed request renders
 *    `ErrorState`. Showing a cook an invented job would make them act on something that does not
 *    exist.
 * 2. **Never in release.** Every accessor is guarded by `__DEV__`, which the Metro/Babel release
 *    build replaces with `false`, so this module's data is dead code in a production bundle.
 * 3. **Labelled by backend state.** Each fixture names the backend state it represents, so a
 *    screenshot can be traced to the projection it is meant to prove.
 *
 * The values reproduce the Figma frames exactly (`26 mins`, `₹1,150`, `Anjali Sharma`) so visual
 * verification is a like-for-like comparison. They are visual placeholders, NOT product data —
 * in particular the money figures are Figma mock values, not real earnings, and the bonus
 * threshold shown is the disputed 5-vs-7-hour value recorded in GAP-19.
 */

import type { AttendanceMonth, TodayAttendance } from '../domain/attendance';
import type { JobCardModel, JobsProjection } from '../domain/job';
import type { EarningsCycleRef, EarningsSummary } from '../domain/money';
import type { ServiceSnapshot } from '../domain/serviceState';

/** Throws in release rather than returning silent placeholder data. */
function devOnly<T>(value: T): T {
  if (!__DEV__) {
    throw new Error('Fixtures are development-only and must never be read in a release build.');
  }
  return value;
}

export function areFixturesAvailable(): boolean {
  return __DEV__;
}

const address = {
  buildingName: 'Building name',
  towerOrBlock: 'Tower/ block no.',
  floor: 'Floor no.',
  flatOrHouse: 'Flat/ house no.',
  customerName: 'Anjali Sharma',
};

const gate = { latitude: 28.4595, longitude: 77.0266, label: 'Society gate' };

/** Backend state: `assigned`, actionable. Figma `Page 3- job list` prominent card. */
const currentJob: JobCardModel = {
  bookingId: 'fixture-booking-1',
  assignmentVersion: 1,
  societyOrBuilding: 'Building/ Society',
  serviceDurationMinutes: 90,
  scheduledStartIso: '2026-08-21T11:50:00+05:30',
  reachByIso: '2026-08-21T11:50:00+05:30',
  minutesToDeadline: 26,
  travelMinutes: 12,
  action: 'start_travel',
  isActionable: false,
  isRunningLate: false,
  address,
  gate,
};

/** Backend state: `assigned`, within start window. Figma `Page 3a- start`. */
const startableJob: JobCardModel = { ...currentJob, minutesToDeadline: 17, isActionable: true };

/** Backend state: `assigned`, later today. Figma compact `jobs` card. */
const upcomingJob: JobCardModel = {
  ...currentJob,
  bookingId: 'fixture-booking-2',
  minutesToDeadline: null,
  travelMinutes: null,
  action: 'none',
  isActionable: false,
  scheduledStartIso: '2026-08-21T15:30:00+05:30',
};

export const jobFixtures = {
  /** Backend state: no assignment. */
  empty: (): JobsProjection =>
    devOnly({ currentJob: null, upcoming: [], serverNowIso: '2026-08-21T11:24:00+05:30' }),

  /** Backend state: one `assigned` job, not yet startable. */
  singleCurrent: (): JobsProjection =>
    devOnly({ currentJob, upcoming: [], serverNowIso: '2026-08-21T11:24:00+05:30' }),

  /** Backend state: `assigned` and start-eligible. */
  startable: (): JobsProjection =>
    devOnly({ currentJob: startableJob, upcoming: [], serverNowIso: '2026-08-21T11:33:00+05:30' }),

  /** Backend state: current + a later job the same day. */
  currentPlusUpcoming: (): JobsProjection =>
    devOnly({
      currentJob,
      upcoming: [{ dateIso: '2026-08-21', label: null, jobs: [upcomingJob] }],
      serverNowIso: '2026-08-21T11:24:00+05:30',
    }),

  /**
   * Backend state: today plus tomorrow. Founder comment #155 asks for this; no Figma screen
   * exists, so this fixture only proves the MODEL and card grouping support it.
   */
  withTomorrow: (): JobsProjection =>
    devOnly({
      currentJob,
      upcoming: [
        { dateIso: '2026-08-21', label: 'Aaj', jobs: [upcomingJob] },
        {
          dateIso: '2026-08-22',
          label: 'Kal',
          jobs: [
            {
              ...upcomingJob,
              bookingId: 'fixture-booking-3',
              scheduledStartIso: '2026-08-22T10:00:00+05:30',
            },
          ],
        },
      ],
      serverNowIso: '2026-08-21T11:24:00+05:30',
    }),

  /** Backend state: `cook_en_route` past deadline — drives the `RUNNING LATE` badge. */
  runningLate: (): JobsProjection =>
    devOnly({
      currentJob: { ...currentJob, minutesToDeadline: -2, isRunningLate: true, isActionable: true },
      upcoming: [],
      serverNowIso: '2026-08-21T11:52:00+05:30',
    }),
};

const baseSnapshot: ServiceSnapshot = {
  status: 'assigned',
  job: {
    bookingId: currentJob.bookingId,
    assignmentVersion: 1,
    societyOrBuilding: currentJob.societyOrBuilding,
    serviceDurationMinutes: 90,
    scheduledStartIso: currentJob.scheduledStartIso,
    reachByIso: currentJob.reachByIso,
    address,
    gate,
  },
  clock: { serverNowIso: '2026-08-21T11:24:00+05:30', receivedAtMs: 0 },
  travelTiming: null,
  minutesToDeadline: null,
  arrivalTiming: null,
  startOtpReady: false,
  endOtpReady: false,
  actualStartIso: null,
  expectedEndIso: null,
  minutesRemaining: null,
  isEndingSoon: false,
  extension: { isExtended: false, extendedByMinutes: null, newExpectedEndIso: null },
  canStartTravel: true,
  interruption: null,
};

export const serviceFixtures = {
  /** Backend `cook_en_route` + timing `on_time`. Figma `Page 4a` (`462:3617`). */
  travelOnTime: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cook_en_route',
      travelTiming: 'on_time',
      minutesToDeadline: 16,
    }),

  /** Backend `cook_en_route` + timing `at_risk`. Figma `Page 4b` (`463:3779`). */
  travelAtRisk: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cook_en_route',
      travelTiming: 'at_risk',
      minutesToDeadline: 4,
    }),

  /** Backend `cook_en_route` + timing `late`. Figma `Page 4b` (`464:3864`) — note NEGATIVE. */
  travelLate: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cook_en_route',
      travelTiming: 'late',
      minutesToDeadline: -2,
    }),

  /** Backend `cook_arrived` + on time. Figma `Page 5a` (`468:3935`). */
  arrivedOnTime: (): ServiceSnapshot =>
    devOnly({ ...baseSnapshot, status: 'cook_arrived', arrivalTiming: 'on_time' }),

  /** Backend `cook_arrived` + late. Figma `Page 5b` (`468:4040`). */
  arrivedLate: (): ServiceSnapshot =>
    devOnly({ ...baseSnapshot, status: 'cook_arrived', arrivalTiming: 'late' }),

  /** Backend `cook_arrived` + Start OTP issued, on time. Figma `Page 6a` (`482:4587`). */
  startOtpOnTime: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cook_arrived',
      arrivalTiming: 'on_time',
      startOtpReady: true,
    }),

  /** Backend `cook_arrived` + Start OTP issued, late. Figma `Page 6b` (`482:4656`). */
  startOtpLate: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cook_arrived',
      arrivalTiming: 'late',
      startOtpReady: true,
    }),

  /** Backend `cooking`. Figma `Page 7a` (`483:4741`). */
  cooking: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cooking',
      actualStartIso: '2026-08-21T12:00:00+05:30',
      expectedEndIso: '2026-08-21T13:30:00+05:30',
      minutesRemaining: 37,
      isEndingSoon: false,
    }),

  /** Backend `cooking` + server `isEndingSoon`. Figma `Page 7b` (`483:4795`). */
  cookingEndingSoon: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cooking',
      actualStartIso: '2026-08-21T12:00:00+05:30',
      expectedEndIso: '2026-08-21T13:30:00+05:30',
      minutesRemaining: 7,
      isEndingSoon: true,
    }),

  /**
   * Backend `cooking` + confirmed extension. Figma `Page 7c` (`483:4835`).
   * Not producible against the real backend today — the cook has no extension channel (GAP-07).
   */
  cookingExtended: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cooking',
      actualStartIso: '2026-08-21T12:00:00+05:30',
      expectedEndIso: '2026-08-21T13:30:00+05:30',
      minutesRemaining: 7,
      isEndingSoon: true,
      extension: {
        isExtended: true,
        extendedByMinutes: 30,
        newExpectedEndIso: '2026-08-21T14:00:00+05:30',
      },
    }),

  /** Three-digit minutes — founder comment #150 asks whether the timer supports `100+ mins`. */
  cookingThreeDigitTimer: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cooking',
      actualStartIso: '2026-08-21T12:00:00+05:30',
      expectedEndIso: '2026-08-21T14:00:00+05:30',
      minutesRemaining: 120,
      isEndingSoon: false,
    }),

  /** Backend `cooking` + End OTP ready. Figma `Page 9` (`484:4875`). */
  endOtp: (): ServiceSnapshot =>
    devOnly({
      ...baseSnapshot,
      status: 'cooking',
      actualStartIso: '2026-08-21T12:00:00+05:30',
      expectedEndIso: '2026-08-21T13:30:00+05:30',
      minutesRemaining: 0,
      endOtpReady: true,
    }),

  /** Backend `completed`. Figma `Page 10` (`485:4917`). */
  completed: (): ServiceSnapshot => devOnly({ ...baseSnapshot, status: 'completed' }),

  /**
   * Customer cancelled after the cook began travelling (founder comment #152).
   * NO Figma screen exists — this fixture proves the projection handles it, and the app renders a
   * neutral interruption notice rather than an invented design.
   */
  cancelledWhileTravelling: (): ServiceSnapshot =>
    devOnly({ ...baseSnapshot, status: 'cancelled', interruption: 'cancelled_while_travelling' }),
};

/** Figma `Page 3a- money daily` (`485:5062`). Values are Figma mock data, not real earnings. */
export const moneyFixtures = {
  day: (): EarningsSummary =>
    devOnly({
      period: 'day',
      workedHours: 3,
      // Threshold shown as 5 here per the daily frame's copy; the monthly frame says 7 (GAP-19).
      bonusProgress: {
        thresholdHours: 5,
        completedHours: 3,
        remainingHours: 2,
        progressRatio: 0.6,
        message: 'Bonus ke liye: 5 se zyada ghante kaam',
      },
      basePaise: 100000,
      bonusPaise: 45000,
      tipsPaise: 15000,
      grossPaise: 115000,
      noShow: { count: 1, amountPaise: 5000 },
      late: { count: 2, amountPaise: 10000 },
      totalDeductionsPaise: 15000,
      finalPaise: 15000,
    }),

  /** Figma `Page 3b- money 7 days` (`492:5336`) — same figures as the daily frame in Figma. */
  cycle: (): EarningsSummary => devOnly({ ...moneyFixtures.day(), period: 'cycle' }),

  /** Figma `Page 3c- money monthly` (`502:192`). */
  month: (): EarningsSummary =>
    devOnly({
      period: 'month',
      workedHours: 8,
      bonusProgress: {
        thresholdHours: 7,
        completedHours: 8,
        remainingHours: 0,
        progressRatio: 1,
        message: '7 hr ke upar kaam',
      },
      basePaise: 850000,
      bonusPaise: 112000,
      tipsPaise: 40000,
      grossPaise: 3573900,
      noShow: { count: 4, amountPaise: 50000 },
      late: { count: 2, amountPaise: 50000 },
      totalDeductionsPaise: 100000,
      finalPaise: 3438900,
    }),

  /** Figma `Page 4- cycle history` (`502:442`). */
  cycles: (): readonly EarningsCycleRef[] =>
    devOnly([
      {
        cycleId: 'c8',
        label: '18th Jul - 21st Jul',
        startDateIso: '2026-07-18',
        endDateIso: '2026-07-21',
        finalPaise: null,
        isCurrent: true,
      },
      {
        cycleId: 'c7',
        label: '11th Jul - 17th Jul',
        startDateIso: '2026-07-11',
        endDateIso: '2026-07-17',
        finalPaise: null,
        isCurrent: false,
      },
      {
        cycleId: 'c6',
        label: '4th Jul - 10th Jul',
        startDateIso: '2026-07-04',
        endDateIso: '2026-07-10',
        finalPaise: null,
        isCurrent: false,
      },
      {
        cycleId: 'c5',
        label: '28th Jun - 4th Jul',
        startDateIso: '2026-06-28',
        endDateIso: '2026-07-04',
        finalPaise: null,
        isCurrent: false,
      },
      {
        cycleId: 'c4',
        label: '21st Jun - 27th Jun',
        startDateIso: '2026-06-21',
        endDateIso: '2026-06-27',
        finalPaise: null,
        isCurrent: false,
      },
      {
        cycleId: 'c3',
        label: '14th Jun - 20th Jun',
        startDateIso: '2026-06-14',
        endDateIso: '2026-06-20',
        finalPaise: null,
        isCurrent: false,
      },
      {
        cycleId: 'c2',
        label: '7th Jun - 13th Jun',
        startDateIso: '2026-06-07',
        endDateIso: '2026-06-13',
        finalPaise: null,
        isCurrent: false,
      },
      {
        cycleId: 'c1',
        label: '1st Jun - 6th Jun',
        startDateIso: '2026-06-01',
        endDateIso: '2026-06-06',
        finalPaise: null,
        isCurrent: false,
      },
    ]),
};

export const attendanceFixtures = {
  /** Backend: today unmarked, cook may mark. Figma `Page 11- attendance` (`506:1986`). */
  todayUnmarked: (): TodayAttendance =>
    devOnly({ dateIso: '2026-08-21', status: null, canMarkPresent: true }),

  /** Backend confirmed `present`. */
  todayPresent: (): TodayAttendance =>
    devOnly({ dateIso: '2026-08-21', status: 'present', canMarkPresent: false }),

  /** Figma Attendance & Leaves (`505:1596`). */
  month: (): AttendanceMonth =>
    devOnly({
      monthLabel: 'August 2026',
      cycleLabel: 'Monthly Attendance Cycle',
      isCurrentMonth: true,
      days: Array.from({ length: 31 }, (_, i) => {
        const day = i + 1;
        const dateIso = `2026-08-${String(day).padStart(2, '0')}`;
        if (day === 15) return { dateIso, mark: { kind: 'attendance', status: 'leave' } as const };
        if (day > 21) return { dateIso, mark: { kind: 'scheduled' } as const };
        return { dateIso, mark: { kind: 'attendance', status: 'present' } as const };
      }),
      presentCount: 22,
      leaveCount: 2,
      onTimePercent: 98,
      upcomingLeaves: [
        { id: 'l1', dateIso: '2026-08-15', label: 'Planned Leave', status: 'approved' },
      ],
    }),
};
