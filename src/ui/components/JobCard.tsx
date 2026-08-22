import { StyleSheet, View } from 'react-native';

import {
  formatDurationHours,
  formatMinutes,
  jobCtaLabel,
  type JobCardModel,
} from '@core/domain/job';
import { color, radius, shadow, spacing } from '../theme/tokens';
import { Text } from '../primitives/Text';
import { Button } from './Button';

/**
 * Reusable job card.
 *
 * One component covers every Figma job-card appearance rather than duplicating markup per screen:
 *   - `jobs` (`494:5627`) — the compact upcoming card
 *   - `next job` / `div.rounded-3xl` (`434:2741`) — the prominent actionable card
 *   - `div.bg-red-600` (`434:2743`) — the `RUNNING LATE` badge overlay
 *
 * The same card appears on Page 3 (job list), Page 3a (start) and Page 11 (attendance), so it
 * takes only a model plus a variant and owns no data fetching of its own.
 */

export type JobCardVariant = 'prominent' | 'compact';

export interface JobCardProps {
  readonly job: JobCardModel;
  readonly variant?: JobCardVariant;
  readonly onStartTravel?: (bookingId: string) => void;
  readonly isSubmitting?: boolean;
  readonly testID?: string;
}

export function JobCard({
  job,
  variant = 'prominent',
  onStartTravel,
  isSubmitting = false,
  testID,
}: JobCardProps): React.ReactElement {
  const isProminent = variant === 'prominent';

  return (
    <View
      testID={testID ?? `job-card-${job.bookingId}`}
      accessibilityRole="summary"
      style={[styles.card, isProminent ? styles.cardProminent : styles.cardCompact]}
    >
      {job.isRunningLate && (
        <View style={styles.lateBadge} testID="running-late-badge">
          <Text variant="labelStrong" color={color.white}>
            RUNNING LATE
          </Text>
        </View>
      )}

      <View style={styles.headerRow}>
        {job.minutesToDeadline !== null ? (
          <View>
            <Text
              variant={isProminent ? 'display' : 'headingLg'}
              // Negative minutes mean the reach-by deadline has passed.
              color={
                job.minutesToDeadline < 0 || job.isRunningLate ? color.danger : color.textPrimary
              }
            >
              {formatMinutes(job.minutesToDeadline)}
            </Text>
            {job.travelMinutes !== null && (
              <Text variant="captionMuted">{`${job.travelMinutes} min dur`}</Text>
            )}
          </View>
        ) : (
          <View>
            <Text variant={isProminent ? 'headingLg' : 'titleBlack'}>
              {formatClockTime(job.scheduledStartIso)}
            </Text>
            <Text variant="captionMuted">Tak pahauch jaye</Text>
          </View>
        )}

        <View style={styles.durationPill}>
          <Text variant="captionStrong">{formatDurationHours(job.serviceDurationMinutes)}</Text>
        </View>
      </View>

      <Text variant="body" style={styles.society} numberOfLines={2}>
        {job.societyOrBuilding}
      </Text>

      {job.action === 'start_travel' && (
        <Button
          label={jobCtaLabel}
          tone="action"
          // Eligibility is a server ruling; the card never decides it from a local clock.
          disabled={!job.isActionable}
          loading={isSubmitting}
          onPress={() => onStartTravel?.(job.bookingId)}
          testID={`job-start-${job.bookingId}`}
          style={styles.cta}
        />
      )}
    </View>
  );
}

/** `2026-08-21T11:50:00+05:30` → `11:50 AM`. Display formatting only. */
export function formatClockTime(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (match === null) return '';
  const hour = Number(match[1]);
  const minute = match[2] ?? '00';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${suffix}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    padding: spacing.l,
    gap: spacing.m,
    ...shadow.card,
  },
  cardProminent: { borderWidth: 2, borderColor: color.black },
  cardCompact: { opacity: 0.95 },
  lateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: color.dangerDeep,
    borderRadius: radius.s,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  durationPill: {
    backgroundColor: color.yellow300,
    borderRadius: radius.full,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  society: { color: color.textSecondary },
  cta: { marginTop: spacing.xs },
});
