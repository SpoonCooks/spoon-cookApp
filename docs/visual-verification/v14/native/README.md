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
