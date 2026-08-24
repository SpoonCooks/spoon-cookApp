import { router } from 'expo-router';
import { useMemo } from 'react';

import { apiErrorMessage } from '@core/api/errors';
import { useCookProfile, useLeaves } from '@core/api/queries';
import { ChuttiView } from '@features/leave/LeaveViews';
import {
  breakDurationLabel,
  formatLocalTime,
  longLeaveCard,
  singleDayOptions,
  type LeaveRecord,
} from '@features/leave/leaveModel';
import { ErrorState, LoadingState } from '@ui';

/**
 * CHUTTI — the V13 `leave` destination (`592:488` / `592:489` / `592:832` / `592:1008`).
 *
 * The four frames are four states of one screen:
 *
 *   `592:488`  present today  → the `AAJ KA BREAK` panel is drawn above the leave surfaces
 *   `592:489`  not present    → no break panel; `Aaj` becomes an offerable leave day
 *   `592:832`  a range booked → the long-leave entry reads `Dates badle` and prints the range
 *   `592:1008` a day booked   → that day's row is filled and carries the tick
 *
 * V12 drew all of this inside the attendance screen. V13 gives it its own destination, which is
 * why it is a tab rather than a pushed route: it has a title and a Help button and no back arrow,
 * the same shape the attendance screen has.
 *
 * ## Nothing here is decided locally
 *
 * The day rows, the booked state and the upcoming range are all read from `GET /cook/leaves` — a
 * list of REQUESTS, including pending ones. `leaveStatusCopy` keys the row's second line on the
 * server's status, so a pending request can never render as `Chutti lag gyi`.
 */
export default function ChuttiScreen(): React.ReactElement {
  const profile = useCookProfile();
  const todayIso = (profile.data?.serverTime ?? '').slice(0, 10);
  const month = todayIso.slice(0, 7);
  const leaves = useLeaves({}, month.length === 7);

  const records: readonly LeaveRecord[] = useMemo(
    () =>
      (leaves.data?.leaves ?? []).map((leave) => ({
        leaveId: leave.leaveId,
        startDate: leave.startDate,
        endDate: leave.endDate,
        status: leave.status,
      })),
    [leaves.data],
  );

  if (profile.isPending) return <LoadingState testID="chutti-loading" />;
  if (profile.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(profile.error)}
        onRetry={() => void profile.refetch()}
        testID="chutti-error"
      />
    );
  }

  const today = profile.data.today;
  const shift = today.shift;
  const presentToday = today.attendance?.status === 'present';

  // `528:465` is drawn on the PRESENT frame only, and only when the server actually published a
  // break window. A cook who is not at work today has no break to be told about.
  const breakWindow =
    presentToday && shift !== null
      ? {
          durationLabel: breakDurationLabel(shift.breakStartLocalTime, shift.breakEndLocalTime),
          fromLabel: formatLocalTime(shift.breakStartLocalTime),
          toLabel: formatLocalTime(shift.breakEndLocalTime),
        }
      : null;

  return (
    <ChuttiView
      title="CHUTTI"
      breakWindow={breakWindow}
      singleDayLeaves={singleDayOptions(todayIso, presentToday, records)}
      groupedLongCard={null}
      longCard={longLeaveCard(todayIso, records)}
      longCardWidth={334}
      onPickDay={(dateIso) => router.push({ pathname: '/leave/single', params: { date: dateIso } })}
      onOpenLongLeave={() => router.push('/leave/range')}
    />
  );
}
