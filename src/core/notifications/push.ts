/**
 * Cook push notifications.
 *
 * ## A notification is a REFRESH HINT, never a state change
 *
 * The backend is explicit about this — `notification-dispatch.ts` sends "safe identifiers only"
 * and comments that the app must refresh from the API rather than trust the payload. So nothing in
 * this module writes booking state. A payload can do exactly two things:
 *
 *   1. name a query to invalidate, and
 *   2. name a screen to open.
 *
 * Everything the cook then sees comes from `GET /v1/cook/jobs/:id`. A forged or replayed push
 * therefore cannot move a booking, start a timer, or mark an arrival — the worst it can do is
 * cause a redundant read.
 *
 * ## The two payload shapes are the backend's, not invented here
 *
 *   `notification-dispatch.ts`  → `data: { bookingId, eventType }`
 *   `alert-dispatch-service.ts` → `data: { bookingId, alertKind }`
 *
 * Both are `Record<string, string>` because FCM data values are always strings. They are parsed
 * defensively: an unrecognised shape yields `null` and is ignored rather than guessed at.
 *
 * ## Acknowledgement happens on TAP, not on receipt
 *
 * `POST /cook/bookings/:id/acknowledge-alert` records *responsiveness evidence* (backend DEC-059).
 * A push that arrived while the phone sat in a pocket is not evidence that the cook responded, so
 * acknowledging on silent receipt would file a false record against a real operational signal —
 * and one the escalation ladder reads. Tapping the notification is the first moment the cook
 * demonstrably saw it, so that is when the acknowledgement is sent.
 *
 * ACKNOWLEDGE IS NOT START TRAVEL. It changes no booking status.
 *
 * ## Delivery is not verified by this file existing
 *
 * Android remote push needs the Cook App's own `google-services.json` / FCM sender identity, which
 * is PENDING_FOUNDER (see `app.config.ts`). Until that lands, {@link registerForPushNotifications}
 * resolves `unavailable` on a real device instead of throwing. The code path is connected; actual
 * device delivery is a separate, unproven claim.
 */

import { Platform } from 'react-native';

/** Cook-targeted `eventType` values, from `COOK_TEMPLATES` in `notification-dispatch.ts`. */
export const cookPushEventTypes = [
  'assignment.committed',
  'booking.assigned',
  'booking.reassigned',
  'booking.cancelled',
  'booking.cook_arrived',
  'service.started',
  'booking.extension.confirmed',
  'booking.extension.reversed',
  'booking.completed',
] as const;
export type CookPushEventType = (typeof cookPushEventTypes)[number];

/**
 * Alert kinds the backend actually PUSHES.
 *
 * `move_alert` is acknowledgeable through the API but has no push dispatcher, so it is
 * deliberately absent here — listing it would imply a delivery path that does not exist.
 */
export const cookPushAlertKinds = ['start_alert', 'start_escalation'] as const;
export type CookPushAlertKind = (typeof cookPushAlertKinds)[number];

export type CookPushPayload =
  | { readonly kind: 'event'; readonly bookingId: string; readonly eventType: CookPushEventType }
  | { readonly kind: 'alert'; readonly bookingId: string; readonly alertKind: CookPushAlertKind };

/**
 * Parse an FCM data payload.
 *
 * Returns `null` for anything unrecognised. Being strict here is what keeps an arbitrary push from
 * steering navigation: only the two documented shapes, with a non-empty `bookingId` and a
 * known enum member, produce a payload the app will act on.
 */
export function parseCookPushPayload(data: unknown): CookPushPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;

  const bookingId = record.bookingId;
  if (typeof bookingId !== 'string' || bookingId.length === 0) return null;

  const alertKind = record.alertKind;
  if (typeof alertKind === 'string') {
    const found = cookPushAlertKinds.find((kind) => kind === alertKind);
    return found === undefined ? null : { kind: 'alert', bookingId, alertKind: found };
  }

  const eventType = record.eventType;
  if (typeof eventType === 'string') {
    const found = cookPushEventTypes.find((type) => type === eventType);
    return found === undefined ? null : { kind: 'event', bookingId, eventType: found };
  }

  return null;
}

/**
 * Where a tapped notification should land.
 *
 * A booking that is finished or no longer the cook's must NOT deep-link into the live service
 * screen — that screen assumes an actionable assignment. Those cases route to Jobs, which reads
 * the list fresh and shows whatever is actually true.
 */
export function deepLinkForPush(payload: CookPushPayload): string {
  if (payload.kind === 'alert') {
    return `/service/${payload.bookingId}`;
  }
  switch (payload.eventType) {
    case 'booking.cancelled':
    case 'booking.completed':
    case 'booking.reassigned':
      return '/jobs';
    case 'assignment.committed':
    case 'booking.assigned':
      return `/service/${payload.bookingId}`;
    case 'booking.cook_arrived':
    case 'service.started':
    case 'booking.extension.confirmed':
    case 'booking.extension.reversed':
      return `/service/${payload.bookingId}`;
  }
}

/**
 * Which cached reads a payload invalidates.
 *
 * Always a prefix of the cook query keys, so the refetch is the app's own authenticated read.
 * Extension and completion events also touch money, because a confirmed extension changes the
 * expected end and a completion changes the ledger.
 */
export function invalidationKeysForPush(payload: CookPushPayload): readonly (readonly string[])[] {
  const jobKeys: (readonly string[])[] = [
    ['cook', 'jobs'],
    ['cook', 'me'],
  ];
  if (payload.kind === 'event' && payload.eventType === 'booking.completed') {
    jobKeys.push(['cook', 'earnings']);
  }
  return jobKeys;
}

export type PushRegistrationStatus =
  | 'registered'
  | 'permission_denied'
  /** No FCM/APNs identity is configured for this build, or this is a simulator. */
  | 'unavailable'
  | 'failed';

export interface PushDependencies {
  readonly requestPermission: () => Promise<{ granted: boolean }>;
  readonly getDeviceToken: () => Promise<string>;
  readonly registerToken: (input: {
    token: string;
    platform: 'android' | 'ios';
  }) => Promise<unknown>;
  readonly setUpAndroidChannel: () => Promise<void>;
  readonly platform: 'android' | 'ios' | 'web';
}

/**
 * Acquire permission and hand the device token to the backend.
 *
 * Never logs or returns the token: it is a credential that can address this cook's device, and the
 * only place it belongs is the request body. The status enum is what callers get.
 */
export async function registerForPushNotifications(
  deps: PushDependencies,
): Promise<PushRegistrationStatus> {
  if (deps.platform === 'web') return 'unavailable';

  try {
    const permission = await deps.requestPermission();
    if (!permission.granted) return 'permission_denied';

    // The channel must exist before the first notification lands, or Android files it under a
    // default the cook cannot configure.
    if (deps.platform === 'android') await deps.setUpAndroidChannel();

    const token = await deps.getDeviceToken();
    if (token.length === 0) return 'unavailable';

    await deps.registerToken({ token, platform: deps.platform });
    return 'registered';
  } catch (error) {
    // A missing `google-services.json` surfaces here as a thrown native error. That is a build
    // configuration gap, not a runtime fault the cook can act on, so it must not crash the app.
    return isMissingPushIdentity(error) ? 'unavailable' : 'failed';
  }
}

/** Distinguishes "this build has no push identity" from a genuine registration failure. */
function isMissingPushIdentity(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /firebase|google-services|no valid .*apns|not supported|default app/i.test(message);
}

export const defaultPushPlatform: PushDependencies['platform'] =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
