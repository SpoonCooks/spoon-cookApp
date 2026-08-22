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

export const cookLeavesSchema = z.object({
  leaves: z.array(
    z.object({
      id: z.string(),
      serviceDate,
      status: z.string(),
      reason: z.string(),
    }),
  ),
  fromDate: serviceDate,
  toDate: serviceDate,
  timezone: z.string(),
});
export type CookLeavesResponse = z.infer<typeof cookLeavesSchema>;

/* ----------------------------------------------------------- earnings --- */

const earningsPeriodSchema = z.object({
  startDate: serviceDate,
  endDate: serviceDate,
  totalPaise: z.number().int(),
  eventCount: z.number().int(),
});

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

export const cookEarningsSchema = z.object({
  totalPaise: z.number().int(),
  events: z.array(
    z.object({
      id: z.string(),
      eventType: z.string(),
      amountPaise: z.number().int(),
      reason: z.string(),
      createdAt: isoString,
    }),
  ),
  daily: earningsPeriodSchema,
  sevenDay: earningsPeriodSchema,
  currentCycle: cookCycleSummarySchema.nullable(),
  bonus: cookBonusProgressSchema,
});
export type CookEarningsResponse = z.infer<typeof cookEarningsSchema>;

export const cookCyclesSchema = z.object({
  cycles: z.array(cookCycleSummarySchema),
});
export type CookCyclesResponse = z.infer<typeof cookCyclesSchema>;

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
});
export type CookLocationResponse = z.infer<typeof cookLocationSchema>;
