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

    // The ledger: max(minutes - grace, 0) * perMinute. The first row IS the grace, so it is free.
    const expected = [0, 5, 10, 15].map((step) => {
      const minutes = policy.lateGraceMinutes + step;
      const paise =
        Math.max(minutes - policy.lateGraceMinutes, 0) * policy.latePenaltyPerMinutePaise;
      return [`${minutes} mins`, rupees(-paise)];
    });
    expect(body.rows.map((row) => [...row])).toEqual(expected);
    expect(body.rows[0]?.[1]).toBe('₹0');
  });

  it('charges the server’s flat no-show deduction, with no escalation', () => {
    const policy = cookEarningsPolicySchema.parse(live);
    const body = buildRuleSheets(policy)['no-show'].body;
    if (body.kind !== 'policy') throw new Error('not a policy body');
    const amounts = body.rows.map((row) => row[1]);
    expect(amounts).toEqual(Array(3).fill(rupees(-policy.noShowPenaltyPaise)));
    expect(new Set(amounts).size).toBe(1);
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
      return [
        `${minutes / 60} hrs`,
        `+${rupees(perDay)}`,
        `+${rupees(perDay * policy.cycleLengthDays)}`,
      ];
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

    const noShow = sheets['no-show'].body;
    if (noShow.kind !== 'policy') throw new Error('not a policy body');
    // Flat, because `noShowPenaltyPaise` is one scalar the ledger appends unchanged.
    expect(new Set(noShow.rows.map((row) => row[1])).size).toBe(1);

    const late = sheets['late'].body;
    if (late.kind !== 'policy') throw new Error('not a policy body');
    // The first row is the grace and costs nothing, whatever the grace happens to be.
    expect(late.rows[0]?.[0]).toBe(`${policy.lateGraceMinutes} mins`);
    expect(late.rows[0]?.[1]).toBe('₹0');

    // And the Rating sheet still promises no rate, because none is published.
    const rating = sheets['rating-tiers'].body;
    if (rating.kind !== 'matrix') throw new Error('not a matrix body');
    expect(rating.rows[0]?.cells[1]).toBe('—');
  });
});
