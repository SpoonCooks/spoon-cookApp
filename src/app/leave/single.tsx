import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { newIdempotencyKey } from '@core/api/cook';
import { apiErrorMessage } from '@core/api/errors';
import { useCookProfile, useRequestLeave } from '@core/api/queries';
import {
  leaveRequestPendingCopy,
  toLeaveRequestRange,
  validateLeaveSelection,
  type LeaveRequestKind,
} from '@core/domain/leave';
import { ShortLeaveSheetView } from '@features/leave/LeaveViews';
import { addDays, formatDayLabel, relativeDayLabel } from '@features/leave/leaveModel';
import { ErrorState, LoadingState } from '@ui';
import { openSupportWhatsApp } from '@core/support/whatsapp';

/**
 * `1 din ki Chutti` — the V13 confirmation sheet (`592:888`).
 *
 * A bottom sheet over an 80% scrim: the chosen day, the warning that unworked days are unpaid, and
 * `Pakka`. The day itself is chosen on the CHUTTI destination and arrives as a route param, so
 * this screen confirms a decision rather than making one.
 *
 * ## `Pakka` submits, and the result is a REQUEST
 *
 * `POST /v1/cook/leaves` takes `{ startDate, endDate }` and an `Idempotency-Key` and answers `201`
 * with `status: 'pending'`. Ops/Admin decide, so the confirmation reads `Chutti ki request bhej
 * di` and never `Chutti lag gyi`. Nothing is marked locally; the leave list and the month are
 * invalidated and re-read.
 *
 * ## The service date is the server's
 *
 * The fallback day is derived from `profile.serverTime`, not `new Date()`. A device an hour behind
 * midnight would otherwise confirm a date the backend has already rolled past.
 */
export default function SingleDayLeaveScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ date?: string }>();

  // One key per mount: a double-tap or a post-timeout retry replays the SAME request rather than
  // filing a second chutti.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const profile = useCookProfile();
  const todayIso = (profile.data?.serverTime ?? '').slice(0, 10);
  const requestLeave = useRequestLeave(todayIso.slice(0, 7));

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

  const presentToday = profile.data.today.attendance?.status === 'present';
  const fallbackOffset = presentToday ? 1 : 0;
  const selectedIso = params.date ?? addDays(todayIso, fallbackOffset);
  const offset = daysBetween(todayIso, selectedIso);

  const selection: LeaveRequestKind = { kind: 'single_day', dateIso: selectedIso };
  const validation = validateLeaveSelection(selection, todayIso);
  const submitted = requestLeave.isSuccess;

  const submit = (): void => {
    if (!validation.ok || requestLeave.isPending || submitted) return;
    const range = toLeaveRequestRange(selection);
    requestLeave.mutate({
      startDateIso: range.startDateIso,
      endDateIso: range.endDateIso,
      idempotencyKey,
    });
  };

  const notice = !validation.ok
    ? validation.message
    : requestLeave.isError
      ? apiErrorMessage(requestLeave.error)
      : submitted
        ? leaveRequestPendingCopy
        : null;

  return (
    <ShortLeaveSheetView
      dayLabel={formatDayLabel(selectedIso)}
      relativeLabel={relativeDayLabel(offset)}
      canConfirm={validation.ok && !submitted && !requestLeave.isPending}
      onConfirm={submit}
      onBack={() => router.back()}
      onHelp={() => void openSupportWhatsApp(profile.data.cook.name)}
      notice={notice}
    />
  );
}

/** Whole days from `fromIso` to `toIso`, or -1 when either is unusable. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return -1;
  return Math.round((to - from) / 86_400_000);
}
