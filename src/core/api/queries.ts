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
  CookCyclesResponse,
  CookEarningsResponse,
  CookJobResponse,
  CookJobsListResponse,
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
  leaves: (from?: string, to?: string) => ['cook', 'leaves', from ?? null, to ?? null] as const,
  earnings: ['cook', 'earnings'] as const,
  cycles: ['cook', 'earnings', 'cycles'] as const,
  cycle: (cycleId: string) => ['cook', 'earnings', 'cycles', cycleId] as const,
};

/* ---------------------------------------------------------------- reads --- */

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

export function useJob(bookingId: string, enabled = true): UseQueryResult<CookJobResponse> {
  return useQuery({
    queryKey: queryKeys.job(bookingId),
    queryFn: ({ signal }) => api.getJob(bookingId, { signal }),
    enabled: enabled && bookingId.length > 0,
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

export function useApprovedLeaves(
  params: { readonly from?: string; readonly to?: string } = {},
  enabled = true,
): UseQueryResult<CookLeavesResponse> {
  return useQuery({
    queryKey: queryKeys.leaves(params.from, params.to),
    queryFn: ({ signal }) => api.listApprovedLeaves(params, { signal }),
    enabled,
  });
}

export function useEarnings(enabled = true): UseQueryResult<CookEarningsResponse> {
  return useQuery({
    queryKey: queryKeys.earnings,
    queryFn: ({ signal }) => api.getEarnings({}, { signal }),
    enabled,
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
): UseQueryResult<CookEarningsResponse> {
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

export function useVerifyEndOtp(): UseMutationResult<
  void,
  unknown,
  { bookingId: string; otp: string; assignmentVersion: number; idempotencyKey: string }
> {
  return useJobCommand((args) => api.verifyEndOtp(args));
}
