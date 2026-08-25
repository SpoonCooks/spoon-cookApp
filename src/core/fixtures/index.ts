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
import type { JobCardModel, JobsProjection, JobUrgency } from '../domain/job';
import type {
  BonusProgress,
  EarningsBreakdown,
  EarningsPeriodView,
  RatingView,
} from '../domain/money';
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

const gate = {
  latitude: 28.4595,
  longitude: 77.0266,
  label: 'Society gate',
  accessInstructions: 'Main gate se andar aaye, guard ko booking ID bataye.',
};

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

/**
 * The V14 `job flow` list, reproducing `583:375`'s six tiles exactly.
 *
 * Start times and durations are the Figma's own mock values (`8:30 AM`, `1.5 hrs`, `5:30 PM`,
 * `30 mins`, `45 mins`), so a gallery render and the reference frame compare like for like.
 */
const v14Tile = (
  bookingId: string,
  startIso: string,
  serviceDurationMinutes: number,
): JobCardModel => ({
  ...currentJob,
  bookingId,
  scheduledStartIso: startIso,
  serviceDurationMinutes,
  minutesToDeadline: null,
  travelMinutes: null,
  action: 'none',
  isActionable: false,
});

const v14List: readonly JobCardModel[] = [
  v14Tile('v14-1', '2026-11-07T08:30:00+05:30', 90),
  v14Tile('v14-2', '2026-11-07T08:30:00+05:30', 90),
  v14Tile('v14-3', '2026-11-07T08:30:00+05:30', 90),
  v14Tile('v14-4', '2026-11-07T17:30:00+05:30', 30),
  v14Tile('v14-5', '2026-11-07T15:30:00+05:30', 45),
  v14Tile('v14-6', '2026-11-07T17:30:00+05:30', 30),
];

/**
 * The lead card, at a chosen countdown.
 *
 * `isActionable` is true because in every one of `583:427`, `583:453` and `583:479` the server
 * has already ruled the CTA live — the three frames differ in urgency, not in eligibility.
 */
const v14LeadJob = (minutesToDeadline: number): JobCardModel => ({
  ...currentJob,
  bookingId: 'v14-lead',
  scheduledStartIso: '2026-11-07T08:25:00+05:30',
  serviceDurationMinutes: 90,
  minutesToDeadline,
  isActionable: true,
  action: 'start_travel',
});

export const jobsV14Fixtures = {
  /** `583:375` — shift not started, so no break window and no actionable card. */
  loggedOut: () => devOnly({ breakWindow: null, leadJob: null, jobs: v14List }),

  /** `583:401` — shift started; the server has published today's break. */
  loggedIn: () =>
    devOnly({
      breakWindow: { fromLabel: '12:15 PM', toLabel: '2:15 PM' },
      leadJob: null,
      jobs: v14List,
    }),

  /**
   * `583:427` / `583:453` / `583:479` — the same screen at three countdowns.
   *
   * The countdown and the tier are set independently because the design's own frames disagree
   * about how they relate: `583:453` is named `<10 mins` and draws `20 mins`. Each fixture
   * therefore reproduces one frame exactly — its number AND its colourway — rather than deriving
   * one from the other. `25`, `20` and `15` are the Figma's own values.
   */
  countdown: (minutes: number, leadUrgency: JobUrgency) =>
    devOnly({
      breakWindow: { fromLabel: '12:15 PM', toLabel: '2:15 PM' },
      leadJob: v14LeadJob(minutes),
      leadUrgency,
      jobs: v14List.slice(0, 5),
    }),
} as const;

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
  extension: {
    isExtended: false,
    extendedByMinutes: null,
    newExpectedEndIso: null,
    confirmedAtIso: null,
  },
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
        confirmedAtIso: null,
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
        {
          id: 'l1',
          startDateIso: '2026-08-15',
          endDateIso: '2026-08-15',
          dayCount: 1,
          reason: 'Planned Leave',
          status: 'approved',
        },
      ],
    }),
};

/* --------------------------------------------------------------- performance --- */

/**
 * The seven `performance` frames, stated exactly as V13 draws them.
 *
 * Every figure below is a **Figma mock value**, not real earnings, and exists so the visual
 * comparison is like-for-like: `575:1744` prints `₹150`, `-₹250` and `4.7`, so the fixture does
 * too. In production every one of these comes from `GET /cook/earnings`, whose `breakdown` is the
 * backend's reversal-safe signed ledger — nothing here is ever summed, defaulted or substituted
 * into a real screen.
 *
 * The fields the deployed contract does NOT expose stay `null` in the fixture as well as in
 * production (`workedMinutes`, `aboveBasePaise`, `perDayBasePaise`, both deduction counts). A
 * fixture that invented them would make `/dev` prove a screen the app cannot actually draw, which
 * is the opposite of what the gallery is for — so those cells render `—` here exactly as they do
 * against the live backend, and the difference is recorded rather than papered over.
 */
const breakdown = (over: Partial<EarningsBreakdown>): EarningsBreakdown => ({
  basePaise: 850000,
  ratingBonusPaise: 5000,
  longHoursPaise: 26300,
  attendanceBonusPaise: 15000,
  paidLeavePaise: 0,
  tipsPaise: 60000,
  lateDeductionsPaise: 5000,
  noShowDeductionsPaise: 25000,
  otherDeductionsPaise: 0,
  adjustmentsPaise: 0,
  reversalsPaise: 0,
  grossPaise: 973900,
  totalDeductionsPaise: 25000,
  netPaise: 1038900,
  ...over,
});

/** `536:216` — `4.7`, `Last 50 kaam`. */
const rating: RatingView = { average: 4.7, count: 50 };

/**
 * `434:2895` — three of seven segments filled.
 *
 * `thresholdDays` is 7 because the frame prints `7`; in production it is the earnings policy's
 * own value. The unit is DAYS, which is what the contract counts — see `BonusBar` in
 * `Performance.tsx` for why the rendered word differs from the design's `ghante`.
 */
const bonus: BonusProgress = {
  thresholdDays: 7,
  targetDays: 7,
  completedDays: 3,
  remainingDays: 4,
  progressRatio: 3 / 7,
  thresholdAchieved: false,
  bonusAmountPaise: 15000,
  targetBonusAmountPaise: 26300,
};

const period = (
  over: Partial<EarningsPeriodView> & Pick<EarningsPeriodView, 'period'>,
): EarningsPeriodView => ({
  startDateIso: '2026-07-18',
  endDateIso: '2026-07-24',
  eventCount: 7,
  breakdown: breakdown({}),
  // `502:23` / `502:34` print `1` and `2`. The backend selects `event_count` per event type and
  // then discards it, so production leaves both `null` and the tiles show `—`; the fixture states
  // the design's own counts, because a `/dev` frame has to draw the state V13 draws.
  noShow: { count: 1, amountPaise: 25000 },
  late: { count: 2, amountPaise: 5000 },
  // The design's own figures. Production leaves every one of these `null` — see the note on
  // `EarningsPeriodView` — but a `/dev` frame has to draw the state V13 draws, or the pixel
  // comparison is measuring the gap rather than the screen.
  workedMinutes: 525,
  aboveBasePaise: 6300,
  perDayBasePaise: 107500,
  extraKaamMultiplier: 1.75,
  extraKaamRatePaise: 15000,
  fiveStarDays: 1,
  longHoursDays: 8,
  ...over,
});

export const performanceFixtures = {
  /** `575:1744` `12- money daily` and `575:1922` `15- past daily`. */
  daily: (): EarningsPeriodView =>
    devOnly(
      period({
        period: 'day',
        startDateIso: '2026-07-26',
        endDateIso: '2026-07-26',
        eventCount: 1,
        breakdown: breakdown({ grossPaise: 106300, netPaise: 81300 }),
      }),
    ),

  /** `575:1884` `13- money weekly` and `575:2098` `18- past weekly`. */
  cycle: (): EarningsPeriodView =>
    devOnly(
      period({
        period: 'cycle',
        // `492:5421` prints `+₹100` for the long-hours bonus over a cycle. The daily frame's
        // `+₹263` is the extra-kaam RESULT, a different figure on a different frame.
        breakdown: breakdown({ longHoursPaise: 10000 }),
      }),
    ),

  /** `575:2013` `16- money monthly`. */
  month: (): EarningsPeriodView =>
    devOnly(
      period({
        period: 'month',
        startDateIso: '2026-07-01',
        endDateIso: '2026-07-28',
        eventCount: 28,
        // `536:201` prints `₹4,600` for the month's bonus where `537:241` prints `₹150` for the
        // cycle's. Different windows of the same signed ledger, and the frames state both.
        breakdown: breakdown({
          attendanceBonusPaise: 460000,
          grossPaise: 973900,
          netPaise: 3438900,
        }),
      }),
    ),

  rating: (): RatingView => devOnly(rating),
  bonus: (): BonusProgress => devOnly(bonus),

  /** `505:1240` — the cycle's `Mon…Sun` strip as `575:1884` draws it. */
  days: (): readonly { label: string; state: 'present' | 'missed' | 'none' }[] =>
    devOnly([
      { label: 'Mon', state: 'present' },
      { label: 'Tues', state: 'missed' },
      { label: 'Wed', state: 'present' },
      { label: 'Thurs', state: 'present' },
      { label: 'Fri', state: 'present' },
      { label: 'Sat', state: 'none' },
      { label: 'Sun', state: 'none' },
    ]),

  /** `537:490` — the seven rows of `575:1903` `14- day history`. */
  dayHistory: (): readonly { dateIso: string; label: string }[] =>
    devOnly([
      { dateIso: '2026-07-24', label: '24 Jul' },
      { dateIso: '2026-07-23', label: '24 Jul' },
      { dateIso: '2026-07-22', label: '24 Jul' },
      { dateIso: '2026-07-21', label: '24 Jul' },
      { dateIso: '2026-07-20', label: '24 Jul' },
      { dateIso: '2026-07-19', label: '24 Jul' },
      { dateIso: '2026-07-18', label: '18 Jul' },
    ]),

  /** `502:535` — the four rows of `575:2032` `17- weekly history`. */
  cycleHistory: (): readonly { cycleId: string; label: string; earnings: string }[] =>
    devOnly([
      { cycleId: 'c1', label: '18 Jul - 21 Jul', earnings: '₹7,839' },
      { cycleId: 'c2', label: '18 Jul - 21 Jul', earnings: '₹7,839' },
      { cycleId: 'c3', label: '18 Jul - 21 Jul', earnings: '₹7,839' },
      { cycleId: 'c4', label: '18 Jul - 21 Jul', earnings: '₹7,839' },
    ]),

  /** `502:307` — `SPOON SE AAJ TAK KI KAMAI`, `₹2,93,894`. */
  lifetimePaise: (): number => devOnly(29389400),
};
