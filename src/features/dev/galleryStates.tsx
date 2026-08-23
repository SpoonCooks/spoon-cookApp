import { useState } from 'react';
import { View } from 'react-native';

import { otpLength } from '@core/domain/otp';
import { projectServiceState, type ServiceState } from '@core/domain/serviceState';
import { serviceFixtures } from '@core/fixtures';
import {
  ArrivalView,
  CompletedView,
  CookingView,
  EndOtpView,
  StartOtpView,
  TravelView,
} from '@features/service/ServiceViews';

/**
 * Development-only visual gallery.
 *
 * ## Why this exists
 *
 * Most V13 states cannot be reached against the real backend on demand: `Page 7b- Cooking
 * (last 7 mins)` needs a live booking seven minutes from its end, and every Service frame needs an
 * approved Cook with an assignment. Waiting for those states is not a verification strategy, so
 * this gallery renders each one from a fixed fixture instead.
 *
 * ## Hard boundaries
 *
 * 1. **Dev only.** Every entry reads `serviceFixtures`, whose accessors throw when `__DEV__` is
 *    false, and the route that hosts this gallery refuses to render in a release build. There is
 *    no path from production code into this module.
 * 2. **No production state management is touched.** The gallery calls the same presentational
 *    views the real route calls, with the same props, produced by the same
 *    `projectServiceState` projector. It does not install a fake API client, seed a query cache
 *    used by production, or alter any store.
 * 3. **Not functional progress.** Reaching `service/completed` here proves the *presentation* of
 *    the completed state, never that the completion command works. Nothing here calls an API, and
 *    no callback advances a real booking.
 * 4. **Deterministic.** Every fixture is a fixed value and countdowns are passed in as numbers
 *    rather than derived from the wall clock, so two runs a day apart produce identical pixels.
 */
export interface GalleryEntry {
  /** Matches `FigmaScreen.galleryState` in `@core/figma/scope`. */
  readonly id: string;
  readonly section: string;
  /** The V13 Figma node this entry is the counterpart of. */
  readonly nodeId: string;
  readonly label: string;
  readonly render: () => React.ReactElement;
}

/** Renders a service snapshot through the same dispatch the real route uses. */
function ServiceStateView({ state }: { state: ServiceState }): React.ReactElement {
  switch (state.kind) {
    case 'travelling':
      return (
        <TravelView
          job={state.job}
          timing={state.timing}
          minutesToDeadline={state.minutesToDeadline}
        />
      );
    case 'arrived':
      return <ArrivalView job={state.job} timing={state.timing} />;
    case 'awaiting_start_otp':
      return <StartOtpFixture timing={state.timing} />;
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
      return <EndOtpFixture />;
    case 'completed':
      return <CompletedView onDone={noop} />;
    default:
      // A fixture that projects to `idle`/`assigned`/`interrupted` is a bug in the fixture, not a
      // screen to draw. Render nothing rather than inventing a frame V13 does not contain.
      return <View testID={`gallery-unrenderable-${state.kind}`} />;
  }
}

function noop(): void {
  /* The gallery never advances a booking. */
}

/** Start OTP with local input state, so the boxes can be typed into during review. */
function StartOtpFixture({ timing }: { timing: 'on_time' | 'late' }): React.ReactElement {
  const [code, setCode] = useState('');
  return (
    <StartOtpView
      timing={timing}
      code={code}
      onChange={(next) => setCode(next.slice(0, otpLength.start))}
      onSubmit={noop}
      error={null}
      isSubmitting={false}
    />
  );
}

function EndOtpFixture(): React.ReactElement {
  const [code, setCode] = useState('');
  return (
    <EndOtpView
      code={code}
      onChange={(next) => setCode(next.slice(0, otpLength.end))}
      onSubmit={noop}
      error={null}
      isSubmitting={false}
    />
  );
}

function service(
  id: string,
  nodeId: string,
  label: string,
  snapshot: () => ReturnType<typeof serviceFixtures.travelOnTime>,
): GalleryEntry {
  return {
    id,
    section: 'Service flow',
    nodeId,
    label,
    render: () => <ServiceStateView state={projectServiceState(snapshot())} />,
  };
}

/**
 * Every finalized V13 state that is reachable today.
 *
 * `leave` and `log in flow` entries are absent because those eleven screens are not implemented
 * yet — see the closure report. A missing entry is a visible gap in `/dev`, which is the point:
 * the gallery must never imply coverage it does not have.
 */
export const galleryEntries: readonly GalleryEntry[] = [
  service('service/travel-on-time', '462:3617', 'Travel — on time', serviceFixtures.travelOnTime),
  service(
    'service/travel-at-risk',
    '463:3779',
    'Travel — 5 min buffer',
    serviceFixtures.travelAtRisk,
  ),
  service(
    'service/travel-late',
    '464:3864',
    'Travel — late (negative)',
    serviceFixtures.travelLate,
  ),
  service(
    'service/arrival-on-time',
    '468:3935',
    'Arrival — on time',
    serviceFixtures.arrivedOnTime,
  ),
  service('service/arrival-late', '468:4040', 'Arrival — late', serviceFixtures.arrivedLate),
  service(
    'service/start-otp-on-time',
    '482:4587',
    'Start OTP — on time',
    serviceFixtures.startOtpOnTime,
  ),
  service('service/start-otp-late', '482:4656', 'Start OTP — late', serviceFixtures.startOtpLate),
  service('service/cooking', '483:4741', 'Cooking', serviceFixtures.cooking),
  service(
    'service/cooking-ending',
    '483:4795',
    'Cooking — last 7 mins',
    serviceFixtures.cookingEndingSoon,
  ),
  service(
    'service/cooking-extended',
    '483:4835',
    'Cooking — extended',
    serviceFixtures.cookingExtended,
  ),
  service('service/end-otp', '484:4875', 'End OTP', serviceFixtures.endOtp),
  service('service/completed', '485:4917', 'Job end', serviceFixtures.completed),
];

export function galleryEntryFor(id: string): GalleryEntry | null {
  return galleryEntries.find((entry) => entry.id === id) ?? null;
}
