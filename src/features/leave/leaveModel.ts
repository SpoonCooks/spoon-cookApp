import { apiErrorMessage, isApiError } from '@core/api/errors';
import { formatShortDate } from '@core/domain/money';
import { toLeaveRequestStatus, type LeaveRequestStatus } from '@core/domain/leave';

import type { LongLeaveCard, SingleDayLeaveOption } from './LeaveViews';

/**
 * Turning the server's leave records into the two surfaces the `leave` frames draw.
 *
 * Kept out of the routes so the rules are testable without a router, and out of the views so the
 * views stay pixels. Nothing here decides anything the backend owns: every date comes from
 * `serverTime`, and a request's state comes from the record the server returned.
 */

/** One leave REQUEST as `GET /cook/leaves` returns it, narrowed to what these screens read. */
export interface LeaveRecord {
  readonly leaveId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: string;
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
 * How a request reads to the cook once it exists.
 *
 * `pending` must never sound settled: a cook who reads "lag gyi" stays home on a day Ops has not
 * approved. `592:1008` draws the booked row with the copy `Chutti lag gyi`, which is only ever
 * correct for an APPROVED request — so the copy is keyed on the server's status rather than on the
 * fact that a row is filled.
 */
export const leaveStatusCopy: Record<LeaveRequestStatus, string> = {
  approved: 'Chutti lag gyi',
  pending: 'Manager approve karenge',
  rejected: 'Chutti nahi mili',
  cancelled: 'Cancel ho gyi',
};

/** `dayLabel` in the frames' own shape — `7 November`. */
export function formatDayLabel(dateIso: string): string {
  const [, month, day] = dateIso.split('-');
  const name = MONTHS[Number(month) - 1];
  if (name === undefined || day === undefined) return dateIso;
  return `${Number(day)} ${name}`;
}

/** `Aaj` / `Kal` / `Parso`, counted forward from the SERVER's service date. */
export function relativeDayLabel(offset: number): string {
  return ['Aaj', 'Kal', 'Parso'][offset] ?? '';
}

/** `2026-11-06` + 1 → `2026-11-07`. UTC arithmetic, so no offset boundary can move a date. */
export function addDays(dateIso: string, days: number): string {
  const base = Date.parse(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(base)) return dateIso;
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

function covers(record: LeaveRecord, dateIso: string): boolean {
  return record.startDate <= dateIso && dateIso <= record.endDate;
}

/**
 * The two single-day rows the frames offer.
 *
 * `592:489` (absent) offers `Aaj` and `Kal`; `592:488` (present) offers `Kal` and `Parso`. That is
 * the design's own distinction and it is a sensible one — a cook the server has already recorded
 * as present today is not choosing to be off today — so the first offered day steps forward by one
 * when today is already marked. It selects which days are OFFERED and nothing else: the backend
 * still rules on every request.
 */
export function singleDayOptions(
  todayIso: string,
  markedPresentToday: boolean,
  leaves: readonly LeaveRecord[],
): readonly SingleDayLeaveOption[] {
  if (todayIso.length !== 10) return [];
  const firstOffset = markedPresentToday ? 1 : 0;
  return [0, 1].map((index) => {
    const offset = firstOffset + index;
    const dateIso = addDays(todayIso, offset);
    // Only a LIVE request occupies a day. A cancelled or rejected one must free it again —
    // otherwise a cook whose request was cancelled sees `Cancel ho gyi` in a filled row and has
    // no way to take that day off, which is the opposite of what cancellation means.
    const booked = leaves.find((record) => {
      const status = toLeaveRequestStatus(record.status);
      return (status === 'approved' || status === 'pending') && covers(record, dateIso);
    });
    return booked === undefined
      ? {
          dateIso,
          dayLabel: formatDayLabel(dateIso),
          relativeLabel: relativeDayLabel(offset),
          state: 'available' as const,
        }
      : {
          dateIso,
          dayLabel: formatDayLabel(dateIso),
          relativeLabel: leaveStatusCopy[toLeaveRequestStatus(booked.status)],
          state: 'booked' as const,
        };
  });
}

/**
 * `528:453` — the `lambi chutti` card.
 *
 * A multi-day request that has not finished yet relabels the entry point to `Dates badle` and
 * prints its range under it. A cancelled or rejected request is not upcoming leave and must not be
 * shown as one.
 */
export function longLeaveCard(todayIso: string, leaves: readonly LeaveRecord[]): LongLeaveCard {
  const upcoming = leaves
    .filter((record) => record.endDate >= todayIso && record.startDate !== record.endDate)
    .filter((record) => {
      const status = toLeaveRequestStatus(record.status);
      return status === 'approved' || status === 'pending';
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  if (upcoming === undefined) return { label: 'Dates chunein', upcoming: null };
  return {
    label: 'Dates badle',
    upcoming: `${formatShortDate(upcoming.startDate)} se ${formatShortDate(upcoming.endDate)} tak`,
  };
}

/** `09:00:00`/`11:00:00` → `2 hrs`. Presentation only; the shift itself is the server's. */
export function breakDurationLabel(start: string, end: string): string {
  const toMinutes = (value: string): number => {
    const [hour, minute] = value.split(':');
    return Number(hour) * 60 + Number(minute ?? 0);
  };
  const minutes = toMinutes(end) - toMinutes(start);
  if (Number.isNaN(minutes) || minutes <= 0) return '—';
  const hours = minutes / 60;
  if (hours === 1) return '1 hr';
  return Number.isInteger(hours)
    ? `${hours} hrs`
    : `${(Math.round(hours * 10) / 10).toFixed(1)} hrs`;
}

/** `12:15:00` → `12:15 PM`. */
export function formatLocalTime(value: string): string {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minuteText ?? '00'} ${suffix}`;
}

/** `November` for the calendar header, from an ISO date. */
export function monthLabel(dateIso: string): string {
  const month = Number(dateIso.slice(5, 7));
  return MONTHS[month - 1] ?? '';
}

/**
 * What to tell a cook when a chutti request is refused.
 *
 * The backend answers a date that already carries a `pending` or `approved` leave with
 * `INVALID_BOOKING_STATE`, which the shared mapper renders as "Yeh abhi nahi ho sakta. Screen
 * refresh kare." On this screen that is both uninformative and wrong advice: refreshing changes
 * nothing, because the obstacle is a chutti she already holds. Observed 2026-08-31 — Test Cook
 * had a pending leave on 1 September and selected 1–5 September.
 *
 * Only this one code is reinterpreted, and only here, where the call's meaning is known. Every
 * other failure keeps the shared wording so the app speaks with one voice about sessions,
 * permissions and outages.
 */
export function leaveRequestErrorMessage(error: unknown): string {
  if (isApiError(error) && error.kind === 'server' && error.code === 'INVALID_BOOKING_STATE') {
    return 'In dino me se kisi din ki chutti pehle se lagi hai. Doosri date chune.';
  }
  return apiErrorMessage(error);
}
