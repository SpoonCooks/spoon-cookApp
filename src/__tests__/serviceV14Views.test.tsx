import { render, screen } from '@testing-library/react-native';

import { serviceV14Fixtures } from '@core/fixtures';
import { CompletedView, TravelCancelledView, TravelView } from '@features/service/ServiceV14Views';

/**
 * The V14 `Service flow` facts that a screenshot can distinguish one frame by.
 *
 * These are deliberately narrow. The pixel run in `docs/visual-verification/v14/service-flow/` is
 * what proves the layout; what is asserted here is the handful of per-frame decisions that a diff
 * caught and that nothing in the code made obvious — each one a case where twelve frames agree and
 * the thirteenth does not.
 */

describe('622:913 — travel- cancel is not just another Active job frame', () => {
  it('titles the screen Jaankari, not Active job', () => {
    // Read from the reference render, not the layer name: names are stale throughout this file —
    // `628:1316` is NAMED `Serving at` and READS `Active job`. Twelve Service frames title
    // `Active job`; this one titles `Jaankari`, and the app printed `Active job` on all thirteen.
    render(<TravelCancelledView job={serviceV14Fixtures.job()} />);
    expect(screen.getByTestId('service-nav-title')).toHaveTextContent('Jaankari');
  });

  it('drops both customer actions, because the booking is gone', () => {
    // `622:923` draws neither `Map dekhe` nor `Call kare`. There is no longer a customer to ring
    // and nowhere to navigate to, which is why its card is 230 units tall against 332 elsewhere.
    render(<TravelCancelledView job={serviceV14Fixtures.job()} />);
    expect(screen.queryByTestId('service-map')).toBeNull();
    expect(screen.queryByTestId('service-call')).toBeNull();
  });

  it('still says what happened and offers the way out', () => {
    render(<TravelCancelledView job={serviceV14Fixtures.job()} />);
    expect(screen.getByText('Ye booking CANCEL ho gayi hai')).toBeTruthy();
    expect(screen.getByTestId('service-see-jobs')).toBeTruthy();
  });
});

describe('the other Service frames keep the Active job title', () => {
  it('titles a travel frame Active job', () => {
    render(<TravelView job={serviceV14Fixtures.job()} timing="on_time" minutesToDeadline={16} />);
    expect(screen.getByTestId('service-nav-title')).toHaveTextContent('Active job');
  });

  it('keeps Map dekhe on a live booking', () => {
    render(<TravelView job={serviceV14Fixtures.job()} timing="on_time" minutesToDeadline={16} />);
    expect(screen.getByTestId('service-map')).toBeTruthy();
  });

  it('titles the completed frame Active job', () => {
    render(<CompletedView />);
    expect(screen.getByTestId('service-nav-title')).toHaveTextContent('Active job');
  });
});
