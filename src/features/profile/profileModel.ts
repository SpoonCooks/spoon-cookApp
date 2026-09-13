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
