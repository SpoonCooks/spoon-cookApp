import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { projectServiceState, type ServiceSnapshot } from '@core/domain/serviceState';
import { areFixturesAvailable, serviceFixtures } from '@core/fixtures';
import { ErrorState, spacing } from '@ui';
import {
  ArrivalView,
  CompletedView,
  CookingView,
  EndOtpView,
  InterruptedView,
  StartOtpView,
  TravelView,
} from '@features/service/ServiceViews';
import { FixtureSwitcher } from '@features/dev/FixtureSwitcher';

/**
 * The dynamic service flow — one route for every state between GO and completion.
 *
 * ## Why a single route rather than a screen per page
 *
 * The Figma has twelve service frames, but they are twelve *renderings of one booking*. Giving
 * each its own route would mean navigation carries the flow forward, and a cook returning from
 * the background — or a backend state that moved on without them — would land on a stale screen
 * with no way to reconcile. Here the route is pinned to a `bookingId`, the projection decides
 * what to render, and re-fetching is always safe.
 *
 * Nothing below advances state locally. Each CTA raises a command; the view changes only when a
 * fresh snapshot says it should.
 */
export default function ServiceScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();

  // PHASE 2: poll/refetch the cook service snapshot for `bookingId` (GAP-01), reconciling on
  // foreground. Until that endpoint exists the screen renders a labelled development fixture.
  const [fixtureKey, setFixtureKey] = useState<keyof typeof serviceFixtures>('travelOnTime');
  const snapshot: ServiceSnapshot | null = areFixturesAvailable()
    ? serviceFixtures[fixtureKey]()
    : null;

  const [startCode, setStartCode] = useState('');
  const [endCode, setEndCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const state = useMemo(
    () => (snapshot === null ? null : projectServiceState(snapshot)),
    [snapshot],
  );

  const goToJobs = (): void => router.replace('/jobs');

  if (state === null) {
    return <ErrorState message="Service abhi load nahi ho payi." onRetry={goToJobs} />;
  }

  const submitStartOtp = (): void => {
    setSubmitting(true);
    // PHASE 2: POST verify-start-otp with an Idempotency-Key. Service starts only on success.
    setOtpError('Galat OTP. Firse koshish kare');
    setSubmitting(false);
  };

  const submitEndOtp = (): void => {
    setSubmitting(true);
    // PHASE 2: POST verify-end-otp reusing the SAME Idempotency-Key on retry — the backend's
    // `allowedStatuses` for this command is `['cooking']` only, so a fresh key after a successful
    // call returns INVALID_BOOKING_STATE.
    setOtpError('Galat OTP. Firse koshish kare');
    setSubmitting(false);
  };

  const body = ((): React.ReactElement => {
    switch (state.kind) {
      case 'idle':
      case 'assigned':
        return <ErrorState message="Yeh job abhi shuru nahi hui." onRetry={goToJobs} />;

      case 'travelling':
        return (
          <TravelView
            job={state.job}
            timing={state.timing}
            minutesToDeadline={state.minutesToDeadline}
          />
        );

      case 'arrived':
        return <ArrivalView job={state.job} timing={state.timing} isSubmitting={submitting} />;

      case 'awaiting_start_otp':
        return (
          <StartOtpView
            timing={state.timing}
            code={startCode}
            onChange={(next) => {
              setStartCode(next);
              if (otpError !== null) setOtpError(null);
            }}
            onSubmit={submitStartOtp}
            error={otpError}
            isSubmitting={submitting}
          />
        );

      case 'cooking':
        return (
          <CookingView
            minutesRemaining={state.minutesRemaining}
            isEndingSoon={state.isEndingSoon}
            isExtended={state.extension.isExtended}
            newExpectedEndIso={state.extension.newExpectedEndIso}
          />
        );

      case 'awaiting_end_otp':
        return (
          <EndOtpView
            code={endCode}
            onChange={(next) => {
              setEndCode(next);
              if (otpError !== null) setOtpError(null);
            }}
            onSubmit={submitEndOtp}
            error={otpError}
            isSubmitting={submitting}
          />
        );

      case 'completed':
        return <CompletedView onDone={goToJobs} />;

      case 'interrupted':
        return <InterruptedView reason={state.reason} onDone={goToJobs} />;
    }
  })();

  return (
    <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        testID={`service-${bookingId ?? 'unknown'}`}
      >
        {body}
      </ScrollView>
      {/* Development-only. Excluded from release builds by `__DEV__`. */}
      <FixtureSwitcher
        current={fixtureKey}
        options={Object.keys(serviceFixtures) as (keyof typeof serviceFixtures)[]}
        onSelect={(key) => {
          setFixtureKey(key);
          setStartCode('');
          setEndCode('');
          setOtpError(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xl },
});
