import { render, screen, fireEvent } from '@testing-library/react-native';

import ServiceScreen from '@/app/service/[bookingId]';

/**
 * Service-flow wiring.
 *
 * The screen used to be fixture-driven with stubbed OTP handlers. These tests lock in what
 * replaced it — the properties that decide whether a cook is told the truth about a live job:
 *
 *   1. the rendered state comes from `GET /v1/cook/jobs/:id`, never from which button was pressed
 *   2. an OTP submit raises a command and does NOT advance the screen on its own
 *   3. location reporting runs for `cook_en_route` and for nothing else
 *   4. opening the arrival screen does not mark arrival
 */

const mockStartOtp = jest.fn();
const mockEndOtp = jest.fn();
const mockArrive = jest.fn();
const mockStartTravel = jest.fn();
const mockTrackerPrepare = jest.fn(async (_target: unknown) => ({ status: 'ready' }));
const mockTrackerActivate = jest.fn(async (_target: unknown) => ({ status: 'reporting' }));
const mockTrackerStop = jest.fn();
const mockRefetch = jest.fn();

let mockJob: Record<string, unknown>;

jest.mock('@core/api/queries', () => ({
  useJob: () => mockJob,
  useVerifyStartOtp: () => ({ mutate: mockStartOtp, isPending: false }),
  useVerifyEndOtp: () => ({ mutate: mockEndOtp, isPending: false }),
  useMarkArrived: () => ({ mutate: mockArrive, isPending: false }),
  useStartCommute: () => ({ mutate: mockStartTravel, isPending: false }),
}));

jest.mock('@core/location/tracker', () => ({
  locationTracker: {
    prepare: (target: unknown) => mockTrackerPrepare(target),
    activate: (target: unknown) => mockTrackerActivate(target),
    stop: () => mockTrackerStop(),
  },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ bookingId: 'b1' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

/** A `CookJobResponse` in the shape `cookJobSchema` validates. */
function jobResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    bookingId: 'b1',
    assignmentId: 'a1',
    assignmentVersion: 3,
    status: 'cook_en_route',
    assignmentStatus: 'active',
    serviceStart: '2026-08-21T11:50:00.000Z',
    durationMinutes: 90,
    travelStartedAt: '2026-08-21T11:20:00.000Z',
    serviceStartedAt: null,
    currentExpectedEnd: null,
    timer: {
      serviceStartedAt: null,
      expectedEnd: null,
      remainingSeconds: null,
      tenMinuteState: 'not_started',
    },
    actualEnd: null,
    arrivedAt: null,
    timing: {
      customerCommitmentAt: '2026-08-21T11:50:00.000Z',
      eta: null,
      etaUpdatedAt: null,
      verdict: null,
      riskState: 'TRAVEL_ON_TIME',
    },
    destination: {
      latitude: 28.4595,
      longitude: 77.0266,
      label: 'Society gate',
      flat: '302',
      tower: 'Tower 1',
      society: 'Building/ Society',
      street: 'Main road',
      pincode: '122001',
      city: 'Gurugram',
      state: 'HR',
    },
    extension: { state: null, minutes: null, expectedEnd: null },
    otpEligibility: { start: false, end: false },
    reassignment: { assignmentVersion: 3, current: true },
    serverTime: '2026-08-21T11:24:00.000Z',
    ...overrides,
  };
}

function setJob(overrides: Record<string, unknown> = {}): void {
  mockJob = {
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: mockRefetch,
    dataUpdatedAt: 1_700_000_000_000,
    data: jobResponse(overrides),
  };
}

beforeEach(() => {
  mockStartOtp.mockClear();
  mockEndOtp.mockClear();
  mockArrive.mockClear();
  mockStartTravel.mockClear();
  mockTrackerPrepare.mockClear();
  mockTrackerActivate.mockClear();
  mockTrackerStop.mockClear();
  mockRefetch.mockClear();
  setJob();
});

describe('the projection decides the screen', () => {
  it('renders travel for cook_en_route', () => {
    render(<ServiceScreen />);
    expect(screen.getByTestId('service-travel-on_time')).toBeTruthy();
  });

  it('separates at-risk from late rather than collapsing them', () => {
    setJob({
      timing: {
        customerCommitmentAt: '2026-08-21T11:20:00.000Z',
        eta: null,
        etaUpdatedAt: null,
        verdict: null,
        riskState: 'TRAVEL_LATE',
      },
    });
    render(<ServiceScreen />);
    expect(screen.getByTestId('service-travel-late')).toBeTruthy();
  });

  it('renders arrival for cook_arrived without OTP eligibility', () => {
    setJob({ status: 'cook_arrived' });
    render(<ServiceScreen />);
    expect(screen.getByTestId('service-arrival-on_time')).toBeTruthy();
  });

  it('renders the Start OTP screen only when the SERVER says it is eligible', () => {
    setJob({ status: 'cook_arrived', otpEligibility: { start: true, end: false } });
    render(<ServiceScreen />);
    expect(screen.getByTestId('service-start-otp')).toBeTruthy();
  });

  it('renders interrupted for a cancelled booking rather than a live service screen', () => {
    setJob({ status: 'cancelled' });
    render(<ServiceScreen />);
    expect(screen.queryByTestId('service-travel-on_time')).toBeNull();
  });

  it('shows an error rather than placeholder progress when the read fails', () => {
    mockJob = {
      isPending: false,
      isError: true,
      isFetching: false,
      error: { name: 'ApiError' },
      refetch: mockRefetch,
      dataUpdatedAt: 0,
      data: undefined,
    };
    render(<ServiceScreen />);
    expect(screen.getByTestId('service-error')).toBeTruthy();
  });
});

describe('commands do not advance state locally', () => {
  it('sends the Start OTP with the assignment version and an idempotency key', () => {
    setJob({ status: 'cook_arrived', otpEligibility: { start: true, end: false } });
    render(<ServiceScreen />);
    // The submit stays disabled until three digits are present, so type the code first.
    fireEvent.changeText(screen.getByTestId('start-otp-input-field'), '482');
    fireEvent.press(screen.getByTestId('start-otp-submit'));
    expect(mockStartOtp).toHaveBeenCalledTimes(1);
    expect(mockStartOtp.mock.calls[0]?.[0]).toMatchObject({
      bookingId: 'b1',
      assignmentVersion: 3,
      idempotencyKey: expect.any(String),
    });
  });

  it('stays on the Start OTP screen after submitting — only a re-read may move it', () => {
    setJob({ status: 'cook_arrived', otpEligibility: { start: true, end: false } });
    render(<ServiceScreen />);
    fireEvent.changeText(screen.getByTestId('start-otp-input-field'), '482');
    fireEvent.press(screen.getByTestId('start-otp-submit'));
    expect(screen.getByTestId('service-start-otp')).toBeTruthy();
  });

  it('reuses ONE idempotency key across End-OTP retries', () => {
    setJob({
      status: 'cooking',
      otpEligibility: { start: false, end: true },
      timer: {
        serviceStartedAt: '2026-08-21T12:00:00.000Z',
        expectedEnd: '2026-08-21T13:30:00.000Z',
        remainingSeconds: 0,
        tenMinuteState: 'normal',
      },
    });
    render(<ServiceScreen />);
    fireEvent.changeText(screen.getByTestId('end-otp-input-field'), '731');
    fireEvent.press(screen.getByTestId('end-otp-submit'));
    fireEvent.press(screen.getByTestId('end-otp-submit'));
    const keys = mockEndOtp.mock.calls.map(
      (call) => (call[0] as Record<string, string>)['idempotencyKey'],
    );
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(1);
  });

  it('does not mark arrival merely because the arrival screen opened', () => {
    setJob({ status: 'cook_arrived' });
    render(<ServiceScreen />);
    expect(mockArrive).not.toHaveBeenCalled();
  });

  it('sends the manual arrive command only when the cook presses it', () => {
    setJob({ status: 'cook_arrived' });
    render(<ServiceScreen />);
    fireEvent.press(screen.getByTestId('service-arrived'));
    expect(mockArrive).toHaveBeenCalledTimes(1);
  });
});

describe('location reporting lifecycle', () => {
  it('does not own app-lifetime tracking from the service screen', () => {
    render(<ServiceScreen />);
    expect(mockTrackerPrepare).not.toHaveBeenCalled();
    expect(mockTrackerActivate).not.toHaveBeenCalled();
    expect(mockTrackerStop).not.toHaveBeenCalled();
  });

  it('does not stop app-lifetime tracking when details unmounts', () => {
    const view = render(<ServiceScreen />);
    view.unmount();
    expect(mockTrackerStop).not.toHaveBeenCalled();
  });

  it('renders an independent Start Travel action for an assigned job', () => {
    setJob({ status: 'assigned' });
    render(<ServiceScreen />);
    expect(screen.getByTestId('service-assigned')).toBeTruthy();
    expect(screen.getByTestId('service-start-travel')).toBeTruthy();
  });
});
