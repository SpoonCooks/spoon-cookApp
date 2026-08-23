import { render, screen, fireEvent, act } from '@testing-library/react-native';
import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from 'react-native';

import BootScreen from '@/app/index';
import OtpScreen from '@/app/otp';
import { color } from '@ui';

/**
 * Login-flow pixel-contract tests for the two screens either side of Login itself —
 * Page 0 loading (`434:3330`) and Pages 2a/2b/2c OTP (`434:3224`, `434:3174`, `434:3116`).
 *
 * Both had drifted from V12 in ways that a colour spot-check would have passed:
 *   - the loading page painted a flat yellow panel with `Spoon` / `Partner` set in type, where
 *     V12 is a diagonal gradient carrying the black Spoon artwork;
 *   - the OTP screen was cream, carried no wordmark, drew 44x52 grey-bordered boxes where V12
 *     draws 35x35 flat `#ffef99` tiles, and rendered a Verify button that appears in none of the
 *     three V12 frames.
 *
 * Device comparison is a separate gate; passing these does not mean either screen was seen on
 * hardware.
 */

const mockReplace = jest.fn();
const mockRestoreSession = jest.fn<Promise<unknown>, []>();
const mockSendLoginOtp = jest.fn<Promise<void>, [string]>();
const mockCompleteLogin = jest.fn<Promise<unknown>, [unknown]>();

let mockAuthKind = 'loading';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (...a: unknown[]) => mockReplace(...a), back: jest.fn() },
  useLocalSearchParams: () => ({ phone: '9876543210' }),
}));

jest.mock('@core/session/auth', () => ({
  restoreSession: () => mockRestoreSession(),
  sendLoginOtp: (phone: string) => mockSendLoginOtp(phone),
  completeLogin: (args: unknown) => mockCompleteLogin(args),
}));

jest.mock('@core/session/store', () => ({
  useSession: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      auth: { kind: mockAuthKind },
      restoreComplete: jest.fn(),
      signIn: jest.fn(),
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 870, scale: 2.75, fontScale: 1 }),
}));

const SCALE = 393 / 370;
const s = (design: number): number => Math.round(design * SCALE * 3) / 3;

function flatten(style: StyleProp<ViewStyle | TextStyle | ImageStyle>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node !== null && typeof node === 'object') Object.assign(out, node);
  };
  visit(style);
  return out;
}

function backgroundColours(tree: unknown): string[] {
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node === null || typeof node !== 'object') return;
    const el = node as { props?: { style?: unknown }; children?: unknown };
    const bg = flatten(el.props?.style as StyleProp<ViewStyle>).backgroundColor;
    if (typeof bg === 'string') found.push(bg);
    visit(el.children);
  };
  visit(tree);
  return found;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthKind = 'loading';
  mockRestoreSession.mockResolvedValue(null);
  mockSendLoginOtp.mockResolvedValue(undefined);
});

describe('Page 0 loading matches V12', () => {
  it('renders the gradient and the black Spoon artwork', async () => {
    render(<BootScreen />);
    await act(async () => {});

    // V12 is artwork on a gradient, not type on a flat fill.
    expect(screen.getByTestId('boot-gradient')).toBeTruthy();
    const logo = screen.getByTestId('boot-logo');
    expect(logo.type).toBe('Image');
    expect(logo.props.source).toBeTruthy();
  });

  it('sizes the Spoon mark to the V12 370x370 box', async () => {
    render(<BootScreen />);
    await act(async () => {});
    const style = flatten(screen.getByTestId('boot-logo').props.style);

    expect(style.width).toBe(s(370));
    expect(style.height).toBe(s(370));
  });

  it('no longer sets the wordmark as text', async () => {
    render(<BootScreen />);
    await act(async () => {});
    // `Spoon` / `Partner` were type in the previous build; V12 has neither as a text layer.
    expect(screen.queryByText('Spoon')).toBeNull();
    expect(screen.queryByText('Partner')).toBeNull();
  });
});

describe('Pages 2a/2b/2c OTP match V12', () => {
  it('is white and carries the wordmark but no hero', () => {
    const tree = render(<OtpScreen />);

    expect(screen.getByTestId('otp-wordmark')).toBeTruthy();
    // Login has the photograph; the OTP frames do not.
    expect(screen.queryByTestId('login-hero')).toBeNull();

    const backgrounds = backgroundColours(tree.toJSON());
    expect(backgrounds).toContain(color.white);
    expect(backgrounds).not.toContain(color.cream);
  });

  it('draws six flat V12 tiles, not bordered boxes', () => {
    render(<OtpScreen />);

    for (let i = 0; i < 6; i += 1) {
      const tile = flatten(screen.getByTestId(`login-otp-box-${i}`).props.style);
      expect(tile.width).toBe(s(35));
      expect(tile.height).toBe(s(35));
      expect(tile.borderRadius).toBe(s(5));
      expect(tile.backgroundColor).toBe(color.yellow300);
      // The V12 tiles carry no stroke at all.
      expect(tile.borderWidth).toBeUndefined();
    }
    expect(screen.queryByTestId('login-otp-box-6')).toBeNull();
  });

  it('renders no Verify button — none of the three V12 frames has one', () => {
    render(<OtpScreen />);

    expect(screen.queryByTestId('login-otp-verify')).toBeNull();
    expect(screen.queryByText('Verify')).toBeNull();
  });

  it('shows the edit-phone icon beside the hint', () => {
    render(<OtpScreen />);

    expect(screen.getByTestId('otp-edit-icon')).toBeTruthy();
    expect(screen.getByTestId('otp-hint').props.children).toBe(
      'OTP bhej diya gaya hai +91 9876543210',
    );
  });

  it('renders state 2a copy while the countdown runs', () => {
    render(<OtpScreen />);

    expect(screen.getByTestId('login-otp-timer')).toBeTruthy();
    expect(screen.queryByTestId('login-otp-resend')).toBeNull();
    expect(screen.getByText('OTP verification')).toBeTruthy();
  });

  it('verifies automatically once the sixth digit lands', () => {
    mockCompleteLogin.mockResolvedValue({ kind: 'denied', reason: 'pending_approval' });
    render(<OtpScreen />);

    fireEvent.changeText(screen.getByTestId('login-otp-field'), '123456');

    // Removing the Verify button cost no behaviour: completion still submits.
    expect(mockCompleteLogin).toHaveBeenCalledWith({
      localTenDigits: '9876543210',
      otp: '123456',
    });
  });

  it('does not submit a short code', () => {
    render(<OtpScreen />);
    fireEvent.changeText(screen.getByTestId('login-otp-field'), '12345');

    expect(mockCompleteLogin).not.toHaveBeenCalled();
  });
});
