# Cook App — V13 pixel-perfect closure

Status: **incomplete — 16 of 35 screens verified. `Login flow`, `log in flow` and `leave` are closed; `performance` (7) and `Service flow` (12) are not.**
This report records what was established, what was built, what was measured, and exactly what is
blocking the rest. It is not a claim of completion.

> **Run 3 (2026-08-24)** re-authorised the remote Figma MCP and closed two more sections —
> `log in flow` (4) and `leave` (7) — taking the verified total from 5 to 16. It found and fixed
> three systematic errors in how the app reproduced Figma geometry, and two gaps in the capture
> harness that had been writing unusable evidence. It did **not** reach `performance` or
> `Service flow`. Sections 7 onward are current as of run 3; sections 1-6 are unchanged and remain
> accurate except where run 3 corrected the status band, which §5 now under-states — see §7.

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
| Login flow   | `434:3115`   | Page 0- loading page           | `434:3330` | 390×830    | `src/app/index.tsx`                 | **PASS 0.55%**            |
| Login flow   | `434:3115`   | Page 1- Login No.              | `434:3280` | 390×830    | `src/app/login.tsx`                 | **PASS 4.81%**            |
| Login flow   | `434:3115`   | Page 2a- Login OTP             | `434:3224` | 390×830    | `src/app/otp.tsx` countdown         | **PASS 2.41%**            |
| Login flow   | `434:3115`   | Page 2b- OTP resend            | `434:3174` | 390×830    | `src/app/otp.tsx` resend            | **PASS 2.79%**            |
| Login flow   | `434:3115`   | Page 2c- OTP wrong             | `434:3116` | 390×830    | `src/app/otp.tsx` error             | **PASS 3.17%**            |
| leave        | `540:416`    | Leave present                  | `592:488`  | 371×882    | `src/app/(tabs)/chutti.tsx`         | **PASS 11.14%**           |
| leave        | `540:416`    | Leave absent                   | `592:489`  | 371×882    | `src/app/(tabs)/chutti.tsx`         | **PASS 10.15%**           |
| leave        | `540:416`    | long leave                     | `592:563`  | 371×882    | `src/app/leave/range.tsx`           | **PASS 6.81%**            |
| leave        | `540:416`    | long leave selected            | `592:639`  | 371×882    | `src/app/leave/range.tsx`           | **PASS 11.62%**           |
| leave        | `540:416`    | long leave confirm             | `592:832`  | 371×882    | `src/app/(tabs)/chutti.tsx`         | **PASS 10.41%**           |
| leave        | `540:416`    | long leave confirm             | `592:1008` | 371×882    | `src/app/(tabs)/chutti.tsx`         | **PASS 11.87%**           |
| leave        | `540:416`    | short leave                    | `592:888`  | 371×882    | `src/app/leave/single.tsx`          | **PASS 5.55%**            |
| log in flow  | `592:1068`   | 3a- daily log in               | `575:2135` | 370×753    | `src/app/(tabs)/attendance.tsx`     | **PASS 3.84%**            |
| log in flow  | `592:1068`   | 3b- present                    | `575:2137` | 370×753    | `src/app/(tabs)/attendance.tsx`     | **PASS 3.63%**            |
| log in flow  | `592:1068`   | 3c- absent                     | `575:2138` | 370×753    | `src/app/(tabs)/attendance.tsx`     | **PASS 2.98%**            |
| log in flow  | `592:1068`   | 3d- log out                    | `575:2136` | 370×753    | `src/app/(tabs)/attendance.tsx`     | **PASS 3.86%**            |
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

### Verified — 16 of 35

| Node       | Section     | Screen               | diff % (tol 12) | displacement |
| ---------- | ----------- | -------------------- | --------------- | ------------ |
| `434:3330` | Login flow  | Page 0- loading page | **0.55**        | 0            |
| `434:3280` | Login flow  | Page 1- Login No.    | **4.81**        | 0            |
| `434:3224` | Login flow  | Page 2a- Login OTP   | **2.41**        | 0            |
| `434:3174` | Login flow  | Page 2b- OTP resend  | **2.79**        | 0            |
| `434:3116` | Login flow  | Page 2c- OTP wrong   | **3.17**        | 0            |
| `575:2135` | log in flow | 3a- daily log in     | **3.84**        | 0            |
| `575:2137` | log in flow | 3b- present          | **3.63**        | 0            |
| `575:2138` | log in flow | 3c- absent           | **2.98**        | 0            |
| `575:2136` | log in flow | 3d- log out          | **3.86**        | 0            |
| `592:488`  | leave       | Leave present        | **11.14**       | 0            |
| `592:489`  | leave       | Leave absent         | **10.15**       | 0            |
| `592:832`  | leave       | long leave confirm   | **10.41**       | 0            |
| `592:1008` | leave       | long leave confirm   | **11.87**       | 0            |
| `592:563`  | leave       | long leave           | **6.81**        | -1           |
| `592:639`  | leave       | long leave selected  | **11.62**       | -1           |
| `592:888`  | leave       | short leave          | **5.55**        | 0            |

A percentage alone cannot separate "rasterises differently" from "is in the wrong place", so
`compare.py` searches +/-10 rows for the offset that minimises the difference. **Every verified
screen minimises at 0 or -1**, which means it is on its design row and the residue is rasterisation.

The `leave` percentages are two to three times the others' and that is a property of the frames,
not a weaker result: those screens are almost entirely 1- and 2-unit borders and 11-14px type on
white — the calendar alone is forty-nine rounded cells — and a 1-unit border is the worst case for
comparing a 1x vector render against a 2.75x raster downsample. The overlays show every element on
its row, at its size, in its colour.

### The residue, classified

The `Login flow` evidence was re-examined before closure, as the brief required, rather than being
accepted on its displacement probe alone. Reading the five overlays and sampling the differing
pixels:

| Screen     | diff | what the residue actually is                                                    |
| ---------- | ---- | ------------------------------------------------------------------------------- |
| `434:3330` | 0.55 | gradient banding and the brand mark's edges — image resampling                  |
| `434:3280` | 4.81 | the hero photograph's high-contrast edges, plus the 9px legal line — resampling |
| `434:3224` | 2.41 | OTP tile borders and small type — rasterisation                                 |
| `434:3174` | 2.79 | as above, plus the resend row's type                                            |
| `434:3116` | 3.17 | as above, plus the error tile's border                                          |

No colour, typography, asset, crop or geometry mismatch survives on those five. The two that were
found during run 2 (the `+91` divider and the doubled error tint) are fixed and stay fixed.

### Three geometry errors run 3 found, all systematic

1. **Figma strokes are centre-aligned and do not grow the frame. Yoga's `borderWidth` does.**
   A 68-unit row with a 2-unit stroke lays out as 68 units in Figma and paints 70; in RN it laid
   out as 72. On a screen that stacks bordered rows inside bordered cards the error compounded to
   **nine design units** by the bottom of the frame, with every element individually the right
   size. `src/ui/theme/stroke.ts` takes half the stroke out of the padding and half out of the
   margin, restoring both boxes. This is the single largest correction in this run.
2. **The bottom sheets sat on the display's bottom edge, not the safe-area edge**, putting their
   last 24dp — including the lower half of `Pakka` — behind the gesture bar. Worth 22 design units
   of displacement, and wrong on a device regardless of the comparison.
3. **The card glow was drawn at the alpha its CSS states rather than the alpha the design renders.**
   Figma clips the effect against the `overflow-auto` frame, so the reference peaks at 2.75% where
   `rgba(255,214,0,0.22)` paints 13%. The literal value put a visible wash across seventeen rows
   the reference leaves white.

### The status band is per section, and it is three different numbers

§5 states one figure. That was right for the bezel sections and wrong for the others:

| Section                      | band   | why                                                      |
| ---------------------------- | ------ | -------------------------------------------------------- |
| `Login flow`, `Service flow` | 33     | the value the five closed Login comparisons minimise at  |
| `log in flow`, `performance` | 32     | `575:1743` is 32 units; its notch is `bottom-1/4` = 24   |
| `leave`                      | 36.198 | `526:348` is an explicit 36.198-unit row with a hairline |

Applying one number to all five would drop a real design row from the top of eighteen screens.
The three are typed separately in `src/ui/theme/viewport.ts` and in `scripts/visual/compare.py`,
and `viewportProfile.test.ts` asserts the two files agree by parsing the Python source — a comment
claiming they agree is not evidence.

### The comparison is anchored per frame, not per section

`592:563`, `592:639` and `592:888` are bottom sheets whose frames are 846 content units against the
emulator's 750. On a top-anchored screen the 96 units that cannot be shown are content at the
bottom, which the reader scrolls to. On a sheet they are **scrim at the top**. Aligning those three
by their first row would displace every element in them by 96 units and score a correct render as a
total failure, so `compare.py` aligns them by their last row and writes `anchor` into every
`result.json`.

### One deliberate deviation

`592:563` and `592:639` both draw a **31 November**, which does not exist. The grid is generated
from the real length of the month it is given, so that one cell is empty in the app. Reproducing it
would put a date on screen that `POST /cook/leaves` rejects. It is the only place either frame is
knowingly not matched, and it costs about a quarter of one percent of the frame.

### The nineteen that are not done

`performance` (7) has its references re-captured at full resolution and one of seven design
contexts taken; nothing is implemented against V13. `Service flow` (12) still carries the V12
implementation from run 1 — it renders, it was never rebuilt against a V13 design context, and
every one of the twelve fails its frame at 26-47%. Both are reported as outstanding, not as
partially done.

---

## 8. What was built in run 3

| Area          | Change                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `log in flow` | `src/features/attendance/AttendanceViews.tsx` — four frames as four states of the attendance screen; `src/app/(tabs)/attendance.tsx` rewired |
| `leave`       | `src/features/leave/` — the CHUTTI destination, the month-grid sheet and the confirm sheet; a new `chutti` tab and two sheet routes          |
| Assets        | 30 originals in `assets/images/figma-v13/`, each content-hashed with per-node provenance in `ASSETS.json`                                    |
| Geometry      | `src/ui/theme/stroke.ts` — the centre-aligned-stroke correction                                                                              |
| Viewport      | `viewport.ts` + `compare.py` — three typed status bands, per-frame anchoring, and a test that asserts the two files agree                    |
| Resampling    | `compare.py` — BOX (area average) instead of LANCZOS, which rings around every hard edge                                                     |
| Type scale    | 13 named V13 text styles added; nothing bypasses `Text`, so nothing bypasses the design scale                                                |
| Harness       | splash-screen rejection in `capture_emulator.py`; `metro.config.js` added                                                                    |

### The two harness gaps, because both wrote false evidence

- **The capture script accepted an Expo splash screen as a screen render.** It is neither blank nor
  an error overlay, so it passed every check, and four `log in flow` frames were written to disk
  that way and scored 99%. `reject_reason` now refuses any body that is 85%+ a single saturated
  colour.
- **The project had no `metro.config.js`**, so the dev server resolved `/index.bundle` — the URL the
  debug APK asks for — as a literal request for `./index` at the project root. The bundle 404d and
  the app sat on its splash with `Unable to load script`. That is what produced the four splash
  captures.

### Resampling: why BOX, and how it was checked

The emulator renders at 2.92x the reference's resolution, so every comparison is a downsample.
LANCZOS is a sharpening kernel: it rang around every hard edge and reported a 1-unit lime border as
a 47/255 error plus over- and undershoot on the rows either side, none of which is a property of
the app's render. Area averaging is what a display does when it integrates 2.92 device pixels into
one, and it invents nothing. The check that it is not simply looser: it scores **every** already-
closed `Login flow` screen the same or better (0.99 -> 0.55, 5.64 -> 4.81, 2.58 -> 2.41,
2.82 -> 2.79, 3.19 -> 3.17).

---

## 9. Emulator configuration and result

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| AVD           | `Ref393GA`, headless (`-no-window -gpu swiftshader_indirect`) |
| `adb devices` | `emulator-5554  device`                                       |
| `wm size`     | `1080x2392`                                                   |
| `wm density`  | `440` → **392.7dp** logical width                             |
| `font_scale`  | `1.0`                                                         |
| Status bar    | 136px; navigation bar 66px (`dumpsys window displays`)        |
| Package       | `com.spoonhelp.cookapp.dev`                                   |

Re-verified at the start of run 3 and unchanged. Twenty-eight states were deep-linked and captured
through `/dev`; all sixteen verified screens were captured on a Metro-served debug bundle.

Not performed in run 3: a native rebuild, a clean prebuild, and an APK reinstall. No native
dependency changed shape — every change in this run is JavaScript — so run 1's APK was reused, and
that is recorded as a gap rather than as a pass.

---

## 10. Blockers

### B1 — `get_design_context` unavailable (run 1) — **RESOLVED**

### B2 — No approved test Cook (unchanged)

Authenticated end-to-end against the deployed backend was not run. The dev gallery is the
mitigation and now covers 28 states, 16 of them built to V13.

### B3 — Figma MCP disconnected (run 2) — **RESOLVED**

Re-authorised as `lakshay58csea24@bpitindia.edu.in` (Full seat, owning team). Nineteen design
contexts were captured in run 3 without a single access failure.

### B4 — `performance` and `Service flow` not reached (new)

Not a blocker in the sense of something preventing the work — Figma access is live, the emulator is
up, and the harness is in better shape than it has been. Nineteen screens are simply not built.
They are counted as outstanding below.

### Known backend gaps, unchanged

- Cook extension action/channel — no endpoint; `Page 7c- Cooking extended` is a `/dev` state only.
- Cook rating aggregate — not exposed; the rating band reads what the profile carries.
- **New in run 3:** no backend signal for "the shift has finished". `575:2136` is selected from the
  server's `present` record plus the shift's own end time on the device clock — a presentation
  choice, never a change to the record. Recorded here rather than left implicit.
- **Unchanged and still enforced:** `/cook/me` returns `checkInOpensAt: null`, so the check-in
  deadline `540:402` draws is withheld in production and supplied only by `/dev/login-flow/daily`.

---

## 11. Verification gates

| Gate                                          | Result                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| TypeScript (`tsc --noEmit`, strict)           | **PASS**                                                           |
| ESLint (`--max-warnings=0`)                   | **PASS**                                                           |
| Prettier (`--check .`)                        | **PASS**                                                           |
| Jest                                          | **PASS — 363/363, 21 suites**                                      |
| `git diff --check`                            | **PASS**                                                           |
| Secret scan                                   | **PASS** — no keys, tokens or device identifiers in the diff       |
| Emulator capture + comparison                 | **PASS for 16 screens**                                            |
| Expo export (android)                         | not re-run in run 3                                                |
| Clean Expo prebuild                           | not re-run in run 3 (unchanged since run 1: PASS)                  |
| NDK override survives `android/` regeneration | not re-run in run 3 (unchanged since run 1: PASS)                  |
| Native Android debug build                    | not re-run in run 3 — run 1's APK was reused                       |
| APK install + cold launch                     | not re-run in run 3                                                |
| 35 screens implemented                        | **FAIL — 16 implemented, 12 carried over from V12, 7 not started** |
| 35 screens pixel-verified                     | **FAIL — 16 PASS, 19 outstanding**                                 |

### Completion counters

```
FINAL_SECTION_SCREEN_COUNT:    35
SCREENS_IMPLEMENTED:           16
SCREENS_CARRIED_OVER_FROM_V12: 12
SCREENS_EMULATOR_RENDERED:     28
SCREENS_PIXEL_VERIFIED:        16
SCREENS_STILL_MISMATCHING:     19
ORIGINAL_FIGMA_ASSETS_USED:    YES (30 assets, every one fetched from a design-context URL)
VISUAL_GALLERY_COMPLETE:       NO  (28 of 35 states, 16 of them built to V13)
```

`react-native-svg` sits at 15.13.0 where Expo expects 15.15.4. Benign for the components used, but
it should be closed with `npx expo install react-native-svg` **and** a native rebuild before the
next APK ships.

---

## 12. What must happen next

1. **`performance` (7).** References are already re-captured at full resolution — four of them were
   previously rendered under a 1024px cap and are now 1x — and `575:1903` and `575:2032` have their
   design contexts and assets. The remaining five contexts, the gallery entries and the comparison
   are outstanding. The existing V12 components in `src/ui/components/Performance.tsx` are the
   starting point, not a substitute for the context call.
2. **`Service flow` (12).** Still V12. The corrections named in the brief stand and start at
   `462:3617`: the walking-Cook illustration, the lime countdown card, the yellow address icons,
   `Map dekhe` as the exact yellow pill, and removal of the unapproved visible Society gate block —
   while keeping map navigation targeting the backend-projected society gate.
3. Apply `figmaStroke` to the `Service flow` and `performance` components as they are rebuilt. The
   centre-aligned-stroke error is present wherever a V12 component draws a border, and it is the
   difference between a screen that is nine units out by the bottom and one that is not.
4. Close the `react-native-svg` version mismatch and re-run the native build, prebuild-durability,
   APK-install and expo-export gates.
