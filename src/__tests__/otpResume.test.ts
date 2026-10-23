import { clearPendingOtp, readPendingOtp, savePendingOtp } from '@core/session/tokens';
import { extractOtp } from '../../modules/sms-user-consent';

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

describe('pending OTP resume', () => {
  it('returns the phone while the sent code is still fresh', async () => {
    await savePendingOtp('9876543210', 1_000);

    await expect(readPendingOtp(1_000 + 4 * 60 * 1000)).resolves.toBe('9876543210');
  });

  it('forgets it once the window has passed', async () => {
    await savePendingOtp('9876543210', 1_000);

    await expect(readPendingOtp(1_000 + 5 * 60 * 1000)).resolves.toBeNull();
    await expect(readPendingOtp(1_000)).resolves.toBeNull();
  });

  it('forgets it when cleared', async () => {
    await savePendingOtp('9876543210', 1_000);
    await clearPendingOtp();

    await expect(readPendingOtp(1_000)).resolves.toBeNull();
  });
});

describe('extractOtp', () => {
  it('finds the six-digit code in a typical SMS', () => {
    expect(extractOtp('123456 is your Spoon verification code. Do not share it.', 6)).toBe(
      '123456',
    );
  });

  it('ignores digit runs of any other length', () => {
    expect(extractOtp('Call 9876543210 or use 12345', 6)).toBeNull();
  });
});
