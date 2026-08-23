import { router } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { restoreSession } from '@core/session/auth';
import { useSession } from '@core/session/store';
import { color, useDesignScale } from '@ui';

/**
 * Page 0 — loading / boot (Figma `434:3330`).
 *
 * ## Composition
 *
 * V12 is a full-bleed diagonal gradient with the black Spoon mark centred on it — not the flat
 * yellow panel with `Spoon` / `Partner` set in type that this replaces. The wordmark is an
 * exported asset (`434:3335`, 370x370), because the mark's spoon-and-tomatoes lockup is
 * artwork, not text.
 *
 * The gradient is the exported `434:3334` fill rather than a gradient reconstructed in code. It
 * is diagonal, not vertical — sampling a single row shows the left edge ~7/255 redder than the
 * right — and exporting it keeps the exact V12 pixels instead of an approximation of them.
 *
 * Drawing it needed no new dependency either way: `expo-linear-gradient` is not installed, and
 * `react-native-svg` (which is) pulls in a `buffer` polyfill the project does not carry, so
 * importing it breaks `expo export`. The raster sidesteps both.
 *
 * ## Behaviour
 *
 * Unchanged. It restores any stored session and routes onward; it never decides authentication
 * itself. Restore re-validates a stored token against `GET /v1/cook/me` rather than trusting it,
 * so a cook whose approval was revoked while the app was closed does not get in on a stale token.
 * A failure resolves to signed-out, which is the safe direction.
 */

/** Viewport-space geometry, read from the `434:3330` subtree. */
const D = {
  /** `434:3335` — 370x370, centred. */
  logoSize: 370,
} as const;

export default function BootScreen(): React.ReactElement {
  const auth = useSession((state) => state.auth);
  const restoreComplete = useSession((state) => state.restoreComplete);
  const { s, width, height } = useDesignScale();

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
      <Image
        source={require('../../assets/images/figma-v12/boot-gradient.png')}
        style={[StyleSheet.absoluteFill, { width, height }]}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
        testID="boot-gradient"
      />

      <Image
        source={require('../../assets/images/figma-v12/boot-spoon-logo.png')}
        style={{ width: s(D.logoSize), height: s(D.logoSize) }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible
        accessibilityRole="image"
        accessibilityLabel="Spoon"
        testID="boot-logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Shows through only for the instant before the SVG paints.
    backgroundColor: color.yellow500,
  },
});
