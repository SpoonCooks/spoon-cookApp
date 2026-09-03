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

export interface ExtensionItemProjection {
  readonly state: string;
  readonly minutes: number;
  readonly newExpectedEndIso: string | null;
  readonly confirmedAtIso: string | null;
}

export interface ExtensionProjection {
  /** True once the backend confirms a customer-paid extension. Never set optimistically. */
  readonly isExtended: boolean;
  readonly extendedByMinutes: number | null;
  /** Authoritative post-extension end time. Replaces the original `expectedEndIso`. */
  readonly newExpectedEndIso: string | null;
  /**
   * When the backend settled the extension. The origin of the five-minute banner window.
   *
   * ## This is currently always null in production, and that is deliberate
   *
   * The value exists in the database — `booking_extensions.settled_at` — but the cook read model
   * (`src/cooks/projections.ts`) selects only `state`, `minutes` and `new_expected_end`, so
   * `GET /v1/cook/jobs/:id` never sends it. Until the endpoint adds it, this parses to `null`,
   * {@link extensionBannerRemainingMs} returns `0`, and the `622:1163` banner therefore never
   * renders against production data.
   *
   * That is the safe failure: a cook sees the ordinary Active Job screen with the extended timer,
   * which is correct, rather than a banner timed from a guess. Inventing a confirmation instant
   * — falling back to "first time the app saw the extension", or to the device clock — would make
   * the window restart on every reinstall and drift per device, so it is not done.
   */
  readonly confirmedAtIso: string | null;
  /** Every confirmed extension, oldest first, for the single- and 2x-extension Figma states. */
  readonly extensions: readonly ExtensionItemProjection[];
}

/**
 * How long the `622:1163` extension banner stays on screen after the backend confirms.
 *
 * The designer's rule: the extension element remains for five minutes only, then the UI returns
 * to the normal Active Job screen. It is nowhere in the Figma file — no annotation, no prototype
 * reaction, no motion data — so it is stated here once, as a named constant, rather than being
 * spread across the view as a magic number.
 */
export const EXTENSION_BANNER_MS = 5 * 60 * 1000;

/**
 * Milliseconds of banner left at the moment the server produced this snapshot.
 *
 * ## Why this is computed from two SERVER instants and nothing else
 *
 * Both operands — `confirmedAtIso` and the snapshot's `clock.serverNowIso` — come from the backend in
 * the same response. Their difference is therefore a duration measured entirely on the server's
 * clock, and moving the device's clock forward or back cannot lengthen or shorten it. The caller
 * counts this duration down with a timer, which the JS runtime drives from system uptime rather
 * than from wall time, so the window survives a clock change mid-service as well.
 *
 * Backgrounding, termination and reinstall all reconstruct the same answer, because the answer is
 * a function of two server timestamps and not of any state the app kept.
 *
 * Returns `0` — never a negative number and never a fresh five minutes — when the extension is
 * unconfirmed, when the backend sent no confirmation instant, or when the window has closed.
 */
export function extensionBannerRemainingMs(
  extension: ExtensionProjection,
  serverNowIso: string,
): number {
  if (!extension.isExtended || extension.confirmedAtIso === null) return 0;
  const confirmedAt = Date.parse(extension.confirmedAtIso);
  const serverNow = Date.parse(serverNowIso);
  if (Number.isNaN(confirmedAt) || Number.isNaN(serverNow)) return 0;
  return Math.max(0, confirmedAt + EXTENSION_BANNER_MS - serverNow);
}

/**
 * Whole minutes from the server's clock to an instant, rounded UP.
 *
 * Only a fallback: the read model normally sends `minutesRemaining` and that figure is preferred,
 * because the server owns the service clock. This exists so a payload that omits it still projects
 * a timer instead of collapsing to zero and throwing the cook onto the End OTP keypad.
 *
 * Rounding up matches the timer's reading — with fifty seconds left the design says "1 mins", not
 * "0" — and, more importantly, it keeps a service with any time at all on the cooking screen.
 * Unparseable input returns 0, which hands the decision back to the server's permission flag.
 */
function minutesUntil(targetIso: string, serverNowIso: string): number {
  const target = Date.parse(targetIso);
  const serverNow = Date.parse(serverNowIso);
  if (Number.isNaN(target) || Number.isNaN(serverNow)) return 0;
  return Math.ceil((target - serverNow) / 60_000);
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
      /**
       * `ETA_running` — the travel time the card actually names ("Location ki duri").
       *
       * `null` when the server has no usable ETA, and the deadline countdown is drawn instead.
       */
      readonly minutesToArrival: number | null;
      /** Server permission for the manual arrival fallback; never inferred from ETA. */
      readonly canMarkArrived: boolean;
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
      /**
       * The server's permission for the End OTP — `otpEligibility.end`.
       *
       * Carried onto `cooking` because the keypad is now drawn beside the timer for the whole
       * service (founder, 2026-09-02) rather than only in its last five minutes. It stays a
       * PERMISSION and never a screen: false means an already-used code, and the block is hidden
       * rather than offering one the endpoint would refuse.
       */
      readonly endOtpReady: boolean;
      readonly actualStartIso: string;
      readonly expectedEndIso: string;
      readonly minutesRemaining: number;
      readonly isEndingSoon: boolean;
      readonly extension: ExtensionProjection;
      /**
       * Milliseconds of `622:1163` banner remaining as of `clock.serverNowIso`.
       *
       * `0` means render the ordinary Active Job screen. The view counts this down rather than
       * re-deriving it, so the banner disappears on time without waiting for the next poll — and
       * the extended timer keeps running either way. Losing the banner is not losing the
       * extension.
       */
      readonly extensionBannerMsRemaining: number;
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
  /**
   * `ETA_running` — the cook's TRAVEL time to the gate, in whole minutes.
   *
   * This is what "Location ki duri" means and what the flow document defines: "the time left to
   * reach the user's location from the time at which the cook's location is checked". It moves
   * when she moves, and does not move when she does not.
   *
   * `null` when the server has no usable ETA, which is a real state and not a zero.
   */
  readonly minutesToArrival: number | null;
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
  /** Server says fresh accepted in-radius evidence enables the manual arrival fallback. */
  readonly canMarkArrived: boolean;
  readonly interruption: 'cancelled_while_travelling' | 'reassigned' | 'cancelled' | null;
}

/**
 * Map a server snapshot onto exactly one screen state.
 *
 * Note the ordering: an interruption outranks everything, because a cancelled booking must never
 * keep rendering a live service screen.
 */
export function projectServiceState(snapshot: ServiceSnapshot): ServiceState | null {
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
        // Not defaulted to 0: no ETA is not "arriving now", and the card falls back to the
        // deadline countdown rather than drawing a zero it cannot justify.
        minutesToArrival: snapshot.minutesToArrival,
        canMarkArrived: snapshot.canMarkArrived,
      };

    case 'cook_arrived': {
      const timing = snapshot.arrivalTiming ?? 'on_time';
      return snapshot.startOtpReady
        ? { kind: 'awaiting_start_otp', job, timing }
        : { kind: 'arrived', job, timing };
    }

    case 'cooking': {
      // `cooking` is only renderable with the server timestamps the timer is reconstructed from.
      if (snapshot.actualStartIso === null || snapshot.expectedEndIso === null) {
        return { kind: 'assigned', job, canStartTravel: false };
      }
      const expectedEndIso = snapshot.extension.newExpectedEndIso ?? snapshot.expectedEndIso;
      const minutesRemaining =
        snapshot.minutesRemaining ?? minutesUntil(expectedEndIso, snapshot.clock.serverNowIso);
      /* End OTP is a permission, not a replacement screen. The cooking frame owns the complete
       * live-service surface: timer, optional extension history, End OTP block and coaching art.
       * Keeping this branch as `cooking` makes every Figma timer state reachable. */
      return {
        kind: 'cooking',
        job,
        endOtpReady: snapshot.endOtpReady,
        actualStartIso: snapshot.actualStartIso,
        expectedEndIso,
        minutesRemaining: Math.max(0, minutesRemaining),
        isEndingSoon: snapshot.isEndingSoon,
        extension: snapshot.extension,
        extensionBannerMsRemaining: extensionBannerRemainingMs(
          snapshot.extension,
          snapshot.clock.serverNowIso,
        ),
      };
    }

    case 'completed':
      return { kind: 'completed', job };

    case 'cancelled':
      return { kind: 'interrupted', reason: 'cancelled', job };

    default: {
      /*
       * A status this build has never heard of.
       *
       * The COMPILE-TIME guard is kept: assigning to `never` means adding a status to the shared
       * union without handling it here fails the build, which is the point — a new state must be
       * designed for, not fall through into a live service screen.
       *
       * The RUNTIME behaviour used to be `throw`, and that was wrong in a way only a deployed
       * cook would discover. This runs inside a `useMemo` during render, and the app has no error
       * boundary, so an unrecognised status unmounted the tree: a cook mid-job got a blank screen
       * with no way out but force-stopping the app. The trigger is not exotic — it is any backend
       * deploy that adds a status before every sideloaded APK has been replaced, which is exactly
       * the situation this app is always in.
       *
       * Returning null routes into the route's existing `ErrorState`, which tells the cook the
       * service could not be loaded and offers a way back to Jobs. The Customer app already
       * degrades this way (`UNKNOWN_BOOKING_VIEW`); this makes the two agree.
       */
      const unhandledStatus: never = snapshot.status;
      console.warn('[serviceState] unhandled booking status', { status: unhandledStatus });
      return null;
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
