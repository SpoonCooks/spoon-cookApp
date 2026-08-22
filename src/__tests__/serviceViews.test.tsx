import { render, screen } from '@testing-library/react-native';

import { projectServiceState } from '@core/domain/serviceState';
import { serviceFixtures } from '@core/fixtures';
import { ArrivalView, CookingView, StartOtpView, TravelView } from '@features/service/ServiceViews';

/**
 * Renders each service view from its real fixture, asserting the Figma copy that distinguishes
 * one state from another. These are the assertions that would catch the two `Page 4b` variants
 * being accidentally collapsed.
 */

function stateFrom(key: keyof typeof serviceFixtures) {
  return projectServiceState(serviceFixtures[key]());
}

describe('TravelView — three distinct states, two sharing a Figma label', () => {
  it('renders 4a on time', () => {
    const state = stateFrom('travelOnTime');
    if (state.kind !== 'travelling') throw new Error('expected travelling');
    render(
      <TravelView
        job={state.job}
        timing={state.timing}
        minutesToDeadline={state.minutesToDeadline}
      />,
    );
    expect(screen.getByText('Chalna shuru kar dein')).toBeTruthy();
    expect(screen.getByText('mai pahauch jaye')).toBeTruthy();
    expect(screen.getByText('16 mins')).toBeTruthy();
  });

  it('renders 4b AT RISK with a positive countdown', () => {
    const state = stateFrom('travelAtRisk');
    if (state.kind !== 'travelling') throw new Error('expected travelling');
    render(
      <TravelView
        job={state.job}
        timing={state.timing}
        minutesToDeadline={state.minutesToDeadline}
      />,
    );
    expect(screen.getByText('Jaldi kare, aap LATE ho rahe')).toBeTruthy();
    expect(screen.getByText('aap LATE ho sakte hai')).toBeTruthy();
    expect(screen.getByText('4 mins')).toBeTruthy();
  });

  it('renders 4b LATE with a negative countdown and different copy', () => {
    const state = stateFrom('travelLate');
    if (state.kind !== 'travelling') throw new Error('expected travelling');
    render(
      <TravelView
        job={state.job}
        timing={state.timing}
        minutesToDeadline={state.minutesToDeadline}
      />,
    );
    // Distinct from the at-risk frame despite the duplicated Figma label.
    expect(screen.getByText('Aap LATE hai! Jaldi se jaldi kare')).toBeTruthy();
    expect(screen.getByText('aap LATE hai!')).toBeTruthy();
    expect(screen.getByText('-2 mins')).toBeTruthy();
    expect(screen.queryByText('aap LATE ho sakte hai')).toBeNull();
  });

  it('keeps the Call affordance available during travel (founder decision #147)', () => {
    const state = stateFrom('travelOnTime');
    if (state.kind !== 'travelling') throw new Error('expected travelling');
    render(
      <TravelView
        job={state.job}
        timing={state.timing}
        minutesToDeadline={state.minutesToDeadline}
      />,
    );
    expect(screen.getByTestId('service-call')).toBeTruthy();
    expect(screen.getByTestId('service-map')).toBeTruthy();
  });

  it('renders Extend booking disabled — no cook-side backend command exists', () => {
    const state = stateFrom('travelOnTime');
    if (state.kind !== 'travelling') throw new Error('expected travelling');
    render(
      <TravelView
        job={state.job}
        timing={state.timing}
        minutesToDeadline={state.minutesToDeadline}
      />,
    );
    expect(screen.getByTestId('service-extend-booking').props.accessibilityState.disabled).toBe(
      true,
    );
  });
});

describe('ArrivalView', () => {
  it.each([
    ['arrivedOnTime' as const, 'Very good! Aap time par hai'],
    ['arrivedLate' as const, 'Aap LATE pahauchi hai!'],
  ])('renders %s', (key, copy) => {
    const state = stateFrom(key);
    if (state.kind !== 'arrived') throw new Error('expected arrived');
    render(<ArrivalView job={state.job} timing={state.timing} />);
    expect(screen.getByText(copy)).toBeTruthy();
    expect(screen.getByText('Mai pahuach gyi hu')).toBeTruthy();
  });
});

describe('StartOtpView', () => {
  it('shows the SORRY line only on the late variant (6b)', () => {
    const props = {
      code: '',
      onChange: jest.fn(),
      onSubmit: jest.fn(),
      error: null,
      isSubmitting: false,
    };
    const { rerender } = render(<StartOtpView timing="on_time" {...props} />);
    expect(screen.queryByText('Customer ko LATE ke liye SORRY bole')).toBeNull();
    expect(screen.getByText('Customer se OTP mange')).toBeTruthy();

    rerender(<StartOtpView timing="late" {...props} />);
    expect(screen.getByText('Customer ko LATE ke liye SORRY bole')).toBeTruthy();
  });

  it('keeps Start disabled until the full code is entered', () => {
    const props = { onChange: jest.fn(), onSubmit: jest.fn(), error: null, isSubmitting: false };
    const { rerender } = render(<StartOtpView timing="on_time" code="12" {...props} />);
    expect(screen.getByTestId('service-start-submit').props.accessibilityState.disabled).toBe(true);

    rerender(<StartOtpView timing="on_time" code="123" {...props} />);
    expect(screen.getByTestId('service-start-submit').props.accessibilityState.disabled).toBe(
      false,
    );
  });
});

describe('CookingView', () => {
  it('renders 7a with the rating nudge', () => {
    render(
      <CookingView
        minutesRemaining={37}
        isEndingSoon={false}
        isExtended={false}
        newExpectedEndIso={null}
      />,
    );
    expect(screen.getByText('Time bacha hai')).toBeTruthy();
    expect(screen.getByText('37 mins')).toBeTruthy();
    expect(screen.getByText('5+ rating laane ki koshish kare')).toBeTruthy();
  });

  it('renders 7b ending-soon prompts', () => {
    render(
      <CookingView minutesRemaining={7} isEndingSoon isExtended={false} newExpectedEndIso={null} />,
    );
    expect(screen.getByText('Kaam time pai nahi ho paega?')).toBeTruthy();
    expect(screen.getByText('Customer ko time badhane bole')).toBeTruthy();
  });

  it('renders 7c extended distinctly, since 7b and 7c share Figma copy', () => {
    render(
      <CookingView
        minutesRemaining={7}
        isEndingSoon
        isExtended
        newExpectedEndIso="2026-08-21T14:00:00+05:30"
      />,
    );
    expect(screen.getByTestId('cooking-extended-notice')).toBeTruthy();
    // The extension is distinguished by backend state, not by the shared Figma text.
    expect(screen.queryByText('Customer ko time badhane bole')).toBeNull();
  });

  it('renders a three-digit timer without truncation (founder comment #150)', () => {
    render(
      <CookingView
        minutesRemaining={120}
        isEndingSoon={false}
        isExtended={false}
        newExpectedEndIso={null}
      />,
    );
    const timer = screen.getByTestId('cooking-timer');
    expect(screen.getByText('120 mins')).toBeTruthy();
    expect(timer.props.numberOfLines).toBe(1);
    expect(timer.props.adjustsFontSizeToFit).toBe(true);
  });
});
