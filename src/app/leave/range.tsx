import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  canSubmitLeaveRequest,
  countLeaveDays,
  leaveRequestUnavailableCopy,
  type LeaveRequestKind,
} from '@core/domain/leave';
import { Button, color, radius, spacing, Text } from '@ui';

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
 * Submission is disabled for the same reason as the single-day flow — the backend has no cook-side
 * leave write (GAP-21). The grid, the running total and the confirm copy are all real, so the
 * screen becomes functional by wiring one call.
 */
export default function RangeLeaveScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [fromIso, setFromIso] = useState<string | null>(null);
  const [toIso, setToIso] = useState<string | null>(null);

  const grid = useMemo(() => currentMonthGrid(), []);
  const submittable = canSubmitLeaveRequest();

  const selection: LeaveRequestKind | null =
    fromIso !== null && toIso !== null
      ? { kind: 'date_range', fromDateIso: fromIso, toDateIso: toIso }
      : null;
  const totalDays = selection === null ? 0 : countLeaveDays(selection);

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

        <Button
          label="Pakka"
          tone="action"
          disabled={!submittable || totalDays === 0}
          onPress={() => {
            /* GAP-21 — unreachable until the endpoint exists. */
          }}
          testID="leave-range-confirm"
        />

        {!submittable && (
          <Text variant="caption" color={color.danger} testID="leave-range-blocked">
            {leaveRequestUnavailableCopy}
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

/** Monday-first month grid, matching the Figma header `M T W T F S S`. */
function currentMonthGrid(): {
  readonly monthLabel: string;
  readonly leadingBlanks: readonly string[];
  readonly days: readonly GridDay[];
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // JS weeks start on Sunday; the design starts on Monday.
  const offset = (first.getDay() + 6) % 7;

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
