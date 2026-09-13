import { useEffect } from 'react';
import { AppState } from 'react-native';

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
