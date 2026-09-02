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
import { addDays, leaveRequestErrorMessage, monthLabel } from '@features/leave/leaveModel';
import { ErrorState, LoadingState } from '@ui';
import { openSupportWhatsApp } from '@core/support/whatsapp';

/**
 * `Lambi Chutti` — the V13 month-grid sheet (`592:563` empty, `592:639` a range chosen).
 *
 * Selection is a first-and-last tap producing an inclusive range, which is what `Total din` counts
 * and what the grid paints: the two endpoints in `#cfff04`, everything between them in `#ecff9b`.
 * Once a range is closed, a tap outside it EXTENDS the nearer edge — so day-by-day tapping keeps
 * growing the chutti — and a tap on or inside it starts a fresh selection.
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
/**
 * How far ahead a cook may page the grid.
 *
 * There is no product ceiling on how distant a chutti may be, so this is a UI bound rather than a
 * rule: eleven months forward keeps every month of the coming year reachable while stopping the
 * chevron from running away into 2031. The backend validates the dates regardless.
 */
const MAX_MONTHS_AHEAD = 11;

export default function RangeLeaveScreen(): React.ReactElement {
  const [fromDay, setFromDay] = useState<number | null>(null);
  const [toDay, setToDay] = useState<number | null>(null);
  /**
   * Months AHEAD of the server's current month, which is where the grid opens.
   *
   * The screen used to derive its year and month straight from `serverTime` as constants and pass
   * no month handlers at all, so both chevrons were inert: a cook could see August and could
   * never reach September, which made a chutti more than a few weeks out impossible to request.
   * Held as an offset rather than a date so the anchor stays the SERVER's month — the same
   * reasoning that put the grid on server time in the first place.
   */
  const [monthsAhead, setMonthsAhead] = useState(0);

  // One key per mount, so a retry after a timeout replays rather than filing a second chutti.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const profile = useCookProfile();
  const todayIso = (profile.data?.serverTime ?? '').slice(0, 10);

  // The month the GRID is on, computed before the early returns so the hook order is identical
  // on every path. Empty while the profile loads, which `useRequestLeave` already tolerates.
  const serverYear = Number(todayIso.slice(0, 4));
  const serverMonth = Number(todayIso.slice(5, 7));
  const shown = serverMonth - 1 + monthsAhead;
  const year = serverYear + Math.floor(shown / 12);
  const month = (shown % 12) + 1;
  const shownMonthKey = todayIso === '' ? '' : `${year}-${String(month).padStart(2, '0')}`;

  // The month whose attendance must be re-read is the one the leave is IN, not the one the cook
  // happens to be standing in — a chutti filed for September left September's grid stale.
  const requestLeave = useRequestLeave(shownMonthKey);

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

  /*
   * The earliest day a LONG leave may start, greyed out before it.
   *
   * Two rules, and both are the server's. Today closes the days behind it — but only in the month
   * today is in; every later month opens from the first, which the old code got wrong by applying
   * the server's day-of-month to whatever month was on screen.
   *
   * On top of that, a multi-day leave needs notice. `requestCookLeave` refuses a long leave that
   * starts sooner than `longLeaveNoticeDays`, so a calendar that let one be selected would offer a
   * range the server rejects under the cook's thumb. The number comes from the profile rather than
   * a constant here: two copies drift the moment operations tunes it.
   */
  const noticeDays = profile.data?.leavePolicy?.longLeaveNoticeDays ?? 0;
  const earliestIso = addDays(todayIso, noticeDays);
  const earliestMonthKey = earliestIso.slice(0, 7);
  const firstOpenDay =
    shownMonthKey === '' || shownMonthKey > earliestMonthKey
      ? 1
      : shownMonthKey < earliestMonthKey
        ? Number.MAX_SAFE_INTEGER
        : Number(earliestIso.slice(8, 10));

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
    // First tap sets the start; the second closes the range.
    if (fromDay === null) {
      setFromDay(day);
      setToDay(null);
      return;
    }
    if (toDay === null) {
      if (day < fromDay) {
        setFromDay(day);
        return;
      }
      setToDay(day);
      return;
    }
    // The range is closed: a tap OUTSIDE it moves the nearer edge, so tapping days one by one
    // (27, 28, 29…) keeps growing the chutti instead of throwing it away after two taps. A tap on
    // or inside the range starts over, which is what lets a cook correct a mis-tap without
    // leaving the sheet.
    if (day < fromDay) {
      setFromDay(day);
      return;
    }
    if (day > toDay) {
      setToDay(day);
      return;
    }
    setFromDay(day);
    setToDay(null);
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
        ? leaveRequestErrorMessage(requestLeave.error)
        : submitted
          ? leaveRequestPendingCopy
          : null;

  return (
    <LongLeaveSheetView
      year={year}
      month={month}
      monthLabel={monthLabel(isoFor(year, month, 1))}
      firstOpenDay={firstOpenDay}
      selection={fromDay === null ? null : { fromDay, toDay: toDay ?? fromDay }}
      totalDays={totalDays}
      canConfirm={validation?.ok === true && !submitted && !requestLeave.isPending}
      onPickDay={onPickDay}
      /*
       * Paging clears the selection. `fromDay`/`toDay` are bare day NUMBERS, so a range left
       * standing across a month change would silently re-point at the new month — 3-7 August
       * becoming 3-7 September under a cook who only meant to look.
       */
      {...(monthsAhead > 0
        ? {
            onPrevMonth: () => {
              setFromDay(null);
              setToDay(null);
              setMonthsAhead((current) => current - 1);
            },
          }
        : {})}
      {...(monthsAhead < MAX_MONTHS_AHEAD
        ? {
            onNextMonth: () => {
              setFromDay(null);
              setToDay(null);
              setMonthsAhead((current) => current + 1);
            },
          }
        : {})}
      onConfirm={submit}
      onBack={() => router.back()}
      onHelp={() => void openSupportWhatsApp(profile.data.cook.name)}
      notice={notice}
    />
  );
}

function isoFor(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
