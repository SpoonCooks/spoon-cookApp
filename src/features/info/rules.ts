/**
 * The five V14 `Info` rule sheets (`611:398`).
 *
 * ## Two kinds of number, and only one of them lives here
 *
 * GEOMETRY is transcribed from the frames and stays: column widths measured off each `matrix`
 * frame, the cell type size a sheet states, footnote tracking, accents, fills, blurb padding and
 * widths. Those describe how the screen is drawn and no backend owns them.
 *
 * POLICY is not. Every rupee figure, every threshold and every piece of copy that quotes one is
 * derived from `GET /cook/policies/earnings` — the ACTIVE published earnings policy the ledger
 * itself charges against. See {@link buildRuleSheets}.
 *
 * ## Why it moved
 *
 * These tables used to be literals, and they had drifted from the running system in every
 * direction: an escalating no-show penalty that does not exist, late minutes charged inside a
 * five-minute grace the ledger forgives, and a long-hours bonus understated threefold by treating
 * a five-hour threshold as seven and a per-minute proration as whole hours. GAP-19 is resolved by
 * the same route — the published threshold is 300 minutes.
 *
 * A transcription cannot follow a publication. That is the defect, not the particular numbers.
 */

import type { CookEarningsPolicy } from '@core/api/schemas';

/** Which rule sheet. Also the `/niyam/[rule]` route segment and the gallery state suffix. */
export const ruleKeys = [
  'rating-tiers',
  'no-show',
  'bonus-over-7',
  'bonus-5-plus',
  'late',
] as const;
export type RuleKey = (typeof ruleKeys)[number];

/** The icon beside a sheet's blurb. Each is an exported Figma bitmap already in the asset ledger. */
export type RuleIcon = 'star' | 'multiply' | 'timer' | 'clock';

/** A coloured cell in a tariff table. */
export interface RuleCell {
  readonly text: string;
  /** Design fill. Omitted cells inherit the row tint. */
  readonly fill?: string;
}

/**
 * The `597:1221` rating matrix: a header row then five tinted tiers.
 *
 * Three columns and its own geometry (`106px` first column, 24-unit header, 41-unit rows), which
 * is why it is a distinct shape rather than a `policy` with more rows.
 */
export interface RuleMatrixBody {
  readonly kind: 'matrix';
  readonly header: readonly string[];
  readonly rows: readonly { readonly fill: string; readonly cells: readonly string[] }[];
}

/**
 * The `603:1896` policy card: a titled pill, a two- or three-column table, then a footnote.
 *
 * The footnote is authored as a mixed-weight run — `Har **1 NO SHOW** ke baad penalty **₹100** se
 * badh jaegi` — so it is stored as segments rather than a string, and the bold spans are the
 * design's own emphasis rather than something re-derived at render.
 */
export interface RulePolicyBody {
  readonly kind: 'policy';
  readonly title: string;
  readonly columns: readonly string[] | null;
  readonly rows: readonly (readonly string[])[];
  readonly rowFill: string;
  /**
   * Per-column widths in design units, measured from each sheet's own `matrix` frame.
   *
   * They are NOT equal thirds and NOT shared between sheets: `Extra hours` is 87/76/100,
   * `5+ rating` is 76/86/100, and the two-column sheets are 175/96. Rendering all of them as
   * `flex: 1` put every cell boundary in the wrong place, which is most of what those four
   * comparisons were still scoring.
   */
  readonly columnWidths: readonly number[];
  /**
   * The type size of a data cell, in design units, exactly as the frame states it.
   *
   * `603:1902` and `605:2131` are 20; `603:1967` and `609:331` are **18**. The two bonus sheets
   * have a third column and drop two points to fit `+₹13,500`.
   */
  readonly cellFontSize: 18 | 20;
  /**
   * Letter spacing on the footnote, in design units, exactly as the frame states it.
   *
   * 0.18 on the two penalty sheets (`603:1918`, `605:2143`), **0** on the two bonus ones
   * (`603:1973`, `609:349`). It changes where the run wraps.
   */
  readonly footnoteTracking: 0 | 0.18;
  /** The pill and header-chip fills. See {@link PolicyAccent}. */
  readonly accent: PolicyAccent;
  readonly footnote: readonly { readonly text: string; readonly strong?: boolean }[];
}

export interface RuleSheet {
  readonly key: RuleKey;
  readonly nodeId: string;
  /** `597:1243` — the sheet's own title, beside the back arrow. */
  readonly title: string;
  readonly icon: RuleIcon;
  /** `597:1344` — the one-line summary under the header. */
  readonly blurb: string;
  readonly body: RuleMatrixBody | RulePolicyBody;
  /** `597:1338` — the label on the cook's own standing row. The VALUE is supplied at render. */
  readonly standingLabel: string;
  /**
   * The standing row's two box widths in design units, or `null` where the design lets a box take
   * the free space.
   *
   * Neither is decoration. The value box is **centred**, so its width decides where the glyph
   * lands: a 58-unit box pinned to the row's right edge draws `6` at x≈310, and there is no width
   * at which right-aligning it is the same picture. `603:1924` and `605:2094` instead let the
   * value flex — `4 hrs 5 mins` and `1 hr 34 mins` do not fit 58 — and pin the label instead.
   */
  readonly standingLabelWidth: number | null;
  readonly standingValueWidth: number | null;
  /**
   * `597:1247` — vertical padding on the blurb block, in design units.
   *
   * **Zero on `597:1221` and six on the other four.** The one frame that is a rating matrix omits
   * it; the four policy sheets set it. Twelve units of block height either way, which walks every
   * element below the blurb, and it is the single largest difference the V14 pixel run left open.
   */
  readonly blurbPaddingV: 0 | 6;
  /** `597:1344` — the fixed width V14 gives the blurb line, which decides where the icon sits. */
  readonly blurbWidth: number;
}

/** Design fills, named where a token exists and stated literally where the design is one-off. */
const TIER_1 = '#cfff04';
const TIER_2 = '#ecff9b';
const TIER_3 = '#ffe666';
const TIER_4 = '#ffef99';

/**
 * A policy card's two accent fills: the titled pill, and the table's header chips.
 *
 * V14 uses two schemes, and which one a sheet gets is not decoration — it is what the sheet is
 * ABOUT. The two sheets that pay a cook money are lime; the two that cost her money are yellow.
 * Sampled from the committed reference renders at the pill's and the first header chip's centres:
 *
 * | sheet                  | pill      | chips     |
 * | ---------------------- | --------- | --------- |
 * | `603:1865` No Show     | `#ffd600` | `#ffef99` |
 * | `605:2094` Late        | `#ffd600` | `#ffef99` |
 * | `603:1924` Extra hours | `#e2ff68` | `#cfff04` |
 * | `605:2027` 5+ rating   | `#e2ff68` | `#cfff04` |
 *
 * The app drew `#ffd600` for BOTH fills on all four, so the bonus sheets read as penalties and
 * the penalty sheets' header chips were a shade too strong.
 */
export interface PolicyAccent {
  readonly pill: string;
  readonly chip: string;
}

/** What a deduction costs. `603:1865`, `605:2094`. */
const PENALTY_ACCENT: PolicyAccent = { pill: '#ffd600', chip: '#ffef99' };

/** What a bonus pays. `603:1924`, `605:2027`. */
const BONUS_ACCENT: PolicyAccent = { pill: '#e2ff68', chip: '#cfff04' };
const TIER_BLOCKED = '#f5f5f5';

/**
 * The value a sheet shows where the backend publishes nothing to derive it from.
 *
 * The same mark `niyam/[rule].tsx` already uses for the four standings the contract does not
 * expose. It is deliberately not a number: a sheet with no policy must say so, not quietly draw
 * last year's tariff.
 */
const UNAVAILABLE = '—';

/** `₹1,175` from 117_500 paise. Integer arithmetic throughout — the ledger never leaves paise. */
function rupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  return `${sign}₹${Math.abs(Math.round(paise / 100)).toLocaleString('en-IN')}`;
}

/** `+₹150` — a credit, which the bonus sheets sign explicitly. */
function credit(paise: number): string {
  return `+${rupees(paise)}`;
}

/**
 * What the ledger charges for arriving `minutes` late.
 *
 * `financial-service.calculateLatePenaltyMinutes`: `max(minutes - grace, 0)`, then per minute.
 * Arriving inside the grace costs nothing, which is the single most important thing this sheet
 * has to say and the thing the hardcoded table got wrong on every row.
 */
function latePenaltyPaise(minutes: number, policy: CookEarningsPolicy): number {
  return Math.max(minutes - policy.lateGraceMinutes, 0) * policy.latePenaltyPerMinutePaise;
}

/**
 * What the ledger pays for working `minutes` in a day.
 *
 * `financial-service.calculateLongHoursBonus`: prorated PER MINUTE, not per whole hour —
 * `floor(max(minutes - threshold, 0) * ratePerHour / 60)`. The hardcoded table paid one hour's
 * rate at the first hour over its own (wrong) threshold and understated this threefold.
 */
function longHoursBonusPaise(minutes: number, policy: CookEarningsPolicy): number {
  return Math.floor(
    (Math.max(minutes - policy.longHoursThresholdMinutes, 0) * policy.longHoursRatePerHourPaise) /
      60,
  );
}

/**
 * The five V14 rule sheets, derived from the ACTIVE published earnings policy.
 *
 * ## Why this is a function and not a constant
 *
 * It used to be a constant, and every figure on it was a transcription of a policy the backend
 * publishes and the ledger charges against. A transcription cannot follow a publication: an owner
 * raising the no-show deduction changed what a cook was charged and left this table quoting the
 * old number until someone shipped a binary. Worse, the transcription had drifted — it showed an
 * escalating no-show penalty that does not exist, charged late minutes inside the grace, and
 * understated the long-hours bonus threefold.
 *
 * Everything that is GEOMETRY is unchanged and still stated per frame: column widths, cell type
 * sizes, footnote tracking, accents, fills, blurb padding and widths. Only the numbers, and the
 * copy that quotes a number, are derived. The screens are the same screens.
 *
 * ## `policy` may be null, and then the sheets say so
 *
 * There is no fallback tariff. A sheet with no policy renders {@link UNAVAILABLE} in every money
 * cell rather than a plausible-looking figure, for the same reason the standings render `—`: a
 * wrong number a cook can act on is worse than an honest blank.
 */
export function buildRuleSheets(
  policy: CookEarningsPolicy | null,
): Readonly<Record<RuleKey, RuleSheet>> {
  const money = (paise: number | null): string => (paise === null ? UNAVAILABLE : rupees(paise));
  const bonus = (paise: number | null): string => (paise === null ? UNAVAILABLE : credit(paise));

  /**
   * `605:2094` — four lateness marks, anchored on the GRACE rather than on fixed minutes.
   *
   * The first row is the grace itself, so the sheet opens by saying what is free. The design's
   * own marks were 3/5/10/15, which under a five-minute grace would have printed two rows of zero
   * and said nothing about why.
   */
  const lateMarks =
    policy === null ? [0, 0, 0, 0] : [0, 5, 10, 15].map((step) => policy.lateGraceMinutes + step);

  /** `603:1924` — three day-lengths above the published threshold, one hour apart. */
  const longHourMarks =
    policy === null
      ? [0, 0, 0]
      : [1, 2, 3].map((hours) => policy.longHoursThresholdMinutes + hours * 60);

  /** `605:2027` — the design's own three counts. A COUNT is not a policy value. */
  const fivePlusCounts = [3, 6, 12];

  return {
    'rating-tiers': {
      key: 'rating-tiers',
      nodeId: '597:1221',
      title: 'Rating',
      icon: 'star',
      blurb: 'ACCHA kaam, ACCHI kamai',
      standingLabel: 'Aapki rating',
      standingLabelWidth: null,
      standingValueWidth: 58,
      blurbPaddingV: 0,
      blurbWidth: 247,
      body: {
        kind: 'matrix',
        header: ['Rating', 'Din', 'Mahina'],
        /*
         * The rating BANDS are retained because they are not money — they are the tiers the sheet
         * is about, and the block threshold below them is an eligibility rule.
         *
         * The two money columns are not. The backend pays `presentDayBasePaise` for a present day
         * UNCONDITIONALLY — `financial-service` appends the present-day event with no rating input
         * anywhere — so a rate that varies by rating band does not exist to be derived. The old
         * table asserted ₹1,175 / ₹1,075 / ₹925 / ₹725 against a flat ₹1,000, and that is exactly
         * the class of invented figure this file no longer carries.
         *
         * Recorded as a blocked contract gap: either the policy grows rating-tiered day rates, or
         * this sheet stops promising them.
         */
        rows: [
          { fill: TIER_1, cells: ['4.8 · 4.9 · 5', UNAVAILABLE, UNAVAILABLE] },
          { fill: TIER_2, cells: ['4.5 · 4.6 · 4.7', UNAVAILABLE, UNAVAILABLE] },
          { fill: TIER_3, cells: ['4.2 · 4.3 · 4.4', UNAVAILABLE, UNAVAILABLE] },
          { fill: TIER_4, cells: ['4 · 4.1', UNAVAILABLE, UNAVAILABLE] },
          { fill: TIER_BLOCKED, cells: ['4 se neeche', 'ID block', 'ID block'] },
        ],
      },
    },

    'no-show': {
      key: 'no-show',
      nodeId: '603:1865',
      title: 'No Show',
      icon: 'multiply',
      blurb: 'NO SHOW: booking pe nahi jaana',
      standingLabel: 'Cycle ke NO SHOWS',
      standingLabelWidth: 183,
      standingValueWidth: 58,
      blurbPaddingV: 6,
      blurbWidth: 291,
      body: {
        kind: 'policy',
        title: '1 cycle ke NO SHOWS',
        columns: null,
        rowFill: TIER_4,
        columnWidths: [175, 96],
        cellFontSize: 20,
        footnoteTracking: 0.18,
        accent: PENALTY_ACCENT,
        /*
         * Three rows, one per occurrence, all the same amount — because `noShowPenaltyPaise` is a
         * single scalar and the ledger appends the same deduction every time. The old table read
         * -₹300 / -₹400 / -₹500, an escalation with nothing behind it.
         */
        rows: [
          ['1- pehla', money(policy === null ? null : -policy.noShowPenaltyPaise)],
          ['2- dusra', money(policy === null ? null : -policy.noShowPenaltyPaise)],
          ['3- teesra', money(policy === null ? null : -policy.noShowPenaltyPaise)],
        ],
        /*
         * The old footnote promised the penalty rises ₹100 after each no-show. It does not. This
         * one states the flat amount instead, in the same five-segment shape so the run wraps the
         * way the frame draws it.
         */
        footnote: [
          { text: 'Har ' },
          { text: '1 NO SHOW', strong: true },
          { text: ' ka ' },
          { text: money(policy === null ? null : -policy.noShowPenaltyPaise), strong: true },
          { text: ' nuksaan hai' },
        ],
      },
    },

    'bonus-over-7': {
      key: 'bonus-over-7',
      nodeId: '603:1924',
      title: 'Extra hours',
      icon: 'timer',
      blurb:
        policy === null
          ? `Extra hours: ${UNAVAILABLE}`
          : `Extra hours: ${policy.longHoursThresholdMinutes / 60} hours se upar`,
      standingLabel: 'Cycle ke extra hours',
      standingLabelWidth: 183,
      standingValueWidth: null,
      blurbPaddingV: 6,
      blurbWidth: 291,
      body: {
        kind: 'policy',
        title:
          policy === null
            ? `${UNAVAILABLE} se zyada ke kaam`
            : `${policy.longHoursThresholdMinutes / 60} se zyada ke kaam`,
        columns: ['Ghante', 'Din', 'Mahina'],
        rowFill: TIER_4,
        columnWidths: [87, 76, 100],
        cellFontSize: 18,
        footnoteTracking: 0,
        accent: BONUS_ACCENT,
        /*
         * `Mahina` is the day's bonus over one earnings CYCLE, because `cycleLengthDays` is the
         * only pay period the policy publishes. A calendar month is not a backend concept, and
         * inventing a conversion here is the thing this file exists to stop doing.
         */
        rows: longHourMarks.map((minutes) => {
          const perDay = policy === null ? null : longHoursBonusPaise(minutes, policy);
          return [
            policy === null ? UNAVAILABLE : `${minutes / 60} hrs`,
            bonus(perDay),
            bonus(perDay === null || policy === null ? null : perDay * policy.cycleLengthDays),
          ];
        }),
        footnote: [
          {
            text:
              policy === null
                ? `${UNAVAILABLE} se upar har `
                : `${policy.longHoursThresholdMinutes / 60} se upar har `,
          },
          { text: '1 extra ghante', strong: true },
          { text: ' ka ' },
          {
            text: `${money(policy === null ? null : policy.longHoursRatePerHourPaise)} bonus`,
            strong: true,
          },
          { text: ' hai' },
        ],
      },
    },

    'bonus-5-plus': {
      key: 'bonus-5-plus',
      nodeId: '605:2027',
      title: '5+ rating',
      icon: 'star',
      blurb: '5+ : bohot he zyada accha kaam',
      standingLabel: 'Cycle ke 5+ ratings',
      standingLabelWidth: 183,
      standingValueWidth: 58,
      blurbPaddingV: 6,
      blurbWidth: 290,
      body: {
        kind: 'policy',
        title: '5+ rating se kamai',
        columns: ['5+', 'Cycle', 'Mahina'],
        rowFill: TIER_4,
        columnWidths: [76, 86, 100],
        cellFontSize: 18,
        footnoteTracking: 0,
        accent: BONUS_ACCENT,
        /*
         * `Cycle` is the count times the published per-rating bonus. `Mahina` is that over the
         * whole cycles that fit a thirty-day month — with the published 28-day cycle that is one,
         * so the two columns agree. They agree because the backend's pay period IS about a month,
         * not because the second column was copied from the first.
         */
        rows: fivePlusCounts.map((count) => {
          const perCycle = policy === null ? null : count * policy.fivePlusBonusPaise;
          const cyclesPerMonth =
            policy === null ? 0 : Math.max(1, Math.round(30 / policy.cycleLengthDays));
          return [
            String(count),
            bonus(perCycle),
            bonus(perCycle === null ? null : perCycle * cyclesPerMonth),
          ];
        }),
        footnote: [
          { text: 'Har ghar se ' },
          { text: '5+', strong: true },
          { text: ' laane ka ' },
          {
            text: `${money(policy === null ? null : policy.fivePlusBonusPaise)} bonus `,
            strong: true,
          },
          { text: 'hai' },
        ],
      },
    },

    late: {
      key: 'late',
      nodeId: '605:2094',
      title: 'Late',
      icon: 'clock',
      blurb: 'LATE: booking pe late jaana',
      standingLabel: 'Cycle ke total late',
      standingLabelWidth: 165,
      standingValueWidth: null,
      blurbPaddingV: 6,
      blurbWidth: 291,
      body: {
        kind: 'policy',
        title: 'Kisi job pe late jaana',
        columns: null,
        rowFill: TIER_4,
        columnWidths: [175, 96],
        cellFontSize: 20,
        footnoteTracking: 0.18,
        accent: PENALTY_ACCENT,
        /*
         * The first row is the grace, and it costs nothing — which is what the old table denied by
         * charging ₹30 for three minutes the ledger forgives entirely.
         */
        rows: lateMarks.map((minutes) => [
          policy === null ? UNAVAILABLE : `${minutes} mins`,
          money(policy === null ? null : -latePenaltyPaise(minutes, policy)),
        ]),
        footnote: [
          {
            text:
              policy === null
                ? `${UNAVAILABLE} minute ke baad, `
                : `${policy.lateGraceMinutes} minute ke baad, `,
          },
          { text: 'har minute,', strong: true },
          { text: ' ' },
          { text: money(policy === null ? null : policy.latePenaltyPerMinutePaise), strong: true },
          { text: ' ka nuksaan hai' },
        ],
      },
    },
  };
}

/** `609:360` … `609:392` — the six chips on the Niyam index, in the order V14 draws them. */
export const niyamIndexChips = {
  kamai: ['rating-tiers', 'bonus-over-7', 'bonus-5-plus'] as readonly RuleKey[],
  nuksaan: ['no-show', 'late'] as readonly RuleKey[],
} as const;

/** The chip label, which is NOT always the sheet title — `609:367` reads `Extra hours`. */
export const chipLabels: Readonly<Record<RuleKey, string>> = {
  'rating-tiers': 'Rating',
  'bonus-over-7': 'Extra hours',
  'bonus-5-plus': '5+',
  'no-show': 'No Show',
  late: 'Late',
};
