import * as SecureStore from 'expo-secure-store';

import { clearSession, readLastPhone, writeLastPhone } from '@core/session/tokens';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
  };
});

describe('last signed-in phone', () => {
  it('round-trips and survives clearing the session tokens', async () => {
    await writeLastPhone('9876543210');
    await clearSession();

    await expect(readLastPhone()).resolves.toBe('9876543210');
  });

  it('swallows a keystore write failure', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(writeLastPhone('9876543210')).resolves.toBeUndefined();
  });
});
