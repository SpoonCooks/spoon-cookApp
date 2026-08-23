import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newIdempotencyKey } from '@core/api/cook';
import { apiErrorMessage, isSessionExpired } from '@core/api/errors';
import { toAttendanceMonth } from '@core/api/adapters';
import { useCookProfile, useLeaves, useMarkPresent, useMonthlyAttendance } from '@core/api/queries';
import { formatShortDate } from '@core/domain/money';
import { useSession } from '@core/session/store';
import { Button, color, ErrorState, LoadingState, radius, shadow, spacing, Text } from '@ui';

/**
 * Attendance — Figma `Attendance` section (`540:416`).
 *
 * Three frames are three STATES of one screen, selected by the server's record of today:
 *
 *   `506:1986` Page 11   — no record yet   → `aaj aap kaam pai aaye hai?` + `Mark Present`
 *   `526:292`  Page 12a  — `present`       → `Aaj ke liye PRESENT!` + today's break
 *   `525:132`  Page 12b  — `absent`        → `Aaj ke liye ABSENT!`
 *
 * ## `Present` is a real command
 *
 * `POST /v1/cook/attendance/present` exists and is connected. The server owns the service date,
 * the check-in timestamp and the on-time ruling, so nothing is marked locally: the button submits,
 * the profile and month are invalidated, and the screen re-renders from the server's record.
 *
 * A replay answers `created: false` with the ORIGINAL check-in — the "already present" case is a
 * success, not an error, which is why the idempotency key is created once per mount rather than
 * per tap.
 *
 * ## `Chutti lagaye` is connected
 *
 * `POST /v1/cook/leaves` is deployed, so the pickers submit for real and the submission gate that
 * stood here is gone. `GET /cook/leaves` returns REQUESTS grouped by `leave_request_id` — pending,
 * approved and rejected alike — so `Aane wali chutti` below shows each request in the state the
 * server holds it in, and a pending request is never rendered as granted.
 */
/**
 * Why the Present button is unavailable, in the cook's language.
 *
 * Keyed on the backend's `reason` rather than on anything inferred locally, so the app never
 * explains a refusal the server did not make. `READY` is present for exhaustiveness only — the
 * button is shown in that state, so the copy is never rendered.
 */
const checkInBlockedCopy: Record<
  'READY' | 'NO_SHIFT' | 'APPROVED_LEAVE' | 'ALREADY_CHECKED_IN' | 'ATTENDANCE_RECORDED',
  string
> = {
  READY: '',
  NO_SHIFT: 'Aaj aapki koi shift nahi hai.',
  APPROVED_LEAVE: 'Aaj aapki chutti approve hai.',
  ALREADY_CHECKED_IN: 'Aaj aap already present ho.',
  ATTENDANCE_RECORDED: 'Aaj ki attendance already darj ho chuki hai.',
};

/** Server instant → local clock time. Presentation only; the ruling stays the backend's. */
function formatCheckInWindow(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function AttendanceScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const signOut = useSession((s) => s.signOut);

  // One key per mount: a double-tap or a post-timeout retry replays the SAME command.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const profile = useCookProfile();
  const month = useMemo(() => (profile.data?.serverTime ?? '').slice(0, 7), [profile.data]);
  const attendance = useMonthlyAttendance(month, month.length === 7);
  const leaves = useLeaves({}, month.length === 7);
  const markPresent = useMarkPresent(idempotencyKey, month);

  const todayIso = useMemo(() => (profile.data?.serverTime ?? '').slice(0, 10), [profile.data]);
  const monthView = useMemo(
    () =>
      attendance.data === undefined
        ? null
        : toAttendanceMonth(attendance.data, leaves.data ?? null, todayIso),
    [attendance.data, leaves.data, todayIso],
  );

  const refreshing = profile.isFetching || attendance.isFetching || leaves.isFetching;
  const onRefresh = (): void => {
    void profile.refetch();
    void attendance.refetch();
    void leaves.refetch();
  };

  if (profile.isPending) return <LoadingState testID="attendance-loading" />;

  if (profile.isError) {
    if (isSessionExpired(profile.error)) {
      signOut();
      router.replace('/login');
    }
    return (
      <ErrorState
        message={apiErrorMessage(profile.error)}
        onRetry={() => void profile.refetch()}
        testID="attendance-error"
      />
    );
  }

  const today = profile.data.today;
  const status = today.attendance?.status ?? null;
  const shift = today.shift;

  // The SERVER decides eligibility. `canCheckIn` already accounts for the shift, approved leave,
  // an existing record and cook status, so nothing is re-derived here: the earlier local rule
  // (`hasShiftToday && status === null`) offered the button to a cook on approved leave and let
  // the backend refuse the tap.
  const canMark = today.canCheckIn;

  const headline =
    status === 'present'
      ? 'aaj aap kaam pai aaye hai.'
      : status === 'absent' || status === 'leave'
        ? 'aaj aap kaam pai NAHI aaye hai.'
        : 'aaj aap kaam pai aaye hai?';

  const verdict =
    status === 'present'
      ? 'Aaj ke liye PRESENT!'
      : status === 'absent'
        ? 'Aaj ke liye ABSENT!'
        : status === 'leave'
          ? 'Aaj chutti hai'
          : null;

  return (
    <View style={styles.flex}>
      <View style={[styles.banner, { paddingTop: insets.top + spacing.s }]}>
        <Text variant="headingLg">{`Namaste, ${profile.data.cook.name}`}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="attendance-scroll"
      >
        <View style={styles.presentCard} testID="attendance-present-card">
          <Text variant="bodyStrong" testID="attendance-headline">
            {headline}
          </Text>

          {verdict !== null && (
            <Text
              variant="titleBlack"
              color={status === 'present' ? color.textPrimary : color.danger}
              testID="attendance-verdict"
            >
              {verdict}
            </Text>
          )}

          {canMark && (
            <>
              <Button
                label="Mark Present"
                tone="action"
                loading={markPresent.isPending}
                onPress={() => markPresent.mutate()}
                testID="attendance-mark-present"
              />
              {/* The Figma reads "Shift se 30 mins pehle tak button dabaye". No such rule exists:
                  the backend has no approved opening window and returns `checkInOpensAt: null`.
                  Printing that copy would state a restriction the server does not enforce, so the
                  hint appears ONLY once the backend actually publishes a window. Recorded as copy
                  drift in the closure report. */}
              {today.checkInOpensAt !== null && (
                <Text variant="captionMuted" testID="attendance-present-hint">
                  {`Check-in ${formatCheckInWindow(today.checkInOpensAt)} se khulta hai`}
                </Text>
              )}
            </>
          )}

          {!canMark && status === null && (
            <Text variant="captionMuted" testID="attendance-no-shift">
              {checkInBlockedCopy[today.reason]}
            </Text>
          )}

          {markPresent.isError && (
            <Text variant="caption" color={color.danger} testID="attendance-mark-error">
              {apiErrorMessage(markPresent.error)}
            </Text>
          )}
        </View>

        {status === 'present' && shift !== null && (
          <View style={styles.breakCard} testID="attendance-break-card">
            <Text variant="labelStrong">aaj ka break</Text>
            <Text variant="captionMuted">{`Duration: ${breakDuration(shift.breakStartLocalTime, shift.breakEndLocalTime)}`}</Text>
            <View style={styles.breakRow}>
              <Text variant="bodyStrong">{formatLocalTime(shift.breakStartLocalTime)}</Text>
              <Text variant="captionMuted">TO</Text>
              <Text variant="bodyStrong">{formatLocalTime(shift.breakEndLocalTime)}</Text>
            </View>
          </View>
        )}

        <View style={styles.leaveCard} testID="attendance-leave-card">
          <Text variant="titleBlack">Chutti lagaye</Text>
          <Text variant="captionMuted">Aap jitne din aaye, utne din ke paise milenge</Text>

          <Button
            label="1 din ki chutti"
            tone="ghost"
            onPress={() => router.push('/leave/single')}
            testID="attendance-leave-single"
          />
          <Button
            label="lambi chutti"
            tone="ghost"
            onPress={() => router.push('/leave/range')}
            testID="attendance-leave-range"
          />
        </View>

        {monthView !== null && monthView.upcomingLeaves.length > 0 && (
          <View style={styles.leaveCard} testID="attendance-upcoming-leaves">
            <Text variant="titleBlack">Aane wali chutti</Text>
            {monthView.upcomingLeaves.map((leave) => (
              <View key={leave.id} style={styles.leaveRow} testID={`attendance-leave-${leave.id}`}>
                <Text variant="bodyStrong">
                  {leave.startDateIso === leave.endDateIso
                    ? formatShortDate(leave.startDateIso)
                    : `${formatShortDate(leave.startDateIso)} se ${formatShortDate(leave.endDateIso)} tak`}
                </Text>
                <Text
                  variant="caption"
                  color={leave.status === 'approved' ? color.textPrimary : color.textSecondary}
                >
                  {leaveStatusCopy[leave.status]}
                </Text>
              </View>
            ))}
          </View>
        )}

        {attendance.isError ? (
          <ErrorState
            message={apiErrorMessage(attendance.error)}
            onRetry={() => void attendance.refetch()}
            testID="attendance-month-error"
          />
        ) : attendance.data !== undefined ? (
          <View style={styles.tileRow} testID="attendance-tiles">
            <Tile value={String(attendance.data.presentTotal)} label="Present" />
            <Tile value={String(attendance.data.leaveTotal)} label="Chutti" />
            <Tile
              value={
                attendance.data.onTimePercentage === null
                  ? '—'
                  : `${attendance.data.onTimePercentage}%`
              }
              label="On-Time"
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * How each leave state reads to the cook.
 *
 * `pending` must never sound settled: a cook who reads "lag gyi" stays home on a day Ops has not
 * approved. Exhaustive over `LeaveEntry['status']`, so a new backend state is a compile error here
 * rather than a blank label on the screen.
 */
const leaveStatusCopy: Record<'approved' | 'pending' | 'rejected' | 'cancelled', string> = {
  approved: 'Chutti lag gyi',
  pending: 'Manager approve karenge',
  rejected: 'Chutti nahi mili',
  cancelled: 'Cancel ho gyi',
};

/** `12:15:00` → `12:15 PM`. Presentation only; the server supplies the local time. */
function formatLocalTime(value: string): string {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minuteText ?? '00'} ${suffix}`;
}

function breakDuration(start: string, end: string): string {
  const toMinutes = (value: string): number => {
    const [h, m] = value.split(':');
    return Number(h) * 60 + Number(m ?? 0);
  };
  const minutes = toMinutes(end) - toMinutes(start);
  if (Number.isNaN(minutes) || minutes <= 0) return '—';
  const hours = minutes / 60;
  return Number.isInteger(hours)
    ? `${hours} hrs`
    : `${(Math.round(hours * 10) / 10).toFixed(1)} hrs`;
}

function Tile({ value, label }: { value: string; label: string }): React.ReactElement {
  return (
    <View style={styles.tile}>
      <Text variant="display">{value}</Text>
      <Text variant="label">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { paddingHorizontal: spacing.xl, paddingBottom: spacing.m, gap: spacing.xxs },
  content: { paddingHorizontal: spacing.xl, gap: spacing.l },
  presentCard: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    padding: spacing.l,
    gap: spacing.m,
    ...shadow.card,
  },
  breakCard: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.xl,
    padding: spacing.l,
    gap: spacing.xs,
  },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  leaveCard: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    padding: spacing.l,
    gap: spacing.m,
  },
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
  },
  tileRow: { flexDirection: 'row', gap: spacing.m },
  tile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.l,
    paddingVertical: spacing.m,
    gap: spacing.xxs,
  },
});
