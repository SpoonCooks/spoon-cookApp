import { projectServiceState, type ServiceSnapshot } from '@core/domain/serviceState';

/**
 * The service projection is the piece that decides which screen a cook sees mid-job, so these
 * tests pin the mapping AND the rules that must never regress: no local advancement, no inferred
 * lateness, and interruption outranking everything.
 */

const base: ServiceSnapshot = {
  status: 'assigned',
  job: {
    bookingId: 'b1',
    assignmentVersion: 1,
    societyOrBuilding: 'Building/ Society',
    serviceDurationMinutes: 90,
    scheduledStartIso: '2026-08-21T11:50:00+05:30',
    reachByIso: '2026-08-21T11:50:00+05:30',
    address: {
      buildingName: null,
      towerOrBlock: null,
      floor: null,
      flatOrHouse: null,
      customerName: 'Anjali Sharma',
    },
    gate: null,
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

describe('projectServiceState', () => {
  it('returns idle when there is no job', () => {
    expect(projectServiceState({ ...base, job: null })).toEqual({ kind: 'idle' });
  });

  it('maps assigned to the actionable job state', () => {
    const state = projectServiceState(base);
    expect(state.kind).toBe('assigned');
  });

  describe('travel — the three Figma states inside one backend status', () => {
    it.each([
      ['on_time' as const, 16],
      ['at_risk' as const, 4],
      ['late' as const, -2],
    ])('maps cook_en_route + %s', (timing, minutes) => {
      const state = projectServiceState({
        ...base,
        status: 'cook_en_route',
        travelTiming: timing,
        minutesToDeadline: minutes,
      });
      expect(state).toMatchObject({ kind: 'travelling', timing, minutesToDeadline: minutes });
    });

    it('preserves a negative countdown rather than clamping it', () => {
      const state = projectServiceState({
        ...base,
        status: 'cook_en_route',
        travelTiming: 'late',
        minutesToDeadline: -12,
      });
      // Clamping would erase the distinction between "may be late" and "is late".
      expect(state).toMatchObject({ minutesToDeadline: -12 });
    });

    it('degrades a missing server ruling to on_time, never to late', () => {
      const state = projectServiceState({ ...base, status: 'cook_en_route', travelTiming: null });
      expect(state).toMatchObject({ kind: 'travelling', timing: 'on_time' });
    });
  });

  describe('arrival and Start OTP', () => {
    it('stays on arrival until the server says the Start OTP is ready', () => {
      const state = projectServiceState({
        ...base,
        status: 'cook_arrived',
        arrivalTiming: 'on_time',
        startOtpReady: false,
      });
      expect(state.kind).toBe('arrived');
    });

    it('advances to the OTP screen only on the server flag', () => {
      const state = projectServiceState({
        ...base,
        status: 'cook_arrived',
        arrivalTiming: 'late',
        startOtpReady: true,
      });
      expect(state).toMatchObject({ kind: 'awaiting_start_otp', timing: 'late' });
    });
  });

  describe('cooking', () => {
    const cooking: ServiceSnapshot = {
      ...base,
      status: 'cooking',
      actualStartIso: '2026-08-21T12:00:00+05:30',
      expectedEndIso: '2026-08-21T13:30:00+05:30',
      minutesRemaining: 37,
    };

    it('renders the timer from server timestamps', () => {
      expect(projectServiceState(cooking)).toMatchObject({
        kind: 'cooking',
        minutesRemaining: 37,
        isEndingSoon: false,
      });
    });

    it('uses the extended end time once the backend confirms an extension', () => {
      const state = projectServiceState({
        ...cooking,
        extension: {
          isExtended: true,
          extendedByMinutes: 30,
          newExpectedEndIso: '2026-08-21T14:00:00+05:30',
        },
      });
      expect(state).toMatchObject({ expectedEndIso: '2026-08-21T14:00:00+05:30' });
    });

    it('refuses to render a timer without server timestamps', () => {
      // A cooking status with no start time would otherwise produce a timer counting from nothing.
      const state = projectServiceState({ ...cooking, actualStartIso: null });
      expect(state.kind).not.toBe('cooking');
    });

    it('moves to End OTP on the server flag', () => {
      expect(projectServiceState({ ...cooking, endOtpReady: true }).kind).toBe('awaiting_end_otp');
    });
  });

  it('maps completed', () => {
    expect(projectServiceState({ ...base, status: 'completed' }).kind).toBe('completed');
  });

  describe('interruption outranks every other state', () => {
    it('interrupts even while cooking', () => {
      const state = projectServiceState({
        ...base,
        status: 'cooking',
        actualStartIso: '2026-08-21T12:00:00+05:30',
        expectedEndIso: '2026-08-21T13:30:00+05:30',
        interruption: 'cancelled_while_travelling',
      });
      expect(state).toMatchObject({ kind: 'interrupted', reason: 'cancelled_while_travelling' });
    });

    it('maps a cancelled booking to interrupted', () => {
      expect(projectServiceState({ ...base, status: 'cancelled' })).toMatchObject({
        kind: 'interrupted',
        reason: 'cancelled',
      });
    });
  });
});
