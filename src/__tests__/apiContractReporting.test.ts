import { z } from 'zod';

import { request } from '@core/api/client';
import { crashReporter } from '@core/crash/crashReporter';

/**
 * A response that does not match what the app expects is the one API failure worth reporting: the
 * backend and this build disagree, and a cook can do nothing about it. Everything else (offline,
 * 4xx, 5xx) is an expected outcome and must stay out of crash reporting.
 */

jest.mock('@core/crash/crashReporter', () => ({
  crashReporter: { recordError: jest.fn() },
}));
jest.mock('@core/config', () => ({
  apiPathPrefix: '/v1',
  requestTimeoutMs: 5_000,
  requireApiBaseUrl: () => 'https://api.example.test',
}));

const recordError = jest.mocked(crashReporter.recordError);
const schema = z.object({ status: z.string() });

function respond(response: Partial<Response>): void {
  global.fetch = jest.fn(async () => response as Response) as unknown as typeof fetch;
}

const BOOKING = '6f1d1c2e-4b8a-4d0e-9f3a-2a7c9b1e5d44';

beforeEach(() => {
  recordError.mockClear();
});

describe('contract failures', () => {
  it('reports a body that does not match the schema, by route template and field paths only', async () => {
    respond({
      ok: true,
      status: 200,
      json: async () => ({ data: { status: 42, customerName: 'Asha Verma' } }),
    });

    await expect(
      request(`/cook/bookings/${BOOKING}/arrive?token=abc`, schema, { anonymous: true }),
    ).rejects.toMatchObject({ kind: 'contract' });

    expect(recordError).toHaveBeenCalledTimes(1);
    const [reported, context] = recordError.mock.calls[0] ?? [];
    expect(reported).toBeInstanceOf(Error);
    expect((reported as Error).name).toBe('ContractMismatch');
    expect((reported as Error).message).toBe(
      '/cook/bookings/:id/arrive: Response did not match the expected contract',
    );
    expect(context).toEqual({ status: 200, fields: 'status' });
    // Neither the booking id, the query string, nor any body value reaches the report.
    expect(JSON.stringify(recordError.mock.calls)).not.toMatch(
      new RegExp(`${BOOKING}|token=abc|Asha`),
    );
  });

  it('reports a body that is not JSON', async () => {
    respond({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });

    await expect(request('/cook/jobs', schema, { anonymous: true })).rejects.toMatchObject({
      kind: 'contract',
    });

    expect((recordError.mock.calls[0]?.[0] as Error).message).toBe(
      '/cook/jobs: Response was not valid JSON',
    );
  });

  it('reports a body missing the { data } envelope', async () => {
    respond({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });

    await expect(request('/cook/jobs', schema, { anonymous: true })).rejects.toMatchObject({
      kind: 'contract',
    });

    expect((recordError.mock.calls[0]?.[0] as Error).message).toContain('{ data } envelope');
  });

  it('still hands the caller the same ApiError it always did', async () => {
    respond({ ok: true, status: 200, json: async () => ({ data: { status: 1 } }) });

    await expect(request('/cook/jobs', schema, { anonymous: true })).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'contract',
      status: 200,
      contractDetail: 'status',
    });
  });
});

describe('expected outcomes stay out of crash reporting', () => {
  it('does not report a valid response', async () => {
    respond({ ok: true, status: 200, json: async () => ({ data: { status: 'ok' } }) });

    await expect(request('/cook/jobs', schema, { anonymous: true })).resolves.toEqual({
      status: 'ok',
    });

    expect(recordError).not.toHaveBeenCalled();
  });

  it('does not report the network being down', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    await expect(request('/cook/jobs', schema, { anonymous: true })).rejects.toMatchObject({
      kind: 'offline',
    });

    expect(recordError).not.toHaveBeenCalled();
  });

  it('does not report a server error the backend explained', async () => {
    respond({
      ok: false,
      status: 503,
      json: async () => ({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'down' } }),
    });

    await expect(request('/cook/jobs', schema, { anonymous: true })).rejects.toMatchObject({
      kind: 'server',
    });

    expect(recordError).not.toHaveBeenCalled();
  });
});
