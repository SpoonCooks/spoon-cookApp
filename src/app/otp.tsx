import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiErrorMessage, isApiError } from '@core/api/errors';
import { cookAccessDenialCopy } from '@core/domain/auth';
import { loginResendSeconds, otpLength } from '@core/domain/otp';
import { OtpView } from '@features/login/LoginViews';
import { completeLogin, sendLoginOtp } from '@core/session/auth';
import { useSession } from '@core/session/store';

/**
 * Pages 2a / 2b / 2c — OTP verification (Figma `434:3224`, `434:3174`, `434:3116`, V13).
 *
 * The route owns behaviour only; the pixels live in `OtpView`, which renders all three frames as
 * states of one screen.
 *
 * Length comes from `otpLength.login` (6), matching the six `digits` frames in the design and the
 * backend's own contract. Verification fires as soon as the sixth digit lands — the design draws
 * no submit button on any of the three frames, so waiting for one would strand the cook.
 */
export default function OtpScreen(): React.ReactElement {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const signIn = useSession((state) => state.signIn);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(loginResendSeconds);
  // Guards against a double resend while one is already in flight.
  const resendInFlight = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = useCallback(
    (entered: string) => {
      if (entered.length !== otpLength.login) return;
      if (typeof phone !== 'string' || phone.length === 0) return;
      setSubmitting(true);
      setError(null);
      void completeLogin({ localTenDigits: phone, otp: entered })
        .then((state) => {
          if (state.kind === 'signed_in') {
            signIn({
              role: 'cook',
              userStatus: 'active',
              cookProfileStatus: 'active',
              profile: state.profile,
            });
            router.replace('/jobs');
            return;
          }
          if (state.kind === 'denied') {
            setError(cookAccessDenialCopy[state.reason]);
            setCode('');
          }
        })
        .catch((cause: unknown) => {
          // A rejected code is `400 INVALID_REQUEST`; anything else keeps its own message.
          setError(
            isApiError(cause) && cause.status === 400
              ? 'Galat OTP. Firse koshish kare'
              : apiErrorMessage(cause),
          );
          setCode('');
        })
        .finally(() => {
          setSubmitting(false);
        });
    },
    [phone, signIn],
  );

  const resend = useCallback(() => {
    if (secondsLeft > 0 || resendInFlight.current) return;
    if (typeof phone !== 'string' || phone.length === 0) return;
    resendInFlight.current = true;
    setError(null);
    void sendLoginOtp(phone)
      .then(() => {
        // The timer restarts only on a real success, so a failed resend does not look like one.
        setSecondsLeft(loginResendSeconds);
        setCode('');
      })
      .catch((cause: unknown) => {
        setError(apiErrorMessage(cause));
      })
      .finally(() => {
        resendInFlight.current = false;
      });
  }, [phone, secondsLeft]);

  const change = useCallback(
    (next: string) => {
      setCode(next);
      if (error !== null) setError(null);
      if (next.length === otpLength.login) verify(next);
    },
    [error, verify],
  );

  return (
    <OtpView
      phone={typeof phone === 'string' ? phone : ''}
      code={code}
      onChange={change}
      onSubmit={() => verify(code)}
      onEditPhone={() => router.back()}
      onResend={resend}
      secondsLeft={secondsLeft}
      error={error}
      isSubmitting={submitting}
      length={otpLength.login}
    />
  );
}
