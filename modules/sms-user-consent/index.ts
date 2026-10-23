import { requireOptionalNativeModule } from 'expo';

interface SmsEvent {
  readonly message: string;
}

interface SmsUserConsentNative {
  start(): boolean;
  stop(): void;
  addListener(name: 'onSms', listener: (event: SmsEvent) => void): { remove(): void };
}

/** `null` on iOS, in jest, and in any binary built before this module existed. */
const native = requireOptionalNativeModule<SmsUserConsentNative>('SmsUserConsent');

/**
 * Listens for the next incoming SMS and, once the cook taps Allow on Google's consent sheet,
 * hands its body to `onMessage`. Returns a function that stops listening. A no-op where the
 * native module is absent (iOS autofills through `textContentType="oneTimeCode"` instead).
 */
export function listenForSms(onMessage: (message: string) => void): () => void {
  if (native === null) return () => undefined;
  const subscription = native.addListener('onSms', (event) => onMessage(event.message));
  try {
    native.start();
  } catch {
    // Play Services missing or out of date: the cook types or pastes the code instead.
  }
  return () => {
    subscription.remove();
    try {
      native.stop();
    } catch {
      // Nothing to stop.
    }
  };
}

/** The first run of six digits in an SMS body, or `null`. */
export function extractOtp(message: string, length: number): string | null {
  const match = new RegExp(`(?<!\\d)\\d{${length}}(?!\\d)`).exec(message);
  return match === null ? null : match[0];
}
