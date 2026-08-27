import { router } from 'expo-router';
import { useState } from 'react';

import { apiErrorMessage } from '@core/api/errors';
import { normalisePhone } from '@core/domain/auth';
import { PhoneView } from '@features/login/LoginViews';
import { sendLoginOtp } from '@core/session/auth';
import { useSession } from '@core/session/store';

/**
 * Page 1 — phone login (Figma `434:3280`, V13).
 *
 * The route owns behaviour only; the pixels live in `PhoneView` so `/dev` can render the identical
 * tree from a fixed value.
 *
 * Validation matches the backend contract (10 digits, leading 6-9); `Next` stays inert until the
 * number is valid, so an invalid request is never sent. `POST /v1/auth/otp/send` is sent with
 * `audience: 'cook'`, and navigation happens only after the backend accepts — never
 * optimistically — so a cook never lands on an OTP screen for a code that was never dispatched.
 */
export default function LoginScreen(): React.ReactElement {
  const beginOtp = useSession((state) => state.beginOtp);
  const [raw, setRaw] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalised = normalisePhone(raw);

  const submit = (): void => {
    if (normalised === null || sending) return;
    setSending(true);
    setError(null);
    void sendLoginOtp(normalised)
      .then(() => {
        beginOtp(normalised);
        router.push({ pathname: '/otp', params: { phone: normalised } });
      })
      .catch((cause: unknown) => {
        setError(apiErrorMessage(cause));
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <PhoneView
      value={raw}
      onChange={setRaw}
      onSubmit={submit}
      canSubmit={normalised !== null}
      isSending={sending}
      error={error}
      // The legal line's two spans each open their own bundled document — see `app/legal/[doc]`.
      onOpenTerms={() => router.push('/legal/terms')}
      onOpenPrivacy={() => router.push('/legal/privacy')}
    />
  );
}
