import { render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import BootScreen from '@/app/index';
import JobsScreen from '@/app/(tabs)/jobs';
import { jobsV14Fixtures } from '@core/fixtures';
import type { JobCardModel } from '@core/domain/job';

/**
 * An ongoing job owns the app (Sucharita, 2026-10-24; founder, 2026-10-24).
 *
 * Her app lost the service screen after the Start OTP and reopened onto the Kaam list; she never
 * reached the End OTP. Now a signed-in launch opens the ongoing job's stage directly from the boot
 * screen, with no Kaam frame first, and while a job is under way the Kaam tab never shows the list:
 * it opens the job instead.
 */

let mockJobs: readonly JobCardModel[] = [];
let mockFetching = false;
const mockGetCurrentJob = jest.fn();

jest.mock('@core/api/queries', () => ({
  useCookProfile: () => ({
    isPending: false,
    isError: false,
    data: { cook: { name: 'Sucharita' }, today: null, serverTime: '2026-10-24T02:30:00.000Z' },
  }),
  useJobs: () => ({
    isPending: false,
    isError: false,
    isFetching: mockFetching,
    refetch: jest.fn(),
    data: { jobs: mockJobs, serverTime: '2026-10-24T02:30:00.000Z' },
  }),
  useStartCommute: () => ({ mutate: jest.fn(), isPending: false }),
}));

// The screen maps API rows to cards; these tests hand it cards directly.
jest.mock('@core/api/adapters', () => ({ toJobCard: (job: unknown) => job }));

jest.mock('@core/api/cook', () => ({
  ...jest.requireActual('@core/api/cook'),
  getCurrentJob: () => mockGetCurrentJob(),
}));

jest.mock('@core/session/store', () => ({
  useSession: (select: (state: unknown) => unknown) =>
    select({ auth: { kind: 'signed_in' }, restoreComplete: jest.fn() }),
}));

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
};

const notStarted: JobCardModel = { ...base, bookingId: 'booking-later', isInProgress: false };

beforeEach(() => {
  mockFetching = false;
  (router.push as jest.Mock).mockClear();
  (router.replace as jest.Mock).mockClear();
  mockGetCurrentJob.mockReset();
});

describe('launching with a job under way', () => {
  it('opens the ongoing job straight from the boot screen, never Kaam', async () => {
    mockGetCurrentJob.mockResolvedValue({
      bookingId: 'booking-cooking',
      status: 'cooking',
      reassignment: { current: true },
    });
    render(<BootScreen />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/service/[bookingId]',
        params: { bookingId: 'booking-cooking' },
      }),
    );
    expect(router.replace).not.toHaveBeenCalledWith('/jobs');
  });

  it('opens Kaam when nothing is under way', async () => {
    mockGetCurrentJob.mockResolvedValue({
      bookingId: 'booking-later',
      status: 'assigned',
      reassignment: { current: true },
    });
    render(<BootScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/jobs'));
  });

  it('opens Kaam when the read fails', async () => {
    mockGetCurrentJob.mockRejectedValue(new Error('offline'));
    render(<BootScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/jobs'));
  });
});

describe('the Kaam tab while a job is under way', () => {
  it('never shows the list and opens the job, every time', () => {
    mockJobs = [cooking, notStarted];
    const first = render(<JobsScreen />);

    expect(screen.getByTestId('jobs-loading')).toBeTruthy();
    expect(screen.queryByTestId('job-lead-card')).toBeNull();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/service/[bookingId]',
      params: { bookingId: 'booking-cooking' },
    });

    first.unmount();
    render(<JobsScreen />);
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it('waits for a settled read before sending her back to a job', () => {
    mockJobs = [cooking];
    mockFetching = true;
    render(<JobsScreen />);
    expect(screen.getByTestId('jobs-loading')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows the list when nothing is under way', () => {
    mockJobs = [notStarted];
    render(<JobsScreen />);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('jobs-loading')).toBeNull();
  });
});
