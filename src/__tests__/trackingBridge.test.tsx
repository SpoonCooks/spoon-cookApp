import { render } from '@testing-library/react-native';

import { TrackingBridge } from '@core/location/TrackingBridge';

/**
 * Reconstructing travel tracking from backend state.
 *
 * ## The blocker this closes
 *
 * Tracking used to be owned by the service screen's effect. That made the native location task a
 * property of a MOUNTED REACT SCREEN, which is exactly what it must not be: Android kills
 * backgrounded apps, and a cook who was killed mid-travel came back to a booking the backend still
 * called `cook_en_route` with no location task running and nothing to restart it. Start Travel had
 * reported success; the samples had simply stopped.
 *
 * The bridge moves that decision to the app root and derives it from the authenticated
 * current-job projection instead of from navigation. Restart, process kill, notification tap and
 * Android Back all converge on the same answer because they all end up re-reading the same
 * projection.
 *
 * ## Why the stale-assignment case is here
 *
 * `reassignment.current` is the server's statement that THIS cook still holds the assignment. A
 * replaced cook's app can still hold a valid session and a cached booking id, and must not resume
 * uploading positions for a job somebody else is now driving to.
 */

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockSetAppState = jest.fn();
const mockRefetch = jest.fn();

let mockCurrentJobResult: {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  refetch: typeof mockRefetch;
};

jest.mock('@core/location/tracker', () => ({
  locationTracker: {
    start: (...args: unknown[]) => mockStart(...args),
    stop: () => mockStop(),
    setAppState: (...args: unknown[]) => mockSetAppState(...args),
  },
}));

jest.mock('@core/api/queries', () => ({
  useCurrentJob: () => mockCurrentJobResult,
}));

let mockSignedIn = true;
jest.mock('@core/session/store', () => ({
  useSession: () => mockSignedIn,
  selectIsSignedIn: () => mockSignedIn,
}));

function job(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    bookingId: 'booking-1',
    assignmentVersion: 3,
    status: 'cook_en_route',
    reassignment: { current: true },
    ...overrides,
  };
}

function mount(data: unknown, flags: { isPending?: boolean; isError?: boolean } = {}): void {
  mockCurrentJobResult = {
    data,
    isPending: flags.isPending ?? false,
    isError: flags.isError ?? false,
    refetch: mockRefetch,
  };
  render(<TrackingBridge />);
}

beforeEach(() => {
  mockStart.mockClear();
  mockStop.mockClear();
  mockSetAppState.mockClear();
  mockRefetch.mockClear();
  mockSignedIn = true;
});

describe('tracking is reconstructed from backend state, not from navigation', () => {
  it('starts tracking for a travelling job with no screen mounted', () => {
    // The restart case: nothing has been navigated to, the projection alone says the cook is
    // en route, and the native task comes back on its own.
    mount(job());

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart.mock.calls[0]?.[0]).toEqual({ bookingId: 'booking-1', assignmentVersion: 3 });
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('refuses to resume a job this cook no longer holds', () => {
    // Reassigned away. A cached booking id and a live session are not entitlement.
    mount(job({ reassignment: { current: false } }));

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });

  it.each(['assigned', 'cook_arrived', 'cooking', 'completed', 'cancelled'])(
    'does not track a booking in %s',
    (status) => {
      mount(job({ status }));

      expect(mockStart).not.toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
    },
  );

  it('stops tracking when there is no current job at all', () => {
    mount(null);

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });

  it('stops tracking when the session ends', () => {
    mockSignedIn = false;
    mount(job());

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });

  it('leaves a running task alone while the projection is merely unread', () => {
    // A transient read failure is not a terminal answer. Stopping here would kill tracking for a
    // cook who is still driving, because their phone lost signal for one poll.
    mount(undefined, { isError: true });

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('leaves a running task alone while the first read is still in flight', () => {
    mount(undefined, { isPending: true });

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).not.toHaveBeenCalled();
  });
});
