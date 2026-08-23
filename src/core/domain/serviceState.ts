/**
 * Typed Cook service-state projection.
 *
 * ## Why this exists
 *
 * The Figma service flow is a sequence of screens, but the app must NOT advance through them by
 * remembering which button was last pressed. Every state below is derived from values the backend
 * owns. Pressing a button sends a command; the screen changes only because the *projection*
 * changed after the backend confirmed it.
 *
 * The backend's booking status vocabulary is deliberately coarser than the Figma:
 *
 *   created | assigned | cook_en_route | cook_arrived | cooking | completed | cancelled
 *
 * Three Figma travel screens (`4a`, `4b`-risk, `4b`-late) all live inside the single backend
 * status `cook_en_route`; two arrival screens (`5a`, `5b`) inside `cook_arrived`; three cooking
 * screens (`7a`, `7b`, `7c`) inside `cooking`. The extra dimension comes from server-supplied
 * timing fields, never from a client-side clock comparison.
 *
 * ## What the frontend may and may not decide
 *
 * MAY: format a server timestamp for display; pick which screen matches a server-supplied status.
 * MAY NOT: decide lateness, apply the five-minute buffer, decide Start/End OTP eligibility,
 * decide when cooking ends, or compute earnings. Those are backend rulings that arrive as data.
 *
 * `TravelTiming` and `ServiceTiming` below are therefore *inputs from the server*, not verdicts
 * this module computes.
 */

/** Backend booking status, exactly as the API reports it. */
export const bookingStatuses = [
  'created',
  'assigned',
  'cook_en_route',
  'cook_arrived',
  'cooking',
  'completed',
  'cancelled',
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

/**
 * Server-supplied travel timing ruling.
 *
 * `on_time`   → Figma `Page 4a- travel on time`
 * `at_risk`   → Figma `Page 4b` variant `463:3779` (`Jaldi kare, aap LATE ho rahe`, positive countdown)
 * `late`      → Figma `Page 4b` variant `464:3864` (`Aap LATE hai!`, negative countdown)
 *
 * The two `4b` frames share a display label in Figma but are distinct states: they differ in three
 * text layers and in the height of the subtitle block. They must not be collapsed.
 */
export const travelTimings = ['on_time', 'at_risk', 'late'] as const;
export type TravelTiming = (typeof travelTimings)[number];

/** Server-supplied arrival ruling: `5a` vs `5b`. */
export const arrivalTimings = ['on_time', 'late'] as const;
export type ArrivalTiming = (typeof arrivalTimings)[number];

/** Purpose of a service OTP. Login OTP is a different mechanism and never interchangeable. */
export const otpPurposes = ['start', 'end'] as const;
export type OtpPurpose = (typeof otpPurposes)[number];

/**
 * A monotonic reference for rendering countdowns without trusting the device clock.
 *
 * `serverNowIso` is when the server produced the payload; `receivedAtMs` is the device's
 * monotonic-ish timestamp at receipt. Elapsed time is measured as a *delta* against
 * `receivedAtMs`, so changing the device clock cannot move a countdown, and a stale payload is
 * detectable. The authoritative instants (`expectedEndIso` etc.) always come from the server.
 */
export interface ServerClock {
  readonly serverNowIso: string;
  readonly receivedAtMs: number;
}

export interface CustomerAddressSnapshot {
  readonly buildingName: string | null;
  readonly towerOrBlock: string | null;
  readonly floor: string | null;
  readonly flatOrHouse: string | null;
  readonly customerName: string | null;
}

/**
 * The gate the cook navigates to and where tracking terminates.
 *
 * PRODUCT RULE: navigation and arrival detection target the GATE, never the flat. The address
 * fields above are display-only. Nothing in this app may route to, geofence on, or track toward
 * an apartment door. See `docs/...GAP_REPORT.md` GAP-14 for the open question about whether the
 * address should even be revealed before gate arrival.
 */
export interface GateTarget {
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string | null;
  /**
   * How to get through the gate once there (backend `destination.accessInstructions`).
   *
   * Belongs to the GATE, not to the flat: it is the guard-desk / entry note the operations team
   * captured for this society, and it is the last thing a cook needs before the customer block
   * becomes relevant. `null` when the snapshot carries none — rendered as nothing, never as a
   * placeholder instruction a cook might act on.
   */
  readonly accessInstructions: string | null;
}

export interface ExtensionProjection {
  /** True once the backend confirms a customer-paid extension. Never set optimistically. */
  readonly isExtended: boolean;
  readonly extendedByMinutes: number | null;
  /** Authoritative post-extension end time. Replaces the original `expectedEndIso`. */
  readonly newExpectedEndIso: string | null;
}

export interface JobSummary {
  readonly bookingId: string;
  /** Increments on reassignment. A mismatch means the app is acting on a stale assignment. */
  readonly assignmentVersion: number;
  readonly societyOrBuilding: string;
  readonly serviceDurationMinutes: number;
  readonly scheduledStartIso: string;
  /** Server's deadline for the cook to reach the gate. */
  readonly reachByIso: string | null;
  readonly address: CustomerAddressSnapshot;
  readonly gate: GateTarget | null;
}

/**
 * The discriminated projection. Exactly one variant is active, and `kind` is derived from server
 * data by `projectServiceState`.
 */
export type ServiceState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'assigned'; readonly job: JobSummary; readonly canStartTravel: boolean }
  | {
      readonly kind: 'travelling';
      readonly job: JobSummary;
      readonly timing: TravelTiming;
      /**
       * Server-computed minutes until the reach-by deadline. NEGATIVE when the deadline has
       * passed — the Figma `-2 mins` state. Do not clamp to zero.
       */
      readonly minutesToDeadline: number;
    }
  | { readonly kind: 'arrived'; readonly job: JobSummary; readonly timing: ArrivalTiming }
  | {
      readonly kind: 'awaiting_start_otp';
      readonly job: JobSummary;
      readonly timing: ArrivalTiming;
    }
  | {
      readonly kind: 'cooking';
      readonly job: JobSummary;
      readonly actualStartIso: string;
      readonly expectedEndIso: string;
      readonly minutesRemaining: number;
      readonly isEndingSoon: boolean;
      readonly extension: ExtensionProjection;
    }
  | { readonly kind: 'awaiting_end_otp'; readonly job: JobSummary }
  | { readonly kind: 'completed'; readonly job: JobSummary }
  /**
   * Terminal interruption. The backend cancelled or reassigned the booking while the cook was
   * mid-flow. Tracking must stop immediately and the app returns to Jobs. Compensation/penalty
   * copy is PENDING — no Figma screen exists for this (founder comment #152).
   */
  | {
      readonly kind: 'interrupted';
      readonly reason: 'cancelled_while_travelling' | 'reassigned' | 'cancelled';
      readonly job: JobSummary | null;
    };

export type ServiceStateKind = ServiceState['kind'];

/** Raw server payload the projection is built from. Mirrors the cook read model of GAP-01. */
export interface ServiceSnapshot {
  readonly status: BookingStatus;
  readonly job: JobSummary | null;
  readonly clock: ServerClock;
  readonly travelTiming: TravelTiming | null;
  readonly minutesToDeadline: number | null;
  readonly arrivalTiming: ArrivalTiming | null;
  /** Server says the Start OTP may now be entered. Never inferred from arrival alone. */
  readonly startOtpReady: boolean;
  /** Server says the End OTP may now be entered. */
  readonly endOtpReady: boolean;
  readonly actualStartIso: string | null;
  readonly expectedEndIso: string | null;
  readonly minutesRemaining: number | null;
  /** Server-supplied "ending soon" ruling. The Figma frame is labelled `last 7 mins`. */
  readonly isEndingSoon: boolean;
  readonly extension: ExtensionProjection;
  readonly canStartTravel: boolean;
  readonly interruption: 'cancelled_while_travelling' | 'reassigned' | 'cancelled' | null;
}

/**
 * Map a server snapshot onto exactly one screen state.
 *
 * Note the ordering: an interruption outranks everything, because a cancelled booking must never
 * keep rendering a live service screen.
 */
export function projectServiceState(snapshot: ServiceSnapshot): ServiceState {
  if (snapshot.interruption !== null) {
    return { kind: 'interrupted', reason: snapshot.interruption, job: snapshot.job };
  }

  const { job } = snapshot;
  if (job === null) return { kind: 'idle' };

  switch (snapshot.status) {
    case 'created':
    case 'assigned':
      return { kind: 'assigned', job, canStartTravel: snapshot.canStartTravel };

    case 'cook_en_route':
      return {
        kind: 'travelling',
        job,
        // Absent server ruling degrades to `on_time` rather than accusing the cook of lateness.
        timing: snapshot.travelTiming ?? 'on_time',
        minutesToDeadline: snapshot.minutesToDeadline ?? 0,
      };

    case 'cook_arrived': {
      const timing = snapshot.arrivalTiming ?? 'on_time';
      return snapshot.startOtpReady
        ? { kind: 'awaiting_start_otp', job, timing }
        : { kind: 'arrived', job, timing };
    }

    case 'cooking': {
      if (snapshot.endOtpReady) return { kind: 'awaiting_end_otp', job };
      // `cooking` is only renderable with the server timestamps the timer is reconstructed from.
      if (snapshot.actualStartIso === null || snapshot.expectedEndIso === null) {
        return { kind: 'assigned', job, canStartTravel: false };
      }
      return {
        kind: 'cooking',
        job,
        actualStartIso: snapshot.actualStartIso,
        expectedEndIso: snapshot.extension.newExpectedEndIso ?? snapshot.expectedEndIso,
        minutesRemaining: snapshot.minutesRemaining ?? 0,
        isEndingSoon: snapshot.isEndingSoon,
        extension: snapshot.extension,
      };
    }

    case 'completed':
      return { kind: 'completed', job };

    case 'cancelled':
      return { kind: 'interrupted', reason: 'cancelled', job };

    default: {
      // Exhaustiveness guard: a new backend status must be handled explicitly, not fall through
      // into a live service screen.
      const never: never = snapshot.status;
      throw new Error(`Unhandled booking status: ${String(never)}`);
    }
  }
}

/**
 * Which Figma frame a state renders as. Kept beside the projection so the mapping from design to
 * code is auditable, and so duplicate Figma labels resolve to unambiguous identifiers.
 */
export const figmaFrameFor: Record<string, string> = {
  'travelling:on_time': 'Page 4a- travel on time (462:3617) → TravelOnTime',
  'travelling:at_risk': 'Page 4b- travel 5 mins buffer (463:3779) → TravelRisk',
  'travelling:late': 'Page 4b- travel 5 mins buffer (464:3864) → TravelLate',
  'arrived:on_time': 'Page 5a- arrival on time (468:3935) → ArrivalOnTime',
  'arrived:late': 'Page 5b- arrival late (468:4040) → ArrivalLate',
  'awaiting_start_otp:on_time': 'Page 6a- Start OTP on time (482:4587) → StartOtpOnTime',
  'awaiting_start_otp:late': 'Page 6b- Start OTP (482:4656) → StartOtpLate',
  'cooking:normal': 'Page 7a- Cooking (483:4741) → CookingActive',
  'cooking:ending_soon': 'Page 7b- Cooking last 7 mins (483:4795) → CookingEndingSoon',
  'cooking:extended': 'Page 7c- Cooking extended (483:4835) → CookingExtended',
  awaiting_end_otp: 'Page 9- end OTP (484:4875) → EndOtp',
  completed: 'Page 10- job end (485:4917) → JobEnd',
};
