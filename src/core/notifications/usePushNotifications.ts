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
      /*
       * Assignment and cancellation alerts are time-critical, so this channel must make a noise.
       * It does — by NOT naming a sound.
       *
       * `sound` on a channel is a CUSTOM sound filename that has to be bundled through the
       * `expo-notifications` plugin's `sounds` array. `'default'` is not a reserved word for the
       * system tone; it was read as a file called `default`, which does not exist, so every app
       * start threw `Custom sound 'default' not found in native app` and in a dev build the
       * LogBox overlay it raised swallowed every tap on the screen behind it.
       *
       * Omitting the field is what actually selects the system notification sound. Combined with
       * `HIGH` importance the channel still arrives as a heads-up alert with sound and vibration,
       * which is the behaviour the previous line was reaching for.
       *
       * To ship a branded tone later: add the file to `sounds` in the plugin config, then name it
       * here — `sound: 'spoon-alert.wav'`.
       */
      vibrationPattern: [0, 250, 250, 250],
    });
  },
  platform: defaultPushPlatform,
};

export interface PushNotificationsState {
  readonly status: PushRegistrationStatus | 'pending';
}

/** Why each non-registered outcome happened, in terms of what the operator has to change. */
const registrationDiagnosis: Record<Exclude<PushRegistrationStatus, 'registered'>, string> = {
  permission_denied: 'the cook declined the notification permission',
  unavailable:
    'this build has no push identity — check google-services.json is present for THIS package',
  failed: 'PUT /me/push-token was rejected, or the token could not be read',
};

/**
 * Say out loud when this device will not receive push.
 *
 * A failed registration is invisible from inside the app: the cook sees a working screen, and the
 * backend simply records `no_device` against every alert it tries to send. That is not
 * hypothetical — `app.config.ts` records 2026-09-02, when twelve start alerts went out, none were
 * delivered, and nothing anywhere said so until the database was inspected.
 *
 * `registerForPushNotifications` already returns a precise status; it was thrown away by the one
 * caller. Logging it is the cheapest thing that makes the next outage observable, and it is a
 * console line rather than cook-facing UI on purpose: a cook can do nothing about a missing FCM
 * identity, and no Figma frame covers this.
 *
 * Deliberately not dev-only. Production is exactly where a silent push outage costs a cook their
 * jobs, so the line must survive into a release build and be picked up by whatever crash/log
 * reporter is attached later. It never touches the token itself — that stays a credential.
 */
function reportPushRegistration(status: PushRegistrationStatus): void {
  if (status === 'registered') return;
  console.warn(
    `[spoon-push] not registered (${status}): ${registrationDiagnosis[status]}. ` +
      'This device will receive no job alerts.',
  );
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
      if (cancelled) return;
      reportPushRegistration(next);
      setRegistration(next);
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
