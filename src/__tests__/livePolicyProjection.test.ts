import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildRuleSheets } from '@features/info/rules';
import { cookEarningsPolicySchema, type CookEarningsPolicy } from '@core/api/schemas';

/**
 * The whole chain, against a payload a real server actually sent.
 *
 * `__live-policy.json` is the body of `GET /v1/cook/policies/earnings`, captured from a running
 * backend while authenticated as a seeded test Cook through the real OTP login. Everything below
 * runs the production path over it: the same zod schema the client parses with, and the same
 * `buildRuleSheets` the Niyam route renders from.
 *
 * ## Why the expectations are computed rather than written down
 *
 * `policyRules.test.ts` already pins the arithmetic against policies it makes up. What THIS file
 * has to prove is different: that the shape the server sends is one the client can parse, and
 * that whatever is currently published flows through to a row — which a hardcoded expectation
 * would quietly stop doing the moment someone publishes a new version. So the expected values are
 * derived here from the payload, using the ledger's own formulas as stated in the OpenAPI
 * description, and compared against what the app renders.
 *
 * The captured payload happens to be a policy published DURING the wiring journey — deliberately
 * unlike the deployed defaults, so a test that only ever passed against `100_000 / 25_000 / 300`
 * cannot pass here by coincidence.
 */
const live: unknown = JSON.parse(readFileSync(join(__dirname, '__live-policy.json'), 'utf-8'));

function rupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  return `${sign}₹${Math.abs(Math.round(paise / 100)).toLocaleString('en-IN')}`;
}

describe('the live server payload drives the sheets', () => {
  it('parses against the client contract with nothing missing or re-typed', () => {
    const parsed = cookEarningsPolicySchema.safeParse(live);
    if (!parsed.success) throw new Error(parsed.error.message);
    expect(parsed.success).toBe(true);
  });

  it('is a PUBLISHED policy, not the backend’s compiled-in default', () => {
    const policy = cookEarningsPolicySchema.parse(live);
    // `DEFAULT_EARNINGS_POLICY` in the backend is `earnings-v1`. Reading anything else is what
    // proves the route goes through the policy store rather than the constant.
    expect(policy.version).not.toBe('earnings-v1');
    expect(policy.version.length).toBeGreaterThan(0);
  });

  it('charges lateness on the server’s grace and per-minute rate', () => {
    const policy: CookEarningsPolicy = cookEarningsPolicySchema.parse(live);
    const body = buildRuleSheets(policy)['late'].body;
    if (body.kind !== 'policy') throw new Error('not a policy body');

    // The ledger: max(minutes - grace, 0) * perMinute. The marks sit past the grace, so every
    // row prints a real charge — under the published zero grace they are the frame's own
    // 3/5/10/15 (`707:3926`).
    const expected = [3, 5, 10, 15].map((step) => {
      const minutes = policy.lateGraceMinutes + step;
      const paise =
        Math.max(minutes - policy.lateGraceMinutes, 0) * policy.latePenaltyPerMinutePaise;
      return [`${minutes} mins`, rupees(-paise)];
    });
    expect(body.rows.map((row) => [...row])).toEqual(expected);
  });

  it('escalates the no-show deduction by the published step, or says it cannot', () => {
    const policy = cookEarningsPolicySchema.parse(live);
    const body = buildRuleSheets(policy)['no-show'].body;
    if (body.kind !== 'policy') throw new Error('not a policy body');
    const amounts = body.rows.map((row) => row[1]);
    const step = policy.noShowPenaltyStepPaise;
    if (step === null || step === undefined) {
      // A publication carrying no step is one whose ledger does not escalate: it charges the
      // same scalar every time, and the sheet states that rather than a dash. The dash is for a
      // figure the policy does not publish, and this one does.
      expect(amounts).toEqual(Array(3).fill(rupees(-policy.noShowPenaltyPaise)));
    } else {
      expect(amounts).toEqual(
        [0, 1, 2].map((prior) => rupees(-(policy.noShowPenaltyPaise + prior * step))),
      );
    }
  });

  it('prorates the long-hours bonus per minute above the server’s threshold', () => {
    const policy = cookEarningsPolicySchema.parse(live);
    const body = buildRuleSheets(policy)['bonus-over-7'].body;
    if (body.kind !== 'policy') throw new Error('not a policy body');

    // The ledger: floor(max(minutes - threshold, 0) * ratePerHour / 60).
    const expected = [1, 2, 3].map((hours) => {
      const minutes = policy.longHoursThresholdMinutes + hours * 60;
      const perDay = Math.floor(
        (Math.max(minutes - policy.longHoursThresholdMinutes, 0) *
          policy.longHoursRatePerHourPaise) /
          60,
      );
      // `Mahina` is the illustrative thirty-day month the frame prints (`707:3985`).
      return [`${minutes / 60} hrs`, `+${rupees(perDay)}`, `+${rupees(perDay * 30)}`];
    });
    expect(body.rows.map((row) => [...row])).toEqual(expected);
  });

  it('states the server’s threshold in its own copy', () => {
    const policy = cookEarningsPolicySchema.parse(live);
    const sheet = buildRuleSheets(policy)['bonus-over-7'];
    expect(sheet.blurb).toBe(`Extra hours: ${policy.longHoursThresholdMinutes / 60} hours se upar`);
    // The app used to say seven regardless of what was published.
    expect(sheet.blurb).not.toContain('7 hours se upar');
  });

  it('carries none of the SHAPES the app used to hardcode', () => {
    /*
     * Not a blocklist of figures — an earlier version of this test had one and it was wrong: under
     * the published policy here, twenty-three minutes late derives -₹300 legitimately, which is
     * also what the old table happened to print for a third no-show. A derived value is allowed to
     * collide with a literal.
     *
     * What must never come back is the STRUCTURE the literals encoded: a no-show penalty that
     * escalates by occurrence, and a late table that charges before the grace.
     */
    const policy = cookEarningsPolicySchema.parse(live);
    const sheets = buildRuleSheets(policy);

    const late = sheets['late'].body;
    if (late.kind !== 'policy') throw new Error('not a policy body');
    // The marks sit past the grace, so no row can print a zero the ledger would not charge.
    expect(late.rows[0]?.[0]).toBe(`${policy.lateGraceMinutes + 3} mins`);
    expect(late.rows[0]?.[1]).toBe(rupees(-3 * policy.latePenaltyPerMinutePaise));

    // The Rating sheet promises money exactly when tiers are published, and `—` when not.
    const rating = sheets['rating-tiers'].body;
    if (rating.kind !== 'matrix') throw new Error('not a matrix body');
    const tiers = policy.presentDayRatingTiers;
    if (tiers === null || tiers === undefined) {
      expect(rating.rows[0]?.cells[1]).toBe('—');
    } else {
      expect(rating.rows[0]?.cells[1]).toBe(rupees(tiers[0]?.basePaise ?? 0));
    }
  });
});
