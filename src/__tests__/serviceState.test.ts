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
  extension: {
    isExtended: false,
    extendedByMinutes: null,
    newExpectedEndIso: null,
    confirmedAtIso: null,
  },
  canStartTravel: true,
  interruption: null,
};

describe('a status this build has never heard of', () => {
  /*
   * The Cook APK is sideloaded onto cooks' phones, so it is ALWAYS possible for the backend to
   * be ahead of the app. This used to `throw` — inside a `useMemo`, in an app with no error
   * boundary — so a single unrecognised status unmounted the tree and left a cook mid-job staring
   * at a blank screen with no way out but force-stopping the app.
   *
   * The compile-time exhaustiveness check is deliberately kept (a new status in the shared union
   * still fails the build). What changed is that the runtime degrades instead of crashing, which
   * is what the Customer app has always done via `UNKNOWN_BOOKING_VIEW`.
   */
  it('returns null rather than throwing, so the screen can degrade', () => {
    const unknown = { ...base, status: 'awaiting_cutlery' } as unknown as Parameters<
      typeof projectServiceState
    >[0];

    expect(() => projectServiceState(unknown)).not.toThrow();
    expect(projectServiceState(unknown)).toBeNull();
  });

  it('still resolves every status this build DOES know', () => {
    // Null must mean "unrecognised" and nothing else, or the degraded screen would start hiding
    // real states.
    for (const status of [
      'created',
      'assigned',
      'cook_en_route',
      'cook_arrived',
      'cooking',
      'completed',
      'cancelled',
    ]) {
      const state = projectServiceState({ ...base, status } as typeof base);
      expect({ status, isNull: state === null }).toEqual({ status, isNull: false });
    }
  });
});

describe('projectServiceState', () => {
  it('returns idle when there is no job', () => {
    expect(projectServiceState({ ...base, job: null }))!.toEqual({ kind: 'idle' });
  });

  it('maps assigned to the actionable job state', () => {
    const state = projectServiceState(base)!;
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
      })!;
      expect(state).toMatchObject({ kind: 'travelling', timing, minutesToDeadline: minutes });
    });

    it('preserves a negative countdown rather than clamping it', () => {
      const state = projectServiceState({
        ...base,
        status: 'cook_en_route',
        travelTiming: 'late',
        minutesToDeadline: -12,
      })!;
      // Clamping would erase the distinction between "may be late" and "is late".
      expect(state).toMatchObject({ minutesToDeadline: -12 });
    });

    it('degrades a missing server ruling to on_time, never to late', () => {
      const state = projectServiceState({ ...base, status: 'cook_en_route', travelTiming: null })!;
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
      })!;
      expect(state.kind).toBe('arrived');
    });

    it('advances to the OTP screen only on the server flag', () => {
      const state = projectServiceState({
        ...base,
        status: 'cook_arrived',
        arrivalTiming: 'late',
        startOtpReady: true,
      })!;
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
      expect(projectServiceState(cooking))!.toMatchObject({
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
          confirmedAtIso: null,
        },
      })!;
      expect(state).toMatchObject({ expectedEndIso: '2026-08-21T14:00:00+05:30' });
    });

    it('refuses to render a timer without server timestamps', () => {
      // A cooking status with no start time would otherwise produce a timer counting from nothing.
      const state = projectServiceState({ ...cooking, actualStartIso: null })!;
      expect(state.kind).not.toBe('cooking');
    });

    it('shows the TIMER, not the keypad, while service time remains', () => {
      /*
       * The regression this pins.
       *
       * This case used to read "moves to End OTP on the server flag" and passed, because the
       * projection's first line was `if (snapshot.endOtpReady) return awaiting_end_otp`. But the
       * flag is `otpEligibility.end` — `booking_status = 'cooking' AND end_otp_used_at IS NULL` —
       * so it is true for every second of every service. The cooking branch below it was dead
       * code, and a cook went from the Start OTP keypad to the End OTP keypad with no service
       * screen in between: no timer, no last-seven-minutes state, no extension banner.
       *
       * The flag says the keypad WOULD be accepted, not that it should be on screen.
       */
      const state = projectServiceState({ ...cooking, endOtpReady: true })!;
      expect(state.kind).toBe('cooking');
      if (state.kind !== 'cooking') throw new Error('expected cooking');
      expect(state.minutesRemaining).toBe(37);
    });

    it('moves to End OTP when the service time is spent', () => {
      const state = projectServiceState({ ...cooking, endOtpReady: true, minutesRemaining: 0 })!;
      expect(state.kind).toBe('awaiting_end_otp');
    });

    /*
     * The keypad opens five minutes early (founder, 2026-08-31).
     *
     * Waiting for zero meant the cook was still hunting for the screen at the moment the service
     * was supposed to be over, so every job ran a little long for a reason that was purely
     * interface. The boundary is asserted from both sides so the window cannot quietly widen.
     */
    it('opens the keypad five minutes before the end, not at zero', () => {
      const state = projectServiceState({ ...cooking, endOtpReady: true, minutesRemaining: 5 })!;
      expect(state.kind).toBe('awaiting_end_otp');
    });

    it('still shows the timer six minutes out', () => {
      const state = projectServiceState({ ...cooking, endOtpReady: true, minutesRemaining: 6 })!;
      expect(state.kind).toBe('cooking');
    });

    it('does NOT bring the keypad back once the End OTP has been used', () => {
      // `endOtpReady` goes false the moment the code is accepted. Without it in the test the
      // clock alone would re-open the keypad on a service that is already over.
      const state = projectServiceState({ ...cooking, endOtpReady: false, minutesRemaining: 0 })!;
      expect(state.kind).toBe('cooking');
    });

    it('falls back to the server clock when minutesRemaining is absent', () => {
      // A payload without the figure must still project a timer rather than collapsing to zero
      // and throwing the cook onto the keypad mid-service.
      const state = projectServiceState({ ...cooking, endOtpReady: true, minutesRemaining: null })!;
      expect(state.kind).toBe('cooking');
    });
  });

  it('maps completed', () => {
    expect(projectServiceState({ ...base, status: 'completed' })!.kind).toBe('completed');
  });

  describe('interruption outranks every other state', () => {
    it('interrupts even while cooking', () => {
      const state = projectServiceState({
        ...base,
        status: 'cooking',
        actualStartIso: '2026-08-21T12:00:00+05:30',
        expectedEndIso: '2026-08-21T13:30:00+05:30',
        interruption: 'cancelled_while_travelling',
      })!;
      expect(state).toMatchObject({ kind: 'interrupted', reason: 'cancelled_while_travelling' });
    });

    it('maps a cancelled booking to interrupted', () => {
      expect(projectServiceState({ ...base, status: 'cancelled' }))!.toMatchObject({
        kind: 'interrupted',
        reason: 'cancelled',
      });
    });
  });
});
