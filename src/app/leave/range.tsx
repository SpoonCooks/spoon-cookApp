import { router } from 'expo-router';
import { useState } from 'react';

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
import { LongLeaveSheetView } from '@features/leave/LeaveViews';
import { monthLabel } from '@features/leave/leaveModel';
import { ErrorState, LoadingState } from '@ui';

/**
 * `Lambi Chutti` — the V13 month-grid sheet (`592:563` empty, `592:639` a range chosen).
 *
 * Selection is a first-and-last tap producing an inclusive range, which is what `Total din` counts
 * and what the grid paints: the two endpoints in `#cfff04`, everything between them in `#ecff9b`.
 *
 * ## The grid is anchored to the SERVER's month
 *
 * The month shown, and the first day that can be picked, both come from `profile.serverTime`. A
 * device on the wrong date would otherwise open on a month the backend has moved past and offer
 * days it would reject.
 *
 * ## Submission is live, and the result is a REQUEST
 *
 * `POST /v1/cook/leaves` takes `{ startDate, endDate }` with an `Idempotency-Key` and answers
 * `201 pending`. A multi-day chutti is ONE request server-side — grouped by `leave_request_id` —
 * so the range is submitted whole rather than day by day, and the confirmation says the request
 * was sent, never that the leave was granted.
 */
export default function RangeLeaveScreen(): React.ReactElement {
  const [fromDay, setFromDay] = useState<number | null>(null);
  const [toDay, setToDay] = useState<number | null>(null);

  // One key per mount, so a retry after a timeout replays rather than filing a second chutti.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const profile = useCookProfile();
  const todayIso = (profile.data?.serverTime ?? '').slice(0, 10);
  const requestLeave = useRequestLeave(todayIso.slice(0, 7));

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

  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));
  const firstOpenDay = Number(todayIso.slice(8, 10));

  const selection: LeaveRequestKind | null =
    fromDay === null
      ? null
      : {
          kind: 'date_range',
          fromDateIso: isoFor(year, month, fromDay),
          toDateIso: isoFor(year, month, toDay ?? fromDay),
        };
  const totalDays = selection === null ? 0 : countLeaveDays(selection);
  const validation = selection === null ? null : validateLeaveSelection(selection, todayIso);
  const submitted = requestLeave.isSuccess;

  const onPickDay = (day: number): void => {
    if (submitted) return;
    // First tap sets the start; the second closes the range. A third starts over, which is what
    // lets a cook correct a mis-tap without leaving the sheet.
    if (fromDay === null || toDay !== null) {
      setFromDay(day);
      setToDay(null);
      return;
    }
    if (day < fromDay) {
      setFromDay(day);
      return;
    }
    setToDay(day);
  };

  const submit = (): void => {
    if (selection === null || validation?.ok !== true || requestLeave.isPending || submitted)
      return;
    const range = toLeaveRequestRange(selection);
    requestLeave.mutate({
      startDateIso: range.startDateIso,
      endDateIso: range.endDateIso,
      idempotencyKey,
    });
  };

  const notice =
    validation !== null && !validation.ok
      ? validation.message
      : requestLeave.isError
        ? apiErrorMessage(requestLeave.error)
        : submitted
          ? leaveRequestPendingCopy
          : null;

  return (
    <LongLeaveSheetView
      year={year}
      month={month}
      monthLabel={monthLabel(todayIso)}
      firstOpenDay={firstOpenDay}
      selection={fromDay === null ? null : { fromDay, toDay: toDay ?? fromDay }}
      totalDays={totalDays}
      canConfirm={validation?.ok === true && !submitted && !requestLeave.isPending}
      onPickDay={onPickDay}
      onConfirm={submit}
      onBack={() => router.back()}
      notice={notice}
    />
  );
}

function isoFor(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
