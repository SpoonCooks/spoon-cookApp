import { ApiError } from '../core/api/errors';
import { restoreSession } from '../core/session/auth';

const mockGetCookProfile = jest.fn();
const mockLoadSession = jest.fn();
const mockClearSession = jest.fn();

jest.mock('../core/api/cook', () => ({
  getCookProfile: () => mockGetCookProfile(),
  logout: jest.fn(),
  requestLoginOtp: jest.fn(),
  verifyLoginOtp: jest.fn(),
}));
jest.mock('../core/session/tokens', () => ({
  loadSession: () => mockLoadSession(),
  clearSession: () => mockClearSession(),
  saveSession: jest.fn(),
  deviceId: jest.fn(),
  writeLastPhone: jest.fn(),
}));

const stored = {
  accessToken: 'a',
  refreshToken: 'r',
  accessTokenExpiresAt: '2030-01-01T00:00:00Z',
};

function apiError(kind: 'offline' | 'timeout' | 'server'): Error {
  return new ApiError({ kind, message: kind });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadSession.mockResolvedValue(stored);
});

describe('restoreSession with no network', () => {
  it.each(['offline', 'timeout'] as const)(
    'keeps the session and enters the app when the profile read fails as %s',
    async (kind) => {
      mockGetCookProfile.mockRejectedValue(apiError(kind));
      const profile = await restoreSession();
      expect(profile).not.toBeNull();
      expect(mockClearSession).not.toHaveBeenCalled();
    },
  );

  it('still propagates a failure that is not a lost connection', async () => {
    mockGetCookProfile.mockRejectedValue(apiError('server'));
    await expect(restoreSession()).rejects.toBeInstanceOf(ApiError);
  });

  it('still returns null when there is no stored session', async () => {
    mockLoadSession.mockResolvedValue(null);
    await expect(restoreSession()).resolves.toBeNull();
  });
});
