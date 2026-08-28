/**
 * TanStack Query bindings.
 *
 * Reads are cached; commands are not. Two rules shape everything here:
 *
 * 1. **A command never writes the cache optimistically.** Every mutation invalidates and re-reads,
 *    so the screen that appears after `Present` or a Start-OTP verification is the server's
 *    projection, not a guess. This is what keeps `projectServiceState` honest.
 *
 * 2. **A failed read never yields fixture data.** `retry` is deliberately restrictive: a `401`,
 *    `403` or contract failure is final, because retrying cannot fix it and the cook needs to see
 *    the real state.
 */

import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import * as api from './cook';
import { isApiError } from './errors';
import type {
  CookEarningsPolicy,
  CookAttendanceRangeResponse,
  CookCycleDetailResponse,
  CookCyclesResponse,
  CookEarningsResponse,
  CookEarningsPeriodResponse,
  CookJobResponse,
  CookJobsListResponse,
  CookLeaveRequestResponse,
  CookLeavesResponse,
  CookPresentResponse,
  CookProfileResponse,
  MonthlyAttendanceResponse,
} from './schemas';

/** Retry transport blips only. Auth, permission and contract failures are terminal. */
function retryPolicy(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!isApiError(error)) return false;
  return error.kind === 'offline' || error.kind === 'timeout';
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: retryPolicy,
        staleTime: 15_000,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

export const queryKeys = {
  profile: ['cook', 'me'] as const,
  jobs: (from?: string, to?: string) => ['cook', 'jobs', from ?? null, to ?? null] as const,
  currentJob: ['cook', 'jobs', 'current'] as const,
  job: (bookingId: string) => ['cook', 'jobs', bookingId] as const,
  attendanceMonth: (month: string) => ['cook', 'attendance', 'month', month] as const,
  attendanceRange: (from: string, to: string) => ['cook', 'attendance', 'range', from, to] as const,
  leaves: (from?: string, to?: string) => ['cook', 'leaves', from ?? null, to ?? null] as const,
  earnings: ['cook', 'earnings'] as const,
  earningsDay: (serviceDate: string) => ['cook', 'earnings', 'day', serviceDate] as const,
  cycles: ['cook', 'earnings', 'cycles'] as const,
  cycle: (cycleId: string) => ['cook', 'earnings', 'cycles', cycleId] as const,
  earningsPolicy: ['cook', 'policies', 'earnings'] as const,
};

/* ---------------------------------------------------------------- reads --- */

/**
 * The active published earnings policy.
 *
 * Long-lived on purpose. This changes when an owner publishes a policy version, not when a cook
 * opens a screen, so it is cached for the session and refetched on the server's own five-minute
 * `max-age` rather than on every mount. A publication still reaches a running app without a
 * release — that is the whole point of the route — it simply does not cost a request per render.
 *
 * There is deliberately **no fallback**. A Niyam sheet with no policy shows that it has no policy;
 * it does not quietly draw last year's tariff, which is what the hardcoded tables did.
 */
export function useEarningsPolicy(enabled = true): UseQueryResult<CookEarningsPolicy> {
  return useQuery({
    queryKey: queryKeys.earningsPolicy,
    queryFn: ({ signal }) => api.getEarningsPolicy({ signal }),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useCookProfile(enabled = true): UseQueryResult<CookProfileResponse> {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: ({ signal }) => api.getCookProfile({ signal }),
    enabled,
  });
}

export function useJobs(
  params: { readonly from?: string; readonly to?: string; readonly limit?: number } = {},
  enabled = true,
): UseQueryResult<CookJobsListResponse> {
  return useQuery({
    queryKey: queryKeys.jobs(params.from, params.to),
    queryFn: ({ signal }) => api.listJobs(params, { signal }),
    enabled,
  });
}

/**
 * The active assignment.
 *
 * Polled while a service is live so a customer cancellation or a reassignment reaches the cook
 * without a push round-trip. Push is only ever a refresh hint.
 */
export function useCurrentJob(
  enabled = true,
  pollMs: number | false = false,
): UseQueryResult<CookJobResponse | null> {
  return useQuery({
    queryKey: queryKeys.currentJob,
    queryFn: ({ signal }) => api.getCurrentJob({ signal }),
    enabled,
    refetchInterval: pollMs,
  });
}

/**
 * One booking's projection.
 *
 * `pollMs` exists for the same reason as on {@link useCurrentJob}: while a service is live the
 * screen must learn about a customer cancellation, a reassignment or a confirmed extension without
 * waiting for a push. Push is a refresh hint, never the source of truth.
 */
export function useJob(
  bookingId: string,
  enabled = true,
  pollMs: number | false = false,
): UseQueryResult<CookJobResponse> {
  return useQuery({
    queryKey: queryKeys.job(bookingId),
    queryFn: ({ signal }) => api.getJob(bookingId, { signal }),
    enabled: enabled && bookingId.length > 0,
    refetchInterval: pollMs,
  });
}

export function useMonthlyAttendance(
  month: string,
  enabled = true,
): UseQueryResult<MonthlyAttendanceResponse> {
  return useQuery({
    queryKey: queryKeys.attendanceMonth(month),
    queryFn: ({ signal }) => api.getMonthlyAttendance(month, { signal }),
    enabled: enabled && /^\d{4}-\d{2}$/.test(month),
  });
}

export function useLeaves(
  params: { readonly from?: string; readonly to?: string } = {},
  enabled = true,
): UseQueryResult<CookLeavesResponse> {
  return useQuery({
    queryKey: queryKeys.leaves(params.from, params.to),
    queryFn: ({ signal }) => api.listLeaves(params, { signal }),
    enabled,
  });
}

/** Stored attendance for an explicit window — the cycle frame's Mon–Sun strip. */
export function useAttendanceRange(
  params: { readonly from: string; readonly to: string },
  enabled = true,
): UseQueryResult<CookAttendanceRangeResponse> {
  return useQuery({
    queryKey: queryKeys.attendanceRange(params.from, params.to),
    queryFn: ({ signal }) => api.listAttendanceRange(params, { signal }),
    enabled: enabled && params.from.length === 10 && params.to.length === 10,
  });
}

export function useEarnings(enabled = true): UseQueryResult<CookEarningsResponse> {
  return useQuery({
    queryKey: queryKeys.earnings,
    queryFn: ({ signal }) => api.getEarnings({}, { signal }),
    enabled,
  });
}

/**
 * One past service day.
 *
 * A finished day does not change, so this is cached far longer than the live `useEarnings`
 * window. It is still refetched on mount for today, because today is not finished.
 */
export function useEarningsDay(
  serviceDate: string,
  enabled = true,
): UseQueryResult<CookEarningsPeriodResponse> {
  return useQuery({
    queryKey: queryKeys.earningsDay(serviceDate),
    queryFn: ({ signal }) => api.getEarningsDay(serviceDate, { signal }),
    enabled: enabled && serviceDate.length === 10,
    staleTime: 5 * 60_000,
  });
}

export function useEarningsCycles(enabled = true): UseQueryResult<CookCyclesResponse> {
  return useQuery({
    queryKey: queryKeys.cycles,
    queryFn: ({ signal }) => api.listEarningsCycles({}, { signal }),
    enabled,
  });
}

export function useEarningsCycle(
  cycleId: string,
  enabled = true,
): UseQueryResult<CookCycleDetailResponse> {
  return useQuery({
    queryKey: queryKeys.cycle(cycleId),
    queryFn: ({ signal }) => api.getEarningsCycle(cycleId, { signal }),
    enabled: enabled && cycleId.length > 0,
  });
}

/* ------------------------------------------------------------ commands --- */

/**
 * Cook check-in.
 *
 * The idempotency key is created ONCE per mount, so a cook who taps twice — or retries after a
 * timeout — replays the same command rather than issuing a second one. The server answers a
 * replay with the original result and `created: false`.
 *
 * Nothing is written to the cache here. Both the profile and the month are invalidated so the
 * screen re-renders from the server's record of the check-in, including its on-time ruling.
 */
export function useMarkPresent(
  idempotencyKey: string,
  month: string,
): UseMutationResult<CookPresentResponse, unknown, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.markPresent(idempotencyKey),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.profile }),
        client.invalidateQueries({ queryKey: queryKeys.attendanceMonth(month) }),
      ]);
    },
  });
}

function useJobCommand<TArgs>(
  run: (args: TArgs) => Promise<void>,
): UseMutationResult<void, unknown, TArgs> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      // Re-read rather than patch: the command's effect on state is the server's to describe.
      await client.invalidateQueries({ queryKey: ['cook', 'jobs'] });
    },
  });
}

export function useStartCommute(): UseMutationResult<
  void,
  unknown,
  { bookingId: string; assignmentVersion: number; idempotencyKey: string }
> {
  return useJobCommand((args) => api.startCommute(args));
}

export function useMarkArrived(): UseMutationResult<
  void,
  unknown,
  { bookingId: string; assignmentVersion: number; idempotencyKey: string }
> {
  return useJobCommand((args) => api.markArrived(args));
}

export function useVerifyStartOtp(): UseMutationResult<
  void,
  unknown,
  { bookingId: string; otp: string; assignmentVersion: number; idempotencyKey: string }
> {
  return useJobCommand((args) => api.verifyStartOtp(args));
}

/**
 * End OTP.
 *
 * Completion changes money, so the earnings and cycle reads are invalidated too — otherwise the
 * cook finishes a job and My Money still shows the pre-service figures until the cache goes stale.
 */
export function useVerifyEndOtp(): UseMutationResult<
  void,
  unknown,
  { bookingId: string; otp: string; assignmentVersion: number; idempotencyKey: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      bookingId: string;
      otp: string;
      assignmentVersion: number;
      idempotencyKey: string;
    }) => api.verifyEndOtp(args),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['cook', 'jobs'] }),
        client.invalidateQueries({ queryKey: queryKeys.earnings }),
        client.invalidateQueries({ queryKey: queryKeys.cycles }),
        client.invalidateQueries({ queryKey: queryKeys.profile }),
      ]);
    },
  });
}

/**
 * Alert acknowledgement.
 *
 * Responsiveness evidence, nothing more (backend DEC-059). A local dismissal is NOT an
 * acknowledgement, so the projection is only re-read after the server has accepted the command.
 */
export function useAcknowledgeAlert(): UseMutationResult<
  void,
  unknown,
  {
    bookingId: string;
    alertType: 'start_alert' | 'start_escalation' | 'move_alert';
    assignmentVersion?: number | undefined;
  }
> {
  return useJobCommand((args) => api.acknowledgeAlert(args));
}

/**
 * Cook-initiated leave request.
 *
 * Answers `pending`. Both leave lists and the month are invalidated so the calendar shows the
 * request the server actually stored, in the state the server gave it.
 */
export function useRequestLeave(
  month: string,
): UseMutationResult<
  CookLeaveRequestResponse,
  unknown,
  { startDateIso: string; endDateIso: string; reason?: string; idempotencyKey: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      startDateIso: string;
      endDateIso: string;
      reason?: string;
      idempotencyKey: string;
    }) => api.requestLeave(args),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['cook', 'leaves'] }),
        client.invalidateQueries({ queryKey: ['cook', 'attendance'] }),
        ...(month.length === 7
          ? [client.invalidateQueries({ queryKey: queryKeys.attendanceMonth(month) })]
          : []),
      ]);
    },
  });
}
