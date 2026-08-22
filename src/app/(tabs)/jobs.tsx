import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toJobCard } from '@core/api/adapters';
import { newIdempotencyKey } from '@core/api/cook';
import { apiErrorMessage, isAssignmentChanged, isSessionExpired } from '@core/api/errors';
import { useCookProfile, useJobs, useStartCommute } from '@core/api/queries';
import { groupJobsByDate, type JobCardModel } from '@core/domain/job';
import { useSession } from '@core/session/store';
import { color, EmptyState, ErrorState, JobCard, LoadingState, spacing, Text } from '@ui';

/**
 * Page 3 — job list (Figma `434:3086`) and Page 3a — start (`494:5648`).
 *
 * These are one screen. The only difference between the two Figma frames is the countdown value
 * and whether the `START` CTA is enabled — both server rulings on the same card model, not
 * separate layouts.
 *
 * ## `START` begins TRAVEL
 *
 * It posts `start-commute`, not a service start. The service begins only after Start-OTP
 * verification. Navigation to the service screen happens **after** the backend confirms the
 * commute, so opening the screen can never be what moved the booking.
 *
 * `assignmentVersion` rides along on the command: a cook acting on a card rendered before a
 * reassignment is refused with `ACTIVE_ASSIGNMENT_CHANGED` and the list is re-read, rather than
 * starting travel to a job that is no longer theirs.
 *
 * ## Scope note
 *
 * Both frames sit at canvas top level rather than inside one of the four approved `SECTION`s
 * (`434:3115` Login flow, `485:4971` Service flow, `540:397` Performance & earnings,
 * `540:416` Attendance). They are retained because they are the Jobs tab destination that the
 * in-section Service-flow frames are reached from — removing them would orphan the entire
 * Service section. Recorded as an explicit deviation in the implementation report.
 */
export default function JobsScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
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

  const currentJob = cards.find((card) => card.isActionable) ?? null;
  const upcoming = useMemo(
    () =>
      groupJobsByDate(
        cards.filter((card) => card.bookingId !== currentJob?.bookingId),
        (dateIso) => labelForDate(dateIso, jobs.data?.serverTime ?? null),
      ),
    [cards, currentJob, jobs.data],
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
    startCommute.mutate(
      { bookingId, assignmentVersion: card.assignmentVersion, idempotencyKey: key },
      {
        onSuccess: () => {
          router.push({ pathname: '/service/[bookingId]', params: { bookingId } });
        },
        onError: (error: unknown) => {
          // A stale assignment is not a failure to retry — the list must be re-read first.
          if (isAssignmentChanged(error)) commuteKeys.current.delete(bookingId);
          setCommandError(apiErrorMessage(error));
          void jobs.refetch();
        },
        onSettled: () => {
          setSubmittingId(null);
        },
      },
    );
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

  const hasAnything = currentJob !== null || upcoming.length > 0;
  const name = profile.data?.cook.name ?? '';

  return (
    <View style={styles.flex}>
      <View style={[styles.banner, { paddingTop: insets.top + spacing.s }]}>
        <Text variant="headingLg">{`Namaste, ${name}`}</Text>
      </View>

      {commandError !== null && (
        <View style={styles.commandError}>
          <Text variant="caption" color={color.danger} testID="jobs-command-error">
            {commandError}
          </Text>
        </View>
      )}

      {!hasAnything ? (
        <EmptyState message="Abhi koi kaam nahi hai." />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
          refreshControl={
            <RefreshControl refreshing={jobs.isFetching} onRefresh={() => void jobs.refetch()} />
          }
          testID="jobs-scroll"
        >
          {currentJob !== null && (
            <JobCard
              job={currentJob}
              variant="prominent"
              onStartTravel={startTravel}
              isSubmitting={submittingId === currentJob.bookingId}
            />
          )}

          {upcoming.map((group) => (
            <View key={group.dateIso} style={styles.group}>
              {group.label !== null && <Text variant="labelStrong">{group.label}</Text>}
              {group.jobs.map((job) => (
                <JobCard key={job.bookingId} job={job} variant="compact" />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * `Aaj` / `Kal` headings, anchored to the SERVER's date.
 *
 * `serverTime` is the reference so a device with a wrong clock cannot file tomorrow's job under
 * today. Anything beyond tomorrow gets no heading rather than an invented one.
 */
function labelForDate(dateIso: string, serverTimeIso: string | null): string | null {
  if (serverTimeIso === null) return null;
  const today = serverTimeIso.slice(0, 10);
  if (dateIso === today) return 'Aaj';
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  return dateIso === tomorrow ? 'Kal' : null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { paddingHorizontal: spacing.xl, paddingBottom: spacing.m },
  commandError: { paddingHorizontal: spacing.xl, paddingBottom: spacing.s },
  content: { paddingHorizontal: spacing.xl, gap: spacing.l },
  group: { gap: spacing.m },
});
