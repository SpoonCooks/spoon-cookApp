/**
 * The five V14 `Info` rule sheets (`611:398`), transcribed from the design.
 *
 * ## What is static here, and what is not
 *
 * Two different kinds of number appear on these screens and they must not be confused:
 *
 *   - **The tariff tables below are published policy.** They are the same for every cook and they
 *     are what the design states — `4.8 · 4.9 · 5 → ₹1,175`, `1- pehla → -₹300`, and so on. There
 *     is no backend endpoint that serves them, so they are transcribed from Figma and live here as
 *     content, the same way the app's other fixed copy does.
 *   - **The cook's own figure is NOT here.** `Aapki rating 4.6`, `Cycle ke NO SHOWS 6`,
 *     `Cycle ke extra hours 4 hrs 5 mins` are that cook's live standing, and they are passed into
 *     {@link RuleSheetView} as a prop from the earnings/performance projection. Hardcoding one
 *     would tell a cook they had six no-shows when they had none.
 *
 * The tariff values are therefore **Figma mock content pending a backend contract**, exactly like
 * the disputed 5-vs-7-hour bonus threshold recorded as GAP-19. They are safe to render because
 * they are policy text a cook reads, not money the app claims they earned — but they should move
 * behind an endpoint before the rates ever change.
 */

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
}

/** Design fills, named where a token exists and stated literally where the design is one-off. */
const TIER_1 = '#cfff04';
const TIER_2 = '#ecff9b';
const TIER_3 = '#ffe666';
const TIER_4 = '#ffef99';
const TIER_BLOCKED = '#f5f5f5';

export const ruleSheets: Readonly<Record<RuleKey, RuleSheet>> = {
  'rating-tiers': {
    key: 'rating-tiers',
    nodeId: '597:1221',
    title: 'Rating',
    icon: 'star',
    blurb: 'ACCHA kaam, ACCHI kamai',
    standingLabel: 'Aapki rating',
    body: {
      kind: 'matrix',
      header: ['Rating', 'Din', 'Mahina'],
      rows: [
        { fill: TIER_1, cells: ['4.8 · 4.9 · 5', '₹1,175', '₹35,250'] },
        { fill: TIER_2, cells: ['4.5 · 4.6 · 4.7', '₹1,075', '₹32,250'] },
        { fill: TIER_3, cells: ['4.2 · 4.3 · 4.4', '₹925', '₹27,750'] },
        { fill: TIER_4, cells: ['4 · 4.1', '₹725', '₹21,750'] },
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
    body: {
      kind: 'policy',
      title: '1 cycle ke NO SHOWS',
      columns: null,
      rowFill: TIER_4,
      rows: [
        ['1- pehla', '-₹300'],
        ['2- dusra', '-₹400'],
        ['3- teesra', '-₹500'],
      ],
      footnote: [
        { text: 'Har ' },
        { text: '1 NO SHOW', strong: true },
        { text: ' ke baad penalty ' },
        { text: '₹100', strong: true },
        { text: ' se badh jaegi' },
      ],
    },
  },

  'bonus-over-7': {
    key: 'bonus-over-7',
    nodeId: '603:1924',
    title: 'Extra hours',
    icon: 'timer',
    blurb: 'Extra hours: 7 hours se upar',
    standingLabel: 'Cycle ke extra hours',
    body: {
      kind: 'policy',
      title: '7 se zyada ke kaam',
      columns: ['Ghante', 'Din', 'Mahina'],
      rowFill: TIER_4,
      rows: [
        ['8 hrs', '+₹150', '+₹4,500'],
        ['9 hrs', '+₹300', '+₹9,000'],
        ['10 hrs', '+₹450', '+₹13,500'],
      ],
      footnote: [
        { text: '7 se upar har ' },
        { text: '1 extra ghante', strong: true },
        { text: ' ka ' },
        { text: '₹150', strong: true },
        { text: ' bonus hai' },
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
    body: {
      kind: 'policy',
      title: '5+ rating se kamai',
      columns: ['5+', 'Cycle', 'Mahina'],
      rowFill: TIER_4,
      rows: [
        ['3', '+₹300', '+₹1,200'],
        ['6', '+₹600', '+₹2,400'],
        ['12', '+₹1,200', '+₹4,800'],
      ],
      footnote: [
        { text: 'Har ghar se ' },
        { text: '5+', strong: true },
        { text: ' laane ka ' },
        { text: '₹100', strong: true },
        { text: ' bonus hai' },
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
    body: {
      kind: 'policy',
      title: 'Kisi job pe late jaana',
      columns: null,
      rowFill: TIER_4,
      rows: [
        ['3 mins', '-₹30'],
        ['5 mins', '-₹50'],
        ['10 mins', '-₹100'],
        ['15 mins', '-₹150'],
      ],
      footnote: [
        { text: 'Diye gaye time ke baad, har minute, ' },
        { text: '₹10', strong: true },
        { text: ' ka nuksaan hai' },
      ],
    },
  },
};

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
