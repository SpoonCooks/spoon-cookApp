import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
 * `lambi chutti` — Figma `Page 13a- long` (`528:659`), `Page 13b- long select` (`530:1349`) and
 * `Page 13c- long confirm` (`530:1478`).
 *
 * 13a and 13b are the same month grid before and after a selection: `Total din 0` becomes
 * `Total din 10`. 13c is the attendance surface afterwards, showing `Aane wali chutti` →
 * `16 Nov se 25 Nov tak` and relabelling the entry point to `Dates badle`.
 *
 * Selection is a first-and-last tap producing an inclusive range, which is what `Total din` counts.
 *
 * ## Submission is live
 *
 * `POST /v1/cook/leaves` takes `{ startDate, endDate }` and an `Idempotency-Key`, and answers
 * `201` with `status: 'pending'`. A multi-day request is ONE request server-side — grouped by
 * `leave_request_id` — which is why the range is submitted whole rather than day by day.
 *
 * The result is a REQUEST, not a granted leave: Ops/Admin decide. The screen says so and the
 * calendar is re-read afterwards rather than marked locally.
 */
export default function RangeLeaveScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [fromIso, setFromIso] = useState<string | null>(null);
  const [toIso, setToIso] = useState<string | null>(null);

  // One key per mount, so a retry after a timeout replays rather than filing a second chutti.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const profile = useCookProfile();
  const todayIso = (profile.data?.serverTime ?? '').slice(0, 10);
  const requestLeave = useRequestLeave(todayIso.slice(0, 7));

  // Anchored to the SERVER's service date so the grid cannot open on a month the device invented.
  const grid = useMemo(() => currentMonthGrid(todayIso), [todayIso]);

  const selection: LeaveRequestKind | null =
    fromIso !== null && toIso !== null
      ? { kind: 'date_range', fromDateIso: fromIso, toDateIso: toIso }
      : null;
  const totalDays = selection === null ? 0 : countLeaveDays(selection);
  const validation = selection === null ? null : validateLeaveSelection(selection, todayIso);
  const submitted = requestLeave.isSuccess;

  const submit = (): void => {
    if (selection === null || validation === null || !validation.ok) return;
    if (requestLeave.isPending || submitted) return;
    const range = toLeaveRequestRange(selection);
    requestLeave.mutate({
      startDateIso: range.startDateIso,
      endDateIso: range.endDateIso,
      idempotencyKey,
    });
  };

  const onPickDay = (dateIso: string): void => {
    // First tap starts a range; second tap closes it; a third starts over. Tapping earlier than
    // the start re-anchors rather than producing an inverted range.
    if (fromIso === null || toIso !== null) {
      setFromIso(dateIso);
      setToIso(null);
      return;
    }
    if (dateIso < fromIso) {
      setFromIso(dateIso);
      return;
    }
    setToIso(dateIso);
  };

  const isSelected = (dateIso: string): boolean => {
    if (fromIso === null) return false;
    if (toIso === null) return dateIso === fromIso;
    return dateIso >= fromIso && dateIso <= toIso;
  };

  if (profile.isPending) return <LoadingState testID="leave-range-loading" />;
  if (profile.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(profile.error)}
        onRetry={() => void profile.refetch()}
        testID="leave-range-error"
      />
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.m }]} testID="leave-range">
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleBlack" testID="leave-range-month">
          {grid.monthLabel}
        </Text>

        <View style={styles.weekHeader}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <View key={`${day}-${index}`} style={styles.cell}>
              <Text variant="captionMuted">{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.leadingBlanks.map((key) => (
            <View key={key} style={styles.cell} />
          ))}
          {grid.days.map((day) => {
            const selected = isSelected(day.dateIso);
            return (
              <Pressable
                key={day.dateIso}
                style={[styles.cell, styles.dayCell, selected && styles.dayCellSelected]}
                onPress={() => onPickDay(day.dateIso)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`leave-range-day-${day.dateIso}`}
              >
                <Text variant="caption" color={selected ? color.black : color.textPrimary}>
                  {String(day.dayOfMonth)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.totalRow}>
          <Text variant="labelStrong">Total din</Text>
          <Text variant="display" testID="leave-range-total">
            {String(totalDays)}
          </Text>
        </View>

        {validation !== null && !validation.ok && (
          <Text variant="caption" color={color.danger} testID="leave-range-invalid">
            {validation.message}
          </Text>
        )}

        <Button
          label="Pakka"
          tone="action"
          disabled={totalDays === 0 || submitted || (validation !== null && !validation.ok)}
          loading={requestLeave.isPending}
          onPress={submit}
          testID="leave-range-confirm"
        />

        {submitted && (
          <Text variant="bodyStrong" testID="leave-range-pending">
            {leaveRequestPendingCopy}
          </Text>
        )}

        {requestLeave.isError && (
          <Text variant="caption" color={color.danger} testID="leave-range-failed">
            {apiErrorMessage(requestLeave.error)}
          </Text>
        )}

        <Button
          label="Wapas"
          tone="ghost"
          onPress={() => router.back()}
          testID="leave-range-back"
        />
      </ScrollView>
    </View>
  );
}

interface GridDay {
  readonly dateIso: string;
  readonly dayOfMonth: number;
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
 * Monday-first month grid, matching the Figma header `M T W T F S S`.
 *
 * Built from the SERVER's service date. Dates are constructed at UTC midnight so the grid is a
 * property of the calendar month rather than of the device's offset.
 */
function currentMonthGrid(todayIso: string): {
  readonly monthLabel: string;
  readonly leadingBlanks: readonly string[];
  readonly days: readonly GridDay[];
} {
  const anchor = Date.parse(`${todayIso}T00:00:00Z`);
  const now = Number.isNaN(anchor) ? new Date() : new Date(anchor);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  // JS weeks start on Sunday; the design starts on Monday.
  const offset = (first.getUTCDay() + 6) % 7;

  const days: GridDay[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({ dateIso: iso, dayOfMonth: day });
  }

  return {
    monthLabel: `${MONTHS[month] ?? ''} ${year}`,
    leadingBlanks: Array.from({ length: offset }, (_, index) => `blank-${index}`),
    days,
  };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge, gap: spacing.m },
  weekHeader: { flexDirection: 'row', flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: { borderRadius: radius.pill },
  dayCellSelected: { backgroundColor: color.action },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
