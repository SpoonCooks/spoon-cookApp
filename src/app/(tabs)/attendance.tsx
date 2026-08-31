import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { newIdempotencyKey } from '@core/api/cook';
import { apiErrorMessage, isSessionExpired } from '@core/api/errors';
import { useCookProfile, useMarkPresent } from '@core/api/queries';
import { useSession } from '@core/session/store';
import {
  AbsentView,
  DailyLogInView,
  PresentView,
  ShiftEndedView,
} from '@features/attendance/AttendanceViews';
import { color, ErrorState, LoadingState, spacing, Text } from '@ui';
import { openSupportWhatsApp } from '@core/support/whatsapp';

/**
 * Attendance — the V13 `log in flow` section (`592:1068`).
 *
 * Four frames are four STATES of this one screen, selected by the server's record of today:
 *
 *   `575:2135` 3a- daily log in — no record yet → `aaj aap kaam pai aaye hai?` + `PRESENT`
 *   `575:2137` 3b- present     — `present`      → the green disc + `KAAM DEKHE`
 *   `575:2138` 3c- absent      — `absent`/`leave` → the red disc
 *   `575:2136` 3d- log out     — shift finished → the rest photograph
 *
 * ## What moved out of this screen in V13
 *
 * V12 drew the break card, the `Chutti lagaye` links, the upcoming-leave list and the month tiles
 * here. V13 does not: `592:488` (`leave`) is a separate CHUTTI destination that carries `AAJ KA
 * BREAK` and the leave surfaces, and the month totals belong to `performance`. Those surfaces are
 * not deleted, they are relocated — this screen renders the four frames and nothing else, so a
 * pixel comparison against `575:2135` is a comparison of the whole screen.
 *
 * ## `PRESENT` is a real command
 *
 * `POST /v1/cook/attendance/present` is connected. The server owns the service date, the check-in
 * timestamp and the on-time ruling, so nothing is marked locally: the button submits, the profile
 * and month are invalidated, and the screen re-renders from the server's record. A replay answers
 * `created: false` with the ORIGINAL check-in, which is why the idempotency key is created once
 * per mount rather than per tap.
 *
 * ## The window row states only what the backend enforces
 *
 * `540:402` reads `5:30 AM se pehle tak button dabaye`. The backend publishes no opening rule —
 * `/cook/me` returns `checkInOpensAt: null` — so the row is rendered only once that field carries
 * a real instant. Printing the design's copy unconditionally would send away cooks who are
 * entitled to check in. The frame's own appearance is verified through `/dev/login-flow/daily`,
 * which supplies the deadline the design shows.
 */

/**
 * Why the Present button is unavailable, in the cook's language.
 *
 * Keyed on the backend's `reason` rather than on anything inferred locally, so the app never
 * explains a refusal the server did not make. `READY` is present for exhaustiveness only — the
 * button is shown in that state, so the copy is never rendered.
 */
const checkInBlockedCopy: Record<
  | 'READY'
  | 'NO_SHIFT'
  | 'OUTSIDE_SHIFT'
  | 'APPROVED_LEAVE'
  | 'MARKED_ABSENT'
  | 'MARKED_PRESENT_BY_ADMIN'
  | 'COOK_CHECKED_IN'
  | 'ALREADY_CHECKED_IN'
  | 'ATTENDANCE_RECORDED',
  string
> = {
  READY: '',
  NO_SHIFT: 'Aaj aapki koi shift nahi hai.',
  OUTSIDE_SHIFT: 'Abhi aapki shift ka time nahi hai.',
  APPROVED_LEAVE: 'Aaj aapki chutti approve hai.',
  MARKED_ABSENT: 'Aaj aapko absent mark kiya gaya hai.',
  /*
   * Empty on purpose, and this is the point of the whole change.
   *
   * An Admin recording attendance is not the Cook arriving. The old copy said "Aaj aap
   * already present ho" and the control was hidden, so a Cook who had not checked in was
   * told they had — and given no way to correct it. The server now offers `canCheckIn` in
   * this state, so the screen must show the button rather than a blocking message.
   */
  MARKED_PRESENT_BY_ADMIN: '',
  COOK_CHECKED_IN: 'Aaj aap check-in kar chuke ho.',
  // The pre-split code the deployed backend still sends. It cannot distinguish an Admin's
  // marking from the Cook's own check-in, so it keeps the old blocking copy until the server
  // starts sending the split codes above.
  ALREADY_CHECKED_IN: 'Aaj aap already present ho.',
  ATTENDANCE_RECORDED: 'Aaj ki attendance already darj ho chuki hai.',
};

/** `09:00:00` → `9 AM`. The pill reads `6 AM se 6 PM`, so whole hours drop their `:00`. */
function formatShiftHour(value: string): string | null {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return null;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return minuteText === '00' || minuteText === undefined
    ? `${display} ${suffix}`
    : `${display}:${minuteText} ${suffix}`;
}

/** `571:601`. Null when the server has no shift for today, which hides the pill entirely. */
function shiftWindowLabel(
  shift: { startLocalTime: string; endLocalTime: string } | null,
): string | null {
  if (shift === null) return null;
  const start = formatShiftHour(shift.startLocalTime);
  const end = formatShiftHour(shift.endLocalTime);
  return start === null || end === null ? null : `${start} se ${end}`;
}

/** Server instant → local clock time. Presentation only; the ruling stays the backend's. */
function formatCheckInWindow(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Has today's shift finished?
 *
 * Compared on the device's own clock against the server's instant, the same basis
 * `formatCheckInWindow` already uses — a cook's phone runs in the timezone their shift is stated
 * in. This selects a PRESENTATION only: it never changes the attendance record, and it is reached
 * only from a `present` record the server issued.
 */
function isShiftFinished(serverTimeIso: string, endLocalTime: string): boolean {
  const at = new Date(serverTimeIso);
  if (Number.isNaN(at.getTime())) return false;
  const now = at.getHours() * 60 + at.getMinutes();
  const [hourText, minuteText] = endLocalTime.split(':');
  const end = Number(hourText) * 60 + Number(minuteText ?? 0);
  return !Number.isNaN(end) && now >= end;
}

export default function AttendanceScreen(): React.ReactElement {
  const signOut = useSession((s) => s.signOut);

  // One key per mount: a double-tap or a post-timeout retry replays the SAME command.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const profile = useCookProfile();
  const markPresent = useMarkPresent(idempotencyKey, (profile.data?.serverTime ?? '').slice(0, 7));

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
  const name = profile.data.cook.name;
  /** `707:1534` — the avatar in the top nav is the only route to the profile card. */
  const openProfile = (): void => router.push('/profile');
  /** The Help pill opens WhatsApp at Spoon support with a greeting already written. */
  const openHelp = (): void => void openSupportWhatsApp(name);
  const shiftWindow = shiftWindowLabel(shift);

  if (status === 'present') {
    if (shift !== null && isShiftFinished(profile.data.serverTime, shift.endLocalTime)) {
      return (
        <ShiftEndedView
          name={name}
          shiftWindow={shiftWindow}
          onProfile={openProfile}
          onHelp={openHelp}
        />
      );
    }
    /*
     * An Admin recording attendance is not the Cook arriving.
     *
     * This branch used to return `PresentView` on `status === 'present'` alone, which hid the
     * PRESENT button for good — so a cook whose attendance an Admin had recorded was shown
     * "Aaj ke liye PRESENT!" for a day she had never checked into, and had no way to correct it.
     * The blocking copy for that state was already emptied for this exact reason
     * (`MARKED_PRESENT_BY_ADMIN` above), but the branch above it short-circuited first, so the
     * button could never be reached and the fix never took effect.
     *
     * `canCheckIn` is the server's own ruling and it stays TRUE in this state: `checkInCook`
     * rejects only an existing `check_in_at`, never a status an Admin wrote. So when the server
     * still says she may check in, this falls through to the daily log-in screen and offers the
     * button — and once she has actually checked in, `canCheckIn` goes false and this is where
     * the screen settles.
     */
    if (!today.canCheckIn) {
      return (
        <PresentView
          name={name}
          shiftWindow={shiftWindow}
          onSeeWork={() => router.push('/jobs')}
          onProfile={openProfile}
          onHelp={openHelp}
        />
      );
    }
  }

  if (status === 'absent' || status === 'leave') {
    return (
      <AbsentView name={name} shiftWindow={shiftWindow} onProfile={openProfile} onHelp={openHelp} />
    );
  }

  return (
    <View style={styles.flex}>
      <DailyLogInView
        name={name}
        shiftWindow={shiftWindow}
        onProfile={openProfile}
        onHelp={openHelp}
        // Rendered only once the backend publishes a real opening instant. See the module note.
        markByTime={
          today.checkInOpensAt === null ? null : formatCheckInWindow(today.checkInOpensAt)
        }
        // The SERVER decides eligibility. `canCheckIn` already accounts for the shift, approved
        // leave, an existing record and cook status, so nothing is re-derived here.
        canMark={today.canCheckIn}
        onMarkPresent={() => markPresent.mutate()}
        isSubmitting={markPresent.isPending}
      />
      {(!today.canCheckIn || markPresent.isError) && (
        <View style={styles.notice} testID="attendance-notice">
          {!today.canCheckIn && (
            <Text variant="captionMuted" align="center" testID="attendance-no-shift">
              {checkInBlockedCopy[today.reason]}
            </Text>
          )}
          {markPresent.isError && (
            <Text
              variant="caption"
              align="center"
              color={color.danger}
              testID="attendance-mark-error"
            >
              {apiErrorMessage(markPresent.error)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.white },
  /**
   * Refusals and command failures are drawn BELOW the design's 667-unit content box, where the
   * frame draws nothing. They are real information the cook needs, but V13 has no frame for them,
   * so they must not be laid over content the design does specify.
   */
  notice: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
    gap: spacing.xs,
    backgroundColor: color.white,
  },
});
