/**
 * Runtime response validation.
 *
 * Every response is parsed before it reaches a screen. A field the backend stopped sending, or a
 * status string this build has never seen, must surface as a `contract` failure — not as
 * `undefined` flowing into a countdown or a rupee figure.
 *
 * The schemas below are transcribed from backend source, not from OpenAPI: `openapi.yaml`
 * declares only a generic `Ok` response for every Cook route, so it does not describe response
 * bodies at all. The authoritative shapes are:
 *   - `src/cooks/projections.ts`  — `CookOperationalProfile`, `CookJobProjection`
 *   - `src/cooks/operations.ts`   — `CookPresentResult`, `MonthlyAttendanceProjection`, `CookLeaveRow`
 *   - `src/earnings/financial-service.ts` — periods, cycle summaries, bonus progress
 *
 * Unknown object keys are stripped rather than rejected, so a backend that ADDS a field does not
 * break a shipped app. Missing or wrong-typed known fields still fail.
 */

import { z } from 'zod';

/** Success envelope: every 2xx body is `{ data: ... }`. */
export function envelope<T extends z.ZodTypeAny>(inner: T) {
  return z.object({ data: inner });
}

const isoString = z.string().min(1);
const serviceDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ---------------------------------------------------------------- auth --- */

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: isoString,
  refreshToken: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    role: z.string().min(1),
    status: z.string().min(1),
    onboardingRequired: z.boolean(),
  }),
});
export type AuthSessionResponse = z.infer<typeof authSessionSchema>;

export const refreshedSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: isoString,
  refreshToken: z.string().min(1),
});
export type RefreshedSessionResponse = z.infer<typeof refreshedSessionSchema>;

/** `POST /auth/otp/send`. `devOtp` only ever appears when the backend runs the `fake` provider. */
export const otpSendSchema = z.object({
  expiresInSeconds: z.number().int().nonnegative().optional(),
  devOtp: z.string().optional(),
});

/* ------------------------------------------------------------ cook/me --- */

export const cookProfileSchema = z.object({
  cook: z.object({
    id: z.string().min(1),
    name: z.string(),
    photoUrl: z.string().nullable(),
    status: z.string().min(1),
    hub: z.object({ id: z.string(), name: z.string(), city: z.string() }).nullable(),
    rating: z.object({ average: z.number(), count: z.number().int() }),
  }),
  today: z.object({
    workingDays: z.array(z.number().int()),
    shift: z
      .object({
        id: z.string(),
        startLocalTime: z.string(),
        endLocalTime: z.string(),
        breakStartLocalTime: z.string(),
        breakEndLocalTime: z.string(),
      })
      .nullable(),
    attendance: z
      .object({
        status: z.string(),
        checkInAt: isoString.nullable(),
        onTime: z.boolean().nullable(),
      })
      .nullable(),
    /**
     * The SERVER's check-in eligibility ruling. Authoritative — the app must not re-derive it.
     *
     * An earlier build computed `hasShiftToday && noRecordYet` locally, which offered `Mark
     * Present` to a cook on approved leave and then let the backend reject the tap with a 400.
     * `canCheckIn` already accounts for leave, existing records and cook status.
     */
    canCheckIn: z.boolean(),
    /**
     * When the check-in window opens.
     *
     * Currently ALWAYS `null`: the backend has no approved opening rule (no 30-minute window
     * exists). Screens must therefore render no window copy while this is null, rather than
     * asserting a restriction the server does not enforce.
     */
    checkInOpensAt: isoString.nullable(),
    shiftStartsAt: isoString.nullable(),
    checkedInAt: isoString.nullable(),
    /** Why `canCheckIn` holds the value it does. A closed set in `CookOperationalProfile`. */
    reason: z.enum([
      'READY',
      'NO_SHIFT',
      'APPROVED_LEAVE',
      'ALREADY_CHECKED_IN',
      'ATTENDANCE_RECORDED',
    ]),
    availability: z.object({ state: z.string(), changedAt: isoString }).nullable(),
  }),
  currentAssignment: z
    .object({
      bookingId: z.string(),
      status: z.string(),
      serviceStart: isoString,
      assignmentVersion: z.number().int(),
    })
    .nullable(),
  serverTime: isoString,
});
export type CookProfileResponse = z.infer<typeof cookProfileSchema>;

/* ------------------------------------------------------------- policy --- */

/**
 * `GET /cook/policies/earnings` — the ACTIVE published earnings policy.
 *
 * Every figure the five `Niyam` sheets state is here, and none of them is carried by the app any
 * more. Integer paise throughout, because these are the ledger's own amounts: a rupee float would
 * reintroduce the rounding the backend deliberately avoids by never leaving paise.
 *
 * Two of these are FORMULA inputs and not display values, and the client must apply them the way
 * the ledger does or it will state a number the cook is not charged:
 *
 *   - lateness costs `max(minutes - lateGraceMinutes, 0) * latePenaltyPerMinutePaise`, so arriving
 *     inside the grace costs nothing at all;
 *   - the long-hours bonus is PRORATED PER MINUTE —
 *     `floor(max(minutes - longHoursThresholdMinutes, 0) * longHoursRatePerHourPaise / 60)` —
 *     not paid per whole hour.
 *
 * `version` is the published version the ledger is charging against. It is not decoration: it is
 * what makes a publication observable, and `policyRules.test.ts` asserts the sheets follow it.
 */
export const cookEarningsPolicySchema = z.object({
  version: z.string(),
  cycleLengthDays: z.number().int(),
  presentDayBasePaise: z.number().int(),
  fivePlusBonusPaise: z.number().int(),
  longHoursThresholdMinutes: z.number().int(),
  longHoursRatePerHourPaise: z.number().int(),
  fullCycleBonusPaise: z.number().int(),
  twentySevenDayBonusPaise: z.number().int(),
  paidLeaveRefundPaise: z.number().int(),
  noShowPenaltyPaise: z.number().int(),
  lateGraceMinutes: z.number().int(),
  latePenaltyPerMinutePaise: z.number().int(),
});
export type CookEarningsPolicy = z.infer<typeof cookEarningsPolicySchema>;

/* --------------------------------------------------------------- jobs --- */

/**
 * `riskState` is the server's travel ruling. It is the ONLY thing that separates the two Figma
 * `Page 4b` frames, so it is validated as a closed set: an unrecognised value must fail loudly
 * rather than silently degrade a LATE cook to on-time.
 */
export const travelRiskStateSchema = z.enum([
  'TRAVEL_ON_TIME',
  'TRAVEL_RISK',
  'TRAVEL_LATE',
  'UNKNOWN',
]);

export const cookJobSchema = z.object({
  bookingId: z.string().min(1),
  assignmentId: z.string(),
  assignmentVersion: z.number().int(),
  status: z.string().min(1),
  assignmentStatus: z.string(),
  serviceStart: isoString,
  durationMinutes: z.number(),
  travelStartedAt: isoString.nullable(),
  serviceStartedAt: isoString.nullable(),
  currentExpectedEnd: isoString.nullable(),
  timer: z.object({
    serviceStartedAt: isoString.nullable(),
    expectedEnd: isoString.nullable(),
    // Negative is legal and meaningful — the service has run past its expected end.
    remainingSeconds: z.number().nullable(),
    tenMinuteState: z.enum(['not_started', 'normal', 'warning', 'elapsed']),
  }),
  actualEnd: isoString.nullable(),
  arrivedAt: isoString.nullable(),
  timing: z.object({
    customerCommitmentAt: isoString,
    eta: isoString.nullable(),
    etaUpdatedAt: isoString.nullable(),
    verdict: z.unknown(),
    riskState: travelRiskStateSchema,
  }),
  destination: z.object({
    latitude: z.number(),
    longitude: z.number(),
    label: z.string(),
    /**
     * Gate-level entry guidance from the operational snapshot (`gate_access_instructions`).
     *
     * Part of the destination contract, not decoration: it is how a cook gets PAST the gate they
     * were routed to. An earlier build omitted the field, so the backend sent it and no screen
     * could ever show it.
     */
    accessInstructions: z.string().nullable(),
    flat: z.string().nullable(),
    tower: z.string().nullable(),
    society: z.string().nullable(),
    street: z.string(),
    pincode: z.string(),
    city: z.string().nullable(),
    state: z.string().nullable(),
  }),
  extension: z.object({
    state: z.string().nullable(),
    minutes: z.number().nullable(),
    expectedEnd: isoString.nullable(),
    /**
     * When the backend settled the extension — the origin of the five-minute banner window.
     *
     * `.optional()` because the deployed cook read model does NOT send it yet: the column exists
     * (`booking_extensions.settled_at`) but `src/cooks/projections.ts` selects only `state`,
     * `minutes` and `new_expected_end`. Parsing it as optional means the app keeps working
     * against today's API and starts honouring the window the moment the field appears, with no
     * client release. It is never defaulted to a value — absent stays absent.
     */
    confirmedAt: isoString.nullable().optional(),
  }),
  otpEligibility: z.object({ start: z.boolean(), end: z.boolean() }),
  reassignment: z.object({
    assignmentVersion: z.number().int(),
    current: z.boolean(),
  }),
  serverTime: isoString,
});
export type CookJobResponse = z.infer<typeof cookJobSchema>;

export const cookJobsListSchema = z.object({
  jobs: z.array(cookJobSchema),
  fromDate: serviceDate,
  toDate: serviceDate,
  serverTime: isoString,
});
export type CookJobsListResponse = z.infer<typeof cookJobsListSchema>;

/** `GET /cook/jobs/current` returns the projection or `null` when nothing is assigned. */
export const currentCookJobSchema = cookJobSchema.nullable();

/* --------------------------------------------------------- attendance --- */

export const attendanceStatusSchema = z.enum(['present', 'absent', 'leave']);

export const cookPresentSchema = z.object({
  cookId: z.string(),
  serviceDate,
  status: z.literal('present'),
  checkInAt: isoString,
  onTime: z.boolean(),
  /** `false` on a replay — the cook was already marked present today. */
  created: z.boolean(),
});
export type CookPresentResponse = z.infer<typeof cookPresentSchema>;

export const monthlyAttendanceSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  days: z.array(
    z.object({
      date: serviceDate,
      /** Derived from `cook_shifts`. NOT an attendance status. */
      scheduled: z.boolean(),
      status: attendanceStatusSchema.nullable(),
      approvedLeave: z.boolean(),
      checkInAt: isoString.nullable(),
      onTime: z.boolean().nullable(),
    }),
  ),
  presentTotal: z.number().int(),
  leaveTotal: z.number().int(),
  scheduledDayTotal: z.number().int(),
  /** `null` when no present days exist — the app must render `--`, never `0%`. */
  onTimePercentage: z.number().nullable(),
  timezone: z.literal('Asia/Kolkata'),
});
export type MonthlyAttendanceResponse = z.infer<typeof monthlyAttendanceSchema>;

/**
 * One leave REQUEST, grouped by `leave_request_id`.
 *
 * The deployed `GET /cook/leaves` no longer returns one row per service date — `listCookLeaves`
 * groups by request and answers with a range plus a rolled-up status. An earlier build of this
 * file expected `{ id, serviceDate }` per day and would have failed every read.
 *
 * `status` is left as a string rather than an enum on purpose: the backend rolls four day-level
 * states into one request-level verdict, and a value this build has not seen must render as
 * "pending decision" rather than fail a screen the cook needs.
 */
export const cookLeaveSchema = z.object({
  leaveId: z.string(),
  type: z.enum(['single_day', 'multi_day']),
  startDate: serviceDate,
  endDate: serviceDate,
  status: z.string(),
  reason: z.string().nullable(),
  requestedAt: isoString,
  decidedAt: isoString.nullable(),
});
export type CookLeaveResponse = z.infer<typeof cookLeaveSchema>;

/**
 * `GET /cook/attendance` — a BARE ARRAY of stored records for a date window.
 *
 * Unlike `/cook/attendance/month` this returns only days that HAVE a record, so a day missing
 * from the array is "nothing recorded", never "absent".
 */
export const cookAttendanceRangeSchema = z.array(
  z.object({
    serviceDate,
    status: attendanceStatusSchema,
    markedAt: isoString,
    updatedAt: isoString,
  }),
);
export type CookAttendanceRangeResponse = z.infer<typeof cookAttendanceRangeSchema>;

export const cookLeavesSchema = z.object({
  leaves: z.array(cookLeaveSchema),
  fromDate: serviceDate,
  toDate: serviceDate,
  timezone: z.string(),
});
export type CookLeavesResponse = z.infer<typeof cookLeavesSchema>;

/**
 * `POST /cook/leaves` — the cook-side leave WRITE.
 *
 * Answers `201` with `status: 'pending'`. A cook-submitted leave is NEVER approved by submitting
 * it; Ops/Admin decide. The screens must therefore say "bhej diya", never "chutti lag gyi".
 */
export const cookLeaveRequestSchema = cookLeaveSchema.extend({
  status: z.literal('pending'),
});
export type CookLeaveRequestResponse = z.infer<typeof cookLeaveRequestSchema>;

/* ----------------------------------------------------------- earnings --- */

/**
 * Backend-owned earnings categories (`CookEarningsBreakdown` in
 * `src/earnings/financial-service.ts`).
 *
 * These fourteen figures are the reason the V12 Performance screens can be rendered at all. The
 * backend derives them from the immutable ledger with reversals kept as their OWN signed category,
 * so `netEarningsPaise` is the signed sum of the period and never a frontend subtraction. The app
 * reads them; it never re-buckets `events[]` by `eventType`, which would overstate `base` whenever
 * a reversal landed in a different bucket.
 */
export const cookEarningsBreakdownSchema = z.object({
  baseEarningsPaise: z.number().int(),
  ratingBonusPaise: z.number().int(),
  longHoursEarningsPaise: z.number().int(),
  attendanceBonusPaise: z.number().int(),
  paidLeaveEarningsPaise: z.number().int(),
  tipsPaise: z.number().int(),
  lateDeductionsPaise: z.number().int(),
  noShowDeductionsPaise: z.number().int(),
  otherDeductionsPaise: z.number().int(),
  adjustmentsPaise: z.number().int(),
  reversalsPaise: z.number().int(),
  grossEarningsPaise: z.number().int(),
  totalDeductionsPaise: z.number().int(),
  netEarningsPaise: z.number().int(),
});
export type CookEarningsBreakdownResponse = z.infer<typeof cookEarningsBreakdownSchema>;

const earningsPeriodSchema = z.object({
  startDate: serviceDate,
  endDate: serviceDate,
  totalPaise: z.number().int(),
  eventCount: z.number().int(),
  breakdown: cookEarningsBreakdownSchema,
});
export type CookEarningsPeriodResponse = z.infer<typeof earningsPeriodSchema>;

export const cookBonusProgressSchema = z.object({
  available: z.boolean(),
  reason: z.enum(['cycle_unavailable']).nullable(),
  policyVersion: z.string().nullable(),
  currentProgressDays: z.number().nullable(),
  /** Backend-supplied. The app must never hardcode 5, 7 or 27. */
  thresholdDays: z.number().nullable(),
  targetDays: z.number().nullable(),
  bonusAmountPaise: z.number().nullable(),
  targetBonusAmountPaise: z.number().nullable(),
  thresholdAchieved: z.boolean().nullable(),
  achieved: z.boolean().nullable(),
});
export type CookBonusProgressResponse = z.infer<typeof cookBonusProgressSchema>;

export const cookCycleSummarySchema = z.object({
  cycleId: z.string(),
  startDate: serviceDate,
  endDate: serviceDate,
  status: z.string(),
  current: z.boolean(),
  finalAmountPaise: z.number().int().nullable(),
});
export type CookCycleSummaryResponse = z.infer<typeof cookCycleSummarySchema>;

const earningsEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  amountPaise: z.number().int(),
  reason: z.string(),
  createdAt: isoString,
});

export const cookEarningsSchema = z.object({
  totalPaise: z.number().int(),
  events: z.array(earningsEventSchema),
  daily: earningsPeriodSchema,
  sevenDay: earningsPeriodSchema,
  monthly: earningsPeriodSchema,
  currentCycle: cookCycleSummarySchema.nullable(),
  currentCycleBreakdown: cookEarningsBreakdownSchema.nullable(),
  bonus: cookBonusProgressSchema,
});
export type CookEarningsResponse = z.infer<typeof cookEarningsSchema>;

/**
 * `GET /cook/earnings/cycles` answers with a BARE ARRAY, not `{ cycles: [...] }`.
 *
 * The route is `jsonData(await listCookCycles(...))` and `listCookCycles` returns
 * `readonly CookEarningsCycleSummary[]`, so the envelope is `{ data: [ ... ] }`. An earlier build
 * of this file expected an object wrapper and would have failed every past-cycles read against the
 * deployed API.
 */
export const cookCyclesSchema = z.array(cookCycleSummarySchema);
export type CookCyclesResponse = z.infer<typeof cookCyclesSchema>;

/**
 * `GET /cook/earnings/cycles/:cycleId` — a DIFFERENT shape from `/cook/earnings`.
 *
 * `getCookCycle` returns `{ cycleId, startDate, endDate, status, breakdown, summary, totalPaise,
 * events }` where `summary` is the reversal-safe aggregate and `breakdown` is a raw
 * `eventType -> paise` map. Validating this against `cookEarningsSchema` (as an earlier build did)
 * fails on every response, because that schema requires `daily`/`sevenDay`/`bonus`.
 */
export const cookCycleDetailSchema = z.object({
  cycleId: z.string(),
  startDate: serviceDate,
  endDate: serviceDate,
  status: z.string(),
  /** Raw per-event-type totals. Kept for completeness; `summary` is what screens render. */
  breakdown: z.record(z.string(), z.number()),
  summary: cookEarningsBreakdownSchema,
  totalPaise: z.number().int(),
  events: z.array(earningsEventSchema),
});
export type CookCycleDetailResponse = z.infer<typeof cookCycleDetailSchema>;

/* ------------------------------------------------------- service flow --- */

/**
 * The mutating service commands answer with a booking projection whose exact shape is not
 * relied upon: the app always re-reads `GET /cook/jobs/:id` afterwards so the screen is driven by
 * the canonical projection rather than a command's return value. Accepting an open object here is
 * deliberate, not laziness — it keeps a backend response-shape change from breaking a check-in the
 * cook has already performed.
 */
export const commandAckSchema = z.looseObject({});

export const cookLocationSchema = z.object({
  accepted: z.boolean(),
  reason: z.string().nullable(),
  confidence: z.string().nullable(),
  persisted: z.boolean(),
  etaRevised: z.boolean(),
  /** Set by the backend when two accepted samples inside 75 m committed the arrival. */
  arrived: z.boolean(),
  /**
   * The cadence the DEVICE must use for its next sample.
   *
   * Server-owned on purpose (`LocationUpdateResult.nextReportAfterSeconds`): a client that picked
   * its own interval would either burn battery or starve the arrival evidence, and the two-sample
   * rule depends on samples arriving at the rate the backend expects.
   */
  nextReportAfterSeconds: z.number().nonnegative(),
});
export type CookLocationResponse = z.infer<typeof cookLocationSchema>;
