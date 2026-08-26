import { buildRuleSheets, type RuleKey } from '@features/info/rules';
import type { CookEarningsPolicy } from '@core/api/schemas';

/**
 * The Niyam sheets are a projection of the published earnings policy, not a table in the app.
 *
 * ## What these lock
 *
 * The four sheets that quote money used to be literals, and they had drifted from the running
 * ledger in every direction:
 *
 *   - an escalating no-show penalty (`-₹300 / -₹400 / -₹500`) that the backend does not implement;
 *   - late minutes charged from the first minute, inside a five-minute grace the ledger forgives;
 *   - a long-hours bonus understated threefold, by reading a five-hour threshold as seven and a
 *     per-minute proration as whole hours.
 *
 * So these assert the FORMULAS against `financial-service`, not just the numbers, and the last
 * describe asserts the thing that actually matters: publish a different policy and the same build
 * renders different sheets.
 */

const PUBLISHED: CookEarningsPolicy = {
  version: 'earnings-v1',
  cycleLengthDays: 28,
  presentDayBasePaise: 100_000,
  fivePlusBonusPaise: 10_000,
  longHoursThresholdMinutes: 300,
  longHoursRatePerHourPaise: 15_000,
  fullCycleBonusPaise: 200_000,
  twentySevenDayBonusPaise: 100_000,
  paidLeaveRefundPaise: 100_000,
  noShowPenaltyPaise: 25_000,
  lateGraceMinutes: 5,
  latePenaltyPerMinutePaise: 1_000,
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

describe('the Late sheet applies the ledger’s grace', () => {
  it('opens on the grace itself, at zero', () => {
    // `calculateLatePenaltyMinutes` is `max(minutes - grace, 0)`, so five minutes costs nothing.
    expect(policyRows(PUBLISHED, 'late')[0]).toEqual(['5 mins', '₹0']);
  });

  it('charges only the minutes past the grace', () => {
    // 10 late = 5 chargeable at ₹10; 15 late = 10; 20 late = 15.
    expect(policyRows(PUBLISHED, 'late').slice(1)).toEqual([
      ['10 mins', '-₹50'],
      ['15 mins', '-₹100'],
      ['20 mins', '-₹150'],
    ]);
  });

  it('never states the pre-grace figures the hardcoded table used to', () => {
    const rendered = policyRows(PUBLISHED, 'late').flat();
    // The old table read 3 mins -> -₹30 and 5 mins -> -₹50, both of which the ledger forgives.
    expect(rendered).not.toContain('-₹30');
    expect(rendered.filter((cell) => cell === '3 mins')).toHaveLength(0);
  });

  it('quotes the grace and the per-minute rate in its footnote', () => {
    expect(footnote(PUBLISHED, 'late')).toBe('5 minute ke baad, har minute, ₹10 ka nuksaan hai');
  });
});

describe('the No Show sheet does not invent an escalation', () => {
  it('charges the same flat deduction for every occurrence', () => {
    // `noShowPenaltyPaise` is one scalar and the ledger appends it unchanged each time.
    expect(policyRows(PUBLISHED, 'no-show')).toEqual([
      ['1- pehla', '-₹250'],
      ['2- dusra', '-₹250'],
      ['3- teesra', '-₹250'],
    ]);
  });

  it('does not promise the ₹100 step-up the old footnote claimed', () => {
    expect(footnote(PUBLISHED, 'no-show')).toBe('Har 1 NO SHOW ka -₹250 nuksaan hai');
    expect(footnote(PUBLISHED, 'no-show')).not.toContain('badh jaegi');
  });
});

describe('the Extra hours sheet uses the published threshold and prorates', () => {
  it('starts one hour above the threshold the policy publishes, not seven', () => {
    // 300 minutes is FIVE hours. The old table titled itself `7 se zyada ke kaam`.
    const hours = policyRows(PUBLISHED, 'bonus-over-7').map((row) => row[0]);
    expect(hours).toEqual(['6 hrs', '7 hrs', '8 hrs']);
  });

  it('pays the prorated per-minute bonus, not one hour’s rate per hour marked', () => {
    // floor(max(minutes - 300, 0) * 15000 / 60): 6h -> ₹150, 7h -> ₹300, 8h -> ₹450.
    const perDay = policyRows(PUBLISHED, 'bonus-over-7').map((row) => row[1]);
    expect(perDay).toEqual(['+₹150', '+₹300', '+₹450']);
  });

  it('extends the day figure over the published cycle length', () => {
    const perCycle = policyRows(PUBLISHED, 'bonus-over-7').map((row) => row[2]);
    expect(perCycle).toEqual(['+₹4,200', '+₹8,400', '+₹12,600']);
  });

  it('states the threshold in its own title and blurb', () => {
    const sheet = buildRuleSheets(PUBLISHED)['bonus-over-7'];
    expect(sheet.blurb).toBe('Extra hours: 5 hours se upar');
    expect(sheet.body.kind === 'policy' ? sheet.body.title : '').toBe('5 se zyada ke kaam');
  });
});

describe('the 5+ sheet multiplies the published per-rating bonus', () => {
  it('pays the policy’s bonus once per rating', () => {
    const perCycle = policyRows(PUBLISHED, 'bonus-5-plus').map((row) => row[1]);
    expect(perCycle).toEqual(['+₹300', '+₹600', '+₹1,200']);
  });
});

describe('the Rating sheet states nothing the backend does not pay', () => {
  it('renders no day or month rate, because none is published', () => {
    /*
     * `financial-service` appends the present-day event at `presentDayBasePaise` with no rating
     * input anywhere, so a rate that varies by band does not exist to derive. The old table
     * asserted ₹1,175 / ₹1,075 / ₹925 / ₹725 against a flat ₹1,000.
     */
    const body = buildRuleSheets(PUBLISHED)['rating-tiers'].body;
    if (body.kind !== 'matrix') throw new Error('rating-tiers is not a matrix');
    const bands = body.rows.slice(0, 4);
    for (const row of bands) {
      expect(row.cells[1]).toBe('—');
      expect(row.cells[2]).toBe('—');
    }
    expect(body.rows.flatMap((row) => [...row.cells])).not.toContain('₹1,175');
  });

  it('keeps the bands and the block rule, which are not money', () => {
    const body = buildRuleSheets(PUBLISHED)['rating-tiers'].body;
    if (body.kind !== 'matrix') throw new Error('rating-tiers is not a matrix');
    expect(body.rows[0]?.cells[0]).toBe('4.8 · 4.9 · 5');
    expect(body.rows[4]?.cells).toEqual(['4 se neeche', 'ID block', 'ID block']);
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

  it('does not fall back to the figures that used to be hardcoded', () => {
    const everything = (['no-show', 'late', 'bonus-over-7', 'bonus-5-plus'] as const).flatMap(
      (key) => policyRows(null, key).flat(),
    );
    for (const stale of ['-₹300', '-₹400', '-₹500', '-₹30', '+₹150', '+₹4,500']) {
      expect(everything).not.toContain(stale);
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
    version: 'earnings-v2',
    longHoursThresholdMinutes: 240,
    longHoursRatePerHourPaise: 16_400,
    noShowPenaltyPaise: 31_700,
    lateGraceMinutes: 7,
    latePenaltyPerMinutePaise: 1_900,
    fivePlusBonusPaise: 12_300,
  };

  it('moves the late grace and the per-minute rate', () => {
    expect(policyRows(REPUBLISHED, 'late')).toEqual([
      ['7 mins', '₹0'],
      ['12 mins', '-₹95'],
      ['17 mins', '-₹190'],
      ['22 mins', '-₹285'],
    ]);
  });

  it('moves the no-show deduction', () => {
    expect(policyRows(REPUBLISHED, 'no-show').map((row) => row[1])).toEqual([
      '-₹317',
      '-₹317',
      '-₹317',
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
