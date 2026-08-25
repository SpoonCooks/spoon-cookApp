import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toServiceSnapshot } from '@core/api/adapters';
import { newIdempotencyKey } from '@core/api/cook';
import { apiErrorMessage, isSessionExpired } from '@core/api/errors';
import { useJob, useMarkArrived, useVerifyEndOtp, useVerifyStartOtp } from '@core/api/queries';
import { isNavigableGate, openGateNavigation } from '@core/location/navigation';
import { locationTracker } from '@core/location/tracker';
import { otpLength } from '@core/domain/otp';
import { projectServiceState, type ServiceState } from '@core/domain/serviceState';
import { useSession } from '@core/session/store';
import { BottomNav, ErrorState, LoadingState } from '@ui';
import { InterruptedView } from '@features/service/ServiceViews';
import {
  ArrivalView,
  CompletedView,
  CookingView,
  EndOtpView,
  StartOtpView,
  TravelCancelledView,
  TravelView,
} from '@features/service/ServiceV14Views';

/**
 * The dynamic service flow — one route for every state between GO and completion.
 *
 * ## Why a single route rather than a screen per page
 *
 * The Figma has twelve service frames, but they are twelve *renderings of one booking*. Giving
 * each its own route would mean navigation carries the flow forward, and a cook returning from
 * the background — or a backend state that moved on without them — would land on a stale screen
 * with no way to reconcile. Here the route is pinned to a `bookingId`, `GET /v1/cook/jobs/:id`
 * decides what to render, and re-fetching is always safe.
 *
 * Nothing below advances state locally. Each CTA raises a command; the view changes only when a
 * fresh projection says it should. That is why every mutation invalidates and re-reads instead of
 * writing the cache: a cook must never see "cooking" because a button was pressed.
 *
 * ## Polling
 *
 * The projection is polled while the booking is live so a customer cancellation, a reassignment or
 * a confirmed extension reaches the cook without a push round-trip, and re-fetched on foreground
 * so a backgrounded app reconciles the moment it returns.
 *
 * ## Location
 *
 * Reporting runs for exactly one state — `travelling` — and is torn down on arrival, completion,
 * interruption and unmount. The tracker itself never anticipates the command: this screen only
 * starts it once the SERVER reports `cook_en_route`.
 */

/** Live projection cadence. Slow enough not to burn battery, fast enough to catch a cancellation. */
const POLL_MS = 20_000;

export default function ServiceScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const id = bookingId ?? '';
  const signOut = useSession((s) => s.signOut);

  const job = useJob(id, id.length > 0, POLL_MS);

  const verifyStartOtp = useVerifyStartOtp();
  const verifyEndOtp = useVerifyEndOtp();
  const markArrived = useMarkArrived();

  const [startCode, setStartCode] = useState('');
  const [endCode, setEndCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  /**
   * One key per command per booking, held for the life of the screen.
   *
   * End-OTP retries in particular MUST reuse their key: the backend's `allowedStatuses` for that
   * command is `['cooking']`, so a fresh key after a call that actually succeeded would come back
   * `INVALID_BOOKING_STATE` and look like a failure to the cook.
   */
  const keys = useRef(new Map<string, string>());
  const keyFor = useCallback((name: string): string => {
    const existing = keys.current.get(name);
    if (existing !== undefined) return existing;
    const created = newIdempotencyKey();
    keys.current.set(name, created);
    return created;
  }, []);

  // The snapshot pairs the SERVER's `serverTime` with the instant this device received it, so a
  // countdown is a delta rather than a device-clock comparison. TanStack Query already records
  // that instant as `dataUpdatedAt`, which is why no separate timestamp is captured here — one
  // taken during render would drift from the payload it is supposed to describe.
  const receivedAtMs = job.dataUpdatedAt;

  const state: ServiceState | null = useMemo(() => {
    if (job.data === undefined) return null;
    const snapshot = toServiceSnapshot(job.data, receivedAtMs);
    return snapshot === null ? null : projectServiceState(snapshot);
  }, [job.data, receivedAtMs]);

  /* ------------------------------------------------------ gate navigation --- */

  /**
   * `462:3597` — `Map dekhe`.
   *
   * Routes to the **GATE**, never the flat: `openGateNavigation` takes a `GateTarget` and has no
   * way to accept an address, so the product rule is enforced by the signature rather than by
   * remembering it here. A booking whose gate the backend has not published simply does nothing —
   * an unnavigable gate must not open a maps app pointed at a guess.
   */
  const gate = state !== null && 'job' in state ? (state.job?.gate ?? null) : null;
  const openGate = useCallback((): void => {
    if (gate === null || !isNavigableGate(gate)) return;
    void openGateNavigation(gate);
  }, [gate]);

  /* -------------------------------------------------- extension countdown --- */

  /**
   * Close the `622:1163` banner on time without waiting for the next poll.
   *
   * `extensionBannerMsRemaining` is correct as of the instant the server produced the snapshot, so
   * with a 20s poll the banner would otherwise linger up to 20s past its five minutes. The timer
   * below fires once, at exactly the remaining duration, and re-reads the projection.
   *
   * It is driven by `setTimeout`, which the JS runtime schedules off system uptime rather than
   * wall time — so moving the device clock cannot make it fire early or late. It also only ever
   * *ends* the window: the duration comes from the server pair, and a re-render recomputes it from
   * a fresh snapshot rather than from anything this effect kept.
   */
  const bannerMsRemaining = state?.kind === 'cooking' ? state.extensionBannerMsRemaining : 0;

  /*
   * The expiry is recorded AGAINST the snapshot it was computed from, rather than as a bare
   * boolean. A boolean would have to be reset whenever a new snapshot arrived, which means writing
   * state during the effect body; keying it to `dataUpdatedAt` makes the reset fall out of the
   * comparison instead, and a fresh snapshot is automatically un-expired.
   */
  const [expiredFor, setExpiredFor] = useState<number | null>(null);
  const bannerExpired = expiredFor === receivedAtMs;

  useEffect(() => {
    if (bannerMsRemaining <= 0) return;
    const handle = setTimeout(() => setExpiredFor(receivedAtMs), bannerMsRemaining);
    return () => clearTimeout(handle);
  }, [bannerMsRemaining, receivedAtMs]);

  /* ----------------------------------------------------- foreground sync --- */

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void job.refetch();
    });
    return () => sub.remove();
    // `job.refetch` is stable for a given query key; re-subscribing on every render would leak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* --------------------------------------------------- location lifecycle --- */

  const isTravelling = state?.kind === 'travelling';
  const assignmentVersion =
    state !== null && 'job' in state ? (state.job?.assignmentVersion ?? 0) : 0;

  useEffect(() => {
    if (!isTravelling || id.length === 0) {
      // Covers arrival, completion, interruption AND leaving the screen: no eligible active job
      // means no collection.
      locationTracker.stop();
      return;
    }

    void locationTracker.start(
      { bookingId: id, assignmentVersion },
      {
        onArrived: () => {
          // The BACKEND committed the arrival. Re-read so the screen moves because the projection
          // moved, not because the device decided it had arrived.
          void job.refetch();
        },
      },
    );

    return () => {
      locationTracker.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTravelling, id, assignmentVersion]);

  /* ------------------------------------------------------------ commands --- */

  const goToJobs = (): void => router.replace('/jobs');

  const submitStartOtp = (): void => {
    if (state?.kind !== 'awaiting_start_otp' || verifyStartOtp.isPending) return;
    setOtpError(null);
    verifyStartOtp.mutate(
      {
        bookingId: id,
        otp: startCode,
        assignmentVersion: state.job.assignmentVersion,
        idempotencyKey: keyFor('start-otp'),
      },
      {
        onSuccess: () => {
          setStartCode('');
        },
        onError: (error: unknown) => {
          setOtpError(apiErrorMessage(error));
          // A rejected code may also mean the projection moved on. Re-read before the cook retries.
          void job.refetch();
        },
      },
    );
  };

  const submitEndOtp = (): void => {
    if (state?.kind !== 'awaiting_end_otp' || verifyEndOtp.isPending) return;
    setOtpError(null);
    verifyEndOtp.mutate(
      {
        bookingId: id,
        otp: endCode,
        assignmentVersion: state.job.assignmentVersion,
        idempotencyKey: keyFor('end-otp'),
      },
      {
        onSuccess: () => {
          setEndCode('');
          // Live tracking ends with the service.
          locationTracker.stop();
        },
        onError: (error: unknown) => {
          setOtpError(apiErrorMessage(error));
          void job.refetch();
        },
      },
    );
  };

  /**
   * The manual `Mai pahuach gyi hu` fallback.
   *
   * This is NOT what normally commits arrival — two accepted GPS samples inside 75 m of the gate
   * do. The backend refuses this command with `409 ARRIVAL_PROXIMITY_NOT_CONFIRMED` unless recent
   * in-radius evidence already exists, so it recovers a cook whose samples stalled rather than
   * offering a way around the gate rule. Opening the arrival screen does nothing on its own.
   */
  const confirmArrival = (): void => {
    if (state?.kind !== 'arrived' || markArrived.isPending) return;
    setOtpError(null);
    markArrived.mutate(
      {
        bookingId: id,
        assignmentVersion: state.job.assignmentVersion,
        idempotencyKey: keyFor('arrive'),
      },
      {
        onError: (error: unknown) => {
          setOtpError(apiErrorMessage(error));
          void job.refetch();
        },
      },
    );
  };

  /* -------------------------------------------------------------- render --- */

  if (id.length === 0) {
    return <ErrorState message="Yeh job nahi mili." onRetry={goToJobs} />;
  }
  if (job.isPending) return <LoadingState testID="service-loading" />;
  if (job.isError) {
    if (isSessionExpired(job.error)) {
      signOut();
      router.replace('/login');
    }
    return (
      <ErrorState
        message={apiErrorMessage(job.error)}
        onRetry={() => void job.refetch()}
        testID="service-error"
      />
    );
  }
  if (state === null) {
    return <ErrorState message="Service abhi load nahi ho payi." onRetry={goToJobs} />;
  }

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
            onMap={openGate}
          />
        );

      case 'arrived':
        return (
          <ArrivalView
            job={state.job}
            timing={state.timing}
            onArrived={confirmArrival}
            onMap={openGate}
            isSubmitting={markArrived.isPending}
          />
        );

      case 'awaiting_start_otp':
        return (
          <StartOtpView
            job={state.job}
            length={otpLength.start}
            onMap={openGate}
            code={startCode}
            onChange={(next) => {
              setStartCode(next.slice(0, otpLength.start));
              if (otpError !== null) setOtpError(null);
            }}
            onSubmit={submitStartOtp}
            error={otpError}
            isSubmitting={verifyStartOtp.isPending}
          />
        );

      case 'cooking':
        return (
          <CookingView
            hoursRemaining={
              state.minutesRemaining >= 60 ? Math.floor(state.minutesRemaining / 60) : null
            }
            minutesRemaining={
              state.minutesRemaining >= 60 ? state.minutesRemaining % 60 : state.minutesRemaining
            }
            isEndingSoon={state.isEndingSoon}
            extensionMinutes={
              !bannerExpired && state.extensionBannerMsRemaining > 0
                ? state.extension.extendedByMinutes
                : null
            }
          />
        );

      case 'awaiting_end_otp':
        return (
          <EndOtpView
            length={otpLength.end}
            code={endCode}
            onChange={(next) => {
              setEndCode(next.slice(0, otpLength.end));
              if (otpError !== null) setOtpError(null);
            }}
            onSubmit={submitEndOtp}
            error={otpError}
            isSubmitting={verifyEndOtp.isPending}
          />
        );

      case 'completed':
        return <CompletedView onSeeJobs={goToJobs} />;

      case 'interrupted':
        /*
         * `622:913` is the cancellation V14 actually draws, and it needs the booking to render —
         * it keeps the address card so the cook knows which job ended. When the projection has no
         * job (a reassignment observed with nothing attached) there is no such frame, so the
         * V13 text view still covers that case rather than a blank screen.
         */
        return state.job !== null ? (
          <TravelCancelledView job={state.job} onSeeJobs={goToJobs} onMap={openGate} />
        ) : (
          <InterruptedView reason={state.reason} onDone={goToJobs} />
        );
    }
  })();

  /*
   * The V14 service frames all draw the five-tab bottom nav, but this route is pushed OVER the tab
   * navigator so it has none of its own. The bar is therefore rendered here, with `Kaam` active —
   * which is where a booking belongs — and selecting any tab dismisses the service screen back to
   * that destination rather than stacking a second navigator inside this one.
   */
  return (
    <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.flex} testID={`service-${id}`}>
        {body}
      </View>
      <BottomNav
        active="kaam"
        onSelect={(tab) => {
          router.replace(tab === 'kaam' ? '/(tabs)/jobs' : `/(tabs)/${TAB_ROUTE[tab]}`);
        }}
        testID="service-bottom-nav"
      />
    </View>
  );
}

/** Nav destination → route segment, mirroring `(tabs)/_layout.tsx`. */
const TAB_ROUTE: Readonly<Record<string, string>> = {
  hazri: 'attendance',
  kaam: 'jobs',
  chutti: 'chutti',
  kamai: 'money',
  niyam: 'niyam',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
