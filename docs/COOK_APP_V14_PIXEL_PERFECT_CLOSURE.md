# Cook App - V14 closure report

Status: **47 of 47 implemented, rendered, compared and pixel-verified. 0 open.**

The section closes. It closed because two of the three things still being measured were errors in
the **harness**, not the app: the reference crop was starting one row below the frame on every
direct render, and it was calling a 371-wide frame the 370-unit content column, which stretched the
render vertically by two units over the screen. Between them they carried most of the residual on
42 of the 47 screens.

Five real application defects were found underneath them. Every one renders perfectly well while it
is wrong, which is why no test caught any of them.

## 1. Starting state

|               |                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------- |
| Branch        | `v13-pixel-perfect` - the branch the work is on; no `v14-` branch exists                    |
| HEAD at start | `baa1125`                                                                                   |
| Worktree      | clean, verified before any edit; all ten preceding commits intact                           |
| Emulator      | `Ref393GA`, 1080x2392 @ 440dpi, headless; statusBars 136px, navigationBars 66px (`dumpsys`) |
| Figma         | `3iYf9ckrUDZLPlJP56dyKI`, page `Cook App` (`434:2401`), 7 sections, 47 screens              |

Nothing was reset, stashed or discarded.

## 2. The native gate - the seventh row, closed

The previous run recorded the native gate at six of seven and left `Cold launch to JS` unverified:
the freshly prebuilt APK sat on the splash with zero `ReactNativeJS` lines through four warm-up
attempts, and that was put down to a dev-server preference lost to `prebuild --clean`.

**That diagnosis was wrong, and the wiring was never broken.** The app's own log shows it reaching
Metro on the first attempt, with no stored preference and none needed - there are no `shared_prefs`
on the device at all, and this is a plain RN debug build, so `AndroidInfoHelpers` resolves the stock
emulator's `10.0.2.2:8081` by itself:

```
19:21:13.952  ReactHost{0}.isMetroRunning()
19:22:04.583  ReactHost{0}.isMetroRunning(): Async result = true      <- 50 s just to answer
19:22:04.586  ReactHost{0}.loadJSBundleFromMetro()
19:27:03.356  ReactHost{0}.loadJSBundleFromMetro(): Creating BundleLoader
19:27:09.962  ReactNativeJS: Running "main" with {"rootTag":1,...}    <- ~5 min after launch
```

`prebuild --clean` clears Metro's transform cache too, and the first `expo-router` bundle in this
environment takes minutes, not seconds. Every warm-up attempt was cancelled before it finished, and
each restart re-queued the work. The fix was patience. **Nothing in `android/`, `app.json` or the
dev-server preference was changed to close this row.**

The final gate re-ran the whole sequence on a binary built from a clean prebuild, and the same
slowness is visible there: `isMetroRunning()` alone took **7.5 minutes** to answer on one cold
launch. Full evidence and screenshots: `docs/visual-verification/v14/native/`.

## 3. The harness was cropping the wrong rectangle, twice

### 3.1 The vertical margin is not centred

`viewport.py` located a direct frame inside its own render by centring the effect-bounds margin on
both axes. Horizontally that is right and was measured. **Vertically it is not.** A direct frame's
only shadowed full-width element is the bottom nav, flush with the frame's bottom edge, so its blur
spills past the frame on the left, the right and the bottom - and nowhere near the top. The status
mock carries no effect, and the Help pill's `0 0 2` sits six units inside the frame.

Settled by the design's own `bottom nav ... py 8`, which puts the 52-unit cell grid exactly 8 units
above the frame's bottom edge. Measuring `height - (cell_bottom + 8)` over every direct frame in the
inventory that carries a nav:

| margin           | frames measuring 1 | frames measuring 0 |
| ---------------- | -----------------: | -----------------: |
| centred (before) |             **27** |                  0 |
| top (after)      |                  0 |             **27** |

Five sections, and render excesses of 0.8, 1.0, 1.6, 1.94, 2.0 and 2.95 - not a number a
coincidence produces twenty-seven times. The Help pill agrees independently, from the other end of
the frame: at the corrected origin it lands on row 6, which is what `banner py 6` states and what
the app draws.

`alignment.py` now measures the reference's first ink at exactly **6.00** design units on every nav
frame, and the worst first-ink delta over all 47 screens fell from **1.38** design units to **0.38**.

The previous run read the +0.2..+0.8 unit deltas as evidence _for_ the centred margin. They were
evidence against it: applying it moved the measured deltas to +1.17..+1.38 rather than to zero.

### 3.2 A 371-wide frame is not a 371-unit column

`leave`, `Service flow` and `Info` are authored on 371-wide frames, and the extra unit is empty
bleed on the right: all six `Info` frames put their CTA at x **20..350**, which is `370 - 2x20`
measured from the frame's left edge, not `371 - 20 - 21`. The content is left-anchored on a 370 grid
and the frame runs one unit past it.

Reading the whole 371 as the column scaled the emulator's 370-unit render **up** by 371/370 to match
it - and that stretch landed on the vertical axis too, resampling 750 units of app content into 752
rows. On the five bottom-anchored rule sheets, which are compared by their last row, it made the
app's 643-unit sheet measure 645 and walked every element above the CTA two units up the screen. The
sheet is `s(643)` in the app and `h 643` in the design; both of those units were the comparison's
own.

Correcting it closed all three open policy sheets without touching the app, and took about four
points off each Service timer.

**`CONTENT_WIDTH_DP` stays 370.** The previous run's refutation of the /371 hypothesis stands and was
not reopened; this is the reference side of the same number, not the app's divisor.

## 4. Five defects in the application

Each is in production code.

| #   | Defect                                                                                                                                                                                                                           | Evidence                                                                                                                                                                                                            | Scope                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | **Durations under an hour drew `0.5 hrs` and `0.8 hrs`**                                                                                                                                                                         | Every `job flow` frame writes `30 mins` and `45 mins` in its own chips                                                                                                                                              | 5 frames, **production**       |
| 2   | **The 2-unit strokes in `leave` and `job flow` are OUTSIDE, not centre**                                                                                                                                                         | The break cell paints **112x44** over a 108.67x40 grid frame; the day rows **72** tall leaving **8** clear units of a 12-unit gap; `Dates chunein` **51** on 47. Drawn centre: 110x41, 70 in an 11-unit gap, and 49 | 11 frames, **production**      |
| 3   | **The money tile pair is not symmetrical**                                                                                                                                                                                       | `540:281` is **113** and `540:292` **109.77**, in a 113-unit row. The references paint 113 and 109; the app drew both at its own content height of 108                                                              | 3 frames, **production**       |
| 4   | **`Frame 59` groups the tiles with the amount chips at 10, not the card's 16**, and the `Base`/`Bonus`/`Tip` cells measure an **outside** stroke - `540:326` is a 56-unit frame painting 60 of ink, which the app laid out at 60 | Canvas dump `540:276`, confirmed on all three references                                                                                                                                                            | 3 and 7 frames, **production** |
| 5   | **`622:801`'s art is pinned to the top of its box, not centred**, and **`622:913`'s cancelled banner lost its 6-unit gap and centred a caption the frame puts at y=14**                                                          | Aligning the two renders needs the art moved 18 units down (24.5% -> 8.3%); the cancel CTA sat six units high behind a passing 8.82                                                                                 | 2 frames, **production**       |

Three of these were **pairs of errors that cancelled**, which is why earlier runs could not see them
and why one earlier fix measured worse and was correctly reverted:

- Sixteen units above a 108-unit tile lands the amount chips on the same row as ten above a 113.
  Correcting the height alone moves them off it - which is exactly what the previous run measured.
- On `622:913`, `0 + 21` lands the caption within a unit of the design's `6 + 14`, so the headline
  looked right while the box's own bottom slack fell from 28 to 21 and took the whole CTA with it.
  The residual stayed under the rule throughout; only the displacement probe showed it.

## 5. Where the 47 stand

The rule is unchanged and was not moved: **PASS** at a tolerance-40 residual <= 10% with measured
top alignment within 2 design units. `rule_verdicts.py` derives every verdict from the artefacts on
disk; no verdict is asserted by hand.

| Node ID    | Section      | Screen               | Impl | Rendered | t12 % | t40 % | probe | align | unmatched | unseen ink | Result   |
| ---------- | ------------ | -------------------- | ---- | -------- | ----: | ----: | ----: | ----: | --------: | ---------: | -------- |
| `434:3116` | Login flow   | Page 2c- OTP wrong   | yes  | yes      |  2.32 |  1.20 |    +0 |   n/a |         0 |          0 | **PASS** |
| `434:3174` | Login flow   | Page 2b- OTP resend  | yes  | yes      |  1.96 |  0.88 |    +0 |   n/a |         0 |          0 | **PASS** |
| `434:3224` | Login flow   | Page 2a- Login OTP   | yes  | yes      |  2.15 |  1.17 |    +0 |   n/a |         0 |          0 | **PASS** |
| `434:3280` | Login flow   | Page 1- Login No.    | yes  | yes      |  4.80 |  1.68 |    +0 |   n/a |        17 |         12 | **PASS** |
| `434:3330` | Login flow   | Page 0- loading page | yes  | yes      |  0.55 |  0.18 |    +0 |   n/a |        17 |         12 | **PASS** |
| `575:2135` | log in flow  | 3a- daily log in     | yes  | yes      |  5.40 |  4.09 |    +0 | -0.18 |         0 |          0 | **PASS** |
| `575:2136` | log in flow  | 3d- log out          | yes  | yes      |  5.08 |  1.87 |    +0 | -0.18 |        39 |          1 | **PASS** |
| `575:2137` | log in flow  | 3b- present          | yes  | yes      |  5.17 |  3.96 |    +0 | -0.18 |        39 |          1 | **PASS** |
| `575:2138` | log in flow  | 3c- absent           | yes  | yes      |  4.04 |  2.84 |    +0 | -0.18 |         0 |          0 | **PASS** |
| `592:1008` | leave        | long leave confirm   | yes  | yes      |  9.35 |  6.43 |    +0 | +0.38 |       164 |          1 | **PASS** |
| `592:488`  | leave        | Leave present        | yes  | yes      | 11.07 |  7.70 |    +0 | +0.38 |        28 |          1 | **PASS** |
| `592:489`  | leave        | Leave absent         | yes  | yes      |  8.05 |  6.73 |    +0 | +0.38 |         0 |          0 | **PASS** |
| `592:563`  | leave        | long leave           | yes  | yes      |  7.22 |  4.21 |    -1 | +0.20 |        96 |          1 | **PASS** |
| `592:639`  | leave        | long leave selected  | yes  | yes      |  7.77 |  5.73 |    -1 | +0.20 |        96 |          1 | **PASS** |
| `592:832`  | leave        | long leave confirm   | yes  | yes      |  8.25 |  6.88 |    +0 | +0.38 |         0 |          0 | **PASS** |
| `592:888`  | leave        | short leave          | yes  | yes      |  5.11 |  4.08 |    +0 | +0.20 |        96 |          1 | **PASS** |
| `575:1744` | performance  | 12- money daily      | yes  | yes      |  7.70 |  4.68 |    +0 | +0.21 |         0 |          0 | **PASS** |
| `575:1884` | performance  | 13- money weekly     | yes  | yes      | 10.31 |  7.36 |    +1 | +0.21 |         0 |          0 | **PASS** |
| `575:1903` | performance  | 14- day history      | yes  | yes      |  8.97 |  7.34 |    -1 | +0.23 |         0 |          0 | **PASS** |
| `575:1922` | performance  | 15- past daily       | yes  | yes      |  7.78 |  5.33 |    +0 | +0.22 |         0 |          0 | **PASS** |
| `575:2013` | performance  | 16- money monthly    | yes  | yes      |  8.07 |  5.45 |    +0 | +0.21 |         0 |          0 | **PASS** |
| `575:2032` | performance  | 17- weekly history   | yes  | yes      |  9.17 |  5.90 |    +1 | +0.23 |         0 |          0 | **PASS** |
| `575:2098` | performance  | 18- past weekly      | yes  | yes      |  9.22 |  6.29 |    +1 | +0.22 |         0 |          0 | **PASS** |
| `583:375`  | job flow     | 4a- jobs log out     | yes  | yes      |  8.04 |  5.97 |    +0 | +0.17 |         0 |          0 | **PASS** |
| `583:401`  | job flow     | 4b- job log in       | yes  | yes      |  9.35 |  7.50 |    +0 | +0.17 |         0 |          0 | **PASS** |
| `583:427`  | job flow     | 4c- next in <45 mins | yes  | yes      | 10.34 |  8.69 |    +1 | +0.17 |         0 |          0 | **PASS** |
| `583:453`  | job flow     | 4d- next <10 mins    | yes  | yes      | 10.36 |  8.71 |    +1 | +0.17 |         0 |          0 | **PASS** |
| `583:479`  | job flow     | 4e- next <5 mins     | yes  | yes      | 10.34 |  8.67 |    +1 | +0.17 |         0 |          0 | **PASS** |
| `614:453`  | Service flow | travel- on time      | yes  | yes      |  5.99 |  4.60 |    +0 | +0.18 |         0 |          0 | **PASS** |
| `622:1036` | Service flow | timer (hr + mins)    | yes  | yes      |  8.11 |  3.56 |    +1 | +0.18 |        63 |          0 | **PASS** |
| `622:1085` | Service flow | timer (mins)         | yes  | yes      |  8.11 |  3.67 |    +1 | +0.18 |        63 |          0 | **PASS** |
| `622:1125` | Service flow | timer (<7 mins)      | yes  | yes      |  6.96 |  3.83 |    +0 | +0.18 |        63 |          0 | **PASS** |
| `622:1163` | Service flow | timer- extension     | yes  | yes      |  8.51 |  4.42 |    +1 | +0.18 |         0 |          0 | **PASS** |
| `622:530`  | Service flow | travel- late         | yes  | yes      |  6.16 |  4.89 |    +0 | +0.18 |         0 |          0 | **PASS** |
| `622:597`  | Service flow | travel- edge         | yes  | yes      |  5.87 |  4.63 |    +0 | +0.18 |         0 |          0 | **PASS** |
| `622:664`  | Service flow | arrival- on time     | yes  | yes      |  6.65 |  4.85 |    +0 | +0.18 |        36 |          0 | **PASS** |
| `622:733`  | Service flow | arrival- late        | yes  | yes      |  8.44 |  6.26 |    +0 | +0.18 |        36 |          0 | **PASS** |
| `622:801`  | Service flow | Start otp            | yes  | yes      |  9.40 |  6.63 |    +0 | +0.18 |         0 |          0 | **PASS** |
| `622:913`  | Service flow | travel- cancel       | yes  | yes      |  5.63 |  4.12 |    +0 | +0.18 |        19 |          0 | **PASS** |
| `628:1249` | Service flow | end otp              | yes  | yes      |  4.32 |  2.09 |    +0 | +0.18 |         0 |          0 | **PASS** |
| `628:1293` | Service flow | End                  | yes  | yes      |  7.61 |  5.18 |    +1 | +0.18 |        64 |          0 | **PASS** |
| `597:1131` | Info         | long leave confirm   | yes  | yes      |  7.17 |  4.95 |    +0 | +0.18 |         0 |          0 | **PASS** |
| `597:1221` | Info         | rating tiers         | yes  | yes      |  8.99 |  6.80 |    -1 | +0.20 |        96 |          1 | **PASS** |
| `603:1865` | Info         | No Show              | yes  | yes      | 10.06 |  7.43 |    -1 | +0.20 |        96 |          1 | **PASS** |
| `603:1924` | Info         | >7 bonus             | yes  | yes      | 11.30 |  8.28 |    -1 | +0.20 |        96 |          1 | **PASS** |
| `605:2027` | Info         | 5+ bonus             | yes  | yes      | 10.32 |  7.41 |    -1 | +0.20 |        96 |          1 | **PASS** |
| `605:2094` | Info         | Late                 | yes  | yes      | 10.94 |  7.94 |    -1 | +0.20 |        96 |          1 | **PASS** |

### Totals

```
FINAL_V14_SECTION_COUNT:         7
FINAL_V14_SCREEN_COUNT:         47

SCREENS_IMPLEMENTED:            47/47
SCREENS_EMULATOR_RENDERED:      47/47
SCREENS_PIXEL_VERIFIED:         47/47
SCREENS_STILL_MISMATCHING:       0/47
TALL_SCREENS_FULLY_COMPARED:    47/47   (33 stitched from 2-9 scroll segments)
```

| Section      | Passing |
| ------------ | ------: |
| Login        |     5/5 |
| log in flow  |     4/4 |
| leave        |     7/7 |
| performance  |     7/7 |
| job flow     |     5/5 |
| Service flow |   13/13 |
| Info         |     6/6 |

Worst residual over the set **8.71**, mean **5.17**, best 0.18. Every displacement probe is **0 or
+/-1**; none exceeds one row. Worst measured first-ink delta **0.38** design units.

All 47 emulator renders in the table come from **one build of one bundle**, captured in a single
unfiltered run, so no screen is scored against a binary that no longer exists.

### Unseen reference rows

21 screens cannot show every reference row on a 750-unit device. Of those, 14 have any ink at all in
the rows that go uncompared, and **12 of them have exactly one row** - an antialiased edge.

The two with 12, `434:3280` and `434:3330`, were re-checked by extracting the band and looking at
it: it is the **bezel's rounded bottom corners** plus the frame's own background colour, which is
decoration the app is forbidden to draw. There is no application content in it. (The previous report
called this the home-indicator strip; that was slightly off, and the description here is what the
extracted band actually shows.)

No screen is passed with unseen meaningful content in it.

## 6. Gates

| Gate             | Result                                               |
| ---------------- | ---------------------------------------------------- |
| TypeScript       | clean                                                |
| ESLint           | clean, 0 warnings                                    |
| Prettier         | clean                                                |
| Jest             | **450/450**, 28 suites                               |
| Expo export      | clean - 4MB Android bundle                           |
| Asset provenance | **35/35** by SHA-256 and byte count, both directions |

Jest gained 8 assertions over the 442 it started at: a new `stroke.test.ts` pinning the three stroke
alignments against numbers measured off the references, and three more duration cases. No test was
weakened and no schema was loosened. One assertion was **corrected**: `formatDurationHours(45)`
asserted `'0.8 hrs'`, which encoded the defect.

No asset was added, replaced or approximated. `622:801` draws the same `start-otp-art.png` it always
did; only where it sits inside its box changed.

## 7. Behaviour preserved

No backend wiring changed, and no API adapter, schema, command or projection was touched. Every
change in this run is presentation geometry, one copy string the design states, and the comparison
harness.

Still held: backend-authoritative state, idempotency keys, `assignmentVersion`, server timestamps,
server-driven eligibility, gate navigation and the 75-metre arrival semantics, the tracking
lifecycle, notification parsing and tap acknowledgement, the three-digit service OTP contract,
session restoration, and the extension five-minute behaviour its tests cover. No local frontend
state fakes a server-confirmed command. `jobUrgency.test.tsx` is untouched.

The deliberate deviations the previous run recorded stand unchanged: the bonus caption's unit word
(GAP-19), and the accepted design-side differences in section 9.

## 8. Native durability - seven of seven

Re-run end to end at the close of this session, on a binary built from a clean prebuild.

| Step                     | Result                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `expo prebuild --clean`  | clean; `android/` regenerated from scratch                                                                                               |
| NDK pin survives it      | **yes** - `ndkVersion = "27.2.12479018"` present exactly **once**, at line 30, **before** `apply plugin: "expo-root-project"` at line 33 |
| Splash drawable          | generated (`drawable-*/splashscreen_logo.png`)                                                                                           |
| Native Android build     | **BUILD SUCCESSFUL in 5m 52s** (x86_64, via `run:android`), JDK 21.0.9                                                                   |
| Four-ABI `assembleDebug` | **BUILD SUCCESSFUL in 8m 5s** - `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`                                                              |
| APK install              | `Success`                                                                                                                                |
| Cold launch to JS        | **PASS** - `ReactNativeJS: Running "main"`, pid 22302, 440 s after `am start`                                                            |
| Login renders            | **PASS** - `final-cold-launch-login.png` is **0.0000%** different from the recorded Login below the status bar                           |
| Background / foreground  | **PASS** - HOME to launcher, resume, **same pid 22302**                                                                                  |
| Process restart          | **PASS** - `force-stop` 22302 -> new pid **22603**, JS in 140 s, Login again at 0.0000%                                                  |
| Fatal exceptions         | **0** across build, install, cold launch, resume and restart                                                                             |

Two things are recorded rather than smoothed over:

- **One ANR occurred**, on the very first launch that `expo run:android` performed itself:
  `Reason: Process ... failed to complete startup`. It is the same slow-bundle symptom - the process
  exceeded the startup window while waiting on Metro - and it did not recur on the cold launch,
  resume or restart that followed. Zero fatal exceptions throughout.
- **`expo run:android` builds one ABI, not four.** It passes
  `-PreactNativeArchitectures=x86_64` for the attached emulator, so the APK that was installed and
  launched contains only `lib/x86_64/`. That is the correct binary for this emulator and it is what
  every row above was measured on, but it is a narrower build than the four-ABI `assembleDebug` the
  previous run recorded. A full `assembleDebug` was therefore run separately on the same clean
  prebuild: **BUILD SUCCESSFUL in 8m 5s**, 374 tasks, and the resulting APK carries all four -
  `lib/arm64-v8a/`, `lib/armeabi-v7a/`, `lib/x86/` and `lib/x86_64/`.

## 9. Accepted differences that are the design's, not the app's

Unchanged from the previous run, and re-confirmed against the corrected crop:

- **`592:563` draws a 31st of November.** The calendar mock has 31 cells for a 30-day month. The app
  is right and the frame is wrong.
- **`Rs 8500` on `575:1884` and `575:2098`, `Rs 8,500` on `575:2013`** - the same figure with and
  without its thousands separator, in the same component, on adjacent frames. The app formats money
  consistently.
- **`+Rs 50` on the cycle frames, `Rs 1,000` on the month** - the sign present on one and absent on
  the other for the same signed ledger line.
- **Drop shadows are omitted on Android.** `boxShadow` composites over the view rather than behind
  it and tints the fill; `elevation` draws far heavier than the design.

## 10. Still open, for an owner

None of these is a visual mismatch; all four need a decision that is not this session's to make.

1. **`583:427` / `583:453` / `583:479` are named `<45 mins`, `<10 mins`, `<5 mins` and draw 25, 20
   and 15.** Twenty is not under ten. Needs a designer or backend ruling. The tier stays an explicit
   presentation input and never gates a command.
2. **The backend still omits `extension.confirmedAt`** (`booking_extensions.settled_at` exists and
   the cook read model does not select it) **and any late duration**. Both parse the day they appear.
3. **Bottom-nav coverage is uneven.** `592:832 "long leave confirm"` has no nav while `592:1008`,
   same name, has one; three frames share that name and one is filed under `Info`.
4. **Authenticated end-to-end testing remains blocked.** There is no authorised test Cook, and this
   session created none, sent no OTP and made no mutating call against production. Every screen here
   was verified through the development gallery, which is what it exists for.

Environment notes for whoever picks this up:

- **Metro is pathologically slow here.** Poll for `ReactNativeJS` for at least eight minutes before
  concluding a launch has failed, and never issue a competing bundle request against the same Metro
  while waiting - that doubles the transform work.
- **Metro's file watcher does not work.** Every device verification needs a full `expo start --clear`.
- **`ANDROID_HOME` is not set in this shell and `local.properties` does not survive
  `prebuild --clean`**, so a bare `expo run:android` fails with `SDK location not found` until it is
  exported. `JAVA_HOME` must point at a JDK 21 - Android Studio's JBR (21.0.9) is the one used here;
  the default `java` on PATH is 1.8 and cannot build this project.

## 11. Commits

Created this session, on top of `baa1125`:

| Commit    | Summary                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `efd8426` | Close the seventh native row: the bundle was slow, not the wiring                      |
| `595409c` | Crop the direct references from the frame's top, not from half its shadow              |
| `868b452` | Compare against the 370-unit content column, not the whole 371-wide frame              |
| `2f67cf9` | Give the money tiles the two heights the frame states, and the mini cells their stroke |
| `8abf951` | Give the cancelled banner its 6-unit gap, and its caption the offset the frame states  |

All ten preceding commits are intact. Nothing was pushed, merged or deployed.
