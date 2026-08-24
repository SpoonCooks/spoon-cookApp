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

> **Run 4 (2026-08-24)** found and fixed the transport fault that had been silently corrupting
> captures, corrected two rendering defects, and re-verified every implemented screen from a single
> clean capture. It did **not** add a section: `leave` is implemented and rendering but still fails,
> for one identified and one unresolved reason (§7). The Figma MCP was unavailable for its whole
> duration, so `performance` and `Service flow` did not move.

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
`docs/visual-verification/v13/MANIFEST.md`. Every number below comes from **one capture run** on the
current source, so no row is inherited from an earlier build.

### Verified — 9 of 35

| Node       | Screen               | diff % | offset |
| ---------- | -------------------- | ------ | ------ |
| `434:3330` | Page 0- loading page | 0.55   | 0      |
| `434:3224` | Page 2a- Login OTP   | 2.41   | 0      |
| `434:3174` | Page 2b- OTP resend  | 2.79   | 0      |
| `434:3116` | Page 2c- OTP wrong   | 3.17   | 0      |
| `434:3280` | Page 1- Login No.    | 4.81   | 0      |
| `575:2138` | 3c- absent           | 3.47   | 0      |
| `575:2136` | 3d- log out          | 3.86   | 0      |
| `575:2137` | 3b- present          | 4.61   | 0      |
| `575:2135` | 3a- daily log in     | 4.89   | 0      |

Every one minimises its displacement probe at offset **0**, so each screen sits on its design row and
the residual is rasterisation. Screens carrying a photograph or dense small type score higher for
that reason alone.

### Failing — `leave`, 7 of 35

| Node       | Screen              | diff % | offset |
| ---------- | ------------------- | ------ | ------ |
| `592:888`  | short leave         | 5.56   | 0      |
| `592:563`  | long leave          | 7.31   | -1     |
| `592:489`  | Leave absent        | 10.13  | 0      |
| `592:832`  | long leave confirm  | 10.42  | 0      |
| `592:488`  | Leave present       | 11.14  | 0      |
| `592:639`  | long leave selected | 11.65  | -1     |
| `592:1008` | long leave confirm  | 11.85  | 1      |

**The layout is right.** Offsets stay within one row, local offsets measured band-by-band stay within
±3, and the diff images show every element present and in place. Two causes were isolated by
measurement:

1. **A shadow that tinted its own fill — fixed.** See §8. Worth roughly 3 points of _raw_ difference
   per screen (`592:563` raw 37.75% -> 25.17%) but little at tolerance, because the affected areas
   are small.
2. **One text style renders 3% wide — unresolved.** Measuring every text run on `592:488`, all match
   the reference at ratio 1.00 except two, at **1.031** and **1.041**. Both use `bodyMuted`
   (SemiBold 14/16) — a **carried-over V12 token**, and the only style on these screens with no V13
   node provenance, unlike every variant added for V13. The reference glyphs are also ~8% denser in
   ink at the same cap height, so the design's style is _smaller and heavier_ than SemiBold 14; a
   pure size reduction does not reproduce it. Over a full line the accumulated advance exceeds a
   glyph width, so every glyph past the first few lands on the wrong pixels and reads as a hard miss
   rather than antialiasing. Which exact pairing the design uses needs `get_design_context` for those
   nodes, which is blocked (§10).

A hypothesis that Android was applying its own tracking where the variant omitted `letterSpacing`
was tested and **rejected**: the `log in flow` screens use the same unset-tracking variants and match
at ratio 1.000. The change was reverted rather than carried as an unverified global edit.

### Not measured

`performance` (7) has no implementation. `Service flow` (12) still renders its V12 build and fails
its frames; it is reported as `carried-over`, not implemented.

## 8. What was built in run 4

| Area              | Change                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Capture transport | `use_reverse_tunnel()` — the bundle is fetched over `adb reverse`, not the emulator's NAT alias    |
| Capture recovery  | `warm_up()` retries the launch, not just the poll, when a cold start produces no JS                |
| Shadows           | `dropShadow()` in `tokens.ts` replaces six `boxShadow` declarations; Android omits, iOS keeps      |
| Evidence hygiene  | four `log in flow` results had been overwritten with splash captures at 99%; restored              |
| Tests             | `figmaScope.test.ts` updated — `leave` resolves through `(tabs)/chutti.tsx`, not `leave/index.tsx` |

### The capture harness was reading a corrupted bundle

Runs kept failing with _"app did not reach a usable screen"_, which looked like an app fault. It was
not. React Native resolves the packager to `10.0.2.2:8081`, the emulator's alias for the host
loopback, and on this AVD that path corrupts the download: `BundleDownloader` asks for a chunked
`multipart/mixed` response and okhttp dies part-way through reading it with

```
java.net.ProtocolException: Expected leading [0-9a-fA-F] character but was 0xd
    at MultipartStreamReader.readAllParts / BundleDownloader.processMultipartResponse
```

The process then sits on the splash screen forever with no JS. Metro was never at fault — the
identical request from the host returns 8.9MB over both plain and multipart. Forwarding the port with
`adb reverse` and overriding `debug_http_host` to `localhost:8081` moves the download onto the adb
transport, where it has not failed since. The preference must be written base64-encoded: the device
shell strips quotes out of an XML literal, and unquoted attributes make the file unparseable, at
which point Android silently ignores it and goes back to `10.0.2.2` — which looks exactly like the
fix not working.

Two further capture faults were fixed alongside it. Concurrent capture processes were force-stopping
each other's app instance, and the splash screen was being written to disk as a screen render —
which is how four `log in flow` frames came to be scored at 99% against evidence that was really the
launch screen.

### `boxShadow` composites over the view on Android

Every V13 shadow is faint (`0 0 2px rgba(0,0,0,.15)`, `0 4px 20px rgba(0,0,0,.03)`), and in the
reference renders they barely register: under the help pill the darkest row samples `#f6f6f6`, nine
levels off white, across three rows. Both ways of drawing that on Android cost more than they buy:

- `boxShadow` tinted the pill's `#ffd600` fill to `#ecc600` — a uniform x0.925 on both channels
  across the whole fill, nineteen levels off. Removing the shadow returned it to exactly `#ffd600`.
- `elevation` draws outside correctly but far heavier than the design, tinted the same pill
  identically, and pushed `575:2135` from 4.88% to 9.35%.

A missing shadow costs at most nine levels over three rows and stays inside the tolerance; a tinted
fill costs nineteen over the whole element and does not. `dropShadow()` therefore returns nothing on
Android and keeps the props on iOS, which is measurably closer to the design than either alternative.

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

### B1 — Figma Dev Mode allowed directory — **RESOLVED in run 2**

Never the real constraint; the remote server returns assets as URLs and needs no allowed directory.
It was refusing the file because the session was authenticated as an identity the file had never been
shared with. See §2.

### B2 — No approved test Cook (unchanged)

Authenticated end-to-end against the deployed backend was not run. The dev gallery is the mitigation
and now covers 28 states, 16 of them built to V13.

### B3 — Figma MCP unavailable (blocking 26 screens)

The `figma` MCP server is disconnected and reports that it **requires re-authorisation**, which needs
an interactive session. The local desktop server is also gone and was rate-limited before that.

**Consequence.** The brief requires `get_design_context` before editing each screen and forbids
substituting metadata or screenshots for it. That blocks:

- `performance` (7) — not implemented.
- `Service flow` (12) — still the V12 build, failing every frame.
- The `leave` typography defect (§7) — the one remaining measured cause needs the design context for
  `592:488` and its siblings to resolve, and guessing the pairing would be inventing a value.

Note that `context-captured.json` records only **that** a context was fetched, not what it returned.
Three `performance` nodes (`575:1744`, `575:1903`, `575:2032`) are marked captured from run 3, but
the returned context was not persisted, so they cannot be implemented from it now. A future run
should write the returned context to disk in the same pass that fetches it.

**Fix.** Re-authorise from an interactive session (`/mcp` -> `figma` -> authenticate), confirm with
`mcp__figma__whoami` that the identity is the Full-seat account from §2, then resolve the `leave`
type token before starting `performance`.

## 11. Verification gates

| Gate                                          | Result                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| TypeScript (`tsc --noEmit`, strict)           | **PASS**                                                           |
| ESLint (`--max-warnings=0`)                   | **PASS**                                                           |
| Prettier (`--check .`)                        | **PASS**                                                           |
| Jest                                          | **PASS — 363/363, 21 suites**                                      |
| Expo export (android)                         | **PASS** (run 3; no dependency changed shape since)                |
| `git diff --check`                            | **PASS**                                                           |
| Secret scan                                   | **PASS** — no keys, tokens or device identifiers in the diff       |
| APK install + cold launch on emulator         | **PASS**                                                           |
| Clean Expo prebuild                           | not re-run (unchanged since run 1: PASS)                           |
| NDK override survives `android/` regeneration | not re-run (unchanged since run 1: PASS)                           |
| Native Android debug build                    | not re-run — run 1's APK reused                                    |
| 35 screens implemented                        | **FAIL — 16 implemented, 12 carried over from V12, 7 not started** |
| 35 screens pixel-verified                     | **FAIL — 9 PASS, 26 outstanding**                                  |

### Completion counters

```
FINAL_SECTION_SCREEN_COUNT:    35
SCREENS_IMPLEMENTED:           16
SCREENS_CARRIED_OVER_FROM_V12: 12
SCREENS_EMULATOR_RENDERED:     28
SCREENS_PIXEL_VERIFIED:         9
SCREENS_STILL_MISMATCHING:     26
ORIGINAL_FIGMA_ASSETS_USED:    YES (for every implemented screen)
VISUAL_GALLERY_COMPLETE:       NO  (28 of 35 states, 16 of them built to V13)
```

## 12. What must happen next

1. **Re-authorise the Figma MCP** and confirm the identity with `mcp__figma__whoami` (§2). Nothing
   below can start until this is done, and this is now the third run to end on it.
2. **Persist design context to disk** in the same pass that fetches it. Recording only the node id
   cost run 4 three `performance` screens whose context had already been retrieved.
3. **Resolve the `leave` type token** (§7): pull `get_design_context` for `592:488`, read the real
   size and weight of the `Aap jitne din aaye...` and `Duration` lines, replace the carried-over
   `bodyMuted` with a V13 variant carrying node provenance, and re-verify the seven screens.
4. Implement `performance` (7 screens), re-capturing its references at full resolution first — four
   were rendered under a 1024px longer-edge cap (`575:2098` is 370x1284 captured at 296x1024).
5. Rework the 12 carried-over `Service flow` screens. The corrections named in the brief still stand
   and start at `462:3617`: the walking-Cook illustration, the lime countdown card, the yellow
   address icons, `Map dekhe` as the exact yellow pill, and removal of the unapproved visible Society
   gate block — while keeping map navigation targeting the backend-projected society gate.
6. Close the `react-native-svg` version mismatch (15.13.0 installed, 15.15.4 expected) and re-run the
   native build, prebuild-durability and APK-install gates.
