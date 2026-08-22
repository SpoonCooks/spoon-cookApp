/**
 * Jobs domain types.
 *
 * The job list is backend-owned: assignment, ordering, eligibility and the countdown all arrive as
 * server values. The frontend groups and formats them.
 *
 * Founder comment #155 asks for "provision to see tomorrow's bookings before the day has started".
 * No such screen exists in the Figma, so none is invented here — but the model and the card
 * component support **date grouping** so that turning it on later is a data change, not a rewrite.
 */

import type { CustomerAddressSnapshot, GateTarget } from './serviceState';

/**
 * What the cook can do with a card right now, as ruled by the server.
 *
 * `start_travel` is deliberately named for what it does. The Figma CTA reads `START`, but it
 * begins the COMMUTE, not the service — the service begins only after Start OTP verification.
 * Backend agrees: `POST /cook/bookings/:id/start-commute` versus `verify-start-otp`.
 *
 * Founder comment #154 asks whether the CTA should read `CHALNA START?` to make that clearer.
 * Not adopted in the latest Figma, so the visible copy stays `START` — see `jobCtaLabel`.
 */
export const jobActions = ['start_travel', 'none'] as const;
export type JobAction = (typeof jobActions)[number];

export interface JobCardModel {
  readonly bookingId: string;
  readonly assignmentVersion: number;

  /** `Building/ Society` on the card. */
  readonly societyOrBuilding: string;
  /** `1.5 hrs` — formatted from server minutes. */
  readonly serviceDurationMinutes: number;

  readonly scheduledStartIso: string;
  /** `11:50 AM` beside `Tak pahauch jaye`. */
  readonly reachByIso: string | null;
  /**
   * `26 mins` countdown on the actionable card. Server-supplied; NEGATIVE once the deadline has
   * passed. Null when the job is not yet counting down.
   */
  readonly minutesToDeadline: number | null;
  /** `12 min dur` — travel duration estimate from the server's route model. */
  readonly travelMinutes: number | null;

  readonly action: JobAction;
  /** Server ruling that the `START` CTA is pressable. Never derived from a client clock. */
  readonly isActionable: boolean;
  /** Drives the `RUNNING LATE` badge (`434:2743`). Server-supplied. */
  readonly isRunningLate: boolean;

  readonly address: CustomerAddressSnapshot;
  readonly gate: GateTarget | null;
}

/** The visible CTA label. One token so the `CHALNA START?` decision is a single-line change. */
export const jobCtaLabel = 'Start';

/** A date-grouped section of jobs — supports "today" and "tomorrow" without a new screen. */
export interface JobGroup {
  /** `YYYY-MM-DD` in IST. */
  readonly dateIso: string;
  /** Server-supplied heading when grouping is enabled; null renders an ungrouped list. */
  readonly label: string | null;
  readonly jobs: readonly JobCardModel[];
}

export interface JobsProjection {
  /** The single current/next actionable job rendered as the large `next job` card. */
  readonly currentJob: JobCardModel | null;
  /** Remaining jobs, grouped by service date. */
  readonly upcoming: readonly JobGroup[];
  readonly serverNowIso: string;
}

/** `90` → `1.5 hrs`, `60` → `1 hr`. Display formatting only. */
export function formatDurationHours(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${rounded === 1 ? 'hr' : 'hrs'}`;
}

/**
 * `26` → `26 mins`, `-2` → `-2 mins`.
 *
 * Negative values are preserved, never clamped: the Figma `Page 4b` late state renders `-2 mins`,
 * and hiding the sign would erase the distinction between at-risk and late.
 */
export function formatMinutes(minutes: number): string {
  return `${minutes} ${Math.abs(minutes) === 1 ? 'min' : 'mins'}`;
}

/** Group jobs by IST service date, preserving server order within each group. */
export function groupJobsByDate(
  jobs: readonly JobCardModel[],
  labelFor: (dateIso: string) => string | null = () => null,
): readonly JobGroup[] {
  const buckets = new Map<string, JobCardModel[]>();
  for (const job of jobs) {
    const dateIso = job.scheduledStartIso.slice(0, 10);
    const bucket = buckets.get(dateIso);
    if (bucket === undefined) buckets.set(dateIso, [job]);
    else bucket.push(job);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateIso, list]) => ({ dateIso, label: labelFor(dateIso), jobs: list }));
}
