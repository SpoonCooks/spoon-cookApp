import { useState } from 'react';
import { View } from 'react-native';

import {
  AbsentView,
  DailyLogInView,
  PresentView,
  ShiftEndedView,
} from '@features/attendance/AttendanceViews';
import {
  ChuttiView,
  LongLeaveSheetView,
  ShortLeaveSheetView,
  type LongLeaveCard,
  type SingleDayLeaveOption,
} from '@features/leave/LeaveViews';
import { BootView, OtpView, PhoneView } from '@features/login/LoginViews';

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
  /**
   * True when the entry renders a whole route-level screen that applies its own safe-area insets.
   * The gallery host must not pad those, or the inset lands twice and the screen renders ~49dp
   * low — which reads in a diff as if every element were misplaced. Presentational views that
   * expect their host to pad them (the Service views) leave this false.
   */
  readonly ownsSafeArea?: boolean;
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

/** One of the three OTP frames, which differ only in code, countdown and error. */
function otp(
  id: string,
  nodeId: string,
  label: string,
  state: { code: string; secondsLeft: number; error: string | null },
): GalleryEntry {
  return {
    id,
    section: 'Login flow',
    nodeId,
    label,
    ownsSafeArea: true,
    render: () => (
      <OtpView
        phone="9876543210"
        code={state.code}
        onChange={noop}
        onSubmit={noop}
        onEditPhone={noop}
        onResend={noop}
        secondsLeft={state.secondsLeft}
        error={state.error}
        isSubmitting={false}
        length={otpLength.login}
      />
    ),
  };
}

/** One of the four `log in flow` frames. All own their safe area, as `LoginViews` do. */
function attendance(
  id: string,
  nodeId: string,
  label: string,
  render: () => React.ReactElement,
): GalleryEntry {
  return { id, section: 'log in flow', nodeId, label, ownsSafeArea: true, render };
}

/** One of the seven `leave` frames. All three surfaces apply their own safe-area inset. */
function leave(
  id: string,
  nodeId: string,
  label: string,
  render: () => React.ReactElement,
): GalleryEntry {
  return { id, section: 'leave', nodeId, label, ownsSafeArea: true, render };
}

/**
 * The literal copy each `leave` frame draws.
 *
 * Stated rather than derived from a clock: `592:488` and `592:489` disagree about which day is
 * `Aaj`, and `592:1008` labels 6 November `Parso`. Those are the frames' own values, and a fixture
 * that recomputed them from today's date would compare the app against a different screen every
 * day. The RULES that produce them in production live in `leaveModel.ts` and are tested there.
 */
const CHUTTI_DAYS: Record<string, readonly SingleDayLeaveOption[]> = {
  present: [
    { dateIso: '2026-11-07', dayLabel: '7 November', relativeLabel: 'Kal', state: 'available' },
    { dateIso: '2026-11-08', dayLabel: '8 November', relativeLabel: 'Parso', state: 'available' },
  ],
  absent: [
    { dateIso: '2026-11-06', dayLabel: '6 November', relativeLabel: 'Aaj', state: 'available' },
    { dateIso: '2026-11-07', dayLabel: '7 November', relativeLabel: 'Kal', state: 'available' },
  ],
  applied: [
    {
      dateIso: '2026-11-05',
      dayLabel: '5 November',
      relativeLabel: 'Chutti lag gyi',
      state: 'booked',
    },
    { dateIso: '2026-11-06', dayLabel: '6 November', relativeLabel: 'Parso', state: 'available' },
  ],
};

const PICK_DATES: LongLeaveCard = { label: 'Dates chunein', upcoming: null };
const CHANGE_DATES: LongLeaveCard = { label: 'Dates badle', upcoming: '16 Nov se 25 Nov tak' };

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
 * A missing entry is a visible gap in `/dev`, which is the point: the gallery must never imply
 * coverage it does not have.
 */
export const galleryEntries: readonly GalleryEntry[] = [
  otp('login/otp-countdown', '434:3224', 'OTP - countdown', {
    code: '333333',
    secondsLeft: 25,
    error: null,
  }),
  otp('login/otp-resend', '434:3174', 'OTP - resend available', {
    // 2b draws empty tiles: the countdown has elapsed and the previous code was cleared.
    code: '',
    secondsLeft: 0,
    error: null,
  }),
  otp('login/otp-wrong', '434:3116', 'OTP - wrong code', {
    code: '333333',
    secondsLeft: 0,
    error: 'Galat OTP. Firse koshish kare',
  }),
  {
    id: 'login/phone',
    section: 'Login flow',
    nodeId: '434:3280',
    label: 'Login - phone number',
    ownsSafeArea: true,
    // The design frame shows a filled, valid number, so the fixture does too. A blank field would
    // compare the placeholder against the design's real value and read as a text mismatch.
    render: () => (
      <PhoneView
        value="9876543210"
        onChange={noop}
        onSubmit={noop}
        canSubmit
        isSending={false}
        error={null}
      />
    ),
  },
  {
    id: 'login/boot',
    section: 'Login flow',
    nodeId: '434:3330',
    label: 'Boot — loading',
    ownsSafeArea: true,
    render: () => <BootView />,
  },
  /*
   * `log in flow` (`592:1068`). The four frames are four states of the attendance screen, and all
   * four draw the same greeting from the same fixture: the design's own copy is `Namaste, Rekha!`
   * with a `6 AM se 6 PM` shift pill, so the gallery states them literally rather than deriving
   * them from a clock — two runs a day apart must produce identical pixels.
   */
  attendance('login-flow/daily', '575:2135', 'Daily log in', () => (
    <DailyLogInView name="Rekha" shiftWindow="6 AM se 6 PM" markByTime="5:30 AM" />
  )),
  attendance('login-flow/present', '575:2137', 'Marked present', () => (
    <PresentView name="Rekha" shiftWindow="6 AM se 6 PM" />
  )),
  attendance('login-flow/absent', '575:2138', 'Marked absent', () => (
    <AbsentView name="Rekha" shiftWindow="6 AM se 6 PM" />
  )),
  attendance('login-flow/logout', '575:2136', 'Shift finished', () => (
    <ShiftEndedView name="Rekha" shiftWindow="6 AM se 6 PM" />
  )),
  /*
   * `leave` (`540:416`). Four states of the CHUTTI destination and three of its two sheets.
   */
  leave('leave/present', '592:488', 'Chutti — present today', () => (
    <ChuttiView
      title="CHUTTI"
      breakWindow={{ durationLabel: '2 hrs', fromLabel: '12:15 PM', toLabel: '2:15 PM' }}
      singleDayLeaves={CHUTTI_DAYS['present'] ?? []}
      groupedLongCard={null}
      longCard={PICK_DATES}
      longCardWidth={334}
    />
  )),
  leave('leave/absent', '592:489', 'Chutti — not working today', () => (
    <ChuttiView
      title="CHUTTI"
      breakWindow={null}
      singleDayLeaves={CHUTTI_DAYS['absent'] ?? []}
      groupedLongCard={null}
      longCard={PICK_DATES}
      longCardWidth={334}
    />
  )),
  leave('leave/long-booked', '592:832', 'Chutti — long leave booked', () => (
    // `592:832` sets a date where the other three frames set `CHUTTI`. Reproduced as drawn.
    <ChuttiView
      title="7 November"
      breakWindow={null}
      singleDayLeaves={CHUTTI_DAYS['absent'] ?? []}
      groupedLongCard={null}
      longCard={CHANGE_DATES}
    />
  )),
  leave('leave/applied-and-booked', '592:1008', 'Chutti — day applied and range booked', () => (
    <ChuttiView
      title="CHUTTI"
      breakWindow={null}
      singleDayLeaves={CHUTTI_DAYS['applied'] ?? []}
      groupedLongCard={PICK_DATES}
      longCard={CHANGE_DATES}
    />
  )),
  leave('leave/long-empty', '592:563', 'Lambi Chutti — nothing chosen', () => (
    <LongLeaveSheetView
      year={2026}
      month={11}
      monthLabel="November"
      firstOpenDay={12}
      selection={null}
      totalDays={0}
      canConfirm={false}
    />
  )),
  leave('leave/long-selected', '592:639', 'Lambi Chutti — 16-25 Nov', () => (
    <LongLeaveSheetView
      year={2026}
      month={11}
      monthLabel="November"
      firstOpenDay={12}
      selection={{ fromDay: 16, toDay: 25 }}
      totalDays={10}
      canConfirm
    />
  )),
  leave('leave/short-confirm', '592:888', '1 din ki Chutti — confirm', () => (
    <ShortLeaveSheetView dayLabel="8 November" relativeLabel="Parso" canConfirm />
  )),
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
