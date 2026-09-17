# Spoon Partner — Cook App

React Native (Expo SDK 57, expo-router) app for Spoon's cooks. Hinglish UI throughout.

## Prerequisites

Four things, and the build fails unhelpfully without any of them.

| Requirement                                 | Why                                                                                                                                      | How                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Node 22+**                                | Metro and the Expo CLI                                                                                                                   | `node -v`                                                                                                                       |
| **JDK 17**                                  | Android Gradle Plugin 8.x. Other majors fail with unrelated-looking errors                                                               | `brew install openjdk@17` then export `JAVA_HOME=/opt/homebrew/opt/openjdk@17`                                                  |
| **Android SDK + NDK `27.2.12479018`**       | Native modules compile from source. The NDK is ~1GB and downloads on first build                                                         | Android Studio, or `sdkmanager`. Set `ANDROID_HOME=~/Library/Android/sdk`                                                       |
| **`google-services.json`** at the repo root | Firebase issues a push token only to a build carrying this file **for its own package name**. `expo prebuild` aborts outright without it | Firebase console → the Cook App's Android app → download. Gitignored on purpose: it names an environment and carries an API key |

Without `google-services.json`, prebuild stops with:

```
Error: [android.dangerous]: withAndroidDangerousBaseMod: Cannot copy google-services.json
```

A placeholder gets you a build, but `getDevicePushTokenAsync` then resolves `unavailable`, no token is registered, and every alert the backend sends comes back `no_device`. The app logs `[spoon-push] not registered (unavailable)` at startup when this happens — if you see that line, this is why.

## Setup

```sh
npm install
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=$HOME/Library/Android/sdk
```

## Running on a device

**Expo Go does not work and cannot be made to work.** The app uses `expo-notifications` push, `expo-location` background tracking and `expo-task-manager`; Expo Go dropped remote push at SDK 53 and cannot host custom native code. Launching there fails with `Cannot read property 'ErrorBoundary' of undefined`.

Build the native app once, then iterate over Metro exactly as you would with Expo Go:

```sh
# once (~10-25 min the first time, ~30s incrementally)
EXPO_PUBLIC_API_BASE_URL=<backend> npm run android:debug
npm run android:install

# every day after that
adb reverse tcp:8081 tcp:8081
npm start
```

A JS change reloads in seconds. You only rebuild when a **native** dependency changes.

`android:debug` pins `arm64-v8a`, which is what a modern test handset needs. The default builds four architectures and takes roughly four times as long.

### The backend a build talks to is fixed at BUILD time

This catches people out, so it is worth stating plainly.

`extra.apiBaseUrl` is resolved when `app.config.ts` is evaluated — during the native build. **Setting `EXPO_PUBLIC_API_BASE_URL` when Metro starts does nothing.** A handset keeps whatever backend it was built against.

The dangerous direction is silent: point a local build at a mock, watch the mock's log stay empty, and every request is still reaching the deployed backend. To change backends, rebuild.

The app prints the resolved URL at startup outside production:

```
[spoon-build-provenance] { releaseSha: '3d112bd…', environment: 'development', apiBaseUrl: 'http://127.0.0.1:9099' }
```

Check that line before you trust where your traffic is going.

## Releasing

```sh
npm run android:bundle     # the Play artifact: an AAB, every ABI
npm run android:release    # an APK for a handset, arm64 only — faster, NOT for Play
```

`android:bundle` produces `android/app/build/outputs/bundle/release/app-release.aab`, which is
what Play accepts for a new app; it splits per device itself, so a second architecture costs
nothing at download.

It builds `arm64-v8a,armeabi-v7a` — the two architectures real phones use. `x86` and `x86_64` are
emulators, and including them cost 16 minutes and ran a 228 GB disk out of space before the build
reached the bundle step. `armeabi-v7a` is the one that matters: without it every 32-bit handset is
excluded, which is a real slice of entry-level Android in India.

`android:release` stays pinned to `arm64-v8a` alone because it exists to get a build onto a test
handset quickly — it excludes 32-bit phones and must not be shipped.

Both print which key signed them. Anything that says `ANDROID DEBUG KEY` cannot be uploaded:

```
[spoon-signing] release signed with the PLAY UPLOAD key: /Users/…/spoon-cook-upload.jks
```

The upload key lives OUTSIDE this repo — `SPOON_UPLOAD_STORE_FILE` and its three companions are
read from `~/.gradle/gradle.properties`. **Back up both the `.jks` and those values.** Google
re-signs with the app signing key it holds; this one only proves the upload came from us, and
losing it means going through Play's upload-key reset.

`versionCode` defaults to the build date times ten (`202609170`), so it rises on its own. For a
second upload on the same day set `SPOON_VERSION_CODE=202609171`.

## Verifying

```sh
npm run verify   # typecheck + lint (zero warnings) + jest
```

## The dev gallery

Every finalized Figma screen is reachable without a backend or a login:

```sh
adb shell am start -a android.intent.action.VIEW \
  -d "spooncook://dev" com.spoonhelp.cookapp.dev
```

Individual states deep-link as `spooncook://dev/<state>`, e.g. `service/start-otp`. The index reports real coverage — a screen with no gallery entry shows as `not implemented` rather than being hidden. Release builds exclude all of it via `__DEV__`.

## Package names

| Env         | Package                         | Display name            |
| ----------- | ------------------------------- | ----------------------- |
| development | `com.spoonhelp.cookapp.dev`     | Spoon Partner (Dev)     |
| staging     | `com.spoonhelp.cookapp.staging` | Spoon Partner (Staging) |
| production  | `com.spoonhelp.cookapp`         | Spoon Partner           |

Set with `APP_ENV`. These must never collide with the Customer App's identity — sharing either would collide in the stores, in EAS and in FCM token routing.

## Signing in

Cooks cannot self-register; Ops provisions every account. For staging, the backend supports a closed allowlist of test numbers with a fixed OTP instead of an SMS — see `TEST_COOK_AUTH_ENABLED`, `TEST_COOK_PHONE_1..4` and `TEST_COOK_LOGIN_OTP` in the backend's environment, and `scripts/seed-test-cooks.ts` to create the accounts and their shifts.
