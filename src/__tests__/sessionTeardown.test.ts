import { logout } from '@core/api/cook';
import { tearDownSession } from '@core/session/auth';

jest.mock('@core/api/cook', () => ({
  __esModule: true,
  logout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

/**
 * What must stop being true when a cook leaves this device.
 *
 * Asserted as a sequence rather than as three separate facts, because the ORDER is the part that
 * can go wrong silently: every step still runs if they are reversed, and the damage — an
 * authenticated refetch issued on behalf of a cook who has already left, or the next cook reading
 * the previous one's kamai — is invisible from any single assertion.
 */

const SecureStore = jest.requireMock('expo-secure-store') as {
  deleteItemAsync: jest.Mock;
};
const mockLogout = logout as jest.MockedFunction<typeof logout>;

function recordingTeardown(order: string[]) {
  return {
    signOut: () => order.push('signOut'),
    dropCachedReads: () => order.push('dropCachedReads'),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLogout.mockResolvedValue(undefined);
  SecureStore.deleteItemAsync.mockImplementation(async () => undefined);
});

describe('tearDownSession', () => {
  it('revokes, forgets the tokens, flips the store, then drops the cache', async () => {
    const order: string[] = [];
    mockLogout.mockImplementation(async () => {
      order.push('logout');
    });
    SecureStore.deleteItemAsync.mockImplementation(async () => {
      order.push('deleteToken');
    });

    await tearDownSession(recordingTeardown(order));

    // Three keys are deleted in parallel, so only the first is positioned against the rest.
    expect(order.filter((step) => step !== 'deleteToken')).toEqual([
      'logout',
      'signOut',
      'dropCachedReads',
    ]);
    expect(order.indexOf('deleteToken')).toBeLessThan(order.indexOf('signOut'));
  });

  it('drops the cached reads LAST, after the tokens are gone', async () => {
    /*
     * Dropping the cache makes every mounted read refetch. A refetch that goes out while the
     * access token is still in the keystore is a live, authenticated request performed on behalf
     * of a cook who has already left.
     */
    const order: string[] = [];
    SecureStore.deleteItemAsync.mockImplementation(async () => {
      order.push('deleteToken');
    });

    await tearDownSession(recordingTeardown(order));

    expect(order[order.length - 1]).toBe('dropCachedReads');
  });

  it('signs out locally even when the server could not be reached', async () => {
    // A cook who asked to leave must not be held in the session by a dead network. Her tokens are
    // gone from this device either way, and the server's copy expires on its own.
    const order: string[] = [];
    mockLogout.mockRejectedValue(new Error('Network request failed'));

    await expect(tearDownSession(recordingTeardown(order))).resolves.toBeUndefined();

    expect(order).toEqual(['signOut', 'dropCachedReads']);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
