import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createQueryClient } from '@core/api/queries';
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
    // Hide on error too, otherwise a missing font file bricks the app behind the splash.
    if (fontsLoaded || fontError !== null) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && fontError === null) return null;

  return (
    <QueryClientProvider client={queryClient}>
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
