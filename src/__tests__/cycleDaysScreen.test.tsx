import { render, screen } from '@testing-library/react-native';

import CycleDaysScreen from '@/app/money/days';

/**
 * `14- day history` (`575:1903`) — `Cycle ke din`.
 *
 * Opened from `18- past weekly`, this screen was always an error. The past-week screen identifies
 * a week by its start date and passed that date on as a `cycleId`; this screen then asked
 * `/cook/earnings/cycles/:cycleId` for it, a route that only accepts a cycle's UUID, and the
 * server refused. These cases pin the week being read from the WEEK endpoint by its start date,
 * and the live `Kamai` entry — no param — still reading the current seven-day window.
 */

let mockParams: Record<string, string | undefined>;
let mockWeek: Record<string, unknown>;
let mockEarnings: Record<string, unknown>;
let mockProfile: Record<string, unknown>;
const mockUseEarningsWeek = jest.fn();
const mockUseEarnings = jest.fn();

jest.mock('@core/api/queries', () => ({
  useEarningsWeek: (startDate: string, enabled: boolean) => {
    mockUseEarningsWeek(startDate, enabled);
    return mockWeek;
  },
  useEarnings: (enabled: boolean) => {
    mockUseEarnings(enabled);
    return mockEarnings;
  },
  useCookProfile: () => mockProfile,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

const settled = (data: unknown) => ({
  isPending: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  data,
});

beforeEach(() => {
  mockUseEarningsWeek.mockClear();
  mockUseEarnings.mockClear();
  mockProfile = settled({ serverTime: '2026-09-28T09:00:00.000Z' });
  mockWeek = settled({ startDate: '2026-07-11', endDate: '2026-07-17' });
  mockEarnings = settled({ sevenDay: { startDate: '2026-09-22', endDate: '2026-09-28' } });
});

describe('Cycle ke din', () => {
  it('lists a past week read by its start date from the week endpoint', () => {
    mockParams = { weekStart: '2026-07-11' };
    render(<CycleDaysScreen />);

    expect(mockUseEarningsWeek).toHaveBeenCalledWith('2026-07-11', true);
    expect(mockUseEarnings).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('day-history')).toBeTruthy();
    // Newest first, all seven days of the week.
    expect(screen.getByTestId('day-2026-07-17')).toBeTruthy();
    expect(screen.getByTestId('day-2026-07-11')).toBeTruthy();
    expect(screen.queryByTestId('days-error')).toBeNull();
  });

  it('reads the live seven-day window when opened from Kamai with no week', () => {
    mockParams = {};
    render(<CycleDaysScreen />);

    expect(mockUseEarningsWeek).toHaveBeenCalledWith('', false);
    expect(mockUseEarnings).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('day-2026-09-28')).toBeTruthy();
    expect(screen.getByTestId('day-2026-09-22')).toBeTruthy();
  });

  it('shows the server error for the week rather than an empty list', () => {
    mockParams = { weekStart: '2026-07-11' };
    mockWeek = {
      isPending: false,
      isError: true,
      error: new Error('boom'),
      refetch: jest.fn(),
      data: undefined,
    };
    render(<CycleDaysScreen />);

    expect(screen.getByTestId('days-error')).toBeTruthy();
  });
});
