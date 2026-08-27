import { fireEvent, render, screen } from '@testing-library/react-native';

import ChuttiScreen from '@/app/(tabs)/chutti';
import RangeLeaveScreen from '@/app/leave/range';
import SingleDayLeaveScreen from '@/app/leave/single';
import {
  breakDurationLabel,
  formatDayLabel,
  longLeaveCard,
  singleDayOptions,
  type LeaveRecord,
} from '@features/leave/leaveModel';

/**
 * `leave` section (`540:416`) render tests.
 *
 * These mount the real screens and assert the state SELECTION and the command behaviour. The
 * pixels are verified on the device instead — `docs/visual-verification/v13/leave/` — and neither
 * check substitutes for the other.
 *
 * The guarantee this file exists to defend: a leave a cook files is a REQUEST. Ops/Admin decide.
 * No screen may render a pending request as `Chutti lag gyi`, and nothing may be marked locally.
 */

const mockLeaveMutate = jest.fn();
let mockProfileState: Record<string, unknown>;
let mockLeavesState: Record<string, unknown>;
let mockRequestLeaveState: Record<string, unknown>;

jest.mock('@core/api/queries', () => ({
  useCookProfile: () => mockProfileState,
  useLeaves: () => mockLeavesState,
  useRequestLeave: () => mockRequestLeaveState,
}));

jest.mock('expo-router', () => ({
  // Created inside the factory: jest hoists `jest.mock` above every `const` in the file, so a
  // module-scope `jest.fn()` would still be in its temporal dead zone when the factory runs and
  // `router.push` would land as `undefined`.
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockRouteParams,
}));

const mockPush = (jest.requireMock('expo-router') as { router: { push: jest.Mock } }).router.push;

let mockRouteParams: Record<string, string> = {};

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

/** `2026-11-06` is the server's service date throughout, so every day label is deterministic. */
function profile(attendanceStatus: string | null): void {
  mockProfileState = {
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
    data: {
      cook: { id: 'c1', name: 'Rekha', photoUrl: null, status: 'active', hub: null, rating: null },
      today: {
        workingDays: [1, 2, 3, 4, 5],
        shift: shift(),
        attendance:
          attendanceStatus === null
            ? null
            : { status: attendanceStatus, checkInAt: null, onTime: null },
        canCheckIn: attendanceStatus === null,
        checkInOpensAt: null,
        shiftStartsAt: null,
        checkedInAt: null,
        reason: 'READY',
        availability: null,
      },
      currentAssignment: null,
      serverTime: '2026-11-06T08:23:00.000Z',
    },
  };
}

function withLeaves(leaves: readonly Record<string, unknown>[]): void {
  mockLeavesState = {
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
    data: { leaves, fromDate: '2026-11-01', toDate: '2026-11-30', timezone: 'Asia/Kolkata' },
  };
}

beforeEach(() => {
  mockLeaveMutate.mockClear();
  mockPush.mockClear();
  mockRouteParams = {};
  profile(null);
  withLeaves([]);
  mockRequestLeaveState = {
    mutate: mockLeaveMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  };
});

describe('592:488 / 592:489 — the CHUTTI destination', () => {
  it('draws AAJ KA BREAK with the server shift window when the cook is present', () => {
    profile('present');
    render(<ChuttiScreen />);
    expect(screen.getByTestId('chutti-break-duration')).toHaveTextContent('Duration: 2 hrs');
    expect(screen.getByTestId('chutti-break-from')).toHaveTextContent('12:15 PM');
    expect(screen.getByTestId('chutti-break-to')).toHaveTextContent('2:15 PM');
  });

  it('draws no break panel when the cook is not present today', () => {
    render(<ChuttiScreen />);
    expect(screen.queryByTestId('chutti-break-card')).toBeNull();
  });

  it('offers today first when the cook is not present, and tomorrow when they are', () => {
    render(<ChuttiScreen />);
    expect(screen.getByTestId('chutti-day-state-2026-11-06')).toHaveTextContent('Aaj');

    screen.unmount();
    profile('present');
    render(<ChuttiScreen />);
    expect(screen.queryByTestId('chutti-day-2026-11-06')).toBeNull();
    expect(screen.getByTestId('chutti-day-state-2026-11-07')).toHaveTextContent('Kal');
  });

  it('opens the confirm sheet for the day that was tapped', () => {
    render(<ChuttiScreen />);
    fireEvent.press(screen.getByTestId('chutti-day-2026-11-07'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/leave/single',
      params: { date: '2026-11-07' },
    });
  });

  it('never renders a PENDING request as granted', () => {
    withLeaves([
      { leaveId: 'l1', startDate: '2026-11-06', endDate: '2026-11-06', status: 'pending' },
    ]);
    render(<ChuttiScreen />);
    const state = screen.getByTestId('chutti-day-state-2026-11-06');
    expect(state).toHaveTextContent('Manager approve karenge');
    expect(state).not.toHaveTextContent('Chutti lag gyi');
  });

  it('renders an APPROVED day as booked, with the tick the frame draws', () => {
    withLeaves([
      { leaveId: 'l1', startDate: '2026-11-06', endDate: '2026-11-06', status: 'approved' },
    ]);
    render(<ChuttiScreen />);
    expect(screen.getByTestId('chutti-day-state-2026-11-06')).toHaveTextContent('Chutti lag gyi');
    expect(screen.getByTestId('chutti-day-tick-2026-11-06')).toBeTruthy();
  });

  it('relabels the long-leave entry and prints the range once one is booked', () => {
    withLeaves([
      { leaveId: 'l2', startDate: '2026-11-16', endDate: '2026-11-25', status: 'approved' },
    ]);
    render(<ChuttiScreen />);
    expect(screen.getByTestId('chutti-long-label')).toHaveTextContent('Dates badle');
    expect(screen.getByTestId('chutti-upcoming')).toHaveTextContent('16 Nov se 25 Nov tak');
  });

  it('says Dates chunein when nothing is booked', () => {
    render(<ChuttiScreen />);
    expect(screen.getByTestId('chutti-long-label')).toHaveTextContent('Dates chunein');
    expect(screen.queryByTestId('chutti-upcoming')).toBeNull();
  });
});

describe('592:888 — the 1 din ki Chutti sheet', () => {
  it('confirms the day it was opened with', () => {
    mockRouteParams = { date: '2026-11-08' };
    render(<SingleDayLeaveScreen />);
    expect(screen.getByTestId('leave-single-day')).toHaveTextContent('8 November');
    expect(screen.getByTestId('leave-single-relative')).toHaveTextContent('Parso');
  });

  it('submits the chosen day as a one-day range with an idempotency key', () => {
    mockRouteParams = { date: '2026-11-08' };
    render(<SingleDayLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-single-confirm'));
    expect(mockLeaveMutate).toHaveBeenCalledTimes(1);
    const args = mockLeaveMutate.mock.calls[0]?.[0] as Record<string, string>;
    expect(args['startDateIso']).toBe('2026-11-08');
    expect(args['endDateIso']).toBe('2026-11-08');
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
    expect(screen.getByTestId('leave-single-notice')).toHaveTextContent(
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
    // The failure is surfaced and the button stays live: a failed submission is retryable, and
    // nothing about the leave is shown as having happened.
    expect(screen.getByTestId('leave-single-notice')).toBeTruthy();
    expect(screen.queryByText('Chutti ki request bhej di. Manager approve karenge.')).toBeNull();
  });

  it('refuses a day in the past instead of spending the request', () => {
    mockRouteParams = { date: '2026-11-01' };
    render(<SingleDayLeaveScreen />);
    expect(screen.getByTestId('leave-single-notice')).toHaveTextContent(
      'Guzre hue din ki chutti nahi lag sakti.',
    );
    fireEvent.press(screen.getByTestId('leave-single-confirm'));
    expect(mockLeaveMutate).not.toHaveBeenCalled();
  });
});

describe('592:563 / 592:639 — the Lambi Chutti sheet', () => {
  it('opens on the server month with nothing chosen and Pakka held back', () => {
    render(<RangeLeaveScreen />);
    expect(screen.getByTestId('leave-calendar-month')).toHaveTextContent('November');
    expect(screen.getByTestId('leave-range-total-value')).toHaveTextContent('0');
    expect(screen.getByTestId('leave-range-confirm').props.accessibilityState.disabled).toBe(true);
  });

  it('closes an inclusive range across two taps and counts it', () => {
    render(<RangeLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-calendar-day-16'));
    fireEvent.press(screen.getByTestId('leave-calendar-day-25'));
    expect(screen.getByTestId('leave-range-total-value')).toHaveTextContent('10');
  });

  it('keeps growing the range when days are tapped one by one', () => {
    // The regression this guards: a third tap used to throw the selection away, so a cook tapping
    // consecutive days could never choose more than two.
    render(<RangeLeaveScreen />);
    for (const day of [16, 17, 18, 19]) {
      fireEvent.press(screen.getByTestId(`leave-calendar-day-${day}`));
    }
    expect(screen.getByTestId('leave-range-total-value')).toHaveTextContent('4');
  });

  it('extends a closed range backwards when an earlier open day is tapped', () => {
    render(<RangeLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-calendar-day-16'));
    fireEvent.press(screen.getByTestId('leave-calendar-day-18'));
    fireEvent.press(screen.getByTestId('leave-calendar-day-10'));
    expect(screen.getByTestId('leave-range-total-value')).toHaveTextContent('9');
  });

  it('starts over when a day inside the closed range is tapped', () => {
    render(<RangeLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-calendar-day-16'));
    fireEvent.press(screen.getByTestId('leave-calendar-day-25'));
    fireEvent.press(screen.getByTestId('leave-calendar-day-20'));
    expect(screen.getByTestId('leave-range-total-value')).toHaveTextContent('1');
  });

  it('marks the two endpoints and everything between them as chosen', () => {
    render(<RangeLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-calendar-day-16'));
    fireEvent.press(screen.getByTestId('leave-calendar-day-25'));
    for (const day of [16, 20, 25]) {
      expect(
        screen.getByTestId(`leave-calendar-day-${day}`).props.accessibilityState.selected,
      ).toBe(true);
    }
    expect(screen.getByTestId('leave-calendar-day-26').props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('does not offer a day before the server service date', () => {
    render(<RangeLeaveScreen />);
    expect(screen.getByTestId('leave-calendar-day-5').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('leave-calendar-day-6').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('never draws a day the month does not have', () => {
    // `592:563` and `592:639` both paint a 31 November. The grid is built from the real month, so
    // that cell is empty here. See `LeaveCalendar`.
    render(<RangeLeaveScreen />);
    expect(screen.getByTestId('leave-calendar-day-30')).toBeTruthy();
    expect(screen.queryByTestId('leave-calendar-day-31')).toBeNull();
  });

  it('submits the whole range as ONE request', () => {
    render(<RangeLeaveScreen />);
    fireEvent.press(screen.getByTestId('leave-calendar-day-16'));
    fireEvent.press(screen.getByTestId('leave-calendar-day-25'));
    fireEvent.press(screen.getByTestId('leave-range-confirm'));
    expect(mockLeaveMutate).toHaveBeenCalledTimes(1);
    const args = mockLeaveMutate.mock.calls[0]?.[0] as Record<string, string>;
    expect(args['startDateIso']).toBe('2026-11-16');
    expect(args['endDateIso']).toBe('2026-11-25');
  });

  it('says the request was sent, never that the chutti was granted', () => {
    mockRequestLeaveState = { ...mockRequestLeaveState, isSuccess: true };
    render(<RangeLeaveScreen />);
    expect(screen.getByTestId('leave-range-notice')).toHaveTextContent(
      'Chutti ki request bhej di. Manager approve karenge.',
    );
  });
});

describe('leaveModel', () => {
  const record = (start: string, end: string, status: string): LeaveRecord => ({
    leaveId: `${start}-${end}`,
    startDate: start,
    endDate: end,
    status,
  });

  it('formats a day the way the frames write it', () => {
    expect(formatDayLabel('2026-11-07')).toBe('7 November');
  });

  it('steps the first offered day forward when today is already marked present', () => {
    expect(singleDayOptions('2026-11-06', false, [])[0]?.dateIso).toBe('2026-11-06');
    expect(singleDayOptions('2026-11-06', true, [])[0]?.dateIso).toBe('2026-11-07');
  });

  it('treats an unrecognised status as undecided rather than as approved', () => {
    const [first] = singleDayOptions('2026-11-06', false, [
      record('2026-11-06', '2026-11-06', 'in_review'),
    ]);
    expect(first?.relativeLabel).toBe('Manager approve karenge');
  });

  it('does not show a rejected or cancelled range as upcoming leave', () => {
    expect(longLeaveCard('2026-11-06', [record('2026-11-16', '2026-11-25', 'rejected')])).toEqual({
      label: 'Dates chunein',
      upcoming: null,
    });
    expect(longLeaveCard('2026-11-06', [record('2026-11-16', '2026-11-25', 'pending')])).toEqual({
      label: 'Dates badle',
      upcoming: '16 Nov se 25 Nov tak',
    });
  });

  it('ignores a range that has already finished', () => {
    expect(longLeaveCard('2026-11-06', [record('2026-10-01', '2026-10-05', 'approved')])).toEqual({
      label: 'Dates chunein',
      upcoming: null,
    });
  });

  it('states a break duration in the shape the frame prints', () => {
    expect(breakDurationLabel('12:15:00', '14:15:00')).toBe('2 hrs');
    expect(breakDurationLabel('12:15:00', '13:45:00')).toBe('1.5 hrs');
    expect(breakDurationLabel('14:15:00', '12:15:00')).toBe('—');
  });
});
