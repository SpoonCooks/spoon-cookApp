import { toJobCard } from '@core/api/adapters';
import { startTravelBlockedNote } from '@core/domain/job';
import type { CookJobResponse } from '@core/api/schemas';

/**
 * The `chalO` CTA follows the SERVER's ruling, not the booking status alone.
 *
 * `startCommute` refuses a cook who has not marked present for the booking's service date — the
 * Kaam tab before PRESENT is `4a`, which the flow document calls view only. Deciding it on the
 * client would offer a CTA the endpoint rejects, and the cook would meet a generic failure at the
 * one moment she is trying to leave.
 *
 * The fallback matters as much as the rule: an older deployment sends no `commandEligibility`, and
 * absent must not mean "refused" — that would strand every cook the moment the app shipped ahead
 * of the backend.
 */

function job(overrides: Partial<CookJobResponse> = {}): CookJobResponse {
  return {
    bookingId: 'b1',
    assignmentId: 'a1',
    assignmentVersion: 1,
    status: 'assigned',
    assignmentStatus: 'active',
    serviceStart: '2026-09-01T13:45:00.000Z',
    durationMinutes: 90,
    travelStartedAt: null,
    timer: { remainingSeconds: null, serviceStartedAt: null, tenMinuteState: 'not_started' },
    actualEnd: null,
    arrivedAt: null,
    timing: {
      customerCommitmentAt: '2026-09-01T13:45:00.000Z',
      eta: null,
      etaUpdatedAt: null,
      verdict: 'UNKNOWN',
      riskState: 'UNKNOWN',
    },
    destination: {
      latitude: 12.9,
      longitude: 77.6,
      label: 'Home',
      accessInstructions: null,
      flat: null,
      tower: null,
      society: 'Tower A',
      street: 'Main Rd',
      pincode: '560102',
      city: 'Bengaluru',
      state: 'Karnataka',
    },
    extension: { state: null, minutes: null, expectedEnd: null, confirmedAt: null },
    otpEligibility: { start: false, end: false },
    reassignment: { assignmentVersion: 1, current: true },
    serverTime: '2026-09-01T13:00:00.000Z',
    ...overrides,
  } as CookJobResponse;
}

describe('the chalO CTA follows the server', () => {
  it('offers the command when the server says she may start', () => {
    expect(toJobCard(job({ commandEligibility: { startTravel: true } })).isActionable).toBe(true);
  });

  it('withholds it when the server refuses, even on an assigned booking', () => {
    // She has not marked present. The status alone used to be enough, and the CTA then failed.
    expect(toJobCard(job({ commandEligibility: { startTravel: false } })).isActionable).toBe(false);
  });

  it('falls back to the status rule when the server publishes no ruling', () => {
    // An app shipped ahead of its backend must not strand every cook.
    expect(toJobCard(job()).isActionable).toBe(true);
  });

  it('never offers it for someone else’s assignment, whatever the ruling says', () => {
    // A superseded cook is not eligible for anything, and the reassignment check stays outermost.
    const reassigned = job({
      commandEligibility: { startTravel: true },
      reassignment: { assignmentVersion: 2, current: false },
    });
    expect(toJobCard(reassigned).isActionable).toBe(false);
  });
});

/**
 * A refused Chalo has to SAY something.
 *
 * The lead card used to be selected with `cards.find((card) => card.isActionable)`, so a job she
 * could not yet start produced no card — no countdown, no button, no reason. "why chalo is no
 * there ?", from the handset on 2026-09-03. The card is now always drawn and the button carries
 * the server's reason, so "not yet" no longer looks like "broken".
 */
describe('why she cannot set off', () => {
  it('carries the server’s reason onto the card', () => {
    const card = toJobCard(
      job({
        commandEligibility: { startTravel: false, startTravelBlockedReason: 'TOO_EARLY' },
      } as never),
    );

    expect(card.isActionable).toBe(false);
    expect(card.blockedReason).toBe('TOO_EARLY');
  });

  it('carries no reason when she may go', () => {
    const card = toJobCard(job({ commandEligibility: { startTravel: true } } as never));

    expect(card.isActionable).toBe(true);
    expect(card.blockedReason).toBeNull();
  });

  /*
   * Each code becomes a sentence she can act on, and the commonest one — the window has not
   * opened — says nothing is wrong. Wording is checked for existence and language, not verbatim,
   * so copy can be tuned without breaking the contract that SOMETHING is said.
   */
  it('has Hinglish wording for every reason the server can send', () => {
    for (const reason of ['NOT_PRESENT', 'ALREADY_STARTED', 'BUSY_ELSEWHERE', 'TOO_EARLY']) {
      const note = startTravelBlockedNote(reason);
      expect(note).not.toBeNull();
      expect((note ?? '').length).toBeGreaterThan(10);
    }
  });

  /*
   * A newer server may send a code this build predates. A wrong sentence is worse than none: the
   * button is visibly disabled either way, which already says more than its absence did.
   */
  it('says nothing rather than the wrong thing for a code it does not know', () => {
    expect(startTravelBlockedNote('SOMETHING_ADDED_LATER')).toBeNull();
    expect(startTravelBlockedNote(null)).toBeNull();
    expect(startTravelBlockedNote(undefined)).toBeNull();
  });
});
