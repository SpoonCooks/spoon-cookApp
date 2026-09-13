import { toServiceSnapshot } from '@core/api/adapters';
import { projectServiceState } from '@core/domain/serviceState';
import type { CookJobResponse } from '@core/api/schemas';

/**
 * "Location ki duri" is the cook's TRAVEL time, not a countdown to the booking.
 *
 * The card used to draw `customerCommitmentAt − serverTime`. That falls with the clock whether or
 * not the cook moves, and goes negative once the service time passes — so a cook who opened the
 * app at 19:02 for a 19:15 booking and never left the house watched "13 mins" tick down to "-1",
 * with her actual distance unchanged the whole time. Reproduced by the founder on 2026-09-01.
 *
 * The flow document defines `ETA_running` as "the time left to reach the user's location from the
 * time at which the cook's location is checked", and the late tiers already compare a projected
 * arrival against the service time. The number and the banner have to be measuring the same thing.
 */

/* The same payload builder `api.test.ts` uses, so this file cannot drift from the real
 * response shape. */
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
      accessInstructions: 'Gate 2 se enter kare.',
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

function jobWith(overrides: {
  serverTime: string;
  commitmentAt: string;
  eta: string | null;
  riskState: CookJobResponse['timing']['riskState'];
}): CookJobResponse {
  const base = job();
  return {
    ...base,
    serverTime: overrides.serverTime,
    timing: {
      ...base.timing,
      customerCommitmentAt: overrides.commitmentAt,
      eta: overrides.eta,
      riskState: overrides.riskState,
    },
  };
}

describe('the travel card shows the distance, not the deadline', () => {
  it('shows the ETA the server projected, not the time left on the clock', () => {
    // The founder's case: 8 minutes of travel with 5 minutes left before the booking starts.
    const snapshot = toServiceSnapshot(
      jobWith({
        serverTime: '2026-09-01T13:40:00.000Z',
        commitmentAt: '2026-09-01T13:45:00.000Z', // 5 minutes away
        eta: '2026-09-01T13:48:00.000Z', // 8 minutes of travel
        riskState: 'TRAVEL_RISK',
      }),
      0,
    );

    expect(snapshot?.minutesToArrival).toBe(8);
    // Still carried, because it is what the fallback uses and a different question entirely.
    expect(snapshot?.minutesToDeadline).toBe(5);
  });

  it('does not move when the cook does not move', () => {
    // Six minutes later, same reported position: the ETA is unchanged, the deadline is not.
    const later = toServiceSnapshot(
      jobWith({
        serverTime: '2026-09-01T13:46:00.000Z',
        commitmentAt: '2026-09-01T13:45:00.000Z',
        eta: '2026-09-01T13:54:00.000Z',
        riskState: 'TRAVEL_RISK',
      }),
      0,
    );

    expect(later?.minutesToArrival).toBe(8);
    // The old card drew THIS, which is where the founder's "-1" came from.
    expect(later?.minutesToDeadline).toBe(-1);
  });

  it('leaves the ETA null rather than calling it zero when the server has none', () => {
    const snapshot = toServiceSnapshot(
      jobWith({
        serverTime: '2026-09-01T13:40:00.000Z',
        commitmentAt: '2026-09-01T13:45:00.000Z',
        eta: null,
        riskState: 'UNKNOWN',
      }),
      0,
    );

    // No ETA is not "arriving now". The card falls back to the countdown.
    expect(snapshot?.minutesToArrival).toBeNull();
  });

  it('hands the travelling screen both numbers', () => {
    const snapshot = toServiceSnapshot(
      jobWith({
        serverTime: '2026-09-01T13:40:00.000Z',
        commitmentAt: '2026-09-01T13:45:00.000Z',
        eta: '2026-09-01T13:48:00.000Z',
        riskState: 'TRAVEL_RISK',
      }),
      0,
    );
    const state = snapshot === null ? null : projectServiceState(snapshot);

    expect(state?.kind).toBe('travelling');
    if (state?.kind !== 'travelling') return;
    expect(state.minutesToArrival).toBe(8);
    // `at_risk` is the backend's ruling once projected arrival passes the booking start, which is
    // the "LATE ho raha hai" banner. The number and the banner now agree.
    expect(state.timing).toBe('at_risk');
  });
});
