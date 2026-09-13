import { logout, requestAccountDeletion } from '@core/api/cook';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBaseUrl: 'https://api.test.invalid', appEnv: 'staging' } } },
}));

/**
 * The two account-lifecycle calls, asserted against the WIRE.
 *
 * Both are one-line functions whose correctness is entirely in what leaves the device — a path, a
 * method, a body, and whether a 204 is survivable. None of that is visible to a test of the
 * screens, so it is pinned here.
 */

const realFetch = globalThis.fetch;

function stubJson(status: number, body: unknown): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/** A 204 as the platform actually delivers it: no body, and `json()` rejects. */
function stubNoContent(): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: true,
    status: 204,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    },
    text: async () => '',
    headers: new Headers(),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

function sentUrl(mock: jest.Mock): string {
  return mock.mock.calls[0]?.[0] as string;
}

function sentInit(mock: jest.Mock): {
  method: string;
  headers: Record<string, string>;
  body?: string;
} {
  return mock.mock.calls[0]?.[1] as {
    method: string;
    headers: Record<string, string>;
    body?: string;
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('requestAccountDeletion', () => {
  it('posts to the cook route, not the customer one', async () => {
    /*
     * `DELETE /v1/me` is the CUSTOMER's instant, irreversible deletion. A cook's is a request for
     * Ops. Pointing this call at the customer route would not fail loudly — a cook's bearer token
     * on `DELETE /v1/me` is a different account model entirely — so the path is pinned.
     */
    const mock = stubJson(200, { data: { requested: true } });
    await requestAccountDeletion();

    expect(sentUrl(mock)).toBe('https://api.test.invalid/v1/cook/account/deletion-request');
    expect(sentInit(mock).method).toBe('POST');
  });

  it('sends an empty object, which is what the route schema requires', async () => {
    // The route is declared `{ schema: { body: emptyObjectSchema } }`: a body with any property
    // is rejected before the handler runs, and so is no body at all.
    const mock = stubJson(200, { data: { requested: true } });
    await requestAccountDeletion();

    expect(JSON.parse(sentInit(mock).body ?? 'null')).toEqual({});
  });

  it('sends no Idempotency-Key, because the route takes none', async () => {
    // Unlike every cook COMMAND, this route has no idempotency claim: the server makes a second
    // request while one is open a no-op by looking at the open row. A key here would be ignored.
    const mock = stubJson(200, { data: { requested: true } });
    await requestAccountDeletion();

    expect(sentInit(mock).headers['Idempotency-Key']).toBeUndefined();
  });

  it('reports the acknowledgement rather than assuming it', async () => {
    const mock = stubJson(200, { data: { requested: true } });
    await expect(requestAccountDeletion()).resolves.toEqual({ requested: true });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('fails on a 200 that does not carry the acknowledgement', async () => {
    // A reply this shape means the contract moved. Resolving anyway would draw the pending row
    // for a request the server never recorded.
    stubJson(200, { data: {} });
    await expect(requestAccountDeletion()).rejects.toThrow();
  });
});

describe('logout', () => {
  it('resolves on the 204 the route actually answers', async () => {
    /*
     * Regression. `logout` parsed its reply with `commandAckSchema` (`z.looseObject({})`), and
     * `client.ts` parses a 204 as `schema.parse(undefined)` — which that schema rejects. Every
     * SUCCESSFUL logout therefore threw. `endSession` catches everything, so the cook was still
     * signed out and nothing looked broken; what was lost was any way to tell a revocation that
     * failed from one that worked.
     */
    stubNoContent();
    await expect(logout()).resolves.toBeUndefined();
  });

  it('still fails when the server refuses', async () => {
    stubJson(500, { error: { code: 'INTERNAL', requestId: 'r1' } });
    await expect(logout()).rejects.toThrow();
  });
});
