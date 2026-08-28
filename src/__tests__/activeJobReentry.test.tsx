import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { jobsV14Fixtures } from '@core/fixtures';
import { JobsView } from '@features/jobs/JobViews';

/**
 * Re-entering the job the cook is already on.
 *
 * ## The blocker this closes
 *
 * On the installed V13 build the ONLY route into a job was the lead card's Start Travel button.
 * That button is eligibility-gated and it is a one-way door: once it had fired and the booking
 * moved to `cook_en_route`, the CTA no longer applied and there was no other control on the card,
 * so a cook who backed out — or whose app was killed by Android mid-travel — could not get back
 * to the job they were physically driving to. Nothing was broken in the backend; the screen
 * simply had no way in.
 *
 * ## What is pinned here
 *
 * That opening a job and being allowed to start travelling are SEPARATE questions. Details is
 * reachable from any card in any state; Start Travel remains the server's ruling. If those two
 * are ever collapsed back into one control this fails, which is the point — the regression is a
 * one-line prop change away and is invisible in review.
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
  readonly onOpenJob?: (bookingId: string) => void;
  readonly onStartTravel?: (bookingId: string) => void;
}): { readonly leadBookingId: string; readonly otherBookingId: string | undefined } {
  const state = jobsV14Fixtures.countdown(20, 'soon');
  const leadJob =
    state.leadJob === null ? null : { ...state.leadJob, isActionable: overrides.isActionable };

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

describe('a job can be opened without being startable', () => {
  it('opens the lead job from the card itself, not from Start Travel', () => {
    const opened: string[] = [];
    const started: string[] = [];
    const { leadBookingId } = renderJobs({
      isActionable: true,
      onOpenJob: (id) => opened.push(id),
      onStartTravel: (id) => started.push(id),
    });

    // The card, not the CTA inside it.
    fireEvent.press(screen.getAllByLabelText(/job details$/)[0] as never);

    expect(opened).toEqual([leadBookingId]);
    // Opening a job must not silently dispatch a command that moves a real booking.
    expect(started).toEqual([]);
  });

  it('still opens the job when the server says travel may NOT start', () => {
    // This is the state the stuck build could not escape: already travelling, so the CTA no
    // longer applies. Details has to stay reachable or the cook is locked out of their own job.
    const opened: string[] = [];
    const { leadBookingId } = renderJobs({
      isActionable: false,
      onOpenJob: (id) => opened.push(id),
    });

    fireEvent.press(screen.getAllByLabelText(/job details$/)[0] as never);

    expect(opened).toEqual([leadBookingId]);
  });

  it('gives a non-lead job its own details action too', () => {
    const opened: string[] = [];
    const { otherBookingId } = renderJobs({
      isActionable: true,
      onOpenJob: (id) => opened.push(id),
    });
    const cards = screen.getAllByLabelText(/job details$/);

    // Index 1 is the first ordinary tile; index 0 is the lead card asserted above.
    expect(cards.length).toBeGreaterThan(1);
    fireEvent.press(cards[1] as never);

    expect(opened).toEqual([otherBookingId]);
  });

  it('keeps Start Travel working as its own separate control', () => {
    const opened: string[] = [];
    const started: string[] = [];
    const { leadBookingId } = renderJobs({
      isActionable: true,
      onOpenJob: (id) => opened.push(id),
      onStartTravel: (id) => started.push(id),
    });

    fireEvent.press(screen.getByTestId('job-lead-cta'));

    expect(started).toEqual([leadBookingId]);
    // Pressing the CTA must not ALSO fire the card's navigation underneath it.
    expect(opened).toEqual([]);
  });
});
