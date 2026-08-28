import {
  EXTENSION_BANNER_MS,
  extensionBannerRemainingMs,
  projectServiceState,
  type ExtensionProjection,
  type ServiceSnapshot,
} from '@core/domain/serviceState';

/**
 * The five-minute extension window (`622:1163`).
 *
 * The designer's rule is that the extension element stays for five minutes after confirmation and
 * then the UI returns to the normal Active Job screen. It appears nowhere in the Figma file — no
 * annotation, no prototype reaction, no motion data — so these tests are the only executable
 * statement of it, which is why the boundaries are asserted exactly rather than approximately.
 *
 * Every case below moves only SERVER time. That is the point: the window is the difference between
 * two server instants, so there is no device clock in the arithmetic to manipulate.
 */

const CONFIRMED_AT = '2026-08-25T08:00:00.000Z';

const extended = (over: Partial<ExtensionProjection> = {}): ExtensionProjection => ({
  isExtended: true,
  extendedByMinutes: 20,
  newExpectedEndIso: '2026-08-25T08:28:00.000Z',
  confirmedAtIso: CONFIRMED_AT,
  ...over,
});

/** Server time `ms` after the confirmation instant. */
const serverTimeAfter = (ms: number): string =>
  new Date(Date.parse(CONFIRMED_AT) + ms).toISOString();

describe('extensionBannerRemainingMs', () => {
  it('opens a full five-minute window at the confirmation instant', () => {
    expect(extensionBannerRemainingMs(extended(), CONFIRMED_AT)).toBe(EXTENSION_BANNER_MS);
  });

  it('still shows the banner at 4:59', () => {
    const remaining = extensionBannerRemainingMs(extended(), serverTimeAfter(4 * 60_000 + 59_000));
    expect(remaining).toBe(1_000);
    expect(remaining).toBeGreaterThan(0);
  });

  it('closes the window exactly at 5:00', () => {
    // The boundary is closed, not open: at exactly five minutes the banner is already gone.
    expect(extensionBannerRemainingMs(extended(), serverTimeAfter(EXTENSION_BANNER_MS))).toBe(0);
  });

  it('stays closed after 5:00 and never returns a negative remainder', () => {
    for (const overshoot of [1, 60_000, 60 * 60_000]) {
      const remaining = extensionBannerRemainingMs(
        extended(),
        serverTimeAfter(EXTENSION_BANNER_MS + overshoot),
      );
      expect(remaining).toBe(0);
    }
  });

  it('never reopens the window as later snapshots arrive', () => {
    // A fresh poll every 20s must not restart the five minutes. Each answer is derived from the
    // same confirmation instant, so the sequence can only decrease.
    const samples = [0, 20_000, 120_000, 280_000, 300_000, 320_000].map((ms) =>
      extensionBannerRemainingMs(extended(), serverTimeAfter(ms)),
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]!);
    }
    expect(samples.at(-1)).toBe(0);
  });

  it('is dark when the backend has not confirmed an extension', () => {
    expect(extensionBannerRemainingMs(extended({ isExtended: false }), CONFIRMED_AT)).toBe(0);
  });

  it('is dark when the backend confirms but sends no confirmation instant', () => {
    // This is production today: `GET /v1/cook/jobs/:id` omits the field entirely. The extension
    // is still honoured — only the banner is withheld.
    expect(extensionBannerRemainingMs(extended({ confirmedAtIso: null }), CONFIRMED_AT)).toBe(0);
  });

  it('is dark rather than throwing when a timestamp is unparseable', () => {
    expect(
      extensionBannerRemainingMs(extended({ confirmedAtIso: 'not-a-date' }), CONFIRMED_AT),
    ).toBe(0);
    expect(extensionBannerRemainingMs(extended(), 'not-a-date')).toBe(0);
  });

  it('ignores the device clock entirely', () => {
    // Jump the device a year forward and an hour back. The answer is a pure function of its two
    // server arguments, so neither can move it.
    const realNow = Date.now;
    try {
      const at = extensionBannerRemainingMs(extended(), serverTimeAfter(60_000));
      Date.now = () => Date.parse('2027-01-01T00:00:00.000Z');
      expect(extensionBannerRemainingMs(extended(), serverTimeAfter(60_000))).toBe(at);
      Date.now = () => Date.parse('2020-01-01T00:00:00.000Z');
      expect(extensionBannerRemainingMs(extended(), serverTimeAfter(60_000))).toBe(at);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('the cooking projection', () => {
  const cookingSnapshot = (
    serverNowIso: string,
    extension: ExtensionProjection,
  ): ServiceSnapshot => ({
    status: 'cooking',
    job: {
      bookingId: 'b1',
      assignmentVersion: 1,
      societyOrBuilding: 'Building/ Society',
      serviceDurationMinutes: 90,
      scheduledStartIso: '2026-08-25T07:00:00.000Z',
      reachByIso: null,
      address: {
        buildingName: null,
        towerOrBlock: null,
        floor: null,
        flatOrHouse: null,
        customerName: null,
      },
      gate: null,
    },
    clock: { serverNowIso, receivedAtMs: 0 },
    travelTiming: null,
    minutesToDeadline: null,
    arrivalTiming: null,
    startOtpReady: false,
    endOtpReady: false,
    actualStartIso: '2026-08-25T07:00:00.000Z',
    expectedEndIso: '2026-08-25T08:08:00.000Z',
    minutesRemaining: 28,
    isEndingSoon: false,
    extension,
    canStartTravel: false,
    interruption: null,
  });

  it('carries the remaining window onto the cooking state', () => {
    const state = projectServiceState(cookingSnapshot(serverTimeAfter(60_000), extended()))!;
    expect(state.kind).toBe('cooking');
    if (state.kind !== 'cooking') throw new Error('expected cooking');
    expect(state.extensionBannerMsRemaining).toBe(4 * 60_000);
  });

  it('keeps the extended end time after the banner window closes', () => {
    // Losing the banner is not losing the extension: the timer must still run to the extended end.
    const state = projectServiceState(
      cookingSnapshot(serverTimeAfter(EXTENSION_BANNER_MS + 1_000), extended()),
    )!;
    if (state.kind !== 'cooking') throw new Error('expected cooking');
    expect(state.extensionBannerMsRemaining).toBe(0);
    expect(state.expectedEndIso).toBe('2026-08-25T08:28:00.000Z');
    expect(state.extension.isExtended).toBe(true);
  });

  it('reconstructs the same window from a rebuilt snapshot', () => {
    // An app restart re-reads the projection and rebuilds the state from scratch. Same server
    // instants in, same window out — nothing is carried across the restart.
    const first = projectServiceState(cookingSnapshot(serverTimeAfter(90_000), extended()))!;
    const afterRestart = projectServiceState(cookingSnapshot(serverTimeAfter(90_000), extended()))!;
    if (first.kind !== 'cooking' || afterRestart.kind !== 'cooking')
      throw new Error('expected cooking');
    expect(afterRestart.extensionBannerMsRemaining).toBe(first.extensionBannerMsRemaining);
  });

  it('never shows the banner against today’s production payload', () => {
    // The deployed cook read model omits `confirmedAt`, so the adapter sets null.
    const state = projectServiceState(
      cookingSnapshot(serverTimeAfter(60_000), extended({ confirmedAtIso: null })),
    )!;
    if (state.kind !== 'cooking') throw new Error('expected cooking');
    expect(state.extensionBannerMsRemaining).toBe(0);
  });

  it('drops the banner when the booking is interrupted during the window', () => {
    // An interruption outranks every live state, banner included.
    const snapshot = {
      ...cookingSnapshot(serverTimeAfter(60_000), extended()),
      interruption: 'cancelled' as const,
    };
    expect(projectServiceState(snapshot)?.kind).toBe('interrupted');
  });

  it('drops the banner when the End OTP becomes available during the window', () => {
    const snapshot = { ...cookingSnapshot(serverTimeAfter(60_000), extended()), endOtpReady: true };
    expect(projectServiceState(snapshot)?.kind).toBe('awaiting_end_otp');
  });
});
