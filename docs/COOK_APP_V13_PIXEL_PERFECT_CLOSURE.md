# Cook App — V13 pixel-perfect closure

Status: **incomplete — 5 of 35 screens verified; the remaining 30 are blocked on Figma MCP access.**
This report records what was established, what was built, what was measured, and exactly what is
blocking the rest. It is not a claim of completion.

> **Run 2 (2026-08-24)** resolved the blocker that stopped run 1, corrected a 25px error in the
> comparison harness, and closed the whole `Login flow` section. It then hit a _different_ Figma
> access failure. Sections 2, 5, 7, 8, 10, 11 and 12 below are current as of run 2; sections 3, 4,
> 6 and 9 are unchanged from run 1 and remain accurate.

---

## 1. Starting repository state

|                    |                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Branch             | `main`                                                                                              |
| HEAD               | `1b51fc399132abcb1ef05b27c2962905f89a55f3` — _Initial commit: Spoon Cook App (Expo / React Native)_ |
| Working tree       | 36 modified files, 1 deleted (`src/ui/components/MoneySummary.tsx`), 19 untracked paths             |
| `git diff --check` | clean (no whitespace errors)                                                                        |

Nothing was reset, cleaned, checked out or rolled back. All prior work was preserved.

### Classification of the surviving V12 work

| Class                                 | Content                                                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Valid and reusable**                | API client, token refresh, secure session storage, query invalidation, background location, push registration, gate navigation, attendance eligibility, `POST /cook/leaves` wiring, the Android NDK config plugin, the Livvic font pipeline |
| **Valid but required V13 comparison** | `Login flow`, `Service flow`, `performance` screens — the frames are unchanged from V12, so the code survives, but comparison shows it never matched them (§7)                                                                              |
| **Obsolete because V13 changed**      | `src/core/figma/scope.ts` (rewritten), `figmaScope.test.ts` (rewritten) — the V12 `Attendance` section no longer exists                                                                                                                     |
| **Partial**                           | The `leave` routes (`single.tsx`, `range.tsx`) implement the deleted V12 design, not the new V13 one                                                                                                                                        |
| **Broken**                            | none found                                                                                                                                                                                                                                  |
| **Unrelated user work**               | none found                                                                                                                                                                                                                                  |

---

## 2. Figma source

|             |                                                                       |
| ----------- | --------------------------------------------------------------------- |
| File        | `COBtuKtaNXzjPGhRgqWZ7t` — _V0\_-user-app--13-_                       |
| Pages       | `0:1` "User App" (customer app — out of scope), `434:2401` "Cook App" |
| Server used | **remote** Figma MCP, `https://mcp.figma.com/mcp` (run 2)             |

**Run 1** used the desktop app's local Dev Mode server (`http://127.0.0.1:3845/mcp`) because the
remote server refused the file with _"Looks like you don't have edit access"_.

**Run 2 established that this was an identity problem, not a seat problem.** The remote server was
authenticated as `lakshayd.intern@spoonhelp.com` — a **View** seat on a starter-tier team that the
file was never shared with. Re-authenticating (`/mcp` -> `figma` -> clear authentication ->
reconnect) as `lakshay58csea24@bpitindia.edu.in`, which holds a **Full** seat on the personal team
that actually owns the V0 file, gave complete read access on the first call:

| Tool                 | Result on `COBtuKtaNXzjPGhRgqWZ7t` |
| -------------------- | ---------------------------------- |
| `get_metadata`       | 2,378 nodes                        |
| `get_screenshot`     | PNG returned and rendered          |
| `get_variable_defs`  | full token set                     |
| `get_design_context` | reference code **plus asset URLs** |

The asset URLs matter: the remote server returns `https://.../api/mcp/asset/...` links, so run 1's
`dirForAssetWrites` blocker (B1 below) simply does not exist on this path. Assets are fetched with
`curl` and committed. The local desktop server answered _"Rate limit exceeded, please try again
tomorrow"_ throughout run 2 and was not used.

---

## 3. Finalized-section inventory — 35 screens

The count is derived from V13 itself, not inherited from V12's 32. A screen counts only if it is a
**direct child frame** of a finalized section.

| Section      | Section node | Screen                         | Node       | Frame (dp) | Route / component                   | Status                    |
| ------------ | ------------ | ------------------------------ | ---------- | ---------- | ----------------------------------- | ------------------------- |
| Login flow   | `434:3115`   | Page 0- loading page           | `434:3330` | 390×830    | `src/app/index.tsx`                 | **PASS 0.99%**            |
| Login flow   | `434:3115`   | Page 1- Login No.              | `434:3280` | 390×830    | `src/app/login.tsx`                 | **PASS 5.64%**            |
| Login flow   | `434:3115`   | Page 2a- Login OTP             | `434:3224` | 390×830    | `src/app/otp.tsx` countdown         | **PASS 2.58%**            |
| Login flow   | `434:3115`   | Page 2b- OTP resend            | `434:3174` | 390×830    | `src/app/otp.tsx` resend            | **PASS 2.82%**            |
| Login flow   | `434:3115`   | Page 2c- OTP wrong             | `434:3116` | 390×830    | `src/app/otp.tsx` error             | **PASS 3.19%**            |
| leave        | `540:416`    | Leave present                  | `592:488`  | 371×882    | `src/app/leave/index.tsx`           | **not implemented**       |
| leave        | `540:416`    | Leave absent                   | `592:489`  | 371×882    | `src/app/leave/index.tsx`           | **not implemented**       |
| leave        | `540:416`    | long leave                     | `592:563`  | 371×882    | `src/app/leave/range.tsx`           | **not implemented**       |
| leave        | `540:416`    | long leave selected            | `592:639`  | 371×882    | `src/app/leave/range.tsx`           | **not implemented**       |
| leave        | `540:416`    | long leave confirm             | `592:832`  | 371×882    | `src/app/leave/index.tsx`           | **not implemented**       |
| leave        | `540:416`    | long leave confirm             | `592:1008` | 371×882    | `src/app/leave/index.tsx`           | **not implemented**       |
| leave        | `540:416`    | short leave                    | `592:888`  | 371×882    | `src/app/leave/single.tsx`          | **not implemented**       |
| log in flow  | `592:1068`   | 3a- daily log in               | `575:2135` | 370×753    | `src/app/(tabs)/attendance.tsx`     | **not implemented**       |
| log in flow  | `592:1068`   | 3b- present                    | `575:2137` | 370×753    | `src/app/(tabs)/attendance.tsx`     | **not implemented**       |
| log in flow  | `592:1068`   | 3c- absent                     | `575:2138` | 370×753    | `src/app/(tabs)/attendance.tsx`     | **not implemented**       |
| log in flow  | `592:1068`   | 3d- log out                    | `575:2136` | 370×753    | `src/app/(tabs)/attendance.tsx`     | **not implemented**       |
| performance  | `575:1741`   | 12- money daily                | `575:1744` | 370×1048   | `src/app/(tabs)/money.tsx` day      | implemented, not rendered |
| performance  | `575:1741`   | 13- money weekly               | `575:1884` | 370×1258   | `src/app/(tabs)/money.tsx` cycle    | implemented, not rendered |
| performance  | `575:1741`   | 14- day history                | `575:1903` | 370×560    | `src/app/money/days.tsx`            | implemented, not rendered |
| performance  | `575:1741`   | 15- past daily                 | `575:1922` | 370×1074   | `src/app/money/day/[date].tsx`      | implemented, not rendered |
| performance  | `575:1741`   | 16- money monthly              | `575:2013` | 370×1090   | `src/app/(tabs)/money.tsx` month    | implemented, not rendered |
| performance  | `575:1741`   | 17- weekly history             | `575:2032` | 370×627    | `src/app/money/cycles.tsx`          | implemented, not rendered |
| performance  | `575:1741`   | 18- past weekly                | `575:2098` | 370×1284   | `src/app/money/cycle/[cycleId].tsx` | implemented, not rendered |
| Service flow | `485:4971`   | Page 4a- travel on time        | `462:3617` | 390×830    | `TravelView on_time`                | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 4b- travel 5 mins buffer  | `463:3779` | 390×830    | `TravelView at_risk`                | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 4b- travel 5 mins buffer  | `464:3864` | 390×830    | `TravelView late`                   | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 5a- arrival on time       | `468:3935` | 390×830    | `ArrivalView on_time`               | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 5b- arrival late          | `468:4040` | 390×830    | `ArrivalView late`                  | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 6a- Start OTP on time     | `482:4587` | 390×830    | `StartOtpView on_time`              | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 6b- Start OTP on time     | `482:4656` | 390×830    | `StartOtpView late`                 | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 7a- Cooking               | `483:4741` | 390×830    | `CookingView`                       | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 7b- Cooking (last 7 mins) | `483:4795` | 390×830    | `CookingView endingSoon`            | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 7c- Cooking extended      | `483:4835` | 390×830    | `CookingView extended`              | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 9- end OTP                | `484:4875` | 390×830    | `EndOtpView`                        | implemented, **FAIL**     |
| Service flow | `485:4971`   | Page 10- job end               | `485:4917` | 390×830    | `CompletedView`                     | implemented, **FAIL**     |

### Duplicates — compared, not consolidated

- `long leave confirm` appears twice. `592:832` carries a 228-tall single-day block with a date
  page title and no applied leave; `592:1008` carries a 343-tall two-card block with `5 November —
Chutti lag gyi` already applied. **Different states. Both counted.**
- `Page 4b- travel 5 mins buffer` appears twice — the at-risk and late renderings. Both counted.

### Excluded

- **`job flow` (`592:1070`)**, 5 frames: `583:375`, `583:401`, `583:427`, `583:453`, `583:479`.
  Recorded in `excludedJobFlowFrames` and asserted absent from the inventory by test. The existing
  `src/app/(tabs)/jobs.tsx` is retained because Service flow is unreachable without it, but it is
  not rebuilt and not counted.
- Page `0:1` "User App" in its entirety.

---

## 4. V12 → V13 changes

Established by comparing the archived V12 tree (`docs/.figma-canvas-v12-434-2401.xml`) against a
fresh V13 read, using a structural signature over tag/name/width/height at every depth.

| Section                              | V12                                    | V13                             | Verdict                                          |
| ------------------------------------ | -------------------------------------- | ------------------------------- | ------------------------------------------------ |
| `Login flow` `434:3115`              | 5 frames                               | same 5 node ids                 | **all 5 structurally identical**                 |
| `Service flow` `485:4971`            | 12 frames                              | same 12 node ids                | **all 12 structurally identical**                |
| `performance` `575:1741`             | 7 frames                               | same 7 node ids                 | **all 7 structurally identical**                 |
| `Attendance` → **`leave`** `540:416` | 8 frames `5xx:*`                       | 7 frames `592:*`                | **renamed and replaced wholesale — 0 survivors** |
| `log in flow` `592:1068`             | loose canvas frames, "not implemented" | promoted to a finalized section | **new required work, 4 screens**                 |
| `job flow` `592:1070`                | loose canvas frames                    | promoted to a section           | **excluded by the brief**                        |

Net new implementation required: **11 screens** (7 leave + 4 log in flow).
Net requiring rework against frames that never matched: **the 24 carried-over screens** (§7).

---

## 5. Viewport mapping — revalidated for V13, and one 25px error corrected

V13 uses **two authoring conventions**, which the old "every frame is 390x830" rule did not cover:

| Convention              | Sections                              | Frame                            | Application viewport                               |
| ----------------------- | ------------------------------------- | -------------------------------- | -------------------------------------------------- |
| Decorative phone bezel  | `Login flow`, `Service flow`          | 390x830                          | inner **370 x 810** at frame offset (10, 10)       |
| Frame _is_ the viewport | `leave`, `log in flow`, `performance` | 371x882 / 370x753 / 370 x varies | the whole frame; status bar is a real child at y=0 |

**In both conventions the content column measures 370dp.** That is what makes a single
`screenWidth / 370` factor correct for every V13 screen. The conventions are typed in
`src/ui/theme/viewport.ts` and mirrored in `scripts/visual/viewport.py`.

### The bezel render margin is NOT uniform — this was run 1's silent 25px error

`get_screenshot` returns _effect_ bounds. Run 1 solved a single margin from the frame arithmetic:

```
390·s + 2m = 466   and   830·s + 2m = 906   ⇒   440s = 440   ⇒   s = 1, m = 38
```

That is right horizontally and **25px too low vertically**, because the frames carry
`shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]` — a shadow offset **25px downward**. Locating the
black bezel in the pixels of every bezel-section render gives its true box as rows 13..842,
cols 38..427: 390x830 at scale 1.0, origin **(38, 13)**, i.e. left/right margin 38, top margin
`38 − 25 = 13`, bottom margin `38 + 25 = 63`.

So every `Login flow` and `Service flow` comparison in run 1 was displaced by 25 reference rows —
about 3% of the frame height, enough to score a correct render as a failure. `viewport.py` now
**measures** the bezel rather than solving a margin, and records which path it used.

### System chrome is excluded from both sides of the comparison

Every V13 frame draws a 33-unit status-bar mock, and the bezel frames add a 10-unit home-indicator
strip. Neither is application content — the OS owns those bands, and the brief forbids the app from
drawing decorative phone chrome. The emulator's own bands are a different size again: **136px**
status bar (49.45dp, tall because of the AVD's punch-hole cutout) and a **66px** gesture bar,
measured with `dumpsys window displays`.

The harness therefore aligns the two **application-owned regions** — design row 33 and emulator row
136 are treated as the same origin — and drops the chrome bands from the denominator. Every excluded
row is written into each `result.json`; nothing hides inside the tolerance.

One consequence is recorded rather than smoothed over: the emulator offers **750 design units**
between its system bars where a bezel frame's content area is **767**. Screens whose design height
fills the frame are laid out to fill the available space, and `uncomparedReferenceRows` reports the
shortfall per screen.

Emulator: 1080x2392 @ 440dpi = **392.7dp** wide, font scale 1.0, portrait, light mode.

## 6. Backend contract audit (read-only — backend NOT modified)

Source: `D:\spoon-backend`, `openapi/openapi.yaml` (86 paths) plus route and service source.

| V13 action                | Endpoint                                     | Auth                     | Deployed                     | Frontend wiring                 |
| ------------------------- | -------------------------------------------- | ------------------------ | ---------------------------- | ------------------------------- |
| Request login OTP         | `POST /auth/otp/send`                        | public                   | yes                          | `api.requestOtp`                |
| Verify OTP                | `POST /auth/otp/verify`                      | public                   | yes                          | `api.verifyOtp`                 |
| Refresh / restore session | `POST /auth/refresh`                         | refresh token            | yes                          | `api.refresh`, secure store     |
| Logout                    | `POST /auth/logout`                          | bearer                   | yes                          | wired                           |
| Approved-Cook gate        | `GET /cook/me`                               | bearer                   | yes                          | `useCookProfile`                |
| Check-in eligibility      | `GET /cook/me` + shifts                      | bearer                   | yes                          | `attendance.ts`                 |
| Mark present              | `POST /cook/attendance/present`              | bearer + Idempotency-Key | yes                          | `useMarkPresent`                |
| Monthly attendance        | `GET /cook/attendance/month`                 | bearer                   | yes                          | `useMonthlyAttendance`          |
| Attendance range          | `GET /cook/attendance`                       | bearer                   | yes                          | `useAttendanceRange`            |
| Read leaves               | `GET /cook/leaves`                           | bearer                   | yes                          | `useLeaves`                     |
| **Request leave**         | `POST /cook/leaves`                          | bearer + Idempotency-Key | **yes — V12 gap now closed** | `useRequestLeave`               |
| Earnings                  | `GET /cook/earnings`                         | bearer                   | yes                          | `useEarnings`                   |
| Earnings cycles           | `GET /cook/earnings/cycles`, `/{cycleId}`    | bearer                   | yes                          | `useEarningsCycles`, `useCycle` |
| Current job               | `GET /cook/jobs/current`                     | bearer                   | yes                          | `useCurrentJob`                 |
| Start travel              | `POST /cook/bookings/{id}/start-commute`     | bearer                   | yes                          | wired                           |
| Location reporting        | `POST /cook/location`                        | bearer                   | yes                          | `core/location/tracker.ts`      |
| Arrival                   | `POST /cook/bookings/{id}/arrive`            | bearer                   | yes                          | wired                           |
| Start OTP                 | `POST /cook/bookings/{id}/verify-start-otp`  | bearer                   | yes                          | wired                           |
| Alert acknowledgement     | `POST /cook/bookings/{id}/acknowledge-alert` | bearer                   | yes                          | wired                           |
| End OTP                   | `POST /cook/bookings/{id}/verify-end-otp`    | bearer                   | yes                          | wired                           |
| Push token                | `PUT /me/push-token`                         | bearer                   | yes                          | `core/notifications/push.ts`    |

### `POST /cook/leaves` — verified contract

Request `{ startDate, endDate, reason? }` + `Idempotency-Key`. Response `201`
`{ leaveId, type: single_day|multi_day, startDate, endDate, status: 'pending', reason, requestedAt }`.

Server rules read from `src/cooks/operations.ts`:

- `startDate` may not precede the server's Asia/Kolkata service date — **today is allowed**.
- An overlapping `pending`/`approved` leave answers `409 INVALID_BOOKING_STATE`.
- Status is always `pending` on create; Ops decides. The app must never render a request as taken.

This supports both V13 day-offer variants: `Leave absent` offers _Aaj_, `Leave present` starts at
_Kal_ because the cook is working today. That difference is a UI projection, not a server rule.

### Remaining backend gaps

- **No cook-side extension channel** — `Page 7c- Cooking extended` (`483:4835`) can be rendered
  from server state but the cook cannot initiate or confirm an extension. Carried over as GAP-07.
- **No cook rating aggregate** — the rating shown on performance frames has no endpoint (GAP-02 /
  GAP-24).
- No new gap was introduced by V13, and the largest V12 gap (cook leave submission) is closed.

---

## 7. What was measured, and what it shows

Evidence lives in `docs/visual-verification/v13/<section>/<node-id>/`, and the derived roll-up is
`docs/visual-verification/v13/MANIFEST.md` (regenerate with `python scripts/visual/manifest.py
--write`; every column is read back from an artefact, so a row cannot claim work that left no
trace).

### `Login flow` — 5 / 5 PASS

| Node       | Screen               | diff % (tol 12) | raw % | best vertical offset |
| ---------- | -------------------- | --------------- | ----- | -------------------- |
| `434:3330` | Page 0- loading page | **0.99**        | 61.95 | 0                    |
| `434:3280` | Page 1- Login No.    | **5.64**        | 44.86 | 0                    |
| `434:3224` | Page 2a- Login OTP   | **2.58**        | 5.24  | 0                    |
| `434:3174` | Page 2b- OTP resend  | **2.82**        | 5.43  | 0                    |
| `434:3116` | Page 2c- OTP wrong   | **3.19**        | 5.94  | 0                    |

A percentage alone cannot separate "rasterises differently" from "is in the wrong place", so
`compare.py` also searches ±10 rows for the offset that minimises the difference and records it.
**All five screens minimise at offset 0**, which means each is on its design row and the residue is
antialiasing. Screens carrying a photograph or dense small type sit higher than flat ones for that
reason alone — `434:3280` is 5.64% almost entirely from resampling the hero photograph and the 9px
legal line, while the vector-and-gradient boot screen is 0.99%.

### Defects this section found and fixed

| Defect                                                                              | Found by                         |
| ----------------------------------------------------------------------------------- | -------------------------------- |
| Comparison harness displaced 25px on every bezel frame                              | locating the bezel in pixels     |
| Named text variants used raw design px, so all `variant=` copy rendered ~6% small   | edit glyph landing 12 units left |
| `+91` divider stretched the full 43-unit field; the design draws one 24-unit rule   | overlay zoom                     |
| OTP error tile painted `#ffeded`; the design stacks the 7% tint twice -> `#ffdcdc`  | sampling the reference           |
| Resend row painted a full-width `#ececec` band Android adds to a row-wide pressable | per-band diff (28% in one band)  |
| Transparent OTP capture field still painted its value across tile 1                 | tile zoom                        |
| Field radius 21.5 (pill) and CTA radius 17; V13 states literal 15 and 16            | design context                   |

### The other 30 screens

`emulator.png` exists for the 12 `Service flow` screens from run 1, but they are **carried over from
V12, never rebuilt against a V13 design context, and every one fails its frame**. They are reported
as `carried-over`, not as implemented. The 18 `leave`, `log in flow` and `performance` screens have
no V13 context, no assets and no implementation.

## 8. What was built in run 2

| Area             | Change                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Figma access     | Remote MCP re-authenticated to the Full-seat identity that owns the file; `get_design_context` captured for all 5 `Login flow` nodes     |
| Assets           | `assets/images/figma-v13/` — 4 originals fetched from the design-context URLs, content-hashed and deduplicated, with per-node provenance |
| Vector rendering | `buffer` polyfill added, which unblocks `react-native-svg`; gradients and icons are now drawn, not rastered                              |
| Viewport         | `src/ui/theme/viewport.ts` — typed `bezel` / `direct` profiles, status-band and home-indicator constants                                 |
| Login flow       | `src/features/login/LoginViews.tsx` — `BootView`, `PhoneView`, `OtpView`; the three routes reduced to behaviour only                     |
| Type scale       | `Text` now scales variant metrics by `screenWidth / 370`; they were raw design px, so every named variant rendered ~6% small             |
| Harness          | `viewport.py` locates the bezel; `compare.py` excludes system chrome and probes displacement; `capture_emulator.py` warms up and retries |
| Tooling          | `capture_assets.py`, `build_icons.py`, `manifest.py` added                                                                               |
| Evidence         | 5 emulator renders + overlays + diffs + `result.json`, and a derived `MANIFEST.md`                                                       |
| Tests            | `loginV12`/`loginFlowV12` renamed and rewritten to the V13 contract; gallery test extended; **336 pass**                                 |

### Assets committed

| File                   | Bytes     | Figma nodes                                    |
| ---------------------- | --------- | ---------------------------------------------- |
| `login-hero.png`       | 1,863,547 | `434:3280`                                     |
| `spoon-logo.png`       | 579,329   | `434:3116`, `434:3280`, `434:3224`, `434:3174` |
| `spoon-brand-logo.png` | 492,733   | `434:3330`                                     |
| `edit-icon.svg`        | 1,435     | `434:3116`, `434:3224`, `434:3174`             |

`capture_assets.py` deduplicates by SHA-256, which is how one `spoon-logo.png` covers four frames
that each returned a different URL for identical bytes. `build_icons.py` regenerates
`src/ui/icons/figmaV13Icons.ts` from the committed `.svg`, so the vector data in TypeScript is
provably the export rather than a redrawing.

### The capture harness had to be hardened before any of this was trustworthy

Three failure modes each produced a plausible-looking PNG that run 1's blank check accepted:

1. **Deep-linking into a cold process** corrupts expo-router's navigation state (`StackRouter`
   throws on `state.routes`), so the capture is the red dev error overlay. The run now launches
   through the LAUNCHER intent, waits a floor, then polls for two consecutive clean frames.
2. **Metro's reload banner** sits on screen right after an edit — exactly when a capture runs.
3. **A black frame** has enough variance from the gesture pill to clear a standard-deviation check.

`reject_reason()` now names all three, and the run resets the app and retries rather than writing
them to disk as evidence.

## 9. Emulator configuration and result

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| AVD           | `Ref393GA`, headless (`-no-window -gpu swiftshader_indirect`) |
| `adb devices` | `emulator-5554  device`                                       |
| `wm size`     | `1080x2392`                                                   |
| `wm density`  | `440` → **392.7dp** logical width                             |
| `font_scale`  | `1.0`                                                         |
| Package       | `com.spoonhelp.cookapp.dev`                                   |

- `npx expo prebuild --platform android --clean` — regenerated `android/` from scratch.
- **NDK override survived the clean prebuild**: `ndkVersion = "27.2.12479018"` present in the
  regenerated `android/build.gradle`. This is the durability requirement, verified by deleting and
  regenerating `android/`.
- `./gradlew assembleDebug` — **succeeded**, `app-debug.apk` 239 MB.
- `adb install -r -t` — **Success**.
- Metro started; app cold-launched; `ReactNativeJS: Running "main"` with Fabric; **no fatal
  exceptions**; boot screen then Login screen rendered.
- One SystemUI ANR occurred while the build was still consuming the machine; it was dismissed and
  the app relaunched cleanly. It is an emulator-load artifact, not an app fault.

Not performed: scroll-extent capture, keyboard open/dismissed capture, background→foreground and
process-restart capture. These were not reached because the screens they apply to are either
unimplemented or pending rework.

---

## 10. Blockers

### B1 — `get_design_context` unavailable (run 1) — **RESOLVED**

Run 1 attributed this to a missing Figma Dev Mode allowed directory plus a local rate limit. Both
were real for the _local_ server, but neither was the actual constraint: the **remote** server
returns assets as URLs and needs no allowed directory at all. It was refusing the file because the
session was authenticated as an identity the file had never been shared with. Re-authenticating as
the owning account cleared it — see §2. No allowed directory was ever needed.

### B2 — No approved test Cook (unchanged)

Authenticated end-to-end against the deployed backend was not run. The dev gallery is the
mitigation and now covers 17 states, but only the 5 `Login flow` entries are built to V13.

### B3 — Figma MCP disconnected mid-run (new; blocks the remaining 30 screens)

The `figma` MCP server disconnected during run 2 and now reports that it **requires
re-authorisation**. The session it disconnected in is non-interactive, so the OAuth flow cannot be
completed from here. The local desktop server is not an alternative: it answered _"Rate limit
exceeded, please try again tomorrow"_ for the whole run, and it too is now disconnected.

**Consequence.** The brief requires `get_design_context` before editing each screen, forbids
substituting metadata or screenshots for it, and forbids invented artwork. The 30 remaining screens
depend on design context and on original assets — the walking-Cook illustration, the cooking
photographs, the "Great Job!" celebration, the praying-hands artwork, the address and timer icons —
none of which can be exported while the server is unauthorised. Rather than approximate them, those
screens were **not built**.

**Fix.** Re-authorise the Figma MCP from an interactive session (`/mcp` -> `figma` -> authenticate),
confirm with `mcp__figma__whoami` that the identity is the Full-seat account from §2, then resume at
`log in flow` — the next section in the brief's order.

## 11. Verification gates

| Gate                                          | Result                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| TypeScript (`tsc --noEmit`, strict)           | **PASS**                                                           |
| ESLint (`--max-warnings=0`)                   | **PASS**                                                           |
| Prettier (`--check .`)                        | **PASS**                                                           |
| Jest                                          | **PASS — 336/336, 19 suites**                                      |
| Expo export (android)                         | **PASS — 4.3MB hbc**                                               |
| `git diff --check`                            | **PASS**                                                           |
| Secret scan                                   | **PASS** — no keys, tokens or device identifiers in the diff       |
| APK install + cold launch on emulator         | **PASS** (run 1 APK, Metro-served bundle)                          |
| Clean Expo prebuild                           | not re-run in run 2 (unchanged since run 1: PASS)                  |
| NDK override survives `android/` regeneration | not re-run in run 2 (unchanged since run 1: PASS)                  |
| Native Android debug build                    | not re-run in run 2 — run 1's APK was reused                       |
| 35 screens implemented                        | **FAIL — 5 implemented, 12 carried over from V12, 18 not started** |
| 35 screens pixel-verified                     | **FAIL — 5 PASS, 30 outstanding**                                  |

### Completion counters

```
FINAL_SECTION_SCREEN_COUNT:    35
SCREENS_IMPLEMENTED:            5
SCREENS_CARRIED_OVER_FROM_V12: 12
SCREENS_EMULATOR_RENDERED:     17
SCREENS_PIXEL_VERIFIED:         5
SCREENS_STILL_MISMATCHING:     30
ORIGINAL_FIGMA_ASSETS_USED:    YES (Login flow only — 4 assets, all fetched from Figma)
VISUAL_GALLERY_COMPLETE:       NO  (17 of 35 states, 5 of them built to V13)
```

The native build was not re-run because no native dependency changed shape: `buffer` is pure JS, and
`react-native-svg` was already linked into run 1's APK — its native module was present but unused.
`react-native-svg` sits at 15.13.0 where Expo expects 15.15.4; that mismatch is benign for the
components used here, but it should be closed with `npx expo install react-native-svg` **and a
native rebuild** before the next APK ships.

## 12. What must happen next

1. **Re-authorise the Figma MCP** from an interactive session and confirm the identity with
   `mcp__figma__whoami` (§2). Nothing below can start until this is done.
2. Resume the brief's order at **`log in flow`** (4 screens), then `leave` (7), `performance` (7),
   `Service flow` (12). Per screen: `get_design_context` -> fetch assets in the same pass (the URLs
   expire in ~7 days) -> implement -> gallery entry -> capture -> compare -> correct until the
   displacement probe reads 0 and the residue is antialiasing.
3. Re-capture the `performance` references at full resolution. Four of them were rendered by the
   local server under a 1024px longer-edge cap (`575:2098` is 370x1284 captured at 296x1024), so
   their reference detail is degraded; the remote server accepts a `maxDimension` large enough to
   avoid it.
4. Rework the 12 carried-over `Service flow` screens against their V13 context. The corrections
   named in the brief still stand and start at `462:3617`: the walking-Cook illustration, the lime
   countdown card, the yellow address icons, `Map dekhe` as the exact yellow pill, and removal of
   the unapproved visible Society gate block — while keeping map navigation targeting the
   backend-projected society gate.
5. Close the `react-native-svg` version mismatch and re-run the native build, prebuild-durability
   and APK-install gates.
