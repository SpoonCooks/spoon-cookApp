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

/**
 * The Android NDK this project builds against.
 *
 * RN 0.86.2 needs a libc++ providing `<format>` (`graphicsConversions.h` calls `std::format`).
 * NDK 27.1.12297006 — which `expo-root-project` defaults to — does not have it, and the build dies
 * inside reanimated/worklets/expo-modules-core. 27.2.12479018 does.
 *
 * Applied by `plugins/withAndroidNdkVersion.js` on every prebuild. Keep this and any `eas.json`
 * `android.ndk` value in step.
 */
const ANDROID_NDK_VERSION = '27.2.12479018';

/** Brand yellow. Figma `#ffd600` — the app icon's background. */
const BRAND_YELLOW = '#FFD600';

/**
 * The native splash background: the TOP of the boot gradient, not the brand yellow.
 *
 * `434:3330` fills the loading page with `#ffd600 -> #cfff04` at **70% over white**, which
 * resolves to `#FAE44C` at the top. `BootView` draws exactly that — its render measures
 * `#FBE54C` against the reference's `#FAE44C`, one level.
 *
 * The native splash is what the OS shows BEFORE that, and `_layout.tsx` holds it up with
 * `preventAutoHideAsync()` until the fonts resolve. Painting it brand yellow meant the boot
 * sequence went saturated `#FFD600` and then jumped to a soft lemon — 76 levels apart on blue,
 * which reads as a different screen rather than the same one loading.
 *
 * Android 12+ takes a single COLOUR here (`windowSplashScreenBackground`); it cannot render the
 * gradient itself. Matching the gradient's first row is therefore the closest the native frame
 * can get, and it makes the handoff continuous at the top edge instead of a colour flash.
 */
const SPLASH_BACKGROUND = '#FAE44C';

/** Deployed API used when no `EXPO_PUBLIC_API_BASE_URL` is supplied outside production. */
const DEV_FALLBACK_API_BASE_URL = 'https://spoon-api-kalc.onrender.com';

const BUNDLE_ID = `com.spoonhelp.cookapp${BUNDLE_SUFFIX[APP_ENV]}`;

/**
 * Firebase Android config, supplied by PATH and never committed.
 *
 * `expo-notifications` asks Firebase for the device token, and Firebase will only issue one to a
 * build that carries this file for its own package name. Without it `getDevicePushTokenAsync`
 * resolves `unavailable`, no token is ever registered, and every alert the backend sends comes
 * back `no_device` -- which is exactly what the database showed on 2026-09-02: twelve start
 * alerts, none delivered, not one cook reachable.
 *
 * Defaulted to the repo root rather than left required, because that is where the file lands and
 * a build that silently has no push is worse than one that finds it without being told. It is
 * gitignored: it names the Firebase project a build talks to, which is an environment decision,
 * and it carries the project's Android API key.
 */
const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

const BUILD_PROVENANCE_RELEASE_SHA =
  process.env.SPOON_RELEASE_SHA ?? process.env.GIT_COMMIT_SHA ?? 'unknown';
const BUILD_PROVENANCE_TIMESTAMP = process.env.SPOON_BUILD_TIMESTAMP ?? new Date().toISOString();

function runtimeVersionLabel(value: ExpoConfig['runtimeVersion']): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'not-configured';
  return JSON.stringify(value);
}

function buildProvenance(runtimeVersion: ExpoConfig['runtimeVersion']) {
  return {
    releaseSha: BUILD_PROVENANCE_RELEASE_SHA,
    buildTimestamp: BUILD_PROVENANCE_TIMESTAMP,
    environment: APP_ENV,
    apiBaseUrlLabel: process.env.SPOON_API_BASE_URL_LABEL ?? APP_ENV,
    expoRuntimeVersion: process.env.EXPO_RUNTIME_VERSION ?? runtimeVersionLabel(runtimeVersion),
    expoUpdateId: process.env.EXPO_UPDATE_ID ?? 'not-applicable',
  } as const;
}

function resolveApiBaseUrl(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit !== undefined && explicit.length > 0) return explicit;
  /*
   * A production build must be TOLD which environment it talks to, and must not build without it.
   *
   * This returned `undefined` and let the build carry on, which is a worse failure than the one
   * it was guarding against. The refusal to guess a backend is right; shipping an app that has no
   * backend at all is not. On 2026-09-04 a production cook build went out with no API base url,
   * and the only symptom on the handset was every request failing as
   * "Internet nahi mil raha. Connection check kare." on a phone with four bars of 4G -- a message
   * that sends whoever reads it to look at the one thing that is definitely fine.
   *
   * Throwing moves that from a runtime mystery on a cook's phone to a build that stops with the
   * name of the missing variable in it. The customer app has a `.env`; this app did not, and
   * nothing anywhere said so until a cook could not log in.
   */
  if (APP_ENV === 'production') {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is required for a production build. ' +
        'Set it in .env (see .env in the customer app) or export it before building. ' +
        'Without it the app builds with no backend and reports every request as offline.',
    );
  }
  return DEV_FALLBACK_API_BASE_URL;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `Spoon Partner${ENV_SUFFIX[APP_ENV]}`,
  slug: 'spoon-cook-app',
  scheme: 'spooncook',
  version: '0.1.0',
  /*
   * The app had no icon of any kind, so Android substituted its own green robot on the home
   * screen and in the tray. It then had the raw 4096px brand export, which fixed the robot and
   * introduced the next fault: that file carries the mark in its TOP HALF, 739px above the
   * canvas centre, so Android scaled the lot to 108dp and drew it high and oversized in the
   * tile. Generated by `../spoon-frontend/scripts/build-app-icons.py`, which centres on ink
   * rather than on canvas.
   */
  icon: './assets/images/app-icon.png',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['**/*'],
  android: {
    package: BUNDLE_ID,
    googleServicesFile: GOOGLE_SERVICES_JSON,
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: BRAND_YELLOW,
      // Themed icons: the launcher tints this by its own palette, so it is an alpha shape and
      // its colour is discarded. Absent, Android shrinks the full-colour icon into the themed
      // slot instead, which is the one place the mark looked pasted on.
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
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
    [
      'expo-splash-screen',
      {
        backgroundColor: SPLASH_BACKGROUND,
        /*
         * The native splash draws the SAME mark the Figma loading page does.
         *
         * `434:3330` is the spoon wordmark on the boot gradient, and `BootView` reproduces it
         * exactly — it scores 0.18% against the reference, the best of all 47 screens. But on a
         * release build nobody sees it: `BootScreen` restores the session and redirects in
         * milliseconds, so the gradient cross-fades straight into Login and the mark never lands.
         * What a cook actually looks at for the first second is this native frame, and it was
         * empty.
         *
         * `spoon-brand-logo.png` is the asset `BootView` itself renders, so this is the design's
         * own artwork rather than something invented for the splash.
         *
         * `imageWidth` is **288**, which is the largest the generated drawable can hold. The
         * generator rasterises into a fixed canvas — 1152px at xxxhdpi, i.e. 288dp — and anything
         * wider is CROPPED rather than scaled: at 393dp (the 370-unit box `BootView` gives the
         * mark) the fork handle lost its top and the wordmark ran off the right edge, taking the
         * ink's aspect from 1.309 to 1.504. At 288 the whole mark fits with its aspect intact.
         *
         * Two things Android will not do, and they are limits of the platform rather than
         * choices:
         *
         *   - `windowSplashScreenBackground` takes a COLOUR, so the native frame cannot carry the
         *     gradient. It gets the gradient's first row (see `SPLASH_BACKGROUND`), which makes
         *     the handoff continuous at the top edge.
         *   - The icon is CENTRED, and its canvas is capped. The design pins the mark's ink centre
         *     at 42% of the viewport height and draws 258dp of ink; the 288dp canvas holds 189dp
         *     of ink at 50%. Both are the platform's limits, not choices — a larger box crops.
         *
         * So the native frame is the design's mark, in the design's colour, at 73% of the design's
         * size. The full-size mark on the full gradient is `BootView`, one frame later.
         *
         * The image must never be removed: `expo-splash-screen` always writes
         * `windowSplashScreenAnimatedIcon` into `styles.xml`, and without a drawable to point at
         * the Android build fails resource linking with
         * `error: resource drawable/splashscreen_logo not found` — a break `expo export` cannot
         * surface, because export never links Android resources.
         */
        image: './assets/images/figma-v13/spoon-brand-logo.png',
        imageWidth: 288,
        resizeMode: 'contain',
      },
    ],
    'expo-secure-store',
    [
      'expo-location',
      {
        // Hinglish, matching the app's UI language.
        locationWhenInUsePermission:
          'Spoon aapki location use karta hai taaki customer ko aapka pahauchne ka time pata chale.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    // The native notification module, the Android channel and the POST_NOTIFICATIONS prompt.
    // Remote delivery also needs `google-services.json`, wired above as of 2026-09-02 -- the
    // founder registered com.spoonhelp.cookapp in Firebase project august-dev-3b4bf. Before that
    // it was PENDING_FOUNDER and token acquisition resolved `unavailable` rather than crashing.
    /*
     * The icon matters as much as the module. Android draws a notification icon as an alpha
     * silhouette — colour is discarded and the shape is filled with the accent below — so
     * without one it falls back to its own default mark, which is what was appearing in the
     * tray instead of Spoon.
     */
    [
      'expo-notifications',
      {
        /*
         * The MONOCHROME mark, not the brand export. Android keeps only the alpha of a
         * notification icon and fills it with the accent below, so a full-colour logo -- which
         * is what this was -- arrives as a solid blob. This file is white-on-transparent for
         * exactly that reason.
         */
        icon: './assets/images/android-icon-monochrome.png',
        color: BRAND_YELLOW,
      },
    ],
    // Must stay in the list: `android/` is gitignored and regenerated, so this is the only thing
    // that survives `expo prebuild --clean`.
    './plugins/withGradleHeap',
    ['./plugins/withAndroidNdkVersion', { ndkVersion: ANDROID_NDK_VERSION }],
    './plugins/withStagingSigning',
  ],
  experiments: { typedRoutes: true },
  extra: {
    ...config.extra,
    appEnv: APP_ENV,
    apiBaseUrl: resolveApiBaseUrl(),
    buildProvenance: buildProvenance(config.runtimeVersion),
    androidPackage: BUNDLE_ID,
    // eas.projectId intentionally absent — PENDING_FOUNDER.
  },
});
