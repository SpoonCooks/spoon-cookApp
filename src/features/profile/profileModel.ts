/**
 * Presentation for the profile card (`707:1534`).
 *
 * Kept out of the route so it is testable without a router, and out of the view so the view
 * stays pixels — the same split `leaveModel.ts` uses.
 */

/**
 * `+919046520308` → `+91 90465 20308`, the grouping `707:1546` draws.
 *
 * Deliberately conservative: a number that is not a thirteen-character Indian E.164 string is
 * printed exactly as the server stored it rather than being regrouped into a shape it does not
 * have. This screen exists to confirm which number the app is signed in as, so a misgrouped one
 * would undermine the only thing it says.
 */
export function formatPhone(phone: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return match === null ? phone : `+91 ${match[1]} ${match[2]}`;
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
 * `2026-09-13T20:41:07.912Z` → `14 September 2026`, the day the cook asked to be deleted.
 *
 * Formatted in the DEVICE's timezone, not UTC. The server stamps `requestedAt` in UTC, and IST is
 * +5:30 — so a request made any time after 05:30 IST falls on a different UTC date than the one
 * the cook experienced. She would read a day she did not tap on, on the one screen whose whole job
 * is to confirm that what she did was recorded.
 *
 * A timestamp this build cannot parse yields `null`, and the screen states that a request is open
 * without naming a day. An invented date is worse than no date on a line about deletion.
 */
export function formatRequestedOn(isoTimestamp: string): string | null {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return null;
  const month = MONTHS[at.getMonth()];
  return month === undefined ? null : `${at.getDate()} ${month} ${at.getFullYear()}`;
}
