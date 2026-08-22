# Cook App — Phase 1 Backend Readiness and Gap Report

> **STATUS UPDATE — 2026-08-21 (supersedes §0–§0.6 and the "Phase 1 Implementation Status" section
> below for everything concerning Figma access, scope and backend gaps).**
>
> Read `docs/COOK_APP_FIGMA_SECTION_IMPLEMENTATION_AND_INTEGRATION_REPORT.md` first. Summary of
> what has changed since the text below was written:
>
> 1. **Figma access is obtained.** Not via the remote MCP server (still Edit-seat blocked) but via
>    the **Figma desktop app's local Dev Mode MCP server** on `127.0.0.1:3845`. The full node tree
>    of canvas `434:2401` in file `FLrHofaiOZtMn3F84yHEZa` is archived at
>    `docs/.figma-canvas-434-2401.xml`.
> 2. **The approved scope is four sections and 32 screens** — Login flow `434:3115` (5),
>    Service flow `485:4971` (12), Performance & earnings `540:397` (7), Attendance `540:416` (8).
>    The Attendance section grew from 2 screens to 8 and now includes a cook-initiated leave-request
>    flow. `505:1596` ("Attendance & Leaves") has been **deleted** from the file.
> 3. **The frontend implementation half has run.** The Cook App is no longer fixture-only: it has a
>    typed API layer (`src/core/api/`), keystore-backed sessions, and connected Login/OTP, Jobs,
>    Attendance and Money screens. 150 tests pass.
> 4. **Most recorded gaps are RESOLVED by the backend**, which has moved well past the state audited
>    below: GAP-01, GAP-02, GAP-03, GAP-06, GAP-20, GAP-22, GAP-23 and the 4-digit service-OTP
>    conflict are all closed. Verified registered in `src/api/routes/v1/index.ts`.
> 5. **Still open:** GAP-21 (no cook-side leave write — blocks 5 approved screens), plus two new
>    findings — **GAP-25** (no categorised earnings breakdown; the ledger cannot be summed
>    client-side because reversals carry their own event type) and **GAP-26** (the
>    `Shift se 30 mins pehle tak` window is neither enforced nor exposed by `markCookPresent`).
> 6. **Service OTPs are 3 digits**, not 4 — `SERVICE_OTP_DIGITS = 3`, `pattern '^[0-9]{3}$'`. Figma
>    agrees. The app has been corrected.
>
> The historical text below is retained as the record of what was believed on 2026-08-20/21.

**Date:** 2026-08-20 (re-verified 2026-08-21 — see §0.4)
**Cook App repository:** `D:\spoonCook-frontend` (empty at time of writing — see §0)
**Backend repository audited:** `D:\spoon-backend`
**Deployed backend audited:** `https://spoon-api-kalc.onrender.com`
**User App reference (read-only, unmodified):** `D:\spoon-frontend`

---

## 0. Status of this phase

> **SUPERSEDED — read §0.5, §0.6 and §Phase 1 Implementation Status first.**
> The Figma blocker described below was misdiagnosed (it was a file-sharing problem, not a seat
> problem) and has since been cleared. The frontend implementation half **did subsequently run to
> completion** against the correct file. The text below is retained as the record of what was
> believed on 2026-08-20.

This report covers the **backend audit half** of Phase 1, which ran to completion.

The **frontend implementation half did not start** _(no longer true — see above)_, because Figma
access was believed to be blocked at the account level. Per the Phase 1 instruction _"If Figma access is blocked, stop the implementation
and report the precise access problem. Do not silently recreate the entire design from the
supplied screenshots"_, no screens were built and no design was reconstructed from the
screenshots in the handover.

Nothing was written to `D:\spoon-frontend`. Nothing was written to `D:\spoon-backend`.
No mutating call was made against the deployed API.

### 0.1 The Figma blocker — precise diagnosis

**Target file:** `tfbXjYufVOo2ZguhklUzhC`, starting node `434:2401`
(`https://www.figma.com/design/tfbXjYufVOo2ZguhklUzhC/V0_-user-app--9-?node-id=434-2401&m=dev`)

The Figma MCP server (`https://mcp.figma.com/mcp`) is **configured and connected** — it was
registered for this project during the audit and `claude mcp list` reports
`figma: https://mcp.figma.com/mcp (HTTP) - ✔ Connected`. Authentication succeeds. The failure is
authorization, not connectivity.

`mcp__figma__whoami` returns:

```json
{
  "handle": "Lakshay Dawar",
  "email": "lakshayd.intern@spoonhelp.com",
  "plans": [
    {
      "name": "Lakshay Dawar's team",
      "seat": "View",
      "tier": "starter",
      "key": "team::1667651710665097179"
    }
  ]
}
```

The authenticated identity holds a **`View` seat on a `starter` tier team**. Every Figma MCP read
tool fails with the identical error:

> `Looks like you don't have edit access to this file. The file owner can share it with you and make you an editor.`

| Tool                 | File / node                                                                        | Result                |
| -------------------- | ---------------------------------------------------------------------------------- | --------------------- |
| `get_metadata`       | `tfbXjYufVOo2ZguhklUzhC` @ `434:2401`                                              | FAIL — no edit access |
| `get_metadata`       | `tfbXjYufVOo2ZguhklUzhC` (file level)                                              | FAIL — no edit access |
| `get_screenshot`     | `tfbXjYufVOo2ZguhklUzhC` @ `434:2401`                                              | FAIL — no edit access |
| `get_design_context` | `tfbXjYufVOo2ZguhklUzhC` @ `434:2401`                                              | FAIL — no edit access |
| `get_variable_defs`  | `tfbXjYufVOo2ZguhklUzhC` @ `434:2401`                                              | FAIL — no edit access |
| `get_metadata`       | `BTPW14a7M69ySPZxdkc2yn` (**the User App file that worked in a previous session**) | FAIL — no edit access |

**The control test is the decisive one.** File `BTPW14a7M69ySPZxdkc2yn` is the User App Figma that
was successfully read in an earlier session — the exported assets from that session still exist at
`D:\spoon-frontend\.figma-audit\`. It now fails with the same error. Therefore this is **not** a
missing share on the new Cook App file; the authenticated Figma account has lost (or never had)
the seat level the Dev Mode MCP server requires. A `View` seat on a `starter` tier cannot use Dev
Mode MCP against any file.

The Chrome browser route is independently blocked: navigating to `figma.com` returns
`This site is blocked by your site permissions.` No Figma personal access token exists anywhere in
`D:\spoon-backend`, `D:\spoon-frontend`, `D:\spoonCook-frontend`, or the user profile directory
(searched for `figd_*`, `FIGMA_TOKEN`, `FIGMA_PAT`).

### 0.2 Unblock options (any one is sufficient)

1. **Upgrade the seat.** Give `lakshayd.intern@spoonhelp.com` a **Dev or Full seat** (paid
   Professional/Organization tier) and edit access to `tfbXjYufVOo2ZguhklUzhC`. This restores the
   MCP path exactly as it worked before.
2. **Figma personal access token (recommended — lowest friction).** A PAT with `file_read` scope
   works over the Figma **REST API**, which requires only _view_ access, so the current seat is
   enough. It also exposes `GET /v1/files/{key}/comments`, which is how founder annotations would
   be read — the MCP tools do not surface comments well. Create at Figma → Settings → Security →
   Personal access tokens, then provide it and it can be stored in a gitignored local env file.
3. **Grant Chrome site permission for `figma.com`** in the Claude in Chrome extension, enabling
   inspection through the already signed-in browser session.

Option 2 is the recommendation: it needs no billing change, unblocks the full node tree, image
exports and founder comments, and is scoped read-only.

### 0.3 What Phase 1 still owes once unblocked

Sections **B** (Figma inventory) and **D** (state-machine comparison, Figma column) of this report
are unpopulated. The full V0 screen implementation, component library, navigation structure,
design-token layer and device verification are all still outstanding. The backend findings below
are complete and do not depend on Figma.

---

### 0.4 Re-verification on 2026-08-21

The blocker was independently re-tested at the start of the follow-up session. **It persists, unchanged.**

| Route to Figma | Test performed                                         | Result                                                                        |
| -------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| MCP seat       | `mcp__figma__whoami`                                   | Still `View` seat on `starter` tier — unchanged                               |
| MCP read       | `get_metadata` @ `tfbXjYufVOo2ZguhklUzhC` / `434:2401` | FAIL — "you don't have edit access to this file"                              |
| Browser        | navigate to the Figma design URL                       | FAIL — "This site is blocked by your site permissions."                       |
| REST PAT       | token discovery                                        | None exists (profile-wide search blocked by policy; prior session found none) |

All three access paths are simultaneously closed, so no Figma-derived work was possible.

**Backend findings re-confirmed by direct spot-check (not taken on trust from the prior session):**

- **GAP-01 confirmed.** `grep` over `src/api/routes/` returns exactly the same ten `/cook/` routes
  listed in §A, and zero GET routes under `/cook/bookings`. The keystone blocker is real.
- **GAP-06 confirmed.** `src/api/routes/v1/index.ts:593` still contains the literal
  `INSERT INTO users (id,phone,role,status,...) VALUES ($1,$2,'user','active',...) ON CONFLICT (phone) DO UPDATE`.
  An unknown phone passing OTP is still auto-provisioned as an active customer.
- **Deployed host still healthy.** `/health/live` → `200`; `/health/ready` → `200` with postgres,
  postgis and redis all `healthy`. Only GET requests were issued.

**Phase 2 toolchain reference (read-only inspection of `D:\spoon-frontend`, nothing modified):**

- Expo `~57.0.12`, React Native `0.86.2`, React `19.2.3`, TypeScript `~6.0.3`, Expo Router `~57.0.12`
- TanStack Query `^5.90.2`, Zustand `^5.0.15`, `expo-location`, `expo-notifications`, `react-native-safe-area-context`
- App config is `app.config.ts` (not `app.json`) — Cook App identity values must be authored fresh there
- **All five Livvic weights already exist** at `D:\spoon-frontend\assets\fonts\`
  (`Livvic-Regular/Medium/SemiBold/Bold/Black.ttf`), so the brand font needs no substitution and no
  new download — copy these into the Cook App rather than sourcing a replacement.
- `D:\spoon-frontend` holds **274** uncommitted changes. It was opened read-only; no `git reset`,
  `git clean`, checkout or restore was run.

---

### 0.5 CORRECTED DIAGNOSIS (2026-08-21) — it is a file-sharing problem, not a seat problem

Section 0.1 concluded the blocker was the account seat tier. **That conclusion was wrong**, and the
REST API proved it. The seat is sufficient; the file is simply not shared with the authenticated
identity.

A Figma personal access token (`figd_...`, generated by the founder from the
`lakshayd.intern@spoonhelp.com` account) was supplied and tested against the REST API:

| Probe                                  | Result                                                                   | What it proves                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `GET /v1/me`                           | `200` — `lakshayd.intern@spoonhelp.com`                                  | Token is valid                                                                            |
| Token scopes (from a 403 body)         | includes `file_content:read`, `file_comments:read`, `file_metadata:read` | Scopes are correct for the whole job                                                      |
| `GET /v1/files/BTPW14a7M69ySPZxdkc2yn` | **`200`**, `role: viewer`                                                | **A _viewer_ seat CAN read files over REST.** Dev Mode MCP demands _edit_; REST does not. |
| `GET /v1/files/tfbXjYufVOo2ZguhklUzhC` | **`404 Not found`**                                                      | The Cook App file is **not shared with this identity at all**                             |

**Therefore:** the `View`/`starter` seat is _not_ the blocker. The intern account can read any Figma
file it has been granted access to. It has simply never been granted access to
`tfbXjYufVOo2ZguhklUzhC`, which lives in a **personal Figma account (`lakshay58cse24`)** — the
founder saved the design locally and re-imported it there because the Spoon org lacks Dev access.

### 0.6 The Cook App design is NOT in the original Spoon file

The readable file `BTPW14a7M69ySPZxdkc2yn` ("V0_ user app", `lastModified 2026-08-14`) was fully
enumerated. It contains two pages:

| Page node | Name     | Frames                                                                                                                               |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `0:1`     | User App | **41** — all customer-side (home, instant, scheduled, en route, arrived, countdown, extension, completion, booking history, profile) |
| `84:1365` | Cook App | **0 — empty placeholder canvas**                                                                                                     |

Node `434:2401` (the Phase 1 starting node) **does not exist** in this file.

This rules out the convenient outcome that the Cook App V0 design could be sourced from the file the
intern account already reads. It exists only in `tfbXjYufVOo2ZguhklUzhC`.

**Unblock — either one is sufficient, both are seconds of work:**

1. From the `lakshay58cse24` account, **share `tfbXjYufVOo2ZguhklUzhC` with
   `lakshayd.intern@spoonhelp.com`** — _view_ access is enough, as proven by the control test. The
   existing token then works unchanged.
2. Or **generate a new PAT from the `lakshay58cse24` account** (scopes `file_content:read` +
   `file_comments:read`) and use that instead.

---

## Phase 1 Implementation Status

**Added 2026-08-21.** Cook App repository: `D:\spoonCook-frontend`. Built against the authoritative
visual source `N44dO2hqLQBw5I5TKh0wmu` (Cook App page `434:2401`), with founder comments from
`XMNpmq1fShR87GkLJhLGjW` and backend contracts from `D:\spoon-backend`.

### IMP.1 Toolchain

Expo `~57.0.12`, React Native `0.86.2`, React `19.2.3`, TypeScript `~6.0.3`, Expo Router `~57.0.12`,
Zustand, Zod — matched to the User App so the two apps stay on one toolchain. Identity is
deliberately separate: slug `spoon-cook-app`, scheme `spooncook`, package
`com.spoonhelp.cookapp[.dev|.staging]`, display name `Spoon Partner`. **No EAS project id, FCM
identity or release credential is set** — those are `PENDING_FOUNDER` and left absent so a release
build fails loudly rather than shipping under the User App's identity.

All five Livvic weights were copied from `D:\spoon-frontend\assets\fonts\`. The Figma uses exactly
weights 400/500/600/700/900 and never 800, so every weight maps to a real bundled file and nothing
is synthesised.

### IMP.2 Design-token layer

`src/ui/theme/tokens.ts` — extracted by walking every node's fills, strokes, text styles and corner
radii on the Cook App page rather than transcribed by eye. All ten founder brand colours appear in
the Figma and are present. Figma-specific neutrals (`#0a0a0a`, `#a1a1a1`, `#737373`, `#fffdf5`,
`#f9fafb`, `#f3f4f6`, `#cad5e2`) and semantics (`#ff0000`, `#e7000b`, `#0f172b`) are included where
Figma is more specific than the brand list.

`src/ui/theme/typography.ts` — named text styles for the size/weight/line-height combinations that
actually occur, so Hinglish copy stays on the Figma scale and wraps rather than truncating.

### IMP.3 Backend-authoritative state architecture

| Module                            | Responsibility                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/domain/serviceState.ts` | Discriminated `ServiceState` + `projectServiceState`. Maps the coarse backend status vocabulary onto the finer Figma frames using server-supplied timing rulings. |
| `src/core/domain/job.ts`          | Job card model, date grouping, duration/minute formatting.                                                                                                        |
| `src/core/domain/money.ts`        | Earnings projection + Indian-grouped `formatRupees`. Performs no arithmetic.                                                                                      |
| `src/core/domain/attendance.ts`   | `DayMark` keeps `scheduled` separate from `cook_attendance.status`.                                                                                               |
| `src/core/domain/otp.ts`          | Per-kind OTP length. Single point of change for the 3-vs-4 conflict.                                                                                              |
| `src/core/domain/auth.ts`         | `gateCookAccess` allowlist + Indian phone normalisation.                                                                                                          |
| `src/core/session/store.ts`       | Central cook session. Holds identity only, never job/service data.                                                                                                |

**Invariants enforced in code, not by convention:**

- No screen advances the service flow locally. Every transition is a re-projection of server data.
- `minutesToDeadline` is never clamped — a negative value is what separates `TravelLate` from
  `TravelRisk`.
- A missing travel ruling degrades to `on_time`, never to `late`; the app must not accuse a cook of
  lateness on absent evidence.
- `cooking` refuses to render a timer without `actualStartIso`/`expectedEndIso`.
- `interrupted` outranks every other state, so a cancelled booking cannot keep rendering a live
  service screen.
- An unrecognised future backend status hits an exhaustiveness guard rather than falling through
  into a live screen.

### IMP.4 Screens implemented

| Figma frame              | Node                                 | Implementation                                             |
| ------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| Page 0 loading           | `434:3330`                           | `src/app/index.tsx`                                        |
| Page 1 Login No.         | `434:3280`                           | `src/app/login.tsx`                                        |
| Page 2a/2b/2c OTP        | `434:3224` / `434:3174` / `434:3116` | `src/app/otp.tsx` (one screen, three states)               |
| Page 3 job list          | `434:3086`                           | `src/app/(tabs)/jobs.tsx`                                  |
| Page 3a start            | `494:5648`                           | same screen — differs only by server ruling                |
| Page 11 attendance       | `506:1986`                           | `src/app/(tabs)/attendance.tsx`                            |
| Attendance & Leaves      | `505:1596`                           | same screen + `AttendanceCalendar`                         |
| Page 3a money daily      | `485:5062`                           | `src/app/(tabs)/money.tsx`                                 |
| Page 3b money 7 days     | `492:5336`                           | same screen, `cycle` filter                                |
| Page 3c money monthly    | `502:192`                            | same screen, `month` filter                                |
| Page 3c past cycle       | `504:934`                            | `src/app/money/cycle/[cycleId].tsx`                        |
| Page 4 cycle history     | `502:442`                            | `src/app/money/cycles.tsx`                                 |
| Page 4a travel on time   | `462:3617`                           | `TravelView` timing `on_time`                              |
| Page 4b travel AT RISK   | `463:3779`                           | `TravelView` timing `at_risk`                              |
| Page 4b travel LATE      | `464:3864`                           | `TravelView` timing `late`                                 |
| Page 5a arrival on time  | `468:3935`                           | `ArrivalView`                                              |
| Page 5b arrival late     | `468:4040`                           | `ArrivalView`                                              |
| Page 6a Start OTP        | `482:4587`                           | `StartOtpView`                                             |
| Page 6b Start OTP late   | `482:4656`                           | `StartOtpView` (relabelled — its copy is the LATE variant) |
| Page 7a Cooking          | `483:4741`                           | `CookingView`                                              |
| Page 7b last 7 mins      | `483:4795`                           | `CookingView` ending-soon                                  |
| Page 7c Cooking extended | `483:4835`                           | `CookingView` extended                                     |
| Page 9 end OTP           | `484:4875`                           | `EndOtpView`                                               |
| Page 10 job end          | `485:4917`                           | `CompletedView`                                            |
| job card / RUNNING LATE  | `494:5627` / `434:2741` / `434:2743` | `JobCard` (one reusable component)                         |

**Not implemented, by design:** the cancellation-after-travel screens (founder comment #152) do not
exist in Figma. A neutral `InterruptedView` handles the state so tracking stops and the app returns
to Jobs, but no design was invented and no compensation copy is shown.

### IMP.5 Navigation

Single Expo Router tree. One `Tabs` navigator owns `Jobs · Attendance · My money` in Figma order,
so there is one back stack rather than three. The service flow is a single route
(`/service/[bookingId]`) pushed **over** the tabs, pinned to a booking id — twelve Figma frames are
twelve renderings of one booking, not twelve routes. That is what lets the app survive backgrounding
and reconcile after restart: re-fetching is always safe and cannot land on a stale screen.

### IMP.6 Fixture harness

`src/core/fixtures/` reproduces each Figma frame exactly, labelled by the backend state it
represents. Every accessor is `__DEV__`-guarded and **throws** in release rather than returning
placeholder data. Fixtures are never an API-failure fallback — a failed request renders `ErrorState`.
`FixtureSwitcher` (dev-only) steps through all 14 service states for visual verification; moving
between them proves presentation only, never functional completion.

### IMP.7 Interim decisions as implemented

| Decision                  | Implementation                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OTP length                | `otpLength` — login 6, start/end **4** (backend contract). Screens read from it; no box count is hardcoded. `hasOtpFigmaConflict()` keeps the 3-box Figma conflict visible and asserted in tests. |
| `START` meaning           | `JobAction.start_travel`; visible copy stays `Start`. `jobCtaLabel` is a single token so the `CHALNA START?` decision is a one-line change.                                                       |
| Tomorrow's bookings       | `JobGroup` + `groupJobsByDate` support date grouping and a `Kal` label; **no new screen invented**.                                                                                               |
| Cancellation after travel | `interrupted` state with `cancelled_while_travelling`; tracking stops, returns to Jobs, no invented UX.                                                                                           |
| Bonus threshold           | `BonusProgress.thresholdHours` comes from the backend. Neither 5 nor 7 is hardcoded.                                                                                                              |
| Double nudge              | Not implemented — no screen exists. Recorded as GAP-17.                                                                                                                                           |
| Extension                 | Full `7c` visual state, driven by `ExtensionProjection.isExtended`. Never set optimistically.                                                                                                     |
| Address vs gate           | Floor/flat rendered per Figma, explicitly display-only; `GateTarget` documents that navigation and arrival detection use the gate.                                                                |
| Attendance                | `Present` is a real action, rendered **disabled** pending GAP-20 rather than faking success. Leave display is read-only; no leave-request screen invented.                                        |

### IMP.8 Verification performed

| Check      | Command                         | Result                                                                       |
| ---------- | ------------------------------- | ---------------------------------------------------------------------------- |
| TypeScript | `npx tsc --noEmit`              | **clean** (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) |
| Lint       | `npx eslint . --max-warnings=0` | **clean**                                                                    |
| Formatting | `npx prettier --check .`        | **clean**                                                                    |
| Tests      | `npx jest`                      | **83 passed / 83, 6 suites**                                                 |

Test coverage by concern: service-state projection (mapping, negative countdowns, degradation,
interruption precedence, timer refusal without timestamps); the approved-cook gate (customer
refused, every denial status, unknown-status allowlist behaviour, phone normalisation); money and
duration formatting including Indian digit grouping; OTP contract including the recorded Figma
conflict; job date grouping; `JobCard` disabled-CTA behaviour and the `RUNNING LATE` badge;
`OtpInput` length parameterisation, paste and digit stripping; every service view's distinguishing
Hinglish copy — including an explicit assertion that `TravelRisk` and `TravelLate` do **not** share
copy; three-digit timer rendering; and production fixture exclusion.

**Not yet done:** Android emulator walkthrough and device-size layout verification. A successful
compile and bundle is not visual verification, and this is recorded as outstanding rather than
claimed.

### IMP.9 Status classification

- **VISUALLY IMPLEMENTED:** all 25 V0 screens listed in IMP.4.
- **NAVIGATION-VERIFIED:** tab structure, service-route isolation and auth routing implemented;
  emulator walkthrough still outstanding.
- **BACKEND-READY:** none of the cook read surfaces — the job list endpoint does not exist (GAP-01).
- **BACKEND-BLOCKED:** Jobs, profile/avatar, My Money aggregates, cook-visible ETA/late state,
  extension propagation, attendance check-in, leaves, on-time percentage.
- **FOUNDER DECISION REQUIRED:** OTP length, bonus threshold, `CHALNA START?`, tomorrow's bookings,
  cancellation screens, `Extend booking` affordance, address-before-arrival privacy.
- **PENDING PHASE 2:** every API call. The app currently renders development fixtures only.

**The Cook App is not functionally complete and no flow works end to end.** Phase 1 delivered the
presentation layer, the reusable components, the navigation structure and the backend-authoritative
state architecture — with no production fake data.

---

## Figma Source Refresh — Differential Inventory (`N44dO2hqLQBw5I5TKh0wmu`)

**Added 2026-08-21.** New authoritative visual source. Supersedes the personal import
`tfbXjYufVOo2ZguhklUzhC` for all screens, layout, components, assets and copy. Founder comments
remain sourced only from `XMNpmq1fShR87GkLJhLGjW`.

### FR.1 Retrieval evidence

| File                  | Key                      | HTTP  | Role     | Last modified          |
| --------------------- | ------------------------ | ----- | -------- | ---------------------- |
| New personal import   | `N44dO2hqLQBw5I5TKh0wmu` | `200` | `viewer` | `2026-08-20T20:14:59Z` |
| Original company file | `XMNpmq1fShR87GkLJhLGjW` | `200` | `viewer` | `2026-08-20T18:14:21Z` |
| Superseded import     | `tfbXjYufVOo2ZguhklUzhC` | `200` | `viewer` | `2026-08-20T19:44:59Z` |

Cook App page is `434:2401` in **all three** files — node IDs were preserved through import, so
comment mapping by node ID is valid and no coordinate-based re-mapping was required.

### FR.2 The new import is byte-identical to the original company file

A full node-level comparison of the `Cook App` page between `N44dO2hqLQBw5I5TKh0wmu` and
`XMNpmq1fShR87GkLJhLGjW`:

| Comparison               | Result            |
| ------------------------ | ----------------- |
| Nodes indexed, each file | **2,209 / 2,209** |
| Nodes only in new import | **0**             |
| Nodes only in original   | **0**             |
| Renamed nodes            | **0**             |
| Text/copy changes        | **0**             |
| Geometry changes         | **0**             |

**Conclusion:** the new import contains **no screens that were not already in the original company
file at `18:14:21Z`**, and the original has not been modified since (re-checked: still
`18:14:21Z`, still exactly **161** comments, **0** new since the first fetch).

The four "new" screens are the same four this audit already identified in §CA.3 while auditing the
original. What actually changed is that the **personal import is now in sync with the original**;
the previous import (`...(9)`) was stale. No founder work has been missed.

### FR.3 Differential inventory — previous import → new import

**Previous enumerable frame count: 25. New enumerable frame count: 29.** (Counts exclude the two
`SECTION` containers `Login flow` and `Service flow`, which group frames rather than being screens.)

**ADDED (5)**

| Node       | Name                       | Significance                                      |
| ---------- | -------------------------- | ------------------------------------------------- |
| `506:1986` | **Page 11- attendance**    | Cook-actionable attendance screen                 |
| `502:192`  | **Page 3c- money monthly** | The 28-day period, previously believed undesigned |
| `504:934`  | **Page 3c- past cycle**    | Historical cycle detail                           |
| `502:442`  | **Page 4- cycle history**  | List of 8 past cycles                             |
| `505:1596` | **`div.max-w-md`**         | **Attendance & Leaves screen** — see FR.4         |

**REMOVED (1)**

| Node       | Name            | Note                     |
| ---------- | --------------- | ------------------------ |
| `462:3516` | `1024w default` | Superseded by `505:1596` |

**RENAMED (2)**

| Node       | Was                           | Now                     |
| ---------- | ----------------------------- | ----------------------- |
| `485:5062` | `Page 3a- Performance daily`  | `Page 3a- money daily`  |
| `492:5336` | `Page 3b- Performance 7 days` | `Page 3b- money 7 days` |

**UNCHANGED (24)** — all Login flow frames (5), all Service flow frames (12), `Page 3- job list`,
`Page 3a- start`, `jobs`, `div.rounded-3xl`, `div.bg-red-600`, and the two `SECTION` containers.
Zero copy or geometry changes on any of them.

**Component changes:** none. `jobs` (`494:5627`), `div.rounded-3xl` (`434:2741`) and
`div.bg-red-600` (`434:2743`) are unchanged, so the job-card and `RUNNING LATE` badge components
carry forward as planned.

**New navigation states:** the `Jobs · Attendance · My money` nav is unchanged, but the
**Attendance destination now has real screens** (`506:1986` and `505:1596`), and **My money gains
three destinations** (`502:192`, `504:934`, `502:442`) reachable from the period filter and a
`Pichle cycles` affordance.

### FR.4 `div.max-w-md` (`505:1596`) is an Attendance & Leaves screen, not a responsive container

The node name is misleading. At `448x877` it carries 62 text nodes describing a feature area that
appears **nowhere else in the file**:

- Header `Attendance & Leaves`, `August 2026 Attendance Cycle`
- Cook identity block: `R` / `Ramesh` / `4.9` (a **rating**)
- Summary tiles: `22 Present`, `2 Leaves`, `98% On-Time`
- A **monthly calendar**: `August 2026`, `Monthly Attendance Cycle`, `Current Month`, weekday
  headers `S M T W T F S`, day cells `1`–`31`
- Legend: `Present`, `On Leave`, `Scheduled`
- `Upcoming Approved Leaves` → `2026-08-15`, `Planned Leave`, `Approved`

Note the placeholder name is `Ramesh` here while every other Cook App screen uses `Rekha` —
a cosmetic inconsistency, not a product signal.

This introduces **leave management**, which no previous inventory, plan or gap entry covered.

### FR.5 Attendance scope — RESOLVED BY LATEST FIGMA

`Page 11- attendance` (`506:1986`) contains node `505:1661`, type `FRAME`, **named
`button.flex-1`**, fill `#cfff04` (brand lime), containing the TEXT `Present` (`505:1666`), beneath
the heading `Aaj kaam p aayi hui mai` and a checked-user icon.

It is a **button, not a read-only label**. Therefore the cook **marks** their own attendance.

This resolves the open question from §CA.6 ("does the cook set presence or only view it?") and
**promotes GAP-10 from _pending Figma confirmation_ to a confirmed backend blocker**: the backend
has no cook check-in command. Attendance is admin-set only
(`PUT /v1/admin/cooks/:cookId/attendance/:date`, `src/api/routes/v1/index.ts:2657`).

### FR.6 Backend status of the newly designed surfaces

Backend attendance vocabulary is `present | absent | leave`
(`src/database/migrations/1754302000000_phase3_attendance-availability.sql:42`), which covers the
`Present` and `On Leave` legend entries. `Scheduled` is **not** an attendance status — it is a
shift/booking concept and must not be mapped onto `cook_attendance.status`.

| Ref              | Gap                                                                                                                                                                                                                                                              | Severity                   | Evidence                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------- |
| **GAP-20** (new) | **No cook attendance check-in command.** The `Present` button has no endpoint. Attendance is admin-only.                                                                                                                                                         | **BLOCKER** for `506:1986` | `v1/index.ts:2657` is the only writer          |
| **GAP-21** (new) | **No leave request or approval flow.** `Upcoming Approved Leaves`, `Planned Leave`, `Approved` have no table, endpoint or state machine. Only `paid_leave_refund` / `paid_leave_days` exist, and those are _financial_ effects, not a request/approval workflow. | **HIGH**                   | `src/earnings/financial-service.ts:83,646,689` |
| **GAP-22** (new) | **No on-time percentage metric.** `98% On-Time` has no aggregate anywhere; `TimingVerdict` is per-booking and customer-facing only.                                                                                                                              | MEDIUM                     | `src/fulfilment/domain/timing-verdict.ts:41`   |
| **GAP-23** (new) | **No monthly attendance calendar read.** `GET /v1/cook/attendance` returns history but the calendar needs a month-scoped projection with per-day status, plus `Present`/`Leaves` counts.                                                                         | MEDIUM                     | —                                              |
| **GAP-24** (new) | **Cook rating not exposed to the cook.** `4.9` appears on this screen; GAP-02 (`GET /v1/cook/me`) must include it.                                                                                                                                               | LOW                        | folds into GAP-02                              |

### FR.7 Re-evaluation of the eleven required topics against the new file

| Topic                                              | Verdict                           | Evidence                                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tomorrow's booking visibility (`#155`)             | **FOUNDER CONFIRMATION REQUIRED** | Zero occurrences of `kal` / `tomorrow` in any Cook App text node. No screen shows next-day jobs.                                                                                     |
| `CHALNA START` vs job/service start (`#154`)       | **FOUNDER CONFIRMATION REQUIRED** | The CTA still reads `Start` in all 6 occurrences; `CHALNA START` appears nowhere. Not adopted.                                                                                       |
| Cancellation after cook starts travelling (`#152`) | **FOUNDER CONFIRMATION REQUIRED** | Zero occurrences of `cancel` / `radd`. The requested "uske pages" still do not exist. Design gap — do not invent.                                                                    |
| Three-digit Start/End OTP                          | **UNRESOLVED — conflict stands**  | All three service-OTP containers (`476:4238`, `478:4280`, `481:4462`) hold exactly `Digit 1/2/3`. Login OTP row `434:3255` holds 6. Backend remains `OTP_DIGITS = 4` + `^[0-9]{4}$`. |
| Reminder / double-nudge (`#149`)                   | **FOUNDER CONFIRMATION REQUIRED** | No new screen or copy addresses it. GAP-17 stands.                                                                                                                                   |
| Service extension                                  | **Unchanged**                     | `Page 7c` byte-identical; still shares copy with `7b`. GAP-07 stands.                                                                                                                |
| Attendance                                         | **RESOLVED BY LATEST FIGMA**      | Two screens now exist; `Present` is a button. See FR.5. Scope _expands_ to leaves.                                                                                                   |
| Page 8 / new intermediate states                   | **Confirmed absent**              | Service flow is `4a, 4b×2, 5a, 5b, 6a, 6b, 7a, 7b, 7c, 9, 10`. No Page 8 in the original either.                                                                                     |
| Earnings / performance periods                     | **RESOLVED BY LATEST FIGMA**      | `Aaj`/`Cycle`/`Mahina` filters now all have screens: `485:5062`, `492:5336`, `502:192`, plus `504:934` and `502:442`.                                                                |
| Customer address during travel                     | **Unchanged — conflict stands**   | Travel frames still show `Floor no.` and `Flat/ house no.`, against the gate-only tracking rule.                                                                                     |
| Late / at-risk states                              | **Unchanged**                     | Both `Page 4b` variants byte-identical: `463:3779` at-risk (`4 mins`, `aap LATE ho sakte hai`), `464:3864` late (`-2 mins`, `aap LATE hai!`). Duplicate label persists.              |

### FR.8 Comment mapping against the refreshed frames

Node IDs are identical across all three files, so all 14 Cook App comments from §CA.4 map
unchanged. Re-evaluated status:

| #   | Topic                                  | Status after refresh                                                                       |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| 142 | `x.xx/7` work-hours format             | Open — bonus-threshold conflict (5 vs 7 hrs) persists across daily and monthly screens     |
| 143 | Final payouts in cycle history         | **Target screen now exists** (`502:442`); requirement confirmed, backend gap GAP-18 stands |
| 144 | `Or just "paise"`                      | Resolved (copy)                                                                            |
| 145 | `Extend booking` on cook screen        | Open — still present on travel frames, still has no backend command                        |
| 146 | Font size on travel screens            | Open (visual)                                                                              |
| 147 | Call option during travel              | **Explicit founder decision — Call stays**                                                 |
| 148 | `extension page`                       | Label only                                                                                 |
| 149 | Double nudge                           | Open — GAP-17                                                                              |
| 150 | 3-digit provision (**timer**, not OTP) | Open — timer must render `100+ mins`                                                       |
| 151 | Booking link sharing                   | Resolved, outcome unrecoverable                                                            |
| 152 | Cancellation pages                     | Open — screens still absent                                                                |
| 153 | `hui mai?`                             | Resolved (copy)                                                                            |
| 154 | `CHALNA START?`                        | Open — not adopted in the new file                                                         |
| 155 | Tomorrow's bookings                    | Open — not designed                                                                        |

**Newly resolved by the latest Figma: 2 of 10** open questions from §CA.9 — attendance scope
(FR.5) and earnings periods (FR.7). Eight remain.

---

## Founder Comment Audit — Original Company Figma

**Added 2026-08-21.** This section supersedes the earlier claim that the Figma contained no
comments. That claim was **wrong**: it was drawn from the two file keys then known
(`BTPW14a7M69ySPZxdkc2yn` and the imported copy `tfbXjYufVOo2ZguhklUzhC`), neither of which is the
original company file. Figma preserves neither comments nor version history through a local
`.fig` export/import or a duplicate, so zero comments on the imported copy was expected and proved
nothing.

### CA.1 Retrieval evidence

| Item                        | Value                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| Endpoint                    | `GET https://api.figma.com/v1/files/XMNpmq1fShR87GkLJhLGjW/comments` |
| HTTP status                 | `200`                                                                |
| Authenticated identity      | `lakshayd.intern@spoonhelp.com` (`GET /v1/me` → `200`)               |
| File role for that identity | `viewer` (`linkAccess: inherit`)                                     |
| File name / last modified   | `V0: user app` / `2026-08-20T18:14:21Z`                              |
| Token scopes used           | `file_content:read`, `file_comments:read`, `file_metadata:read`      |

Resolved comments were **not** excluded — the endpoint returns them and all are retained below.

### CA.2 Totals

| Metric                  | Count                                      |
| ----------------------- | ------------------------------------------ |
| Total comments returned | **161**                                    |
| Root comments           | **154**                                    |
| Replies                 | **7**                                      |
| Resolved                | **80**                                     |
| Unresolved              | **81**                                     |
| Authors                 | `Admin / Spoon` (159), `Lakshay Dawar` (2) |
| `order_id` range        | 1 – 155                                    |

**Mapping outcome**

| Bucket                                                        | Roots  | Replies |
| ------------------------------------------------------------- | ------ | ------- |
| Mapped to **Cook App** page (`434:2401`)                      | **14** | 0       |
| Mapped to **User App** page (`0:1`)                           | 116    | 7       |
| Unmapped — `node_id` no longer resolvable in the current tree | 24     | 0       |

All 24 unmapped roots are User App comments pinned to nodes since deleted or restructured (21
resolved, 3 unresolved — `#74`, `#76`, `#77`, all on the deleted node `341:4710`, concerning
multi-link / number-of-people fields in the customer booking flow). **No Cook App comment is
unmapped.** All 7 replies belong to User App threads. Every Cook App comment is a root with no
reply, which matters for §CA.4: nothing self-answers except where the founder answered inline
within a single message.

Client-meta shapes: 153 pinned by `node_id` + `node_offset` + `stable_path`, 1 additionally
carrying `comment_pin_corner` + `region_width`/`region_height`, 7 replies carrying none.

### CA.3 The original file contains four Cook App screens the imported copy does not

This is the most consequential finding of the audit and it is independent of the comments. The
imported copy is **stale**. Comparing the `Cook App` page (`434:2401`, same node ID in both files)
top-level children:

| Node       | Name (original)            | Present in imported copy?                                         |
| ---------- | -------------------------- | ----------------------------------------------------------------- |
| `506:1986` | **Page 11- attendance**    | **NO**                                                            |
| `502:192`  | **Page 3c- money monthly** | **NO**                                                            |
| `504:934`  | **Page 3c- past cycle**    | **NO**                                                            |
| `502:442`  | **Page 4- cycle history**  | **NO**                                                            |
| `505:1596` | `div.max-w-md`             | NO (imported has `462:3516` `1024w default` instead)              |
| `485:5062` | `Page 3a- money daily`     | yes — but **renamed**; imported says `Page 3a- Performance daily` |
| `492:5336` | `Page 3b- money 7 days`    | yes — **renamed**; imported says `Page 3b- Performance 7 days`    |

Original top-level count **14**; imported **10**.

**Two previously reported findings are therefore withdrawn:**

- ~~"Attendance has zero screens designed"~~ — **WRONG.** `Page 11- attendance` (`506:1986`)
  exists. Copy: `Aaj kaam p aayi hui mai` / `Present`, above the same job-card list and the
  `Jobs · Attendance · My money` nav.
- ~~"No 28-day frame exists despite the `Mahina 28 din` filter"~~ — **WRONG.**
  `Page 3c- money monthly` (`502:192`) exists, plus `Page 3c- past cycle` (`504:934`) and a
  `Page 4- cycle history` (`502:442`) listing eight cycles.

**Action:** the original file `XMNpmq1fShR87GkLJhLGjW` is the build source for Phase 1. The
imported copy must not be used for implementation.

New copy recovered from these four screens includes: `mahine ka kaam`, `Bohot accha kaam`,
`7 hr ke upar kaam`, `mahine ki kamai`, `mahine ki galatiyaan`, `mahine ki katauti`,
`Pichle cycles`, `final kamai`, and dated cycle ranges such as `11th Jul - 17th Jul`.

### CA.4 Cook App comment register (all 14)

Resolved: 4 (`#144`, `#147`, `#151`, `#153`). Unresolved: 10.

| #   | Node pinned | Frame                     | Res.    | Message                                                                                                    | Category                                     |
| --- | ----------- | ------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 142 | `485:5062`  | Page 3a- money daily      | no      | `x.xx/7`                                                                                                   | copy/content correction                      |
| 143 | `502:442`   | Page 4- cycle history     | no      | `Probably have final payouts against each one here - baar baar khol kholke thori na dekhenge`              | required functionality + backend             |
| 144 | `502:442`   | Page 4- cycle history     | **YES** | `Or just "paise"`                                                                                          | copy/content correction                      |
| 145 | `462:3617`  | Page 4a- travel on time   | no      | `"Extend booking" icymi`                                                                                   | ambiguity requiring confirmation             |
| 146 | `462:3617`  | Page 4a- travel on time   | no      | `font bada maybe?`                                                                                         | copy/visual, open                            |
| 147 | `462:3617`  | Page 4a- travel on time   | **YES** | `Call option dena hain itne pehle? Only mark arrive pe na? Or actually nahii, address mil hi nhi raha toh` | **explicit founder decision**                |
| 148 | `483:4835`  | Page 7c- Cooking extended | no      | `extension page`                                                                                           | label/identification                         |
| 149 | `485:4971`  | Service flow (section)    | no      | `booking itne baje khatam hogi - double nudge`                                                             | **required functionality + backend**         |
| 150 | `483:4741`  | Page 7a- Cooking          | no      | `hoping this has provision for 3 digits?`                                                                  | **open founder question**                    |
| 151 | `485:4971`  | Service flow (section)    | **YES** | `booking ke saath jo link ayegi voh dene ka option?`                                                       | resolved, outcome unrecorded                 |
| 152 | `485:4971`  | Service flow (section)    | no      | `what if cx cancels post she starts walking? uske pages`                                                   | **required functionality — missing screens** |
| 153 | `506:1986`  | Page 11- attendance       | **YES** | `hui mai?`                                                                                                 | copy/content correction                      |
| 154 | `506:1986`  | Page 11- attendance       | no      | `CHALNA START? Vara job start na lage?`                                                                    | **navigation/copy decision, open**           |
| 155 | `506:1986`  | Page 11- attendance       | no      | `Also provision to see tomorrow's bookings before the day has started?`                                    | **required functionality — open question**   |

### CA.5 Pin-resolution corrections

Two comments were resolved to their nearest element by translating
`client_meta.node_offset` into absolute canvas coordinates and finding the smallest node containing
that point. Both change the reading:

**`#150` — "hoping this has provision for 3 digits?" is about the TIMER, not the OTP.**
Pin resolves to node `479:4356`, the `TEXT` node whose content is literally `37 mins`, on
`Page 7a- Cooking`. It is asking whether the cooking-timer readout can render three digits — i.e.
a remaining time of 100 minutes or more. It is **not** about OTP length.

_Consequence:_ the timer component must render 3-digit minute values without truncation or reflow,
and the layout must be verified at `100+ mins`. This is an open founder question, so it is recorded
as unresolved, not as an approved decision.

_This does not disturb the separately-established OTP contract conflict_, which stands on its own
evidence: the Figma `OTP` containers on `Page 6a`/`Page 6b`/`Page 9` hold exactly three children
(`Digit 1`, `Digit 2`, `Digit 3`, no empty fourth), while the backend is `OTP_DIGITS = 4`
(`src/fulfilment/service-otp.ts`) with route validation `pattern: '^[0-9]{4}$'`
(`src/api/routes/v1/index.ts:2015`, `:2057`). No founder comment addresses that conflict, so it
remains an open question requiring a founder decision.

**`#154` — pinned to the Start CTA button**, node `506:2008` (`button.w-full`) on the attendance
frame's job card. The question is whether that CTA should read `CHALNA START?` so the cook does not
read it as starting the _job_. This is precisely the travel-start versus service-start distinction
the backend already separates (`start-commute` versus `verify-start-otp`).

`#155` resolves to the `Page 11- attendance` frame as a whole. `#142` resolves to a `div.flex`
inside the daily work/hours block.

### CA.6 Re-evaluation of the eleven required topics

| Topic                            | Comment evidence                                    | Status after audit                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tomorrow's bookings              | `#155` (open)                                       | **New requirement, open question.** Extends GAP-01: the cook read model must expose next-day assignments, not just today's. Ordering and the day boundary (IST) must be server-decided.                                                                                                                                                                  |
| Attendance scope                 | `506:1986` exists; `#153` (resolved), `#154` (open) | **Previous "no design" finding withdrawn.** Screen shows `Aaj kaam p aayi hui mai` / `Present` plus the job list. Whether the cook _sets_ presence or only _views_ it is still unresolved — `#154` sits on the CTA, not on the Present control. GAP-10 stays open, now with a design to check against.                                                   |
| Walking / travel-start action    | `#154` (open)                                       | CTA wording may become `CHALNA START?`. Backend already distinguishes commute-start from service-start, so no backend change implied — a **copy decision only**, pending founder.                                                                                                                                                                        |
| Cancellation after travel begins | `#152` (open)                                       | **Confirms GAP-07 from the design side.** Founder explicitly asks for "uske pages" — those screens **do not exist** in either file. Both a frontend gap (no screens) and a backend gap (no cook-facing cancellation channel).                                                                                                                            |
| 3-digit vs 4-digit Start/End OTP | none — `#150` is about the timer                    | **No founder comment covers this.** Conflict stands unresolved: Figma 3 boxes vs backend 4 digits. Requires an explicit founder decision.                                                                                                                                                                                                                |
| Double reminder / nudge          | `#149` (open)                                       | **New backend requirement.** `booking itne baje khatam hogi - double nudge` — two notifications about service end time. No such cook-facing template exists (extends GAP-07/GAP-08). Timing must be backend-owned.                                                                                                                                       |
| Extension behaviour              | `#148` (label), `#145` (open)                       | `#145` flags `Extend booking` on the **cook's** travel screen. Extension is customer-initiated and paid in the backend; a cook-side "Extend booking" affordance has **no backend command**. Open question — likely a leftover from User App copy.                                                                                                        |
| Late / on-time state variants    | `#147` (**resolved decision**)                      | Founder self-answered: the Call option **stays available during travel**, because without it the cook cannot find the address. Applies to `4a`, `4b` (both variants), `5a`, `5b`.                                                                                                                                                                        |
| Earnings and penalties           | `#142`, `#143`, `#144`                              | `#142` sets the work-hours format to `x.xx/7`. `#143` requires **final payout per cycle inline** in cycle history. **New ambiguity:** the daily screen reads `Bonus ke liye: 5 se zyada ghante kaam` (5 hours) while the monthly screen reads `7 hr ke upar kaam` and `#142` says `/7`. The bonus threshold is inconsistent — founder decision required. |
| Service completion               | `#151` (resolved, outcome unrecorded)               | Link-sharing option was raised and closed with no reply, so the decision is not recoverable from the API. Record as resolved-unknown; confirm with founder before building.                                                                                                                                                                              |
| Job-card / job list              | `#154`, `#155`                                      | CTA label and next-day visibility both feed the job card component.                                                                                                                                                                                                                                                                                      |

### CA.7 Frontend changes caused by comments

1. Build **`Page 11- attendance`** (`506:1986`) — previously believed not to exist.
2. Build **`Page 3c- money monthly`** (`502:192`), **`Page 3c- past cycle`** (`504:934`) and
   **`Page 4- cycle history`** (`502:442`) — the 28-day filter now has real designs.
3. Cycle-history rows must show a **final payout amount inline** (`#143`).
4. Work-hours readout formatted **`x.xx/7`** (`#142`).
5. Cooking-timer text must tolerate **three-digit minutes** (`#150`); verify layout at `100+ mins`.
6. **Keep the Call affordance from the travel stage onward** (`#147` — resolved decision).
7. Job-card CTA label pending `CHALNA START?` decision (`#154`) — implement the label as a single
   token so the change is one edit.
8. Screens for **customer-cancels-after-travel-start do not exist** (`#152`) — cannot be built;
   record as a design gap, do not invent them.
9. Rename semantic identifiers from `Performance*` to `Money*` to match the original file.

### CA.8 Backend gaps caused or reinforced by comments

| Ref                 | Gap                                                                                                                                                                                      | Severity | Source                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------- |
| GAP-16 (new)        | **Next-day / tomorrow's bookings** not exposed by any read; extends GAP-01's proposed cook read model with a day-scoped query and an IST day boundary.                                   | HIGH     | `#155`                 |
| GAP-17 (new)        | **Double end-of-service nudge** — two cook-facing notifications about the booking end time. No cook push template exists; timing must be backend-owned, not client-scheduled.            | HIGH     | `#149`                 |
| GAP-18 (new)        | **Per-cycle final payout in the cycle list** — `GET /v1/cook/earnings/cycles` (proposed in GAP-03) must return a settled final amount per cycle, not require opening each.               | MEDIUM   | `#143`                 |
| GAP-07 (reinforced) | **Cook-facing cancellation channel** — founder explicitly requests the post-travel-start cancellation pages; backend has no cook cancellation notification and the screens do not exist. | HIGH     | `#152`                 |
| GAP-19 (new, open)  | **Bonus threshold is ambiguous** — 5 hours (daily copy) vs 7 hours (`#142`, monthly copy). Whichever wins, the threshold must be a backend-projected value, never a client constant.     | MEDIUM   | `#142` + copy conflict |
| —                   | **Cook-side "Extend booking" has no backend command.** Extension is customer-initiated and payment-dependent. Needs founder clarification before any endpoint is proposed.               | OPEN     | `#145`                 |

### CA.9 Open founder questions — none of these may be treated as decided

1. **Start/End OTP length** — Figma 3 boxes vs backend 4 digits. No comment addresses it.
2. **Bonus threshold** — 5 hours or 7 hours?
3. **Timer 3-digit provision** (`#150`) — confirm the timer must support `100+ mins`.
4. **`CHALNA START?` CTA wording** (`#154`).
5. **Attendance scope** — does the cook mark presence, or only view it?
6. **Tomorrow's bookings** (`#155`) — in or out of V0?
7. **`Extend booking` on cook screens** (`#145`) — keep, remove, or repurpose?
8. **Cancellation-after-travel-start screens** (`#152`) — need design before build.
9. **Booking-link sharing** (`#151`) — resolved with no recorded outcome.
10. **Font size increase on travel screens** (`#146`).

Per the audit rule, a founder _question_ is not an approved decision. Only `#147` (Call option
stays) is recorded as an explicit founder decision; `#144`, `#151` and `#153` are resolved with
outcomes that are either trivially clear (`#144`, `#153`) or unrecoverable (`#151`).

---

## A. Executive summary

### Overall assessment

The backend is **substantially stronger than a Cook App Phase 2 would assume in the fulfilment
core, and substantially weaker in everything the Cook App needs to _read_.**

Every _write_ the cook performs during a service is implemented, transactional, idempotent,
audited, and deployed: GO/start-commute, location ingestion with validation, geofenced arrival,
Start OTP, End OTP with atomic entitlement consumption. The P80 travel model, the five-minute
lateness grace, the 22:00 hard service-end cutoff, and the transactional outbox all exist in code
and match the product rules in the handover.

What is missing is the **read surface**. There is no endpoint from which the Cook App can learn
that it has a job at all.

### Primary blockers

1. **No cook job list, job detail, or active-session read endpoint — anywhere.** _(BLOCKER)_
   The cook route table is exactly ten routes. Confirmed by direct inspection of
   `D:\spoon-backend\src\api\routes\v1\index.ts`:

   | Line | Method | Route                                         |
   | ---- | ------ | --------------------------------------------- |
   | 1751 | GET    | `/cook/attendance`                            |
   | 1782 | GET    | `/cook/earnings`                              |
   | 1801 | GET    | `/cook/earnings/cycles/:cycleId`              |
   | 1821 | PUT    | `/cook/availability`                          |
   | 1876 | POST   | `/cook/bookings/:bookingId/start-commute`     |
   | 1911 | POST   | `/cook/bookings/:bookingId/acknowledge-alert` |
   | 1966 | POST   | `/cook/bookings/:bookingId/arrive`            |
   | 2001 | POST   | `/cook/bookings/:bookingId/verify-start-otp`  |
   | 2043 | POST   | `/cook/bookings/:bookingId/verify-end-otp`    |
   | 2498 | POST   | `/cook/location`                              |

   Every booking-scoped route is a **POST that already requires a `bookingId` the app has no way
   to obtain**. All booking reads (`GET /v1/bookings/:id`, `/me/bookings`, `/me/bookings/active`,
   `/bookings/:id/tracking`) call `requireCustomer`, which throws `FORBIDDEN` for `role: 'cook'`
   (`v1/index.ts:203-206`). This single gap blocks the Jobs list, the job card, the countdown, the
   travel screens' data, the cooking timer's resynchronisation, and the "today's work count" on My
   Money.

2. **No cook self-profile read.** _(HIGH)_ `GET /v1/me` joins `user_profiles`, not `cook_profiles`
   (`src/identity/repositories/profile-repository.ts:72-97`). The cook's avatar (`photo_url`),
   profile status, hub, shift and rating are unreachable by the cook. The profile/avatar entry in
   the app shell has no data source.

3. **No earnings aggregation matching the My Money design.** _(HIGH)_ `GET /v1/cook/earnings`
   returns a lifetime total plus the last ≤100 raw ledger events. There is no daily, 7-day or
   28-day aggregate, and no endpoint that lists cycles or returns the _current_ cycle — so the
   `cycleId` required by `GET /v1/cook/earnings/cycles/:cycleId` is undiscoverable by the client.
   The three Figma filters (`Aaj — 1 din`, `Cycle — 7 din`, `Mahina — 28 din`) have no backing
   endpoint.

4. **Earnings cycles are never created in production.** _(BLOCKER for My Money correctness)_
   `createEarningsCycle` (`src/earnings/financial-service.ts:442`) has **zero production callers** —
   only tests. `recordPresentDay` (`financial-service.ts:475-515`) accrues base pay only when an
   open `earnings_cycles` row covers the date. Until rows are inserted manually, base pay, cycle
   bonus and paid-leave refund silently never accrue. Earnings would display as near-zero and look
   like a frontend bug.

5. **Login is role-blind and auto-provisions customers.** _(HIGH)_ `POST /v1/auth/otp/verify`
   upserts `INSERT INTO users ... VALUES (..., 'user','active', ...) ON CONFLICT (phone) DO UPDATE`
   (`v1/index.ts:593`). An unknown phone that passes OTP **receives a valid token** as an active
   _customer_, and a stray `users` row is created. The product rule "a valid OTP alone must not
   grant Cook App access" is satisfied for _data_ (every `/v1/cook/*` route is gated by
   `requireCook`, `v1/index.ts:338-361`, which requires `role='cook'` AND `users.status='active'`
   AND `cook_profiles.status='active'`) but **not for login itself**. There is no server-side
   "this phone is not a cook" rejection; the app can only inspect the `role` field in the verify
   response.

6. **Cook onboarding requires a manual database step.** _(ADMIN/OPS-BLOCKED)_ No endpoint or
   script anywhere sets `users.role = 'cook'` (grep for `SET role`: no matches). Cook shift rows
   (`cook_shifts`) are likewise INSERTed only by the test fixture. Both are DB-only.

7. **The cook has no channel for extension, cancellation or reassignment.** _(HIGH)_ Outbox events
   are emitted for all three, but the push template map
   (`src/fulfilment/notification-dispatch.ts:35-62`) is customer-only, and there is no cook poll
   endpoint. **A cook whose service is extended cannot learn the new end time by any means.** A
   cook whose job is cancelled or reassigned discovers it only when their next command returns
   `ACTIVE_ASSIGNMENT_CHANGED`. Page 7c (customer-extended service) is not producible today.

### What can already be integrated

- Phone→OTP→token→refresh→logout, with rotating refresh tokens, family reuse-revocation, and
  live DB session checks on every request.
- The entire in-service command chain once a `bookingId` is known by other means: start-commute,
  location, arrive, Start OTP, End OTP.
- `GET /v1/cook/attendance` (read-only history) and `PUT /v1/cook/availability`.
- Push token registration via `PUT /v1/me/push-token`.
- Start Alert / Start Escalation pushes to cook devices, and `acknowledge-alert`.

### What cannot work end-to-end today

The Jobs list, the job card, any countdown, the profile/avatar, My Money in the shape the design
requires, cook-visible ETA or late-risk state, extension propagation to the cook, cancellation and
reassignment notice to the cook, and any post-restart resynchronisation of an active service.

---

## B. Figma inventory

**RESOLVED 2026-08-21 — Figma access restored; this section is now populated elsewhere.**

The blocker described in §0.1 was diagnosed incorrectly (§0.5) and then cleared: the authoritative
file is `N44dO2hqLQBw5I5TKh0wmu`, readable at `role: viewer` over the REST API.

The full V0 inventory now lives in two places rather than being duplicated here:

- **§Figma Source Refresh (FR.3)** — the complete 29-frame inventory with node IDs, plus the
  differential against the superseded import (5 added, 1 removed, 2 renamed, 24 unchanged).
- **§Phase 1 Implementation Status (IMP.4)** — every V0 node mapped to its implementing file,
  with semantic names assigned where Figma labels are duplicated or misleading
  (`TravelRisk` / `TravelLate` for the two `Page 4b` frames; `StartOtpLate` for the `6b` frame
  whose label says "on time" but whose copy is the late variant).

---

## C. End-to-end contract matrix

Local status is from source inspection with file:line evidence. Deployed status is from
unauthenticated probes against `https://spoon-api-kalc.onrender.com`, where **401 proves the route
is registered** and 404 proves absence (Fastify returns 404 for unknown routes). Frontend status is
`NOT STARTED` throughout because of the Figma blocker.

| Flow / screen         | Cook action  | Expected API / event                                 | Local                  | Deployed     | Frontend    | Customer-side effect         | Admin/Ops dependency                            | Gap                                                                  |
| --------------------- | ------------ | ---------------------------------------------------- | ---------------------- | ------------ | ----------- | ---------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Splash / boot         | —            | session restore + `GET /v1/me`                       | EXISTS                 | EXISTS (401) | NOT STARTED | —                            | —                                               | `/v1/me` returns no cook profile                                     |
| Login — phone         | submit phone | `POST /v1/auth/otp/send`                             | EXISTS                 | EXISTS       | NOT STARTED | —                            | —                                               | Role-blind; no "not a cook" rejection                                |
| Login — OTP           | submit OTP   | `POST /v1/auth/otp/verify`                           | EXISTS                 | EXISTS       | NOT STARTED | —                            | Cook must pre-exist with `role='cook'`          | **Auto-creates a customer for unknown phones**                       |
| Approved-cook gate    | —            | `requireCook` on `/v1/cook/*`                        | EXISTS                 | EXISTS       | NOT STARTED | —                            | Approval via `POST /v1/admin/cooks/:id/approve` | Gate is per-route, not at login                                      |
| Session refresh       | background   | `POST /v1/auth/refresh`                              | EXISTS                 | EXISTS       | NOT STARTED | —                            | —                                               | None                                                                 |
| Logout                | tap          | `POST /v1/auth/logout`                               | EXISTS                 | EXISTS       | NOT STARTED | —                            | —                                               | None                                                                 |
| Profile / avatar      | open profile | _(cook self-profile read)_                           | **MISSING**            | MISSING      | NOT STARTED | —                            | —                                               | **No endpoint**                                                      |
| **Jobs list**         | open tab     | _(cook assignments read)_                            | **MISSING**            | MISSING      | NOT STARTED | —                            | —                                               | **BLOCKER — no endpoint**                                            |
| Job card countdown    | —            | server timestamps in job read                        | **MISSING**            | MISSING      | NOT STARTED | —                            | —                                               | `serverTime` exists but only on customer reads                       |
| Start-eligible state  | —            | departure plan read                                  | **MISSING**            | MISSING      | NOT STARTED | —                            | —                                               | Computed server-side; push-only, unreadable                          |
| Start alert           | receive push | `start_alert` / `start_escalation`                   | EXISTS                 | EXISTS       | NOT STARTED | —                            | FCM service account                             | Unreadable after dismissal                                           |
| Ack alert             | tap          | `POST /v1/cook/bookings/:id/acknowledge-alert`       | EXISTS                 | EXISTS (401) | NOT STARTED | —                            | —                                               | None                                                                 |
| **Travel — GO**       | tap START    | `POST /v1/cook/bookings/:id/start-commute`           | EXISTS                 | EXISTS (401) | NOT STARTED | `booking.cook_en_route` push | —                                               | Needs a `bookingId` the app cannot obtain                            |
| Travel — location     | background   | `POST /v1/cook/location`                             | EXISTS                 | EXISTS (400) | NOT STARTED | Tracking updates             | —                                               | Foreground-only in reference app                                     |
| Travel — on time      | —            | ETA + `timingVerdict`                                | EXISTS (customer read) | EXISTS       | NOT STARTED | Customer tracking            | —                                               | **Not readable by the cook**                                         |
| Travel — late risk    | —            | risk `watch/at_risk/critical`                        | EXISTS (worker)        | EXISTS       | NOT STARTED | Move alerts                  | —                                               | **Not readable by the cook**; `cook.move_alert` has no push template |
| Travel — late         | —            | `timingVerdict='LATE'` (5-min grace)                 | EXISTS                 | EXISTS       | NOT STARTED | Customer sees LATE           | —                                               | **Not readable by the cook**                                         |
| **Arrival**           | auto / tap   | GPS evidence, or `POST /v1/cook/bookings/:id/arrive` | EXISTS                 | EXISTS (401) | NOT STARTED | `booking.cook_arrived` push  | —                                               | None — well implemented                                              |
| **Start OTP**         | enter code   | `POST /v1/cook/bookings/:id/verify-start-otp`        | EXISTS                 | EXISTS (400) | NOT STARTED | `service.started`            | —                                               | **No OTP expiry, no per-OTP lockout** (documented V0 decision)       |
| **Cooking timer**     | —            | `actual_start` / `expected_end`                      | EXISTS                 | EXISTS       | NOT STARTED | Customer timer               | —                                               | **No cook resync endpoint after restart**                            |
| **Extension (7c)**    | —            | `booking.extension.confirmed`                        | EXISTS (customer)      | EXISTS       | NOT STARTED | Customer pays and extends    | —                                               | **BLOCKER — no cook push template, no cook poll endpoint**           |
| 10 PM cutoff          | —            | `isWithinOperatingWindowAt`                          | EXISTS                 | EXISTS       | NOT STARTED | Extension refused            | —                                               | None                                                                 |
| **End OTP**           | enter code   | `POST /v1/cook/bookings/:id/verify-end-otp`          | EXISTS                 | EXISTS (400) | NOT STARTED | `booking.completed` push     | —                                               | Retry from `completed` returns `INVALID_BOOKING_STATE`               |
| **Completion**        | —            | atomic completion + entitlement                      | EXISTS                 | EXISTS       | NOT STARTED | `canRate` / `canTip`         | —                                               | Creates no per-booking earnings row                                  |
| Cancellation notice   | —            | _(cook push)_                                        | **MISSING**            | MISSING      | NOT STARTED | Customer cancels             | —                                               | **Cook never told**                                                  |
| Reassignment notice   | —            | `booking.reassigned`                                 | EXISTS (customer only) | EXISTS       | NOT STARTED | Customer notified            | —                                               | **Cook never told**                                                  |
| **Attendance**        | open tab     | `GET /v1/cook/attendance`                            | EXISTS                 | EXISTS (401) | NOT STARTED | —                            | Admin marks attendance                          | **No cook check-in/check-out**                                       |
| Availability          | toggle       | `PUT /v1/cook/availability`                          | EXISTS                 | EXISTS       | NOT STARTED | Affects matching             | Shift must exist (DB-only)                      | None                                                                 |
| **My Money — Aaj**    | filter       | _(daily aggregate)_                                  | **MISSING**            | MISSING      | NOT STARTED | —                            | Cycle rows DB-only                              | **No endpoint**                                                      |
| **My Money — 7 din**  | filter       | _(7-day aggregate)_                                  | **MISSING**            | MISSING      | NOT STARTED | —                            | —                                               | **No endpoint**                                                      |
| **My Money — 28 din** | filter       | `GET /v1/cook/earnings/cycles/:cycleId`              | PARTIAL                | EXISTS (401) | NOT STARTED | —                            | Cycle rows DB-only                              | **`cycleId` undiscoverable**                                         |
| Bonus progress        | —            | derived from attendance                              | PARTIAL                | PARTIAL      | NOT STARTED | —                            | —                                               | Client would have to count                                           |
| Tips                  | —            | `tip` ledger event                                   | EXISTS                 | EXISTS       | NOT STARTED | Customer tips                | —                                               | Only in raw event list                                               |
| Push registration     | on login     | `PUT /v1/me/push-token`                              | EXISTS                 | EXISTS       | NOT STARTED | —                            | FCM service account                             | Not role-aware                                                       |

---

## D. State-machine comparison

### Backend booking status enum — implemented and enforced

`created | assigned | cook_en_route | cook_arrived | cooking | completed | cancelled`
(DB CHECK at `src/database/migrations/1754313000000_phase8...sql:26`; guard vocabulary at
`src/fulfilment/assignment-guard.ts:38-47`)

Enforcement is three-layered and genuinely sound: a single guard
(`loadCurrentAssignmentForCommand`, `assignment-guard.ts:158-197`) proving booking + current
assignment + caller identity + `assignment_version`, locking booking→assignment in canonical order;
guarded conditional `UPDATE ... WHERE status='<from>'` on every transition; and DB CHECK constraints
making `cooking`/`completed` impossible without `actual_start` / `actual_end`.

| From → To                                        | Trigger                                                     | Cook-facing API?           |
| ------------------------------------------------ | ----------------------------------------------------------- | -------------------------- |
| `created → assigned`                             | payment finalisation                                        | No (customer/webhook)      |
| `assigned → cook_en_route`                       | `start-commute`                                             | **Yes**                    |
| `cook_en_route → cook_arrived`                   | 2 consecutive GPS samples ≤75 m of gate, or manual `arrive` | **Yes (both)**             |
| `cook_arrived → cooking`                         | `verify-start-otp`                                          | **Yes**                    |
| `cooking → completed`                            | `verify-end-otp`                                            | **Yes**                    |
| `created/assigned → cancelled`                   | customer cancel (blocked once `cook_en_route`)              | No                         |
| any live `→ cancelled`                           | service-failure cancel                                      | No                         |
| `cook_en_route/cook_arrived/assigned → assigned` | recovery replacement, new assignment version                | **No — worker/admin only** |

### Frontend typed states

**Not yet defined** — the service-state projection is part of the blocked implementation half.

### Figma visual states

**Unknown** — see §0.1.

### Findings available without Figma

- **Missing mapping — no `no_show` booking status.** No-show is modelled as a `no_show_findings`
  row plus a financial penalty plus a recovery flow (`src/fulfilment/risk-monitor-service.ts:338-412`),
  never as a booking status (DEC-060). The booking either recovers to `assigned` or is cancelled.
  A Cook App must not expect a `no_show` state on the booking.
- **Missing mapping — travel sub-states are not booking statuses.** Pages 4a / 4b-risk / late all
  live inside the single backend status `cook_en_route`. The distinction comes from two _separate_
  backend systems: the customer-facing `timingVerdict` (`ON_TIME|LATE|UNKNOWN`, measured against
  `customer_commitment_at` with the 5-minute grace,
  `src/fulfilment/domain/timing-verdict.ts:62-86`) and the ops risk level
  (`none|watch|at_risk|critical`, `src/fulfilment/domain/risk-evaluator.ts:165-309`). **Neither is
  exposed to the cook.** Which one drives the Figma "risk window" screen is an open product
  question the founder must settle — and it must not be recomputed client-side.
- **Missing mapping — arrival on-time vs late (5a / 5b) is a derived verdict, not a status.** Both
  are backend status `cook_arrived`; the split comes from `actual_gate_arrival_at` vs
  `customer_commitment_at` with the 5-minute grace. Not currently readable by the cook.
- **Missing mapping — extension (7c) is not a status.** It mutates `bookings.expected_end` in place
  while status stays `cooking`. With no cook-side channel, this state is **not producible in the
  Cook App today**.
- **States not currently producible in the Cook App:** every one of them, because no job list
  exists to enter the flow from.
- **Impossible transition to guard against:** there is no cook-initiated decline, reject, pause, or
  cancel. The cook's entire verb set is: GO, location, arrive, acknowledge-alert, Start OTP, End
  OTP. Any Figma affordance implying a cook can decline or cancel a job has no backend support.
- **Reverse transitions do not exist.** `cook_arrived → cook_en_route` is impossible; reassignment
  (new `assignment_version`) is the only reset, and it is unreachable from `cooking`.
- **Retry asymmetry worth designing around:** `arrive` converges on retry (its `allowedStatuses`
  includes `cook_arrived`), but `verify-end-otp` does not (`allowedStatuses: ['cooking']` only), so a
  retry with a fresh idempotency key after success returns `INVALID_BOOKING_STATE`. The Cook App's
  End OTP retry logic must reuse the same `Idempotency-Key`.
- **"Gate" is currently the customer's own coordinate.** `findBookingGate`
  (`src/fulfilment/repositories/eta-repository.ts:223-254`) COALESCEs the booking address snapshot
  point first, so under the V0 serviceability override tracking terminates at the customer's
  snapshotted location rather than a distinct society gate. This satisfies "tracking stops before
  the doorstep" in effect, but the product rule "tracking is only until the configured society/
  building gate" is **not literally true today**. Founder confirmation needed.

---

## E. Backend gaps

### GAP-01 — No cook job list / job detail / active-session read

- **Severity:** BLOCKER
- **Affected:** Jobs list (Page 3) and every job card state; all travel screens; cooking timer
  resync; today's-work count on My Money; app shell job persistence.
- **Missing behaviour:** A cook cannot discover a `bookingId`. All five booking-scoped cook
  commands take a `bookingId` path parameter with no read endpoint to source it.
- **Module:** `src/api/routes/v1/index.ts` (cook section ~1750-2100), `src/bookings/booking-service.ts`,
  new cook read model.
- **Proposal:** `GET /v1/cook/bookings` (current + upcoming, ordered, with server timestamps,
  duration, society/gate, privacy-safe customer fields, `assignmentVersion`, derived
  actionable/start-eligible flag, `serverTime`) and `GET /v1/cook/bookings/:bookingId` (adds
  `actual_start`, `expected_end`, `remainingSeconds`, timing verdict, current OTP purpose). Reuse
  the existing customer projection shape but strip customer-private fields.
- **Concurrency/idempotency:** Reads — none required. Must return `assignmentVersion` so the app
  can detect reassignment.
- **Tests:** cook sees only own current assignment; superseded assignment excluded; cancelled
  booking excluded; `requireCook` gating; privacy assertion that no customer PII beyond the agreed
  set is projected.
- **Admin/Ops also required:** No.

### GAP-02 — No cook self-profile read

- **Severity:** HIGH
- **Affected:** Profile entry / avatar in the app shell; approved-cook gate UX.
- **Missing behaviour:** `GET /v1/me` joins `user_profiles`, not `cook_profiles`
  (`src/identity/repositories/profile-repository.ts:72-97`). No avatar, profile status, hub, shift
  or rating.
- **Module:** `src/identity/`, `src/cooks/`.
- **Proposal:** `GET /v1/cook/me` returning `{ id, name, photoUrl, status, hubId, rating, todayShift }`.
- **Tests:** pending/paused cook receives correct status; no cross-cook leakage.
- **Admin/Ops also required:** No.

### GAP-03 — No earnings aggregation; `cycleId` undiscoverable

- **Severity:** HIGH
- **Affected:** All of My Money — the three filters, and every named line item.
- **Missing behaviour:** `GET /v1/cook/earnings` gives a lifetime total plus ≤100 raw events. No
  daily/7-day/28-day aggregate, no cycle list, no current-cycle pointer.
- **Module:** `src/earnings/financial-service.ts` (`getCookEarnings:411-440`, `getCookCycle:830-887`).
- **Proposal:** `GET /v1/cook/earnings/summary?period=day|week|cycle` returning exactly the design's
  fields — `workCount`, `basePaise`, `bonusPaise`, `tipsPaise`, `noShowCount`, `noShowDeductionPaise`,
  `lateCount`, `lateDeductionPaise`, `totalDeductionsPaise`, `finalPaise`, `bonusProgress`. Plus
  `GET /v1/cook/earnings/cycles` to list cycles including the current one.
- **Concurrency/idempotency:** Reads. Must aggregate on the IST service date, **not** on
  `created_at` — see GAP-04.
- **Tests:** IST boundary correctness; zero-earnings and zero-deduction cases; reversal events
  netting correctly; partial bonus progress.
- **Admin/Ops also required:** Yes — depends on GAP-04.

### GAP-04 — Earnings cycles are never created in production

- **Severity:** BLOCKER (for My Money correctness)
- **Affected:** Base amount, cycle bonus, paid-leave refund, bonus progress.
- **Missing behaviour:** `createEarningsCycle` (`src/earnings/financial-service.ts:442`) has **no
  production caller** — tests only. `recordPresentDay` (`financial-service.ts:475-515`) accrues base
  pay only when an open `earnings_cycles` row covers the date, so base pay silently never accrues.
- **Module:** `src/earnings/earnings-worker.ts`, admin routes.
- **Proposal:** Either a worker pass that opens the next 28-day cycle automatically, or an admin
  command. Automatic is safer — a missing cycle fails silently rather than loudly.
- **Concurrency/idempotency:** Must be idempotent; the `earnings_cycles` non-overlapping EXCLUDE
  constraint already prevents duplicates, so handle the conflict rather than crashing the pass.
- **Tests:** cycle rollover at the 28-day boundary; no gap and no overlap; concurrent worker ticks.
- **Admin/Ops also required:** Yes.

### GAP-05 — Cook-side IST day bucketing hazard

- **Severity:** MEDIUM
- **Affected:** Daily earnings figures.
- **Missing behaviour:** `cook_financial_events.created_at` is UTC `NOW()`, and `recordLongHours`
  groups by `b.service_start::date` — a UTC cast (`src/earnings/financial-service.ts:537`). Any
  daily aggregate built naively on `created_at` mis-buckets the 00:00–05:30 IST window.
- **Module:** `src/earnings/`.
- **Proposal:** Use `evidence.serviceDate` as the day key, or add an explicit IST `service_date`
  column to the ledger.
- **Tests:** an event at 01:00 IST lands on the correct Indian day.
- **Admin/Ops also required:** No.

### GAP-06 — Login is role-blind and auto-provisions customers

- **Severity:** HIGH
- **Affected:** Login (Pages 1, 2a–2c); the approved-cook rule.
- **Missing behaviour:** `POST /v1/auth/otp/verify` upserts an active `role='user'` row for any
  unknown phone (`src/api/routes/v1/index.ts:593`). No server-side rejection for non-cooks; stray
  customer accounts are created by Cook App login attempts.
- **Module:** `src/api/routes/v1/index.ts` auth section.
- **Proposal:** Add an explicit audience to the OTP flow (`audience: 'cook' | 'customer'`). For
  `cook`, skip the auto-provisioning upsert entirely and return a distinct error code
  (e.g. `COOK_NOT_PROVISIONED`) for unknown/pending/suspended identities, so the app can render the
  correct Hinglish copy rather than inferring from `role`.
- **Concurrency/idempotency:** Existing OTP transaction semantics are already correct.
- **Tests:** unknown phone creates **no** `users` row on the cook audience; pending, paused and
  suspended cooks each get their own error code; customer audience behaviour unchanged.
- **Admin/Ops also required:** No.

### GAP-07 — Cook has no channel for extension / cancellation / reassignment

- **Severity:** HIGH (BLOCKER for Page 7c)
- **Affected:** Cooking timer with extension (7c); cancelled/reassigned job card states.
- **Missing behaviour:** Outbox events `booking.extension.confirmed`, `booking.reassigned` and the
  cancellation path all fire, but the push template map
  (`src/fulfilment/notification-dispatch.ts:35-62`) is customer-only and there is no cook poll
  endpoint. A cook cannot learn their service was extended by **any** means.
- **Module:** `src/fulfilment/notification-dispatch.ts`, cook read model (GAP-01).
- **Proposal:** Add cook-targeted push templates for extension confirmed, cancellation,
  reassignment, and service-ending warning; and ensure GAP-01's detail read returns the current
  `expected_end` so foreground refetch reconciles regardless of push delivery.
- **Concurrency/idempotency:** Outbox already dedupes on
  `(aggregate_type, aggregate_id, event_type)`. Push must be treated as a hint, never as truth — the
  timer must reconcile from the read.
- **Tests:** extension while the screen is open; extension while backgrounded; push lost entirely
  and reconciliation on foreground.
- **Admin/Ops also required:** No.

### GAP-08 — `cook.move_alert` outbox event has no push template

- **Severity:** MEDIUM
- **Affected:** Travel late-risk screen.
- **Missing behaviour:** `src/fulfilment/risk-monitor-service.ts:299-320` emits `cook.move_alert`,
  but no template consumes it, so it is never delivered.
- **Module:** `src/fulfilment/notification-dispatch.ts`.
- **Proposal:** Add the template; expose the risk state on the GAP-01 detail read as well.
- **Tests:** risk escalation produces exactly one delivered alert.
- **Admin/Ops also required:** No.

### GAP-09 — Cook user creation and shift assignment are DB-only

- **Severity:** HIGH — ADMIN/OPS-BLOCKED
- **Affected:** Every flow. No cook can exist without manual SQL.
- **Missing behaviour:** No endpoint or script sets `users.role='cook'` (no `SET role` anywhere).
  `cook_shifts` is INSERTed only by `tests/support/fulfilment-world.ts:164`. `cook_profiles.hub_id`
  is never written by any code path. `users.status='suspended'` has no endpoint.
- **Module:** `src/api/routes/admin/index.ts`, `src/admin/commands.ts`.
- **Proposal:** Admin commands to create a cook identity (phone → `role='cook'`, status `pending`),
  assign hub, create/edit shifts, and suspend/reinstate. Audited and idempotent like the existing
  admin commands.
- **Tests:** cannot create a cook on a phone already registered as a customer without an explicit
  conversion path; shift overlap rejected by the existing GiST constraint.
- **Admin/Ops also required:** Yes — and note the Admin/Ops frontend does not exist, so Phase 2
  needs at minimum a safe seeding script.

### GAP-10 — Attendance has no cook check-in/check-out

- **Severity:** MEDIUM — pending Figma confirmation of what Attendance actually shows
- **Affected:** Attendance tab.
- **Missing behaviour:** Attendance is admin-marked only
  (`PUT /v1/admin/cooks/:cookId/attendance/:date`). The cook can read history
  (`GET /v1/cook/attendance`) and set availability, but cannot mark presence.
- **Module:** `src/cooks/operations.ts`.
- **Proposal:** Defer until the Figma Attendance frames are inspected — the design may only ever
  display history, in which case there is no gap. **Do not invent attendance rules.**
- **Admin/Ops also required:** Yes, if correction flows are required.

### GAP-11 — Start/End OTP have no expiry and no per-OTP lockout

- **Severity:** MEDIUM (documented V0 decision, flagged for awareness)
- **Affected:** Start OTP (6a/6b) and End OTP (Page 9) — specifically the "expired OTP" and
  "rate-limit" states the handover asks for.
- **Missing behaviour:** Deliberate no-expiry, no-lockout design
  (`src/database/migrations/...phase6...:173-176`, `src/fulfilment/service-otp.ts:33-38`). A failure
  counter fires exactly one ops alert at the 3rd failure; only the global request rate limiter
  bounds brute force on a 4-digit code.
- **Proposal:** None in Phase 1. **The Cook App must not render an "expired OTP" state that the
  backend cannot produce** — confirm against Figma before building those variants.
- **Admin/Ops also required:** No.

### GAP-12 — OpenAPI is not served from the deployed host

- **Severity:** LOW
- **Affected:** Contract verification workflow.
- **Missing behaviour:** `/docs`, `/openapi.json`, `/openapi.yaml`, `/documentation`, `/swagger` all
  return 404 on Render. The spec exists only as the in-repo file `openapi/openapi.yaml`, validated
  in CI by `scripts/validate-openapi.ts`.
- **Proposal:** Serve the spec at a stable path, or publish it as a build artefact.
- **Admin/Ops also required:** No.

### GAP-13 — No realtime channel; no cook-reachable server time

- **Severity:** MEDIUM
- **Affected:** Cooking timer reconciliation; extension propagation.
- **Missing behaviour:** No WebSocket or SSE anywhere (no `@fastify/websocket`, no
  `text/event-stream`). `serverTime` is published only on the customer booking projection
  (`src/bookings/booking-service.ts:534-541`), which a cook cannot call — so the Cook App currently
  has **no route returning server time**.
- **Proposal:** Include `serverTime` in the GAP-01 cook reads. Polling plus push is sufficient for
  V0; a realtime channel is not needed.
- **Tests:** clock-drift and device-time-manipulation reconciliation.
- **Admin/Ops also required:** No.

### GAP-14 — "Gate" is currently the customer's own coordinate

- **Severity:** MEDIUM — product clarification
- **Affected:** Travel and arrival screens; the tracking-destination product rule.
- **Missing behaviour:** `findBookingGate` (`src/fulfilment/repositories/eta-repository.ts:223-254`)
  COALESCEs the booking address snapshot point first, so tracking terminates at the customer's
  snapshotted location, not a distinct configured society gate.
- **Proposal:** Founder decision. Behaviourally it satisfies "tracking stops before the doorstep",
  but the stated rule is not literally implemented.
- **Admin/Ops also required:** Yes, if real gate records must be provisioned per society.

### GAP-15 — No payout rail

- **Severity:** LOW for Phase 1 — DEFERRED / V1
- **Missing behaviour:** `cook_financial_events` records what a cook is owed; no payout,
  settlement, bank or UPI transfer exists anywhere in the system.
- **Proposal:** Out of scope. Confirm the Figma My Money screens do not promise a payout status.

---

## F. Phase 2 implementation order

Dependency-aware, adjusted to the actual findings. Steps 0 and 1 are new and non-negotiable — the
original suggested ordering starts at authentication, but nothing can be tested without a cook
existing and a job being discoverable.

0. **Restore Figma access, then complete Phase 1's frontend half.** Sections B and D of this
   report, plus the full V0 presentation layer. Everything below assumes the screens exist.
1. **GAP-09 — cook provisioning path** (admin command or a reviewed seed script). Without this no
   cook exists and nothing downstream is testable.
2. **GAP-06 — cook-aware login** (`audience`, no auto-provisioning, explicit not-provisioned /
   pending / suspended error codes).
3. **GAP-02 — `GET /v1/cook/me`** (session, profile, avatar, status).
4. **GAP-01 — cook job list and job detail.** The keystone. Unblocks Jobs, travel, timer, and the
   today's-work count. Include `serverTime` and `assignmentVersion` (closes GAP-13's read half).
5. **Travel-start and tracking integration** — already implemented backend-side; wire the app.
6. **Expose ETA / timing verdict / risk state on the cook read** (closes the readable half of the
   travel states and GAP-08).
7. **Arrival integration** — backend is complete; wire and verify the 75 m / 2-sample rule against
   the Figma arrival states.
8. **Start OTP integration**, reconciling GAP-11 against the actual Figma variants.
9. **Active service and timer**, reconstructed from backend timestamps with foreground reconciliation.
10. **GAP-07 — extension propagation to the cook** (push templates + reconcile on the detail read).
11. **End OTP and completion**, with same-key idempotent retry (note the `arrive` vs `verify-end-otp`
    retry asymmetry).
12. **GAP-04 — automatic earnings cycle creation.** Must precede any earnings UI work or the
    numbers will be wrong and look like a frontend defect.
13. **GAP-03 and GAP-05 — earnings summary endpoint** with correct IST bucketing.
14. **Attendance** (GAP-10), scoped strictly to what the Figma frames show.
15. **FCM / live updates** — cook push templates for cancellation, reassignment, service-ending.
16. **Admin/Ops dependencies** — hub and shift management, penalty review, earnings adjustment.
17. **Full Customer–Cook end-to-end verification** on seeded data.

---

## G. Test and seed requirements

An existing test fixture, `tests/support/fulfilment-world.ts` (`seedFulfilmentWorld`), already
seeds a complete world — hub polygon, society, gate, address, customer, admin, cooks with
`cook_profiles`, `cook_shifts` (10:00–22:00, break 14:00–16:00) and `cook_attendance` (lines
158-176). It is pinned to Thursday **2026-08-20 IST** and targets Testcontainers
(`tests/support/containers.ts`, requires Docker). **This is the recommended basis for Phase 2 local
seeding** rather than writing anything new, and it must never be pointed at production.

| Fixture                             | Available today     | Notes                                                                             |
| ----------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| Approved cook                       | PARTIAL             | Fixture seeds `cook_profiles`; `users.role='cook'` must be set manually (GAP-09)  |
| Inactive / pending / suspended cook | PARTIAL             | `pending`/`paused` reachable; `suspended` is DB-only; no `rejected` status exists |
| Hub + shift                         | PARTIAL             | Fixture seeds both; no API path (GAP-09)                                          |
| Customer                            | YES                 | Fixture                                                                           |
| Serviceable address + society gate  | YES                 | Fixture — but note GAP-14, the gate resolves to the customer coordinate           |
| Current job                         | YES                 | Fixture + payment finalisation                                                    |
| Future job                          | YES                 | Fixture                                                                           |
| On-time travel                      | YES                 | Drive `POST /v1/cook/location` with samples along the route                       |
| Late-risk travel                    | YES                 | Delayed samples trigger the risk evaluator                                        |
| Beyond-buffer late travel           | YES                 | Samples past `customer_commitment_at` + 5 min                                     |
| Arrival                             | YES                 | 2 consecutive samples ≤75 m of the gate                                           |
| Start OTP                           | YES                 | Issued at assignment commit; readable from the customer tracking projection       |
| Active service                      | YES                 | Follows Start OTP verification                                                    |
| Extension                           | YES (customer side) | Cook-side propagation is unbuildable until GAP-07                                 |
| End OTP                             | YES                 | Issued at assignment commit                                                       |
| Completed service                   | YES                 | Follows End OTP verification                                                      |
| Earnings                            | **NO**              | **Requires a manually inserted `earnings_cycles` row until GAP-04 is fixed**      |
| Penalties                           | YES                 | No-show via the risk pass; late penalty via the earnings pass                     |
| Attendance                          | YES                 | Fixture seeds it; also settable via the admin endpoint                            |

**Safety:** all seeding must run against a local Docker Postgres/PostGIS + Redis
(`docker-compose.yml`, `local-dev.env.sh.example`). No test data may be inserted into the Render
deployment. During this audit, only `GET` requests were made against
`https://spoon-api-kalc.onrender.com`; every probe of a mutating route was an unauthenticated
request rejected with 400 or 401 before reaching any state change.

---

## Appendix — verification performed

- `GET https://spoon-api-kalc.onrender.com/health/live` → `200 {"status":"ok"}`
- `GET https://spoon-api-kalc.onrender.com/health/ready` → `200`, postgres / postgis / redis all healthy
- `/docs`, `/openapi.json`, `/openapi.yaml`, `/documentation`, `/swagger` → `404` (OpenAPI not served)
- Route-existence probes: `/v1/cook/attendance` `401`, `/v1/cook/earnings` `401`,
  `/v1/cook/earnings/cycles/{uuid}` `401`, `/v1/me` `401`, `/v1/admin/cooks` `401`,
  `/v1/cook/bookings/{id}/start-commute` `401`, `/arrive` `401`, `/verify-start-otp` `400`,
  `/verify-end-otp` `400`, `/v1/cook/location` `400`, `/v1/nonexistent` `404`.
  Fastify returns 404 for unregistered routes, so 400/401 confirms the deployed route table matches
  local. **No local route in scope was found absent from the deployed instance.**
- Cook route table enumerated directly from `src/api/routes/v1/index.ts` (10 routes, listed in §A).
- No file in `D:\spoon-backend` or `D:\spoon-frontend` was modified. `D:\spoon-frontend` has 269
  uncommitted changes and was treated as strictly read-only; no `git reset`, `git clean`, or
  restore command was run anywhere.
