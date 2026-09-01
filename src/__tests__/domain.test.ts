import {
  formatDurationHours,
  formatMinutes,
  groupJobsByDate,
  type JobCardModel,
} from '@core/domain/job';
import { formatRupees } from '@core/domain/money';
import {
  backendLoginOtpDigits,
  backendServiceOtpDigits,
  hasOtpFigmaConflict,
  otpFigmaBoxCount,
  otpLength,
} from '@core/domain/otp';

describe('formatRupees', () => {
  it.each([
    [115000, '₹1,150'],
    [3573900, '₹35,739'],
    [3438900, '₹34,389'],
    [0, '₹0'],
    [100000, '₹1,000'],
    // Indian grouping: pairs above the last three digits.
    [1000000000, '₹1,00,00,000'],
  ])('formats %i paise as %s', (paise, expected) => {
    expect(formatRupees(paise)).toBe(expected);
  });

  it('keeps a negative amount signed', () => {
    expect(formatRupees(-15000)).toBe('-₹150');
  });
});

describe('formatDurationHours', () => {
  it.each([
    [90, '1.5 hrs'],
    [60, '1 hr'],
    [120, '2 hrs'],
    // Below an hour the design writes minutes. `583:375` publishes `30 mins` and `45 mins` in its
    // own chips; the app used to draw `0.5 hrs` and `0.8 hrs` there, and this row asserted it.
    [45, '45 mins'],
    [30, '30 mins'],
    [59, '59 mins'],
    [1, '1 min'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatDurationHours(minutes)).toBe(expected);
  });
});

describe('formatMinutes', () => {
  it('renders the Figma countdown values', () => {
    expect(formatMinutes(26)).toBe('26 mins');
    expect(formatMinutes(1)).toBe('1 min');
  });

  it('preserves negative values, which distinguish LATE from AT RISK', () => {
    expect(formatMinutes(-2)).toBe('-2 mins');
  });

  it('supports three-digit values (founder comment #150)', () => {
    expect(formatMinutes(120)).toBe('120 mins');
  });
});

describe('OTP contract', () => {
  it('uses 6 digits for login, matching Figma and the backend default', () => {
    expect(otpLength.login).toBe(6);
    expect(otpFigmaBoxCount.login).toBe(6);
    expect(hasOtpFigmaConflict('login')).toBe(false);
  });

  it('uses the verified backend length of 3 for the service OTPs', () => {
    // Backend `SERVICE_OTP_DIGITS = 3`, enforced by `pattern: '^[0-9]{3}$'` on both verify routes.
    expect(otpLength.start).toBe(3);
    expect(otpLength.end).toBe(3);
    expect(otpLength.start).toBe(backendServiceOtpDigits);
    expect(otpLength.end).toBe(backendServiceOtpDigits);
  });

  it('now agrees with Figma on every OTP length', () => {
    // The 3-vs-4 conflict is resolved: Figma `482:4656` draws three boxes and the backend
    // validates three digits. If either side moves again this test is the tripwire.
    expect(otpFigmaBoxCount.start).toBe(3);
    expect(otpFigmaBoxCount.end).toBe(3);
    expect(hasOtpFigmaConflict('start')).toBe(false);
    expect(hasOtpFigmaConflict('end')).toBe(false);
    expect(hasOtpFigmaConflict('login')).toBe(false);
  });

  it('keeps login OTP distinct from the service OTPs', () => {
    // Three mechanisms, three endpoints. A shared length would invite a shared code path.
    expect(otpLength.login).toBe(backendLoginOtpDigits);
    expect(otpLength.login).not.toBe(otpLength.start);
  });
});

describe('groupJobsByDate', () => {
  const job = (bookingId: string, scheduledStartIso: string): JobCardModel => ({
    bookingId,
    assignmentVersion: 1,
    societyOrBuilding: 'Building/ Society',
    serviceDurationMinutes: 90,
    scheduledStartIso,
    reachByIso: null,
    minutesToDeadline: null,
    travelMinutes: null,
    action: 'none',
    isActionable: false,
    isRunningLate: false,
    urgency: 'soon',
    address: {
      buildingName: null,
      towerOrBlock: null,
      floor: null,
      flatOrHouse: null,
      customerName: null,
    },
    gate: null,
  });

  it('groups by service date in ascending order', () => {
    const groups = groupJobsByDate([
      job('b2', '2026-08-22T10:00:00+05:30'),
      job('b1', '2026-08-21T11:50:00+05:30'),
    ]);
    expect(groups.map((g) => g.dateIso)).toEqual(['2026-08-21', '2026-08-22']);
  });

  it('supports tomorrow labelling without needing a separate screen', () => {
    const groups = groupJobsByDate(
      [job('b1', '2026-08-21T11:50:00+05:30'), job('b2', '2026-08-22T10:00:00+05:30')],
      (date) => (date === '2026-08-22' ? 'Kal' : 'Aaj'),
    );
    expect(groups.map((g) => g.label)).toEqual(['Aaj', 'Kal']);
  });

  it('leaves labels null when the backend supplies none', () => {
    const groups = groupJobsByDate([job('b1', '2026-08-21T11:50:00+05:30')]);
    expect(groups[0]?.label).toBeNull();
  });
});
