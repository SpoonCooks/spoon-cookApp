import { StyleSheet, View } from 'react-native';

import type { AttendanceMonth, DayMark } from '@core/domain/attendance';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from '../primitives/Text';

/**
 * Monthly attendance calendar from the Figma Attendance & Leaves screen (`505:1596`).
 *
 * ## The legend distinction that matters
 *
 * Figma shows three swatches — `Present`, `On Leave`, `Scheduled` — but only the first two are
 * attendance facts. `Scheduled` comes from shift/booking data. `DayMark` keeps them as separate
 * variants so nothing can accidentally write `scheduled` into `cook_attendance.status`, whose
 * backend CHECK constraint permits only `present | absent | leave`.
 */
export interface AttendanceCalendarProps {
  readonly month: AttendanceMonth;
  readonly testID?: string;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function markColor(mark: DayMark): string | null {
  switch (mark.kind) {
    case 'attendance':
      if (mark.status === 'present') return color.lime600;
      if (mark.status === 'leave') return color.yellow400;
      return color.grey300;
    case 'scheduled':
      return color.grey100;
    case 'none':
      return null;
  }
}

export function AttendanceCalendar({
  month,
  testID = 'attendance-calendar',
}: AttendanceCalendarProps): React.ReactElement {
  // Leading blanks so day 1 lands on its real weekday.
  const firstDay = month.days[0];
  const leadingBlanks =
    firstDay === undefined ? 0 : new Date(`${firstDay.dateIso}T00:00:00`).getDay();

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text variant="titleBlack">{month.monthLabel}</Text>
        <Text variant="captionMuted">{month.cycleLabel}</Text>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, i) => (
          <View key={`${label}-${i}`} style={styles.cell}>
            <Text variant="label">{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <View key={`blank-${i}`} style={styles.cell} />
        ))}
        {month.days.map((day) => {
          const bg = markColor(day.mark);
          const dayNumber = Number(day.dateIso.slice(-2));
          return (
            <View key={day.dateIso} style={styles.cell} testID={`day-${day.dateIso}`}>
              <View style={[styles.dayDot, bg !== null && { backgroundColor: bg }]}>
                <Text variant="label" color={color.textPrimary}>
                  {dayNumber}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendSwatch tone={color.lime600} label="Present" />
        <LegendSwatch tone={color.yellow400} label="On Leave" />
        <LegendSwatch tone={color.grey100} label="Scheduled" />
      </View>
    </View>
  );
}

function LegendSwatch({ tone, label }: { tone: string; label: string }): React.ReactElement {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: tone }]} />
      <Text variant="label">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    padding: spacing.l,
    gap: spacing.m,
  },
  header: { gap: spacing.xxs },
  weekRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Seven columns; percentage width keeps the grid aligned on every screen width.
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.l, paddingTop: spacing.s },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: radius.xs },
});
