# Native cold-launch gate — the seventh row, closed

The V14 closure report recorded the native durability gate at **six of seven**. The missing row was
`Cold launch to JS`: the freshly prebuilt APK sat on the splash with zero `ReactNativeJS` lines and
zero exceptions, through four warm-up attempts. It was recorded as "environment and wiring
failure", most likely the dev-server preference lost to `prebuild --clean`.

**That diagnosis was wrong, and the wiring was never broken.** The app finds Metro correctly with
no stored preference at all — there are no `shared_prefs` on the device, and none are needed: this
is a plain RN debug build (no `expo-dev-client`), so `AndroidInfoHelpers` resolves the stock
emulator's `10.0.2.2:8081` by itself.

The actual cause is in this log sequence, from the cold launch captured here:

```
19:21:13.952  ReactHost{0}.isMetroRunning()
19:22:04.583  ReactHost{0}.isMetroRunning(): Async result = true      <- 50 s just to answer
19:22:04.586  ReactHost{0}.loadJSBundleFromMetro()
19:27:03.356  ReactHost{0}.loadJSBundleFromMetro(): Creating BundleLoader
19:27:09.962  ReactNativeJS: Running "main" with {"rootTag":1,...}    <- ~5 min after launch
```

The app reached Metro on the first attempt. `prebuild --clean` also clears Metro's transform cache,
and the first `expo-router` bundle build in this environment takes **about five minutes** — the
same environment whose file watcher does not work (report §10.4). Every warm-up attempt in the
previous run was cancelled before that transform finished, and each restart re-queued it.

The fix is patience, not configuration. Nothing in `android/`, `app.json` or the dev-server
preference was changed to close this gate.

## Result — 7 of 7

| Step                     | Evidence                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| Cold launch reaches JS   | `ReactNativeJS: Running "main"`, pid **13153**, ~5 min after `am start`  |
| Splash exits             | `SplashScreenView` built then replaced by content                        |
| Login renders            | `cold-launch-login.png`                                                  |
| Background / foreground  | HOME to launcher, resume -> **same pid 13153**, `resume-login.png`       |
| Process restart          | `force-stop` 13153 -> new pid **13514**, `restart-login.png`             |
| Restart reaches Login    | `restart-login.png` is pixel-identical to `cold-launch-login.png` below the status bar (0.0000% differing); only the clock differs |
| Fatal exceptions         | **0** across cold launch, resume and restart                            |
| ANRs                     | **0**                                                                    |

## Operating note for any later run

A cold bundle build here costs minutes, not seconds. Poll for `ReactNativeJS` for at least six
minutes before concluding a launch has failed, and do not issue a competing bundle request against
the same Metro while waiting — it doubles the transform work and was what stretched the capture
above from roughly three minutes to five.

---

## The final gate, re-run on a clean prebuild

Everything above was measured on the binary the previous session had left installed. The gate was
then re-run end to end at the close of the run, on a binary built from `expo prebuild --clean`, so
nothing here rests on a build that predates the fixes.

| Step                    | Result                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `expo prebuild --clean` | clean; `android/` regenerated from scratch                             |
| NDK pin survives it     | **yes** - `ndkVersion = "27.2.12479018"` exactly **once**, line 30, **before** `apply plugin: "expo-root-project"` at line 33 |
| Splash drawable         | generated (`drawable-*/splashscreen_logo.png`)                          |
| Native build            | **BUILD SUCCESSFUL in 5m 52s**, JDK 21.0.9                              |
| APK install             | `Success`                                                               |
| Cold launch to JS       | pid **22302**, `ReactNativeJS: Running "main"` 440 s after `am start`   |
| Login renders           | `final-cold-launch-login.png` - **0.0000%** different from `cold-launch-login.png` below the status bar |
| Background / foreground | HOME to launcher, resume, **same pid 22302** (`final-resume-login.png`) |
| Process restart         | `force-stop` 22302 -> new pid **22603**, JS in 140 s, Login again at 0.0000% (`final-restart-login.png`) |
| Fatal exceptions        | **0**                                                                   |

The slowness is not a one-off. On this cold launch `isMetroRunning()` alone took **7.5 minutes** to
answer:

```
07:28:17.370  ReactHost{0}.isMetroRunning()
07:35:54.986  ReactHost{0}.isMetroRunning(): Async result = true
07:35:54.995  ReactHost{0}.loadJSBundleFromMetro()
07:36:33.694  ReactHost{0}.loadJSBundleFromMetro(): Creating BundleLoader
07:36:46.139  ReactNativeJS: Running "main" with {"rootTag":1,...}
```

### Two things recorded rather than smoothed over

**One ANR occurred**, on the very first launch `expo run:android` performed itself:

```
ANR in com.spoonhelp.cookapp.dev
PID: 22118
Reason: Process ProcessRecord{...} failed to complete startup
```

That is the same slow-bundle symptom - the process exceeded the startup window while waiting on
Metro - and it did not recur on the cold launch, resume or restart that followed. Zero fatal
exceptions throughout.

**`expo run:android` builds one ABI, not four.** It passes `-PreactNativeArchitectures=x86_64` for
the attached emulator, so the APK that was installed and launched contains only `lib/x86_64/`. That
is the correct binary for this emulator and it is the one every gate above was measured on, but it
is a narrower build than the four-ABI `assembleDebug` the previous run recorded.

A full `assembleDebug` was therefore run separately, on the same clean prebuild:

```
BUILD SUCCESSFUL in 8m 5s
374 actionable tasks: 71 executed, 303 up-to-date

lib/arm64-v8a/  lib/armeabi-v7a/  lib/x86/  lib/x86_64/
```

### Environment prerequisites this session had to supply

Neither is a project defect; both will bite the next run that does a clean prebuild.

- **`ANDROID_HOME` is not set in this shell**, and `local.properties` does not survive
  `prebuild --clean`. A bare `expo run:android` fails with
  `SDK location not found` until `ANDROID_HOME` is exported.
- **The default `java` on PATH is 1.8** and cannot build this project. `JAVA_HOME` must point at a
  JDK 21; Android Studio's bundled JBR (21.0.9) is the one used here.

## Operating note for any later run

A cold bundle build here costs minutes, not seconds. Poll for `ReactNativeJS` for at least **eight**
minutes before concluding a launch has failed, and do not issue a competing bundle request against
the same Metro while waiting - it doubles the transform work.
