/**
 * Push wiring for the signed-in app shell.
 *
 * Mounted once, inside the query provider and only while a session exists. Three jobs:
 *
 *   1. register this device's token with the backend (`PUT /v1/me/push-token`),
 *   2. invalidate the affected reads when a notification arrives, and
 *   3. deep-link — and acknowledge the alert — when the cook taps one.
 *
 * The hook holds no booking state of its own. Every screen it navigates to re-reads the
 * projection, so a push can only ever cause the app to look again at what the server says.
 */

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { acknowledgeAlert, registerPushToken } from '../api/cook';
import {
  defaultPushPlatform,
  deepLinkForPush,
  invalidationKeysForPush,
  parseCookPushPayload,
  registerForPushNotifications,
  type CookPushPayload,
  type PushDependencies,
  type PushRegistrationStatus,
} from './push';

/**
 * Foreground presentation.
 *
 * A cook mid-service must still see an assignment or cancellation alert, so notifications are
 * shown rather than swallowed while the app is open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'spoon-cook-jobs';

const deviceDependencies: PushDependencies = {
  requestPermission: async () => {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return { granted: true };
    const asked = await Notifications.requestPermissionsAsync();
    return { granted: asked.granted };
  },
  getDeviceToken: async () => {
    // The FCM/APNs token, not an Expo push token: the backend's `device_push_tokens` rows are
    // consumed by its own FCM provider, which cannot address an Expo token.
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === 'string' ? token.data : '';
  },
  registerToken: (input) => registerPushToken(input),
  setUpAndroidChannel: async () => {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Job alerts',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      // Assignment and cancellation alerts are time-critical; a silent channel would hide them.
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  },
  platform: defaultPushPlatform,
};

export interface PushNotificationsState {
  readonly status: PushRegistrationStatus | 'pending';
}

/**
 * @param enabled only true once a cook session exists — an unauthenticated
 * `PUT /me/push-token` would 401, and a token registered before sign-in would attach this device
 * to no account.
 */
export function usePushNotifications(
  enabled: boolean,
  deps: PushDependencies = deviceDependencies,
): PushNotificationsState {
  // Stable for the lifetime of the provider, so naming it as a dependency below does not cause
  // the listeners to re-subscribe.
  const client = useQueryClient();
  const [registration, setRegistration] = useState<PushRegistrationStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void registerForPushNotifications(deps).then((next) => {
      // Resolved asynchronously, so this is a subscription result rather than a render-time
      // state write.
      if (!cancelled) setRegistration(next);
    });
    return () => {
      cancelled = true;
    };
    // `deps` is a module constant in production and a fixed object in tests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const invalidate = (payload: CookPushPayload): void => {
      for (const queryKey of invalidationKeysForPush(payload)) {
        void client.invalidateQueries({ queryKey });
      }
    };

    // Arrival while the app is open: refresh, but do not navigate. Yanking a cook off the screen
    // they are using is worse than letting the next poll surface the change.
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const payload = parseCookPushPayload(notification.request.content.data);
      if (payload !== null) invalidate(payload);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const payload = parseCookPushPayload(response.notification.request.content.data);
      if (payload === null) return;

      invalidate(payload);

      // Responsiveness evidence, recorded because the cook demonstrably saw the alert. This does
      // NOT start travel and does not change booking status — see `push.ts`.
      if (payload.kind === 'alert') {
        void acknowledgeAlert({
          bookingId: payload.bookingId,
          alertType: payload.alertKind,
          // No `assignmentVersion`: a tap carries no projection, and the route rejects anything
          // below 1. The backend fences on the current assignment on its own.
        }).catch(() => {
          // A failed acknowledgement must never block the deep link — the cook still needs the
          // job. The backend treats a missing acknowledgement as non-responsive, which is the
          // truthful outcome when the call did not succeed.
        });
      }

      router.push(deepLinkForPush(payload) as Parameters<typeof router.push>[0]);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [enabled, client]);

  // Derived rather than stored: a signed-out shell reports `pending` without an effect having to
  // write state back on every sign-out.
  return { status: enabled ? (registration ?? 'pending') : 'pending' };
}
