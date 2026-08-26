# Cook App ↔ backend wiring audit

Audited `D:\spoon-backend` at `5da8f0b` against `D:\spoonCook-frontend` at `ec54b03`.

## 0. The framing, first

There are not 47 screens. There are **19 routes**, and 47 **states** of them — the same Kaam list
under a job at `<45 mins` and at `<10 mins`, the same Chutti screen with leave applied and with it
booked, the same Service screen with the timer running, ending and extended. The V14 pixel work
proved each state renders correctly **when given that data**. It said nothing about where the data
comes from, and this audit is about exactly that.

Almost all of it is already wired. Of the 19 cook-facing endpoints the backend publishes, the app
calls 17. The gap is not missing calls — it is a set of **numbers the app states as fact that the
backend does not implement**.

## 1. The headline

The five `Niyam` rule sheets tell a cook how they are paid and penalised. **Four of the five are
wrong**, in both directions — and the fifth is right by coincidence rather than by wiring, because
every one of these tables is a hardcoded literal in `src/features/info/rules.ts`.

| Sheet         | The app tells the cook                                        | The backend actually does                                                                                    | Verdict                                              |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `Rating`      | day rate varies by rating band: ₹1,175 / ₹1,075 / ₹925 / ₹725 | `presentDayBasePaise` = **₹1,000 flat**. No rating tier exists anywhere in the codebase                      | **Premise unimplemented**                            |
| `No Show`     | escalating **−₹300 / −₹400 / −₹500** by occurrence            | `noShowPenaltyPaise` = **−₹250**, one scalar, no occurrence counting                                         | **Overstated, and the escalation is invented**       |
| `Extra hours` | above **7 hrs**; 8→+₹150, 9→+₹300, 10→+₹450                   | above **5 hrs** (`longHoursThresholdMinutes: 300`), prorated per minute: 8→**₹450**, 9→**₹600**, 10→**₹750** | **Understated 3× at 8 hrs; wrong threshold**         |
| `Late`        | 3 min −₹30 · 5 min −₹50 · 10 min −₹100 · 15 min −₹150         | `max(minutes − 5, 0) × ₹10`: 3→**₹0**, 5→**₹0**, 10→**−₹50**, 15→**−₹100**                                   | **Ignores the 5-minute grace; every row overstated** |
| `5+ rating`   | ₹100 per 5-star rating                                        | `fivePlusBonusPaise` = ₹100                                                                                  | matches — but still a literal                        |

Two of these are the kind of error that costs trust in opposite directions: a cook three minutes
late is told they lost ₹30 when they lost nothing, and a cook who worked eight hours is told they
earned ₹150 when they earned ₹450.

### Where the numbers came from

Backend, `src/earnings/earnings-policy.ts`:

```ts
presentDayBasePaise:        100_000,   // ₹1,000 flat, every present day
fivePlusBonusPaise:          10_000,   // ₹100
longHoursRatePerHourPaise:   15_000,   // ₹150/hr
longHoursThresholdMinutes:      300,   // FIVE hours, not seven
noShowPenaltyPaise:          25_000,   // ₹250 flat
latePenaltyPerMinutePaise:    1_000,   // ₹10/min
lateGraceMinutes:                 5,   // the first five minutes are free
```

`src/earnings/financial-service.ts`:

```ts
// late
Math.max(Math.floor((arrival - accountability) / 60_000) - graceMinutes, 0) *
  latePenaltyPerMinutePaise;

// long hours — prorated per MINUTE, not per whole hour
Math.floor(
  (Math.max(totalMinutes - longHoursThresholdMinutes, 0) * longHoursRatePerHourPaise) / 60,
);
```

**GAP-19 is resolved by this.** The V14 closure report left the 5-vs-7-hour threshold open and
noted the design says seven. The deployed backend says **five**, and it is a published policy value,
not a constant someone forgot. The app's `7 hr ke upar kaam` caption and its `7 se zyada ke kaam`
table title are both wrong against the running system.

## 2. Why it is hardcoded, and what that costs

The backend does not merely have these numbers — it has a **versioned, publishable policy system**:
`POLICY_FAMILIES` includes `earnings`, with `/admin/policies/{family}/active`, `/versions`,
`/drafts`, `/validate` and `/publish`.

But every one of those routes sits behind the DEC-011 admin API-key boundary. **There is no
cook-readable policy endpoint.** So the app cannot read what it is meant to display, and the only
thing it can do is carry a snapshot — which is what it does.

The cost is not that today's numbers are stale. It is that **publishing a new policy version cannot
reach the app at all**. An owner raises the no-show penalty, the backend starts charging it, and
every cook's Niyam screen keeps quoting the old figure until someone ships a new APK.

## 3. What IS wired, and correctly

Worth stating plainly, because most of the app is fine:

| Area               | Source                                                                               |
| ------------------ | ------------------------------------------------------------------------------------ |
| Profile, rating    | `GET /cook/me` → `cook.rating.average`                                               |
| Jobs list, current | `GET /cook/jobs`, `/cook/jobs/current`, `/cook/jobs/{id}`                            |
| Attendance         | `GET /cook/attendance`, `/attendance/month`, `POST /present`                         |
| Leave              | `GET /cook/leaves`, `POST /cook/leaves`                                              |
| Earnings, cycles   | `GET /cook/earnings`, `/earnings/cycles`, `/cycles/{id}`                             |
| Service lifecycle  | `start-commute`, `arrive`, `verify-start-otp`, `verify-end-otp`, `acknowledge-alert` |
| Location           | `POST /cook/location`                                                                |
| 75 m arrival gate  | app and `TRACKING_GATE_ARRIVAL_RADIUS_METERS: 75` agree                              |

Two endpoints the backend publishes and the app never calls: `GET /cook/availability` and
`GET /bookings/{bookingId}/cook-contact`.

And the app is already honest where the contract is silent. `src/app/niyam/[rule].tsx` renders `—`
for the four standings the API does not expose rather than dividing a deduction total by a tariff
to invent a count; `defaultJobUrgency` is presentation-only because `/cook/jobs` publishes no
urgency ruling. Those are the right calls and this audit does not disturb them.

## 4. What wiring actually requires

Correcting the literals is a frontend-only change and takes an hour. It fixes today and fixes
nothing about tomorrow — the next `publish` desynchronises the app again, silently.

The real fix is a **cook-readable projection of the active earnings policy**. That is a backend
change, which this session's standing instruction forbids without an explicit decision, so it is
recorded here rather than made:

```
GET /v1/cook/policies/earnings        (bearer auth, cook scope)
  → { version, effectiveFrom,
      presentDayBasePaise, fivePlusBonusPaise,
      longHoursRatePerHourPaise, longHoursThresholdMinutes,
      noShowPenaltyPaise, latePenaltyPerMinutePaise, lateGraceMinutes }
```

Every number in section 1 is then derived, the sheets stop being transcriptions, and a published
policy version reaches cooks without a release. The five sheets become presentation over a
projection, exactly like every other screen in the app.

The alternative — folding the same fields into `GET /cook/me` — avoids a new route at the cost of
putting slow-moving policy on the hot path of every session restore.

## 5. Recommended order

1. **Correct the four literals now**, so the app stops misinforming cooks while the endpoint is
   built. This is frontend-only and independently verifiable.
2. **Add the cook policy endpoint**, and derive the tables from it.
3. **Then** the four missing standings (`no-show count`, `late minutes`, `extra hours worked`,
   `5+ count`), which are a separate contract gap already recorded in the V14 closure report and
   are what turn each sheet's footer from `—` into the cook's own figure.

Step 1 does not depend on step 2 and should not wait for it.
