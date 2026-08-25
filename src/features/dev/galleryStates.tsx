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
import { NiyamIndexView, RuleSheetView } from '@features/info/InfoViews';
import { ruleSheets, type RuleKey } from '@features/info/rules';
import { JobsView } from '@features/jobs/JobViews';
import {
  ArrivalView,
  CompletedView,
  CookingView,
  EndOtpView,
  StartOtpView,
  TravelCancelledView,
  TravelView,
} from '@features/service/ServiceV14Views';
import { BootView, OtpView, PhoneView } from '@features/login/LoginViews';
import {
  CycleHistoryView,
  DayHistoryView,
  MoneyPeriodView,
  PastCycleView,
  PastDayView,
} from '@features/performance/PerformanceViews';

import { useState } from 'react';

import { earningsPeriodLabels, earningsPeriods } from '@core/domain/money';
import { otpLength } from '@core/domain/otp';
import { jobsV14Fixtures, performanceFixtures, serviceV14Fixtures } from '@core/fixtures';

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

function noop(): void {
  /* The gallery never advances a booking. */
}

/** Start/End OTP with local input state, so the boxes can be typed into during review. */
function ServiceOtpFixture({ kind }: { kind: 'start' | 'end' }): React.ReactElement {
  const [code, setCode] = useState('111');
  const props = {
    code,
    onChange: (next: string) => setCode(next.slice(0, otpLength[kind])),
    onSubmit: noop,
    error: null,
    isSubmitting: false,
    length: otpLength[kind],
  };
  return kind === 'start' ? (
    <StartOtpView job={serviceV14Fixtures.job()} {...props} />
  ) : (
    <EndOtpView {...props} />
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

/**
 * One of the five `job flow` frames.
 *
 * `JobsView` draws its own top nav directly under the status bar, the same shape the attendance
 * and leave screens use, so it owns its safe area.
 */
function jobs(
  id: string,
  nodeId: string,
  label: string,
  render: () => React.ReactElement,
): GalleryEntry {
  return { id, section: 'job flow', nodeId, label, ownsSafeArea: true, render };
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

/**
 * One of the seven `performance` frames. All own their safe area, as `PerformanceScreen` does.
 *
 * Every entry renders the SAME view the `src/app/money/*` route renders and differs only in where
 * its numbers come from — a fixture instead of `GET /cook/earnings`. Nothing here calls an API,
 * and no callback advances anything: the links are inert so a review can open a frame without
 * navigating out of it.
 */
function performance(
  id: string,
  nodeId: string,
  label: string,
  render: () => React.ReactElement,
): GalleryEntry {
  return { id, section: 'performance', nodeId, label, ownsSafeArea: true, render };
}

/** The `Aaj / Cycle / Mahina` control, labelled exactly as the three frames label it. */
const PERIOD_TABS = earningsPeriods.map((key) => ({
  key,
  title: earningsPeriodLabels[key].title,
  subtitle: earningsPeriodLabels[key].subtitle,
}));

/**
 * One of the thirteen V14 `Service flow` frames.
 *
 * These own their safe area: `ServiceShell` draws its own top nav directly under the status bar,
 * the same shape the attendance, leave and jobs screens use.
 */
function service(
  id: string,
  nodeId: string,
  label: string,
  render: () => React.ReactElement,
): GalleryEntry {
  return { id, section: 'Service flow', nodeId, label, ownsSafeArea: true, render };
}

/** One of the six `Info` frames. The five rule sheets draw their own scrim. */
function info(
  id: string,
  nodeId: string,
  label: string,
  render: () => React.ReactElement,
): GalleryEntry {
  return { id, section: 'Info', nodeId, label, ownsSafeArea: true, render };
}

/** A rule sheet at a fixed standing, so two runs a day apart produce identical pixels. */
function ruleSheet(rule: RuleKey, standing: string): () => React.ReactElement {
  return function renderRuleSheet(): React.ReactElement {
    return <RuleSheetView sheet={ruleSheets[rule]} standingValue={standing} />;
  };
}

/**
 * Every finalized V14 state that is reachable today.
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
  /*
   * `Service flow` (`485:4971`) — 13 frames, NOT built here yet.
   *
   * V14 deleted all twelve V13 service nodes and rebuilt the section on a different authoring
   * convention: 371-wide `direct` frames with the V14 bottom nav, against V13's 390x830 phone
   * bezel. The twelve entries that used to sit here rendered `ServiceViews` against node ids
   * (`462:3617` … `485:4917`) that no longer exist in the file, so they were removed rather than
   * repointed — a gallery entry aimed at a deleted frame compares a render against nothing.
   *
   * The outstanding node ids are enumerated in `pendingScreens` in `@core/figma/scope`, and
   * `gallery.test.tsx` asserts this section stays empty until each view is rebuilt.
   */
  /*
   * `performance` (`575:1741`). Three states of the money tab and four pushed frames.
   */
  performance('performance/money-daily', '575:1744', 'Money — Aaj', () => (
    <MoneyPeriodView
      period="day"
      view={performanceFixtures.daily()}
      bonus={performanceFixtures.bonus()}
      rating={performanceFixtures.rating()}
      days={[]}
      tabs={PERIOD_TABS}
      onChangePeriod={noop}
    />
  )),
  performance('performance/money-weekly', '575:1884', 'Money — Cycle', () => (
    <MoneyPeriodView
      period="cycle"
      view={performanceFixtures.cycle()}
      bonus={performanceFixtures.bonus()}
      rating={performanceFixtures.rating()}
      days={performanceFixtures.days()}
      tabs={PERIOD_TABS}
      onChangePeriod={noop}
      onOpenDays={noop}
    />
  )),
  performance('performance/money-monthly', '575:2013', 'Money — Mahina', () => (
    <MoneyPeriodView
      period="month"
      view={performanceFixtures.month()}
      bonus={performanceFixtures.bonus()}
      rating={performanceFixtures.rating()}
      days={[]}
      tabs={PERIOD_TABS}
      onChangePeriod={noop}
      onOpenCycles={noop}
    />
  )),
  performance('performance/day-history', '575:1903', 'Cycle ke din', () => (
    <DayHistoryView
      days={performanceFixtures.dayHistory()}
      emptyMessage="Is cycle mein koi din nahi hai."
      onBack={noop}
      onOpenDay={noop}
    />
  )),
  performance('performance/past-daily', '575:1922', 'Din ki kamai', () => (
    <PastDayView
      label="26th July"
      view={performanceFixtures.daily()}
      bonus={performanceFixtures.bonus()}
      rating={performanceFixtures.rating()}
      onBack={noop}
    />
  )),
  performance('performance/weekly-history', '575:2032', 'Pichle cycles', () => (
    <CycleHistoryView
      lifetimePaise={performanceFixtures.lifetimePaise()}
      cycles={performanceFixtures.cycleHistory()}
      emptyMessage="Koi pichla cycle nahi hai."
      onBack={noop}
      onOpenCycle={noop}
    />
  )),
  performance('performance/past-weekly', '575:2098', 'Cycle ki kamai', () => (
    <PastCycleView
      label="11th Jul - 17th Jul"
      view={performanceFixtures.cycle()}
      rating={performanceFixtures.rating()}
      days={performanceFixtures.days()}
      onBack={noop}
      onOpenDays={noop}
    />
  )),

  /* ---- job flow (592:1070) — 5 ---- */
  jobs('jobs/logged-out', '583:375', 'Jobs - shift not started', () => (
    <JobsView dateLabel="7 November" {...jobsV14Fixtures.loggedOut()} />
  )),
  jobs('jobs/logged-in', '583:401', 'Jobs - shift started', () => (
    <JobsView dateLabel="7 November" {...jobsV14Fixtures.loggedIn()} />
  )),
  jobs('jobs/next-45', '583:427', 'Jobs - next in 25 mins', () => (
    <JobsView dateLabel="7 November" {...jobsV14Fixtures.countdown(25, 'soon')} />
  )),
  jobs('jobs/next-10', '583:453', 'Jobs - next in 20 mins', () => (
    <JobsView dateLabel="7 November" {...jobsV14Fixtures.countdown(20, 'imminent')} />
  )),
  jobs('jobs/next-5', '583:479', 'Jobs - next in 15 mins', () => (
    <JobsView dateLabel="7 November" {...jobsV14Fixtures.countdown(15, 'critical')} />
  )),

  /* ---- Service flow (485:4971) — 13 ---- */
  service('service/travel-on-time', '614:453', 'Travel - on time', () => (
    <TravelView job={serviceV14Fixtures.job()} timing="on_time" minutesToDeadline={16} />
  )),
  service('service/travel-edge', '622:597', 'Travel - late ho raha hai', () => (
    <TravelView job={serviceV14Fixtures.job()} timing="at_risk" minutesToDeadline={16} />
  )),
  service('service/travel-late', '622:530', 'Travel - late (negative)', () => (
    // The negative value is the whole point of `622:538`; clamping it to zero would erase the
    // state the frame exists to show.
    <TravelView job={serviceV14Fixtures.job()} timing="late" minutesToDeadline={-6} />
  )),
  service('service/travel-cancel', '622:913', 'Travel - booking cancelled', () => (
    <TravelCancelledView job={serviceV14Fixtures.job()} />
  )),
  service('service/arrival-on-time', '622:664', 'Arrival - on time', () => (
    <ArrivalView job={serviceV14Fixtures.job()} timing="on_time" />
  )),
  service('service/arrival-late', '622:733', 'Arrival - late', () => (
    <ArrivalView job={serviceV14Fixtures.job()} timing="late" />
  )),
  service('service/start-otp', '622:801', 'Start OTP', () => <ServiceOtpFixture kind="start" />),
  service('service/timer-hours', '622:1036', 'Cooking - hours and minutes', () => (
    <CookingView
      hoursRemaining={2}
      minutesRemaining={20}
      isEndingSoon={false}
      extensionMinutes={null}
    />
  )),
  service('service/timer-minutes', '622:1085', 'Cooking - minutes', () => (
    <CookingView
      hoursRemaining={null}
      minutesRemaining={59}
      isEndingSoon={false}
      extensionMinutes={null}
    />
  )),
  service('service/timer-ending', '622:1125', 'Cooking - last 7 mins', () => (
    <CookingView hoursRemaining={null} minutesRemaining={7} isEndingSoon extensionMinutes={null} />
  )),
  service('service/timer-extension', '622:1163', 'Cooking - extension window open', () => (
    // The banner is shown because the window is open, never because a button was pressed. Here it
    // is open by construction; in the app it comes from two server timestamps.
    <CookingView
      hoursRemaining={null}
      minutesRemaining={28}
      isEndingSoon={false}
      extensionMinutes={20}
    />
  )),
  service('service/end-otp', '628:1249', 'End OTP', () => <ServiceOtpFixture kind="end" />),
  service('service/completed', '628:1293', 'Job end', () => <CompletedView />),

  /* ---- Info (611:398) — 6 ---- */
  info('info/leave-rules', '597:1131', 'Niyam - Jaankari', () => <NiyamIndexView />),
  info('info/rating-tiers', '597:1221', 'Niyam - rating tiers', ruleSheet('rating-tiers', '4.6')),
  info('info/no-show', '603:1865', 'Niyam - No Show', ruleSheet('no-show', '6')),
  info(
    'info/bonus-over-7',
    '603:1924',
    'Niyam - extra hours',
    ruleSheet('bonus-over-7', '4 hrs 5 mins'),
  ),
  info('info/bonus-5-plus', '605:2027', 'Niyam - 5+ rating', ruleSheet('bonus-5-plus', '5')),
  info('info/late', '605:2094', 'Niyam - Late', ruleSheet('late', '1 hr 34 mins')),
];

export function galleryEntryFor(id: string): GalleryEntry | null {
  return galleryEntries.find((entry) => entry.id === id) ?? null;
}
