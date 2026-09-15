import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createQueryClient } from '@core/api/queries';
import { logBuildProvenance } from '@core/buildProvenance';
import { TrackingBridge } from '@core/location/TrackingBridge';
import { usePushNotifications } from '@core/notifications/usePushNotifications';
import { selectIsSignedIn, useSession } from '@core/session/store';
import { color } from '@ui';

// Held until Livvic is ready so the first paint is never in a fallback face.
void SplashScreen.preventAutoHideAsync();

/**
 * Root layout.
 *
 * Loads the five Livvic weights actually used by the Figma (400/500/600/700/900 — verified by
 * walking every text style; 800 never occurs), then reveals the app.
 */
export default function RootLayout(): React.ReactElement | null {
  // Created once per app lifetime. A client rebuilt on re-render would drop every cache entry and
  // re-fire in-flight reads, which on a service screen means re-fetching an active booking on
  // every keystroke.
  const [queryClient] = useState(createQueryClient);

  const [fontsLoaded, fontError] = useFonts({
    'Livvic-Regular': require('@/assets/fonts/Livvic-Regular.ttf'),
    'Livvic-Medium': require('@/assets/fonts/Livvic-Medium.ttf'),
    'Livvic-SemiBold': require('@/assets/fonts/Livvic-SemiBold.ttf'),
    'Livvic-Bold': require('@/assets/fonts/Livvic-Bold.ttf'),
    'Livvic-Black': require('@/assets/fonts/Livvic-Black.ttf'),
  });

  useEffect(() => {
    logBuildProvenance();
  }, []);

  useEffect(() => {
    // Hide on error too, otherwise a missing font file bricks the app behind the splash.
    if (fontsLoaded || fontError !== null) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && fontError === null) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <TrackingBridge />
      <PushBridge />
      <SessionGate />
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.background },
            animation: 'fade',
          }}
        />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * Push registration and notification routing.
 *
 * A component rather than a call in `RootLayout` because `usePushNotifications` needs the query
 * client from context, and the provider is created in the same render. It draws nothing.
 *
 * Gated on a signed-in session: `PUT /v1/me/push-token` is authenticated, and registering a token
 * before sign-in would attach this device to no account.
 */
function PushBridge(): null {
  const isSignedIn = useSession(selectIsSignedIn);
  usePushNotifications(isSignedIn);
  return null;
}

/**
 * Sends the cook to Login the moment the session stops existing, wherever she is standing.
 *
 * The session can end under her feet rather than by her own tap: Ops finalizing her deletion
 * request revokes every session she has, and so does an admin replacing her phone number. The
 * next authenticated read then answers 401, `handleSessionLoss` flips the store, and this is what
 * turns that into a screen she can act on instead of an error with a Retry that cannot work.
 *
 * Owning the redirect here rather than in `queries.ts` keeps the router out of the data layer,
 * and means one rule covers every screen — including the ones added after this was written, which
 * is exactly how the original per-screen version fell behind.
 *
 * The cache is dropped AFTER the redirect, not inside the error handler: by then the screens that
 * would have refetched are unmounting, so nothing re-issues a request on behalf of a cook whose
 * session is already gone.
 */
function SessionGate(): null {
  const kind = useSession((state) => state.auth.kind);
  const client = useQueryClient();

  useEffect(() => {
    if (kind !== 'signed_out') return;
    router.replace('/login');
    client.removeQueries();
  }, [kind, client]);

  return null;
}
