import {
  monthLabel,
  toAttendanceMonth,
  toBonusProgress,
  toBookingStatus,
  toDayMark,
  toJobCard,
  toServiceSnapshot,
  toTravelTiming,
} from '@core/api/adapters';
import { apiErrorMessage, isSessionExpired, ApiError } from '@core/api/errors';
import { canSubmitLeaveRequest, countLeaveDays } from '@core/domain/leave';
import { projectServiceState } from '@core/domain/serviceState';

import type { CookJobResponse, MonthlyAttendanceResponse } from '@core/api/schemas';

/**
 * Integration-layer tests.
 *
 * These cover the seam where backend vocabulary becomes app state — the place where a wrong
 * mapping produces a screen that lies to a cook rather than a crash.
 */

/* --------------------------------------------------------------- fixtures --- */

function job(overrides: Partial<CookJobResponse> = {}): CookJobResponse {
  const base: CookJobResponse = {
    bookingId: 'b1',
    assignmentId: 'a1',
    assignmentVersion: 3,
    status: 'cook_en_route',
    assignmentStatus: 'active',
    serviceStart: '2026-08-21T06:00:00.000Z',
    durationMinutes: 90,
    travelStartedAt: '2026-08-21T05:00:00.000Z',
    serviceStartedAt: null,
    currentExpectedEnd: null,
    timer: {
      serviceStartedAt: null,
      expectedEnd: null,
      remainingSeconds: null,
      tenMinuteState: 'not_started',
    },
    actualEnd: null,
    arrivedAt: null,
    timing: {
      customerCommitmentAt: '2026-08-21T05:30:00.000Z',
      eta: null,
      etaUpdatedAt: null,
      verdict: null,
      riskState: 'TRAVEL_ON_TIME',
    },
    destination: {
      latitude: 12.9,
      longitude: 77.6,
      label: 'Prestige Gate',
      flat: '402',
      tower: 'B',
      society: 'Prestige Park',
      street: 'MG Road',
      pincode: '560001',
      city: 'Bengaluru',
      state: 'KA',
    },
    extension: { state: null, minutes: null, expectedEnd: null },
    otpEligibility: { start: false, end: false },
    reassignment: { assignmentVersion: 3, current: true },
    serverTime: '2026-08-21T05:04:00.000Z',
  };
  return { ...base, ...overrides };
}

/* ------------------------------------------------------------------ errors --- */

describe('ApiError mapping', () => {
  it('separates a dead network from an expired session', () => {
    const offline = new ApiError({ kind: 'offline', message: 'x' });
    const expired = new ApiError({
      kind: 'server',
      message: 'x',
      code: 'UNAUTHENTICATED',
      status: 401,
    });
    expect(isSessionExpired(offline)).toBe(false);
    expect(isSessionExpired(expired)).toBe(true);
    expect(apiErrorMessage(offline)).toContain('Internet');
  });

  it('never leaks a raw server message to the cook', () => {
    const error = new ApiError({
      kind: 'server',
      message: 'invalid cook attendance transition at row 42',
      code: 'INVALID_BOOKING_STATE',
      status: 409,
    });
    expect(apiErrorMessage(error)).not.toContain('row 42');
  });

  it('maps a wrong service OTP to its own line', () => {
    const error = new ApiError({
      kind: 'server',
      message: 'x',
      code: 'INVALID_SERVICE_OTP',
      status: 422,
    });
    expect(apiErrorMessage(error)).toContain('OTP');
  });
});

/* -------------------------------------------------------------- travel state --- */

describe('travel ruling', () => {
  it('maps every known risk state', () => {
    expect(toTravelTiming('TRAVEL_ON_TIME')).toBe('on_time');
    expect(toTravelTiming('TRAVEL_RISK')).toBe('at_risk');
    expect(toTravelTiming('TRAVEL_LATE')).toBe('late');
  });

  it('treats UNKNOWN as no ruling rather than as lateness', () => {
    // A missing verdict must never accuse a cook. `projectServiceState` degrades null to on_time.
    expect(toTravelTiming('UNKNOWN')).toBeNull();
  });

  it('keeps at_risk and late distinguishable', () => {
    expect(toTravelTiming('TRAVEL_RISK')).not.toBe(toTravelTiming('TRAVEL_LATE'));
  });

  it('preserves a negative countdown when the deadline has passed', () => {
    // serverTime 05:32, commitment 05:30 → -2, the Figma `Page 4b` late value. Never clamped.
    const snapshot = toServiceSnapshot(
      job({
        serverTime: '2026-08-21T05:32:00.000Z',
        timing: {
          customerCommitmentAt: '2026-08-21T05:30:00.000Z',
          eta: null,
          etaUpdatedAt: null,
          verdict: null,
          riskState: 'TRAVEL_LATE',
        },
      }),
      Date.now(),
    );
    expect(snapshot?.minutesToDeadline).toBe(-2);

    const state = projectServiceState(snapshot!);
    expect(state.kind).toBe('travelling');
    if (state.kind === 'travelling') {
      expect(state.minutesToDeadline).toBe(-2);
      expect(state.timing).toBe('late');
    }
  });

  it('keeps a positive countdown for the at-risk frame', () => {
    const snapshot = toServiceSnapshot(
      job({
        serverTime: '2026-08-21T05:26:00.000Z',
        timing: {
          customerCommitmentAt: '2026-08-21T05:30:00.000Z',
          eta: null,
          etaUpdatedAt: null,
          verdict: null,
          riskState: 'TRAVEL_RISK',
        },
      }),
      Date.now(),
    );
    expect(snapshot?.minutesToDeadline).toBe(4);
    expect(snapshot?.travelTiming).toBe('at_risk');
  });
});

describe('booking status narrowing', () => {
  it('accepts the known vocabulary', () => {
    expect(toBookingStatus('cooking')).toBe('cooking');
  });

  it('refuses an unknown future status instead of guessing a screen', () => {
    expect(toBookingStatus('cook_paused')).toBeNull();
    expect(toServiceSnapshot(job({ status: 'cook_paused' }), Date.now())).toBeNull();
  });
});

describe('interruption precedence', () => {
  it('treats a lost assignment as an interruption, not a live service', () => {
    const snapshot = toServiceSnapshot(
      job({ status: 'cooking', reassignment: { assignmentVersion: 4, current: false } }),
      Date.now(),
    );
    expect(snapshot?.interruption).toBe('reassigned');
    expect(projectServiceState(snapshot!).kind).toBe('interrupted');
  });

  it('outranks an otherwise-renderable cooking state', () => {
    const snapshot = toServiceSnapshot(job({ status: 'cancelled' }), Date.now());
    expect(projectServiceState(snapshot!).kind).toBe('interrupted');
  });
});

describe('cooking timer', () => {
  it('refuses to render a timer without server timestamps', () => {
    const snapshot = toServiceSnapshot(job({ status: 'cooking' }), Date.now());
    // No serviceStartedAt/expectedEnd → must not present itself as a live cooking screen.
    expect(projectServiceState(snapshot!).kind).toBe('assigned');
  });

  it('converts remaining seconds without clamping a negative remainder', () => {
    const snapshot = toServiceSnapshot(
      job({
        status: 'cooking',
        timer: {
          serviceStartedAt: '2026-08-21T06:00:00.000Z',
          expectedEnd: '2026-08-21T07:30:00.000Z',
          remainingSeconds: -300,
          tenMinuteState: 'elapsed',
        },
      }),
      Date.now(),
    );
    expect(snapshot?.minutesRemaining).toBe(-5);
  });
});

describe('job card', () => {
  it('marks an assigned current job actionable and names the action start_travel', () => {
    const card = toJobCard(job({ status: 'assigned' }));
    expect(card.isActionable).toBe(true);
    expect(card.action).toBe('start_travel');
  });

  it('is not actionable once travel has begun', () => {
    expect(toJobCard(job({ status: 'cook_en_route' })).isActionable).toBe(false);
  });

  it('raises RUNNING LATE only on the server ruling', () => {
    expect(toJobCard(job()).isRunningLate).toBe(false);
    expect(
      toJobCard(
        job({
          timing: {
            customerCommitmentAt: '2026-08-21T05:30:00.000Z',
            eta: null,
            etaUpdatedAt: null,
            verdict: null,
            riskState: 'TRAVEL_LATE',
          },
        }),
      ).isRunningLate,
    ).toBe(true);
  });

  it('never exposes a service OTP', () => {
    expect(JSON.stringify(toJobCard(job()))).not.toMatch(/otp/i);
  });
});

/* -------------------------------------------------------------- attendance --- */

function month(
  days: MonthlyAttendanceResponse['days'],
  overrides: Partial<MonthlyAttendanceResponse> = {},
): MonthlyAttendanceResponse {
  return {
    month: '2026-08',
    days,
    presentTotal: days.filter((d) => d.status === 'present').length,
    leaveTotal: days.filter((d) => d.status === 'leave' || d.approvedLeave).length,
    scheduledDayTotal: days.filter((d) => d.scheduled).length,
    onTimePercentage: null,
    timezone: 'Asia/Kolkata',
    ...overrides,
  };
}

const day = (
  date: string,
  extra: Partial<MonthlyAttendanceResponse['days'][number]> = {},
): MonthlyAttendanceResponse['days'][number] => ({
  date,
  scheduled: false,
  status: null,
  approvedLeave: false,
  checkInAt: null,
  onTime: null,
  ...extra,
});

describe('attendance day marks', () => {
  it('keeps scheduled separate from the attendance vocabulary', () => {
    // `scheduled` is a SHIFT fact. It must never become a fourth attendance status.
    expect(toDayMark(day('2026-08-03', { scheduled: true }))).toEqual({ kind: 'scheduled' });
  });

  it('prefers a real attendance record over the schedule', () => {
    expect(toDayMark(day('2026-08-03', { scheduled: true, status: 'present' }))).toEqual({
      kind: 'attendance',
      status: 'present',
    });
  });

  it('maps each backend status', () => {
    expect(toDayMark(day('2026-08-04', { status: 'absent' }))).toEqual({
      kind: 'attendance',
      status: 'absent',
    });
    expect(toDayMark(day('2026-08-05', { status: 'leave' }))).toEqual({
      kind: 'attendance',
      status: 'leave',
    });
  });

  it('renders an approved leave as leave even with no attendance row', () => {
    expect(toDayMark(day('2026-08-06', { approvedLeave: true }))).toEqual({
      kind: 'attendance',
      status: 'leave',
    });
  });

  it('leaves an unscheduled, unrecorded day blank', () => {
    expect(toDayMark(day('2026-08-07'))).toEqual({ kind: 'none' });
  });
});

describe('monthly attendance projection', () => {
  it('takes the on-time percentage from the server, never computing one', () => {
    const projection = toAttendanceMonth(
      month([day('2026-08-01', { status: 'present', onTime: true })], {
        onTimePercentage: 98.5,
      }),
      null,
      '2026-08-21',
    );
    expect(projection.onTimePercent).toBe(98.5);
  });

  it('keeps a null percentage null rather than showing 0%', () => {
    const projection = toAttendanceMonth(month([day('2026-08-01')]), null, '2026-08-21');
    expect(projection.onTimePercent).toBeNull();
  });

  it('handles an empty month without inventing days', () => {
    const projection = toAttendanceMonth(month([]), null, '2026-08-21');
    expect(projection.days).toHaveLength(0);
    expect(projection.presentCount).toBe(0);
    expect(projection.upcomingLeaves).toHaveLength(0);
  });

  it('shows only leaves from today onward', () => {
    const projection = toAttendanceMonth(
      month([]),
      {
        leaves: [
          { id: 'l1', serviceDate: '2026-08-10', status: 'approved', reason: 'Planned Leave' },
          { id: 'l2', serviceDate: '2026-08-25', status: 'approved', reason: 'Planned Leave' },
        ],
        fromDate: '2026-08-01',
        toDate: '2026-08-31',
        timezone: 'Asia/Kolkata',
      },
      '2026-08-21',
    );
    expect(projection.upcomingLeaves.map((leave) => leave.id)).toEqual(['l2']);
  });

  it('labels the month from the server value', () => {
    expect(monthLabel('2026-11')).toBe('November 2026');
  });
});

/* ------------------------------------------------------------------- leave --- */

describe('leave requests', () => {
  it('stays disabled while the backend has no cook-side write', () => {
    // GAP-21. Flipping this without the endpoint would let the app claim `Chutti lag gyi` for a
    // leave no server ever recorded.
    expect(canSubmitLeaveRequest()).toBe(false);
  });

  it('counts an inclusive range for Total din', () => {
    expect(
      countLeaveDays({ kind: 'date_range', fromDateIso: '2026-11-16', toDateIso: '2026-11-25' }),
    ).toBe(10);
    expect(countLeaveDays({ kind: 'single_day', dateIso: '2026-11-16' })).toBe(1);
  });

  it('refuses an inverted range rather than reporting a negative day count', () => {
    expect(
      countLeaveDays({ kind: 'date_range', fromDateIso: '2026-11-25', toDateIso: '2026-11-16' }),
    ).toBe(0);
  });
});

/* ---------------------------------------------------------------- earnings --- */

describe('bonus progress', () => {
  const earnings = (bonus: Parameters<typeof toBonusProgress>[0]['bonus']) =>
    ({
      totalPaise: 0,
      events: [],
      daily: { startDate: '2026-08-21', endDate: '2026-08-21', totalPaise: 0, eventCount: 0 },
      sevenDay: { startDate: '2026-08-15', endDate: '2026-08-21', totalPaise: 0, eventCount: 0 },
      currentCycle: null,
      bonus,
    }) as Parameters<typeof toBonusProgress>[0];

  it('takes the threshold from backend policy, never a hardcoded 5 or 7', () => {
    const progress = toBonusProgress(
      earnings({
        available: true,
        reason: null,
        policyVersion: 'v3',
        currentProgressDays: 20,
        thresholdDays: 27,
        targetDays: 28,
        bonusAmountPaise: 100000,
        targetBonusAmountPaise: 150000,
        thresholdAchieved: false,
        achieved: false,
      }),
    );
    expect(progress?.thresholdHours).toBe(27);
    expect(progress?.remainingHours).toBe(7);
  });

  it('reports no progress rather than zero when there is no cycle', () => {
    const progress = toBonusProgress(
      earnings({
        available: false,
        reason: 'cycle_unavailable',
        policyVersion: null,
        currentProgressDays: null,
        thresholdDays: null,
        targetDays: null,
        bonusAmountPaise: null,
        targetBonusAmountPaise: null,
        thresholdAchieved: null,
        achieved: null,
      }),
    );
    expect(progress).toBeNull();
  });
});
