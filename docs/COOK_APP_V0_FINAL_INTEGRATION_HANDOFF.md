# Spoon V0 Cook App — Final Integration Handoff

**Date:** 2026-08-23
**Repository:** `D:\spoonCook-frontend` (frontend only — the backend was not modified)
**Backend authority:** `D:\spoon-backend` @ `a4d182e7f2f99e014f4e2287f904f89163a96730` (`main`)
**Primary contract reference:** `docs/COOK_APP_BACKEND_V0_FINAL_HANDOFF.md` + registered routes in
`src/api/routes/v1/index.ts` + runtime projections in `src/cooks/projections.ts`
**Figma:** canvas `434:2401` ("Cook App"), V12 — sections `434:3115` (Login, 5),
`485:4971` (Service, 12), `540:416` (Attendance, 8), `575:1741` (performance, 7)

This document supersedes the device/verification claims in
`COOK_APP_FIGMA_V12_BACKEND_AND_VISUAL_CLOSURE.md` and
`COOK_APP_PHASE_1_BACKEND_READINESS_AND_GAP_REPORT.md` where they conflict. Those files are
retained as history.

---

## 1. Starting state

Baseline on entry was **green**, contrary to what the older reports imply:

| Gate           | Baseline            | Now                     |
| -------------- | ------------------- | ----------------------- |
| `tsc --noEmit` | 0 errors            | 0 errors                |
| ESLint         | 0 problems          | 0 problems              |
| Prettier       | clean               | clean                   |
| Jest           | 226 tests/12 suites | **298 tests/16 suites** |
| Expo export    | ~3.9 MB             | 4.0 MB                  |

The prior session's fixes were verified as genuinely present and were **not** redone: the fake
Start/End OTP handlers are gone, fixtures are out of the production import graph, the GPS module
exists, leave uses `serverTime`, and the money screens read backend projections.

## 2. Contract verification performed

All **23** routes the app calls were confirmed **registered** in the backend router (not merely
present in `openapi.yaml`, which declares a generic `Ok` body for every cook route and therefore
proves nothing about response shapes):

`/auth/otp/send`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/cook/me`, `/cook/jobs`,
`/cook/jobs/current`, `/cook/jobs/:id`, `/cook/bookings/:id/start-commute`,
`/cook/bookings/:id/arrive`, `/cook/bookings/:id/verify-start-otp`,
`/cook/bookings/:id/verify-end-otp`, `/cook/location`, `/cook/bookings/:id/acknowledge-alert`,
`/cook/attendance/present`, `/cook/attendance`, `/cook/attendance/month`, `/cook/leaves` (GET+POST),
`/cook/earnings`, `/cook/earnings/cycles`, `/cook/earnings/cycles/:cycleId`, `/me/push-token`.

Error codes in `src/core/api/errors.ts` match `src/shared/errors/error-codes.ts` exactly (21 codes).
Service OTP length verified as **3** on both sides (`SERVICE_OTP_DIGITS = 3`, route pattern
`^[0-9]{3}$`, Figma three boxes).

## 3. Defects found and fixed this session

### 3.1 `Map dekhe` was a dead button — operational-gate navigation never existed (P0)

`CustomerBlock` rendered a `Map dekhe` button with **no `onPress` handler**. A comment asserted it
"targets the society GATE", but no `Linking` call existed anywhere in the codebase. The single most
important navigation product rule was documented and implemented by nothing.

Added `src/core/location/navigation.ts`:

- `gateNavigationUrl(gate, platform)` builds `geo:` (Android, chooser-friendly), `maps://` (iOS),
  and an https fallback — **from a `GateTarget` only**. There is no overload accepting an address,
  so a future edit cannot start routing to a flat.
- The Android form repeats the coordinate in `q=`, because without it many maps apps treat the
  label as free text and recentre on a different place with a similar name.
- `isNavigableGate` rejects null, NaN, out-of-range and `0,0` — a dropped coordinate must not send
  a cook to Null Island.
- `openGateNavigation` falls back to https when the scheme has no handler or `canOpenURL` throws
  (Android package visibility), and resolves `false` rather than failing silently.

The button is now wired, disabled when the gate is unusable, and surfaces an error if nothing opens.

This is a fulfilment-correctness issue, not only UX: routing to any point other than the gate means
the cook's own GPS can never satisfy the backend's 75 m arrival rule.

### 3.2 `destination.accessInstructions` was dropped on the floor

The backend projection returns `accessInstructions: string | null` (from
`booking_operational_snapshots.gate_access_instructions`). The frontend Zod schema omitted the
field, and because unknown keys are stripped, this failed silently — the backend sent gate entry
guidance and **no screen could ever display it**. Threaded through schema → `GateTarget` → adapter
→ `CustomerBlock`, rendered only when present.

### 3.3 Attendance re-derived eligibility the backend already owns

`/cook/me` returns five authoritative fields the frontend schema did not declare:
`canCheckIn`, `checkInOpensAt`, `shiftStartsAt`, `checkedInAt`, `reason`.

The screen instead computed `canMark = hasShiftToday && status === null`. That is wrong for a cook
with **approved leave today**: the local rule offered `Mark Present`, and the backend rejected the
tap with a 400. Now `canCheckIn` gates the button and `reason` selects the explanation copy.

### 3.4 The "30 mins pehle" rule was being asserted to cooks

The screen printed _"Shift se 30 mins pehle tak button dabaye"_. No such rule exists — the backend
has no approved opening window and returns `checkInOpensAt: null` (confirmed in the handoff and in
`CookOperationalProfile`). The app was stating a restriction the server does not enforce, which
would turn away cooks who are entitled to check in. The hint now renders **only** if the backend
publishes an actual window. A regression test asserts the copy is absent by default.

**`FIGMA_COPY_DRIFT: YES`** — Figma shows this copy; backend has no such rule. Backend wins.

### 3.5 `acknowledgeAlert` would have 400'd on every call from a notification

The route schema declares `assignmentVersion: { type: 'integer', minimum: 1 }` and the field is
**optional**. The frontend typed it as required and always sent it. Any caller without a loaded
projection (a notification tap) would have had to send a placeholder, and `0` is rejected by
Fastify before the handler runs. Made optional and omitted when absent, so the backend fences on
the current assignment itself.

### 3.6 Native Android build was broken by the splash configuration

`expo-splash-screen` unconditionally writes
`<item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>` into `styles.xml`,
but only generates that drawable when an `image` is configured. None was. Every native Android
build failed at resource linking:

```
error: resource drawable/splashscreen_logo (aka com.spoonhelp.cookapp.dev:drawable/splashscreen_logo) not found
```

**`expo export` cannot catch this** — it never links Android resources. This is precisely why
export is not acceptable as the only Android evidence.

Fixed by supplying a deliberately empty 1×1 transparent `assets/images/splash-icon.png`. The Figma
splash (`434:3330`) is the "Spoon Partner" wordmark on brand yellow, drawn in JS by
`app/index.tsx`; the native splash only has to hold the yellow until the bundle boots, so a
transparent icon is the correct content rather than invented artwork.

## 4. Notifications — newly connected

Previously **entirely unwired**: `registerPushToken` existed in the API layer with zero callers,
`expo-notifications` was an unused dependency, and there was no permission request, channel,
handler, or deep link.

Added `src/core/notifications/push.ts` (pure, testable) and `usePushNotifications.ts` (bound in
`_layout.tsx` behind a signed-in gate).

Payload contract taken from backend source, not invented:

| Dispatcher                  | `data` payload             |
| --------------------------- | -------------------------- |
| `notification-dispatch.ts`  | `{ bookingId, eventType }` |
| `alert-dispatch-service.ts` | `{ bookingId, alertKind }` |

- Nine cook `eventType` values parsed as a closed set; anything else is ignored.
- `move_alert` is deliberately **not** accepted as a push kind — it is acknowledgeable via the API
  but has no push dispatcher; listing it would imply a delivery path that does not exist.
- A notification never mutates booking state. It can only invalidate a query and open a screen;
  the screen then re-reads the projection. A forged push cannot move a booking.
- Terminal events (`cancelled`, `completed`, `reassigned`) deep-link to **Jobs**, not to a service
  screen that assumes an active assignment.
- **Acknowledgement fires on TAP, not on receipt.** A push that arrived while the phone sat in a
  pocket is not evidence the cook responded; filing it as such would corrupt a signal the
  escalation ladder reads. ACKNOWLEDGE IS NOT START TRAVEL — it changes no booking status.

## 5. Verified-correct, left alone

- **Auth/session:** single-flight refresh for N concurrent 401s (spending three refresh tokens
  would trip the backend's family-reuse revocation and log the cook out); `gateCookAccess` blocks
  unknown/inactive/suspended/rejected/pending cooks; restore re-validates against `/cook/me`.
- **START = START TRAVEL:** posts `start-commute` with `assignmentVersion`, navigates only after
  backend success, deletes the idempotency key on `ACTIVE_ASSIGNMENT_CHANGED` so a stale command is
  never replayed.
- **GPS:** starts only when the server reports `cook_en_route`; cadence comes from
  `nextReportAfterSeconds`; `arrived: true` stops the loop immediately; a <500 API error stops
  reporting rather than retrying; no coordinates are logged.
- **Arrival:** the frontend performs no distance or sample-count arithmetic. ETA reaching zero does
  not arrive. Manual `Mai pahuach gyi hu` calls the real `/arrive` and surfaces
  `ARRIVAL_PROXIMITY_NOT_CONFIRMED`.
- **OTP:** 3 digits, string-based, leading zeros preserved (`007` never becomes `7`), submit gated
  on exact length, errors come from the API response.
- **Timer:** reconstructed from `serverTime`/`expectedEnd`; survives navigation, background and
  restart; zero does not complete.
- **Earnings:** all 14 categories read from the backend; no local arithmetic anywhere; missing
  categories render `—`; paise formatted only at presentation.
- **Fixtures:** guarded by `__DEV__` _and_ absent from the import graph. `FixtureSwitcher` is
  orphaned. Both facts are now asserted by tests.

## 6. Flags

```
BACKEND_MODIFIED:                        NO
PRODUCTION_FIXTURE_PATHS_PRESENT:        NO
LOGIN_CONNECTED_REAL_API:                YES
JOBS_CONNECTED_REAL_API:                 YES
START_TRAVEL_CONNECTED:                  YES
GPS_UPLOAD_CONNECTED:                    YES
BACKGROUND_GPS_IMPLEMENTED:              NO
GPS_STOPS_AFTER_ARRIVAL:                 YES
FRONTEND_CALCULATES_AUTHORITATIVE_ARRIVAL: NO
OPERATIONAL_GATE_USED_FOR_NAVIGATION:    YES  (fixed this session)
START_OTP_CONNECTED:                     YES
START_OTP_SUPPORTS_LEADING_ZERO:         YES
SERVICE_TIMER_BACKEND_AUTHORITATIVE:     YES
EXTENSION_CONNECTED:                     YES (read/display only — cook cannot initiate)
END_OTP_CONNECTED:                       YES
END_OTP_SUPPORTS_LEADING_ZERO:           YES
ATTENDANCE_CONNECTED:                    YES
LEAVE_REQUEST_CONNECTED:                 YES
EARNINGS_BACKEND_AUTHORITATIVE:          YES
ALERT_ACK_CONNECTED:                     YES (fixed this session; fires on notification tap)
FCM_CODE_CONNECTED:                      YES (this session)
FCM_TOKEN_REGISTERED:                    NO  (no FCM identity in this build)
FCM_DEVICE_DELIVERY_VERIFIED:            NO
ANDROID_EMULATOR_VERIFIED:               YES (superseded by physical device — §7.2)
ANDROID_PHYSICAL_DEVICE_VERIFIED:        YES (iQOO I2403 / Android 16, unauthenticated scope)
IOS_DEVICE_VERIFIED:                     NO  (no macOS/Xcode available)
EAS_READY:                               NO  (EAS_PROJECT_ID_REQUIRED)
FIGMA_34_SCREEN_COVERAGE:                YES (32 in-section + 2 Jobs entry frames)
NATIVE_BUILD_REPRODUCIBLE:               YES (clean prebuild x2 + BUILD SUCCESSFUL, no manual edits)
USB_DEVICE_DETECTED:                     YES (Android)
APP_INSTALLED_ON_PHYSICAL_DEVICE:        YES
APP_LAUNCHED:                            YES (0 fatal exceptions)
OTP_SENT_TO_AUTHORIZED_TEST_NUMBER:      NO  (no approved test Cook exists)
AUTHENTICATED_E2E_COMPLETE:              NO
GPS_DEVICE_VERIFIED:                     NO  (behind authentication)
PUSH_DELIVERY_VERIFIED:                  NO  (no FCM identity in this build)
PIXEL_VERIFICATION_COMPLETE:             NO  (1 of 32 section screens reachable; see §7.4)
FIGMA_LEAVE_PLACEMENT_AMBIGUOUS:         YES
AUTHENTICATED_DEVICE_E2E_BLOCKED_BY_TEST_COOK: YES
```

## 7. Device verification

### 7.1 Durable NDK fix — `plugins/withAndroidNdkVersion.js`

**Root cause.** RN 0.86.2's `ReactCommon/react/renderer/core/graphicsConversions.h:71` calls
`std::format`. NDK **27.1.12297006** ships a libc++ without `<format>`, and that header is reached
via `ViewProps.h` -> `HostPlatformViewProps.h` -> `NativeDrawable.h`, so it breaks
`react-native-reanimated`, `react-native-worklets` **and** `expo-modules-core`.

`expo-root-project` defaults to exactly that version —
`ExpoRootProjectPlugin.kt`: `versionCatalogs.getVersionOrDefault("ndkVersion", "27.1.12297006")`.
A stock Expo SDK 57 / RN 0.86 Android build therefore cannot succeed here. Verified working NDK on
this machine: **27.2.12479018**.

**The lever.** That same line uses `extra.setIfNotExist("ndkVersion")`. `setIfNotExist` is an
explicit extension point: a value already present on `rootProject.ext` is kept. Every native module
then inherits it unaided, because each guards on the same property — `react-native-reanimated` and
`react-native-worklets` (both `build.gradle.kts`), `expo-modules-core`, `react-native-screens`,
`react-native-gesture-handler`, `react-native-svg`.

So the plugin writes one `ext { ndkVersion = "..." }` block **before**
`apply plugin: "expo-root-project"`. The previous session's
`subprojects { afterEvaluate { android { ... } } }` override is **gone** — it worked, but reached
into every Android subproject's extension after evaluation, which is broader than necessary and
would stamp over a module that sets its own NDK deliberately.

`expo-build-properties` is deliberately **not** used: its documented Android surface covers
`compileSdkVersion` / `targetSdkVersion` / `minSdkVersion` / `buildToolsVersion` — it does not
expose `ndkVersion`. There is no `eas.json` in this repo; if one is added, mirror
`ANDROID_NDK_VERSION` into its `android.ndk` field, and note that field does not govern a local
`expo run:android`.

**Reproducibility evidence.** `android/` was **deleted outright** first, so nothing could survive by
accident:

| Step                       | Result                                                       |
| -------------------------- | ------------------------------------------------------------ |
| `rm -rf android`           | removed                                                      |
| Clean prebuild #1          | block injected, correctly ordered before the Expo root apply |
| `android/app/build.gradle` | `ndkVersion rootProject.ext.ndkVersion` — no hand pin        |
| Clean prebuild #2          | marker count **1**, `ndkVersion =` count **1** -> idempotent |
| Ordering check             | pin at offset 842, apply at 874 -> correct                   |
| `./gradlew assembleDebug`  | **BUILD SUCCESSFUL in 9m52s**                                |
| Gradle's own report        | `[ExpoRootProject] ... ndk: 27.2.12479018`                   |

That last line is the proof: the value flowed through `setIfNotExist` into the Expo plugin's own
resolution, from a fully regenerated project with **zero manual edits**.

12 unit tests (`src/__tests__/androidNdkPlugin.test.ts`) cover ordering, idempotency across three
runs, version replacement, malformed input, and a missing anchor.

### 7.2 Physical device

|                      |                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Device               | vivo **iQOO I2403**, Android **16** (SDK 36), arm64-v8a                                                |
| Viewport             | 1080x2392 @ 440 dpi = **393 dp** wide — matches the 390 dp Figma frame                                 |
| Serial               | withheld from this document by policy                                                                  |
| APK                  | `app-debug.apk`, 228 MB (debug, built from the regenerated project)                                    |
| Install              | `Success`                                                                                              |
| Packages             | `com.spoonhelp.cookapp.dev` installs **alongside** `com.spoonhelp.userapp.dev` — no identity collision |
| Metro                | `adb reverse tcp:8081` only; the backend is public HTTPS and was **not** tunnelled                     |
| Bundle               | `Android Bundled 19270ms ... (1747 modules)`                                                           |
| Backend reachability | DNS resolves; 2/2 ICMP to `spoon-api-kalc.onrender.com`, ~11 ms                                        |

Verified on hardware:

| Check                    | Result                                                        |
| ------------------------ | ------------------------------------------------------------- |
| Cold launch -> route     | Boot restored the (absent) session and routed to Login        |
| Render                   | Livvic Black wordmark; safe areas correct under a real notch  |
| Keyboard                 | **numeric** keypad (vivo OEM IME)                             |
| Validation               | 5 digits -> `Next` disabled; 10 digits -> enabled (`#CFFF04`) |
| Keyboard dismissal       | BACK dismisses without leaving the screen                     |
| Background -> foreground | State preserved, **same PID** (no process death)              |
| Cold restart             | New PID, no stale session, `Next` correctly disabled again    |
| Fatal exceptions         | **0** across the entire session                               |

### 7.3 Not verified, and why

**No OTP was sent.** There is no approved test Cook (confirmed with the requester this session), so
`Next` was never pressed — it would fire a real MSG91 send to whatever number is in the field.
Everything behind authentication is therefore unreached on hardware: Jobs, START TRAVEL, GPS
permission and reporting, arrival, both OTPs, the service timer, extension, Attendance actions,
Performance, and push receipt.

`PUSH_DELIVERY_VERIFIED: NO` is independently blocked as well: the Cook App has no
`google-services.json` / FCM sender identity (PENDING_FOUNDER), so `getDevicePushToken` resolves
`unavailable` by design rather than registering a token.

### 7.4 Pixel comparison

Only one section screen is reachable unauthenticated: **Login (`434:3280`)**. The Figma authority
was read through the **local** Dev Mode MCP server on `127.0.0.1:3845` — the remote server refuses
this file with "you don't have edit access".

| Figma node                   | Screen             | Device state    | Element                                    | Figma                        | Device             | Status  |
| ---------------------------- | ------------------ | --------------- | ------------------------------------------ | ---------------------------- | ------------------ | ------- |
| 434:3280                     | Page 1 - Login No. | reached         | Hero photograph (top ~372 px of 830)       | present                      | **absent**         | FAIL    |
| 434:3280                     | "                  | "               | `spoon` wordmark logo (134x93, `434:3284`) | present                      | **absent**         | FAIL    |
| 434:3280                     | "                  | "               | Screen background                          | `#FFFFFF`                    | `#FFFDF5`          | FAIL    |
| 434:3280                     | "                  | "               | `Next` CTA fill                            | `#FFD600`                    | `#CFFF04`          | FAIL    |
| 434:3280                     | "                  | "               | Phone field                                | one 325x43 row, `+91` inside | two separate boxes | FAIL    |
| 434:3280                     | "                  | "               | "Partner" + subtitle                       | centred                      | left-aligned       | FAIL    |
| 434:3280                     | "                  | "               | Login / Phone no. daale labels             | left                         | left               | PASS    |
| 434:3280                     | "                  | "               | Terms footer copy                          | present                      | present            | PASS    |
| 434:3330                     | Page 0 - loading   | transient       | —                                          | captured                     | not isolatable     | n/a     |
| 434:3224 / 3174 / 3116       | OTP states         | **unreachable** | —                                          | —                            | —                  | BLOCKED |
| Service / Attendance / Perf. | 27 frames          | **unreachable** | —                                          | —                            | —                  | BLOCKED |

**These were NOT fixed, deliberately.** Two reasons:

1. The dominant elements — a hero photograph and the brand wordmark — are **assets that cannot be
   invented**. Downloading them needs `get_design_context` with an asset write path, and the Figma
   desktop app refuses until the target directory is added under _Dev Mode -> MCP panel -> Allowed
   directories_. That one-click user action is the only thing blocking it.
2. Recolouring the CTA and background without the hero would match **neither** design. A
   half-migration of the app's first screen is worse than a consistent current state.

**This is Login-specific, not a design-system error.** Sampled against Attendance `506:1986`: body
`#FFFDF5` equals the `cream` token and the banner `#ECFF9B` equals the `lime300` token — both
exactly right. Login is a marketing-style onboarding screen on white + brand yellow, while the
in-app screens are cream + lime, and the implementation has those correct.

This supersedes any earlier claim that the Login screens were pixel-verified.

## 8. Remaining gaps

**Frontend**

- Background location is not implemented and not build-configured (no `ACCESS_BACKGROUND_LOCATION`,
  no `UIBackgroundModes`, no `expo-task-manager`). Foreground reporting only. Not faked.
- `Call kare` is disabled. **Backend-blocked:** `GET /bookings/:id/cook-contact` is guarded by
  `requireCustomer` and gives the _customer_ the cook's number. No cook→customer contact route
  exists. Rendering an inert button was worse than a visibly unavailable one — a cook stuck at a
  gate will keep pressing it.
- `Extend booking` is disabled by design: extension is customer-initiated and payment-dependent;
  there is no cook-side extend command.
- Four Performance figures (worked duration, "above base", per-day base rate, mistake counts) have
  no field on any cook route and render `—` rather than being reconstructed.

**Backend / product**

- `checkInOpensAt` is always `null`. If a check-in window is ever intended, it needs a real
  eligibility contract; the frontend will render it automatically once non-null.
- `move_alert` is acknowledgeable but never push-dispatched.
- The Figma URL in the task brief names file `FLrHofaiOZtMn3F84yHEZa`, while `scope.ts` provenance
  records `DfnWJV2wQxSWfFb1QcBZpG` for the same canvas `434:2401`. Node ids match; the file key
  discrepancy is unresolved and worth confirming.

**Build/release**

- The NDK pin is now durable (`plugins/withAndroidNdkVersion.js`) and survives
  `expo prebuild --clean`. No manual `android/` edit is required any more.

- `EAS_PROJECT_ID_REQUIRED` — `extra.eas.projectId` intentionally absent (PENDING_FOUNDER).
- Cook App FCM sender identity / `google-services.json` absent (PENDING_FOUNDER). Until it lands,
  token acquisition resolves `unavailable` rather than crashing.

### Blockers surfaced by this run

| Blocker                                                | What unblocks it                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No approved test Cook                                  | Ops provisions a pre-provisioned, active/approved Cook on staging, with an assigned test booking, a safe test customer, and a test society that has a configured primary gate (DEC-076). Until then `Next` is never pressed and nothing behind Login is reachable. |
| Login hero photo + `spoon` wordmark cannot be exported | In Figma desktop: _Dev Mode -> MCP panel -> Allowed directories_ -> add `D:\spoonCook-frontend\assets\images`. Then `get_design_context` can write the assets and the Login screen can be brought to the V12 design.                                               |
| No FCM identity                                        | Cook App `google-services.json` / FCM sender (PENDING_FOUNDER).                                                                                                                                                                                                    |
| iOS                                                    | No macOS/Xcode on this host. When a Mac is available: `npx expo run:ios --device` using the tester's own Apple ID Personal Team.                                                                                                                                   |

## 9. Safety

```
BACKEND_MODIFIED:      NO
PRODUCTION_DATA_MUTATED: NO
REAL_PROVIDER_CALLS:   NO
COMMITTED:             NO
PUSHED:                NO
DEPLOYED:              NO
OTP_SENT:              NO
```

The backend repository was read only. Nothing was committed, pushed, deployed, or submitted to EAS.
