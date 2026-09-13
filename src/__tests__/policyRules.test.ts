import { buildRuleSheets, type RuleKey } from '@features/info/rules';
import type { CookEarningsPolicy } from '@core/api/schemas';

/**
 * The Niyam sheets are a projection of the published earnings policy, not a table in the app.
 *
 * ## What these lock
 *
 * Every rupee figure on the five sheets is derived from `GET /cook/policies/earnings` — the
 * 2026-08-29 founder tariff (`707:3796`): rating-banded day rates, an escalating no-show
 * penalty, lateness charged from the first minute, and a seven-hour extra-hours threshold. So
 * these assert the FORMULAS against `financial-service`, not just the numbers, and the last
 * describe asserts the thing that actually matters: publish a different policy and the same
 * build renders different sheets.
 */

const PUBLISHED: CookEarningsPolicy = {
  version: 'earnings-v2',
  cycleLengthDays: 28,
  presentDayBasePaise: 100_000,
  fivePlusBonusPaise: 10_000,
  longHoursThresholdMinutes: 420,
  longHoursRatePerHourPaise: 15_000,
  fullCycleBonusPaise: 200_000,
  twentySevenDayBonusPaise: 100_000,
  paidLeaveRefundPaise: 100_000,
  noShowPenaltyPaise: 30_000,
  noShowPenaltyStepPaise: 10_000,
  lateGraceMinutes: 0,
  latePenaltyPerMinutePaise: 1_000,
  presentDayRatingTiers: [
    { minRating: 4.8, basePaise: 117_500 },
    { minRating: 4.5, basePaise: 107_500 },
    { minRating: 4.2, basePaise: 92_500 },
    { minRating: 4.0, basePaise: 72_500 },
  ],
};

function policyRows(policy: CookEarningsPolicy | null, key: RuleKey): readonly string[][] {
  const body = buildRuleSheets(policy)[key].body;
  if (body.kind !== 'policy') throw new Error(`${key} is not a policy body`);
  return body.rows.map((row) => [...row]);
}

function footnote(policy: CookEarningsPolicy | null, key: RuleKey): string {
  const body = buildRuleSheets(policy)[key].body;
  if (body.kind !== 'policy') throw new Error(`${key} is not a policy body`);
  return body.footnote.map((segment) => segment.text).join('');
}

describe('the Late sheet charges from the first minute — the published grace is zero', () => {
  it('prints the design marks, each charged in full', () => {
    // `calculateLatePenaltyMinutes` is `max(minutes - grace, 0)`; with the published zero
    // grace, three late minutes cost ₹30 (`707:3926`).
    expect(policyRows(PUBLISHED, 'late')).toEqual([
      ['3 mins', '-₹30'],
      ['5 mins', '-₹50'],
      ['10 mins', '-₹100'],
      ['15 mins', '-₹150'],
    ]);
  });

  it('says the charge starts at the given time itself', () => {
    expect(footnote(PUBLISHED, 'late')).toBe(
      'Diye gaye time ke baad, har minute, ₹10 ka nuksaan hai',
    );
  });
});

describe('the No Show sheet states the published escalation', () => {
  it('escalates by the published step per occurrence', () => {
    // The ledger charges base + step × prior no-shows in the cycle
    // (`countCycleNoShowPenalties`), so the three rows read ₹300, ₹400, ₹500 (`707:3871`).
    expect(policyRows(PUBLISHED, 'no-show')).toEqual([
      ['1- pehla', '-₹300'],
      ['2- dusra', '-₹400'],
      ['3- teesra', '-₹500'],
    ]);
  });

  it('promises exactly the published step-up', () => {
    expect(footnote(PUBLISHED, 'no-show')).toBe('Har 1 NO SHOW ke baad penalty ₹100 se badh jaegi');
  });
});

describe('the Extra hours sheet uses the published threshold and prorates', () => {
  it('starts one hour above the published seven-hour threshold', () => {
    const hours = policyRows(PUBLISHED, 'bonus-over-7').map((row) => row[0]);
    expect(hours).toEqual(['8 hrs', '9 hrs', '10 hrs']);
  });

  it('pays the prorated per-minute bonus, not one hour’s rate per hour marked', () => {
    // floor(max(minutes - 420, 0) * 15000 / 60): 8h -> ₹150, 9h -> ₹300, 10h -> ₹450.
    const perDay = policyRows(PUBLISHED, 'bonus-over-7').map((row) => row[1]);
    expect(perDay).toEqual(['+₹150', '+₹300', '+₹450']);
  });

  it('extends the day figure over the illustrative thirty-day month the frame prints', () => {
    const perMonth = policyRows(PUBLISHED, 'bonus-over-7').map((row) => row[2]);
    expect(perMonth).toEqual(['+₹4,500', '+₹9,000', '+₹13,500']);
  });

  it('states the threshold in its own title and blurb', () => {
    const sheet = buildRuleSheets(PUBLISHED)['bonus-over-7'];
    expect(sheet.blurb).toBe('Extra hours: 7 hours se upar');
    expect(sheet.body.kind === 'policy' ? sheet.body.title : '').toBe('7 se zyada ke kaam');
  });
});

describe('the 5+ sheet multiplies the published per-rating bonus', () => {
  it('pays the policy’s bonus once per rating', () => {
    const perCycle = policyRows(PUBLISHED, 'bonus-5-plus').map((row) => row[1]);
    expect(perCycle).toEqual(['+₹300', '+₹600', '+₹1,200']);
  });

  it('prints a month as four of the seven-day cycles the Kamai tabs draw', () => {
    const perMonth = policyRows(PUBLISHED, 'bonus-5-plus').map((row) => row[2]);
    expect(perMonth).toEqual(['+₹1,200', '+₹2,400', '+₹4,800']);
  });
});

describe('the Rating sheet derives its bands and money from the published tiers', () => {
  it('prints the tier rates by day and by thirty-day month', () => {
    const body = buildRuleSheets(PUBLISHED)['rating-tiers'].body;
    if (body.kind !== 'matrix') throw new Error('rating-tiers is not a matrix');
    expect(body.rows.map((row) => [...row.cells])).toEqual([
      ['4.8 · 4.9 · 5', '₹1,175', '₹35,250'],
      ['4.5 · 4.6 · 4.7', '₹1,075', '₹32,250'],
      ['4.2 · 4.3 · 4.4', '₹925', '₹27,750'],
      ['4 · 4.1', '₹725', '₹21,750'],
      ['4 se neeche', 'ID block', 'ID block'],
    ]);
  });
});

describe('with no policy the sheets say so rather than guessing', () => {
  it('renders no rupee figure anywhere', () => {
    for (const key of ['no-show', 'late', 'bonus-over-7', 'bonus-5-plus'] as const) {
      const cells = policyRows(null, key).flat();
      expect(cells.some((cell) => cell.includes('₹'))).toBe(false);
      expect(cells).toContain('—');
    }
  });

  it('does not fall back to the published figures', () => {
    const everything = (['no-show', 'late', 'bonus-over-7', 'bonus-5-plus'] as const).flatMap(
      (key) => policyRows(null, key).flat(),
    );
    for (const stale of ['-₹300', '-₹400', '-₹500', '-₹30', '+₹150', '+₹4,500']) {
      expect(everything).not.toContain(stale);
    }
  });

  it('renders no rating money against a pre-revision publication with no tiers', () => {
    const body = buildRuleSheets({ ...PUBLISHED, presentDayRatingTiers: null })['rating-tiers']
      .body;
    if (body.kind !== 'matrix') throw new Error('rating-tiers is not a matrix');
    for (const row of body.rows.slice(0, 4)) {
      expect(row.cells[1]).toBe('—');
      expect(row.cells[2]).toBe('—');
    }
  });
});

/**
 * The reason the route exists.
 *
 * An owner publishes a new earnings policy version. The backend starts charging it immediately.
 * This asserts the app follows — same build, same binary, different sheets — which is precisely
 * what the hardcoded tables could not do.
 */
describe('publishing a policy changes the sheets without a new build', () => {
  const REPUBLISHED: CookEarningsPolicy = {
    ...PUBLISHED,
    version: 'earnings-v3',
    longHoursThresholdMinutes: 240,
    longHoursRatePerHourPaise: 16_400,
    noShowPenaltyPaise: 31_700,
    noShowPenaltyStepPaise: 5_000,
    lateGraceMinutes: 7,
    latePenaltyPerMinutePaise: 1_900,
    fivePlusBonusPaise: 12_300,
    presentDayRatingTiers: [
      { minRating: 4.5, basePaise: 120_000 },
      { minRating: 4.0, basePaise: 90_000 },
    ],
  };

  it('moves the late grace and the per-minute rate', () => {
    // Marks shift with the grace (7 + 3/5/10/15) and charge only the minutes past it.
    expect(policyRows(REPUBLISHED, 'late')).toEqual([
      ['10 mins', '-₹57'],
      ['12 mins', '-₹95'],
      ['17 mins', '-₹190'],
      ['22 mins', '-₹285'],
    ]);
    expect(footnote(REPUBLISHED, 'late')).toBe('7 minute ke baad, har minute, ₹19 ka nuksaan hai');
  });

  it('moves the no-show base and step together', () => {
    expect(policyRows(REPUBLISHED, 'no-show').map((row) => row[1])).toEqual([
      '-₹317',
      '-₹367',
      '-₹417',
    ]);
  });

  it('moves the long-hours threshold and rate', () => {
    // 240 minutes is four hours, so the rows start at five.
    const rows = policyRows(REPUBLISHED, 'bonus-over-7');
    expect(rows.map((row) => row[0])).toEqual(['5 hrs', '6 hrs', '7 hrs']);
    expect(rows.map((row) => row[1])).toEqual(['+₹164', '+₹328', '+₹492']);
  });

  it('moves the five-plus bonus', () => {
    expect(policyRows(REPUBLISHED, 'bonus-5-plus').map((row) => row[1])).toEqual([
      '+₹369',
      '+₹738',
      '+₹1,476',
    ]);
  });

  it('moves the rating bands with the published tiers', () => {
    const body = buildRuleSheets(REPUBLISHED)['rating-tiers'].body;
    if (body.kind !== 'matrix') throw new Error('rating-tiers is not a matrix');
    expect(body.rows.map((row) => [...row.cells])).toEqual([
      ['4.5 · 4.6 · 4.7 · 4.8 · 4.9 · 5', '₹1,200', '₹36,000'],
      ['4 · 4.1 · 4.2 · 4.3 · 4.4', '₹900', '₹27,000'],
      ['4 se neeche', 'ID block', 'ID block'],
    ]);
  });

  it('changes every money sheet, and leaves the geometry alone', () => {
    const before = buildRuleSheets(PUBLISHED);
    const after = buildRuleSheets(REPUBLISHED);
    for (const key of ['no-show', 'late', 'bonus-over-7', 'bonus-5-plus'] as const) {
      expect(policyRows(REPUBLISHED, key)).not.toEqual(policyRows(PUBLISHED, key));
      // The frame is the frame. A publication must not move a column or a type size.
      expect(after[key].blurbPaddingV).toBe(before[key].blurbPaddingV);
      expect(after[key].standingValueWidth).toBe(before[key].standingValueWidth);
      const a = after[key].body;
      const b = before[key].body;
      if (a.kind === 'policy' && b.kind === 'policy') {
        expect(a.columnWidths).toEqual(b.columnWidths);
        expect(a.cellFontSize).toBe(b.cellFontSize);
        expect(a.footnoteTracking).toBe(b.footnoteTracking);
        expect(a.rows).toHaveLength(b.rows.length);
      }
    }
  });
});
