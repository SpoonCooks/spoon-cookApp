> **SUPERSEDED — 2026-08-23.**
>
> This report describes Figma **V11** (`N44dO2hqLQBw5I5TKh0wmu` / `FLrHofaiOZtMn3F84yHEZa`, canvas
> `434:2401`) and the backend as it stood before `a3bb590` was deployed. Both have since moved:
>
> - V11's `Performance & earnings` section (`540:397`) and all seven of its frames were **deleted**
>   from the design file and replaced by a new `performance` section (`575:1741`).
> - The Cook API — `/cook/me`, jobs, attendance month, `POST /cook/leaves`, earnings cycles — is now
>   **live on `spoon-api-kalc.onrender.com`**, so the GAP-21 leave gate and the GAP-25 earnings
>   limitation recorded below no longer apply.
>
> Read **`COOK_APP_FIGMA_V12_BACKEND_AND_VISUAL_CLOSURE.md`** instead. Kept for history only.

# Cook App — Figma Section Implementation and Backend Integration Report

**Date:** 2026-08-21
**Cook App repository:** `D:\spoonCook-frontend`
**Backend audited:** `D:\spoon-backend` @ `a13ce96` (branch `feature/phase10-gate-arrival`)
**Figma:** `FLrHofaiOZtMn3F84yHEZa` — `V0_ user app (11)`, canvas `434:2401` ("Cook App")

---

## 1. Repository baseline

`D:\spoonCook-frontend` **is not a git repository** — there is no `.git` directory, and every
command in the brief's §3 (`git status`, `git diff --stat`, `git rev-parse HEAD`, `git log`) fails
with `fatal: not a git repository`. There is therefore **no baseline commit and no branch**, and no
uncommitted-change set to reconcile. The baseline is the working tree as found.

No destructive command was run anywhere. `D:\spoon-frontend` (User App) and `D:\spoon-backend` were
opened **read-only** and were not modified.

Baseline as found, independently re-verified rather than taken on trust:

| Claim                                          | Verified                  |
| ---------------------------------------------- | ------------------------- |
| Expo 57 / RN 0.86.2 / React 19.2.3 / TS ~6.0.3 | yes, `package.json`       |
| 38 source files                                | yes (now 53)              |
| 12 routes                                      | yes (now 14)              |
| Five Livvic weights                            | yes, `assets/fonts/`      |
| `npx tsc --noEmit` clean                       | yes                       |
| 83/83 Jest tests                               | yes — 83 passed, 6 suites |
| `expo export` succeeds                         | yes                       |

**The single largest gap found:** the app had **no API layer at all**. No `src/core/api`, no
`src/core/config` (despite `app.config.ts` documenting one), no token storage, no HTTP client.
Every screen rendered a development fixture. `@tanstack/react-query`, `zod`, `zustand` and
`expo-secure-store` were dependencies but unused for networking.

---

## 2. Figma access — how it was finally obtained

Three routes were tested; the first two are still closed.

| Route                        | Test                                                                | Result                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Remote MCP (`mcp.figma.com`) | `get_metadata`, `get_screenshot`, `get_design_context` @ `434:2401` | **FAIL** — "you don't have edit access to this file"                                                                                                                           |
| `mcp__figma__whoami`         | seat check                                                          | `lakshayd.intern@spoonhelp.com`, **View seat, `starter` tier**                                                                                                                 |
| Chrome (Claude in Chrome)    | navigate to the design URL, in all 3 connected browsers             | **FAIL** — "This site is blocked by your site permissions". `example.com` is blocked too, so the extension's site-permission list is empty rather than Figma being singled out |
| REST API                     | token discovery                                                     | no `figd_` PAT stored anywhere                                                                                                                                                 |
| **Figma desktop local MCP**  | `127.0.0.1:3845/mcp`                                                | **SUCCESS**                                                                                                                                                                    |

**The desktop app's Dev Mode MCP server was the unblock.** Figma desktop was already running with
the server listening on `127.0.0.1:3845` (PID 4084). It serves the file open in the desktop app and
does **not** perform the remote server's Edit-seat check. The canvas was read over plain JSON-RPC:
`initialize` → `notifications/initialized` → `tools/call get_metadata`.

The full 308,852-character node dump is archived at `docs/.figma-canvas-434-2401.xml` so this
inventory is auditable without re-reading Figma.

Remote MCP still requires a **Dev or Full seat** for `lakshayd.intern@spoonhelp.com`. That is worth
fixing so CI and other machines are not dependent on a desktop app being open.

---

## 3. Approved section inventory — read from the node tree

Canvas `434:2401` contains **four `SECTION` nodes** and **five loose top-level frames**.

| Section                    | Node ID    | Size        | Screens |
| -------------------------- | ---------- | ----------- | ------- |
| Login flow                 | `434:3115` | 2403 × 1076 | 5       |
| Service flow               | `485:4971` | 2182 × 6929 | 12      |
| **Performance & earnings** | `540:397`  | 3425 × 1880 | 7       |
| Attendance                 | `540:416`  | 1593 × 4817 | 8       |
|                            |            | **Total**   | **32**  |

Two corrections to the brief's assumptions:

- The third section is named **"Performance & earnings"**, not "Performance & My Money".
- The Attendance section holds **8** screens, not the 2 previously recorded — it now contains a
  complete **cook-initiated leave-request flow**.

### 3.1 Frames OUTSIDE every section (excluded from the 32)

| Node       | Name             | Disposition                                           |
| ---------- | ---------------- | ----------------------------------------------------- |
| `434:3086` | Page 3- job list | **Implemented anyway** — documented deviation, see §5 |
| `494:5648` | Page 3a- start   | **Implemented anyway** — same screen as above         |
| `494:5627` | jobs             | Component sample — no route                           |
| `434:2741` | div.rounded-3xl  | `JobCard` sample — no route                           |
| `434:2743` | div.bg-red-600   | `RUNNING LATE` badge sample — no route                |

### 3.2 Frame deleted since the previous import

`505:1596` ("Attendance & Leaves" — the monthly calendar with `22 Present / 2 Leaves /
98% On-Time`) **no longer exists in this file**; `grep` over the full node dump returns zero hits.
The Attendance tab was rebuilt to the new design accordingly. The `AttendanceCalendar` component
was **kept** (§11 of the brief: do not delete a reusable component because its example frame moved)
but currently has no screen: the leave date-range picker renders its own Monday-first grid because
it needs multi-day range selection, which `AttendanceCalendar` does not support. Consolidating the
two grids is worthwhile follow-up work, not a blocker.

---

## 4. Screen inventory and disposition

Full machine-readable inventory: `src/core/figma/scope.ts`, asserted by
`src/__tests__/figmaScope.test.ts`.

### Login flow — `434:3115` (5)

| Screen               | Node       | Implementation                    | Action               |
| -------------------- | ---------- | --------------------------------- | -------------------- |
| Page 0- loading page | `434:3330` | `src/app/index.tsx`               | connected to backend |
| Page 1- Login No.    | `434:3280` | `src/app/login.tsx`               | connected to backend |
| Page 2a- Login OTP   | `434:3224` | `src/app/otp.tsx` countdown state | connected to backend |
| Page 2b- OTP resend  | `434:3174` | `src/app/otp.tsx` resend state    | connected to backend |
| Page 2c- OTP wrong   | `434:3116` | `src/app/otp.tsx` error state     | connected to backend |

### Service flow — `485:4971` (12)

| Screen                         | Node       | Implementation            | Action               |
| ------------------------------ | ---------- | ------------------------- | -------------------- |
| Page 4a- travel on time        | `462:3617` | `TravelView` `on_time`    | preserved            |
| Page 4b- travel 5 mins buffer  | `463:3779` | `TravelView` `at_risk`    | preserved            |
| Page 4b- travel 5 mins buffer  | `464:3864` | `TravelView` `late`       | preserved            |
| Page 5a- arrival on time       | `468:3935` | `ArrivalView` `on_time`   | preserved            |
| Page 5b- arrival late          | `468:4040` | `ArrivalView` `late`      | preserved            |
| Page 6a- Start OTP on time     | `482:4587` | `StartOtpView` `on_time`  | **OTP length 4 → 3** |
| Page 6b- Start OTP on time     | `482:4656` | `StartOtpView` `late`     | **OTP length 4 → 3** |
| Page 7a- Cooking               | `483:4741` | `CookingView` normal      | preserved            |
| Page 7b- Cooking (last 7 mins) | `483:4795` | `CookingView` ending-soon | preserved            |
| Page 7c- Cooking extended      | `483:4835` | `CookingView` extended    | preserved            |
| Page 9- end OTP                | `484:4875` | `EndOtpView`              | **OTP length 4 → 3** |
| Page 10- job end               | `485:4917` | `CompletedView`           | preserved            |

**Both `Page 4b` variants survive.** They share a Figma _name_ and are distinguished only by the
server's `riskState`. `figmaScope.test.ts` asserts there are exactly two, and
`serviceViews.test.tsx` asserts they cannot share copy.

**`Page 6b` is the LATE variant** despite being named "on time" — its copy is
`Customer ko LATE ke liye SORRY bole` (node `478:4302`). The prior relabelling was correct.

### Performance & earnings — `540:397` (7)

| Screen                | Node       | Implementation              | Action               |
| --------------------- | ---------- | --------------------------- | -------------------- |
| Page 3- money daily   | `485:5062` | `money.tsx` period=day      | connected to backend |
| Page 4 - money 7 days | `492:5336` | `money.tsx` period=cycle    | connected to backend |
| Page 5- past daily    | `537:700`  | `money/cycle/[cycleId].tsx` | **newly in scope**   |
| Page 6- day history   | `537:484`  | `money/cycles.tsx`          | **newly in scope**   |
| Page 7- money monthly | `502:192`  | `money.tsx` period=month    | connected to backend |
| Page 8- cycle history | `502:442`  | `money/cycles.tsx`          | connected to backend |
| Page 9- past cycle    | `504:934`  | `money/cycle/[cycleId].tsx` | connected to backend |

### Attendance — `540:416` (8) — complete flow

| Screen                 | Node       | Implementation                  | Action                          |
| ---------------------- | ---------- | ------------------------------- | ------------------------------- |
| Page 11- attendance    | `506:1986` | `attendance.tsx` status=null    | **rebuilt + connected**         |
| Page 12a- present      | `526:292`  | `attendance.tsx` status=present | **implemented + connected**     |
| Page 12b- absent       | `525:132`  | `attendance.tsx` status=absent  | **implemented + connected**     |
| Page 13a- long         | `528:659`  | `leave/range.tsx` empty         | **implemented, submit blocked** |
| Page 13b- long select  | `530:1349` | `leave/range.tsx` selected      | **implemented, submit blocked** |
| Page 13c- long confirm | `530:1478` | `attendance.tsx` upcoming-leave | **implemented, submit blocked** |
| Page 14a- 1day         | `528:483`  | `leave/single.tsx` confirm      | **implemented, submit blocked** |
| Page 14b- 1day confirm | `529:1259` | `leave/single.tsx` applied      | **implemented, submit blocked** |

Copy transcribed from the node tree: `aaj aap kaam pai aaye hai?` / `Mark Present` /
`Shift se 30 mins pehle tak button dabaye` / `Aaj ke liye PRESENT!` / `Aaj ke liye ABSENT!` /
`aaj ka break` + `Duration: 2 hrs` + `12:15 PM TO 2:15 PM` / `Chutti lagaye` /
`Aap jitne din aaye, utne din ke paise milenge` / `1 din ki chutti` / `lambi chutti` /
`Dates chunein` / `Dates badle` / `Chutti pakka hai?` / `Pakka` / `Total din` /
`Chutti lag gyi` / `Aane wali chutti` / `16 Nov se 25 Nov tak`.

---

## 5. Documented deviation from strict section scope

`Page 3- job list` (`434:3086`) and `Page 3a- start` (`494:5648`) sit at canvas top level, outside
every section, so a literal reading of §1 excludes them.

**They are implemented anyway.** They are the Jobs tab — the only entry point from which the
in-section Service flow is reachable. Removing them would orphan all twelve Service-flow screens
and leave the app with no landing surface after login. The deviation is recorded in
`outOfSectionFrames` in `src/core/figma/scope.ts` and asserted by test, so it is a decision on the
record rather than an oversight.

The other three loose frames are component samples and correctly have **no route**.

---

## 6. Backend contract audit

The backend has moved substantially since `COOK_APP_PHASE_1_BACKEND_READINESS_AND_GAP_REPORT.md`
was written. Routes verified as **registered in `src/api/routes/v1/index.ts`**, not merely present
in `openapi.yaml`.

**Important caveat:** `openapi.yaml` declares `$ref: '#/components/responses/Ok'` — a generic
envelope — for **every** Cook route. It therefore documents no response body at all. All response
schemas in `src/core/api/schemas.ts` were transcribed from backend **source**.

| Figma screen / state    | Required data or action          | Endpoint                                        | Status                         | Frontend                 |
| ----------------------- | -------------------------------- | ----------------------------------------------- | ------------------------------ | ------------------------ |
| Page 1 login            | request login OTP                | `POST /v1/auth/otp/send` (`audience:'cook'`)    | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 2a/b/c OTP         | verify, open session             | `POST /v1/auth/otp/verify`                      | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 0 loading          | restore session                  | `POST /v1/auth/refresh` + `GET /v1/cook/me`     | `AVAILABLE_AND_VERIFIED`       | connected                |
| all                     | logout                           | `POST /v1/auth/logout`                          | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 3 job list         | jobs today/tomorrow              | `GET /v1/cook/jobs`                             | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 3a start           | actionable card                  | `GET /v1/cook/jobs` + `reassignment.current`    | `AVAILABLE_AND_VERIFIED`       | connected                |
| restart recovery        | active assignment                | `GET /v1/cook/jobs/current`                     | `AVAILABLE_AND_VERIFIED`       | connected                |
| service screens         | one booking                      | `GET /v1/cook/jobs/{bookingId}`                 | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 3a `Start`         | begin travel                     | `POST /v1/cook/bookings/{id}/start-commute`     | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 4a/4b              | travel ruling                    | `timing.riskState` on the job projection        | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 4a/4b              | GPS + arrival                    | `POST /v1/cook/location`                        | `AVAILABLE_AND_VERIFIED`       | **typed, not yet wired** |
| Page 5a/5b              | fallback arrival                 | `POST /v1/cook/bookings/{id}/arrive`            | `AVAILABLE_AND_VERIFIED`       | typed, not yet wired     |
| Page 6a/6b              | Start OTP                        | `POST /v1/cook/bookings/{id}/verify-start-otp`  | `AVAILABLE_AND_VERIFIED`       | typed, not yet wired     |
| Page 9                  | End OTP                          | `POST /v1/cook/bookings/{id}/verify-end-otp`    | `AVAILABLE_AND_VERIFIED`       | typed, not yet wired     |
| Page 7a/b/c             | timer + extension                | `timer`, `extension` on the projection          | `AVAILABLE_AND_VERIFIED`       | typed, not yet wired     |
| alerts                  | acknowledge                      | `POST /v1/cook/bookings/{id}/acknowledge-alert` | `AVAILABLE_AND_VERIFIED`       | typed, not yet wired     |
| Page 11 `Mark Present`  | check-in                         | `POST /v1/cook/attendance/present`              | `AVAILABLE_AND_VERIFIED`       | **connected**            |
| Page 12a/12b            | today's status                   | `GET /v1/cook/me` → `today.attendance`          | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 12a break card     | break window                     | `GET /v1/cook/me` → `today.shift`               | `AVAILABLE_AND_VERIFIED`       | connected                |
| attendance tiles        | month totals, on-time %          | `GET /v1/cook/attendance/month`                 | `AVAILABLE_AND_VERIFIED`       | connected                |
| `Aane wali chutti`      | approved leaves                  | `GET /v1/cook/leaves`                           | `AVAILABLE_AND_VERIFIED`       | typed, adapter ready     |
| Page 3/4/7 money        | period totals                    | `GET /v1/cook/earnings`                         | `AVAILABLE_AND_VERIFIED`       | connected                |
| bonus progress          | threshold + progress             | `earnings.bonus`                                | `AVAILABLE_AND_VERIFIED`       | connected                |
| Page 8 cycle history    | past cycles                      | `GET /v1/cook/earnings/cycles`                  | `AVAILABLE_AND_VERIFIED`       | typed, screen pending    |
| Page 9 past cycle       | one cycle                        | `GET /v1/cook/earnings/cycles/{cycleId}`        | `AVAILABLE_AND_VERIFIED`       | typed, screen pending    |
| push                    | device token                     | `PUT /v1/me/push-token`                         | `AVAILABLE_AND_VERIFIED`       | typed, not yet wired     |
| money breakdown         | base/bonus/tips/deductions/final | —                                               | **`PARTIAL_CONTRACT`**         | see GAP-25               |
| Page 11 `30 mins pehle` | check-in window                  | —                                               | **`PARTIAL_CONTRACT`**         | see GAP-26               |
| Pages 13a–14b           | submit a leave request           | —                                               | **`MISSING_BACKEND_CONTRACT`** | see GAP-21               |
| cook rating `4.9`       | rating                           | `GET /v1/cook/me` → `cook.rating`               | `AVAILABLE_AND_VERIFIED`       | connected                |

### Previously-recorded gaps now RESOLVED by the backend

GAP-01 (no cook job list), GAP-02 (no cook self-profile), GAP-03 (no earnings aggregation),
GAP-06 (role-blind login — now `audience`-scoped), GAP-20 (no cook check-in), GAP-22 (no on-time
percentage), GAP-23 (no monthly attendance calendar), and the four-digit service-OTP conflict.

---

## 7. OTP contract — resolved, and corrected in the app

Both sides now agree on **three digits** for the service OTPs. The app was still on four.

| OTP   | Figma                                       | Backend                                                               | App before | App now |
| ----- | ------------------------------------------- | --------------------------------------------------------------------- | ---------- | ------- |
| Login | 6 boxes (`434:3224`)                        | `LOGIN_OTP_LENGTH` default **6** (`src/config/env.ts:389`)            | 6          | 6       |
| Start | 3 boxes (`482:4656` → `478:4283/4286/4289`) | `SERVICE_OTP_DIGITS = 3`; `pattern '^[0-9]{3}$'` (`v1/index.ts:2272`) | **4**      | **3**   |
| End   | 3 boxes (`484:4875`)                        | same, `v1/index.ts:2314`                                              | **4**      | **3**   |

`hasOtpFigmaConflict()` now returns `false` for all three kinds and is asserted by test, so a future
divergence on either side trips a test rather than reaching a cook who cannot enter their code.
Lengths remain centralised in `src/core/domain/otp.ts`; no screen hardcodes a box count.

---

## 8. What was built

### New modules

| File                         | Purpose                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `src/core/config/index.ts`   | Env/base-URL resolution; throws in production rather than defaulting                         |
| `src/core/api/errors.ts`     | `ApiError`, all 20 backend codes, Hinglish mapping, offline/timeout/cancelled/contract kinds |
| `src/core/api/schemas.ts`    | Zod schemas transcribed from backend source                                                  |
| `src/core/api/client.ts`     | Bearer auth, `{data}`/`{error}` envelopes, **single-flight refresh**, abort/timeout          |
| `src/core/api/cook.ts`       | One typed function per verified route                                                        |
| `src/core/api/adapters.ts`   | Backend projection → domain model                                                            |
| `src/core/api/queries.ts`    | TanStack Query hooks; commands invalidate, never patch                                       |
| `src/core/session/tokens.ts` | SecureStore-backed tokens + stable device id                                                 |
| `src/core/session/auth.ts`   | Login / restore / logout composed with the approved-cook gate                                |
| `src/core/domain/leave.ts`   | Typed leave-request contract for the missing endpoint                                        |
| `src/core/figma/scope.ts`    | The 32-screen approved inventory as data                                                     |
| `src/app/leave/single.tsx`   | Figma 14a/14b                                                                                |
| `src/app/leave/range.tsx`    | Figma 13a/13b                                                                                |

### Screens rewritten and connected

`index.tsx` (real session restore), `login.tsx`, `otp.tsx`, `(tabs)/jobs.tsx`,
`(tabs)/money.tsx`, `(tabs)/attendance.tsx` (rebuilt to the new 3-state design), `_layout.tsx`
(QueryClientProvider).

### Invariants enforced

- **No optimistic state.** Every command invalidates and re-reads; no mutation writes the cache.
- **No fixture fallback.** A failed read renders `ErrorState`. Fixtures throw in release.
- **Idempotency keys are per-intent, not per-attempt** — a double-tap replays rather than
  double-commands. `created: false` is handled as the success it is.
- **Single-flight refresh** — N concurrent 401s spend one refresh token, so the backend's
  reuse-detection cannot revoke the family mid-service.
- **Negative countdowns preserved** — asserted at the adapter and the projection.
- **`UNKNOWN` travel ruling degrades to on-time**, never to late.
- **Unknown booking status → contract failure**, never a guessed screen.
- **`scheduled` never becomes an attendance status.**
- **On-time percentage is server-supplied**; `null` renders `—`, never `0%`.
- **Bonus threshold from `bonus.thresholdDays`** — no hardcoded 5, 7 or 27.
- **No client-side money arithmetic** (see GAP-25).
- **No OTP or token is logged**; contract errors report field paths only.

---

## 9. Gaps

### GAP-21 — no cook-side leave write (**BLOCKER** for 5 approved screens)

Figma `540:416` contains a complete leave-request flow. The backend has **no** cook-side write:
`GET /v1/cook/leaves` reads approved leaves only, and the sole writer is
`POST /v1/admin/cooks/:cookId/leaves` behind an admin principal.

The screens are built; submission is disabled behind `canSubmitLeaveRequest()` (hardcoded `false`,
asserted by test). Navigation into the pickers is **not** blocked — navigation is not a mutation —
so the designed flow is intact and reviewable.

Required endpoint:

```
POST /v1/cook/leaves
Authorization: Bearer <cook>
Idempotency-Key: <required>
Body: { "fromDate": "YYYY-MM-DD", "toDate": "YYYY-MM-DD", "reason": "string?" }
200:  { "data": { "id", "status": "pending|approved", "fromDate", "toDate",
                  "totalDays": int, "submittedAt": iso } }
400   INVALID_REQUEST   — inverted range, past date, or beyond the allowed horizon
403   FORBIDDEN         — cook not active
409   IDEMPOTENCY_CONFLICT / overlapping existing leave
```

Also needs: a `cook_leaves.status` `pending` transition and an admin approve/reject path; a
customer-side projection decision for bookings already assigned on those dates; tests for overlap,
replay, and an inverted range.

### GAP-25 — no categorised earnings breakdown (`PARTIAL_CONTRACT`)

The money frames show base / bonus / tips / no-show / late / `final kamai`. `GET /v1/cook/earnings`
returns only a flat `events[]` ledger plus period totals.

Summing that ledger client-side by `eventType` would be **wrong**, not merely disallowed: a
`reversal` carries its own event type, so a reversed `base_earning` would leave "base" overstated
while the offsetting line landed in a different bucket. The categories are therefore left
unrendered. `totalPaise` (the server's net) and the raw ledger lines are shown instead.

Needs server-computed `{ basePaise, bonusPaise, tipsPaise, noShow{count,amountPaise},
late{count,amountPaise}, totalDeductionsPaise, finalPaise }` per period, reversal-aware.

### GAP-26 — the 30-minute check-in window is not enforced or exposed (`PARTIAL_CONTRACT`)

Figma `540:415` states `Shift se 30 mins pehle tak button dabaye`. `markCookPresent` checks only
that a shift exists for the service date and computes `onTime = localTime <= shift.start_local_time`.
It neither enforces a 30-minute-before window nor returns one. The app renders the copy and lets
the server decide, so no false promise is made — but design and backend do not agree.

### GAP-24 (resolved) / other

Cook rating is now exposed via `GET /v1/cook/me` → `cook.rating` and is connected.

### Founder-policy items still open

`CHALNA START?` wording (#154), tomorrow's-bookings surface (#155), cancellation-after-travel
screens (#152), double nudge (#149), `Extend booking` affordance (#145), address-before-arrival
privacy. None are invented in code.

### Credential blockers

EAS project id, FCM/`google-services.json`, Play Store credentials remain absent by design so a
release build fails loudly rather than shipping under the User App's identity.

---

## 10. Verification results

All commands run in `D:\spoonCook-frontend`.

| Check      | Command                              | Result                                                                       |
| ---------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| TypeScript | `npx tsc --noEmit`                   | **clean** (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) |
| Lint       | `npx eslint . --max-warnings=0`      | **clean**                                                                    |
| Format     | `npx prettier . --check`             | **clean** — "All matched files use Prettier code style!"                     |
| Tests      | `npx jest --runInBand`               | **129 passed / 129, 8 suites** (was 83/83, 6 suites)                         |
| Bundle     | `npx expo export --platform android` | **success** — `entry-f4b92705aa53f894dba6536b8de03c14.hbc` (3.8 MB)          |

### Test files added or changed

- `src/__tests__/figmaScope.test.ts` — **new.** Section ids/names, 32-screen count, per-section
  counts (5/12/7/8), every screen has an implementation, both `Page 4b` variants survive, all eight
  Attendance frames present, out-of-section frames excluded, deleted `505:1596` excluded.
- `src/__tests__/api.test.ts` — **new.** Error mapping and session expiry; travel-ruling mapping
  including `UNKNOWN`; negative countdown preserved at −2; unknown status refused; interruption
  precedence; cooking timer refused without timestamps; job-card actionability; no OTP in the job
  projection; day marks with `scheduled` kept separate; server-supplied on-time %; empty month;
  upcoming-leave filtering; leave submission disabled; inclusive/inverted range counts;
  backend-supplied bonus threshold.
- `domain.test.ts`, `components.test.tsx`, `serviceViews.test.tsx` — updated to the verified
  3-digit service-OTP contract.

---

## 11. Device / viewport verification — NOT ACHIEVED, exact blocker

**No emulator walkthrough was performed, and none is claimed.** A successful Metro bundle is not
visual verification.

The Android toolchain is present and was driven directly: `adb` and emulator `36.4.9.0` under
`C:\Users\Lakshay\AppData\Local\Android\Sdk\`, with three AVDs — `Ref_393`, `Ref393GA`,
`Small_Phone`.

**Exact blocker: the emulator starts but never boots.** Two AVDs were tried:

| AVD                                                   | Flags                                   | Result                                                                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Ref_393` (Android 36, google_apis_playstore, x86_64) | `-no-snapshot-load -no-boot-anim`       | `qemu-system-x86_64` alive ~15 min, **3.0 s total CPU**, 117 MB RSS, `sys.boot_completed` never set, console port 5554/5555 never listened, `adb devices` empty throughout |
| `Small_Phone`                                         | `+ -gpu swiftshader_indirect -no-audio` | identical: alive ~8 min, **2.3 s CPU**, 185 MB RSS, no console port, `adb devices` empty                                                                                   |

`adb kill-server` / `start-server` and `adb connect 127.0.0.1:5555` were tried; the latter returns
`No connection could be made because the target machine actively refused it. (10061)`.

The emulator log stops after three lines — version, `Graphics backend: gfxstream`, and
`Found systemPath ...\system-images\android-36\google_apis_playstore\x86_64\`.

Near-zero CPU accumulation means the guest never begins executing — this is a host virtualization
problem (WHPX/Hyper-V), not an app problem. Confirming it needs
`Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform`, which **requires elevation**
that this session does not have. Switching to software rendering did not help, which is consistent
with a hypervisor rather than a GPU fault.

**To unblock (needs an elevated shell):** verify `HypervisorPlatform` and `VirtualMachinePlatform`
are enabled, confirm virtualization is on in BIOS, and check for a conflicting hypervisor (older
Intel HAXM alongside WHPX). Then `emulator -avd Small_Phone -verbose`.

### Strongest verification actually performed

`src/__tests__/attendanceScreens.test.tsx` (**21 tests**) mounts the real Attendance and leave
screens and asserts the rendered output. This is **render verification, not device verification**,
and is reported as such. It proves:

- Page 11 renders `aaj aap kaam pai aaye hai?` with `Mark Present` and the verbatim
  `Shift se 30 mins pehle tak button dabaye` hint
- pressing `Mark Present` sends the command but leaves the screen in the unmarked state — no local
  marking, no verdict rendered
- Page 12a renders `Aaj ke liye PRESENT!` plus the break card built from the server shift window
  (`Duration: 2 hrs`, `12:15 PM`, `2:15 PM`) and withdraws the button
- Page 12b renders `aaj aap kaam pai NAHI aaye hai.` / `Aaj ke liye ABSENT!`
- no shift today → no check-in button, explicit `Aaj aapki koi shift nahi hai.`
- a failed check-in renders an error and never a success verdict
- month tiles show server totals and `98%`, and `—` rather than `0%` when the server sends null
- a month-read failure does not destroy the check-in surface
- the leave pickers open (navigation is not a mutation) while `Pakka` stays disabled, and pressing
  it never renders `Chutti lag gyi`
- the range picker counts an inclusive 10-day selection as `Total din 10`

**Still outstanding:** small/standard phone viewport sweep, keyboard behaviour on the OTP and login
screens, wrapped-Hinglish overflow checks, and negative-countdown rendering on a real device.

---

## 12. Deployment

**Nothing was deployed.** No push, no merge, no release build, no mutating call against
`https://spoon-api-kalc.onrender.com`. The repository is not under version control, so no commit
was made either.

---

## 13. Environment variables required

| Variable                   | Purpose                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL` | Backend base URL. **Required in production** — `requireApiBaseUrl()` throws without it. Falls back to `https://spoon-api-kalc.onrender.com` outside production. |
| `APP_ENV`                  | `development` \| `staging` \| `production`; drives bundle id suffix and display name.                                                                           |

---

## 14. Exact next actions

**Backend (in priority order)**

1. `POST /v1/cook/leaves` + `pending` status + admin approval — unblocks 5 approved screens (GAP-21).
2. Categorised, reversal-aware earnings breakdown per period (GAP-25).
3. Decide and expose the 30-minute check-in window, or change the Figma copy (GAP-26).
4. Grant `lakshayd.intern@spoonhelp.com` a **Dev/Full seat** so Figma reads do not depend on the
   desktop app being open.

**Frontend (next session)**

1. Wire the service flow end-to-end: `start-commute` → `cook/location` → `arrive` →
   `verify-start-otp` → timer → `verify-end-otp`, driving `src/app/service/[bookingId].tsx` from
   `useCurrentJob`/`useJob` through `toServiceSnapshot` + `projectServiceState`.
2. Connect `money/cycles.tsx` and `money/cycle/[cycleId].tsx` to the cycles endpoints.
3. Register the push token via `PUT /v1/me/push-token` on sign-in.
4. Put `D:\spoonCook-frontend` under git.

**End-to-end test sequence once a cook exists in a non-production environment**

1. Provision + approve a cook with a shift for today; set `LOGIN_OTP_PROVIDER=fake` and
   `LOGIN_OTP_DEV_ECHO=true`.
2. Login → OTP (6 digits) → Jobs.
3. `Mark Present` → assert `created: true`, then tap again → assert `created: false` and that the
   screen still shows a single check-in.
4. Assign a booking → `Start` → travel → GPS samples → arrival → Start OTP (**3 digits**) →
   cooking → End OTP (3 digits) → completion.
5. Kill and relaunch mid-service → assert the screen is reconstructed from
   `GET /v1/cook/jobs/current`.
6. Cancel the booking server-side mid-travel → assert the app returns to Jobs.
7. Airplane mode on each tab → assert `ErrorState`, never fixture data.
