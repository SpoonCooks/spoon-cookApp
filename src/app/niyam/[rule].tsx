import { router, useLocalSearchParams } from 'expo-router';

import { useCookProfile } from '@core/api/queries';
import { RuleSheetView } from '@features/info/InfoViews';
import { ruleSheets, type RuleKey } from '@features/info/rules';

/**
 * One V14 rule sheet, presented over the Niyam screen.
 *
 * `597:1221` rating tiers · `603:1865` No Show · `603:1924` extra hours · `605:2027` 5+ rating ·
 * `605:2094` late.
 *
 * ## Only one of the five standings exists on the API today
 *
 * Each sheet ends with the cook's own figure against the policy above it. `GET /v1/cook/me`
 * supplies `rating.average`, which is what `Aapki rating` shows. It does **not** expose:
 *
 *   - a NO SHOW **count** for the cycle (`GET /v1/cook/earnings` carries only
 *     `noShowDeductionsPaise`),
 *   - a late **duration** for the cycle (only `lateDeductionsPaise`),
 *   - extra hours worked beyond seven,
 *   - a count of 5+ ratings received.
 *
 * Those four render as `—` rather than being derived from the deduction totals. Dividing
 * `noShowDeductionsPaise` by the tariff would be a client-authored count, and it would be wrong
 * the moment the tariff changed or a penalty was waived — a cook would be told they had three
 * no-shows when the server never said so. The precise missing contract is recorded in the closure
 * report.
 */
const UNAVAILABLE = '—';

export default function RuleSheetScreen(): React.ReactElement | null {
  const { rule } = useLocalSearchParams<{ rule?: string }>();
  const profile = useCookProfile();

  const sheet = rule !== undefined && isRuleKey(rule) ? ruleSheets[rule] : null;
  if (sheet === null) {
    // An unknown segment is a broken link, not a screen. Return to Niyam rather than inventing one.
    router.back();
    return null;
  }

  const average = profile.data?.cook.rating.average ?? null;
  const standingValue =
    sheet.key === 'rating-tiers' && average !== null ? formatRating(average) : UNAVAILABLE;

  return (
    <RuleSheetView
      sheet={sheet}
      standingValue={standingValue}
      onAcknowledge={() => router.back()}
      onBack={() => router.back()}
    />
  );
}

function isRuleKey(value: string): value is RuleKey {
  return Object.prototype.hasOwnProperty.call(ruleSheets, value);
}

/** `4.6` — one decimal, as `597:1339` draws it. */
function formatRating(average: number): string {
  return average.toFixed(1);
}
