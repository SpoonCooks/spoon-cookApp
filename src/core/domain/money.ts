/**
 * My Money / Performance domain types — Figma V12 section `performance` (`575:1741`).
 *
 * EVERY figure here is a backend projection. The frontend formats paise into `₹1,150` and nothing
 * more. It must never sum base + bonus + tips, never apply a deduction, never decide whether a
 * bonus was earned, and never derive a cycle boundary.
 *
 * ## Why some fields are `null` rather than computed
 *
 * The deployed backend (`GET /v1/cook/earnings`, verified on `spoon-api-kalc.onrender.com`)
 * returns a REVERSAL-SAFE `CookEarningsBreakdown`: fourteen signed categories in which a
 * `reversal` keeps its own bucket instead of being folded back into the category it reverses.
 *
 * That property is exactly why the app must not add those categories together. Summing
 * `ratingBonus + longHours + attendanceBonus + tips` to produce the Figma's
 * `aaj ki base ke upar ki kamai` would overstate the total whenever a reversal existed, because
 * the offsetting line sits in `reversalsPaise`. So the derived figures the design shows but the
 * contract does not expose are typed `number | null` and render as `—`:
 *
 *   - `workedMinutes`      — no worked-duration field exists on any cook route
 *   - `lateMinutes`        — the contract counts late EVENTS, never their duration
 *   - `aboveBasePaise`     — would require summing signed categories (see above)
 *   - `perDayBasePaise`    — would require dividing money by a day count
 *   - `noShowCount`/`lateCount` — the SQL computes `event_count` but the projection drops it
 *
 * Each is recorded as a backend gap in the closure report. A `—` the cook can query beats a
 * confident number that disagrees with their payout.
 *
 * Amounts are integer **paise** to avoid float drift. `formatRupees` is the only place they
 * become a string.
 */

/** Figma period filters: `Aaj — 1 din`, `Cycle — 7 din`, `Mahina — 28 din`. */
export const earningsPeriods = ['day', 'cycle', 'month'] as const;
export type EarningsPeriod = (typeof earningsPeriods)[number];

export const earningsPeriodLabels: Record<EarningsPeriod, { title: string; subtitle: string }> = {
  day: { title: 'Aaj', subtitle: '1 din' },
  cycle: { title: 'Cycle', subtitle: '7 din' },
  month: { title: 'Mahina', subtitle: '28 din' },
};

/**
 * Per-period Hinglish labels, transcribed from the V12 frames.
 *
 * The frames render these uppercase; the transform belongs to the component, not the data, so a
 * screen reader announces the sentence rather than shouting it.
 */
export interface PeriodCopy {
  readonly work: string;
  readonly mistakes: string;
  readonly deductions: string;
  readonly earnings: string;
  readonly final: string;
  readonly aboveBase: string;
}

export const periodCopy: Record<EarningsPeriod, PeriodCopy> = {
  day: {
    work: 'aaj ka kaam',
    mistakes: 'aaj ki galatiyaan',
    deductions: 'aaj ki katauti',
    earnings: 'aaj ki kamai',
    final: 'aaj ki final kamai',
    aboveBase: 'aaj ki base ke upar ki kamai',
  },
  cycle: {
    work: 'cycle ka kaam',
    mistakes: 'cycle ki galtiyaan',
    deductions: 'cycle ki katauti',
    earnings: 'cycle ki kamai',
    final: 'final cycle kamai',
    aboveBase: 'cycle ki base ke upar ki kamai',
  },
  month: {
    work: 'mahine ka kaam',
    mistakes: 'cycle ki galtiyaan',
    deductions: 'cycle ki katauti',
    earnings: 'cycle ki kamai',
    final: 'final kamai',
    aboveBase: 'mahine ki base ke upar ki kamai',
  },
};

/**
 * The backend's fourteen signed categories, renamed to the app's vocabulary.
 *
 * `reversalsPaise` and `adjustmentsPaise` stay visible as their own signed lines precisely so that
 * no screen is tempted to fold them into another category.
 */
export interface EarningsBreakdown {
  readonly basePaise: number;
  readonly ratingBonusPaise: number;
  readonly longHoursPaise: number;
  readonly attendanceBonusPaise: number;
  readonly paidLeavePaise: number;
  readonly tipsPaise: number;
  readonly lateDeductionsPaise: number;
  readonly noShowDeductionsPaise: number;
  readonly otherDeductionsPaise: number;
  readonly adjustmentsPaise: number;
  readonly reversalsPaise: number;
  /** Server-computed sum of every positive line. Not a client sum. */
  readonly grossPaise: number;
  /** Server-computed sum of every negative line, expressed positive. Not a client sum. */
  readonly totalDeductionsPaise: number;
  /** Server-computed signed net for the period. The authority on what the cook earned. */
  readonly netPaise: number;
}

/**
 * Bonus progress, in the units the BACKEND uses.
 *
 * The V12 daily frame reads `Bonus ke liye: 7 se zyada ghante kaam` (hours) while the deployed
 * contract counts present DAYS against `thresholdDays` from the earnings policy. The design copy
 * is not the policy: rendering "7 hours" over a day-based bar would tell the cook something the
 * ledger will not honour. So the unit here is days, and both the threshold and the target come
 * from `bonus.thresholdDays` / `bonus.targetDays`.
 */
export interface BonusProgress {
  readonly thresholdDays: number;
  readonly targetDays: number;
  readonly completedDays: number;
  readonly remainingDays: number;
  /** 0–1, for the segmented bar. Segment COUNT is `targetDays`, not a hardcoded seven. */
  readonly progressRatio: number;
  readonly thresholdAchieved: boolean;
  readonly bonusAmountPaise: number | null;
  readonly targetBonusAmountPaise: number | null;
}

/** A count/amount pair. `count` is `null` while the projection does not expose it. */
export interface DeductionLine {
  readonly count: number | null;
  readonly amountPaise: number;
}

/** Everything one Performance period renders. */
export interface EarningsPeriodView {
  readonly period: EarningsPeriod;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly eventCount: number;
  readonly breakdown: EarningsBreakdown;
  readonly noShow: DeductionLine;
  readonly late: DeductionLine;

  /* ---- designed but not exposed by the deployed contract; render `—` ---- */

  /**
   * Every field below is `null` from every adapter, because no deployed cook route returns it.
   * They are typed rather than dropped so the screens have somewhere to put the value the day the
   * contract grows one, and so `/dev` can state the design's own figure and prove the frame.
   *
   * A fixture may set them. Production may not compute them: `aboveBasePaise` as `gross − base`
   * would swallow reversals, and `perDayBasePaise` as `base ÷ days` would invent a rate the
   * ledger never agreed to.
   */
  readonly workedMinutes: number | null;
  /**
   * Minutes late across the period, which is what the design's `Late` tile draws.
   *
   * `575:1744` reads `8 min`, `575:1884` and `575:1922` read `20 min`, `575:2098` reads `2 min`.
   * The deployed contract exposes only `late.count` — how many times, not for how long — so this
   * is `null` from every adapter and the tile falls back to the count. The two are NOT the same
   * number and must not be conflated: a cook who was late twice for one minute each is not
   * `2 min` late by accident.
   */
  readonly lateMinutes: number | null;
  readonly aboveBasePaise: number | null;
  readonly perDayBasePaise: number | null;
  /** `531:1706` — the `1.75` in `1.75 x ₹150 = +₹263`. */
  readonly extraKaamMultiplier: number | null;
  /** `532:124` — the `₹150` rate the multiplier is applied to. */
  readonly extraKaamRatePaise: number | null;
  /** `492:5405` — days in the period rated five stars or better. */
  readonly fiveStarDays: number | null;
  /** `492:5416` — days in the period worked past the long-hours threshold. */
  readonly longHoursDays: number | null;
}

export interface EarningsCycleRef {
  readonly cycleId: string;
  /** `18 Jul - 21 Jul`, derived from the two service dates the backend supplies. */
  readonly label: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  /** `null` until the cycle is closed for this cook — the backend returns `null`, not zero. */
  readonly finalPaise: number | null;
  readonly isCurrent: boolean;
}

/** Cook rating, straight from `/cook/me`. */
export interface RatingView {
  readonly average: number;
  readonly count: number;
}

/** Format integer paise as Indian-grouped rupees, e.g. 3573900 → `₹35,739`. */
export function formatRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  const negative = rupees < 0;
  const digits = String(Math.abs(rupees));

  // Indian grouping: last three digits, then pairs.
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
  }
  return `${negative ? '-' : ''}₹${grouped}`;
}

/** `+₹263` / `-₹250`. The sign is part of the design, so it is explicit rather than implied. */
export function formatSignedRupees(paise: number): string {
  if (paise > 0) return `+${formatRupees(paise)}`;
  return formatRupees(paise);
}

/** A deduction the backend reports positive, rendered the way the frames show it: `-₹250`. */
export function formatDeduction(paise: number): string {
  return paise === 0 ? formatRupees(0) : `-${formatRupees(Math.abs(paise))}`;
}

/** The one placeholder for a figure the deployed contract does not expose. */
export const unavailableFigure = '—';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** `2026-07-24` → `24 Jul`. Presentation only; the service date itself is the server's. */
export function formatShortDate(dateIso: string): string {
  const [, month, day] = dateIso.split('-');
  const index = Number(month) - 1;
  const name = SHORT_MONTHS[index];
  if (name === undefined || day === undefined) return dateIso;
  return `${Number(day)} ${name}`;
}

/** `26th July` — the banner on the past-day frame. */
export function formatOrdinalDate(dateIso: string): string {
  const [, month, day] = dateIso.split('-');
  const index = Number(month) - 1;
  const dayNumber = Number(day);
  const name = SHORT_MONTHS[index];
  if (name === undefined || Number.isNaN(dayNumber)) return dateIso;
  const suffix =
    dayNumber % 10 === 1 && dayNumber !== 11
      ? 'st'
      : dayNumber % 10 === 2 && dayNumber !== 12
        ? 'nd'
        : dayNumber % 10 === 3 && dayNumber !== 13
          ? 'rd'
          : 'th';
  return `${dayNumber}${suffix} ${name}`;
}

/** `11 Jul - 17 Jul`. */
export function formatDateRange(fromIso: string, toIso: string): string {
  return `${formatShortDate(fromIso)} - ${formatShortDate(toIso)}`;
}
