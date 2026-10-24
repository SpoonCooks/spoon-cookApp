import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import JobsScreen, { resetLaunchResumeForTests } from '@/app/(tabs)/jobs';
import { jobsV14Fixtures } from '@core/fixtures';
import type { JobCardModel } from '@core/domain/job';

/**
 * Back into a job after the app is reopened mid-job (Sucharita, 2026-10-24).
 *
 * The app always launches onto Kaam. A cook whose app was killed while cooking used to see the job
 * on Kaam and never got back to the End OTP. Now the first Kaam load after a launch opens the
 * Active Job screen of a job she is already on, at its current stage, once; after that `CHALO` on
 * the job's card opens the same screen.
 */

let mockJobs: readonly JobCardModel[] = [];

jest.mock('@core/api/queries', () => ({
  useCookProfile: () => ({
    isPending: false,
    isError: false,
    data: { cook: { name: 'Sucharita' }, today: null, serverTime: '2026-10-24T02:30:00.000Z' },
  }),
  useJobs: () => ({
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    data: { jobs: mockJobs, serverTime: '2026-10-24T02:30:00.000Z' },
  }),
  useStartCommute: () => ({ mutate: jest.fn(), isPending: false }),
}));

// The screen maps API rows to cards; these tests hand it cards directly.
jest.mock('@core/api/adapters', () => ({ toJobCard: (job: unknown) => job }));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

const base = jobsV14Fixtures.countdown(20, 'soon').leadJob as JobCardModel;

const cooking: JobCardModel = {
  ...base,
  bookingId: 'booking-cooking',
  isActionable: false,
  isInProgress: true,
  // Past its reach-by time: a countdown card would have gone red here.
  minutesToDeadline: null,
  urgency: 'critical',
};

const notStarted: JobCardModel = {
  ...base,
  bookingId: 'booking-later',
  isInProgress: false,
};

beforeEach(() => {
  resetLaunchResumeForTests();
  (router.push as jest.Mock).mockClear();
});

describe('reopening the app mid-job', () => {
  it('opens the Active Job screen of a job she is already on, once per launch', () => {
    mockJobs = [cooking, notStarted];
    const first = render(<JobsScreen />);

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/service/[bookingId]',
      params: { bookingId: 'booking-cooking' },
    });

    // Back on Kaam later in the same launch: she is not pulled away again.
    first.unmount();
    render(<JobsScreen />);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when no job is under way', () => {
    mockJobs = [notStarted];
    render(<JobsScreen />);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('CHALO on the job she is on opens it again, at its current stage', () => {
    mockJobs = [cooking];
    render(<JobsScreen />);
    (router.push as jest.Mock).mockClear();

    const cta = screen.getByTestId('job-lead-cta');
    expect(cta.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(cta);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/service/[bookingId]',
      params: { bookingId: 'booking-cooking' },
    });
  });
});
