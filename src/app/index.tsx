import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { restoreSession } from '@core/session/auth';
import { useSession } from '@core/session/store';
import { color, layout, Text } from '@ui';

/**
 * Page 0 — loading / boot (Figma `434:3330`).
 *
 * The single opening experience. It restores any stored session and routes onward; it never
 * decides authentication itself.
 *
 * Restore re-validates any stored token against `GET /v1/cook/me` rather than trusting it, so a
 * cook whose approval was revoked while the app was closed does not get in on a stale token.
 *
 * A failure here resolves to signed-out. That is deliberately the safe direction: showing Login to
 * a cook whose session was actually fine costs one OTP, whereas admitting someone on an
 * unverifiable token is a security failure.
 */
export default function BootScreen(): React.ReactElement {
  const auth = useSession((s) => s.auth);
  const restoreComplete = useSession((s) => s.restoreComplete);

  useEffect(() => {
    if (auth.kind !== 'loading') return;
    let cancelled = false;
    void restoreSession()
      .then((profile) => {
        if (!cancelled) restoreComplete(profile);
      })
      .catch(() => {
        if (!cancelled) restoreComplete(null);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.kind, restoreComplete]);

  useEffect(() => {
    if (auth.kind === 'signed_out') router.replace('/login');
    else if (auth.kind === 'signed_in') router.replace('/jobs');
  }, [auth.kind]);

  return (
    <View style={styles.container} testID="boot-screen">
      <View style={styles.mark}>
        <Text variant="displayXl" color={color.black}>
          Spoon
        </Text>
        <Text variant="titleBlack" color={color.black}>
          Partner
        </Text>
      </View>
      <ActivityIndicator color={color.black} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.yellow600,
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.gutter * 3,
  },
  mark: { alignItems: 'center' },
});
