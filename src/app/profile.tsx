import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { apiErrorMessage, isSessionExpired } from '@core/api/errors';
import { useCookProfile, useRequestAccountDeletion, useSignOut } from '@core/api/queries';
import { useSession } from '@core/session/store';
import { formatPhone } from '@features/profile/profileModel';
import { ProfileView, type ProfileSheet } from '@features/profile/ProfileView';
import { ErrorState, LoadingState } from '@ui';

/**
 * PROFILE — the V15 `707:1534` frame, reached from the Hazri avatar, plus the two account actions.
 *
 * ## Where each fact comes from, and why they are different places
 *
 * The name and the hub are the SERVER's, read from `GET /cook/profile` — an admin can rename a
 * cook or move her hub, and this screen has to show that the moment it happens rather than
 * whatever was true when she signed in.
 *
 * The phone is the SESSION's. It is the number this device authenticated with, which is exactly
 * the question the screen answers ("is the app signed in as me?"), and the cook read does not
 * publish a phone at all. Reading it from the session also means a number that was replaced by
 * `/v1/admin/cooks/:id/phone` cannot be shown as current: that command revokes every session, so
 * the next screen a cook sees is the login, not a stale profile.
 *
 * ## Why the route owns the sheets
 *
 * Which sheet is open, whether something is in flight and what failed are all decided by the
 * mutation, not by the tap that started it. A confirmed deletion request that comes back 409 must
 * leave the sheet OPEN holding the reason; a confirmed logout must leave it open only until the
 * session is actually gone. Only this file knows either, so `ProfileView` is told.
 */
export default function ProfileScreen(): React.ReactElement {
  const auth = useSession((state) => state.auth);
  const sessionSignOut = useSession((state) => state.signOut);
  const profile = useCookProfile();

  const [sheet, setSheet] = useState<ProfileSheet>('none');
  const signOut = useSignOut();
  const requestDeletion = useRequestAccountDeletion();

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/attendance');
  };

  const closeSheet = useCallback((): void => {
    setSheet('none');
    // Drops a failure with the sheet that showed it, so re-opening does not greet her with the
    // error from an attempt she has already abandoned.
    requestDeletion.reset();
    signOut.reset();
  }, [requestDeletion, signOut]);

  const openSheet = useCallback(
    (next: Exclude<ProfileSheet, 'none'>): void => {
      requestDeletion.reset();
      signOut.reset();
      setSheet(next);
    },
    [requestDeletion, signOut],
  );

  const confirm = useCallback((): void => {
    if (sheet === 'logout') {
      /*
       * `replace`, not `push`, and only after the session is actually gone: a back gesture must
       * not be able to return to a signed-in screen. `useSignOut` cannot reject in practice —
       * `endSession` swallows a failed revocation so a dead network cannot strand her — but the
       * navigation is still tied to its resolution rather than fired alongside it.
       */
      void signOut.mutateAsync().then(
        () => {
          setSheet('none');
          router.replace('/login');
        },
        () => {
          /* Held by the mutation and rendered in the sheet. */
        },
      );
      return;
    }
    if (sheet === 'delete') {
      void requestDeletion.mutateAsync().then(
        () => {
          // The sheet closes onto the pending row, which the re-read of `/cook/me` has by now
          // filled in. Nothing else about her session changes — see `requestAccountDeletion`.
          setSheet('none');
        },
        (error: unknown) => {
          // A request refused because the session died is not a deletion failure to explain; it
          // is a login to perform.
          if (isSessionExpired(error)) {
            sessionSignOut();
            router.replace('/login');
          }
        },
      );
    }
  }, [requestDeletion, sessionSignOut, sheet, signOut]);

  if (profile.isPending) return <LoadingState testID="profile-loading" />;
  if (profile.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(profile.error)}
        onRetry={() => void profile.refetch()}
        testID="profile-error"
      />
    );
  }

  const cook = profile.data.cook;
  const failure = requestDeletion.error ?? signOut.error ?? null;

  return (
    <ProfileView
      name={cook.name}
      // The session is the only holder of the signed-in number; `signed_in` is the only state
      // this route is reachable from, so anything else means the session went away underneath it.
      phone={auth.kind === 'signed_in' ? formatPhone(auth.profile.phone) : '—'}
      hubName={cook.hub?.name ?? null}
      onBack={goBack}
      account={{
        deletionRequestedAt: profile.data.deletionRequest?.requestedAt ?? null,
        sheet,
        busy: signOut.isPending || requestDeletion.isPending,
        errorMessage: failure === null ? null : apiErrorMessage(failure),
        onOpenSheet: openSheet,
        onCloseSheet: closeSheet,
        onConfirm: confirm,
      }}
    />
  );
}
