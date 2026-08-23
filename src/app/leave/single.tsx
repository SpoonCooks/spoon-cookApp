import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newIdempotencyKey } from '@core/api/cook';
import { apiErrorMessage } from '@core/api/errors';
import { useCookProfile, useRequestLeave } from '@core/api/queries';
import {
  countLeaveDays,
  leaveRequestPendingCopy,
  toLeaveRequestRange,
  validateLeaveSelection,
  type LeaveRequestKind,
} from '@core/domain/leave';
import { Button, color, ErrorState, LoadingState, radius, spacing, Text } from '@ui';

/**
 * `1 din ki chutti` — Figma `Page 14a- 1day` (`528:483`) and `Page 14b- 1day confirm` (`529:1259`).
 *
 * ## `Pakka` now submits
 *
 * `POST /v1/cook/leaves` is registered on the deployed API (probed 2026-08-23: `400 INVALID_REQUEST`
 * for an empty body, never `404`). The gate that stood here while the endpoint was missing is gone.
 *
 * What the gate protected against is still true and is enforced by the copy: the request lands
 * `pending` and Ops/Admin decide, so the confirmation says `Chutti ki request bhej di` — never
 * `Chutti lag gyi`. Nothing is marked locally; the leave lists and the month are invalidated and
 * re-read so the cook sees the state the server actually stored.
 *
 * ## The service date is the server's
 *
 * The day chips are built from `profile.serverTime`, not `new Date()`. A device an hour behind
 * midnight would otherwise offer "Aaj" for a date the backend has already rolled past and the
 * request would be rejected as being in the past.
 */
export default function SingleDayLeaveScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();

  // One key per mount: a double-tap or a post-timeout retry replays the SAME request rather than
  // filing a second chutti.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const profile = useCookProfile();
  const todayIso = (profile.data?.serverTime ?? '').slice(0, 10);
  const month = todayIso.slice(0, 7);
  const requestLeave = useRequestLeave(month);

  const options = useMemo(
    () => (todayIso.length === 10 ? nextThreeDays(todayIso) : []),
    [todayIso],
  );
  const [pickedIso, setPickedIso] = useState<string | null>(null);
  const selectedIso = pickedIso ?? options[0]?.dateIso ?? '';

  const selection: LeaveRequestKind = { kind: 'single_day', dateIso: selectedIso };
  const validation = validateLeaveSelection(selection, todayIso);
  const submitted = requestLeave.isSuccess;

  if (profile.isPending) return <LoadingState testID="leave-single-loading" />;
  if (profile.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(profile.error)}
        onRetry={() => void profile.refetch()}
        testID="leave-single-error"
      />
    );
  }

  const submit = (): void => {
    if (!validation.ok || requestLeave.isPending || submitted) return;
    const range = toLeaveRequestRange(selection);
    requestLeave.mutate({
      startDateIso: range.startDateIso,
      endDateIso: range.endDateIso,
      idempotencyKey,
    });
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.m }]} testID="leave-single">
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleBlack">Chutti pakka hai?</Text>
        <Text variant="captionMuted">Aap jitne din aaye, utne din ke paise milenge</Text>

        <Text variant="labelStrong">1 din ki chutti</Text>

        <View style={styles.chips}>
          {options.map((option) => {
            const active = option.dateIso === selectedIso;
            return (
              <View
                key={option.dateIso}
                style={[styles.chip, active && styles.chipActive]}
                testID={`leave-day-${option.dateIso}`}
              >
                <Text variant="bodyStrong">{option.dayLabel}</Text>
                <Text variant="captionMuted">{option.relativeLabel}</Text>
                <Button
                  label={active ? 'Chuna' : 'Chutti'}
                  tone={active ? 'action' : 'ghost'}
                  fullWidth={false}
                  disabled={submitted}
                  onPress={() => setPickedIso(option.dateIso)}
                  testID={`leave-day-pick-${option.dateIso}`}
                />
              </View>
            );
          })}
        </View>

        <Text variant="captionMuted" testID="leave-single-total">
          {`Total din ${countLeaveDays(selection)}`}
        </Text>

        {!validation.ok && (
          <Text variant="caption" color={color.danger} testID="leave-single-invalid">
            {validation.message}
          </Text>
        )}

        <Button
          label="Pakka"
          tone="action"
          disabled={!validation.ok || submitted}
          loading={requestLeave.isPending}
          onPress={submit}
          testID="leave-single-confirm"
        />

        {submitted && (
          <Text variant="bodyStrong" testID="leave-single-pending">
            {leaveRequestPendingCopy}
          </Text>
        )}

        {requestLeave.isError && (
          <Text variant="caption" color={color.danger} testID="leave-single-failed">
            {apiErrorMessage(requestLeave.error)}
          </Text>
        )}

        <Button
          label="Wapas"
          tone="ghost"
          onPress={() => router.back()}
          testID="leave-single-back"
        />
      </ScrollView>
    </View>
  );
}

interface DayOption {
  readonly dateIso: string;
  readonly dayLabel: string;
  readonly relativeLabel: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * `Aaj` / `Kal` / `Parso`, counted forward from the SERVER's service date.
 *
 * Parsed at UTC midnight so adding a day is exact arithmetic on the date rather than on a local
 * timestamp that a DST or offset boundary could shift.
 */
function nextThreeDays(todayIso: string): readonly DayOption[] {
  const labels = ['Aaj', 'Kal', 'Parso'] as const;
  const base = Date.parse(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(base)) return [];
  return labels.map((relativeLabel, offset) => {
    const day = new Date(base + offset * 86_400_000);
    const month = MONTHS[day.getUTCMonth()] ?? '';
    return {
      dateIso: day.toISOString().slice(0, 10),
      dayLabel: `${day.getUTCDate()} ${month}`,
      relativeLabel,
    };
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge, gap: spacing.m },
  chips: { gap: spacing.m },
  chip: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    padding: spacing.l,
    gap: spacing.xs,
  },
  chipActive: { backgroundColor: color.actionSoft },
});
