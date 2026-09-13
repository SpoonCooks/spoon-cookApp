# Cook App field-level wiring matrix

Every dynamic value the Cook App shows, where it comes from, and what remains.

Audited `D:\spoon-backend-action-hotfix` (`hotfix/deployed-customer-actions` @ `90d0853`) against
`D:\spoonCook-frontend` (`v13-pixel-perfect` @ `d76f41e`).

## How to read this

**19 routes, 47 states.** The 47 are not screens — they are states of the same routes under
different backend conditions. Each row below is a VALUE; the state column names which frame
exercises it.

Column six is the honest one. `—` means the value is server-derived with nothing local about it.
Anything else names what stands between the backend and the pixel.

## 0. Endpoint coverage — corrected

An earlier pass claimed "17 of 19". Both numbers were wrong, which is why the count was worth
re-deriving rather than trusting:

- `/bookings/{bookingId}/cook-contact` is **not** a Cook App contract. It is tagged `Bookings` and
  is how a CUSTOMER reaches their cook. Counting it inflated the denominator.
- Counting paths rather than operations hid that `/cook/leaves` is two operations and that
  `/cook/availability` is a `PUT`.

Enumerated by operation from the spec and matched against every `request(...)` call in
`src/core/api/cook.ts`:

|                                  |        |
| -------------------------------- | -----: |
| Cook-facing operations published | **20** |
| Called by the app                | **19** |
| Not called                       |  **1** |

The one: **`PUT /cook/availability`** (`updateCookAvailability`) — sets `available | break | off`
with an idempotency key. The app READS availability today (`/cook/me` carries
`today.availability.{state, changedAt}`) and has no way to change it.

It is **not blocked technically**. It is blocked on design: no V14 frame offers an availability
control. Hazri's only action is `markPresent`, and `575:2136` `ShiftEndedView` is a display state
selected from `serverTime` against the shift end, not a button. Wiring it means inventing a
control, which is a redesign, so it is recorded rather than invented.

## 1. Profile and identity

| Visible field      | Route / state       | Frontend source                             | Backend source      | Endpoint       | Local?     | Missing projection | Action |
| ------------------ | ------------------- | ------------------------------------------- | ------------------- | -------------- | ---------- | ------------------ | ------ |
| Cook name          | Hazri `575:2135-38` | `profile.data.cook.name`                    | `cooks.name`        | `GET /cook/me` | —          | —                  | done   |
| Rating average     | Niyam `597:1221`    | `cook.rating.average`                       | rating projection   | `GET /cook/me` | —          | —                  | done   |
| Shift window       | Hazri, all four     | `today.shift.{startLocalTime,endLocalTime}` | `cook_shifts`       | `GET /cook/me` | formatting | —                  | done   |
| Availability state | not surfaced        | read, unused                                | `cook_availability` | `GET /cook/me` | —          | —                  | see §0 |

## 2. Attendance (Hazri)

| Visible field                | Route / state       | Frontend source                           | Backend source     | Endpoint                        | Local?                                                                | Missing | Action |
| ---------------------------- | ------------------- | ----------------------------------------- | ------------------ | ------------------------------- | --------------------------------------------------------------------- | ------- | ------ |
| Which of four states renders | `575:2135/36/37/38` | `today.attendance.status` + `today.shift` | `cook_attendance`  | `GET /cook/me`                  | `isShiftFinished(serverTime, shift.endLocalTime)` — two SERVER values | —       | done   |
| `Mark by` time               | `575:2135`          | `today.checkInOpensAt`                    | shift open instant | `GET /cook/me`                  | rendered only when non-null                                           | —       | done   |
| Whether `Present` is live    | `575:2135`          | `today.canCheckIn`                        | server eligibility | `GET /cook/me`                  | —                                                                     | —       | done   |
| Why it is not live           | `575:2135`          | `today.reason` (closed enum)              | same               | `GET /cook/me`                  | —                                                                     | —       | done   |
| Marking present              | `575:2137`          | `useMarkPresent`, idempotency-keyed       | attendance command | `POST /cook/attendance/present` | no optimistic success — flips on refetch                              | —       | done   |
| Month grid and totals        | Hazri month         | `monthlyAttendance.*`                     | `cook_attendance`  | `GET /cook/attendance/month`    | —                                                                     | —       | done   |

## 3. Jobs (Kaam)

| Visible field             | Route / state               | Frontend source             | Backend source              | Endpoint         | Local?                                                        | Missing                               | Action      |
| ------------------------- | --------------------------- | --------------------------- | --------------------------- | ---------------- | ------------------------------------------------------------- | ------------------------------------- | ----------- |
| Job list and order        | `583:375/401/427/453/479`   | `jobs[]`, server order      | `booking_assignments`       | `GET /cook/jobs` | grouping by IST date only                                     | —                                     | done        |
| Start time                | every card                  | `scheduledStartIso`         | `bookings.service_start`    | `GET /cook/jobs` | formatting                                                    | —                                     | done        |
| Duration chip             | every card                  | `serviceDurationMinutes`    | `bookings.duration_minutes` | `GET /cook/jobs` | formatting; sub-hour renders minutes                          | —                                     | done        |
| `Building/ Society`       | every card                  | `address.societyOrBuilding` | address snapshot            | `GET /cook/jobs` | —                                                             | —                                     | done        |
| Countdown `25 mins`       | lead card                   | `minutesToDeadline`         | server deadline             | `GET /cook/jobs` | **sign preserved, never clamped**                             | —                                     | done        |
| Whether `CHALO` is live   | lead card                   | `isActionable`              | server ruling               | `GET /cook/jobs` | —                                                             | —                                     | done        |
| `RUNNING LATE` badge      | lead card                   | `isRunningLate`             | server                      | `GET /cook/jobs` | —                                                             | —                                     | done        |
| **Urgency tier / colour** | `583:427` vs `453` vs `479` | `defaultJobUrgency='soon'`  | —                           | —                | **presentation input; production is always the calmest tier** | **no urgency ruling on `/cook/jobs`** | **blocked** |
| Break card                | `583:401+`                  | `breakWindow`               | `cook_shifts`               | `GET /cook/me`   | —                                                             | —                                     | done        |

The `<45 mins` / `<10 mins` / `<5 mins` frames draw 25, 20 and 15. Twenty is not under ten — the
contradiction is the design's, and is why no threshold was invented client-side.

## 4. Service flow

| Visible field                      | Route / state                 | Frontend source                                                   | Backend source                            | Endpoint                 | Local?                                          | Missing         | Action    |
| ---------------------------------- | ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------- | ------------------------ | ----------------------------------------------- | --------------- | --------- |
| Which of 13 states renders         | `service/[bookingId]`         | `status`+`assignmentStatus`+`riskState`+`otpEligibility`+`timing` | assignment state machine                  | `GET /cook/jobs/current` | selection only, no advancement                  | —               | done      |
| Travel status                      | `614:453`,`622:530`,`622:597` | `riskState` (closed enum)                                         | `booking_risk_events`                     | `GET /cook/jobs/current` | —                                               | —               | done      |
| ETA                                | travel states                 | `timing.eta` + `eta_confidence`                                   | route model                               | `GET /cook/jobs/current` | —                                               | —               | done      |
| Arrival instant                    | `622:664/733`                 | `timing.arrivedAt`                                                | `cook_arrived`                            | `GET /cook/jobs/current` | —                                               | —               | done      |
| Arrival gate                       | arrival states                | server 75 m commit                                                | `TRACKING_GATE_ARRIVAL_RADIUS_METERS: 75` | `POST .../arrive`        | app and backend agree at 75 m                   | —               | done      |
| OTP eligibility                    | `622:801`, `628:1249`         | `otpEligibility.{start,end}`                                      | server                                    | `GET /cook/jobs/current` | —                                               | —               | done      |
| Service timer                      | `622:1036/1085/1125`          | `timing.{remainingSeconds,elapsedSeconds,overrunSeconds}`         | server session timing                     | `GET /cook/jobs/current` | **no client clock reaches any displayed value** | —               | done      |
| Extension minutes / new end        | `622:1163`                    | `extension.{minutes,expectedEnd}`                                 | `booking_extensions`                      | `GET /cook/jobs/current` | —                                               | —               | done      |
| **Extension banner window origin** | `622:1163`                    | `extension.confirmedAt`                                           | `booking_extensions.settled_at`           | `GET /cook/jobs/current` | —                                               | **was missing** | **fixed** |
| Cancelled banner                   | `622:913`                     | `assignmentStatus='cancelled'`                                    | server                                    | `GET /cook/jobs/current` | —                                               | —               | done      |

## 5. Leave (Chutti)

| Visible field       | Route / state       | Frontend source             | Backend source | Endpoint            | Local?                                   | Missing | Action |
| ------------------- | ------------------- | --------------------------- | -------------- | ------------------- | ---------------------------------------- | ------- | ------ |
| Selectable days     | `592:488/489`       | `leaves[]` + shift calendar | `cook_leaves`  | `GET /cook/leaves`  | day labels from `serverTime`, not device | —       | done   |
| Leave state per day | `592:488`           | `leave.status`              | `cook_leaves`  | `GET /cook/leaves`  | —                                        | —       | done   |
| Requesting leave    | `592:888`,`592:832` | `requestLeave` mutation     | leave command  | `POST /cook/leaves` | no optimistic booked state               | —       | done   |
| Long-leave range    | `592:563/639`       | calendar over `leaves[]`    | `cook_leaves`  | `GET /cook/leaves`  | —                                        | —       | done   |

## 6. Earnings and cycles (Kamai)

| Visible field            | Route / state         | Frontend source                                                            | Backend source           | Endpoint                           | Local?        | Missing                        | Action                    |
| ------------------------ | --------------------- | -------------------------------------------------------------------------- | ------------------------ | ---------------------------------- | ------------- | ------------------------------ | ------------------------- |
| Cycle total              | `575:1744/1884/2013`  | `currentCycle.totalPaise`                                                  | financial ledger         | `GET /cook/earnings`               | integer paise | —                              | done                      |
| Base / Bonus / Tip       | money frames          | `breakdown.*Paise`                                                         | ledger aggregate         | `GET /cook/earnings`               | —             | —                              | done                      |
| `FINAL KAMAI`            | `575:2013`            | `netEarningsPaise`                                                         | reversal-safe agg.       | `GET /cook/earnings`               | —             | —                              | done                      |
| No-show / late totals    | `575:2013`            | `noShowDeductionsPaise`, `lateDeductionsPaise`                             | ledger                   | `GET /cook/earnings`               | —             | —                              | done                      |
| **Late tile in MINUTES** | `575:1884/2098`       | falls back to the event COUNT                                              | —                        | —                                  | —             | **no late duration published** | **blocked**               |
| Bonus bar progress       | money frames          | `bonus.{currentProgressDays,thresholdDays,bonusAmountPaise,policyVersion}` | earnings policy + ledger | `GET /cook/earnings`               | —             | —                              | **already policy-driven** |
| Cycle list / detail      | `575:2032`,`575:2098` | `cycles[]`, `cycleDetail.*`                                                | `earnings_cycles`        | `GET /cook/earnings/cycles(/{id})` | —             | —                              | done                      |
| Day history              | `575:1903/1922`       | `daily[]`                                                                  | ledger by day            | `GET /cook/earnings`               | —             | —                              | done                      |
| `5+` / `Ghante` counts   | `575:2013`            | renders `—`                                                                | —                        | —                                  | —             | **not exposed**                | **blocked**               |

## 7. The five Niyam sheets — rebuilt

Every figure below WAS a literal in `rules.ts` and is now derived from
`GET /cook/policies/earnings`. Geometry untouched.

| Visible field              | Route / state | Frontend source                                 | Backend source                | Endpoint                      | Local? | Missing                                                         | Action      |
| -------------------------- | ------------- | ----------------------------------------------- | ----------------------------- | ----------------------------- | ------ | --------------------------------------------------------------- | ----------- |
| No-show rows               | `603:1865`    | `noShowPenaltyPaise`, flat per occurrence       | `earnings` policy             | `GET /cook/policies/earnings` | —      | —                                                               | **fixed**   |
| No-show footnote           | `603:1865`    | same                                            | same                          | same                          | —      | —                                                               | **fixed**   |
| Late rows                  | `605:2094`    | `max(m-grace,0) x perMinute`                    | `calculateLatePenaltyMinutes` | same                          | —      | —                                                               | **fixed**   |
| Late footnote              | `605:2094`    | `lateGraceMinutes`, `latePenaltyPerMinutePaise` | same                          | same                          | —      | —                                                               | **fixed**   |
| Extra-hours rows           | `603:1924`    | `floor(max(m-threshold,0) x rate / 60)`         | `calculateLongHoursBonus`     | same                          | —      | —                                                               | **fixed**   |
| Extra-hours title / blurb  | `603:1924`    | `longHoursThresholdMinutes / 60`                | same                          | same                          | —      | —                                                               | **fixed**   |
| Extra-hours `Mahina`       | `603:1924`    | day figure x `cycleLengthDays`                  | policy                        | same                          | —      | —                                                               | done        |
| 5+ rows                    | `605:2027`    | count x `fivePlusBonusPaise`                    | policy                        | same                          | —      | —                                                               | done        |
| **Rating day/month rates** | `597:1221`    | renders `—`                                     | —                             | —                             | —      | **no rating-tiered rate exists; `presentDayBasePaise` is flat** | **blocked** |
| Four cycle standings       | all four      | `—`                                             | —                             | —                             | —      | **not exposed**                                                 | **blocked** |

## 8. Invariants — verified, not asserted

| Invariant                                | How checked                                                                                                                  | Result   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| No local flow advancement                | every state selector reads a server field                                                                                    | held     |
| No locally invented urgency tier         | `defaultJobUrgency` is the constant `'soon'`; no derivation from `minutesToDeadline` exists                                  | held     |
| No client-authored official timer        | grepped every `Date.now()`/`new Date()` in `src/` — three hits: idempotency key, device id, location cadence. None displayed | held     |
| No clamped negative countdown            | `formatMinutes` preserves the sign; `-2 mins` renders                                                                        | held     |
| No optimistic success                    | attendance, leave and service commands flip on refetch, never on dispatch                                                    | held     |
| No fixture fallback in production        | `areFixturesAvailable()` false for `production`, fails CLOSED on malformed config; `devOnly()` shares the gate               | held     |
| No hardcoded financial or penalty policy | `rules.ts` carries no rupee literal; `policyRules.test.ts` asserts none can return                                           | **held** |

## 9. What is left, and what each needs

| Item                      | Kind         | Needs                                                                  |
| ------------------------- | ------------ | ---------------------------------------------------------------------- |
| Rating-tiered day rates   | policy gap   | a decision: add bands to the `earnings` policy, or change the sheet    |
| Job urgency tier          | contract gap | a server ruling, plus a designer resolving `<10 mins` drawing 20       |
| Late duration on earnings | contract gap | a `lateMinutes` projection on `/cook/earnings`                         |
| Four cycle standings      | contract gap | no-show count, late minutes, extra hours, 5+ count on `/cook/earnings` |
| `PUT /cook/availability`  | design gap   | a control on a frame; the endpoint is ready                            |
