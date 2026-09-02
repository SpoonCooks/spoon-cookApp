import { fireEvent, render, screen } from '@testing-library/react-native';

import type { JobCardModel } from '@core/domain/job';
import { otpLength } from '@core/domain/otp';
import { JobCard, OtpInput } from '@ui';

const job: JobCardModel = {
  bookingId: 'b1',
  assignmentVersion: 1,
  societyOrBuilding: 'Building/ Society',
  serviceDurationMinutes: 90,
  scheduledStartIso: '2026-08-21T11:50:00+05:30',
  reachByIso: '2026-08-21T11:50:00+05:30',
  minutesToDeadline: 26,
  travelMinutes: 12,
  action: 'start_travel',
  isActionable: false,
  isRunningLate: false,
  isCancelled: false,
  urgency: 'soon',
  address: {
    buildingName: null,
    towerOrBlock: null,
    floor: null,
    flatOrHouse: null,
    customerName: null,
  },
  gate: null,
};

describe('JobCard', () => {
  it('renders the Figma card values', () => {
    render(<JobCard job={job} />);
    expect(screen.getByText('26 mins')).toBeTruthy();
    expect(screen.getByText('12 min dur')).toBeTruthy();
    expect(screen.getByText('1.5 hrs')).toBeTruthy();
    expect(screen.getByText('Building/ Society')).toBeTruthy();
  });

  it('shows the START CTA disabled until the server says the job is actionable', () => {
    const onStartTravel = jest.fn();
    render(<JobCard job={job} onStartTravel={onStartTravel} />);

    const cta = screen.getByTestId('job-start-b1');
    expect(cta.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(cta);
    // Eligibility is a backend ruling; a disabled card must not raise the command.
    expect(onStartTravel).not.toHaveBeenCalled();
  });

  it('raises start-travel once the server marks it actionable', () => {
    const onStartTravel = jest.fn();
    render(<JobCard job={{ ...job, isActionable: true }} onStartTravel={onStartTravel} />);

    fireEvent.press(screen.getByTestId('job-start-b1'));
    expect(onStartTravel).toHaveBeenCalledWith('b1');
  });

  it('renders the RUNNING LATE badge only when the server flags it', () => {
    render(<JobCard job={job} />);
    expect(screen.queryByTestId('running-late-badge')).toBeNull();

    screen.rerender(<JobCard job={{ ...job, isRunningLate: true, minutesToDeadline: -2 }} />);
    expect(screen.getByTestId('running-late-badge')).toBeTruthy();
    // The negative countdown is what separates LATE from AT RISK.
    expect(screen.getByText('-2 mins')).toBeTruthy();
  });

  it('falls back to the scheduled time when there is no countdown', () => {
    render(<JobCard job={{ ...job, minutesToDeadline: null, travelMinutes: null }} />);
    expect(screen.getByText('11:50 AM')).toBeTruthy();
    expect(screen.getByText('Tak pahauch jaye')).toBeTruthy();
  });
});

describe('OtpInput', () => {
  it('renders exactly the requested number of boxes', () => {
    const { rerender } = render(
      <OtpInput length={otpLength.login} value="" onChange={jest.fn()} testID="otp" />,
    );
    expect(screen.getAllByTestId(/^otp-box-\d$/)).toHaveLength(6);

    // The same component serves the 3-digit service OTP — length is never screen-hardcoded.
    rerender(<OtpInput length={otpLength.start} value="" onChange={jest.fn()} testID="otp" />);
    expect(screen.getAllByTestId(/^otp-box-\d$/)).toHaveLength(3);
  });

  it('strips non-digits and clamps to the configured length', () => {
    const onChange = jest.fn();
    render(<OtpInput length={4} value="" onChange={onChange} testID="otp" />);

    fireEvent.changeText(screen.getByTestId('otp-field'), '12a3456');
    expect(onChange).toHaveBeenCalledWith('1234');
  });

  it('fires onComplete only when the full code is entered', () => {
    const onComplete = jest.fn();
    render(
      <OtpInput length={4} value="" onChange={jest.fn()} onComplete={onComplete} testID="otp" />,
    );

    fireEvent.changeText(screen.getByTestId('otp-field'), '123');
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('otp-field'), '1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('accepts a pasted code in one edit', () => {
    const onChange = jest.fn();
    render(<OtpInput length={6} value="" onChange={onChange} testID="otp" />);

    fireEvent.changeText(screen.getByTestId('otp-field'), '654321');
    expect(onChange).toHaveBeenCalledWith('654321');
  });
});
