import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProfileView, type ProfileAccountProps } from '@features/profile/ProfileView';
import { formatPhone, formatRequestedOn } from '@features/profile/profileModel';

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

/* ------------------------------------------------------- account actions --- */

function accountProps(overrides: Partial<ProfileAccountProps> = {}): ProfileAccountProps {
  return {
    deletionRequestedAt: null,
    sheet: 'none',
    busy: false,
    errorMessage: null,
    onOpenSheet: jest.fn(),
    onCloseSheet: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
}

function renderProfile(account?: ProfileAccountProps) {
  return render(
    withSafeArea(
      <ProfileView
        name="Cook Rekha"
        phone="+91 90465 20308"
        hubName="MM00002 - Haralur 1"
        onBack={jest.fn()}
        {...(account === undefined ? {} : { account })}
      />,
    ),
  );
}

describe('the two things a cook may do to the account itself', () => {
  it('draws no account rows at all when the caller supplies none', () => {
    // The identity card is usable on its own. A screen with no account block must not draw inert
    // rows that lead nowhere.
    renderProfile();

    expect(screen.queryByTestId('profile-account')).toBeNull();
    expect(screen.queryByTestId('profile-logout')).toBeNull();
    expect(screen.queryByTestId('profile-delete')).toBeNull();
  });

  it('offers both actions, and opens the matching confirmation', () => {
    const onOpenSheet = jest.fn();
    renderProfile(accountProps({ onOpenSheet }));

    fireEvent.press(screen.getByTestId('profile-logout'));
    expect(onOpenSheet).toHaveBeenLastCalledWith('logout');

    fireEvent.press(screen.getByTestId('profile-delete'));
    expect(onOpenSheet).toHaveBeenLastCalledWith('delete');
  });

  it('keeps the delete row short enough for a handset to draw all of it', () => {
    /*
     * A device-only failure, pinned here as intent rather than as a guarantee: this assertion
     * cannot catch the truncation itself, because jsdom lays no text out. "Account delete kare"
     * overflowed the row on a 1080x2400 handset and Fabric silently dropped `kare`, drawing a
     * label that was both wrong and off-centre. Anyone lengthening this string has to change this
     * line too, which is the moment to go and look at a real screen.
     */
    renderProfile(accountProps());

    expect(screen.getByTestId('profile-delete').props.accessibilityLabel).toBe('Account delete');
  });

  it('never acts on the first tap', () => {
    // Both are irreversible from inside the app — a logout costs an OTP to undo, and a deletion
    // request goes to a queue the cook cannot see — so neither row is wired to the action itself.
    const onConfirm = jest.fn();
    renderProfile(accountProps({ onConfirm }));

    fireEvent.press(screen.getByTestId('profile-logout'));
    fireEvent.press(screen.getByTestId('profile-delete'));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('the delete confirmation tells the truth about what it does', () => {
  it('says a request goes to the team, and never that the account is deleted', () => {
    /*
     * The load-bearing test of this feature. `POST /cook/account/deletion-request` records a
     * request for Ops; it deletes nothing, revokes no session and changes no booking. A cook who
     * reads "deleted" and then finds herself assigned to tomorrow's service has been lied to by
     * her own app.
     */
    renderProfile(accountProps({ sheet: 'delete' }));

    const message = screen.getByTestId('profile-delete-sheet-message').props.children as string;
    expect(message).toMatch(/request/i);
    expect(message).toMatch(/team/i);
    expect(message).toMatch(/chalte rahenge/i);
    expect(message).not.toMatch(/delete ho gaya|account chala gaya/i);
  });

  it('confirms and cancels through the caller', () => {
    const onConfirm = jest.fn();
    const onCloseSheet = jest.fn();
    renderProfile(accountProps({ sheet: 'delete', onConfirm, onCloseSheet }));

    fireEvent.press(screen.getByTestId('profile-delete-sheet-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('profile-delete-sheet-cancel'));
    expect(onCloseSheet).toHaveBeenCalledTimes(1);
  });

  it('holds a failure in the open sheet rather than closing on it', () => {
    renderProfile(accountProps({ sheet: 'delete', errorMessage: 'Kuch gadbad ho gayi.' }));

    expect(screen.getByTestId('profile-delete-sheet-error').props.children).toBe(
      'Kuch gadbad ho gayi.',
    );
  });

  it('cannot be confirmed twice while the request is on the wire', () => {
    // The server would treat a second request as a no-op, but a spinner that still accepts taps
    // reads as a control that did nothing.
    const onConfirm = jest.fn();
    renderProfile(accountProps({ sheet: 'delete', busy: true, onConfirm }));

    fireEvent.press(screen.getByTestId('profile-delete-sheet-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('draws only the sheet that is open', () => {
    renderProfile(accountProps({ sheet: 'logout' }));

    expect(screen.getByTestId('profile-logout-sheet')).toBeTruthy();
    expect(screen.queryByTestId('profile-delete-sheet')).toBeNull();
  });
});

describe('a request that is already waiting on Ops', () => {
  it('replaces the control with the fact, so she does not tap again', () => {
    renderProfile(accountProps({ deletionRequestedAt: '2026-09-13T20:41:07.912Z' }));

    expect(screen.queryByTestId('profile-delete')).toBeNull();
    expect(screen.getByTestId('profile-delete-pending-title').props.children).toBe(
      'Delete request bheji gayi',
    );
  });

  it('still offers logout — a pending request changes nothing about working', () => {
    // Ops has not acted yet, so she is an ordinary working cook with an ordinary session.
    renderProfile(accountProps({ deletionRequestedAt: '2026-09-13T20:41:07.912Z' }));

    expect(screen.getByTestId('profile-logout')).toBeTruthy();
  });

  it('names the day she asked, in HER timezone', () => {
    /*
     * The server stamps `requestedAt` in UTC and IST is +5:30, so a request made in the evening
     * falls on the previous UTC date. Printing the UTC day would show her a day she did not tap
     * on, on the one line whose whole job is to confirm that what she did was recorded.
     *
     * Asserted against the DEVICE's own reading of the same instant, so the expectation moves
     * with the machine running the suite: on a UTC runner the two coincide and this proves
     * nothing, on an IST one it is the whole point. `getUTCDate` would fail it outright.
     */
    const requestedAt = '2026-09-13T20:41:07.912Z';
    renderProfile(accountProps({ deletionRequestedAt: requestedAt }));

    const local = new Date(requestedAt);
    const note = screen.getByTestId('profile-delete-pending-note').props.children as string;

    expect(note).toContain(`${local.getDate()} `);
    expect(note).toContain(String(local.getFullYear()));
    expect(note).toContain('Spoon team review kar rahi hai.');
  });

  it('states that a request is open even when the timestamp cannot be read', () => {
    // A date this build cannot parse is dropped; an invented one on a line about deletion is
    // worse than none.
    renderProfile(accountProps({ deletionRequestedAt: 'not-a-timestamp' }));

    expect(formatRequestedOn('not-a-timestamp')).toBeNull();
    expect(screen.getByTestId('profile-delete-pending-note').props.children).toBe(
      'Spoon team review kar rahi hai.',
    );
  });
});
