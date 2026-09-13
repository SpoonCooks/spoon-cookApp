import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { jobUrgencies, type JobUrgency } from '@core/domain/job';
import { jobsV14Fixtures } from '@core/fixtures';
import { JobsView } from '@features/jobs/JobViews';

/**
 * The lead job card's colourway is PRESENTATION, and it must never become permission.
 *
 * ## The design contradiction this guards
 *
 * V14 escalates the lead card through three colourways whose frame names give thresholds that the
 * frames' own content contradicts:
 *
 * | frame     | name               | countdown it draws |
 * | --------- | ------------------ | ------------------ |
 * | `583:427` | `next in <45 mins` | `25 mins`          |
 * | `583:453` | `next <10 mins`    | `20 mins`          |
 * | `583:479` | `next <5 mins`     | `15 mins`          |
 *
 * `20` is not under ten and `15` is not under five. Either the names or the mock values are stale
 * and the file gives no way to tell which, so the tier is an explicit input: fixtures set it per
 * frame to reproduce each frame exactly, and production passes the calmest.
 *
 * ## Why this is asserted rather than left to review
 *
 * The open question is allowed to cost a COLOUR. It must never cost a command. Whether the cook
 * may set off is `isActionable`, a server ruling, and if the colourway were ever wired into that
 * decision a stale Figma label would start deciding whether a real cook can start travelling to a
 * real booking. That is a one-line change away at any time and invisible in review, so it is
 * pinned here: eligibility is identical across all three tiers, in both directions.
 *
 * Delete these only when a designer or backend owner rules on the thresholds — see
 * `COOK_APP_V14_PIXEL_PERFECT_CLOSURE.md`.
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

function renderAt(urgency: JobUrgency, isActionable: boolean): void {
  const state = jobsV14Fixtures.countdown(20, urgency);
  const leadJob = state.leadJob === null ? null : { ...state.leadJob, isActionable };
  render(
    withSafeArea(
      <JobsView
        dateLabel="7 November"
        leadJob={leadJob}
        leadUrgency={urgency}
        jobs={state.jobs}
        breakWindow={state.breakWindow}
      />,
    ),
  );
}

describe('lead job urgency is presentation only', () => {
  it('covers every tier the design draws', () => {
    // If a fourth colourway is added, this test must be extended rather than silently skipping it.
    expect([...jobUrgencies].sort()).toEqual(['critical', 'imminent', 'soon'].sort());
  });

  it('leaves the CTA enabled in every tier when the server says the cook may go', () => {
    for (const urgency of jobUrgencies) {
      renderAt(urgency, true);
      const cta = screen.getByTestId('job-lead-cta');
      expect({ urgency, disabled: cta.props.accessibilityState?.disabled }).toEqual({
        urgency,
        disabled: false,
      });
      screen.unmount();
    }
  });

  it('leaves the CTA disabled in every tier when the server says the cook may not', () => {
    // The red card is the loudest thing on the screen, and this is the direction that matters:
    // `critical` must not talk the app into offering a command the server has withheld.
    for (const urgency of jobUrgencies) {
      renderAt(urgency, false);
      const cta = screen.getByTestId('job-lead-cta');
      expect({ urgency, disabled: cta.props.accessibilityState?.disabled }).toEqual({
        urgency,
        disabled: true,
      });
      screen.unmount();
    }
  });

  it('draws the same countdown in every tier, so the colour carries no number of its own', () => {
    for (const urgency of jobUrgencies) {
      renderAt(urgency, true);
      expect(screen.getByTestId('job-lead-countdown')).toHaveTextContent('20 mins');
      screen.unmount();
    }
  });
});
