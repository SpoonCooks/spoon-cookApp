import { render, screen, fireEvent } from '@testing-library/react-native';

import AttendanceScreen from '@/app/(tabs)/attendance';
import SingleDayLeaveScreen from '@/app/leave/single';
import RangeLeaveScreen from '@/app/leave/range';

/**
 * Attendance-section render tests — V13 `log in flow` (`592:1068`) plus the leave pickers.
 *
 * The Android emulator could not boot in this environment (see the implementation report §11), so
 * these mount the real screens and assert the rendered projection instead. That is NOT a substitute
 * for device verification and is not reported as one — but it does prove that each of the three
 * server-driven attendance states renders its own Figma copy, that `Mark Present` never marks
 * locally, and that a submitted leave is shown as a REQUEST rather than as a granted chutti.
 */

const mockMutate = jest.fn();
const mockLeaveMutate = jest.fn();
let mockProfileState: Record<string, unknown>;
let mockAttendanceState: Record<string, unknown>;
let mockMarkPresentState: Record<string, unknown>;
let mockLeavesState: Record<string, unknown>;
let mockRequestLeaveState: Record<string, unknown>;

jest.mock('@core/api/queries', () => ({
  useCookProfile: () => mockProfileState,
  useMonthlyAttendance: () => mockAttendanceState,
  useMarkPresent: () => mockMarkPresentState,
  useLeaves: () => mockLeavesState,
  useRequestLeave: () => mockRequestLeaveState,
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
  mockLeaveMutate.mockClear();
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
  mockRequestLeaveState = {
    mutate: mockLeaveMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
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

describe('Pages 14a/14b — 1 din ki chutti (528:483 / 529:1259)', () => {
  it('renders the confirmation copy', () => {
    render(<SingleDayLeaveScreen />);
    expect(screen.getByText('Chutti pakka hai?')).toBeTruthy();
    expect(screen.getByText('Aap jitne din aaye, utne din ke paise milenge')).toBeTruthy();
  });

  it('counts a single day', () => {
    render(<SingleDayLeaveScreen />);
    expect(screen.getByTestId('leave-single-total')).toHaveTextContent('Total din 1');
  });

  it('submits the chosen day as a one-day range with an idempotency key', () => {
    render(<SingleDayLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-single-confirm'));
    expect(mockLeaveMutate).toHaveBeenCalledTimes(1);
    const args = mockLeaveMutate.mock.calls[0]?.[0] as Record<string, string>;
    // The server's date, taken from `serverTime` — not the device clock.
    expect(args['startDateIso']).toBe('2026-08-21');
    expect(args['endDateIso']).toBe('2026-08-21');
    expect(args['idempotencyKey']).toEqual(expect.any(String));
  });

  it('reuses ONE idempotency key across repeated taps', () => {
    render(<SingleDayLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-single-confirm'));
    fireEvent.press(screen.getByTestId('leave-single-confirm'));
    const keys = mockLeaveMutate.mock.calls.map(
      (call) => (call[0] as Record<string, string>)['idempotencyKey'],
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('says the request was SENT, never that the leave was granted', () => {
    mockRequestLeaveState = { ...mockRequestLeaveState, isSuccess: true };
    render(<SingleDayLeaveScreen />);
    expect(screen.getByTestId('leave-single-pending')).toHaveTextContent(
      'Chutti ki request bhej di. Manager approve karenge.',
    );
    expect(screen.queryByText('Chutti lag gyi')).toBeNull();
  });

  it('surfaces a rejected submission rather than pretending it worked', () => {
    mockRequestLeaveState = {
      ...mockRequestLeaveState,
      isError: true,
      error: { name: 'ApiError' },
    };
    render(<SingleDayLeaveScreen />);
    expect(screen.getByTestId('leave-single-failed')).toBeTruthy();
    expect(screen.queryByTestId('leave-single-pending')).toBeNull();
  });
});

describe('Pages 13a/13b — lambi chutti (528:659 / 530:1349)', () => {
  it('starts with an empty selection and Total din 0', () => {
    render(<RangeLeaveScreen />);
    expect(screen.getByTestId('leave-range-total')).toHaveTextContent('0');
  });

  it('counts an inclusive range across two taps', () => {
    render(<RangeLeaveScreen />);
    const first = screen.getAllByTestId(/^leave-range-day-/)[0];
    const tenth = screen.getAllByTestId(/^leave-range-day-/)[9];
    fireEvent.press(first!);
    fireEvent.press(tenth!);
    expect(screen.getByTestId('leave-range-total')).toHaveTextContent('10');
  });

  it('keeps Pakka disabled until a range is actually chosen', () => {
    render(<RangeLeaveScreen />);
    expect(screen.getByTestId('leave-range-confirm').props.accessibilityState.disabled).toBe(true);
  });

  it('submits the whole range as ONE request', () => {
    render(<RangeLeaveScreen />);
    const days = screen.getAllByTestId(/^leave-range-day-/);
    // 21 Aug is the server's today; pick a forward range so validation passes.
    fireEvent.press(days[24]!);
    fireEvent.press(days[28]!);
    fireEvent.press(screen.getByTestId('leave-range-confirm'));
    expect(mockLeaveMutate).toHaveBeenCalledTimes(1);
    const args = mockLeaveMutate.mock.calls[0]?.[0] as Record<string, string>;
    expect(args['startDateIso']).toBe('2026-08-25');
    expect(args['endDateIso']).toBe('2026-08-29');
  });

  it('refuses a range that starts in the past instead of spending the request', () => {
    render(<RangeLeaveScreen />);
    const days = screen.getAllByTestId(/^leave-range-day-/);
    fireEvent.press(days[0]!);
    fireEvent.press(days[4]!);
    expect(screen.getByTestId('leave-range-invalid')).toBeTruthy();
    fireEvent.press(screen.getByTestId('leave-range-confirm'));
    expect(mockLeaveMutate).not.toHaveBeenCalled();
  });
});
