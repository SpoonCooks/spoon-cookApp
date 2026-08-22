/**
 * The one place the Cook App talks to Spoon's backend.
 *
 * Responsibilities, deliberately narrow:
 *   - attach the bearer token
 *   - parse `{ data }` / `{ error }` into typed results
 *   - validate every 2xx body against a schema before a screen can see it
 *   - refresh a rotated session exactly once for N concurrent 401s
 *   - turn transport failures into `ApiError`s that stay distinguishable from server failures
 *
 * ## What it must never do
 *
 * Never fall back to fixture data. Never retry a mutation automatically — `POST /cook/attendance/present`
 * and both OTP verifications are idempotent only because the CALLER supplies a stable
 * `Idempotency-Key`; a blind retry with a fresh key would be a second real command.
 * Never log a token, an OTP or a phone number.
 */

import { apiPathPrefix, requestTimeoutMs, requireApiBaseUrl } from '../config';
import {
  clearSession,
  loadSession,
  peekSession,
  saveSession,
  type StoredSession,
} from '../session/tokens';
import { ApiError, apiErrorCodes, type ApiErrorCode } from './errors';
import { envelope, refreshedSessionSchema } from './schemas';

import type { z } from 'zod';

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  readonly body?: unknown;
  /** Required by the backend on every mutating cook command that must not double-apply. */
  readonly idempotencyKey?: string;
  /** Lets a screen abandon a request it no longer needs. */
  readonly signal?: AbortSignal;
  /** Endpoints callable while signed out (`/auth/*`). */
  readonly anonymous?: boolean;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const base = `${requireApiBaseUrl()}${apiPathPrefix}${path}`;
  if (query === undefined) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, String(value));
  }
  const search = params.toString();
  return search.length > 0 ? `${base}?${search}` : base;
}

function toErrorCode(value: unknown): ApiErrorCode | null {
  return apiErrorCodes.find((code) => code === value) ?? null;
}

/** Parse the canonical error envelope. A body that is not one still yields a typed failure. */
async function readServerError(response: Response): Promise<ApiError> {
  let code: ApiErrorCode | null = null;
  let requestId: string | null = null;
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const detail = (parsed as { error: unknown }).error;
      if (typeof detail === 'object' && detail !== null) {
        code = toErrorCode((detail as { code?: unknown }).code);
        const id = (detail as { requestId?: unknown }).requestId;
        requestId = typeof id === 'string' ? id : null;
      }
    }
  } catch {
    // A non-JSON error body (proxy HTML, empty 502) is still a server failure.
  }
  return new ApiError({
    kind: 'server',
    message: `Request failed with status ${response.status}`,
    code,
    status: response.status,
    requestId,
  });
}

/* ------------------------------------------------------------- refresh --- */

let refreshInFlight: Promise<StoredSession | null> | null = null;

/**
 * Rotate the session, once.
 *
 * Concurrent 401s share one in-flight refresh. Without this, a screen firing three parallel reads
 * would spend three refresh tokens; the backend revokes the whole family on reuse, which would log
 * the cook out mid-service.
 */
async function refreshSession(): Promise<StoredSession | null> {
  if (refreshInFlight !== null) return refreshInFlight;

  refreshInFlight = (async (): Promise<StoredSession | null> => {
    const current = peekSession() ?? (await loadSession());
    if (current === null) return null;
    try {
      const response = await fetch(buildUrl('/auth/refresh', undefined), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) {
        await clearSession();
        return null;
      }
      const parsed = envelope(refreshedSessionSchema).safeParse(await response.json());
      if (!parsed.success) {
        await clearSession();
        return null;
      }
      const next: StoredSession = {
        accessToken: parsed.data.data.accessToken,
        refreshToken: parsed.data.data.refreshToken,
        accessTokenExpiresAt: parsed.data.data.accessTokenExpiresAt,
      };
      await saveSession(next);
      return next;
    } catch {
      // A refresh that failed on transport is NOT proof the session is invalid, so the stored
      // tokens are left alone and the original request simply surfaces its failure.
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/* --------------------------------------------------------------- send --- */

async function send(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  const onExternalAbort = (): void => {
    controller.abort();
  };
  options.signal?.addEventListener('abort', onExternalAbort);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token !== null) headers['Authorization'] = `Bearer ${token}`;
  if (options.idempotencyKey !== undefined) headers['Idempotency-Key'] = options.idempotencyKey;

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      signal: controller.signal,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

function transportError(error: unknown, externalSignal: AbortSignal | undefined): ApiError {
  // An abort raised by the caller is a cancellation; an abort we raised is a timeout.
  if (externalSignal?.aborted === true) {
    return new ApiError({ kind: 'cancelled', message: 'Request cancelled' });
  }
  const aborted =
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError';
  return aborted
    ? new ApiError({ kind: 'timeout', message: 'Request timed out' })
    : new ApiError({ kind: 'offline', message: 'Network request failed' });
}

/**
 * Perform a request and validate its body.
 *
 * @throws {ApiError} for every failure mode. Callers never see a raw fetch rejection.
 */
export async function request<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const anonymous = options.anonymous === true;
  let token: string | null = null;
  if (!anonymous) {
    const session = peekSession() ?? (await loadSession());
    token = session?.accessToken ?? null;
  }

  let response: Response;
  try {
    response = await send(path, options, token);
  } catch (error) {
    throw transportError(error, options.signal);
  }

  // One retry, and only for an expired access token on an authenticated call.
  if (response.status === 401 && !anonymous) {
    const refreshed = await refreshSession();
    if (refreshed === null) {
      await clearSession();
      throw new ApiError({
        kind: 'server',
        message: 'Session expired',
        code: 'UNAUTHENTICATED',
        status: 401,
      });
    }
    try {
      response = await send(path, options, refreshed.accessToken);
    } catch (error) {
      throw transportError(error, options.signal);
    }
  }

  if (!response.ok) throw await readServerError(response);

  if (response.status === 204) return schema.parse(undefined) as z.infer<T>;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError({
      kind: 'contract',
      message: 'Response was not valid JSON',
      status: response.status,
    });
  }

  // Unwrap `{ data }` explicitly rather than through a generic envelope schema: the generic form
  // defeats Zod's output inference and collapses `z.infer<T>` to a mapped-type expression.
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new ApiError({
      kind: 'contract',
      message: 'Response was not wrapped in the { data } envelope',
      status: response.status,
      contractDetail: '(root)',
    });
  }

  const parsed = schema.safeParse((payload as { data: unknown }).data);
  if (!parsed.success) {
    // Field paths only — a rejected body may carry a name, phone or address.
    const detail = parsed.error.issues
      .map((issue) => issue.path.join('.') || '(root)')
      .slice(0, 8)
      .join(', ');
    throw new ApiError({
      kind: 'contract',
      message: 'Response did not match the expected contract',
      status: response.status,
      contractDetail: detail,
    });
  }
  return parsed.data as z.infer<T>;
}

/** Test seam — clears the single-flight refresh latch between tests. */
export function __resetRefreshLatchForTests(): void {
  refreshInFlight = null;
}
