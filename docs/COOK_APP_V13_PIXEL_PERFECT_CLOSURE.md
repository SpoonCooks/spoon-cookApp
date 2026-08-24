# Cook App — V13 pixel-perfect closure

## Verdict

**Incomplete. 9 of 35 screens pass; 26 do not. One blocker is external and is named in §12.**

|                                         |                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Screens implemented against V13         | **23** of 35 (`Login flow` 5, `log in flow` 4, `leave` 7, `performance` 7)                                                        |
| Screens still on the V12 build          | **12** — the whole of `Service flow`                                                                                              |
| Screens with complete emulator evidence | **35**                                                                                                                            |
| Screens passing                         | **9** — `Login flow` (5), `log in flow` (4)                                                                                       |
| Screens failing                         | **26**                                                                                                                            |
| `/dev` gallery coverage                 | **35 of 35**                                                                                                                      |
| Genuine blocker                         | the remote Figma MCP is not reachable from this session, and 11 of the 12 `Service flow` design contexts have never been captured |

This run did not reach a passing state. What it did do is make the measurements
trustworthy — several of the numbers previous runs reported were measuring the harness rather
than the app — and then fix what the corrected measurements exposed. The section-by-section
evidence is in §7, and every number there is reproducible from the artefacts in
`docs/visual-verification/v13/`.

---

## 1. Repository state

|                              |                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Branch                       | `v13-pixel-perfect`                                                                                                 |
| Baseline                     | `main` = `1b51fc3` — _Initial commit: Spoon Cook App (Expo / React Native)_                                         |
| HEAD at start of this run    | `f59f922` — _Correct the leave verdicts and stop Android shadows tinting their own fills_ (14 commits above `main`) |
| HEAD now                     | `b6dd134` (17 commits above `main`)                                                                                 |
| Worktree                     | clean                                                                                                               |
| Pushed / merged / deployed   | **no** / **no** / **no**                                                                                            |
| Backend (`D:\spoon-backend`) | **not modified** — read only                                                                                        |

### Commits added by this run

| Hash      | Subject                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| `33ac950` | Rebuild the performance section against V13 and give it a /dev state          |
| `5215406` | Capture whole scrolling frames, and model the performance cards' real nesting |
| `b6dd134` | Classify every differing pixel, and fix what that exposed                     |

Nothing was reset, cleaned, force-checked-out or rolled back. Every prior commit is intact.

---

## 2. Figma source and identity

|               |                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------- |
| File          | `COBtuKtaNXzjPGhRgqWZ7t` — _V0\_-user-app--13-_                                                 |
| Cook App page | `434:2401`                                                                                      |
| Server        | remote `figma` MCP (`https://mcp.figma.com/mcp`)                                                |
| Identity      | `lakshay58csea24@bpitindia.edu.in`, seat **Full**, verified with `whoami` before the first read |

Eight design contexts were captured this run: `592:488` (to settle the `leave` type defect),
all seven `performance` nodes, and `462:3617`. Every response is now persisted under
`docs/design-context/v13/` — see §5.

**The server then disconnected and has not been reachable since.** It requires an interactive
OAuth flow that a non-interactive session cannot run, so the remaining eleven `Service flow`
contexts could not be captured. That is the blocker in §12.

---

## 3. Finalized-section inventory — 35 screens

Unchanged from the previous run and re-derived from V13, not inherited from V12. `job flow`
(`592:1070`, 5 frames) is excluded, recorded in `excludedJobFlowFrames`, and asserted absent by
test. The full frame list with node ids, design sizes and routes is
`docs/visual-verification/v13/inventory.json`; the per-screen roll-up is
`docs/visual-verification/v13/MANIFEST.md`.

---

## 4. What was wrong with the measurements

Four faults, each of which made a number mean something other than what it appeared to mean.
They are listed first because they change how every earlier figure in this document's history
should be read.

### 4.1 Tall frames were scored on their first screenful

Five V13 frames are taller than the 750 design rows the emulator offers between its system bars —
`575:2098` is 1284. The comparison scored the visible part and reported the rest as
`uncomparedReferenceRows`, which is honest but useless: a third of a frame was never looked at.

`scripts/visual/stitch.py` now scrolls a screen and reassembles it. The distance each swipe
actually travels is **measured**, because `adb shell input swipe` is a gesture and Android applies
its own fling physics — appending a fixed number of rows would duplicate or drop a band silently,
and differently each run. A band lifted from the bottom of the assembled image is located in the
next segment, which stays measurable up to a full-viewport scroll. An overlap-correlation search
cannot see past about half a viewport, and both tall `performance` frames failed exactly that way
before this was changed, each reporting a 1125px move at the edge of its search window.

Nothing is appended on a guess: when the band cannot be found the run stops and records why in
`capture.json`, so a short render is visible as a short render.

`575:2098` went from **503** uncompared reference rows to **0**.

### 4.2 Screens were captured mid-scroll

The gallery does not remount between deep links, so `money-weekly` inherited the scroll offset
`money-daily` left behind and was captured 324 design rows into its own frame. The render was
complete and correct and scored **68.89%**. Every screen is now rewound before it is captured.

### 4.3 A system dialog was scored as a screen

An Android ANR dialog dims the screen behind it and floats a white panel over it. `575:1744` was
captured that way and scored **99.54%** against a render whose every element was in the right
place. `reject_reason` now names it and the run dismisses it and retries.

The first version of that check also refused the three `leave` bottom sheets, which are white
panels over an `rgba(0,0,0,0.8)` scrim and have the same shape. A dialog is inset and a sheet is
full-bleed, so the check also requires scrim at the far edges. Verified both ways against
synthetic frames and against the real sheet captures.

### 4.4 `Service flow` was compared against the wrong status band

`462:3660` is an explicit `h-[36.198px]` row carrying a `#f3f4f6` hairline — the same component
the `leave` frames use, **not** the bezel's 33 that `Login flow` uses. Every Service comparison
was leaving three design rows of chrome at the top of the reference. Read from the persisted
design context for `462:3617`, mirrored in `src/ui/theme/viewport.ts`, and asserted by
`viewportProfile.test.ts`.

Correcting the band moves the Service displacement probes toward zero without touching a line of
Service code — `483:4741` from −3 to **1**, `483:4795` and `483:4835` from −3 to **2**,
`482:4656` from −7 to **−3** — which is the signature of a corrected origin rather than a corrected
screen. Their percentages barely move, because the screens themselves are still the V12 build.

### 4.5 A percentage did not say whether a screen was wrong

`scripts/visual/residuals.py` puts every differing pixel in one of two buckets — `edge`, where the
reference has a strong local gradient, and `area`, where it is flat — and groups the `area` pixels
into blobs with bounding boxes. Nothing it computes adjusts any headline number.

The gradient is measured **per channel**, not on a brightness collapse. Brightness is blind to
exactly the edges this design is full of: `#ffd600` on white differs by 214 levels of blue and not
at all in red, so the first version called every yellow card border on every `leave` screen a real
mismatch. That correction is what makes §7's `edge share` column meaningful.

---

## 5. Design context is now persisted

Run 3 recorded only _that_ a node's context had been fetched. When run 4 needed those nodes the
context was gone and three `performance` screens could not be built from a call already paid for.

Every response is now written to `docs/design-context/v13/` — large ones verbatim under
`raw/<node>.tsx.txt`, inline ones as `<node>.md`. The archives carry a `.txt` extension so the
TypeScript, ESLint and Prettier passes never treat another tool's output as project source.

- Contexts captured to date: **23 nodes** (`scripts/visual/context-captured.json`)
- Original Figma assets committed: **49**, each with a content hash and its node provenance in
  `assets/images/figma-v13/ASSETS.json`
- No asset was invented, redrawn or substituted; no expiring MCP URL appears in `src/`

---

## 6. What was built

### 6.1 `performance` — rebuilt against V13, and given a `/dev` state

The seven frames were implemented but had **never been rendered**: `gallery-states.json` carried
28 of the 35 finalized screens and none of these, so nothing had ever compared them. Building the
states found three things wrong with the section:

- **It was laid out in raw dp.** Every other V13 section states lengths in design units and passes
  them through `screenWidth / 370`; this one did not, so the whole column rendered ~6% small on the
  392.7dp reference device while each card looked right on its own.
- **It drew `assets/icons/*`** — 1× rasters at their design size, 28×28 for a glyph that occupies
  77 device pixels at 2.75×. The V13 exports for the same glyphs are 90×90 and were already
  downloaded.
- **`502:438` rotates the exported `back` glyph 179.55°**, which is what turns it from a back
  chevron into the row's forward affordance. Rendering it unrotated pointed every history row the
  wrong way.

The frames now live in `src/features/performance/PerformanceViews.tsx` and are rendered by both
`src/app/money/*` and `/dev`, so the gallery proves the real screen rather than one built for it.

### 6.2 Corrections that apply beyond one section

| Correction               | Why                                                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DesignScale.font`       | React Native ceilings Android type to a whole device pixel (`TextAttributes.effectiveFontSize`) while `s` snaps to 1/3 dp. A 14-unit style became 15.0dp = 41.25px, drawn at **42** against the 41 the design asks for.                      |
| `figmaStroke({ align })` | Figma has three stroke alignments and a file mixes them. The `leave` cards are centre-aligned; the `575:1903` rows are inside-aligned, which the reference settles — 16 clear pixels between two painted borders over a painted row 49 tall. |
| Card nesting             | `434:2872` groups the `AAJ KA KAAM` label with the hours row at **6** and `531:1693` groups `EXTRA KAAM BONUS` with the formula at **2** — neither is the card's own 12, and the cycle work card sets 16 where the daily one sets 12.        |
| `lineHeight.dayStrip`    | `505:1249` binds the day label's line height to a **corner-radius** token. The node Figma lays out is 13 units — auto leading for 12px Bold — not the 16 the variable names.                                                                 |
| `DayStrip` grid          | `505:1240` is a seven-column grid, not a spaced row.                                                                                                                                                                                         |

### 6.3 The `leave` type defect run 4 could not explain — resolved

Run 4 measured two SemiBold-14 runs on `592:488` at ratio **1.031** and **1.041** against the
reference, could not account for it, and left it as the section's blocker. It was `DesignScale.font`:
the type token matches V13 exactly. Measured now:

| Run                             | Was   | Now       |
| ------------------------------- | ----- | --------- |
| `528:471` `Duration: 2 hrs`     | 1.031 | **1.010** |
| `526:340` `Aap jitne din aaye…` | 1.031 | **1.007** |

Every text run on that screen is now within ±2.4%, most within 1%.

---

## 7. Evidence

Every screen has `figma.png`, `emulator.png`, `overlay.png`, `diff.png`, `result.json` and
`residuals.json` under `docs/visual-verification/v13/<section>/<node>/`; scrolled screens also have
`capture.json`. `diff %` is the tolerated figure at 12/255; `raw %` counts any difference at all;
`edge` is the share of differing pixels sitting on a gradient in the reference; `area` is the share
of the whole screen that differs in a flat region — the real mismatch.

### Login flow — 5 of 5 PASS

| Node       | Screen               | diff % | raw % | offset |   edge | area % | uncompared |
| ---------- | -------------------- | -----: | ----: | -----: | -----: | -----: | ---------: |
| `434:3330` | Page 0- loading page |   0.55 | 61.14 |      0 | 100.0% |  0.000 |         17 |
| `434:3174` | Page 2b- OTP resend  |   1.95 |  2.81 |      0 |  99.0% |  0.019 |          0 |
| `434:3224` | Page 2a- Login OTP   |   2.16 |  2.96 |      0 |  99.1% |  0.019 |          0 |
| `434:3116` | Page 2c- OTP wrong   |   2.31 |  3.37 |      0 |  98.7% |  0.030 |          0 |
| `434:3280` | Page 1- Login No.    |   4.79 | 41.85 |      0 |  99.6% |  0.020 |         17 |

Residual: 98.7–100% of differing pixels sit on a glyph or image edge, and no screen has as much
as 0.03% of flat-region difference. `434:3330` and `434:3280` carry a photograph, which is
what puts their raw figures at 41–61% while the tolerated figures stay low — image resampling, not
misplacement. **PASS.**

### log in flow — 4 of 4 PASS

| Node       | Screen           | diff % | raw % | offset |  edge | area % |
| ---------- | ---------------- | -----: | ----: | -----: | ----: | -----: |
| `575:2138` | 3c- absent       |   3.48 | 12.26 |      0 | 98.5% |  0.053 |
| `575:2136` | 3d- log out      |   3.66 | 33.90 |      0 | 99.5% |  0.019 |
| `575:2137` | 3b- present      |   4.66 | 13.80 |     -1 | 91.4% |  0.402 |
| `575:2135` | 3a- daily log in |   5.03 | 15.02 |      0 | 98.3% |  0.087 |

**PASS.**

### leave — 7 of 7 FAIL

| Node       | Screen              | diff % | raw % | offset |  edge | area % | uncompared |
| ---------- | ------------------- | -----: | ----: | -----: | ----: | -----: | ---------: |
| `592:888`  | short leave         |   5.47 | 42.40 |      0 | 86.8% |  0.724 |         95 |
| `592:563`  | long leave          |   7.06 | 24.96 |     -1 | 74.0% |  1.838 |         95 |
| `592:639`  | long leave selected |   7.42 | 25.07 |     -1 | 83.1% |  1.251 |         95 |
| `592:489`  | Leave absent        |   7.70 |  9.87 |      0 | 90.8% |  0.708 |          0 |
| `592:832`  | long leave confirm  |   8.51 | 10.39 |      0 | 91.7% |  0.704 |          0 |
| `592:1008` | long leave confirm  |  10.25 | 12.78 |      1 | 96.5% |  0.357 |         95 |
| `592:488`  | Leave present       |  10.70 | 13.38 |      0 | 89.7% |  1.101 |         95 |

Improved from 5.56–11.85%. Layout is right — every offset is within one row and 74–97% of the
residue is rasterisation — but 0.36–1.84% of each screen still differs in flat regions, which is
above what "negligible" can be claimed to cover, so these are recorded **FAIL**, not PASS. The
blobs are located in each `residuals.json`.

The 95 uncompared rows on four of these are inherent, not a harness gap: the sheets are 846
content units against the device's 750 and do not scroll.

### performance — 7 of 7 FAIL

| Node       | Screen             | diff % | raw % | offset |  edge | area % | segments |
| ---------- | ------------------ | -----: | ----: | -----: | ----: | -----: | -------: |
| `575:1744` | 12- money daily    |   7.90 |  9.85 |      0 | 94.7% |  0.420 |        2 |
| `575:1922` | 15- past daily     |   8.28 | 10.32 |      0 | 92.6% |  0.610 |        2 |
| `575:1903` | 14- day history    |   8.82 | 11.41 |     -1 | 93.5% |  0.573 |        1 |
| `575:2032` | 17- weekly history |  10.38 | 13.21 |      1 | 92.1% |  0.816 |        1 |
| `575:2013` | 16- money monthly  |  14.56 | 15.95 |      4 | 66.1% |  4.932 |        2 |
| `575:2098` | 18- past weekly    |  14.57 | 16.23 |      3 | 66.6% |  4.872 |        3 |
| `575:1884` | 13- money weekly   |  15.61 | 17.03 |      4 | 64.9% |  5.483 |        3 |

From 8.82–31.08% at the start of the section's first real comparison. The four daily/history frames
are now 92–95% edge with under 0.9% flat-region difference — close to the `leave` band. The three
cycle/monthly frames carry ~5% real area low in the card stack, located in their `residuals.json`
as full-width horizontal bands, which is accumulated vertical drift below the earnings block. That
is a known, located, unfixed defect.

### Service flow — 12 of 12 FAIL, still the V12 build

| Node       | Screen                         | diff % | offset |
| ---------- | ------------------------------ | -----: | -----: |
| `485:4917` | Page 10- job end               |  28.13 |    -10 | 32.7% | 18.922 |
| `468:4040` | Page 5b- arrival late          |  28.89 |     -9 | 26.2% | 21.315 |
| `464:3864` | Page 4b- travel 5 mins buffer  |  29.32 |     10 | 26.0% | 21.683 |
| `463:3779` | Page 4b- travel 5 mins buffer  |  29.36 |     10 | 26.8% | 21.484 |
| `468:3935` | Page 5a- arrival on time       |  29.40 |    -10 | 27.0% | 21.456 |
| `462:3617` | Page 4a- travel on time        |  29.41 |     10 | 26.3% | 21.668 |
| `482:4587` | Page 6a- Start OTP on time     |  40.45 |     -4 | 26.6% | 29.665 |
| `484:4875` | Page 9- end OTP                |  44.79 |     -4 | 28.4% | 32.078 |
| `483:4795` | Page 7b- Cooking (last 7 mins) |  45.99 |      2 | 25.5% | 34.258 |
| `483:4835` | Page 7c- Cooking extended      |  45.99 |      2 | 25.5% | 34.258 |
| `482:4656` | Page 6b- Start OTP on time     |  46.02 |     -3 | 28.6% | 32.861 |
| `483:4741` | Page 7a- Cooking               |  46.68 |      1 | 35.9% | 29.905 |

28–47%, 25–36% edge share, **18.9–34.3% flat-region difference**. These are not close: the screens
are the V12 build and were never rebuilt against V13. Only `462:3617`'s design context was captured
before the MCP became unreachable; the corrections that context already shows are needed are listed
in §12.

---

## 8. Approved deviations

Both are cases where drawing what V13 draws would make production wrong. Each is region-limited,
and neither is masked out of any percentage.

### 8.1 The invalid `31 November` cell — `592:563`, `592:639`

The design draws a 31st of November. Production renders the real calendar and leaves the cell
empty; it never constructs or submits an invalid date, and backend validation is untouched.

### 8.2 The bonus threshold is stated in days, not hours

`434:2892` reads `Bonus ke liye: 7 se zyada **ghante** kaam` and `492:5414` reads
`7 hr ke upar kaam` — hours. The deployed contract has no hours field: `CookBonusProgress` exposes
`currentProgressDays`, `thresholdDays` and `targetDays`, and the ledger awards the bonus on present
**days** (confirmed against `openapi/openapi.yaml`). Printing the design's word would promise a rule
the backend will not honour — a cook who worked eight hours on three days would read it as earned.

The app prints `din`. Region: one line on `575:1744` / `575:1922`, and one tile caption on
`575:1884` / `575:2013` / `575:2098`. It reverts to the design's word the day the contract grows an
hours field.

### 8.3 Recorded, not approved — rupee grouping

`536:224` prints `₹1075` and `537:237` prints `₹8500`, while `532:112` on another frame prints
`₹8,500` for the same kind of figure. The design is internally inconsistent; the app groups
consistently. This is a sub-character residual on two frames and is noted rather than matched.

---

## 9. Backend integration

Unchanged from the previous run and re-verified read-only: **21 connected endpoints**, production
adapters intact, `POST /cook/leaves` deployed and wired. `Present` never marks locally,
`checkInOpensAt` stays backend-authoritative, the service timer uses server timestamps, negative
countdowns stay visible, and no push receipt transitions booking state.

### Fields the contract does not expose

`workedMinutes`, `aboveBasePaise`, `perDayBasePaise`, `extraKaamMultiplier`, `extraKaamRatePaise`,
`fiveStarDays`, `longHoursDays`, and both deduction counts are `null` from **every** adapter,
because no deployed cook route returns them. Production renders `—` for each. The `/dev` fixture
states the design's own figures so the pixel comparison measures the screen rather than the gap —
which is the split §11 of the brief asks for. Production may not compute them: `aboveBasePaise` as
`gross − base` would swallow reversals, and `perDayBasePaise` as `base ÷ days` would invent a rate
the ledger never agreed to.

### Known gaps

- **GAP-07** — no cook-side extension channel, so `483:4835` can be rendered from server state but
  the cook cannot initiate or confirm an extension.
- **GAP-02 / GAP-24** — no cook rating aggregate endpoint.

Neither blocks V13 visual completion. Neither is faked.

---

## 10. `/dev` visual gallery — complete

All **35** finalized states are reachable at `spooncook://dev/<state>`, asserted by
`gallery.test.tsx` against `figmaScreens`. Every entry renders the same presentational view the
real route renders, differing only in where its data comes from. Fixtures are `__DEV__`-guarded and
throw in a release build; no entry calls an API, seeds a production cache, or advances a booking.
Dates, timers and earnings are fixed values, so two runs a day apart produce identical pixels.

---

## 11. Gates

| Gate                                | Result                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| TypeScript (`tsc --noEmit`, strict) | **PASS**                                                                                      |
| ESLint (`--max-warnings=0`)         | **PASS**                                                                                      |
| Prettier (`--check .`)              | **PASS**                                                                                      |
| Jest                                | **PASS — 386/386, 22 suites**                                                                 |
| Expo export (android)               | **PASS** — 4.4MB Hermes bundle, `dist/`                                                       |
| Clean Expo prebuild                 | **PASS** — `android/` deleted and regenerated                                                 |
| NDK override survives regeneration  | **PASS** — `android/build.gradle` carries `ndkVersion = "27.2.12479018"`                      |
| Native Android debug build          | **PASS** — `assembleDebug` from the clean prebuild, 13m 06s, 489 tasks, `app-debug.apk` 228MB |
| APK install on `Ref393GA`           | **PASS** — `adb install -r`, streamed, `Success`                                              |
| Cold launch of the built APK        | **PASS** — no fatal exception in logcat; JS bundle loaded; deep link honoured                 |
| Metro resolution                    | **PASS** — `expo-router/entry` bundles and serves over the `adb reverse` transport            |
| Emulator journey — all 35 states    | **PASS** — every state deep-linked, rendered and captured on the freshly built APK            |
| Background / foreground             | **PASS** — HOME then relaunch returns a usable screen                                         |
| Process restart                     | **PASS** — `force-stop` then cold launch returns a usable screen                              |
| Fatal exceptions during the journey | **none** in logcat                                                                            |
| `git diff --check`                  | **PASS**                                                                                      |
| Secret scan                         | **PASS** — no keys, tokens, device serials or MCP URLs in `src/`                              |
| Worktree clean                      | **PASS**                                                                                      |
| 35 screens implemented against V13  | **FAIL — 23 of 35**                                                                           |
| 35 screens pixel-verified           | **FAIL — 9 of 35**                                                                            |

```
FINAL_SECTION_SCREEN_COUNT:      35
SCREENS_IMPLEMENTED:             23
SCREENS_CARRIED_OVER_FROM_V12:   12
SCREENS_EMULATOR_RENDERED:       35
SCREENS_PIXEL_VERIFIED:           9
SCREENS_STILL_MISMATCHING:       26
ORIGINAL_FIGMA_ASSETS_USED:      YES
VISUAL_GALLERY_COMPLETE:         YES (35 of 35)
LOGIN_FLOW_COMPLETE:             YES
LOG_IN_FLOW_COMPLETE:            YES
LEAVE_COMPLETE:                  NO  (implemented, 5.47-10.70%)
PERFORMANCE_COMPLETE:            NO  (implemented, 7.90-15.61%)
SERVICE_FLOW_COMPLETE:           NO  (not rebuilt)
AUTHENTICATED_E2E_COMPLETE:      NO  (no approved test Cook)
BACKEND_MODIFIED:                NO
COMMITTED:                       YES
WORKTREE_CLEAN:                  YES
PUSHED / MERGED / DEPLOYED:      NO / NO / NO
```

---

## 12. Blockers

### B1 — the remote Figma MCP is unreachable from this session (blocks 11 screens)

The `figma` server disconnected mid-run and reports that it requires authorization. That flow is
interactive and cannot be run from a non-interactive session; re-authorising in the terminal does
not attach the server to an already-running session either.

**Consequence.** Eleven of the twelve `Service flow` design contexts have never been captured, and
the brief forbids substituting metadata or a screenshot for `get_design_context`. Those screens
cannot be rebuilt without it.

**Exact action required.** In an interactive terminal: `/mcp` → select the **remote** `figma`
server (not `figma-desktop`) → authenticate as `lakshay58csea24@bpitindia.edu.in` → confirm with
`mcp__figma__whoami` → then capture `463:3779`, `464:3864`, `468:3935`, `468:4040`, `482:4587`,
`482:4656`, `483:4741`, `483:4795`, `483:4835`, `484:4875`, `485:4917`.

`462:3617` is already captured and persisted, and already shows what the rebuild involves: the
shared header is `Extend booking` with a 32-unit back glyph and a 73×25.335 `Help` pill; the
walking-Cook illustration is 112×150; the countdown card is `#ecff9b`, `rounded-24`, `h-134`, with
a white `16 mins` panel carrying an **inset** `0 0 4px rgba(0,0,0,.15)` shadow; the address rows are
19-unit icons at Black 14/20; `Map dekhe` is `#ffde33` and `Call kare` is `#ffef99`, both
`rounded-15 px-12 py-6` with 16-unit glyphs. Nine of its assets are downloaded and hashed.

### B2 — no approved test Cook (unchanged)

Authenticated end-to-end against the deployed backend was not run. The `/dev` gallery is the
mitigation and now covers all 35 states.

---

## 13. Native toolchain notes

`local.properties` is regenerated by `expo prebuild` but does **not** carry an SDK path, so the
first `assembleDebug` after a clean prebuild fails with _SDK location not found_ until `ANDROID_HOME`
is exported. The build also needs JDK 21 — the machine's default `java` is 1.8, and Android
Studio's bundled `jbr` (21.0.9) is what these gates were run with. Neither is a repository defect;
both are recorded so the next run does not rediscover them.

## 14. What must happen next

1. Re-authorise the Figma MCP (§12) and capture the eleven outstanding `Service flow` contexts.
2. Rebuild `Service flow` against V13. It is 26–46% with ~19–34% flat-region difference; this is a
   rebuild, not a tuning pass. Remove the unapproved visible Society gate block **without**
   changing the gate destination or the 75m arrival rule; keep `TravelRisk` and `TravelLate`
   distinct; do not clamp negative countdowns; leave the OTP lengths as deployed.
3. Close the three cycle/monthly `performance` frames. The defect is accumulated vertical drift
   below the earnings block, located as full-width bands in each `residuals.json`.
4. Close the `leave` flat-region residue (0.36–1.84% per screen), likewise located.
5. Re-run every gate and re-verify all 35.
6. Close the `react-native-svg` version mismatch (15.13.0 installed, 15.15.4 expected).
