import { StyleSheet, View } from 'react-native';

import { formatRupees, type EarningsSummary } from '@core/domain/money';
import { color, radius, shadow, spacing } from '../theme/tokens';
import { Text } from '../primitives/Text';

/**
 * The earnings breakdown shared by `Page 3a- money daily` (`485:5062`),
 * `Page 3b- money 7 days` (`492:5336`), `Page 3c- money monthly` (`502:192`) and
 * `Page 3c- past cycle` (`504:934`).
 *
 * All four Figma frames have the same structure and differ only in their labels and figures, so
 * they share one component and take their wording from props.
 *
 * Every number is rendered straight from the backend projection. This component performs no
 * arithmetic at all — not even summing base + bonus + tip — because the ledger is the only
 * authority on what a cook earned.
 */
export interface MoneySummaryProps {
  readonly summary: EarningsSummary;
  /** `Aaj ka kaam` / `mahine ka kaam`. */
  readonly workLabel: string;
  /** `Aaj ki kamaai` / `mahine ki kamai`. */
  readonly grossLabel: string;
  /** `aaj ki galtiyaan` / `mahine ki galatiyaan`. */
  readonly mistakesLabel: string;
  /** `Aaj ki katauti` / `mahine ki katauti`. */
  readonly deductionsLabel: string;
}

export function MoneySummary({
  summary,
  workLabel,
  grossLabel,
  mistakesLabel,
  deductionsLabel,
}: MoneySummaryProps): React.ReactElement {
  const bonus = summary.bonusProgress;

  return (
    <View style={styles.stack}>
      <View style={styles.card} testID="money-work">
        <Text variant="captionMuted">{workLabel}</Text>
        <View style={styles.inlineRow}>
          <Text variant="displayLg">{summary.workedHours}</Text>
          <Text variant="bodyMuted">ghante</Text>
        </View>
        {bonus?.message != null && (
          <View style={styles.bonusPill}>
            <Text variant="caption">{bonus.message}</Text>
          </View>
        )}
      </View>

      <View style={styles.card} testID="money-earnings">
        <Text variant="captionMuted">{grossLabel}</Text>
        <Text variant="displayLg">{formatRupees(summary.grossPaise)}</Text>
        <View style={styles.divider} />
        <Line label="Base" value={formatRupees(summary.basePaise)} />
        <Line label="Bonus" value={formatRupees(summary.bonusPaise)} />
        <Line label="Tip" value={formatRupees(summary.tipsPaise)} />
      </View>

      <View style={styles.card} testID="money-deductions">
        <Text variant="captionMuted">{mistakesLabel}</Text>
        <Line
          label="No show"
          sublabel="Kaam par NAHI gaye"
          count={summary.noShow.count}
          value={formatRupees(summary.noShow.amountPaise)}
          tone={color.danger}
        />
        <Line
          label="Late"
          sublabel="Kaam par LATE gaye"
          count={summary.late.count}
          value={formatRupees(summary.late.amountPaise)}
          tone={color.danger}
        />
        <View style={styles.divider} />
        <Line
          label={deductionsLabel}
          value={formatRupees(summary.totalDeductionsPaise)}
          tone={color.danger}
          strong
        />
      </View>

      <View style={[styles.card, styles.finalCard]} testID="money-final">
        <Text variant="captionMuted">final kamai</Text>
        <Text variant="displayLg">{formatRupees(summary.finalPaise)}</Text>
      </View>
    </View>
  );
}

function Line({
  label,
  sublabel,
  count,
  value,
  tone,
  strong = false,
}: {
  label: string;
  sublabel?: string | undefined;
  count?: number | undefined;
  value: string;
  tone?: string | undefined;
  strong?: boolean | undefined;
}): React.ReactElement {
  return (
    <View style={styles.line}>
      <View style={styles.lineLabel}>
        <Text variant={strong ? 'bodyStrong' : 'caption'}>{label}</Text>
        {sublabel !== undefined && <Text variant="captionMuted">{sublabel}</Text>}
      </View>
      <View style={styles.lineValue}>
        {count !== undefined && <Text variant="captionStrong">{count}</Text>}
        <Text variant={strong ? 'bodyStrong' : 'captionStrong'} color={tone}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.l },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    padding: spacing.l,
    gap: spacing.s,
    ...shadow.card,
  },
  finalCard: { backgroundColor: color.lime300 },
  inlineRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.s },
  bonusPill: {
    backgroundColor: color.yellow300,
    borderRadius: radius.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  divider: { height: 1, backgroundColor: color.grey100, marginVertical: spacing.xs },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.m,
  },
  lineLabel: { flex: 1, gap: spacing.xxs },
  lineValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
});
