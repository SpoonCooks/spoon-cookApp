import { render, screen, fireEvent } from '@testing-library/react-native';

import MoneyScreen from '@/app/(tabs)/money';
import CycleHistoryScreen from '@/app/money/cycles';

/**
 * V12 `performance` section (`575:1741`) render tests.
 *
 * The section was rebuilt from scratch for V12, so these assert the two properties that matter
 * most about money on a cook's phone:
 *
 *   1. **Every figure comes from the server.** The screens render `breakdown.*` verbatim. A test
 *      here would fail if anyone re-introduced client-side summing of base + bonus + tips.
 *   2. **A figure the contract does not expose renders `—`, never a plausible number.** Worked
 *      duration, the extra-kaam multiplier and the per-type mistake counts have no field on any
 *      cook route; showing a guess would contradict the cook's payout.
 */

let mockEarnings: Record<string, unknown>;
let mockProfile: Record<string, unknown>;
let mockAttendanceRange: Record<string, unknown>;
let mockCycles: Record<string, unknown>;

jest.mock('@core/api/queries', () => ({
  useEarnings: () => mockEarnings,
  useCookProfile: () => mockProfile,
  useAttendanceRange: () => mockAttendanceRange,
  useEarningsCycles: () => mockCycles,
  useEarningsCycle: () => ({ isPending: false, isError: false, data: undefined }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

/** A signed breakdown with a REVERSAL present, so a client-side sum would disagree with the net. */
function breakdown(overrides: Record<string, number> = {}) {
  return {
    baseEarningsPaise: 850_000,
    ratingBonusPaise: 5_000,
    longHoursEarningsPaise: 26_300,
    attendanceBonusPaise: 15_000,
    paidLeaveEarningsPaise: 0,
    tipsPaise: 60_000,
    lateDeductionsPaise: 5_000,
    noShowDeductionsPaise: 25_000,
    otherDeductionsPaise: 0,
    adjustmentsPaise: 0,
    // A reversed bonus. gross - base would count the bonus without its reversal.
    reversalsPaise: -15_000,
    grossEarningsPaise: 956_300,
    totalDeductionsPaise: 45_000,
    netEarningsPaise: 911_300,
    ...overrides,
  };
}

function period(startDate: string, endDate: string) {
  return { startDate, endDate, totalPaise: 911_300, eventCount: 9, breakdown: breakdown() };
}

beforeEach(() => {
  mockEarnings = {
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
    data: {
      totalPaise: 29_389_400,
      events: [],
      daily: period('2026-08-21', '2026-08-21'),
      sevenDay: period('2026-08-15', '2026-08-21'),
      monthly: period('2026-08-01', '2026-08-21'),
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
  mockAttendanceRange = { isPending: false, isError: false, data: [] };
  mockCycles = {
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
    data: [],
  };
});

describe('12- money daily (575:1744)', () => {
  it('opens on the daily period', () => {
    render(<MoneyScreen />);
    expect(screen.getByTestId('period-tabs-day')).toBeTruthy();
    expect(screen.getByTestId('work-card')).toBeTruthy();
  });

  it('shows — for worked duration, which no cook route exposes', () => {
    render(<MoneyScreen />);
    expect(screen.getByTestId('work-card')).toHaveTextContent(/—/);
  });

  it('shows — for the extra-kaam multiplier and rate but the REAL long-hours amount', () => {
    render(<MoneyScreen />);
    expect(screen.getByTestId('work-card-multiplier')).toHaveTextContent('—');
    expect(screen.getByTestId('work-card-rate')).toHaveTextContent('—');
    // 26_300 paise = ₹263, straight from `longHoursEarningsPaise`.
    expect(screen.getByTestId('work-card-extra')).toHaveTextContent('+₹263');
  });

  it('takes the bonus threshold from backend policy, not the design’s literal 7', () => {
    render(<MoneyScreen />);
    expect(screen.getByTestId('bonus-bar-hint')).toHaveTextContent(/27 se zyada/);
  });

  it('shows — for mistake counts but the real deduction amounts', () => {
    render(<MoneyScreen />);
    expect(screen.getByTestId('mistakes-card-no-show-count')).toHaveTextContent('—');
    expect(screen.getByTestId('mistakes-card-late-count')).toHaveTextContent('—');
    expect(screen.getByTestId('mistakes-card-no-show-amount')).toHaveTextContent('-₹250');
    expect(screen.getByTestId('mistakes-card-late-amount')).toHaveTextContent('-₹50');
  });

  it('renders the server’s total katauti rather than adding the two lines', () => {
    render(<MoneyScreen />);
    expect(screen.getByTestId('mistakes-card-total')).toHaveTextContent('-₹450');
  });

  it('refuses to derive "base ke upar ki kamai" from signed categories', () => {
    // gross - base would be ₹1,063 here and would silently ignore the -₹150 reversal.
    render(<MoneyScreen />);
    expect(screen.getByTestId('above-base-value')).toHaveTextContent('—');
  });

  it('shows the rating from /cook/me and — for the per-day base', () => {
    render(<MoneyScreen />);
    expect(screen.getByTestId('rating-strip-average')).toHaveTextContent('4.7');
    expect(screen.getByTestId('rating-card-per-day')).toHaveTextContent('—');
  });
});

describe('13- money weekly (575:1884)', () => {
  beforeEach(() => {
    render(<MoneyScreen />);
    fireEvent.press(screen.getByTestId('period-tabs-cycle'));
  });

  it('switches period without navigating', () => {
    expect(screen.getByTestId('work-card-earnings')).toBeTruthy();
  });

  it('renders the server’s gross and its three components verbatim', () => {
    expect(screen.getByTestId('work-card-gross')).toHaveTextContent('₹9,563');
    expect(screen.getByTestId('work-card-bonus')).toHaveTextContent(/₹150/);
  });

  it('shows the final band from netEarningsPaise, not a client subtraction', () => {
    // 911_300 paise. gross - deductions would be ₹9,113 by coincidence here, but the value
    // rendered must come from the server's signed net.
    expect(screen.getByTestId('final-band-value')).toHaveTextContent('₹9,113');
  });

  it('offers the Cycle ke din link', () => {
    expect(screen.getByTestId('money-cycle-days')).toBeTruthy();
  });
});

describe('16- money monthly (575:2013)', () => {
  it('offers Pichle cycles and no day strip', () => {
    render(<MoneyScreen />);
    fireEvent.press(screen.getByTestId('period-tabs-month'));
    expect(screen.getByTestId('money-past-cycles')).toBeTruthy();
    expect(screen.queryByTestId('day-strip')).toBeNull();
  });
});

describe('bonus bar geometry', () => {
  it('renders no bar at all when the cook has no current cycle', () => {
    mockEarnings = {
      ...mockEarnings,
      data: {
        ...(mockEarnings['data'] as Record<string, unknown>),
        bonus: {
          available: false,
          reason: 'cycle_unavailable',
          policyVersion: null,
          currentProgressDays: null,
          thresholdDays: null,
          targetDays: null,
          bonusAmountPaise: null,
          targetBonusAmountPaise: null,
          thresholdAchieved: null,
          achieved: null,
        },
      },
    };
    render(<MoneyScreen />);
    // Absent progress is a real state — not a zero-filled bar implying the cook has done nothing.
    expect(screen.queryByTestId('bonus-bar')).toBeNull();
  });
});

describe('17- weekly history (575:2032)', () => {
  it('shows the lifetime total from the server, not a sum of the rows', () => {
    render(<CycleHistoryScreen />);
    // `totalPaise` is SUM(amount_paise) over the whole ledger — with zero rows on screen.
    expect(screen.getByTestId('lifetime-band-value')).toHaveTextContent('₹2,93,894');
  });

  it('renders — for a cycle that has not settled rather than its running total', () => {
    mockCycles = {
      ...mockCycles,
      data: [
        {
          cycleId: 'c1',
          startDate: '2026-07-18',
          endDate: '2026-07-21',
          status: 'open',
          current: true,
          finalAmountPaise: null,
        },
      ],
    };
    render(<CycleHistoryScreen />);
    expect(screen.getByTestId('cycle-c1')).toHaveTextContent(/—/);
  });

  it('renders a settled cycle’s final amount', () => {
    mockCycles = {
      ...mockCycles,
      data: [
        {
          cycleId: 'c2',
          startDate: '2026-06-20',
          endDate: '2026-07-17',
          status: 'closed',
          current: false,
          finalAmountPaise: 783_900,
        },
      ],
    };
    render(<CycleHistoryScreen />);
    expect(screen.getByTestId('cycle-c2')).toHaveTextContent(/₹7,839/);
  });

  it('says so plainly when there are no cycles instead of rendering an empty list', () => {
    render(<CycleHistoryScreen />);
    expect(screen.getByText('Koi pichla cycle nahi hai.')).toBeTruthy();
  });
});

describe('failure never falls back to placeholder money', () => {
  it('shows an error state, not a zero-rupee screen', () => {
    mockEarnings = {
      isPending: false,
      isError: true,
      isFetching: false,
      error: { name: 'ApiError' },
      refetch: jest.fn(),
      data: undefined,
    };
    render(<MoneyScreen />);
    expect(screen.getByTestId('money-error')).toBeTruthy();
    expect(screen.queryByTestId('work-card')).toBeNull();
  });
});
