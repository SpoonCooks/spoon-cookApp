import { render, screen, fireEvent } from '@testing-library/react-native';
import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from 'react-native';

import LoginScreen from '@/app/login';
import { color } from '@ui';

/**
 * Login pixel-contract tests — Figma `434:3280`.
 *
 * These lock the four defects the V12 audit found, each of which had shipped while the screen was
 * still being called correct: no hero photograph, no Spoon wordmark, a cream background where V12
 * is white, a lime CTA where V12 is yellow, and a phone number split across two boxes where V12
 * draws one pill with a hairline divider.
 *
 * They assert the *contract*, not a snapshot: a snapshot of a wrong layout passes forever. Numbers
 * here come from the `434:3280` subtree and were confirmed by scanning the V12 render — the field
 * border lands on viewport y=628 and the CTA on y=687.
 *
 * Device comparison is a separate gate. Passing these does not mean the screen was seen on
 * hardware.
 */

const mockSendLoginOtp = jest.fn<Promise<void>, [string]>();
const mockBeginOtp = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@core/session/auth', () => ({
  sendLoginOtp: (phone: string) => mockSendLoginOtp(phone),
}));

jest.mock('@core/session/store', () => ({
  useSession: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ beginOtp: (phone: string) => mockBeginOtp(phone) }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

// The verified target device: 393dp wide, so the design scale factor is 393/370.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 870, scale: 2.75, fontScale: 1 }),
}));

const SCALE = 393 / 370;
/** Design-space value -> device dp, matching `makeDesignScale`. */
const s = (design: number): number => Math.round(design * SCALE * 3) / 3;

function flatten(style: StyleProp<ViewStyle | TextStyle | ImageStyle>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node !== null && typeof node === 'object') Object.assign(out, node);
  };
  visit(style);
  return out;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSendLoginOtp.mockResolvedValue(undefined);
});

describe('Login renders the V13 composition', () => {
  it('renders the hero photograph and the Spoon wordmark', () => {
    render(<LoginScreen />);

    // Both were absent entirely before the V12 correction — this is the headline defect.
    const hero = screen.getByTestId('login-hero');
    const wordmark = screen.getByTestId('login-wordmark');

    // The test renderer reports host components by name.
    expect(hero.type).toBe('Image');
    expect(wordmark.type).toBe('Image');
    expect(hero.props.source).toBeTruthy();
    expect(wordmark.props.source).toBeTruthy();
  });

  it('sizes the hero to the V13 371x343.31 image inside a 329-tall window', () => {
    render(<LoginScreen />);
    const style = flatten(screen.getByTestId('login-hero').props.style);

    // `434:3324` is a 371-wide box — one unit wider than the viewport — holding an image scaled to
    // 104.35% of the box height and clipped back to 329. `cover` would pick its own crop; the
    // design states an exact one, so the image is stretched to the stated size instead.
    expect(style.width).toBe(s(371));
    expect(style.height).toBe(s(343.31));
    expect(screen.getByTestId('login-hero').props.resizeMode).toBe('stretch');
  });

  it('crops the wordmark the way the 134x93 window does', () => {
    render(<LoginScreen />);
    const style = flatten(screen.getByTestId('login-wordmark').props.style);

    // `434:3284` is a 134x93 window onto a square logo drawn at 143.37% of the window height and
    // pulled up 14.87%, so the visible band is the middle of the mark. Reproducing that needs the
    // oversized image plus a negative offset, not a `contain` fit inside 93.
    expect(style.width).toBe(s(134));
    expect(style.height).toBe(s(133.33));
    expect(style.marginTop).toBe(s(-13.83));
    expect(screen.getByTestId('login-wordmark').props.resizeMode).toBe('stretch');
  });

  it('uses ONE unified phone field, never two boxes', () => {
    render(<LoginScreen />);

    const field = screen.getByTestId('login-phone-field');
    const style = flatten(field.props.style);

    expect(style.flexDirection).toBe('row');
    expect(style.height).toBe(s(43));
    // V13 states a literal 15, NOT the fully-rounded sentinel V12 used. Half the height would be
    // 21.5, which visibly over-rounds the ends.
    expect(style.borderRadius).toBe(s(15));
    expect(style.borderColor).toBe(color.yellow600);
    expect(style.backgroundColor).toBe(color.white);

    // The +91 prefix and the input live INSIDE that one field.
    expect(screen.getByText('+91')).toBeTruthy();
    expect(screen.getByTestId('login-phone-input')).toBeTruthy();

    // The split is a hairline divider, not a second bordered box.
    const divider = flatten(screen.getByTestId('login-phone-divider').props.style);
    expect(divider.backgroundColor).toBe(color.yellow400);
    expect(divider.height).toBe(s(24));
  });

  it('paints the CTA V13 yellow at the V13 geometry, not lime', () => {
    render(<LoginScreen />);
    const style = flatten(screen.getByTestId('login-next').props.style);

    expect(style.backgroundColor).toBe(color.yellow600);
    expect(style.backgroundColor).not.toBe(color.lime600);
    expect(style.height).toBe(s(34));
    // `434:3303` states radius 16 on a 34-tall button, so the ends are not semicircular.
    expect(style.borderRadius).toBe(s(16));
  });

  it('keeps the CTA touchable despite the 34dp V12 height', () => {
    render(<LoginScreen />);
    // 34 design dp is under the 44dp minimum target, so the painted geometry stays exact and the
    // target is extended instead.
    expect(screen.getByTestId('login-next').props.hitSlop).toBe(12);
  });

  it('is white, not the cream used by the rest of the app', () => {
    const tree = render(<LoginScreen />);
    const root = tree.toJSON();
    const found: string[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (node === null || typeof node !== 'object') return;
      const el = node as { props?: { style?: unknown }; children?: unknown };
      const bg = flatten(el.props?.style as StyleProp<ViewStyle>).backgroundColor;
      if (typeof bg === 'string') found.push(bg);
      visit(el.children);
    };
    visit(root);

    expect(found).toContain(color.white);
    expect(found).not.toContain(color.cream);
  });

  it('renders the V13 copy verbatim', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Partner')).toBeTruthy();
    expect(screen.getByText('Spoon se jude aur zindagi behtar banaye')).toBeTruthy();
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Phone no. daale')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.getByText('By continuing, I accept the')).toBeTruthy();
    expect(screen.getByText('Terms of use & Privacy policy')).toBeTruthy();
  });

  it('places the form column at the V13 asymmetric gutter', () => {
    render(<LoginScreen />);
    // `434:3291` puts the column at viewport x=20 with width 325 on a 370 viewport, so the right
    // margin is 25. Symmetric padding would displace every right edge by 5 units.
    //
    // Asserted on the field and the CTA rather than on a wrapper: V13 positions each element
    // absolutely against a measured content offset, so there is no single column view to inspect —
    // and that is the point, since a margin stack accumulates rounding across fourteen elements.
    for (const id of ['login-phone-field', 'login-next']) {
      const style = flatten(screen.getByTestId(id).props.style);
      expect(style.left).toBe(s(20));
      expect(style.width).toBe(s(325));
    }
  });
});

describe('Login behaviour survives the V13 visual rebuild', () => {
  it('keeps Next disabled until the number is valid', () => {
    render(<LoginScreen />);
    const next = screen.getByTestId('login-next');

    expect(next.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('login-phone-input'), '98765');
    expect(screen.getByTestId('login-next').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('login-phone-input'), '9876543210');
    expect(screen.getByTestId('login-next').props.accessibilityState.disabled).toBe(false);
  });

  it('never sends an OTP for an invalid number', () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-phone-input'), '1234567890');
    fireEvent.press(screen.getByTestId('login-next'));

    expect(mockSendLoginOtp).not.toHaveBeenCalled();
  });

  it('requests the OTP with the normalised number', async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-phone-input'), '+91 98765 43210');
    fireEvent.press(screen.getByTestId('login-next'));

    expect(mockSendLoginOtp).toHaveBeenCalledWith('9876543210');
    await screen.findByTestId('login-next');
    expect(mockBeginOtp).toHaveBeenCalledWith('9876543210');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/otp', params: { phone: '9876543210' } });
  });

  it('shows the backend error and does not navigate', async () => {
    mockSendLoginOtp.mockRejectedValue(new Error('network down'));
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-phone-input'), '9876543210');
    fireEvent.press(screen.getByTestId('login-next'));

    expect(await screen.findByTestId('login-error')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('uses a numeric keyboard', () => {
    render(<LoginScreen />);
    const input = screen.getByTestId('login-phone-input');
    expect(input.props.keyboardType).toBe('phone-pad');
    expect(input.props.inputMode).toBe('numeric');
  });
});
