import { cookProfileSchema } from '@core/api/schemas';

/**
 * `GET /v1/cook/me` contract — pinned against a payload the DEPLOYED backend actually sent.
 *
 * The payload below is verbatim from `spoon-api-kalc.onrender.com` on 2026-08-27, fetched with a
 * seeded test cook's session. It exists because of a real lockout: the `reason` enum was tightened
 * to the split codes (`MARKED_PRESENT_BY_ADMIN` / `COOK_CHECKED_IN`) before the backend that sends
 * them was deployed, the live server kept answering `ALREADY_CHECKED_IN`, and every login died in
 * schema validation with "App update chahiye". A schema must accept what the running server sends,
 * not only what the next one will.
 */

const LIVE_PAYLOAD_2026_08_27 = {
  cook: {
    id: 'd680481b-4ffe-55b1-9edf-74b746a43bba',
    name: 'Cook Jyoti',
    photoUrl: null,
    status: 'active',
    hub: {
      id: '4a55c1f7-c972-5c6c-86d0-8af0b0e0a001',
      name: 'MM00001 - HSR Sec 2',
      city: 'Bengaluru',
    },
    rating: { average: 5, count: 10 },
  },
  today: {
    workingDays: [1, 2, 3, 4, 5, 6, 7],
    shift: {
      id: '7583e885-f5f9-588c-964b-347e3acdd7f4',
      startLocalTime: '10:00:00',
      endLocalTime: '22:00:00',
      breakStartLocalTime: '11:00:00',
      breakEndLocalTime: '13:00:00',
    },
    attendance: { status: 'present', checkInAt: null, onTime: null },
    canCheckIn: false,
    checkInOpensAt: null,
    shiftStartsAt: '2026-08-27T04:30:00.000Z',
    checkedInAt: null,
    reason: 'ALREADY_CHECKED_IN',
    availability: { state: 'available', changedAt: '2026-08-26T10:46:12.031Z' },
  },
  currentAssignment: null,
  serverTime: '2026-08-27T07:29:43.306Z',
};

describe('cookProfileSchema against the deployed backend', () => {
  it('parses the payload the live server sent on 2026-08-27', () => {
    const result = cookProfileSchema.safeParse(LIVE_PAYLOAD_2026_08_27);
    expect(result.success ? null : result.error.issues).toBeNull();
  });

  it('reads an open deletion request when the backend sends one', () => {
    const payload = {
      ...LIVE_PAYLOAD_2026_08_27,
      deletionRequest: { requestedAt: '2026-09-13T20:41:07.912Z' },
    };
    const result = cookProfileSchema.safeParse(payload);

    expect(result.success ? result.data.deletionRequest : null).toEqual({
      requestedAt: '2026-09-13T20:41:07.912Z',
    });
  });

  it('still parses a payload from a backend that has never heard of one', () => {
    /*
     * The same lockout this file was written for, one field later. `deletionRequest` ships with
     * the backend's cook-deletion work, and this schema gates Hazri, Kaam AND Paisa — making it
     * required would lock every cook out of the whole app the moment the API is a release behind
     * the binary. The payload above is exactly such a backend, verbatim.
     */
    const result = cookProfileSchema.safeParse(LIVE_PAYLOAD_2026_08_27);

    expect(result.success).toBe(true);
    expect(result.success ? (result.data.deletionRequest ?? null) : 'unparsed').toBeNull();
  });

  it('accepts both the pre-split and the split attendance reason codes', () => {
    for (const reason of ['ALREADY_CHECKED_IN', 'MARKED_PRESENT_BY_ADMIN', 'COOK_CHECKED_IN']) {
      const payload = {
        ...LIVE_PAYLOAD_2026_08_27,
        today: { ...LIVE_PAYLOAD_2026_08_27.today, reason },
      };
      expect(cookProfileSchema.safeParse(payload).success).toBe(true);
    }
  });
});
