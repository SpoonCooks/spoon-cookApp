import { Linking } from 'react-native';

/**
 * The Help pill's destination: Spoon's support WhatsApp.
 *
 * ## Why the number is here and not read from the backend
 *
 * The founder's instruction (2026-08-30) is a direct redirect from the app. The backend does
 * publish this number — `SUPPORT_WHATSAPP_PHONE`, on the customer catalogue's `support` DTO —
 * and the cook routes could carry it too, which would let it change without a release. It is
 * stated here instead, so changing it later means shipping a build. That is the trade, taken
 * deliberately rather than by omission.
 *
 * ## Two URL forms, and why `https://wa.me` goes FIRST
 *
 * Both open WhatsApp, but only one reliably opens the CONVERSATION. Tried on a real device, the
 * `whatsapp://send` scheme handed the app the intent while it was already running and WhatsApp
 * simply resumed whatever screen it was last on — the cook lands in her own chat list with no
 * message written, which is worse than a dead button because it looks like it worked. The
 * `https://wa.me/...` form opened the support conversation with the greeting in the input box
 * every time, warm or cold.
 *
 * So the https form leads and the scheme is the fallback for a device whose browser cannot
 * resolve it. The https form also degrades honestly without WhatsApp installed: it opens the
 * WhatsApp landing page for the number rather than failing silently.
 */

/** E.164 without the `+`, which is the form both WhatsApp URLs take. */
const SUPPORT_WHATSAPP_NUMBER = '918792997836';

/**
 * What the cook's message says before she adds anything.
 *
 * Short on purpose — it is a greeting she can send or type over, not a form. Her NAME is
 * included when the app knows it, because support's first question is otherwise "who is this?"
 * and a cook who has to answer that has already lost the benefit of a prefilled message.
 */
export function supportMessage(cookName?: string | null): string {
  const name = cookName === null || cookName === undefined ? '' : cookName.trim();
  return name.length === 0
    ? 'Namaste, mujhe help chahiye.'
    : `Namaste, main ${name} hu. Mujhe help chahiye.`;
}

/** `whatsapp://send?phone=...&text=...` — the installed app. */
export function supportWhatsAppUrl(cookName?: string | null): string {
  return `whatsapp://send?phone=${SUPPORT_WHATSAPP_NUMBER}&text=${encodeURIComponent(
    supportMessage(cookName),
  )}`;
}

/** `https://wa.me/...` — resolvable with or without WhatsApp installed. */
export function supportWhatsAppWebUrl(cookName?: string | null): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    supportMessage(cookName),
  )}`;
}

export interface SupportDependencies {
  readonly openUrl: (url: string) => Promise<unknown>;
  readonly canOpenUrl: (url: string) => Promise<boolean>;
}

const defaultSupportDependencies: SupportDependencies = {
  openUrl: (url) => Linking.openURL(url),
  canOpenUrl: (url) => Linking.canOpenURL(url),
};

/**
 * Opens WhatsApp at Spoon support with the greeting prefilled.
 *
 * Resolves `false` only when neither URL can be opened at all, so the caller can say something
 * rather than leaving the cook with a tap that did nothing. `canOpenURL` failing is treated as
 * "cannot", never as a reason to throw: a Help button must not crash the screen it sits on.
 */
export async function openSupportWhatsApp(
  cookName?: string | null,
  dependencies: SupportDependencies = defaultSupportDependencies,
): Promise<boolean> {
  for (const url of [supportWhatsAppWebUrl(cookName), supportWhatsAppUrl(cookName)]) {
    try {
      if (!(await dependencies.canOpenUrl(url))) continue;
      await dependencies.openUrl(url);
      return true;
    } catch {
      // Try the next form. A handler that exists but refuses the launch is the same to the cook
      // as one that is missing.
    }
  }
  return false;
}
