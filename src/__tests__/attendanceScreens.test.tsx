import { render, screen, fireEvent } from '@testing-library/react-native';

import AttendanceScreen from '@/app/(tabs)/attendance';

/**
 * Attendance render tests — the V13 `log in flow` section (`592:1068`).
 *
 * These mount the real screen and assert the rendered projection. They are not a substitute for
 * the device comparison in `docs/visual-verification/v13/log-in-flow/`, and are not reported as
 * one — what they prove is the state SELECTION: that each server-driven state renders its own
 * frame's copy, that `Mark Present` never marks locally, and that the check-in deadline the frame
 * draws is withheld until the backend publishes one.
 *
 * The leave surfaces moved to the `leave` section in V13; their coverage is in
 * `leaveScreens.test.tsx`.
 */

const mockMutate = jest.fn();
let mockProfileState: Record<string, unknown>;
let mockAttendanceState: Record<string, unknown>;
let mockMarkPresentState: Record<string, unknown>;
let mockLeavesState: Record<string, unknown>;

jest.mock('@core/api/queries', () => ({
  useCookProfile: () => mockProfileState,
  useMonthlyAttendance: () => mockAttendanceState,
  useMarkPresent: () => mockMarkPresentState,
  useLeaves: () => mockLeavesState,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

// These screens read real safe-area insets. Outside a provider the hook throws, so a fixed inset
// stands in — layout padding is not what these tests are asserting.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

function shift(): Record<string, unknown> {
  return {
    id: 's1',
    startLocalTime: '09:00:00',
    endLocalTime: '18:00:00',
    breakStartLocalTime: '12:15:00',
    breakEndLocalTime: '14:15:00',
  };
}

/**
 * @param overrides lets a test drive the SERVER's eligibility ruling directly. The defaults mirror
 * how the backend derives `canCheckIn`/`reason`, so the harness stays contract-accurate rather
 * than asserting against a shape the API never returns.
 */
function profile(
  attendance: Record<string, unknown> | null,
  withShift = true,
  overrides: Record<string, unknown> = {},
): void {
  mockProfileState = {
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
    data: {
      cook: {
        id: 'c1',
        name: 'Rekha',
        photoUrl: null,
        status: 'active',
        hub: null,
        rating: { average: 4.9, count: 12 },
      },
      today: {
        workingDays: [1, 2, 3, 4, 5],
        shift: withShift ? shift() : null,
        attendance,
        canCheckIn: withShift && attendance === null,
        // The backend has no approved opening rule, so the live API always sends null here.
        checkInOpensAt: null,
        shiftStartsAt: withShift ? '2026-08-21T03:30:00.000Z' : null,
        checkedInAt: null,
        reason: !withShift ? 'NO_SHIFT' : attendance === null ? 'READY' : 'ATTENDANCE_RECORDED',
        availability: null,
        ...overrides,
      },
      currentAssignment: null,
      serverTime: '2026-08-21T08:23:00.000Z',
    },
  };
}

beforeEach(() => {
  mockMutate.mockClear();
  profile(null);
  mockAttendanceState = {
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
    data: {
      month: '2026-08',
      days: [],
      presentTotal: 22,
      leaveTotal: 2,
      scheduledDayTotal: 24,
      onTimePercentage: 98,
      timezone: 'Asia/Kolkata',
    },
  };
  mockMarkPresentState = { mutate: mockMutate, isPending: false, isError: false, error: null };
  mockLeavesState = {
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
    data: { leaves: [], fromDate: '2026-08-21', toDate: '2026-08-31', timezone: 'Asia/Kolkata' },
  };
});

describe('575:2135 — 3a, daily log in', () => {
  it('asks the question and offers PRESENT', () => {
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-headline')).toHaveTextContent(
      'aaj aap kaam pai aaye hai?',
    );
    expect(screen.getByTestId('attendance-mark-present')).toBeTruthy();
  });

  it('greets the cook with the server name and the server shift window', () => {
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-name')).toHaveTextContent('Namaste, Rekha!');
    // `09:00:00`/`18:00:00` from the shift fixture, in the pill's own `6 AM se 6 PM` shape.
    expect(screen.getByTestId('attendance-shift-pill')).toHaveTextContent('9 AM se 6 PM');
  });

  it('hides the shift pill rather than inventing a window when there is no shift', () => {
    profile(null, false);
    render(<AttendanceScreen />);
    expect(screen.queryByTestId('attendance-shift-pill')).toBeNull();
  });

  it('does NOT print a check-in deadline, which the backend does not enforce', () => {
    // `540:402` reads "5:30 AM se pehle tak button dabaye". No approved opening window exists —
    // `/cook/me` returns `checkInOpensAt: null` — so printing it would state a restriction the
    // server has never applied and would send away cooks who are entitled to check in.
    render(<AttendanceScreen />);
    expect(screen.queryByTestId('attendance-window')).toBeNull();
    expect(screen.queryByText(/se pehle tak button dabaye/)).toBeNull();
  });

  it('draws the window row only once the backend publishes an opening instant', () => {
    profile(null, true, { checkInOpensAt: '2026-08-21T00:00:00.000Z' });
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-window')).toHaveTextContent(/se pehle tak button dabaye/);
  });

  it('withholds the button when the SERVER says the cook cannot check in', () => {
    // Approved leave: an earlier local rule (`has shift && no record`) offered the button here and
    // let the backend reject the tap with a 400.
    profile(null, true, { canCheckIn: false, reason: 'APPROVED_LEAVE' });
    render(<AttendanceScreen />);
    expect(screen.queryByTestId('attendance-mark-present')).toBeNull();
    expect(screen.getByTestId('attendance-no-shift')).toHaveTextContent(
      'Aaj aapki chutti approve hai.',
    );
  });

  it('does not mark the cook present locally', () => {
    render(<AttendanceScreen />);
    fireEvent.press(screen.getByTestId('attendance-mark-present'));
    // The command is sent, but the screen must still show the unmarked state: only a re-read of
    // the server's record may change it.
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('attendance-headline')).toHaveTextContent(
      'aaj aap kaam pai aaye hai?',
    );
    expect(screen.queryByTestId('attendance-verdict')).toBeNull();
  });

  it('offers no check-in when there is no shift today', () => {
    profile(null, false);
    render(<AttendanceScreen />);
    expect(screen.queryByTestId('attendance-mark-present')).toBeNull();
    expect(screen.getByTestId('attendance-no-shift')).toHaveTextContent(
      'Aaj aapki koi shift nahi hai.',
    );
  });

  it('surfaces a failed check-in instead of pretending it worked', () => {
    mockMarkPresentState = {
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { name: 'ApiError' },
    };
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-mark-error')).toBeTruthy();
    expect(screen.queryByTestId('attendance-verdict')).toBeNull();
  });
});

describe('575:2137 — 3b, present', () => {
  beforeEach(() => {
    profile({ status: 'present', checkInAt: '2026-08-21T03:29:00.000Z', onTime: true });
  });

  it('renders the PRESENT verdict', () => {
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-headline')).toHaveTextContent(
      'aaj aap kaam pai aaye hai.',
    );
    expect(screen.getByTestId('attendance-verdict')).toHaveTextContent('Aaj ke liye PRESENT!');
  });

  it('offers KAAM DEKHE and withdraws the check-in button', () => {
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-see-work')).toBeTruthy();
    expect(screen.queryByTestId('attendance-mark-present')).toBeNull();
  });
});

describe('575:2138 — 3c, absent', () => {
  it('renders the ABSENT verdict with the negated headline', () => {
    profile({ status: 'absent', checkInAt: null, onTime: null });
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-headline')).toHaveTextContent(
      'aaj aap kaam pai NAHI aaye hai.',
    );
    expect(screen.getByTestId('attendance-verdict')).toHaveTextContent('Aaj ke liye ABSENT!');
    expect(screen.queryByTestId('attendance-mark-present')).toBeNull();
    expect(screen.queryByTestId('attendance-see-work')).toBeNull();
  });

  it('shows the same ABSENT frame for an approved leave day', () => {
    profile({ status: 'leave', checkInAt: null, onTime: null });
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-verdict')).toHaveTextContent('Aaj ke liye ABSENT!');
  });
});

describe('575:2136 — 3d, shift finished', () => {
  it('shows the rest photograph once a PRESENT shift has ended', () => {
    // `endLocalTime: 00:00:00` makes "has the shift ended?" true at every clock time, so this
    // asserts the state selection rather than the runner's wall clock.
    profile({ status: 'present', checkInAt: '2026-08-21T03:29:00.000Z', onTime: true }, true, {
      shift: { ...shift(), endLocalTime: '00:00:00' },
    });
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-rest-photo')).toBeTruthy();
    expect(screen.getByTestId('attendance-rest-caption')).toHaveTextContent(
      'Aaj ka kaam khatam ho gaya, aaram kare!',
    );
  });

  it('stays on the PRESENT frame while the shift is still running', () => {
    profile({ status: 'present', checkInAt: '2026-08-21T03:29:00.000Z', onTime: true }, true, {
      shift: { ...shift(), endLocalTime: '23:59:00' },
    });
    render(<AttendanceScreen />);
    expect(screen.queryByTestId('attendance-rest-photo')).toBeNull();
    expect(screen.getByTestId('attendance-verdict')).toHaveTextContent('Aaj ke liye PRESENT!');
  });
});

/*
 * The break card, the month tiles and the `Chutti lagaye` block are no longer part of this
 * screen. V13 moves them to the `leave` section (`540:416`), whose own screen carries `AAJ KA
 * BREAK` and the leave surfaces; their coverage lives with that screen.
 */
