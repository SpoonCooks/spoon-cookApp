import { act, render } from '@testing-library/react-native';

import { CrashBridge } from '@core/crash/CrashBridge';
import { crashReporter } from '@core/crash/crashReporter';
import type { CookProfile } from '@core/domain/auth';
import { useSession } from '@core/session/store';

jest.mock('@core/crash/crashReporter', () => ({
  crashReporter: {
    init: jest.fn(),
    setUser: jest.fn(),
    clearUser: jest.fn(),
    breadcrumb: jest.fn(),
    recordError: jest.fn(),
  },
}));

const setUser = jest.mocked(crashReporter.setUser);
const clearUser = jest.mocked(crashReporter.clearUser);

const PROFILE: CookProfile = {
  cookId: '6f1d1c2e-4b8a-4d0e-9f3a-2a7c9b1e5d44',
  name: 'Sunita Devi',
  photoUrl: null,
  phone: '9876543210',
  rating: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ auth: { kind: 'signed_out' } });
});

describe('CrashBridge', () => {
  it('names a signed-in cook by her opaque id, and by nothing else on her profile', () => {
    useSession.setState({ auth: { kind: 'signed_in', profile: PROFILE } });

    render(<CrashBridge />);

    expect(setUser).toHaveBeenCalledTimes(1);
    expect(setUser).toHaveBeenCalledWith(PROFILE.cookId);
    const sent = JSON.stringify(setUser.mock.calls);
    expect(sent).not.toContain('Sunita');
    expect(sent).not.toContain('9876543210');
  });

  it.each([
    ['loading', { kind: 'loading' }],
    ['signed out', { kind: 'signed_out' }],
    ['waiting for an OTP', { kind: 'otp_pending', phone: '9876543210' }],
  ] as const)('names nobody while %s', (_label, auth) => {
    useSession.setState({ auth });

    render(<CrashBridge />);

    expect(setUser).not.toHaveBeenCalled();
    expect(clearUser).toHaveBeenCalled();
  });

  it('forgets the cook when her session ends under her feet', () => {
    useSession.setState({ auth: { kind: 'signed_in', profile: PROFILE } });
    render(<CrashBridge />);
    clearUser.mockClear();

    act(() => {
      useSession.getState().signOut();
    });

    expect(clearUser).toHaveBeenCalledTimes(1);
  });

  it('does not re-send the id when only her name or rating changes', () => {
    useSession.setState({ auth: { kind: 'signed_in', profile: PROFILE } });
    render(<CrashBridge />);

    act(() => {
      useSession.setState({
        auth: { kind: 'signed_in', profile: { ...PROFILE, name: 'Sunita D.', rating: 4.9 } },
      });
    });

    expect(setUser).toHaveBeenCalledTimes(1);
  });
});
