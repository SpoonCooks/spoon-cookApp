import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProfileView } from '@features/profile/ProfileView';
import { formatPhone } from '@features/profile/profileModel';

/**
 * PROFILE (`707:1534`) — the card exists to answer one question: is this app signed in as ME?
 *
 * So the three facts it prints are the ones that answer it, and the two cases below are the ones
 * where a screen could quietly lie: a cook with no hub, and a number the app cannot parse.
 */

const withSafeArea = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 870 },
      insets: { top: 49, left: 0, right: 0, bottom: 24 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

describe('the profile card states the cook’s own identity', () => {
  it('draws the name, the signed-in number and the hub', () => {
    render(
      withSafeArea(
        <ProfileView
          name="Cook Rekha"
          phone="+91 90465 20308"
          hubName="MM00002 - Haralur 1"
          onBack={jest.fn()}
        />,
      ),
    );

    expect(screen.getByTestId('profile-name').props.children).toBe('Cook Rekha');
    expect(screen.getByTestId('profile-phone').props.children).toBe('+91 90465 20308');
    expect(screen.getByTestId('profile-hub').props.children).toBe('MM00002 - Haralur 1');
  });

  it('omits the hub line entirely for a cook who has no hub', () => {
    render(
      withSafeArea(
        <ProfileView name="Test Cook" phone="+91 99999 90002" hubName={null} onBack={jest.fn()} />,
      ),
    );

    // A cook with no hub is a real state — the QA login is deliberately left in it — and the row
    // is absent rather than blank, so nothing implies a hub that was never assigned.
    expect(screen.queryByTestId('profile-hub')).toBeNull();
    expect(screen.getByTestId('profile-name').props.children).toBe('Test Cook');
  });
});

describe('the number is grouped the way the frame draws it, or left alone', () => {
  it('groups an Indian E.164 number', () => {
    expect(formatPhone('+919046520308')).toBe('+91 90465 20308');
    expect(formatPhone('+917735100730')).toBe('+91 77351 00730');
  });

  it('prints anything else exactly as the server stored it', () => {
    // Regrouping a number into a shape it does not have would misstate the one fact this screen
    // exists to confirm.
    for (const raw of ['+14155550100', '+9190465', 'not-a-number', '']) {
      expect(formatPhone(raw)).toBe(raw);
    }
  });
});
