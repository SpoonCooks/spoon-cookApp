import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newIdempotencyKey } from '@core/api/cook';
import {
  canSubmitLeaveRequest,
  countLeaveDays,
  leaveRequestUnavailableCopy,
  type LeaveRequestKind,
} from '@core/domain/leave';
import { Button, color, radius, spacing, Text } from '@ui';

/**
 * `1 din ki chutti` — Figma `Page 14a- 1day` (`528:483`) and `Page 14b- 1day confirm` (`529:1259`).
 *
 * Page 14a is the confirmation: `Chutti pakka hai?` over the chosen day, with a `Pakka` button.
 * Page 14b is the same attendance surface with that day switched from `Chutti` to `Chutti lag gyi`.
 *
 * ## Why `Pakka` cannot complete
 *
 * There is no cook-side leave write in the backend (GAP-21). Rendering `Chutti lag gyi` on a tap
 * would tell the cook a leave was booked that no server has recorded — and the cook would then not
 * turn up. So the confirm affordance is disabled and the reason is stated in the cook's language.
 *
 * The day chips and the confirmation copy are implemented exactly as designed, so when the endpoint
 * lands this screen needs a mutation call and a flag flip, not a redesign.
 */
export default function SingleDayLeaveScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [idempotencyKey] = useState(newIdempotencyKey);

  // Computed once per mount so the chips do not shift if the component re-renders across midnight.
  const [options] = useState(nextThreeDays);
  const [selectedIso, setSelectedIso] = useState<string>(options[0]?.dateIso ?? '');

  const selection: LeaveRequestKind = { kind: 'single_day', dateIso: selectedIso };
  const submittable = canSubmitLeaveRequest();

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
                  onPress={() => setSelectedIso(option.dateIso)}
                  testID={`leave-day-pick-${option.dateIso}`}
                />
              </View>
            );
          })}
        </View>

        <Text variant="captionMuted" testID="leave-single-total">
          {`Total din ${countLeaveDays(selection)}`}
        </Text>

        <Button
          label="Pakka"
          tone="action"
          disabled={!submittable}
          onPress={() => {
            // GAP-21: intentionally unreachable while `canSubmitLeaveRequest()` is false. The
            // idempotency key is already prepared so the future call is a one-line addition.
            void idempotencyKey;
          }}
          testID="leave-single-confirm"
        />

        {!submittable && (
          <Text variant="caption" color={color.danger} testID="leave-single-blocked">
            {leaveRequestUnavailableCopy}
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
 * `Aaj` / `Kal` / `Parso`, matching the Figma chips.
 *
 * These are picker LABELS only. The authoritative service date for any submitted leave would be
 * the server's, exactly as it is for attendance — the device clock never decides a service date.
 */
function nextThreeDays(): readonly DayOption[] {
  const labels = ['Aaj', 'Kal', 'Parso'] as const;
  const base = new Date();
  return labels.map((relativeLabel, offset) => {
    const day = new Date(base.getTime() + offset * 86_400_000);
    const month = MONTHS[day.getMonth()] ?? '';
    return {
      dateIso: day.toISOString().slice(0, 10),
      dayLabel: `${day.getDate()} ${month}`,
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
