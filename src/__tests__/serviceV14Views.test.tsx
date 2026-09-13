import { fireEvent, render, screen } from '@testing-library/react-native';

import { serviceV14Fixtures } from '@core/fixtures';
import type { JobSummary } from '@core/domain/serviceState';
import {
  CompletedView,
  CookingView,
  StartOtpView,
  TravelCancelledView,
  TravelView,
} from '@features/service/ServiceV14Views';

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
 * All four travel frames carry the control at the same geometry. The route wires it to the
 * backend's proximity-validated arrival command, so pressing it can move the booking to the next
 * server state without inventing an arrival locally.
 *
 * What unlocks it is the SERVER, not the ETA. The document says "enabled when `ETA_running` < 1
 * min"; the backend refuses a manual arrival without a fresh position inside 75 m of the gate
 * (`ARRIVAL_PROXIMITY_NOT_CONFIRMED`). The button is therefore live, but the backend remains the
 * authority for whether the transition succeeds.
 */
describe('707:446 — the arrival CTA on the travel frames', () => {
  const travel = (
    timing: 'on_time' | 'at_risk' | 'late',
    onArrived = jest.fn(),
    canMarkArrived = false,
  ) =>
    render(
      <TravelView
        job={serviceV14Fixtures.job()}
        timing={timing}
        minutesToDeadline={5}
        minutesToArrival={8}
        onArrived={onArrived}
        canMarkArrived={canMarkArrived}
      />,
    );

  it.each(['on_time', 'at_risk', 'late'] as const)('is drawn on the %s frame', (timing) => {
    travel(timing);
    expect(screen.getByTestId('service-travel-arrived')).toBeTruthy();
  });

  /*
   * The button is DRAWN throughout the journey and pressable only at the gate.
   *
   * It used to be pressable the whole way, on the reasoning that the command would refuse it —
   * `markArrived` needs consecutive fresh samples inside the immutable gate radius. But a lime
   * button that looks ready and then throws is the same defect as CHALO offered forty minutes
   * early: the cook presses it repeatedly at the wrong moment and learns nothing from the error.
   * Reported from the handset on 2026-09-03: "why pahauch gaya button is active from start".
   *
   * `canMarkArrived` is the SERVER's answer — fresh accepted in-radius evidence exists — never an
   * ETA or a distance the handset worked out for itself.
   */
  it('is greyed and inert while she is still travelling', () => {
    travel('on_time');
    const cta = screen.getByTestId('service-travel-arrived');

    expect(cta.props.accessibilityState).toEqual({ disabled: true });
    // Announced, so a cook is not left inferring it from the colour.
    expect(cta.props.accessibilityHint).toBe('Location par pahauchne ke baad chalu hoga');
  });

  it('does not fire while inert, however many times it is pressed', () => {
    const onArrived = jest.fn();
    travel('on_time', onArrived);
    fireEvent.press(screen.getByTestId('service-travel-arrived'));
    expect(onArrived).not.toHaveBeenCalled();
  });

  it('hands the press to the route command once the server allows it', () => {
    const onArrived = jest.fn();
    travel('late', onArrived, true);
    const cta = screen.getByTestId('service-travel-arrived');

    expect(cta.props.accessibilityState).toEqual({ disabled: false });
    fireEvent.press(cta);
    expect(onArrived).toHaveBeenCalledTimes(1);
  });
});

describe('622:801 — Start OTP placement', () => {
  it('shows the promo before the keypad and omits the customer card', () => {
    render(<StartOtpView code="" onChange={jest.fn()} onSubmit={jest.fn()} length={3} />);

    expect(screen.getByTestId('start-otp-promo')).toBeTruthy();
    expect(screen.getByTestId('start-otp')).toBeTruthy();
    expect(screen.queryByTestId('service-details')).toBeNull();
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

describe('462:3579 — Call kare', () => {
  it('rings the customer when pressed', () => {
    // The button was drawn on three frames for weeks with `onPress` undefined, because no route
    // ever passed `onCall` and there was no endpoint behind it either. A press did nothing at all
    // and looked exactly like a press that worked.
    const onCall = jest.fn();
    render(
      <TravelView
        job={serviceV14Fixtures.job()}
        timing="on_time"
        minutesToDeadline={16}
        minutesToArrival={16}
        onCall={onCall}
      />,
    );

    fireEvent.press(screen.getByTestId('service-call'));
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('says nothing until a call actually fails', () => {
    render(
      <TravelView
        job={serviceV14Fixtures.job()}
        timing="on_time"
        minutesToDeadline={16}
        minutesToArrival={16}
        onCall={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('service-call-error')).toBeNull();
  });

  it('reports a failure under the button rather than in a modal', () => {
    // A cook presses this at a gate with one hand free. The caption leaves the arrival CTA and the
    // rest of the screen reachable; a dialog she has to dismiss would not.
    render(
      <TravelView
        job={serviceV14Fixtures.job()}
        timing="on_time"
        minutesToDeadline={16}
        minutesToArrival={16}
        onCall={jest.fn()}
        callError="Customer ka number abhi nahi mil raha."
      />,
    );

    expect(screen.getByTestId('service-call-error')).toHaveTextContent(
      'Customer ka number abhi nahi mil raha.',
    );
  });
});

describe('622:1036 — the End OTP sits beside the timer, not instead of it', () => {
  /*
   * Founder, 2026-09-02: the keypad is available for the WHOLE service.
   *
   * It has been in two wrong shapes before. Originally it REPLACED the timer from the first
   * second, so the timer, the last-seven-minutes state and the extension banner were all
   * unreachable — three drawn frames, dead. Then it replaced the timer only in the last five
   * minutes. Neither is what a cook needs: she wants to see how long is left AND be able to close
   * the job the moment the customer is ready.
   *
   * Ending early is safe because the code is the CUSTOMER's to read out — the OTP is their
   * consent, not the cook's shortcut.
   */
  const endOtp = {
    code: '',
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    isSubmitting: false,
    error: null,
    length: 4,
  };

  it('draws the timer AND the keypad together', () => {
    render(
      <CookingView
        hoursRemaining={1}
        minutesRemaining={20}
        isEndingSoon={false}
        extensionMinutes={null}
        endOtp={endOtp}
      />,
    );

    // The regression that mattered: the timer must survive.
    expect(screen.getByTestId('service-timer')).toBeTruthy();
    expect(screen.getByTestId('cooking-end-otp')).toBeTruthy();
    expect(screen.getByTestId('cooking-promo')).toBeTruthy();
  });

  it('offers it from the first minute, not only near the end', () => {
    render(
      <CookingView
        hoursRemaining={2}
        minutesRemaining={55}
        isEndingSoon={false}
        extensionMinutes={null}
        endOtp={endOtp}
      />,
    );

    expect(screen.getByTestId('cooking-end-otp')).toBeTruthy();
  });

  it('hides it when the server withholds permission', () => {
    // `endOtpReady` false means an already-used code. Offering a keypad the endpoint would refuse
    // is the shape of defect this whole screen has been fixed for twice.
    render(
      <CookingView
        hoursRemaining={1}
        minutesRemaining={20}
        isEndingSoon={false}
        extensionMinutes={null}
        endOtp={null}
      />,
    );

    expect(screen.queryByTestId('cooking-end-otp')).toBeNull();
    expect(screen.getByTestId('service-timer')).toBeTruthy();
    expect(screen.getByTestId('cooking-promo')).toBeTruthy();
  });

  it('renders both confirmed extension rows in the 2x state', () => {
    render(
      <CookingView
        hoursRemaining={null}
        minutesRemaining={38}
        isEndingSoon={false}
        extensionMinutes={[20, 10]}
        endOtp={null}
      />,
    );

    expect(screen.getByTestId('service-extension-minutes')).toHaveTextContent('20 mins');
    expect(screen.getByTestId('service-extension-minutes-2')).toHaveTextContent('10 mins');
    expect(screen.getByTestId('service-timer')).toHaveTextContent('38 mins');
  });

  it('uses the cleaning coaching copy in the last-seven-minutes state', () => {
    render(
      <CookingView
        hoursRemaining={null}
        minutesRemaining={7}
        isEndingSoon
        extensionMinutes={null}
      />,
    );

    expect(screen.getByText('Clean: SLAB, WALL aur STOVE')).toBeTruthy();
  });
});
