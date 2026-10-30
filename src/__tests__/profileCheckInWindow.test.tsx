import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  CHECK_IN_RECHECK_FALLBACK_MS,
  CHECK_IN_RECHECK_MARGIN_MS,
  checkInRecheckDelayMs,
  useCookProfile,
} from '@core/api/queries';
import type { CookProfileResponse } from '@core/api/schemas';

/**
 * Hazri re-reads itself when the check-in window opens (Sanchita, 2026-10-24).
 *
 * The profile was only re-read on mount or when the app came back to the foreground, so a cook
 * who opened Hazri before 06:00 kept reading "Abhi jaldi hai" with the button off at 06:10. The
 * wait is measured on the server's clock, not the handset's.
 */

const mockGetCookProfile = jest.fn();
jest.mock('@core/api/cook', () => ({
  ...jest.requireActual('@core/api/cook'),
  getCookProfile: () => mockGetCookProfile(),
}));

const SERVER_NOW = '2026-10-24T00:30:00.000Z';

function profile(
  overrides: Partial<CookProfileResponse['today']>,
  serverTime = SERVER_NOW,
): CookProfileResponse {
  return {
    cook: {
      id: 'c1',
      name: 'Sanchita',
      photoUrl: null,
      status: 'active',
      hub: null,
      rating: { average: 5, count: 1 },
    },
    today: {
      workingDays: [1, 2, 3, 4, 5, 6, 7],
      shift: null,
      attendance: null,
      canCheckIn: false,
      checkInOpensAt: null,
      shiftStartsAt: null,
      checkedInAt: null,
      reason: 'READY',
      availability: null,
      ...overrides,
    },
    currentAssignment: null,
    serverTime,
  } as CookProfileResponse;
}

const closedUntil = (iso: string): CookProfileResponse =>
  profile({ canCheckIn: false, reason: 'BEFORE_CHECK_IN_WINDOW', checkInOpensAt: iso });

describe('checkInRecheckDelayMs', () => {
  it('waits for the window on the SERVER clock, plus a margin', () => {
    // Opens 10 minutes after the server's own "now".
    expect(checkInRecheckDelayMs(closedUntil('2026-10-24T00:40:00.000Z'))).toBe(
      10 * 60_000 + CHECK_IN_RECHECK_MARGIN_MS,
    );
  });

  it('does not poll once she may check in, or for any other reason', () => {
    expect(checkInRecheckDelayMs(profile({ canCheckIn: true, reason: 'READY' }))).toBe(false);
    expect(checkInRecheckDelayMs(profile({ reason: 'MARKED_ABSENT' }))).toBe(false);
    expect(checkInRecheckDelayMs(profile({ reason: 'NO_SHIFT' }))).toBe(false);
    expect(checkInRecheckDelayMs(profile({ reason: 'COOK_CHECKED_IN' }))).toBe(false);
    expect(checkInRecheckDelayMs(undefined)).toBe(false);
  });

  it('does not poll when the server gave no opening time', () => {
    expect(
      checkInRecheckDelayMs(profile({ reason: 'BEFORE_CHECK_IN_WINDOW', checkInOpensAt: null })),
    ).toBe(false);
  });

  it('falls back to a slow poll, not a tight loop, when the window should be open but is not', () => {
    expect(checkInRecheckDelayMs(closedUntil('2026-10-24T00:29:00.000Z'))).toBe(
      CHECK_IN_RECHECK_FALLBACK_MS,
    );
  });
});

describe('useCookProfile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetCookProfile.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  function render() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useCookProfile(), { wrapper });
  }

  it('re-reads by itself when the window opens and the button turns on', async () => {
    mockGetCookProfile
      .mockResolvedValueOnce(closedUntil('2026-10-24T00:30:10.000Z'))
      .mockResolvedValue(
        profile({ canCheckIn: true, reason: 'READY' }, '2026-10-24T00:30:12.000Z'),
      );
    const { result } = render();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(result.current.data?.today.canCheckIn).toBe(false);
    expect(mockGetCookProfile).toHaveBeenCalledTimes(1);

    // Just before the boundary plus margin: still nothing.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(mockGetCookProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(CHECK_IN_RECHECK_MARGIN_MS + 100);
    });
    expect(mockGetCookProfile).toHaveBeenCalledTimes(2);
    expect(result.current.data?.today.canCheckIn).toBe(true);
  });

  it('stops re-reading once the button is on', async () => {
    mockGetCookProfile
      .mockResolvedValueOnce(closedUntil('2026-10-24T00:30:05.000Z'))
      .mockResolvedValue(
        profile({ canCheckIn: true, reason: 'READY' }, '2026-10-24T00:30:07.000Z'),
      );
    render();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    const callsAfterOpening = mockGetCookProfile.mock.calls.length;
    expect(callsAfterOpening).toBe(2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60 * 60_000);
    });
    expect(mockGetCookProfile).toHaveBeenCalledTimes(callsAfterOpening);
  });
});
