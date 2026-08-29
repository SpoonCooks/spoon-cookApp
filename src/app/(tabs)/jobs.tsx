import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { toJobCard } from '@core/api/adapters';
import { newIdempotencyKey } from '@core/api/cook';
import { apiErrorMessage, isAssignmentChanged, isSessionExpired } from '@core/api/errors';
import { useCookProfile, useJobs, useStartCommute } from '@core/api/queries';
import type { JobCardModel } from '@core/domain/job';
import { locationTracker, type TrackingState } from '@core/location/tracker';
import { useSession } from '@core/session/store';
import { formatLocalTime } from '@features/leave/leaveModel';
import { JobsView, type BreakWindowModel } from '@features/jobs/JobViews';
import { color, EmptyState, ErrorState, LoadingState, spacing, Text } from '@ui';
import { openSupportWhatsApp } from '@core/support/whatsapp';

/**
 * KAAM — the V14 `job flow` section (`592:1070`).
 *
 * Five frames, one screen:
 *
 *   `583:375`  shift not started      → the list alone
 *   `583:401`  shift started          → the same list under the `aaj ka break` window
 *   `583:427`  next job < 45 mins     → a lead card with a countdown and the `CHALO` CTA
 *   `583:453`  next job < 10 mins     → the same card in the lime colourway
 *   `583:479`  next job < 5 mins      → the same card in red, CTA label inverted to white
 *
 * V13 excluded this section by brief and the screen still drew the V12 `Namaste, <name>` banner
 * over `@ui/JobCard`. V14 finalizes it, so the layout is rebuilt from the design; the backend
 * wiring below is unchanged and deliberately so.
 *
 * ## `CHALO` begins TRAVEL
 *
 * It posts `start-commute`, not a service start. The service begins only after Start-OTP
 * verification. Navigation to the service screen happens **after** the backend confirms the
 * commute, so opening the screen can never be what moved the booking.
 *
 * `assignmentVersion` rides along on the command: a cook acting on a card rendered before a
 * reassignment is refused with `ACTIVE_ASSIGNMENT_CHANGED` and the list is re-read, rather than
 * starting travel to a job that is no longer theirs.
 */
export default function JobsScreen(): React.ReactElement {
  const signOut = useSession((s) => s.signOut);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  // One key per booking, so a retry of the same intent replays rather than double-commands.
  const commuteKeys = useRef(new Map<string, string>());

  const profile = useCookProfile();
  const jobs = useJobs();
  const startCommute = useStartCommute();

  const cards: readonly JobCardModel[] = useMemo(
    () => (jobs.data?.jobs ?? []).map(toJobCard),
    [jobs.data],
  );

  const leadJob = cards.find((card) => card.isActionable) ?? null;
  const rest = useMemo(
    () => cards.filter((card) => card.bookingId !== leadJob?.bookingId),
    [cards, leadJob],
  );

  const startTravel = (bookingId: string): void => {
    const card = cards.find((item) => item.bookingId === bookingId);
    if (card === undefined || submittingId !== null) return;

    let key = commuteKeys.current.get(bookingId);
    if (key === undefined) {
      key = newIdempotencyKey();
      commuteKeys.current.set(bookingId, key);
    }

    setSubmittingId(bookingId);
    setCommandError(null);
    const target = { bookingId, assignmentVersion: card.assignmentVersion };
    void locationTracker.prepare(target).then((prepared) => {
      if (prepared.status !== 'ready') {
        setCommandError(locationSetupError(prepared));
        setSubmittingId(null);
        return;
      }

      startCommute.mutate(
        { bookingId, assignmentVersion: card.assignmentVersion, idempotencyKey: key },
        {
          onSuccess: () => {
            void locationTracker.activate(target).finally(() => {
              router.push({ pathname: '/service/[bookingId]', params: { bookingId } });
            });
          },
          onError: (error: unknown) => {
            // A stale assignment is not a failure to retry — the list must be re-read first.
            locationTracker.stop();
            if (isAssignmentChanged(error)) commuteKeys.current.delete(bookingId);
            setCommandError(apiErrorMessage(error));
            void jobs.refetch();
          },
          onSettled: () => {
            setSubmittingId(null);
          },
        },
      );
    });
  };

  const openJob = (bookingId: string): void => {
    router.push({ pathname: '/service/[bookingId]', params: { bookingId } });
  };

  if (jobs.isPending || profile.isPending) return <LoadingState testID="jobs-loading" />;

  if (jobs.isError) {
    if (isSessionExpired(jobs.error)) {
      signOut();
      router.replace('/login');
    }
    return (
      <ErrorState
        message={apiErrorMessage(jobs.error)}
        onRetry={() => void jobs.refetch()}
        testID="jobs-error"
      />
    );
  }

  const today = profile.data?.today ?? null;
  const shift = today?.shift ?? null;

  /**
   * `573:1205` is drawn once the shift has started and the server has published a break window.
   *
   * Same rule the Chutti tab applies to `528:465`: a cook who is not at work today has no break
   * to be told about, and the window is never synthesised from a local clock.
   */
  const breakWindow: BreakWindowModel | null =
    today?.attendance?.status === 'present' && shift !== null
      ? {
          fromLabel: formatLocalTime(shift.breakStartLocalTime),
          toLabel: formatLocalTime(shift.breakEndLocalTime),
        }
      : null;

  const hasAnything = leadJob !== null || rest.length > 0;

  return (
    <JobsView
      onHelp={() => void openSupportWhatsApp(profile.data?.cook.name ?? null)}
      dateLabel={formatServerDate(jobs.data?.serverTime ?? profile.data?.serverTime ?? null)}
      leadJob={leadJob}
      jobs={rest}
      breakWindow={breakWindow}
      onStartTravel={startTravel}
      onOpenJob={openJob}
      submittingId={submittingId}
      banner={
        commandError !== null ? (
          <View style={styles.commandError}>
            <Text variant="caption" color={color.danger} testID="jobs-command-error">
              {commandError}
            </Text>
          </View>
        ) : !hasAnything ? (
          <EmptyState message="Abhi koi kaam nahi hai." />
        ) : null
      }
      scrollProps={{
        refreshControl: (
          <RefreshControl refreshing={jobs.isFetching} onRefresh={() => void jobs.refetch()} />
        ),
      }}
    />
  );
}

function locationSetupError(state: TrackingState): string {
  switch (state.status) {
    case 'permission_denied':
      return 'Location permission is required before travel can start.';
    case 'services_disabled':
      return 'Turn on location services and try again.';
    default:
      return 'Location tracking could not start. Please try again.';
  }
}

/**
 * `7 November` from the SERVER's instant, in IST.
 *
 * Anchored to server time rather than the device so a wrong device clock cannot title today's
 * list with yesterday's date. Falls back to an empty title rather than inventing one.
 */
export function formatServerDate(serverTimeIso: string | null): string {
  if (serverTimeIso === null) return '';
  return new Date(serverTimeIso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });
}

const styles = StyleSheet.create({
  commandError: { paddingHorizontal: spacing.xl, paddingBottom: spacing.s },
});
