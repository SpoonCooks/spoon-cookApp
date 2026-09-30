import { uploadArrivalSelfie } from '@core/api/cook';
import { ApiError } from '@core/api/errors';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBaseUrl: 'https://api.test.invalid', appEnv: 'staging' } } },
}));

/**
 * The arrival selfie upload goes over React Native's `XMLHttpRequest`, not `fetch`: Expo's `fetch`
 * refuses the `{ uri, name, type }` file part ("Unsupported FormDataPart implementation").
 *
 * On staging (2026-09-29) the upload succeeded and the app still said "App update chahiye": the
 * answer's schema expected `{ data }` a second time, after `request` had already unwrapped it, so a
 * good answer failed as a contract error. These pin that a 2xx is read as the answer and a
 * refusal as the server's error.
 */

interface Sent {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

let sent: Sent | null = null;
let reply: { status: number; body: string } = { status: 200, body: '' };

class FakeXhr {
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private method = '';
  private url = '';
  private readonly headers: Record<string, string> = {};
  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  getResponseHeader(): string {
    return 'application/json';
  }
  abort(): void {
    this.onabort?.();
  }
  send(body: unknown): void {
    sent = { method: this.method, url: this.url, headers: this.headers, body };
    this.status = reply.status;
    this.responseText = reply.body;
    setTimeout(() => this.onload?.(), 0);
  }
}

const realXhr = globalThis.XMLHttpRequest;
const realFetch = globalThis.fetch;

beforeEach(() => {
  sent = null;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  globalThis.fetch = jest.fn(() => {
    throw new Error('the selfie must not go through fetch');
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.XMLHttpRequest = realXhr;
  globalThis.fetch = realFetch;
});

const photo = { uri: 'file:///cache/selfie.jpg', mimeType: 'image/jpeg' };

describe('uploadArrivalSelfie', () => {
  it('posts the photo as multipart over XHR and reads the answer', async () => {
    reply = {
      status: 200,
      body: JSON.stringify({
        data: { selfieId: 's-1', capturedAt: '2026-09-29T14:40:00.000Z' },
      }),
    };

    const result = await uploadArrivalSelfie({ bookingId: 'b-1', photo });

    expect(result).toEqual({ selfieId: 's-1', capturedAt: '2026-09-29T14:40:00.000Z' });
    expect(sent?.method).toBe('POST');
    expect(sent?.url).toMatch(/\/cook\/bookings\/b-1\/arrival-selfie$/);
    expect(sent?.body).toBeInstanceOf(FormData);
    // The boundary is the platform's to set; a hand-written content type would break it.
    expect(sent?.headers['Content-Type']).toBeUndefined();
  });

  it("surfaces the server's refusal as its own error, not a contract failure", async () => {
    reply = {
      status: 409,
      body: JSON.stringify({ error: { code: 'INVALID_BOOKING_STATE', message: 'no' } }),
    };

    await expect(uploadArrivalSelfie({ bookingId: 'b-1', photo })).rejects.toMatchObject({
      kind: 'server',
      code: 'INVALID_BOOKING_STATE',
      status: 409,
    } satisfies Partial<ApiError>);
  });
});
