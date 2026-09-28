import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import PastCycleScreen from '@/app/money/cycle/[cycleId]';

/**
 * `18- past weekly` (`575:2098`) — the `Cycle ke din` link.
 *
 * The route param here is a week's START DATE, not a payout-cycle id. It used to be handed on to
 * `Cycle ke din` as `cycleId`, which that screen sent to `/cook/earnings/cycles/:cycleId` — a route
 * that only accepts a UUID — so the link opened on an error for every past week. It must travel as
 * `weekStart`.
 */

const mockParams = { cycleId: '2026-07-11' };

const settled = (data: unknown) => ({
  isPending: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  data,
});

const breakdown = {
  baseEarningsPaise: 850_000,
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
  grossEarningsPaise: 850_000,
  totalDeductionsPaise: 0,
  netEarningsPaise: 850_000,
};

jest.mock('@core/api/queries', () => ({
  useEarningsWeek: () =>
    settled({
      startDate: '2026-07-11',
      endDate: '2026-07-17',
      current: false,
      totalPaise: 850_000,
      breakdown,
    }),
  useAttendanceRange: () => settled([]),
  useCookProfile: () => settled({ cook: { rating: { average: 4.7, count: 50 } } }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

describe('past week', () => {
  it('opens Cycle ke din for this week by its start date, never as a cycle id', () => {
    render(<PastCycleScreen />);
    fireEvent.press(screen.getByTestId('past-cycle-days'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/money/days',
      params: { weekStart: '2026-07-11' },
    });
  });
});
