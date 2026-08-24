// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Expo's default Metro config, made explicit.
 *
 * Without this file the dev server serves `/index.bundle` — the URL the debug APK asks for — as a
 * literal request for `./index` at the project root, which does not exist: this app's entry is the
 * `main` field, `expo-router/entry`. The bundle then 404s and the app sits on its splash screen
 * with `Unable to load script`, which is how a capture run silently produced four splash-screen
 * PNGs instead of four screens. `getDefaultConfig` installs the `server.rewriteRequestUrl` hook
 * that maps `/index.bundle` onto the real entry point.
 */
module.exports = getDefaultConfig(__dirname);
