# Cook App — V14 closure report

Status: **47 of 47 implemented, rendered and compared. 21 pixel-verified, 26 still open.**

This run took the V14 build from "implemented" to measured. All 47 screens were rendered on the
393dp emulator and diffed against their own V14 reference renders, which surfaced **twelve
defects** — eight of them in production code, none of them visible to the 429-test suite. Those are
fixed and re-verified. The 26 screens that remain open are named in §7 with what is still wrong.

## 1. Starting state

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| Branch        | `v13-pixel-perfect`                                           |
| HEAD at start | `44e364c`                                                     |
| Worktree      | verified before any edit; `9d38dc8` and `8177e7d` both intact |
| Emulator      | `Ref393GA`, 1080x2392 @ 440dpi                                |

Nothing was reset, stashed or discarded. The uncommitted harness work found in the tree was
completed and committed rather than dropped (`7e2b9bb`).

## 2. What the pixel run found

Every one of these was invisible to the test suite: the component tree was correct in each case,
so the tests passed while the screen was wrong.

| #   | Defect                                                                                              | Scope                      | Commit    |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------- | --------- |
| 1   | **All five bottom-nav glyphs rendered blank.** `absoluteFill` on a box that measures to zero width. | 33 screens, **production** | `925c568` |
| 2   | Gallery drew no bottom nav at all, so 33 frames captured without it                                 | 33 screens                 | `c2cf932` |
| 3   | Service entries claimed a safe area they do not own — rendered ~49dp high                           | 13 screens                 | `c2cf932` |
| 4   | Stitcher locked onto the fixed nav; tall nav frames scored on one viewport                          | tall frames                | `c2cf932` |
| 5   | `dayHistory` 7→10 rows, `cycleHistory` 4→6 rows                                                     | 2 screens                  | `c2cf932` |
| 6   | Info rule sheets missing from the bottom-anchored set (~96 units)                                   | 5 screens                  | `a021b32` |
| 7   | **`JobViews` and `InfoViews` never applied a top inset**                                            | 6 screens, **production**  | `b4c1c75` |
| 8   | **Info rule sheets had no bottom inset** — sheet under the system bar                               | 5 screens, **production**  | `b4c1c75` |
| 9   | **`textTransform: 'uppercase'` dropped the last word of a headline**                                | 2+ screens, **production** | `b4c1c75` |
| 10  | **Three SVGs loaded as image sources — drew nothing**                                               | 11 screens, **production** | `8eee50c` |
| 11  | **Service art boxes rendered at ~4x and overflowed**                                                | 3 screens, **production**  | `1fc0be7` |
| 12  | **`622:913` drawn as a generic Active job frame** — wrong title, extra Map button                   | 1 screen, **production**   | `1fc0be7` |
| 13  | Info policy accents: bonus sheets drawn as penalties                                                | 4 screens                  | `8eee50c` |
| 14  | Standing value fixed at 58 units; title box 8 units short                                           | 5 screens                  | `8eee50c` |
| 15  | **Log-out screen still used the V13 photograph**                                                    | 1 screen                   | `d75ca51` |
| 16  | Policy tables rendered as equal thirds; none of them is                                             | 4 screens                  | `cc069bf` |

### The one worth reading twice

`BottomNav` is the **real** tab bar — `(tabs)/_layout.tsx` supplies it through `tabBar` and
`service/[bookingId].tsx` renders it directly. The shipping app was drawing five blank gaps above
its tab labels on 33 of 47 screens. The component tree was correct, every test passed, and the bar
looked finished in review; only a diff against the reference showed the glyphs were absent.

The cause recurs three times in this list (#1, #10, #11): the design writes images as
`absolute inset-0 size-full`, and the literal port — `StyleSheet.absoluteFill` — leaves nothing in
the box's flow, so what the box measures to on this Fabric build is not the design's size. Every
image in the affected files now states its size in numbers.

## 3. How a verdict was decided

`differingPixelPercent` **is not comparable between screens**. It counts differing pixels over the
compared area, and every element edge and glyph edge contributes, so ink density dominates it:
`434:3330` is a near-flat splash and scores 0.55%; `603:1924` is a dense tariff table covering most
of its sheet and scores 31.67% with its fills sampling _identical_ to the reference and its sheet
height matching to 0.4 of a design unit.

So each screen was scored twice — at the antialiasing tolerance of 12 and again at 40:

```
python scripts/visual/compare.py --inventory … --root … --tolerance 40
```

A rasterisation residual collapses when the tolerance widens; a real difference does not, because
those pixels differ by far more than 40 levels. The rule, applied without exception:

> **PASS** — tolerance-40 residual ≤ 10% **and** |displacement| ≤ 2.
> **OPEN** — anything else.

Both numbers are in `verdicts.json` and `MANIFEST.md`, so the ruling can be re-derived rather than
taken on trust. The `Login flow` screens land at 0.18–1.68% at tolerance 40, which is what a
correct screen looks like under this measure and is the control for the harness itself.

## 4. Evidence produced

For all 47, under `docs/visual-verification/v14/<section>/<node>/`:

`figma.png` (reference) · `emulator.png` (render) · `overlay.png` (50% blend) · `diff.png`
(differing pixels in red) · `result.json` · `capture.json` for every stitched screen.

`result.json` carries the diff percentage, the **displacement probe**, `uncomparedReferenceRows`,
the per-band split, and the worst rows. Tall screens are scrolled and reassembled; the bottom nav
is excluded from the scrolled region and re-attached beneath it, because it is fixed chrome and the
stitch template would otherwise lock onto it and stop after one screenful.

**Nav-bearing frames are compared in two bands.** The emulator supplies 750 design units where most
V14 frames want ~790. The app's answer is correct — chrome keeps its size, the body flexes, the nav
stays on the bottom edge — but a single top-anchored comparison lines the render's nav up against
reference _body_ rows and scores a correct bar as a solid block of difference. Body is compared from
the top, nav from the bottom, and the body rows the device could not show are counted, not hidden.

## 5. Gates

| Gate                    | Result                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript              | clean                                                                                                                          |
| ESLint                  | clean, 0 warnings                                                                                                              |
| Prettier                | clean                                                                                                                          |
| Jest                    | **429/429**, 26 suites                                                                                                         |
| Expo export             | clean — 4MB Android bundle                                                                                                     |
| `expo prebuild --clean` | clean                                                                                                                          |
| **NDK durability**      | pin survives a clean prebuild: present exactly once, **before** `apply plugin: "expo-root-project"`, splash drawable generated |
| Native Android build    | **BUILD SUCCESSFUL in 12m 15s**, all four ABIs, NDK 27.2.12479018, JDK 21                                                      |
| APK install             | `Success`                                                                                                                      |
| Cold launch             | JS reached `Running "main"`; no crash                                                                                          |
| Background / foreground | HOME then resume; state intact, 0 exceptions                                                                                   |
| Process restart         | true `force-stop` (pid 9974 → 10269), relaunched clean, 0 exceptions                                                           |

## 6. Behaviour preserved, and asserted

- **Backend-authoritative state.** No command advances state locally; the projection decides the
  screen.
- **Idempotency.** One key per screen mount, so a double-tap or a post-timeout retry replays the
  same command.
- **Assignment versions.** Sent with every mutating command.
- **Session expiry.** Distinguished from a dead network.
- **The five-minute extension window.** 15 tests at the exact boundaries. `confirmedAt` is **not
  invented**: the window is the difference between two server instants, and when the backend omits
  the field it parses to `null`, the window computes 0, and the `622:1163` banner stays dark. That
  is asserted by `never shows the banner against today's production payload`.
- **Job-card colour tier stays presentation.** Now pinned by `jobUrgency.test.tsx` in both
  directions across all three tiers: the CTA follows `isActionable` alone, and `critical` — the
  loudest card on the screen — cannot talk the app into offering a command the server withheld.

## 7. What is still open — 26 screens

Named precisely, with what the evidence says. None is a placement failure: sheet heights, fills and
column geometry were sampled against the reference and match.

1. **Info policy sheets (4)** — `603:1865`, `603:1924`, `605:2027`, `605:2094`, 26–29% at
   tolerance 40. Title, chevron, accents, column widths and sheet height all verified correct by
   direct sampling. The residual is inside the tariff table and the footnote and has not been
   isolated. `597:1221` and `597:1131`, the two Info screens that are not policy tables, both PASS.
2. **`628:1293` End (36%)** — the celebration art is now correctly sized and positioned, but the
   app draws it slightly larger than the reference. Suspect the `contain` fit against the source's
   natural aspect; not yet confirmed.
3. **job flow (5)** — 13–22%. All five share a `-10`/`-2` probe offset that did **not** clear when
   the top inset was added, so something below the nav differs.
4. **Service flow (11)** and **performance (3)** and **leave (2)** — 11–15%, all with small
   positive offsets (+1…+6). Consistent with a systematic sub-unit scale difference rather than
   per-screen defects; a 371-wide frame against a 370-unit content column is one candidate that
   has not been ruled out.

## 8. The design contradiction, still unresolved

`583:427` / `583:453` / `583:479` are named `<45 mins`, `<10 mins` and `<5 mins` and draw `25`,
`20` and `15` minutes. Twenty is not under ten. The tier stays an explicit input — fixtures set it
per frame, production passes the calmest — and eligibility is untouched. **Needs a designer or
backend ruling.** `jobUrgency.test.tsx` documents it and fails if the colour is ever wired into the
command.

## 9. Other open items

1. **Bottom-nav coverage is uneven.** 14 of 47 frames have no nav. Login (5) is correct — pre-auth.
   The `leave` and `Info` sheets are modals. But `592:832 "long leave confirm"` has no nav while
   `592:1008`, same name, has one. Needs a ruling.
2. **Three frames share the name `long leave confirm`** — `592:832`, `592:1008` and `597:1131`, the
   last filed under `Info`. Likely misfiled.
3. **The backend still omits `extension.confirmedAt`.** It exists as `booking_extensions.settled_at`
   and the cook read model does not select it. The client already parses the field, so it works the
   moment it appears, with no client release. The backend was **not modified**.
4. **Metro's file watcher does not work in this environment.** It serves a stale bundle and never
   notices source edits, which silently invalidated several on-device checks before it was caught.
   Every device verification here required a full `expo start --clear`. Environmental, but it makes
   each check cost minutes and it will mislead the next person.

## 10. What was NOT done

- No push, no merge, no deploy.
- No backend modification; `D:\spoon-backend` was read only.
- No User App file was read or touched.
- No OTP was sent and no production data was mutated.
- No authenticated E2E — there is no authorised test Cook.

## 11. Commits

| Commit    | Summary                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `7e2b9bb` | Repoint the pixel harness at V14 and pull all 47 reference renders      |
| `925c568` | Give the bottom-nav glyphs a size that cannot collapse to nothing       |
| `c2cf932` | Make the /dev gallery reproduce the V14 frames it is compared against   |
| `a021b32` | Make the evidence harness survive the run it is asked to do             |
| `b4c1c75` | Give three screens the safe area and the full copy they were missing    |
| `623e697` | Pin the lead card's colourway to presentation                           |
| `1fc0be7` | Size every service art box, and give the cancelled frame its own screen |
| `8eee50c` | Draw the vectors and colour the Info sheets the way V14 does            |
| `d75ca51` | Use V14's own photograph on the log-out screen                          |
| `cc069bf` | Give each Info policy table the column widths its own frame draws       |

Preceded by `44e364c`, `8177e7d` and `9d38dc8`, all intact.
