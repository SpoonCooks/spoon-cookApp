import { render, screen } from '@testing-library/react-native';

import PastDayScreen from '@/app/money/day/[date]';

/**
 * `15- past daily` (`575:1922`) — the screen that closed `GAP-V12-01`.
 *
 * For a long time this screen refused to render any date but today, because the only way to build
 * a past day in the client was to re-bucket the cycle's raw `events[]` by `createdAt` — which
 * would have shown a base figure the payout does not honour, since reversals are their own signed
 * category. These cases pin the replacement behaviour:
 *
 *   1. A past date renders that day's server breakdown, NOT today's `earnings.daily`.
 *   2. A day the cook did not work is a zeroed day, not an error and not an empty state.
 *   3. The server, not the device clock, decides what a date means — a rejected date surfaces as
 *      the server's error rather than being second-guessed here.
 */

let mockDay: Record<string, unknown>;
let mockEarnings: Record<string, unknown>;
let mockProfile: Record<string, unknown>;
let mockParams: Record<string, string | undefined>;

jest.mock('@core/api/queries', () => ({
  useEarningsDay: () => mockDay,
  useEarnings: () => mockEarnings,
  useCookProfile: () => mockProfile,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

function breakdown(overrides: Record<string, number> = {}) {
  return {
    baseEarningsPaise: 0,
    ratingBonusPaise: 0,
    longHoursEarningsPaise: 0,
    attendanceBonusPaise: 0,
    paidLeaveEarningsPaise: 0,
    tipsPaise: 0,
    lateDeductionsPaise: 0,
    noShowDeductionsPaise: 0,
    otherDeductionsPaise: 0,
    adjustmentsPaise: 0,
    reversalsPaise: 0,
    grossEarningsPaise: 0,
    totalDeductionsPaise: 0,
    netEarningsPaise: 0,
    ...overrides,
  };
}

function day(serviceDate: string, netPaise: number, eventCount = 1) {
  return {
    startDate: serviceDate,
    endDate: serviceDate,
    totalPaise: netPaise,
    eventCount,
    breakdown: breakdown({
      baseEarningsPaise: netPaise,
      grossEarningsPaise: netPaise,
      netEarningsPaise: netPaise,
    }),
  };
}

beforeEach(() => {
  mockParams = { date: '2026-08-18' };
  mockDay = {
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    data: day('2026-08-18', 100_000),
  };
  mockEarnings = {
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    data: {
      totalPaise: 0,
      events: [],
      // Deliberately a DIFFERENT amount from the requested day: if the screen ever fell back to
      // today's window again, this figure would appear instead of the day's.
      daily: {
        startDate: '2026-08-21',
        endDate: '2026-08-21',
        totalPaise: 777_700,
        eventCount: 4,
        breakdown: breakdown({ netEarningsPaise: 777_700 }),
      },
      sevenDay: {
        startDate: '2026-08-15',
        endDate: '2026-08-21',
        totalPaise: 0,
        eventCount: 0,
        breakdown: breakdown(),
      },
      monthly: {
        startDate: '2026-08-01',
        endDate: '2026-08-21',
        totalPaise: 0,
        eventCount: 0,
        breakdown: breakdown(),
      },
      currentCycle: null,
      currentCycleBreakdown: null,
      bonus: {
        available: true,
        reason: null,
        policyVersion: 'v3',
        currentProgressDays: 3,
        thresholdDays: 27,
        targetDays: 28,
        bonusAmountPaise: 100_000,
        targetBonusAmountPaise: 150_000,
        thresholdAchieved: false,
        achieved: false,
      },
    },
  };
  mockProfile = {
    isPending: false,
    isError: false,
    data: {
      cook: {
        id: 'c1',
        name: 'Rekha',
        photoUrl: null,
        status: 'active',
        hub: null,
        rating: { average: 4.7, count: 50 },
      },
      today: { workingDays: [], shift: null, attendance: null, availability: null },
      currentAssignment: null,
      serverTime: '2026-08-21T08:23:00.000Z',
    },
  };
});

describe('15- past daily', () => {
  it('renders a past date from that day’s own breakdown, not today’s', () => {
    render(<PastDayScreen />);
    // The real screen rendered — not the refusal this screen used to show for every past date.
    expect(screen.getByTestId('past-day')).toBeTruthy();
    expect(screen.getByText('18th Aug')).toBeTruthy();
    expect(screen.queryByTestId('day-error')).toBeNull();
    // ₹7,777 is today's window. If the screen ever fell back to it again, this would fail.
    expect(screen.queryByText(/7,?777/)).toBeNull();
  });

  it('renders a zeroed day rather than an error when the cook did not work', () => {
    mockDay = { ...mockDay, data: day('2026-08-18', 0, 0) };
    render(<PastDayScreen />);
    expect(screen.queryByTestId('day-error')).toBeNull();
    expect(screen.queryByTestId('day-loading')).toBeNull();
  });

  it('surfaces the server’s refusal instead of guessing at the date itself', () => {
    mockDay = {
      ...mockDay,
      isError: true,
      error: new Error('nope'),
      data: undefined,
    };
    render(<PastDayScreen />);
    expect(screen.getByTestId('day-error')).toBeTruthy();
  });

  it('shows loading while the day is in flight, never today’s figures', () => {
    mockDay = { ...mockDay, isPending: true, data: undefined };
    render(<PastDayScreen />);
    expect(screen.getByTestId('day-loading')).toBeTruthy();
    expect(screen.queryByText(/7,?777/)).toBeNull();
  });

  it('rejects a malformed date without calling the day endpoint’s result', () => {
    mockParams = { date: '2026-8-1' };
    render(<PastDayScreen />);
    expect(screen.getByText('Din nahi mila.')).toBeTruthy();
  });
});

/**
 * A cook who has never been rated.
 *
 * `cook_profiles.rating_avg` defaults to `0` and `rating_count` to `0`, so every cook's FIRST day
 * arrives at the UI as `{average: 0, count: 0}`. Rendering that verbatim printed `0.0` beside a
 * star — the worst possible score — to someone who had simply never been rated, and captioned it
 * `Last 0 kaam`. These pin the honest rendering instead.
 */
describe('rating with no ratings yet', () => {
  it('shows — rather than 0.0 to an unrated cook', () => {
    mockProfile = {
      ...mockProfile,
      data: {
        ...(mockProfile.data as Record<string, unknown>),
        cook: {
          id: 'c1',
          name: 'Rekha',
          photoUrl: null,
          status: 'active',
          hub: null,
          rating: { average: 0, count: 0 },
        },
      },
    };
    render(<PastDayScreen />);
    expect(screen.queryByText('0.0')).toBeNull();
    expect(screen.getByText('Abhi koi rating nahi')).toBeTruthy();
  });

  it('shows the real average once the cook has been rated', () => {
    render(<PastDayScreen />);
    expect(screen.getByText('4.7')).toBeTruthy();
    expect(screen.getByText('Last 50 kaam')).toBeTruthy();
  });
});
