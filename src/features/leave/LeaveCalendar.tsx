import { Pressable, StyleSheet, View } from 'react-native';

import { SvgXml } from 'react-native-svg';

import { Text, color, figmaStroke, useDesignScale } from '@ui';
import { chevron, monthPrev } from '@ui/icons/figmaV13Icons';

/**
 * `505:1690` — the month grid inside the `Lambi Chutti` sheet.
 *
 * ## Day states are the design's, not a generic calendar's
 *
 * V13 paints five distinct fills and they carry different meanings, so they are typed rather than
 * derived from one "selected" boolean:
 *
 * | state       | fill      | meaning                                                        |
 * | ----------- | --------- | -------------------------------------------------------------- |
 * | `heading`   | `#ffde33` | a weekday letter, not a day                                     |
 * | `closed`    | `#f5f5f5` | before the first bookable service date — not pressable          |
 * | `open`      | `#fff7cc` | bookable                                                        |
 * | `edge`      | `#cfff04` | the first or last day of the chosen range                       |
 * | `inRange`   | `#ecff9b` | between the two edges                                           |
 *
 * ## The grid is built from a real month
 *
 * `592:563` and `592:639` both draw a **31st of November**, which does not exist. Reproducing it
 * would put a date on screen that the backend would reject, so the grid is generated from the real
 * length of the month it is given and that one cell is left empty. It is the only place either
 * frame is knowingly not matched, and it is recorded in the closure report rather than absorbed.
 *
 * Weeks start on Monday, which is what the `M T W T F S S` heading row states.
 */
export type LeaveDayState = 'closed' | 'open' | 'edge' | 'inRange';

export interface LeaveCalendarProps {
  /** Four-digit year of the month being shown. */
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  /** `529:1256` — e.g. `November`. Supplied rather than derived so the label stays the caller's. */
  readonly monthLabel: string;
  /**
   * First bookable service date in this month, 1-31, or null when the whole month is bookable.
   * Days before it paint `closed`. Taken from the server's date, never the device clock.
   */
  readonly firstOpenDay: number | null;
  /** Inclusive chosen range within this month, or null. */
  readonly selection: { readonly fromDay: number; readonly toDay: number } | null;
  readonly onPickDay?: ((day: number) => void) | undefined;
  readonly onPrevMonth?: (() => void) | undefined;
  readonly onNextMonth?: (() => void) | undefined;
}

const GRID = {
  cardPadding: 19.889,
  cardRadius: 24,
  cardGap: 12,
  borderWidth: 1,
  /** `530:1363` — a far softer card shadow than the attendance card's yellow glow. */
  shadow: '0px 4px 20px 0px rgba(0, 0, 0, 0.03)',
  monthRowPaddingV: 6,
  monthRowGap: 39,
  monthLabelWidth: 139,
  arrowSize: 32,
  columnGap: 6,
  rowGap: 10,
  headingHeight: 32,
  bodyHeight: 242,
  rows: 6,
  cellRadius: 5,
  cellPaddingV: 4,
  cellTextWidth: 25,
} as const;

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

const DAY_FILL: Record<LeaveDayState, string> = {
  closed: color.smoke,
  open: color.yellow200,
  edge: color.lime600,
  inRange: color.lime300,
};

/** Monday-first column index, 0-6, for the first day of the month. */
function firstColumn(year: number, month: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (weekday + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dayState(
  day: number,
  firstOpenDay: number | null,
  selection: { readonly fromDay: number; readonly toDay: number } | null,
): LeaveDayState {
  if (firstOpenDay !== null && day < firstOpenDay) return 'closed';
  if (selection === null) return 'open';
  if (day === selection.fromDay || day === selection.toDay) return 'edge';
  if (day > selection.fromDay && day < selection.toDay) return 'inRange';
  return 'open';
}

export function LeaveCalendar({
  year,
  month,
  monthLabel,
  firstOpenDay,
  selection,
  onPickDay,
  onPrevMonth,
  onNextMonth,
}: LeaveCalendarProps): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;

  const offset = firstColumn(year, month);
  const total = daysInMonth(year, month);
  // Six explicit rows of seven, rather than one wrapping container: a wrapping row sized by
  // `flexBasis: 0` would fit all forty-two cells on one line, and one sized by a computed width
  // would wrap a column early as soon as rounding cost it a fraction of a dp.
  const weeks: (number | null)[][] = Array.from({ length: GRID.rows }, (_, week) =>
    Array.from({ length: 7 }, (_, column) => {
      const day = week * 7 + column - offset + 1;
      return day >= 1 && day <= total ? day : null;
    }),
  );

  const rowHeight = (GRID.bodyHeight - (GRID.rows - 1) * GRID.rowGap) / GRID.rows;

  return (
    <View
      style={[
        styles.card,
        figmaStroke(scale, { width: GRID.borderWidth, padding: GRID.cardPadding }),
        { borderRadius: s(GRID.cardRadius), gap: s(GRID.cardGap) },
      ]}
      testID="leave-calendar"
    >
      <View
        style={[
          styles.monthRow,
          { paddingVertical: s(GRID.monthRowPaddingV), gap: s(GRID.monthRowGap) },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pichla mahina"
          onPress={onPrevMonth}
          testID="leave-calendar-prev"
        >
          <SvgXml xml={monthPrev} width={s(GRID.arrowSize)} height={s(GRID.arrowSize)} />
        </Pressable>
        <View style={{ width: s(GRID.monthLabelWidth) }}>
          <Text variant="headingLgBold" align="center" testID="leave-calendar-month">
            {monthLabel}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agla mahina"
          onPress={onNextMonth}
          testID="leave-calendar-next"
        >
          {/* `529:1247` rotates the same glyph 180 degrees rather than shipping a second file. */}
          <SvgXml
            xml={chevron}
            width={s(GRID.arrowSize)}
            height={s(GRID.arrowSize)}
            style={styles.flipped}
          />
        </Pressable>
      </View>

      <View style={[styles.row, { height: s(GRID.headingHeight), columnGap: s(GRID.columnGap) }]}>
        {WEEKDAYS.map((letter, index) => (
          <View
            key={`${letter}-${index}`}
            style={[
              styles.cell,
              {
                backgroundColor: color.yellow500,
                borderRadius: s(GRID.cellRadius),
                paddingVertical: s(GRID.cellPaddingV),
              },
            ]}
          >
            <Text
              variant="calendarDay"
              align="center"
              style={[styles.cellText, { width: s(GRID.cellTextWidth) }]}
            >
              {letter}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.body, { height: s(GRID.bodyHeight), rowGap: s(GRID.rowGap) }]}>
        {weeks.map((week, weekIndex) => (
          <View
            key={weekIndex}
            style={[styles.row, { height: s(rowHeight), columnGap: s(GRID.columnGap) }]}
          >
            {week.map((day, dayIndex) =>
              day === null ? (
                <View key={`blank-${weekIndex}-${dayIndex}`} style={styles.cell} />
              ) : (
                <DayCell
                  key={day}
                  day={day}
                  state={dayState(day, firstOpenDay, selection)}
                  onPress={onPickDay}
                />
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function DayCell({
  day,
  state,
  onPress,
}: {
  day: number;
  state: LeaveDayState;
  onPress?: ((day: number) => void) | undefined;
}): React.ReactElement {
  const { s } = useDesignScale();
  const closed = state === 'closed';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={String(day)}
      accessibilityState={{ disabled: closed, selected: state === 'edge' || state === 'inRange' }}
      disabled={closed}
      android_ripple={null}
      onPress={() => onPress?.(day)}
      style={[
        styles.cell,
        {
          backgroundColor: DAY_FILL[state],
          borderRadius: s(GRID.cellRadius),
          paddingVertical: s(GRID.cellPaddingV),
        },
      ]}
      testID={`leave-calendar-day-${day}`}
    >
      <Text
        variant="calendarDay"
        align="center"
        style={[styles.cellText, { width: s(GRID.cellTextWidth) }]}
      >
        {day}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    borderColor: color.yellow600,
    backgroundColor: color.white,
    boxShadow: GRID.shadow,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  flipped: { transform: [{ rotate: '180deg' }] },
  body: { alignSelf: 'stretch', backgroundColor: color.white },
  row: { flexDirection: 'row', alignSelf: 'stretch', backgroundColor: color.white },
  /**
   * `flexBasis: 0` with `flexGrow: 1` reproduces the design's `repeat(7, minmax(0, 1fr))`: seven
   * equal tracks that share whatever the column gaps leave, rather than seven boxes sized to their
   * content. A percentage width would round each cell independently and drift by the last column.
   */
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { flexGrow: 0 },
});
