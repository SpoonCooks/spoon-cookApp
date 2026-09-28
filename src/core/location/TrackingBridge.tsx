import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useCurrentJob } from '@core/api/queries';
import { selectIsSignedIn, useSession } from '@core/session/store';

import { locationTracker } from './tracker';

/**
 * App-lifetime reconciliation for travel tracking.
 *
 * The service route is a view of a booking, not the owner of its native location lifecycle. This
 * bridge reconstructs tracking from the authenticated current-job projection after restart and
 * keeps it alive while the cook visits Jobs, Attendance, or another supported screen.
 */
export function TrackingBridge(): null {
  const signedIn = useSession(selectIsSignedIn);
  const currentJob = useCurrentJob(signedIn, 20_000);
  const queryClient = useQueryClient();

  /*
   * Re-read the job the moment the server has a new travel time, instead of waiting for the
   * 20-second poll. Right after Chalo the server often has no position to route from yet and the
   * card shows `--`; the tracker's first sample lands about a second later and revises the ETA,
   * so this is what gets minutes on screen within a couple of seconds. Every job read shares the
   * `['cook', 'jobs']` prefix, so the service screen and the current-job read both refresh.
   */
  useEffect(
    () =>
      locationTracker.onEtaRevised(() => {
        void queryClient.invalidateQueries({ queryKey: ['cook', 'jobs'] });
      }),
    [queryClient],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      locationTracker.setAppState(active);
      if (active) void currentJob.refetch();
    });

    locationTracker.setAppState(AppState.currentState !== 'background');
    return () => sub.remove();
    // The query key is stable for the app lifetime; re-subscribing on every render would leak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useEffect(() => {
    // A transient read failure must not stop a valid native task: the server state is unknown, not
    // terminal. The next successful read will reconcile it.
    if (!signedIn || currentJob.isPending || currentJob.isError || currentJob.data === undefined) {
      if (!signedIn) locationTracker.stop();
      return;
    }

    const job = currentJob.data;
    if (job !== null && job.status === 'cook_en_route' && job.reassignment.current) {
      void locationTracker.start(
        { bookingId: job.bookingId, assignmentVersion: job.assignmentVersion },
        { onArrived: () => void currentJob.refetch() },
      );
      return;
    }

    // No current travel assignment, or the backend moved it to a terminal/non-travel state.
    locationTracker.stop();
    // `refetch` is stable for this query key; the effect is keyed to the projection only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, currentJob.data, currentJob.isPending, currentJob.isError]);

  return null;
}
