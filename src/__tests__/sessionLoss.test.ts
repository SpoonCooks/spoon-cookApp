import { ApiError } from '@core/api/errors';
import { createQueryClient } from '@core/api/queries';
import { useSession } from '@core/session/store';

import type { QueryClient } from '@tanstack/react-query';

/**
 * What happens when the session ends without the cook doing anything.
 *
 * Ops finalizing a deletion request revokes every session she has; so does an admin replacing her
 * phone number. The handset finds out as a 401 on whatever read it makes next, which might be from
 * any screen — so the recovery cannot live on four of them, as it did.
 *
 * The cache's `onError` is invoked directly here rather than through a rendered query: driving a
 * React Query observer through `renderHook` leaves this repo's Jest worker alive after the tests
 * pass, and the thing under test is the handler, not the plumbing that reaches it.
 */

/*
 * The cache callbacks are typed for the library's own call sites — a real `Query`, a real
 * `Mutation`, and for mutations a variables/context pair this handler never reads. Only the first
 * argument is under test, so both are narrowed to the shape this file actually uses rather than
 * fabricating four objects the handler ignores.
 */
type ErrorHandler = (...args: unknown[]) => void;

function onQueryError(client: QueryClient): (error: unknown) => void {
  const handler = client.getQueryCache().config.onError as ErrorHandler | undefined;
  if (handler === undefined) throw new Error('no queryCache onError installed');
  return (error) => {
    handler(error, {});
  };
}

function onMutationError(client: QueryClient): (error: unknown) => void {
  const handler = client.getMutationCache().config.onError as ErrorHandler | undefined;
  if (handler === undefined) throw new Error('no mutationCache onError installed');
  return (error) => {
    handler(error, undefined, undefined, {});
  };
}

const revoked = new ApiError({
  kind: 'server',
  message: 'Session expired',
  code: 'UNAUTHENTICATED',
  status: 401,
});

beforeEach(() => {
  useSession.setState({ auth: { kind: 'signed_in', profile: signedInProfile() } });
});

function signedInProfile() {
  return { cookId: 'c1', name: 'Test Cook', photoUrl: null, phone: '+919999990002', rating: 5 };
}

describe('a session that ends underneath the cook', () => {
  it('signs her out when a READ comes back unauthenticated', () => {
    onQueryError(createQueryClient())(revoked);

    expect(useSession.getState().auth).toEqual({ kind: 'signed_out' });
  });

  it('signs her out when a COMMAND comes back unauthenticated', () => {
    // Half the app's 401s arrive on a mutation — `Present`, a leave request, a Start OTP — and a
    // command is the more likely thing to be in flight when Ops acts.
    onMutationError(createQueryClient())(revoked);

    expect(useSession.getState().auth).toEqual({ kind: 'signed_out' });
  });

  it('does NOT sign her out when the network is simply down', () => {
    /*
     * The distinction the whole feature rests on. `offline` and `timeout` say nothing about
     * whether the session is valid, and signing a cook out mid-shift because she walked into a
     * lift would be a far worse failure than the read failing.
     */
    for (const kind of ['offline', 'timeout', 'cancelled'] as const) {
      onQueryError(createQueryClient())(new ApiError({ kind, message: kind }));
      expect(useSession.getState().auth.kind).toBe('signed_in');
    }
  });

  it('ignores a 403, which is a refusal rather than a dead session', () => {
    // A cook who is suspended still HAS a session; the gate that decides she may not enter is
    // `gateCookAccess`, not this.
    onQueryError(createQueryClient())(
      new ApiError({ kind: 'server', message: 'Forbidden', code: 'FORBIDDEN', status: 403 }),
    );

    expect(useSession.getState().auth.kind).toBe('signed_in');
  });

  it('is a no-op once she is already signed out', () => {
    // Several reads 401 together on a revoked session. The first flips the state; the rest must
    // not re-announce it, or the root gate re-runs its redirect for each one.
    const client = createQueryClient();
    useSession.setState({ auth: { kind: 'signed_out' } });
    const before = useSession.getState().auth;

    onQueryError(client)(revoked);

    expect(useSession.getState().auth).toBe(before);
  });
});
