import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { OtpInput } from '@ui';

/**
 * The Start / End job tiles (`1:10313`) are one flat `#ffef99`, cursor or not: the box being typed
 * into used to turn a shade darker, and it should not (founder, 2026-09-30).
 */
describe('job OTP tiles', () => {
  it('keeps every tile the same colour while one has the cursor', () => {
    render(<OtpInput variant="job" length={3} value="1" onChange={() => undefined} testID="otp" />);
    fireEvent(screen.getByTestId('otp-field'), 'focus');

    const fills = [0, 1, 2].map(
      (i) => StyleSheet.flatten(screen.getByTestId(`otp-box-${i}`).props.style).backgroundColor,
    );
    expect(new Set(fills).size).toBe(1);
  });
});
