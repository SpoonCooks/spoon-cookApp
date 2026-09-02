import { render, screen } from '@testing-library/react-native';

import { serviceV14Fixtures } from '@core/fixtures';
import type { JobSummary } from '@core/domain/serviceState';
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

/**
 * `707:435` — "Pahauch gaye" belongs to the TRAVEL frames too.
 *
 * All four travel frames carry the control at the same geometry: greyed while the cook is on her
 * way, lime once she is there. The app drew only the enabled one, on the arrival screen, so for
 * the whole journey there was no button at all — no affordance, and no sense of what unlocks it.
 *
 * What unlocks it is the SERVER, not the ETA. The document says "enabled when `ETA_running` < 1
 * min"; the backend refuses a manual arrival without a fresh position inside 75 m of the gate
 * (`ARRIVAL_PROXIMITY_NOT_CONFIRMED`), and one minute of ETA is no guarantee of being inside 75 m.
 * Enabling on the ETA would hand the cook a button that errors under her thumb. So the travel
 * screens draw it inert and the arrival screen — reached when the server confirms proximity —
 * draws the same control live.
 */
describe('707:446 — the arrival CTA on the travel frames', () => {
  const travel = (timing: 'on_time' | 'at_risk' | 'late') =>
    render(
      <TravelView
        job={serviceV14Fixtures.job()}
        timing={timing}
        minutesToDeadline={5}
        minutesToArrival={8}
      />,
    );

  it.each(['on_time', 'at_risk', 'late'] as const)('is drawn on the %s frame', (timing) => {
    travel(timing);
    expect(screen.getByTestId('service-travel-arrived')).toBeTruthy();
  });

  it('is inert while travelling, and says so to a screen reader', () => {
    travel('on_time');
    const cta = screen.getByTestId('service-travel-arrived');

    expect(cta.props.accessibilityState).toEqual({ disabled: true });
    // Not merely greyed: a colour is not an explanation.
    expect(cta.props.accessibilityHint).toBe('Location par pahauchne ke baad chalu hoga');
  });

  it('carries no press handler at all, so it cannot fire a refusal', () => {
    travel('late');
    // Belt and braces beside `disabled`: the callback is not wired on the travel screens, so a
    // synthesised press cannot reach `POST /cook/bookings/:id/arrive` from here.
    expect(screen.getByTestId('service-travel-arrived').props.onPress).toBeUndefined();
  });
});

/**
 * The travel card shows the ETA or nothing — never the deadline countdown wearing its label.
 *
 * On 2026-09-02 a cook opened an 08:30 job at 07:32, before the first ETA had been computed. The
 * card fell back to `minutesToDeadline` and showed "57 mins" — the time until her BOOKING — and
 * three seconds later the real ETA arrived at one minute. The number collapsed by an hour and read
 * as a bug. It was not one: it was two different measurements sharing a label, which is a card
 * that cannot be read at all.
 */
describe('the travel card refuses to substitute a different measurement', () => {
  const view = (minutesToArrival: number | null) =>
    render(
      <TravelView
        job={serviceV14Fixtures.job()}
        timing="on_time"
        minutesToDeadline={57}
        minutesToArrival={minutesToArrival}
      />,
    );

  it('shows the travel time when the server has one', () => {
    view(2);
    expect(screen.getByTestId('service-travel-countdown')).toHaveTextContent('2 mins');
  });

  it('shows a placeholder rather than the time until the booking', () => {
    view(null);
    const countdown = screen.getByTestId('service-travel-countdown');

    expect(countdown).toHaveTextContent('--');
    // The exact regression: 57 was the deadline, not the distance.
    expect(countdown).not.toHaveTextContent('57');
  });
});

/**
 * `462:3579` — the address card draws the lines an address HAS, and names who is at the door.
 *
 * Two defects, both visible on one screen. `customerName` was hardcoded `null` in the adapter, so
 * the name row rendered blank on every job and a cook arrived without knowing who to ask for — the
 * name existed in the customer's profile the whole time and the projection simply never carried
 * it. And all four address rows were drawn unconditionally, while the customer's own form collects
 * a flat and ONE combined "Building/ Tower name or Plot no." stored as the society: `tower` is
 * never populated, no surface collects a floor, so two rows rendered as an icon with nothing
 * beside it on every job.
 */
describe('the address card', () => {
  const jobWithAddress = (address: Partial<JobSummary['address']>) => {
    const base = serviceV14Fixtures.job();
    return { ...base, address: { ...base.address, ...address } };
  };

  const rowsFor = (address: Partial<JobSummary['address']>) => {
    render(
      <TravelView
        job={jobWithAddress(address)}
        timing="on_time"
        minutesToDeadline={16}
        minutesToArrival={16}
      />,
    );
    return screen.getByTestId('service-details-rows').props.children as unknown[];
  };

  it('draws the address as two lines, not four', () => {
    const rows = rowsFor({
      buildingName: 'Dawars',
      towerOrBlock: null,
      floor: null,
      flatOrHouse: '549',
    });

    expect(screen.getByText('Dawars')).toBeTruthy();
    expect(screen.getByText('549')).toBeTruthy();
    // The two the product collects. Tower and floor have no source anywhere, so a four-row card
    // could only ever draw two icons with nothing beside them.
    expect(rows).toHaveLength(2);
  });

  it('keeps a tower on the building line rather than discarding it', () => {
    // Ops can populate the column even though the customer's form has no separate field for it,
    // and their own field is named "Building/ Tower name" -- so the two belong on one line.
    rowsFor({ buildingName: 'Dawars', towerOrBlock: 'B Block', flatOrHouse: '549' });

    expect(screen.getByText('Dawars, B Block')).toBeTruthy();
  });

  it('drops a line the address genuinely has nothing for', () => {
    const rows = rowsFor({ buildingName: null, towerOrBlock: null, flatOrHouse: '549' });

    expect(rows).toHaveLength(1);
    expect(screen.getByText('549')).toBeTruthy();
  });

  it('names the person the cook is going to see', () => {
    render(
      <TravelView
        job={jobWithAddress({ customerName: 'Lakshay Dawar' })}
        timing="on_time"
        minutesToDeadline={16}
        minutesToArrival={16}
      />,
    );

    expect(screen.getByTestId('service-customer')).toHaveTextContent('Lakshay Dawar');
  });

  it('leaves the name blank rather than inventing one', () => {
    render(
      <TravelView
        job={jobWithAddress({ customerName: null })}
        timing="on_time"
        minutesToDeadline={16}
        minutesToArrival={16}
      />,
    );

    expect(screen.getByTestId('service-customer')).toHaveTextContent('');
  });
});
