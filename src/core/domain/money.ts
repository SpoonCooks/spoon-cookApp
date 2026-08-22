/**
 * My Money ("Kaam aur Paise") domain types.
 *
 * EVERY figure here is a backend projection. The frontend formats paise into `₹1,150` and nothing
 * more. It must never sum base + bonus + tips, never apply a deduction, never decide whether a
 * bonus was earned, and never derive a cycle boundary. Those are financial rulings; computing them
 * client-side would produce numbers that disagree with the ledger and look like a UI bug.
 *
 * Amounts are integer **paise** to avoid float drift. `formatRupees` is the only place they become
 * a string.
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
 * Bonus progress.
 *
 * OPEN FOUNDER QUESTION: the daily frame reads `Bonus ke liye: 5 se zyada ghante kaam` (5 hours)
 * while the monthly frame reads `7 hr ke upar kaam` and founder comment #142 says `x.xx/7`. The
 * threshold is therefore NOT hardcoded here — the backend must supply it along with the message
 * inputs. See GAP-19.
 */
export interface BonusProgress {
  readonly thresholdHours: number;
  readonly completedHours: number;
  readonly remainingHours: number;
  readonly progressRatio: number;
  /** Fully-composed Hinglish line, if the backend supplies it. */
  readonly message: string | null;
}

export interface DeductionLine {
  readonly count: number;
  readonly amountPaise: number;
}

export interface EarningsSummary {
  readonly period: EarningsPeriod;
  /** `Aaj ka kaam` — hours worked in the period. */
  readonly workedHours: number;
  readonly bonusProgress: BonusProgress | null;

  readonly basePaise: number;
  readonly bonusPaise: number;
  readonly tipsPaise: number;
  /** `Aaj ki kamaai` — server-computed gross. Not a client sum. */
  readonly grossPaise: number;

  readonly noShow: DeductionLine;
  readonly late: DeductionLine;
  /** `Aaj ki katauti` — server-computed total deductions. */
  readonly totalDeductionsPaise: number;

  /** `final kamai` — server-computed net. Not a client subtraction. */
  readonly finalPaise: number;
}

export interface EarningsCycleRef {
  readonly cycleId: string;
  /** `18th Jul - 21st Jul` as rendered by the backend, or components derive from the dates. */
  readonly label: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  /**
   * Founder comment #143: the cycle list must show the final payout inline so the cook does not
   * open each one. Nullable until GAP-18 ships.
   */
  readonly finalPaise: number | null;
  readonly isCurrent: boolean;
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
