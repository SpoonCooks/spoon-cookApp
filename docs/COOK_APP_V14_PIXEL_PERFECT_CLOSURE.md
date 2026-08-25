# Cook App — V14 closure report

Status: **47 of 47 implemented, rendered and compared. 32 pixel-verified, 15 still open.**

This run did not close the section. It did something the previous two runs could not: it found out
why the twenty-five open screens were open. Two of the three causes are fixed and measured; the
third is named below with what is known about it and what is not.

The headline finding is in the harness, not the app. **`viewport.py` was reading every one of the
41 `direct` reference renders from the wrong origin**, by about two pixels horizontally and one
vertically, because `get_screenshot` returns effect bounds and a direct frame has drop shadows.
Every element on every one of those screens was being compared against a column two units to its
left. That is invisible on a splash and decisive on a tariff table.

## 1. Starting state

|               |                                                                    |
| ------------- | ------------------------------------------------------------------ |
| Branch        | `v13-pixel-perfect`                                                |
| HEAD at start | `3cdd598`                                                          |
| Worktree      | clean, verified before any edit; every preceding commit intact     |
| Emulator      | `Ref393GA`, 1080x2392 @ 440dpi, headless                           |
| Figma         | `3iYf9ckrUDZLPlJP56dyKI`, page `Cook App` (`434:2401`), 7 sections |

Nothing was reset, stashed or discarded. One change of my own was reverted — see §6.

## 2. The harness was measuring the wrong column

`viewport.py` already knew that `get_screenshot` returns **effect** bounds. It says so at length
about the five `Login flow` frames, whose 25px-offset drop shadow it locates rather than solves.
But it treated every `direct` frame as if it began at `(0, 0)` and solved the scale from the frame
height.

Direct frames have effects too — the bottom nav's `drop-shadow 0 0 1`, `leave`'s `0 -1 1`, the
Help pill's `0 0 2`. So a 371-unit frame comes back **374 or 375 pixels wide**, at scale 1, with
the frame centred inside a one-to-two pixel margin. Reading it from `(0, 0)` starts the crop two
pixels left of the frame and then calls a short width the whole 371-unit column.

The margin is `(render − frame) / 2` on both axes. That is checked, not assumed: it predicts the
left edge of the bottom nav's active cell to within a pixel on `575:2137`, `575:1744`, `583:375`,
`614:453`, `592:488` and `597:1131` — six frames, five sections, three different render widths —
and its vertical half reproduces the `+0.2` to `+0.8` unit top-alignment deltas the previous run
measured on every direct frame and could not account for.

`alignment.py` now goes through the same crop instead of dividing the render's width by the
frame's, because half a unit is the whole size of the number it measures.

### What else the harness gained

- **Both tolerances in one pass.** `compare.py` writes `differingPixelPercentAtVerdictTolerance`
  into every `result.json`. The 47 verdict figures used to be a hand-pasted table inside
  `rule_verdicts.py`, which made a verdict stale the moment a screen was re-rendered.
- **`uncomparedReferenceInkRows`.** How many of the rows a 750-unit device cannot show actually
  carry anything. Of the 21 screens with unmatched rows, 12 have **one** inked row (an antialiased
  edge) and two — `434:3280`, `434:3330` — have 12, which is the bezel's own home-indicator strip.
  No screen is passed with unseen content in it.
- **One `aligned_views`.** Every consumer builds the pair the same way, so a reading aid cannot
  show a different alignment from the one that was scored. `inspect_band.py` had its own copy,
  keyed on a section table with no entry for `Info` or `job flow`, that ignored bottom anchoring.
- **`capture_emulator.py`** takes `--only`, dismisses an ANR dialog during warm-up instead of
  exhausting four relaunches against one, and checks the app owns the focused window before
  accepting a frame as painted.
- **`verify_assets.py`** re-checks all 35 V14 assets against their recorded SHA-256, byte count and
  Figma nodes, in both directions. 35/35, nothing unledgered, nothing orphaned.

## 3. Twelve more defects in the app

Each was invisible to the test suite: the component tree was correct in every case.

| #   | Defect                                                                                           | Scope                     |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| 1   | **`AAJ KA BREAK` rendered as `AAJ KA`** — Android under-measures a tracked run                   | 4 frames, **production**  |
| 2   | **Both Service actions drawn full-width**; the design gives each half a two-column grid          | 11 frames, **production** |
| 3   | **`59 mins` forty units above centre** — `flex: 1` on a Text, drawn against its top edge         | 4 frames, **production**  |
| 4   | **The travel photograph and arrival art inset ten units** by a padding the design's image covers | 6 frames, **production**  |
| 5   | **`628:1293` sixty units high** — a fixed 535-unit block sized to its content instead            | 1 frame, **production**   |
| 6   | **`622:1125` drew the wrong photograph** — it has its own, and the app had one for all four      | 1 frame, **production**   |
| 7   | **The Info CTA sixteen units left** — Yoga's static position, not the design's centred one       | 5 frames, **production**  |
| 8   | **The Info blurb block missing its 6-unit padding** — 13 units of displacement                   | 4 frames, **production**  |
| 9   | **The standing value right-aligned** where the design centres it in a 58-unit box                | 5 frames, **production**  |
| 10  | **Policy header chips at 16/24 on a 5-unit radius**; the design says Bold 18/28 on 15            | 2 frames, **production**  |
| 11  | **The job cards' stroke centre-aligned**; they measure `inside`, so each was 1.9 units short     | 5 frames, **production**  |
| 12  | **The `Late` tile drew an event count** where V14 draws minutes                                  | 4 frames, **production**  |

And six in the development gallery, which exists to reproduce the frames exactly:

- Three job-flow frames publish three **different** lists; the fixtures had one, so four of the
  five frames were wrong on every card — and the identical tiles then gave the scroll stitcher a
  repeating pattern to lock onto.
- A month is not a scaled-up cycle: `575:2013` states 10 five-star days against the cycle's 1, 24
  long-hours days against 8, and `₹1,000` / `₹3,600` of bonus against `+₹50` / `+₹100`.
- Two frames share each of `daily()` and `cycle()` and disagree about the late minutes.
- Footnote bold spans end a word early on three of the four policy sheets.
- Footnote tracking is 0.18 on the penalty sheets and **none** on the bonus ones, which is what
  wrapped `bonus hai` onto a third line on `605:2027`.
- The two bonus sheets set their data cells two points smaller to fit a third column.

Thirteen assertions in `frameFidelity.test.tsx` now pin the per-frame facts, because every one of
them renders perfectly well when it is wrong and costs an emulator run to find.

## 4. Where the 47 stand

`SCREENS_PIXEL_VERIFIED: 32`. Full table with both tolerances, the measured alignment, the
unmatched rows and how many of them carry ink: `docs/visual-verification/v14/MANIFEST.md`.

The rule is unchanged and was not moved: **PASS** at a tolerance-40 residual ≤ 10% with measured
top alignment within 2 design units.

### The fifteen still open

| screen                                  | t40       | what is known                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `575:1884` `575:2013` `575:2098`        | 13.3–14.7 | The three tall money frames. Content matches; the render drifts from +2 at the top to +6 by mid-screen and back to +4 at the bottom. Individual blocks differ in **both** directions — the `5+`/`Ghante` pair renders 107 units against the design's 113, the `CYCLE KI KAMAI` card 155 against 152 — so it is not one scale error. Not isolated. |
| `592:1008` `592:488`                    | 10.6–12.3 | Every element within ±1 unit except a +3/+4 at two 45-unit gaps. `592:489`, the same screen without the break card, passes at 8.35.                                                                                                                                                                                                               |
| `583:401` `583:427` `583:453` `583:479` | 10.9–11.3 | Improved from 20.2–22.5 by the stroke fix; `583:375`, the same list without a break card, now passes at 9.56.                                                                                                                                                                                                                                     |
| `603:1924` `605:2027` `605:2094`        | 10.1–10.9 | The three policy sheets whose siblings pass at 9.29 and 9.95. Probe −2.                                                                                                                                                                                                                                                                           |
| `622:1163` `622:801` `628:1293`         | 10.2–11.0 | Improved from 12.4, 14.5 and 36.2. All three within a point of the rule.                                                                                                                                                                                                                                                                          |

Eleven of the fifteen are between 10.1 and 12.3, against a threshold of 10. **None is a placement
failure**: all 47 measure within 1.4 design units of their reference's first painted row.

`575:1744` is worth recording as a near-miss of a different kind. It came back from one capture at
`t40 9.34` with a measured alignment of **−19 units** — a scrolled or mid-transition frame, not a
layout error — and re-taking the same build gave `5.94` at `+1.21`. The alignment measure is what
caught it; the residual alone would have read as a pass on a nineteen-unit displacement.

### One hypothesis tested and refuted

The previous report proposed that V14's `371`-wide frames against the app's 370-unit column were
"a systematic sub-unit horizontal scale difference … one untested candidate". It is now tested.
Re-scoring seven frames with the render resampled by `370/371` — which is exactly what changing
the app's divisor would produce — makes five of them **worse**:

```
603:1924  /370 t40=10.89   /371 t40=14.24        592:488  /370 t40=10.59  /371 t40= 9.86
605:2094  /370 t40=10.81   /371 t40=13.97        575:2032 /370 t40= 9.05  /371 t40= 7.31
622:801   /370 t40=10.17   /371 t40=10.86        575:2135 /370 t40= 4.17  /371 t40= 5.25
583:427   /370 t40=12.47   /371 t40=13.11
```

`CONTENT_WIDTH_DP` stays 370. The candidate is closed, and the remaining residual is not a global
scale.

## 5. Gates

| Gate             | Result                                                          |
| ---------------- | --------------------------------------------------------------- |
| TypeScript       | clean                                                           |
| ESLint           | clean, 0 warnings                                               |
| Prettier         | clean                                                           |
| Jest             | **442/442**, 27 suites (429 + 13 new frame-fidelity assertions) |
| Expo export      | clean — 4MB Android bundle, 1667 modules                        |
| Asset provenance | **35/35** verified by SHA-256 and byte count, both directions   |

The native durability gate is recorded in §8.

## 6. What was reverted, and why

The `5+` / `Ghante` tiles measured 107 units against the design's explicit `h-[113px]`, so they
were given that height. Re-rendered, all three tall money frames got **worse** — `575:1884` from
14.72 to 20.46, with the whole render four units lower rather than two units higher. The
measurement that motivated it must have been reading a different band. It was reverted to `HEAD`
rather than kept on the strength of a design quotation that the device contradicts.

That is the rule this run followed throughout: a change that the emulator does not confirm does
not stay, however well the design supports it.

## 7. Behaviour preserved

No backend wiring changed. `lateMinutes` joins the group of fields the design states and the
contract does not return: `null` from every adapter, production still renders the count it has,
and the tile reads the way the design does the moment the field appears — with no client release.
Nothing is invented from anything else; twice late for a minute each is not two minutes late.

The one deliberate copy change is the bonus caption, `7 hr ke upar kaam`. The number still comes
from `bonus.thresholdDays`; the unit word is now the design's, because V14 states this threshold
in hours everywhere else it appears (`603:1924` is titled `Extra hours`, its blurb reads
`Extra hours: 7 hours se upar`, its table is `8 hrs / 9 hrs / 10 hrs`). The design and the
deployed policy disagree — GAP-19 — and it needs a backend ruling. No bonus is computed from it,
and `BonusBar` keeps the server's own unit on the bar it draws.

`jobUrgency.test.tsx` is untouched. The lead card's colourway is still presentation only, and the
`<10 mins`/`20 mins` contradiction is still unresolved.

## 8. Native durability — six of seven

| Step                     | Result                                                                     |
| ------------------------ | -------------------------------------------------------------------------- |
| `expo prebuild --clean`  | clean; `android/` regenerated from scratch                                 |
| NDK pin survives it      | **yes** — `ndkVersion = "27.2.12479018"` present exactly once, at line 30, **before** `apply plugin: "expo-root-project"` at line 33 |
| Splash drawable          | generated (`drawable-*/splashscreen_logo.png`)                             |
| Native Android build     | **BUILD SUCCESSFUL in 13m 7s**, JDK 21, all four ABIs — `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` |
| APK install              | `Success`                                                                  |
| Background / foreground  | HOME then resume; **same pid** (11714), 0 fatal exceptions                 |
| Process restart          | `force-stop` 11714 → new pid 11846, 0 fatal exceptions                     |
| Fatal exceptions, total  | **0** across cold launch, resume and restart                               |
| **Cold launch to JS**    | **NOT VERIFIED**                                                           |

The last row is the honest one. The freshly prebuilt APK never reached JavaScript: it sits on the
splash with zero `ReactNativeJS` lines and zero exceptions, through four full warm-up attempts.
`prebuild --clean` regenerates `android/` and with it the app's dev-server preference, and the new
build could not fetch a bundle from the Metro instance that was serving it minutes earlier — the
reverse tunnel was re-established and `capture_emulator.use_reverse_tunnel` was applied, and
neither helped.

That is an environment and wiring failure, not evidence that the app is broken: the same source,
on the APK built before this prebuild, rendered all 47 gallery screens on this emulator within the
hour. But it was not verified on the new binary, so it is not claimed. **The native gate is six of
seven**, and the seventh needs a session that can get a bundle to a freshly prebuilt debug APK —
most likely by launching through `expo run:android`, which sets that preference itself, rather
than by installing the Gradle output directly.

## 9. Accepted differences that are the design's, not the app's

- **`592:563` draws a 31st of November.** The calendar mock has 31 cells for a 30-day month. The
  app is right and the frame is wrong; the extra cell is ~0.3% of that comparison.
- **`₹8500` on `575:1884` and `575:2098`, `₹8,500` on `575:2013`.** The same figure with and
  without its thousands separator, in the same component, on frames beside each other. The app
  formats money consistently.
- **`+₹50` on the cycle frames, `₹1,000` on the month.** The sign is present on one and absent on
  the other for the same signed ledger line.
- **Drop shadows are omitted on Android.** `boxShadow` composites over the view rather than behind
  it and tints the fill by 19 levels; `elevation` draws far heavier than the design. A missing
  `0 0 2 rgba(0,0,0,.15)` costs at most nine levels over three rows. This is why the measured top
  alignment reads `+1.18` on the Service frames: the reference's first ink is the Help pill's
  shadow, one unit above the pill the app draws.

## 10. Still open, for an owner

1. **`583:427` / `583:453` / `583:479` are named `<45 mins`, `<10 mins`, `<5 mins` and draw 25, 20
   and 15.** Twenty is not under ten. Needs a designer or backend ruling.
2. **The backend still omits `extension.confirmedAt`** (`booking_extensions.settled_at` exists and
   the cook read model does not select it) **and any late duration**. Both parse the day they
   appear.
3. **Bottom-nav coverage is uneven.** `592:832 "long leave confirm"` has no nav while `592:1008`,
   same name, has one; three frames share that name and one of them is filed under `Info`.
4. **Metro's file watcher does not work in this environment.** Every device verification needs a
   full `expo start --clear`, and a source edit made while a capture is running may or may not
   reach the frames still to be taken.

## 11. Commits

| Commit    | Summary                                                                               |
| --------- | ------------------------------------------------------------------------------------- |
| `dd1d39d` | Find the frame inside its own render, instead of assuming it starts at 0,0            |
| `07a0492` | Give each Info rule sheet the geometry its own frame states                           |
| `10e6a37` | Give the jobs break card the wrapper the design gives it, and its last word back      |
| `e43560c` | Halve the Service actions, fill the banner boxes, and give End back its 535 units     |
| `1397442` | Draw the performance Late tile in minutes, and caption the bonus in the design's unit |
| `60423cf` | Make each gallery state reproduce its own frame, not its section's                    |
| `b7fe1a4` | Pin the per-frame design facts, and persist the context they came from                |
| `47b3dd2` | Give `622:1125` its own photograph, and the job cards the stroke model they measure   |

Preceded by `3cdd598` and everything before it, all intact.
