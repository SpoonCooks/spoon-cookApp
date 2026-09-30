import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { jobsV14Fixtures } from '@core/fixtures';
import { JobsView } from '@features/jobs/JobViews';

/**
 * Getting into a job from Kaam, and back into one she is already on.
 *
 * `CHALO` is the only control on the Kaam screen (founder, 2026-09-29). No card opens anything
 * and there is no "Job details" screen: on a job she has not set off for, `CHALO` starts travel
 * and lands on the Active Job screen; on a job she is already on, it takes her straight back to
 * that screen.
 *
 * The second half is the one that matters. On the V13 build the lead card's Start Travel button
 * was a one-way door: once travel began the CTA no longer applied, and a cook who backed out -- or
 * whose app was killed mid-travel -- could not get back to the job she was driving to. Tapping
 * the card used to be that way back; now `CHALO` is.
 */

const withSafeArea = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 870 },
      insets: { top: 49, left: 0, right: 0, bottom: 24 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

function renderJobs(overrides: {
  readonly isActionable: boolean;
  readonly isInProgress?: boolean;
  readonly onOpenJob?: (bookingId: string) => void;
  readonly onStartTravel?: (bookingId: string) => void;
}): { readonly leadBookingId: string; readonly otherBookingId: string | undefined } {
  const state = jobsV14Fixtures.countdown(20, 'soon');
  const leadJob =
    state.leadJob === null
      ? null
      : {
          ...state.leadJob,
          isActionable: overrides.isActionable,
          isInProgress: overrides.isInProgress ?? false,
          blockedReason: overrides.isActionable ? null : ('ALREADY_STARTED' as const),
        };

  render(
    withSafeArea(
      <JobsView
        dateLabel="7 November"
        leadJob={leadJob}
        leadUrgency="soon"
        jobs={state.jobs}
        breakWindow={state.breakWindow}
        {...(overrides.onOpenJob === undefined ? {} : { onOpenJob: overrides.onOpenJob })}
        {...(overrides.onStartTravel === undefined
          ? {}
          : { onStartTravel: overrides.onStartTravel })}
      />,
    ),
  );

  return {
    leadBookingId: leadJob?.bookingId ?? '',
    otherBookingId: state.jobs[0]?.bookingId,
  };
}

describe('CHALO is the only way in', () => {
  it('opens nothing from the lead card itself', () => {
    const opened: string[] = [];
    const started: string[] = [];
    renderJobs({
      isActionable: true,
      onOpenJob: (id) => opened.push(id),
      onStartTravel: (id) => started.push(id),
    });

    fireEvent.press(screen.getByTestId('job-lead-card'));

    expect(opened).toEqual([]);
    expect(started).toEqual([]);
  });

  it('opens nothing from a non-lead tile', () => {
    const opened: string[] = [];
    const { otherBookingId } = renderJobs({
      isActionable: true,
      onOpenJob: (id) => opened.push(id),
    });

    fireEvent.press(screen.getByTestId(`job-tile-${otherBookingId ?? ''}`));

    expect(opened).toEqual([]);
  });

  it('starts travel on a job she has not set off for', () => {
    const opened: string[] = [];
    const started: string[] = [];
    const { leadBookingId } = renderJobs({
      isActionable: true,
      onOpenJob: (id) => opened.push(id),
      onStartTravel: (id) => started.push(id),
    });

    fireEvent.press(screen.getByTestId('job-lead-cta'));

    expect(started).toEqual([leadBookingId]);
    expect(opened).toEqual([]);
  });

  it('takes her back to a job she is already on, without starting travel again', () => {
    // Already travelling, so the server withholds Start Travel. CHALO must still get her in.
    const opened: string[] = [];
    const started: string[] = [];
    const { leadBookingId } = renderJobs({
      isActionable: false,
      isInProgress: true,
      onOpenJob: (id) => opened.push(id),
      onStartTravel: (id) => started.push(id),
    });

    const cta = screen.getByTestId('job-lead-cta');
    expect(cta.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(cta);

    expect(opened).toEqual([leadBookingId]);
    expect(started).toEqual([]);
    expect(screen.queryByTestId('job-lead-blocked')).toBeNull();
  });

  it('stays disabled on a job she may not start yet and is not on', () => {
    const opened: string[] = [];
    const started: string[] = [];
    renderJobs({
      isActionable: false,
      onOpenJob: (id) => opened.push(id),
      onStartTravel: (id) => started.push(id),
    });

    expect(screen.getByTestId('job-lead-cta').props.accessibilityState?.disabled).toBe(true);
    expect(opened).toEqual([]);
    expect(started).toEqual([]);
  });
});

/**
 * The other way a cook loses sight of a job: it is cancelled while she is looking elsewhere.
 *
 * `listCookJobs` keeps a cancelled or finished card on the list until midnight IST. The card has
 * to SAY what happened on its face (`285:922` / `285:934`) because it no longer opens anything.
 */
describe('an ended job says so on its face', () => {
  const renderEnded = (
    change: { isCancelled?: boolean; isFinished?: boolean },
    onOpenJob?: (bookingId: string) => void,
  ): string => {
    const state = jobsV14Fixtures.countdown(20, 'soon');
    const job = state.jobs[0];
    if (job === undefined) throw new Error('fixture has no non-lead job');
    render(
      withSafeArea(
        <JobsView
          dateLabel="7 November"
          leadJob={null}
          jobs={[{ ...job, ...change, isActionable: false }]}
          breakWindow={state.breakWindow}
          {...(onOpenJob === undefined ? {} : { onOpenJob })}
        />,
      ),
    );
    return job.bookingId;
  };

  it('marks a cancelled card with the cross', () => {
    renderEnded({ isCancelled: true });
    expect(screen.getByTestId('job-mark-cancelled')).toBeTruthy();
    expect(screen.queryByTestId('job-mark-done')).toBeNull();
  });

  it('marks a finished card with the tick', () => {
    renderEnded({ isFinished: true });
    expect(screen.getByTestId('job-mark-done')).toBeTruthy();
    expect(screen.queryByTestId('job-mark-cancelled')).toBeNull();
  });

  it('marks nothing on a job that is still going to happen', () => {
    const state = jobsV14Fixtures.countdown(20, 'soon');
    render(withSafeArea(<JobsView dateLabel="7 November" {...state} />));
    expect(screen.queryByTestId('job-mark-cancelled')).toBeNull();
    expect(screen.queryByTestId('job-mark-done')).toBeNull();
  });

  it('does not open a cancelled or finished card', () => {
    const onOpenJob = jest.fn();
    const cancelledId = renderEnded({ isCancelled: true }, onOpenJob);
    fireEvent.press(screen.getByTestId(`job-tile-${cancelledId}`));
    screen.unmount();
    const finishedId = renderEnded({ isFinished: true }, onOpenJob);
    fireEvent.press(screen.getByTestId(`job-tile-${finishedId}`));
    expect(onOpenJob).not.toHaveBeenCalled();
  });
});
