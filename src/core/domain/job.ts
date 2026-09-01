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
  /**
   * `job flow` §5's tier for this card, as the SERVER rules it.
   *
   * Was `defaultJobUrgency` for every job, because the projection published no ruling — so `4d`
   * and `4e` were unreachable and a cook never saw the "leave now" card the design draws for her.
   */
  readonly urgency: JobUrgency;

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

/**
 * `90` → `1.5 hrs`, `60` → `1 hr`, `30` → `30 mins`. Display formatting only.
 *
 * Below an hour the design states the duration in MINUTES, not in a fraction of an hour. Every
 * `job flow` frame says so in its own chips: `583:375` publishes `5:30 PM · 30 mins` and
 * `3:30 PM · 45 mins`, and `583:427`/`453`/`479` repeat `30 mins` and `45 mins` in their lists.
 * The app divided unconditionally and drew `0.5 hrs` and `0.8 hrs` on all five frames — a value
 * a cook has to convert back, and one the design never writes.
 *
 * The hour form is kept for a whole or fractional hour, which is what the same chips use above
 * the boundary (`1.5 hrs`). Only the sub-hour branch is new.
 */
export function formatDurationHours(minutes: number): string {
  if (Math.abs(minutes) < 60) return formatMinutes(minutes);
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

/**
 * How loudly the lead job card is drawn.
 *
 * V14 escalates it through three colourways — `583:427`, `583:453` and `583:479` — swapping the
 * border, the icon disc, the duration chip and the CTA together, and inverting the CTA label to
 * white at the last tier.
 *
 * ## Why this is NOT derived from `minutesToDeadline`
 *
 * The obvious reading is that the frame names give the thresholds: `<45 mins`, `<10 mins`,
 * `<5 mins`. The frames' own content contradicts that reading —
 *
 *   | frame     | name            | countdown it draws |
 *   | --------- | --------------- | ------------------ |
 *   | `583:427` | `next in <45 mins` | `25 mins`       |
 *   | `583:453` | `next <10 mins`    | `20 mins`       |
 *   | `583:479` | `next <5 mins`     | `15 mins`       |
 *
 * — `20` is not under ten and `15` is not under five. Either the names or the mock values are
 * stale, and the file gives no way to tell which. Picking thresholds anyway would mean inventing
 * a rule the design does not state and then painting a card red on the strength of it, so the
 * tier is an explicit input instead: fixtures set it per frame, and production passes the calmest
 * value until the backend rules on it.
 *
 * Eligibility is unaffected either way — whether the cook may leave stays `isActionable`, a server
 * ruling — so the open question costs a colour, never a command.
 */
export const jobUrgencies = ['soon', 'imminent', 'critical'] as const;
export type JobUrgency = (typeof jobUrgencies)[number];

/**
 * The tier used against production data.
 *
 * `GET /v1/cook/jobs` exposes no urgency ruling, and the design's thresholds are contradictory
 * (above), so the calmest treatment is used rather than a guessed escalation. A cook is never
 * shown a red "leave now" card the server did not ask for.
 */
export const defaultJobUrgency: JobUrgency = 'soon';

/**
 * The server's ruling, narrowed to the three tiers the card draws.
 *
 * `unknown` — no route evidence supports a departure deadline, and DEC-059 forbids manufacturing
 * one — degrades to the calmest tier. Absence of evidence is not urgency, exactly as it is not
 * lateness on the travel banner.
 */
export function jobUrgencyFrom(urgency: string | null | undefined): JobUrgency {
  return urgency === 'imminent' || urgency === 'critical' ? urgency : defaultJobUrgency;
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
