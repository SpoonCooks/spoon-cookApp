import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Spoon Cook App — Expo config.
 *
 * NON-SECRET values only. `extra` is embedded in the JS bundle in plaintext and read back at
 * runtime through `expo-constants` in `src/core/config`. Never put a server-side secret here.
 *
 * ## Identity is deliberately Cook-App-specific
 *
 * This app must NEVER reuse the User App's Expo/EAS project id, Android package, iOS bundle id,
 * display name, or push identity. Sharing any of those would make the two apps collide in the
 * stores, in EAS, and in FCM token routing. The values below are therefore new, and the ones that
 * require founder/company action are left explicitly unset rather than guessed — see
 * PENDING_FOUNDER below.
 */

const APP_ENVS = ['development', 'staging', 'production'] as const;
type AppEnv = (typeof APP_ENVS)[number];

function resolveAppEnv(value: string | undefined): AppEnv {
  const found = APP_ENVS.find((env) => env === value);
  return found ?? 'development';
}

const APP_ENV = resolveAppEnv(process.env.APP_ENV);

const ENV_SUFFIX: Record<AppEnv, string> = {
  development: ' (Dev)',
  staging: ' (Staging)',
  production: '',
};

const BUNDLE_SUFFIX: Record<AppEnv, string> = {
  development: '.dev',
  staging: '.staging',
  production: '',
};

/**
 * PENDING_FOUNDER — these require company/founder action and must not be invented:
 *   - EAS project id (`extra.eas.projectId`)
 *   - Play Store listing + release credentials
 *   - FCM sender / google-services.json for the Cook App's own push identity
 * They stay absent so a release build fails loudly rather than shipping under the wrong identity.
 */

/** Brand yellow. Figma `#ffd600` — the Cook App's splash/background anchor. */
const SPLASH_BACKGROUND = '#FFD600';

/** Deployed API used when no `EXPO_PUBLIC_API_BASE_URL` is supplied outside production. */
const DEV_FALLBACK_API_BASE_URL = 'https://spoon-api-kalc.onrender.com';

const BUNDLE_ID = `com.spoonhelp.cookapp${BUNDLE_SUFFIX[APP_ENV]}`;

function resolveApiBaseUrl(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit !== undefined && explicit.length > 0) return explicit;
  // A production build must be told which environment it talks to. Never default one in.
  if (APP_ENV === 'production') return undefined;
  return DEV_FALLBACK_API_BASE_URL;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `Spoon Partner${ENV_SUFFIX[APP_ENV]}`,
  slug: 'spoon-cook-app',
  scheme: 'spooncook',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['**/*'],
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: { backgroundColor: SPLASH_BACKGROUND },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'POST_NOTIFICATIONS',
      'INTERNET',
    ],
  },
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
  },
  plugins: [
    'expo-router',
    'expo-font',
    ['expo-splash-screen', { backgroundColor: SPLASH_BACKGROUND, resizeMode: 'contain' }],
    'expo-secure-store',
    [
      'expo-location',
      {
        // Hinglish, matching the app's UI language.
        locationWhenInUsePermission:
          'Spoon aapki location use karta hai taaki customer ko aapka pahauchne ka time pata chale.',
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    appEnv: APP_ENV,
    apiBaseUrl: resolveApiBaseUrl(),
    // eas.projectId intentionally absent — PENDING_FOUNDER.
  },
});
