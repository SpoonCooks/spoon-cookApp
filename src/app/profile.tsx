import { router } from 'expo-router';

import { apiErrorMessage } from '@core/api/errors';
import { useCookProfile } from '@core/api/queries';
import { useSession } from '@core/session/store';
import { formatPhone } from '@features/profile/profileModel';
import { ProfileView } from '@features/profile/ProfileView';
import { ErrorState, LoadingState } from '@ui';

/**
 * PROFILE — the V15 `707:1534` frame, reached from the Hazri avatar.
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
 */
export default function ProfileScreen(): React.ReactElement {
  const auth = useSession((state) => state.auth);
  const profile = useCookProfile();

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/attendance');
  };

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

  return (
    <ProfileView
      name={cook.name}
      // The session is the only holder of the signed-in number; `signed_in` is the only state
      // this route is reachable from, so anything else means the session went away underneath it.
      phone={auth.kind === 'signed_in' ? formatPhone(auth.profile.phone) : '—'}
      hubName={cook.hub?.name ?? null}
      onBack={goBack}
    />
  );
}
