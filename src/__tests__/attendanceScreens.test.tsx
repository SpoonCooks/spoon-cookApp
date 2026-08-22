import { render, screen, fireEvent } from '@testing-library/react-native';

import AttendanceScreen from '@/app/(tabs)/attendance';
import SingleDayLeaveScreen from '@/app/leave/single';
import RangeLeaveScreen from '@/app/leave/range';

/**
 * Attendance-section render tests.
 *
 * The Android emulator could not boot in this environment (see the implementation report §11), so
 * these mount the real screens and assert the rendered projection instead. That is NOT a substitute
 * for device verification and is not reported as one — but it does prove that each of the three
 * server-driven attendance states renders its own Figma copy, that `Mark Present` never marks
 * locally, and that the leave flow cannot claim a leave the backend never recorded.
 */

const mockMutate = jest.fn();
let mockProfileState: Record<string, unknown>;
let mockAttendanceState: Record<string, unknown>;
let mockMarkPresentState: Record<string, unknown>;

jest.mock('@core/api/queries', () => ({
  useCookProfile: () => mockProfileState,
  useMonthlyAttendance: () => mockAttendanceState,
  useMarkPresent: () => mockMarkPresentState,
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

function profile(attendance: Record<string, unknown> | null, withShift = true): void {
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
        availability: null,
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
});

describe('Page 11 — no attendance record yet (506:1986)', () => {
  it('asks the question and offers Mark Present', () => {
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-headline')).toHaveTextContent(
      'aaj aap kaam pai aaye hai?',
    );
    expect(screen.getByTestId('attendance-mark-present')).toBeTruthy();
  });

  it('shows the shift-window hint verbatim', () => {
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-present-hint')).toHaveTextContent(
      'Shift se 30 mins pehle tak button dabaye',
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
    expect(screen.getByTestId('attendance-no-shift')).toBeTruthy();
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

describe('Page 12a — present (526:292)', () => {
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

  it('shows the break card with the server shift window', () => {
    render(<AttendanceScreen />);
    // Regex matchers: the card concatenates several Text nodes, so an exact match would fail.
    const card = screen.getByTestId('attendance-break-card');
    expect(card).toHaveTextContent(/aaj ka break/);
    expect(card).toHaveTextContent(/Duration: 2 hrs/);
    expect(card).toHaveTextContent(/12:15 PM/);
    expect(card).toHaveTextContent(/2:15 PM/);
  });

  it('withdraws the Mark Present button once checked in', () => {
    render(<AttendanceScreen />);
    expect(screen.queryByTestId('attendance-mark-present')).toBeNull();
  });
});

describe('Page 12b — absent (525:132)', () => {
  it('renders the ABSENT verdict with the negated headline', () => {
    profile({ status: 'absent', checkInAt: null, onTime: null });
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-headline')).toHaveTextContent(
      'aaj aap kaam pai NAHI aaye hai.',
    );
    expect(screen.getByTestId('attendance-verdict')).toHaveTextContent('Aaj ke liye ABSENT!');
    expect(screen.queryByTestId('attendance-mark-present')).toBeNull();
  });
});

describe('month tiles', () => {
  it('shows server totals and the server on-time percentage', () => {
    render(<AttendanceScreen />);
    const tiles = screen.getByTestId('attendance-tiles');
    expect(tiles).toHaveTextContent(/22/);
    expect(tiles).toHaveTextContent(/98%/);
  });

  it('renders a dash rather than 0% when the server has no percentage', () => {
    mockAttendanceState = {
      ...mockAttendanceState,
      data: { ...(mockAttendanceState['data'] as object), onTimePercentage: null },
    };
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-tiles')).toHaveTextContent(/—/);
  });

  it('shows an error for the month without destroying the check-in surface', () => {
    mockAttendanceState = {
      isPending: false,
      isError: true,
      isFetching: false,
      error: { name: 'ApiError' },
      refetch: jest.fn(),
      data: undefined,
    };
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-month-error')).toBeTruthy();
    expect(screen.getByTestId('attendance-present-card')).toBeTruthy();
  });
});

describe('Chutti lagaye block', () => {
  it('states plainly that leave cannot be applied from the app yet', () => {
    render(<AttendanceScreen />);
    expect(screen.getByTestId('attendance-leave-blocked')).toBeTruthy();
  });

  it('still lets the cook open both pickers — navigation is not a mutation', () => {
    render(<AttendanceScreen />);
    expect(
      screen.getByTestId('attendance-leave-single').props.accessibilityState?.disabled,
    ).toBeFalsy();
    expect(
      screen.getByTestId('attendance-leave-range').props.accessibilityState?.disabled,
    ).toBeFalsy();
  });
});

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

  it('keeps Pakka disabled while the backend has no leave write', () => {
    render(<SingleDayLeaveScreen />);
    expect(screen.getByTestId('leave-single-confirm').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('leave-single-blocked')).toBeTruthy();
  });

  it('never claims the leave was applied', () => {
    render(<SingleDayLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-single-confirm'));
    expect(screen.queryByText('Chutti lag gyi')).toBeNull();
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

  it('keeps Pakka disabled even with a valid range', () => {
    render(<RangeLeaveScreen />);
    const days = screen.getAllByTestId(/^leave-range-day-/);
    fireEvent.press(days[0]!);
    fireEvent.press(days[4]!);
    expect(screen.getByTestId('leave-range-confirm').props.accessibilityState.disabled).toBe(true);
  });
});
