import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDurationHours, formatMinutes } from '@core/domain/job';
import { otpLength } from '@core/domain/otp';
import type { ArrivalTiming, JobSummary, TravelTiming } from '@core/domain/serviceState';
import { isNavigableGate, openGateNavigation } from '@core/location/navigation';
import { Button, color, OtpInput, radius, shadow, spacing, Text } from '@ui';

/** The reasons a live service can terminate without completing. */
export type InterruptionReason = 'cancelled_while_travelling' | 'reassigned' | 'cancelled';

/**
 * Every screen of the Figma Service flow section (`485:4971`).
 *
 * Each view is a pure function of the backend-derived `ServiceState`. None of them advances the
 * flow on its own: pressing a CTA raises a command, and the screen changes only when the next
 * projection says so.
 */

/**
 * Header actions present on every service frame: `Extend booking` and `Help`.
 *
 * OPEN QUESTION (founder comment #145, "'Extend booking' icymi"): extension is customer-initiated
 * and payment-dependent, so there is no cook-side extend command in the backend. The control is
 * rendered because the Figma shows it, but it is disabled rather than wired to nothing.
 */
function ServiceHeader({ onHelp }: { onHelp?: (() => void) | undefined }): React.ReactElement {
  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        disabled
        style={[styles.headerAction, styles.headerActionDisabled]}
        testID="service-extend-booking"
      >
        <Text variant="label">Extend booking</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onHelp}
        style={styles.headerAction}
        testID="service-help"
      >
        <Text variant="label">Help</Text>
      </Pressable>
    </View>
  );
}

/**
 * Customer + address block shown on the travel and arrival frames.
 *
 * The flat/floor details are displayed exactly as the Figma specifies. They are DISPLAY ONLY:
 * `Map dekhe` targets the society GATE, never the flat, and arrival is detected at the gate.
 * See GAP-14 for the open privacy question of whether these should appear before gate arrival.
 *
 * ## `Map dekhe` routes to the operational gate
 *
 * The handler is given `job.gate` and nothing else, so it cannot route to the flat even by
 * mistake — `openGateNavigation` accepts only a `GateTarget`. A gate the backend never supplied
 * (or a zeroed coordinate) disables the button instead of opening a maps app at Null Island.
 *
 * ## `Call kare` is backend-blocked, and says so
 *
 * There is no cook-to-customer contact route: `GET /v1/bookings/:id/cook-contact` is guarded by
 * `requireCustomer` and hands the CUSTOMER the cook's number, not the reverse. The control is
 * rendered because the Figma shows it, but it is disabled rather than wired to nothing — a button
 * that silently does nothing is worse than one that is visibly unavailable, because a cook stuck
 * at a gate will keep pressing it.
 */
function CustomerBlock({ job }: { job: JobSummary }): React.ReactElement {
  const { address, gate } = job;
  const [navError, setNavError] = useState<string | null>(null);
  const canNavigate = isNavigableGate(gate);

  const openMap = useCallback(() => {
    setNavError(null);
    void openGateNavigation(gate).then((opened) => {
      if (!opened) setNavError('Map app nahi khul payi.');
    });
  }, [gate]);

  return (
    <View style={styles.card} testID="service-customer-block">
      <View style={styles.rowBetween}>
        <Text variant="titleBlack">{address.customerName ?? ''}</Text>
        <View style={styles.durationPill}>
          <Text variant="captionStrong">{formatDurationHours(job.serviceDurationMinutes)}</Text>
        </View>
      </View>
      <Text variant="captionMuted">{address.buildingName ?? ''}</Text>
      <Text variant="captionMuted">{address.towerOrBlock ?? ''}</Text>
      <Text variant="captionMuted">{address.floor ?? ''}</Text>
      <Text variant="captionMuted">{address.flatOrHouse ?? ''}</Text>

      {/* Gate entry guidance from the operational snapshot. Rendered only when the backend has
          one — an empty row would read as "no instructions needed", which is a different claim. */}
      {gate?.accessInstructions != null && gate.accessInstructions.length > 0 && (
        <View style={styles.accessNote} testID="service-gate-access">
          <Text variant="captionStrong">{gate.label ?? 'Gate'}</Text>
          <Text variant="captionMuted">{gate.accessInstructions}</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <Button
          label="Map dekhe"
          tone="dark"
          fullWidth={false}
          disabled={!canNavigate}
          onPress={canNavigate ? openMap : undefined}
          style={styles.flexAction}
          testID="service-map"
        />
        {/* Founder decision #147 asked for a Call option from travel onward. No cook-side contact
            route exists on the backend, so this stays disabled until one does. */}
        <Button
          label="Call kare"
          tone="accent"
          fullWidth={false}
          disabled
          style={styles.flexAction}
          testID="service-call"
        />
      </View>

      {navError !== null && (
        <Text variant="caption" color={color.danger} testID="service-map-error">
          {navError}
        </Text>
      )}
    </View>
  );
}

const travelCopy: Record<TravelTiming, { headline: string; caption: string }> = {
  on_time: { headline: 'Chalna shuru kar dein', caption: 'mai pahauch jaye' },
  at_risk: { headline: 'Jaldi kare, aap LATE ho rahe', caption: 'aap LATE ho sakte hai' },
  late: { headline: 'Aap LATE hai! Jaldi se jaldi kare', caption: 'aap LATE hai!' },
};

/**
 * Pages 4a / 4b-risk / 4b-late.
 *
 * The two `4b` frames share a Figma label but are DIFFERENT states — they differ in three text
 * layers and the subtitle block height. `TravelRisk` shows a positive countdown; `TravelLate`
 * shows a negative one. They are never collapsed.
 */
export function TravelView({
  job,
  timing,
  minutesToDeadline,
}: {
  job: JobSummary;
  timing: TravelTiming;
  minutesToDeadline: number;
}): React.ReactElement {
  const copy = travelCopy[timing];
  const isLate = timing === 'late';

  return (
    <View style={styles.screen} testID={`service-travel-${timing}`}>
      <ServiceHeader />
      <Text variant="heading">{copy.headline}</Text>
      <View style={styles.countdownBlock}>
        <Text variant="hero" color={timing === 'on_time' ? color.textPrimary : color.danger}>
          {formatMinutes(minutesToDeadline)}
        </Text>
        <Text variant="bodyMuted" color={isLate ? color.danger : color.textSecondary}>
          {copy.caption}
        </Text>
      </View>
      <CustomerBlock job={job} />
    </View>
  );
}

const arrivalCopy: Record<ArrivalTiming, string> = {
  on_time: 'Very good! Aap time par hai',
  late: 'Aap LATE pahauchi hai!',
};

/** Pages 5a / 5b — arrival on time / late. */
export function ArrivalView({
  job,
  timing,
  onConfirmArrival,
  isSubmitting,
}: {
  job: JobSummary;
  timing: ArrivalTiming;
  onConfirmArrival?: (() => void) | undefined;
  isSubmitting?: boolean | undefined;
}): React.ReactElement {
  return (
    <View style={styles.screen} testID={`service-arrival-${timing}`}>
      <ServiceHeader />
      <Text variant="heading" color={timing === 'late' ? color.danger : color.textPrimary}>
        {arrivalCopy[timing]}
      </Text>
      <Button
        label="Mai pahuach gyi hu"
        tone="action"
        onPress={onConfirmArrival}
        loading={isSubmitting}
        testID="service-confirm-arrival"
      />
      <CustomerBlock job={job} />
    </View>
  );
}

/**
 * Pages 6a / 6b — Start OTP.
 *
 * `6b` is labelled "Start OTP on time" in Figma but its copy is the LATE variant
 * (`Customer ko LATE ke liye SORRY bole`), so it is treated as `StartOtpLate`.
 *
 * Length comes from `otpLength.start`. The Figma draws three boxes; the backend issues four.
 * See `@core/domain/otp` for the recorded conflict.
 */
export function StartOtpView({
  timing,
  code,
  onChange,
  onSubmit,
  error,
  isSubmitting,
}: {
  timing: ArrivalTiming;
  code: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  error: string | null;
  isSubmitting: boolean;
}): React.ReactElement {
  return (
    <View style={styles.screen} testID={`service-start-otp-${timing}`}>
      <ServiceHeader />
      {timing === 'late' && (
        <Text variant="heading" color={color.danger}>
          Customer ko LATE ke liye SORRY bole
        </Text>
      )}
      <Text variant="heading">Customer se OTP mange</Text>
      <View style={styles.otpBlock}>
        <Text variant="captionMuted">Start OTP</Text>
        <OtpInput
          testID="start-otp"
          length={otpLength.start}
          value={code}
          onChange={onChange}
          hasError={error !== null}
          disabled={isSubmitting}
        />
        {error !== null && (
          <Text variant="caption" color={color.danger} align="center" testID="start-otp-error">
            {error}
          </Text>
        )}
      </View>
      <Button
        label="Start"
        tone="action"
        disabled={code.length !== otpLength.start}
        loading={isSubmitting}
        onPress={onSubmit}
        testID="service-start-submit"
      />
    </View>
  );
}

/**
 * Pages 7a / 7b / 7c — the cooking timer.
 *
 * `7b` (ending soon) and `7c` (extended) carry identical copy in Figma, so the extension is
 * distinguished by backend state, not by text: `7c` additionally renders the confirmed new end
 * time. The remaining-minutes figure is a server value, and the layout accommodates three digits
 * (founder comment #150 asks whether `100+ mins` is supported — it is).
 */
export function CookingView({
  minutesRemaining,
  isEndingSoon,
  isExtended,
  newExpectedEndIso,
}: {
  minutesRemaining: number;
  isEndingSoon: boolean;
  isExtended: boolean;
  newExpectedEndIso: string | null;
}): React.ReactElement {
  const variant = isExtended ? 'extended' : isEndingSoon ? 'ending_soon' : 'normal';
  return (
    <View style={styles.screen} testID={`service-cooking-${variant}`}>
      <ServiceHeader />
      <Text variant="heading">Time bacha hai</Text>
      <View style={styles.countdownBlock}>
        <Text
          variant="hero"
          color={isEndingSoon && !isExtended ? color.danger : color.textPrimary}
          // Three-digit values must not shrink the glyphs into illegibility.
          adjustsFontSizeToFit
          numberOfLines={1}
          testID="cooking-timer"
        >
          {formatMinutes(minutesRemaining)}
        </Text>
      </View>

      {isExtended ? (
        <View style={styles.noticeCard} testID="cooking-extended-notice">
          <Text variant="bodyStrong">Customer ne time badha diya hai</Text>
          {newExpectedEndIso !== null && (
            <Text variant="captionMuted">{`Naya end time: ${newExpectedEndIso.slice(11, 16)}`}</Text>
          )}
        </View>
      ) : isEndingSoon ? (
        <View style={styles.noticeCard}>
          <Text variant="bodyStrong">Kaam time pai nahi ho paega?</Text>
          <Text variant="captionMuted">Customer ko time badhane bole</Text>
        </View>
      ) : (
        <Text variant="bodyMuted">5+ rating laane ki koshish kare</Text>
      )}
    </View>
  );
}

/** Page 9 — End OTP. */
export function EndOtpView({
  code,
  onChange,
  onSubmit,
  error,
  isSubmitting,
}: {
  code: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  error: string | null;
  isSubmitting: boolean;
}): React.ReactElement {
  return (
    <View style={styles.screen} testID="service-end-otp">
      <ServiceHeader />
      <Text variant="heading">Customer ko THANK YOU bole</Text>
      <Text variant="heading">Customer se OTP mange</Text>
      <View style={styles.otpBlock}>
        <Text variant="captionMuted">End OTP</Text>
        <OtpInput
          testID="end-otp"
          length={otpLength.end}
          value={code}
          onChange={onChange}
          hasError={error !== null}
          disabled={isSubmitting}
        />
        {error !== null && (
          <Text variant="caption" color={color.danger} align="center" testID="end-otp-error">
            {error}
          </Text>
        )}
      </View>
      <Button
        label="End"
        tone="action"
        disabled={code.length !== otpLength.end}
        loading={isSubmitting}
        onPress={onSubmit}
        testID="service-end-submit"
      />
    </View>
  );
}

/** Page 10 — job end. Rendered only after the backend confirms completion. */
export function CompletedView({ onDone }: { onDone: () => void }): React.ReactElement {
  return (
    <View style={[styles.screen, styles.centred]} testID="service-completed">
      <Text variant="headingLg" align="center">
        Agle booking mein bhi accha kaam kare!
      </Text>
      <Button label="Jobs pe wapas jaye" tone="action" onPress={onDone} testID="service-done" />
    </View>
  );
}

/**
 * Terminal interruption — customer cancelled or the job was reassigned mid-flow.
 *
 * Founder comment #152 asks for these pages; **no Figma design exists**, so this is a neutral,
 * deliberately plain notice rather than an invented screen. Compensation and penalty copy are
 * product-pending and intentionally absent.
 */
export function InterruptedView({
  reason,
  onDone,
}: {
  reason: InterruptionReason;
  onDone: () => void;
}): React.ReactElement {
  const message =
    reason === 'reassigned'
      ? 'Yeh booking kisi aur cook ko de di gayi hai.'
      : 'Customer ne yeh booking cancel kar di hai.';
  return (
    <View style={[styles.screen, styles.centred]} testID={`service-interrupted-${reason}`}>
      <Text variant="headingLg" align="center">
        {message}
      </Text>
      <Text variant="captionMuted" align="center">
        Tracking band ho gayi hai.
      </Text>
      <Button
        label="Jobs pe wapas jaye"
        tone="dark"
        onPress={onDone}
        testID="service-interrupted-done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.xl, gap: spacing.l },
  centred: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headerAction: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radius.full,
    backgroundColor: color.surface,
  },
  headerActionDisabled: { opacity: 0.45 },
  countdownBlock: { alignItems: 'center', gap: spacing.xs },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    padding: spacing.l,
    gap: spacing.xs,
    ...shadow.card,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  durationPill: {
    backgroundColor: color.yellow300,
    borderRadius: radius.full,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  accessNote: {
    gap: spacing.xs,
    paddingTop: spacing.s,
    marginTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: color.grey300,
  },
  actionRow: { flexDirection: 'row', gap: spacing.m, paddingTop: spacing.s },
  flexAction: { flex: 1 },
  otpBlock: { gap: spacing.m, alignItems: 'center' },
  noticeCard: {
    backgroundColor: color.yellow300,
    borderRadius: radius.l,
    padding: spacing.l,
    gap: spacing.xxs,
  },
});
