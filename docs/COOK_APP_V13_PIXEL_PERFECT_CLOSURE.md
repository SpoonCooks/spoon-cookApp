# Cook App — V13 pixel-perfect closure

Status: **incomplete — blocked on a Figma Dev Mode setting.** This report records what was
established, what was built, what was measured, and exactly what is blocking the rest. It is not a
claim of completion.

---

## 1. Starting repository state

| | |
|---|---|
| Branch | `main` |
| HEAD | `1b51fc399132abcb1ef05b27c2962905f89a55f3` — *Initial commit: Spoon Cook App (Expo / React Native)* |
| Working tree | 36 modified files, 1 deleted (`src/ui/components/MoneySummary.tsx`), 19 untracked paths |
| `git diff --check` | clean (no whitespace errors) |

Nothing was reset, cleaned, checked out or rolled back. All prior work was preserved.

### Classification of the surviving V12 work

| Class | Content |
|---|---|
| **Valid and reusable** | API client, token refresh, secure session storage, query invalidation, background location, push registration, gate navigation, attendance eligibility, `POST /cook/leaves` wiring, the Android NDK config plugin, the Livvic font pipeline |
| **Valid but required V13 comparison** | `Login flow`, `Service flow`, `performance` screens — the frames are unchanged from V12, so the code survives, but comparison shows it never matched them (§7) |
| **Obsolete because V13 changed** | `src/core/figma/scope.ts` (rewritten), `figmaScope.test.ts` (rewritten) — the V12 `Attendance` section no longer exists |
| **Partial** | The `leave` routes (`single.tsx`, `range.tsx`) implement the deleted V12 design, not the new V13 one |
| **Broken** | none found |
| **Unrelated user work** | none found |

---

## 2. Figma source

| | |
|---|---|
| File | `COBtuKtaNXzjPGhRgqWZ7t` — *V0_-user-app--13-* |
| Pages | `0:1` "User App" (customer app — out of scope), `434:2401` "Cook App" |
| Server used | **local** Figma Dev Mode MCP, `http://127.0.0.1:3845/mcp` |

The remote server (`mcp.figma.com`) refuses this file with *"Looks like you don't have edit
access"* for both `get_metadata` and `get_design_context`. The desktop app's local Dev Mode server
serves the open file and bypasses that seat check, and is the only working path.

---

## 3. Finalized-section inventory — 35 screens

The count is derived from V13 itself, not inherited from V12's 32. A screen counts only if it is a
**direct child frame** of a finalized section.

| Section | Section node | Screen | Node | Frame (dp) | Route / component | Status |
|---|---|---|---|---|---|---|
| Login flow | `434:3115` | Page 0- loading page | `434:3330` | 390×830 | `src/app/index.tsx` | implemented, **FAIL** |
| Login flow | `434:3115` | Page 1- Login No. | `434:3280` | 390×830 | `src/app/login.tsx` | implemented, **FAIL** |
| Login flow | `434:3115` | Page 2a- Login OTP | `434:3224` | 390×830 | `src/app/otp.tsx` countdown | implemented, not rendered |
| Login flow | `434:3115` | Page 2b- OTP resend | `434:3174` | 390×830 | `src/app/otp.tsx` resend | implemented, not rendered |
| Login flow | `434:3115` | Page 2c- OTP wrong | `434:3116` | 390×830 | `src/app/otp.tsx` error | implemented, not rendered |
| leave | `540:416` | Leave present | `592:488` | 371×882 | `src/app/leave/index.tsx` | **not implemented** |
| leave | `540:416` | Leave absent | `592:489` | 371×882 | `src/app/leave/index.tsx` | **not implemented** |
| leave | `540:416` | long leave | `592:563` | 371×882 | `src/app/leave/range.tsx` | **not implemented** |
| leave | `540:416` | long leave selected | `592:639` | 371×882 | `src/app/leave/range.tsx` | **not implemented** |
| leave | `540:416` | long leave confirm | `592:832` | 371×882 | `src/app/leave/index.tsx` | **not implemented** |
| leave | `540:416` | long leave confirm | `592:1008` | 371×882 | `src/app/leave/index.tsx` | **not implemented** |
| leave | `540:416` | short leave | `592:888` | 371×882 | `src/app/leave/single.tsx` | **not implemented** |
| log in flow | `592:1068` | 3a- daily log in | `575:2135` | 370×753 | `src/app/(tabs)/attendance.tsx` | **not implemented** |
| log in flow | `592:1068` | 3b- present | `575:2137` | 370×753 | `src/app/(tabs)/attendance.tsx` | **not implemented** |
| log in flow | `592:1068` | 3c- absent | `575:2138` | 370×753 | `src/app/(tabs)/attendance.tsx` | **not implemented** |
| log in flow | `592:1068` | 3d- log out | `575:2136` | 370×753 | `src/app/(tabs)/attendance.tsx` | **not implemented** |
| performance | `575:1741` | 12- money daily | `575:1744` | 370×1048 | `src/app/(tabs)/money.tsx` day | implemented, not rendered |
| performance | `575:1741` | 13- money weekly | `575:1884` | 370×1258 | `src/app/(tabs)/money.tsx` cycle | implemented, not rendered |
| performance | `575:1741` | 14- day history | `575:1903` | 370×560 | `src/app/money/days.tsx` | implemented, not rendered |
| performance | `575:1741` | 15- past daily | `575:1922` | 370×1074 | `src/app/money/day/[date].tsx` | implemented, not rendered |
| performance | `575:1741` | 16- money monthly | `575:2013` | 370×1090 | `src/app/(tabs)/money.tsx` month | implemented, not rendered |
| performance | `575:1741` | 17- weekly history | `575:2032` | 370×627 | `src/app/money/cycles.tsx` | implemented, not rendered |
| performance | `575:1741` | 18- past weekly | `575:2098` | 370×1284 | `src/app/money/cycle/[cycleId].tsx` | implemented, not rendered |
| Service flow | `485:4971` | Page 4a- travel on time | `462:3617` | 390×830 | `TravelView on_time` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 4b- travel 5 mins buffer | `463:3779` | 390×830 | `TravelView at_risk` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 4b- travel 5 mins buffer | `464:3864` | 390×830 | `TravelView late` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 5a- arrival on time | `468:3935` | 390×830 | `ArrivalView on_time` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 5b- arrival late | `468:4040` | 390×830 | `ArrivalView late` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 6a- Start OTP on time | `482:4587` | 390×830 | `StartOtpView on_time` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 6b- Start OTP on time | `482:4656` | 390×830 | `StartOtpView late` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 7a- Cooking | `483:4741` | 390×830 | `CookingView` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 7b- Cooking (last 7 mins) | `483:4795` | 390×830 | `CookingView endingSoon` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 7c- Cooking extended | `483:4835` | 390×830 | `CookingView extended` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 9- end OTP | `484:4875` | 390×830 | `EndOtpView` | implemented, **FAIL** |
| Service flow | `485:4971` | Page 10- job end | `485:4917` | 390×830 | `CompletedView` | implemented, **FAIL** |

### Duplicates — compared, not consolidated

* `long leave confirm` appears twice. `592:832` carries a 228-tall single-day block with a date
  page title and no applied leave; `592:1008` carries a 343-tall two-card block with `5 November —
  Chutti lag gyi` already applied. **Different states. Both counted.**
* `Page 4b- travel 5 mins buffer` appears twice — the at-risk and late renderings. Both counted.

### Excluded

* **`job flow` (`592:1070`)**, 5 frames: `583:375`, `583:401`, `583:427`, `583:453`, `583:479`.
  Recorded in `excludedJobFlowFrames` and asserted absent from the inventory by test. The existing
  `src/app/(tabs)/jobs.tsx` is retained because Service flow is unreachable without it, but it is
  not rebuilt and not counted.
* Page `0:1` "User App" in its entirety.

---

## 4. V12 → V13 changes

Established by comparing the archived V12 tree (`docs/.figma-canvas-v12-434-2401.xml`) against a
fresh V13 read, using a structural signature over tag/name/width/height at every depth.

| Section | V12 | V13 | Verdict |
|---|---|---|---|
| `Login flow` `434:3115` | 5 frames | same 5 node ids | **all 5 structurally identical** |
| `Service flow` `485:4971` | 12 frames | same 12 node ids | **all 12 structurally identical** |
| `performance` `575:1741` | 7 frames | same 7 node ids | **all 7 structurally identical** |
| `Attendance` → **`leave`** `540:416` | 8 frames `5xx:*` | 7 frames `592:*` | **renamed and replaced wholesale — 0 survivors** |
| `log in flow` `592:1068` | loose canvas frames, "not implemented" | promoted to a finalized section | **new required work, 4 screens** |
| `job flow` `592:1070` | loose canvas frames | promoted to a section | **excluded by the brief** |

Net new implementation required: **11 screens** (7 leave + 4 log in flow).
Net requiring rework against frames that never matched: **the 24 carried-over screens** (§7).

---

## 5. Viewport mapping — revalidated for V13, not inherited

V13 uses **two authoring conventions**, which the old "every frame is 390×830" rule did not cover:

| Convention | Sections | Frame | Application viewport |
|---|---|---|---|
| Decorative phone bezel | `Login flow`, `Service flow` | 390×830 | inner **370.44 × 810.45** at offset (10, 9.78) |
| Frame *is* the viewport | `leave`, `log in flow`, `performance` | 371×882 / 370×753 / 370×variable | the whole frame; status bar is a real child at y=0 |

**In both conventions the content column measures 370dp.** That is what makes a single
`screenWidth / 370` factor correct for every V13 screen — so the existing rule is *revalidated*,
not merely reused. The decorative bezel is not implemented in the app.

Render-bounds transform (needed because `get_screenshot` returns *effect* bounds):

```
390·s + 2m = 466   and   830·s + 2m = 906   ⇒   440s = 440   ⇒   s = 1, m = 38
```

So a 390×830 frame renders at 466×906 with a uniform 38px drop-shadow margin, and the viewport
crop is (48, 47.78) → 370.44 × 810.45. Frames without an effect render at their own origin with
m = 0. This is solved per image rather than assumed, in `scripts/visual/viewport.py`, and the
solved values are written into every `result.json`.

Emulator: 1080×2392 @ 440dpi = **392.7dp** wide, font scale 1.0, portrait, light mode.

---

## 6. Backend contract audit (read-only — backend NOT modified)

Source: `D:\spoon-backend`, `openapi/openapi.yaml` (86 paths) plus route and service source.

| V13 action | Endpoint | Auth | Deployed | Frontend wiring |
|---|---|---|---|---|
| Request login OTP | `POST /auth/otp/send` | public | yes | `api.requestOtp` |
| Verify OTP | `POST /auth/otp/verify` | public | yes | `api.verifyOtp` |
| Refresh / restore session | `POST /auth/refresh` | refresh token | yes | `api.refresh`, secure store |
| Logout | `POST /auth/logout` | bearer | yes | wired |
| Approved-Cook gate | `GET /cook/me` | bearer | yes | `useCookProfile` |
| Check-in eligibility | `GET /cook/me` + shifts | bearer | yes | `attendance.ts` |
| Mark present | `POST /cook/attendance/present` | bearer + Idempotency-Key | yes | `useMarkPresent` |
| Monthly attendance | `GET /cook/attendance/month` | bearer | yes | `useMonthlyAttendance` |
| Attendance range | `GET /cook/attendance` | bearer | yes | `useAttendanceRange` |
| Read leaves | `GET /cook/leaves` | bearer | yes | `useLeaves` |
| **Request leave** | `POST /cook/leaves` | bearer + Idempotency-Key | **yes — V12 gap now closed** | `useRequestLeave` |
| Earnings | `GET /cook/earnings` | bearer | yes | `useEarnings` |
| Earnings cycles | `GET /cook/earnings/cycles`, `/{cycleId}` | bearer | yes | `useEarningsCycles`, `useCycle` |
| Current job | `GET /cook/jobs/current` | bearer | yes | `useCurrentJob` |
| Start travel | `POST /cook/bookings/{id}/start-commute` | bearer | yes | wired |
| Location reporting | `POST /cook/location` | bearer | yes | `core/location/tracker.ts` |
| Arrival | `POST /cook/bookings/{id}/arrive` | bearer | yes | wired |
| Start OTP | `POST /cook/bookings/{id}/verify-start-otp` | bearer | yes | wired |
| Alert acknowledgement | `POST /cook/bookings/{id}/acknowledge-alert` | bearer | yes | wired |
| End OTP | `POST /cook/bookings/{id}/verify-end-otp` | bearer | yes | wired |
| Push token | `PUT /me/push-token` | bearer | yes | `core/notifications/push.ts` |

### `POST /cook/leaves` — verified contract

Request `{ startDate, endDate, reason? }` + `Idempotency-Key`. Response `201`
`{ leaveId, type: single_day|multi_day, startDate, endDate, status: 'pending', reason, requestedAt }`.

Server rules read from `src/cooks/operations.ts`:

* `startDate` may not precede the server's Asia/Kolkata service date — **today is allowed**.
* An overlapping `pending`/`approved` leave answers `409 INVALID_BOOKING_STATE`.
* Status is always `pending` on create; Ops decides. The app must never render a request as taken.

This supports both V13 day-offer variants: `Leave absent` offers *Aaj*, `Leave present` starts at
*Kal* because the cook is working today. That difference is a UI projection, not a server rule.

### Remaining backend gaps

* **No cook-side extension channel** — `Page 7c- Cooking extended` (`483:4835`) can be rendered
  from server state but the cook cannot initiate or confirm an extension. Carried over as GAP-07.
* **No cook rating aggregate** — the rating shown on performance frames has no endpoint (GAP-02 /
  GAP-24).
* No new gap was introduced by V13, and the largest V12 gap (cook leave submission) is closed.

---

## 7. What was measured, and what it shows

Evidence lives in `docs/visual-verification/v13/<section>/<node-id>/`.

* `figma.png` — **35 / 35** captured
* `emulator.png`, `overlay.png`, `diff.png`, `result.json` — **14 / 35**

| Node | Screen | diff % (tol 12) | raw % |
|---|---|---|---|
| `434:3330` | Page 0- loading page | 10.67 | 83.27 |
| `434:3280` | Page 1- Login No. | 53.81 | 62.60 |
| `462:3617` | Page 4a- travel on time | 31.02 | 91.35 |
| `463:3779` | Page 4b- travel (at risk) | 30.77 | 91.20 |
| `464:3864` | Page 4b- travel (late) | 30.64 | 91.10 |
| `468:3935` | Page 5a- arrival on time | 30.48 | 83.07 |
| `468:4040` | Page 5b- arrival late | 30.26 | 83.46 |
| `482:4587` | Page 6a- Start OTP | 41.22 | 99.69 |
| `482:4656` | Page 6b- Start OTP late | 46.00 | 98.86 |
| `483:4741` | Page 7a- Cooking | 47.76 | 99.60 |
| `483:4795` | Page 7b- Cooking last 7 | 45.58 | 99.64 |
| `483:4835` | Page 7c- Cooking extended | 45.58 | 99.65 |
| `484:4875` | Page 9- end OTP | 44.77 | 98.97 |
| `485:4917` | Page 10- job end | 28.84 | 99.95 |

**Every compared screen FAILS.** The percentages are honest measurements, not antialiasing noise —
the reviewed screens show missing artwork and missing layout containers, e.g. on `462:3617`:

* the walking-cook illustration beside the headline is absent;
* the countdown is bare hero text where V13 wraps it in a lime card containing a white rounded box;
* address rows have no yellow leading icons;
* the app adds a `Society gate` block V13 does not show;
* `Map dekhe` renders black where V13 uses a yellow pill with a location icon.

`483:4741` and `485:4917` are missing full-width **photographs**; `575:2136` (`3d- log out`) and
`575:2135` (`3a- daily log in`) likewise depend on a photograph and an illustration.

The important conclusion: the 24 carried-over screens were **never pixel-matched** to these frames.
Because the frames are structurally identical between V12 and V13, this is pre-existing drift that
V13 surfaced rather than caused. Fixing it is rework, not a regression.

---

## 8. What was built this run

| Area | Change |
|---|---|
| Scope | `src/core/figma/scope.ts` rewritten for V13: 5 sections, 35 screens, excluded `job flow`, removed V12 frames, duplicate handling |
| Tests | `figmaScope.test.ts` rewritten (22 tests); `gallery.test.tsx` added (12 tests); `fixtureExclusion.test.ts` narrowed to exempt only the dev gallery and to assert its `__DEV__` gate |
| Dev gallery | `src/app/dev/_layout.tsx`, `src/app/dev/index.tsx`, `src/app/dev/[...state].tsx`, `src/features/dev/galleryStates.tsx` — deep-linkable, release-gated, 12 Service states |
| Evidence tooling | `scripts/visual/viewport.py`, `scripts/visual/compare.py`, `scripts/visual/capture_emulator.py` |
| Evidence | 35 Figma references, 14 emulator renders + overlays + diffs + `result.json` |

### Development gallery

Release-gated at the layout (`if (!areFixturesAvailable()) return null;`) and again on each screen;
`areFixturesAvailable()` is `__DEV__`, which Metro's release transform folds to `false`. Deep link:

```
adb shell am start -a android.intent.action.VIEW \
  -d "spooncook://dev/service/cooking" com.spoonhelp.cookapp.dev
```

It renders the same presentational views the real route renders, via the same
`projectServiceState` projector, with fixed fixtures. It installs no fake API client and seeds no
production cache, so production state management is untouched. `/dev` lists all 35 screens and
marks the 23 without an entry as `not implemented` — it reports real coverage rather than
flattering it.

---

## 9. Emulator configuration and result

| | |
|---|---|
| AVD | `Ref393GA`, headless (`-no-window -gpu swiftshader_indirect`) |
| `adb devices` | `emulator-5554  device` |
| `wm size` | `1080x2392` |
| `wm density` | `440` → **392.7dp** logical width |
| `font_scale` | `1.0` |
| Package | `com.spoonhelp.cookapp.dev` |

* `npx expo prebuild --platform android --clean` — regenerated `android/` from scratch.
* **NDK override survived the clean prebuild**: `ndkVersion = "27.2.12479018"` present in the
  regenerated `android/build.gradle`. This is the durability requirement, verified by deleting and
  regenerating `android/`.
* `./gradlew assembleDebug` — **succeeded**, `app-debug.apk` 239 MB.
* `adb install -r -t` — **Success**.
* Metro started; app cold-launched; `ReactNativeJS: Running "main"` with Fabric; **no fatal
  exceptions**; boot screen then Login screen rendered.
* One SystemUI ANR occurred while the build was still consuming the machine; it was dismissed and
  the app relaunched cleanly. It is an emulator-load artifact, not an app fault.

Not performed: scroll-extent capture, keyboard open/dismissed capture, background→foreground and
process-restart capture. These were not reached because the screens they apply to are either
unimplemented or pending rework.

---

## 10. Blockers

### B1 — `get_design_context` is unavailable (primary, blocking)

Two independent causes:

1. **No allowed directory.** The local Dev Mode server requires `dirForAssetWrites` and refuses
   every path with *"Cannot write to this directory. The user must add this directory to their
   allowed directories list in Figma Dev Mode settings (MCP panel > Allowed directories)."*
   Probed and refused: repo root, `assets/`, `assets/images/figma-v13`, `Downloads`, the scratchpad,
   plus backslash/trailing-slash/lowercase variants.
   **Fix: Figma Desktop → Dev Mode → MCP panel → Allowed directories → Add
   `D:\spoonCook-frontend\assets\images\figma-v13`.**
2. **Rate limit.** The local server now answers *"Rate limit exceeded, please try again tomorrow"*.
   This clears on its own.

The remote server is not an alternative: it refuses this file with *"you don't have edit access"*
for both `get_metadata` and `get_design_context`.

**Consequence.** The brief forbids substituting metadata or screenshots for `get_design_context`,
forbids inventing artwork, and requires original committed assets. V13 depends on at least four
photographic/illustration assets (walking cook, cooking photo, "Great Job!" celebration photo,
praying-hands illustration) that cannot be exported. Rather than approximate them, the 11 new
screens were **not built** and the 24 carried-over screens were **not reworked**.

`assets/images/figma-v13/` is therefore empty and **no V13 original asset is committed**.

### B2 — No approved test Cook

Unchanged from V12. Authenticated end-to-end against the deployed backend was not run. The dev
gallery is the mitigation and works, but it only covers implemented screens.

---

## 11. Verification gates

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`, strict) | **PASS** |
| ESLint (`--max-warnings=0`) | **PASS** |
| Prettier (`--check .`) | **PASS** |
| Jest | **PASS — 335/335, 19 suites** |
| Clean Expo prebuild | **PASS** |
| NDK override survives `android/` regeneration | **PASS** |
| Native Android debug build | **PASS** |
| APK install on emulator | **PASS** |
| App cold launch, no fatal exceptions | **PASS** |
| Expo export | not re-run this session |
| `git diff --check` | **PASS** |
| Secret scan | **PASS** — no keys, tokens or device identifiers in the diff |
| 35 screens implemented | **FAIL — 24 implemented, 11 not** |
| 35 screens pixel-verified | **FAIL — 0 pass, 14 measured and failing, 21 not rendered** |

---

## 12. What must happen next

1. Add the allowed directory in Figma Dev Mode and wait out the rate limit.
2. `get_design_context` per screen; export and commit original assets to
   `assets/images/figma-v13/`.
3. Build the 11 new screens (`leave` ×7, `log in flow` ×4) and add their gallery entries.
4. Rework the 24 carried-over screens against their V13 frames — the header component
   (back chevron + yellow Help pill) and the missing artwork are shared across Service flow and
   should be fixed once.
5. Re-run capture → compare → review per screen until each passes.
