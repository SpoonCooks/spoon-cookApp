/**
 * Push payload handling.
 *
 * The governing rule (backend `notification-dispatch.ts`): a notification carries "safe
 * identifiers only" and the app "refreshes state from the API rather than trusting anything in
 * here." So the tests below assert two things — that the two real payload shapes are understood,
 * and that nothing else is ever acted upon.
 */

import {
  cookPushAlertKinds,
  cookPushEventTypes,
  deepLinkForPush,
  invalidationKeysForPush,
  parseCookPushPayload,
  registerForPushNotifications,
  type PushDependencies,
} from '@core/notifications/push';

const BOOKING = '3f1c2a5e-0000-4000-8000-000000000001';

describe('parseCookPushPayload', () => {
  it('reads the notification-dispatch shape', () => {
    expect(parseCookPushPayload({ bookingId: BOOKING, eventType: 'booking.cancelled' })).toEqual({
      kind: 'event',
      bookingId: BOOKING,
      eventType: 'booking.cancelled',
    });
  });

  it('reads the alert-dispatch shape', () => {
    expect(parseCookPushPayload({ bookingId: BOOKING, alertKind: 'start_alert' })).toEqual({
      kind: 'alert',
      bookingId: BOOKING,
      alertKind: 'start_alert',
    });
  });

  it('accepts every cook template the backend can send', () => {
    for (const eventType of cookPushEventTypes) {
      expect(parseCookPushPayload({ bookingId: BOOKING, eventType })).not.toBeNull();
    }
  });

  it('accepts every alert kind the backend can push', () => {
    for (const alertKind of cookPushAlertKinds) {
      expect(parseCookPushPayload({ bookingId: BOOKING, alertKind })).not.toBeNull();
    }
  });

  it('ignores move_alert, which has no push dispatcher', () => {
    // Acknowledgeable via the API, but never delivered as a push. Accepting it here would imply a
    // delivery path that does not exist.
    expect(parseCookPushPayload({ bookingId: BOOKING, alertKind: 'move_alert' })).toBeNull();
  });

  it.each([
    ['no data', null],
    ['a string', 'booking.cancelled'],
    ['an empty object', {}],
    ['a missing bookingId', { eventType: 'booking.cancelled' }],
    ['an empty bookingId', { bookingId: '', eventType: 'booking.cancelled' }],
    ['an unknown event type', { bookingId: BOOKING, eventType: 'booking.exploded' }],
    ['a non-string bookingId', { bookingId: 42, eventType: 'booking.cancelled' }],
    ['a customer-only event', { bookingId: BOOKING, eventType: 'booking.cook_en_route' }],
  ])('ignores %s', (_label, data) => {
    expect(parseCookPushPayload(data)).toBeNull();
  });
});

describe('deepLinkForPush', () => {
  it('sends an alert tap to the live service screen', () => {
    expect(deepLinkForPush({ kind: 'alert', bookingId: BOOKING, alertKind: 'start_alert' })).toBe(
      `/service/${BOOKING}`,
    );
  });

  it.each(['booking.cancelled', 'booking.completed', 'booking.reassigned'] as const)(
    'sends %s to Jobs rather than a service screen that assumes an active assignment',
    (eventType) => {
      expect(deepLinkForPush({ kind: 'event', bookingId: BOOKING, eventType })).toBe('/jobs');
    },
  );

  it('sends an extension confirmation to the job it changed', () => {
    expect(
      deepLinkForPush({
        kind: 'event',
        bookingId: BOOKING,
        eventType: 'booking.extension.confirmed',
      }),
    ).toBe(`/service/${BOOKING}`);
  });

  it('resolves a destination for every event type', () => {
    for (const eventType of cookPushEventTypes) {
      expect(deepLinkForPush({ kind: 'event', bookingId: BOOKING, eventType })).toMatch(/^\//);
    }
  });
});

describe('invalidationKeysForPush', () => {
  it('always refreshes jobs and the profile, never writes state', () => {
    const keys = invalidationKeysForPush({
      kind: 'alert',
      bookingId: BOOKING,
      alertKind: 'start_escalation',
    });
    expect(keys).toEqual([
      ['cook', 'jobs'],
      ['cook', 'me'],
    ]);
  });

  it('also refreshes earnings on completion, because the ledger moved', () => {
    const keys = invalidationKeysForPush({
      kind: 'event',
      bookingId: BOOKING,
      eventType: 'booking.completed',
    });
    expect(keys).toContainEqual(['cook', 'earnings']);
  });

  it('scopes every key under the cook namespace', () => {
    for (const eventType of cookPushEventTypes) {
      for (const key of invalidationKeysForPush({ kind: 'event', bookingId: BOOKING, eventType })) {
        expect(key[0]).toBe('cook');
      }
    }
  });
});

describe('registerForPushNotifications', () => {
  function deps(overrides: Partial<PushDependencies> = {}): PushDependencies {
    return {
      requestPermission: async () => ({ granted: true }),
      getDeviceToken: async () => 'device-token',
      registerToken: async () => undefined,
      setUpAndroidChannel: async () => undefined,
      platform: 'android',
      ...overrides,
    };
  }

  it('registers the device token with the backend', async () => {
    const registerToken = jest.fn().mockResolvedValue(undefined);
    await expect(registerForPushNotifications(deps({ registerToken }))).resolves.toBe('registered');
    expect(registerToken).toHaveBeenCalledWith({ token: 'device-token', platform: 'android' });
  });

  it('creates the Android channel before the first notification can land', async () => {
    const setUpAndroidChannel = jest.fn().mockResolvedValue(undefined);
    await registerForPushNotifications(deps({ setUpAndroidChannel }));
    expect(setUpAndroidChannel).toHaveBeenCalled();
  });

  it('does not create an Android channel on iOS', async () => {
    const setUpAndroidChannel = jest.fn();
    await registerForPushNotifications(deps({ platform: 'ios', setUpAndroidChannel }));
    expect(setUpAndroidChannel).not.toHaveBeenCalled();
  });

  it('never sends a token when permission was refused', async () => {
    const registerToken = jest.fn();
    await expect(
      registerForPushNotifications(
        deps({ requestPermission: async () => ({ granted: false }), registerToken }),
      ),
    ).resolves.toBe('permission_denied');
    expect(registerToken).not.toHaveBeenCalled();
  });

  it('reports `unavailable` — not a crash — when the build has no Firebase identity', async () => {
    // This is the PENDING_FOUNDER state: `google-services.json` is absent, so the native call
    // throws. An unconfigured push identity must not take the app down on launch.
    await expect(
      registerForPushNotifications(
        deps({
          getDeviceToken: async () => {
            throw new Error('Default FirebaseApp is not initialized');
          },
        }),
      ),
    ).resolves.toBe('unavailable');
  });

  it('distinguishes a genuine failure from a missing identity', async () => {
    await expect(
      registerForPushNotifications(
        deps({
          registerToken: async () => {
            throw new Error('500 from server');
          },
        }),
      ),
    ).resolves.toBe('failed');
  });

  it('is unavailable on web', async () => {
    await expect(registerForPushNotifications(deps({ platform: 'web' }))).resolves.toBe(
      'unavailable',
    );
  });
});
