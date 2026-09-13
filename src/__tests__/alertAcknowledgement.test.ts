import { acknowledgeAlert } from '@core/api/cook';

// The base URL comes from `expo-constants`, and `requireApiBaseUrl()` throws without one — the
// app deliberately refuses to invent a backend. Same stub shape `apiBaseUrl.test.ts` uses.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBaseUrl: 'https://api.test.invalid', appEnv: 'staging' } } },
}));

/**
 * The `Idempotency-Key` on alert acknowledgement.
 *
 * ## Why this file exists
 *
 * `acknowledgeAlert` sent no `Idempotency-Key`, and the route rejects a request without one
 * before its handler runs:
 *
 *     const idempotencyKey = request.headers['idempotency-key'];
 *     if (typeof idempotencyKey !== 'string') throw new AppError(errorCodes.INVALID_REQUEST);
 *
 * Every acknowledgement this app ever sent was therefore a silent 400. Both call sites — the
 * notification tap and the in-app command — discard the failure, so nothing surfaced, and the
 * 2026-08-30 audit found `start_alerts.acknowledged_at` null everywhere.
 *
 * It matters beyond responsiveness evidence: acknowledgement is one of the two proofs that word
 * reached the cook, and the elapsed-window sweep charges a no-show penalty only when it did. A
 * cook who tapped the alert had no record of having tapped it.
 *
 * Nothing else in the suite covers this, because the adapters these tests usually exercise are
 * pure and never touch a header. So the assertion has to be made against the wire.
 */

const OK = { data: { ok: true } };

function stubFetch(): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => OK,
    text: async () => JSON.stringify(OK),
    headers: new Headers({ 'content-type': 'application/json' }),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/** The headers of the single request the stub captured. */
function sentHeaders(mock: jest.Mock): Record<string, string> {
  return (mock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
}

function sentBody(mock: jest.Mock): Record<string, unknown> {
  return JSON.parse((mock.mock.calls[0]?.[1] as { body: string }).body) as Record<string, unknown>;
}

describe('acknowledgeAlert', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends an Idempotency-Key at all', () => {
    const mock = stubFetch();
    return acknowledgeAlert({ bookingId: 'b1', alertType: 'start_alert' }).then(() => {
      expect(sentHeaders(mock)['Idempotency-Key']).toBeDefined();
    });
  });

  it('sends a key the backend will accept', async () => {
    /*
     * `^[A-Za-z0-9._~-]{8,128}$`, enforced in `src/idempotency/records.ts`. A key that reaches
     * the server but fails this pattern is the same 400 by another route, so asserting merely
     * that a header exists would not have caught the bug it replaced.
     */
    const mock = stubFetch();
    await acknowledgeAlert({
      bookingId: '8d02153a-1b2c-4d5e-9f80-aabbccddeeff',
      alertType: 'start_escalation',
      assignmentVersion: 3,
    });
    expect(sentHeaders(mock)['Idempotency-Key']).toMatch(/^[A-Za-z0-9._~-]{8,128}$/);
  });

  it('reuses one key for the same alert, so a double tap is one command', async () => {
    // The push handler has no state to hold a key in and the same notification can genuinely be
    // tapped twice. Acknowledging one alert twice is the same fact stated twice, not two facts.
    const first = stubFetch();
    await acknowledgeAlert({ bookingId: 'b1', alertType: 'start_alert', assignmentVersion: 1 });
    const second = stubFetch();
    await acknowledgeAlert({ bookingId: 'b1', alertType: 'start_alert', assignmentVersion: 1 });
    expect(sentHeaders(second)['Idempotency-Key']).toBe(sentHeaders(first)['Idempotency-Key']);
  });

  it('gives a REASSIGNED alert its own key', async () => {
    // `start_alerts` is UNIQUE (assignment_id, kind), so a new assignment version is a genuinely
    // different alert. Sharing a key would have the server swallow it as a replay of the
    // previous cook's acknowledgement.
    const v1 = stubFetch();
    await acknowledgeAlert({ bookingId: 'b1', alertType: 'start_alert', assignmentVersion: 1 });
    const v2 = stubFetch();
    await acknowledgeAlert({ bookingId: 'b1', alertType: 'start_alert', assignmentVersion: 2 });
    expect(sentHeaders(v2)['Idempotency-Key']).not.toBe(sentHeaders(v1)['Idempotency-Key']);
  });

  it('separates the escalation from the first alert', async () => {
    const alert = stubFetch();
    await acknowledgeAlert({ bookingId: 'b1', alertType: 'start_alert' });
    const escalation = stubFetch();
    await acknowledgeAlert({ bookingId: 'b1', alertType: 'start_escalation' });
    expect(sentHeaders(escalation)['Idempotency-Key']).not.toBe(
      sentHeaders(alert)['Idempotency-Key'],
    );
  });

  it('still omits assignmentVersion from the BODY when there is none', async () => {
    // Unchanged and re-pinned: the route schema is `{ type: 'integer', minimum: 1 }`, so a
    // placeholder zero is a 400 before the handler runs. A notification tap has no projection
    // loaded and must send no version at all.
    const mock = stubFetch();
    await acknowledgeAlert({ bookingId: 'b1', alertType: 'start_alert' });
    expect(sentBody(mock)).toEqual({ alertType: 'start_alert' });
  });
});
