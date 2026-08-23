# Cook App — V12 pixel-perfect closure

**Status: IN PROGRESS — NOT COMPLETE.** 5 of 32 in-section screens corrected. 0 of 32 compared
against a physical-device render, because the device disconnected mid-session. Nothing in this
document should be read as a pixel-perfect claim for any screen.

- Figma file `DfnWJV2wQxSWfFb1QcBZpG`, canvas `434:2401` ("Cook App"), V12
- Read via the **Figma Desktop Dev Mode MCP server** on `127.0.0.1:3845`
- Date: 2026-08-23

---

## 1. Exact final section inventory

Extracted structurally from a live `get_metadata` read of `434:2401` (4533 lines), not from any
prior audit. A frame counts as a screen only if it is a **direct child of a `SECTION` node** and at
least 360 wide. Visual proximity is not scope.

| Section      | Node       | Size      | Screens | In-section fragments |
| ------------ | ---------- | --------- | ------- | -------------------- |
| Login flow   | `434:3115` | 2403x1076 | 5       | 0                    |
| Service flow | `485:4971` | 2182x6929 | 12      | 0                    |
| Attendance   | `540:416`  | 1593x4817 | 8       | 2                    |
| performance  | `575:1741` | 3302x1544 | 7       | 0                    |

**FINAL SECTIONS: 4 — FINAL IN-SECTION SCREENS: 32**

This confirms `src/core/figma/scope.ts` exactly (5 + 12 + 8 + 7 = 32). The archived
`docs/.figma-canvas-v12-434-2401.xml` was verified byte-identical to the live read; the only
difference is a trailing tool-instruction line the MCP server appends.

Excluded and recorded rather than forgotten: 11 loose canvas-top-level frames (the five Jobs
frames are retained as navigation infrastructure only) and 2 in-section component fragments
(`434:2741` 340x180, `434:2743` 332x29).

## 2. The 390x830 frame is not the viewport

Every V12 frame draws a phone mockup inside itself: a black bezel with a 10pt gutter, a mock
status bar and a mock home indicator. The **application viewport is the inner 370x810 area**, and
every coordinate in this document is stated in that space.

This matters because the target device is 393dp wide. Using raw design numbers on a 393dp screen
would leave the 325-wide CTA with a 34dp margin instead of the design's 20dp — a 14dp displacement
on every horizontal edge. `src/ui/theme/designScale.ts` scales by `screenWidth / 370`; on the
target device that also lands the 810-tall column within ~10dp of the available height.

## 3. Screen matrix

| Section     | Screen                            | Figma node | Initial state   | Assets exact | Layout exact | Typography exact | Device compared | Final status          |
| ----------- | --------------------------------- | ---------- | --------------- | -----------: | -----------: | ---------------: | --------------: | --------------------- |
| Login       | Page 0 loading                    | `434:3330` | MAJOR_REBUILD   |         YES¹ |          YES |              n/a |          **NO** | Corrected, unverified |
| Login       | Page 1 Login No.                  | `434:3280` | MAJOR_REBUILD   |         YES¹ |          YES |              YES |          **NO** | Corrected, unverified |
| Login       | Page 2a OTP                       | `434:3224` | MAJOR_REBUILD   |         YES¹ |          YES |              YES |          **NO** | Corrected, unverified |
| Login       | Page 2b OTP resend                | `434:3174` | MAJOR_REBUILD   |         YES¹ |          YES |              YES |          **NO** | Corrected, unverified |
| Login       | Page 2c OTP wrong                 | `434:3116` | MAJOR_REBUILD   |         YES¹ |          YES |              YES |          **NO** | Corrected, unverified |
| Service     | 12 frames `462:3617` … `485:4917` | —          | NOT YET AUDITED |           NO |           NO |               NO |          **NO** | **Outstanding**       |
| Attendance  | 8 frames `506:1986` … `529:1259`  | —          | NOT YET AUDITED |           NO |           NO |               NO |          **NO** | **Outstanding**       |
| performance | 7 frames `575:1744` … `575:2098`  | —          | NOT YET AUDITED |           NO |           NO |               NO |          **NO** | **Outstanding**       |

¹ Exact Figma artwork, but exported at **1x** — see §6.

## 4. Login: before / after

The reported defect was real and larger than a token discrepancy. Confirmed against `434:3280` and
by pixel-scanning the V12 render (the phone field's top border lands on viewport y=628 and the CTA
on y=687, exactly as the metadata declares).

| Element         | Before                  | V12                                                 | Now               |
| --------------- | ----------------------- | --------------------------------------------------- | ----------------- |
| Hero photograph | **absent**              | `434:3324`, 371x329 full-bleed                      | exported asset    |
| Spoon wordmark  | **absent**              | `434:3284`, 134x93                                  | exported asset    |
| Background      | cream `#fffdf5`         | white `#ffffff`                                     | white             |
| CTA fill        | lime `#cfff04`          | yellow `#ffd600`                                    | yellow            |
| CTA geometry    | minHeight 44, radius 44 | 325x34, fully rounded                               | 325x34, radius 17 |
| Phone field     | **two separate boxes**  | one 325x43 pill, 1px `#ffd600` border               | one pill          |
| Field divider   | —                       | `#ffe666` hairline, 24 tall, at field-local x=78.78 | present           |
| Form column     | symmetric 20            | x=20 w=325 (right margin **25**)                    | asymmetric, exact |

Behaviour is unchanged: validation (10 digits, leading 6-9), disabled-until-valid CTA, numeric
keyboard, `POST /v1/auth/otp/send` with `audience: 'cook'`, navigation only after the backend
accepts, loading, error, safe-area and keyboard handling.

The 34dp CTA is below the 44dp minimum touch target. The painted geometry stays exact and
`hitSlop` restores the target — `Button` gained a typed `hitSlop` prop rather than a per-screen
hack.

## 5. Loading and OTP: before / after

**Page 0 (`434:3330`)** was a flat yellow panel with `Spoon` / `Partner` set in type. V12 is a
full-bleed diagonal gradient (`#ffe34d` → `#e3fa4f`; the left edge samples ~7/255 redder than the
right at the same row) carrying the black Spoon artwork at 370x370. Both are now exported assets.

**Pages 2a/2b/2c** were cream, carried no wordmark, drew 44x52 grey-bordered boxes, and rendered a
**Verify button that appears in none of the three V12 frames**. V12 draws six flat 35x35 `#ffef99`
tiles at a 10dp gap with a 5dp radius, and all three states end at the resend line. Verification
already fires from `onComplete` on the sixth digit, so removing the button cost no behaviour.

## 6. Assets exported

Exported by rendering the individual Figma nodes through the local Dev Mode server, which works
without the allowed-directory permission. Transparency is preserved (all RGBA).

| Node       | File                                          | Size    | Screen     |
| ---------- | --------------------------------------------- | ------- | ---------- |
| `434:3324` | `assets/images/figma-v12/login-hero.png`      | 370x329 | Login      |
| `434:3284` | `assets/images/figma-v12/spoon-wordmark.png`  | 134x93  | Login, OTP |
| `434:3334` | `assets/images/figma-v12/boot-gradient.png`   | 370x761 | Loading    |
| `434:3335` | `assets/images/figma-v12/boot-spoon-logo.png` | 370x370 | Loading    |
| `434:3252` | `assets/images/figma-v12/edit-phone.png`      | 14x14   | OTP        |

### Outstanding asset blocker

These are **1x renders at design resolution**. The device is 440dpi (2.75x), so the hero is
upscaled ~2.9x and will be visibly soft. The original uploaded images are only reachable through
`get_design_context`, which the local server refuses until an output directory is allowed:

```
Figma Desktop → Dev Mode → MCP panel → Allowed directories →
add D:\spoonCook-frontend\assets\images\figma-v12
```

Figma's own setting `mcpAllowedDirectoriesByUser` is currently `{}`. This is **not** the same
setting as the MCP client list (`installedMcpClients`, which already includes `claudeCLI`).
Until it is set, `get_design_context` returns no data at all for any node, so exact
per-node typography and colour bindings for the remaining 27 screens are also unavailable — those
were derived for the Login flow by combining `get_metadata` geometry, `get_variable_defs` and
pixel-scanning the renders, which is slower and does not scale well.

## 7. Tokens changed

Additive only. No cream/lime token was repointed.

- `neutral.black70` = `rgba(0,0,0,0.7)` — Figma variable `color/black/ 70%` (`#000000b2`), the
  muted-copy colour on the Login flow. Over white it resolves to `#4d4d4d`, which is what the V12
  render samples to.

**Screens intentionally white/yellow:** the five Login-flow screens only.
**Screens intentionally cream/lime:** everything else. Attendance's cream `#fffdf5` and lime300
`#ecff9b` are unchanged and were not touched by this pass.

## 8. Shared components changed

- `Button` — added optional `hitSlop`. No visual change to any existing usage.
- `OtpInput` — added `variant: 'bordered' | 'tiles'`, default `'bordered'`. The service flow's
  usage is untouched; V12 genuinely draws the two differently (the service OTP is large 31x44
  numerals, not tiles), so they are separate variants rather than one inaccurate generic box.
- `designScale.ts` — new shared 370→device mapping.

## 9. Figma / device screenshot paths

- Figma references: `docs/visual-v12/figma/<node>.png` — **all 32 captured**
- Device screenshots: `docs/visual-v12/device/` — **empty, see §11**
- Overlays: `docs/visual-v12/overlay/` — **empty**
- Diffs: `docs/visual-v12/diff/` — one measurement crop only

## 10. Automated gate

All run on the corrected tree:

| Gate                                 | Result                          |
| ------------------------------------ | ------------------------------- |
| `npx tsc --noEmit`                   | **PASS** (0)                    |
| `npx eslint . --max-warnings=0`      | **PASS** (0)                    |
| `npx prettier . --check`             | **PASS**                        |
| `npm test -- --runInBand`            | **PASS** — 322 tests, 18 suites |
| `npx expo export --platform android` | **PASS** — 4MB android bundle   |

`.prettierignore` gained `.claude/settings.local.json`, a machine-local gitignored harness file
Prettier was scanning.

### Tests added

- `src/__tests__/loginV12.test.tsx` — 14 tests. Hero and wordmark present and correctly sized,
  one unified field, divider colour, CTA yellow-not-lime at 325x34, `hitSlop`, white-not-cream,
  verbatim copy, asymmetric gutter, plus the full behavioural contract.
- `src/__tests__/loginFlowV12.test.tsx` — 10 tests. Boot gradient and 370x370 artwork, wordmark no
  longer set as type, OTP white with wordmark and no hero, six 35x35 `#ffef99` tiles with no
  stroke, **no Verify button**, edit icon, 2a countdown copy, auto-verify on the sixth digit.

These assert the contract, not a snapshot — a snapshot of a wrong layout passes forever.

## 11. Physical-device status — BLOCKING

The vivo iQOO I2403 (`10BE9X1HPH001UZ`, Android 16 / SDK 36, 393dp, 1080x2392, 440dpi) was
attached at session start and **disconnected before any screenshot could be taken**. `adb devices`
is now empty and an `adb kill-server` / `start-server` cycle did not recover it.

Consequently:

- **SCREENS_DEVICE_COMPARED: 0**
- no overlay or image-diff exists for any screen
- the existing `android/app/build/outputs/apk/debug/app-debug.apk` (built 14:07 today) is **not
  installed** on the device

The APK loads JS from Metro, so once the device is reattached the five corrected screens can be
verified without a native rebuild. The durable NDK 27.2 plugin (`plugins/withAndroidNdkVersion.js`)
was not touched, and no new native module was added — `react-native-svg` was deliberately avoided
for the boot gradient because it pulls a `buffer` polyfill the project does not carry, which breaks
`expo export`.

## 12. Not yet built

- The development-only visual-state gallery (§7 of the brief). `src/dev/visualStates/` and
  `src/dev/VisualStateGallery.tsx` do not exist yet. Design is settled: it must live outside
  `src/app` and `src/ui` (a standing test forbids either from referencing `@core/fixtures`), and
  route access must be `__DEV__`-guarded with a lazy require so release builds drop it.
- Overlay / image-diff tooling.
- Corrections for the 12 Service, 8 Attendance and 7 performance screens.

## 13. Functional regression

No backend file was touched. No API wiring, schema, gate-navigation, location, notification or
attendance-eligibility code was modified. The 302 pre-existing tests still pass unchanged; the 20
new ones are additive.

**Authenticated E2E: NOT DONE.** No approved test Cook exists, so no authenticated screen has been
reached against the real backend. Render tests are not a substitute and are not reported as one.

## 14. Commit / push / deploy

Uncommitted. Not pushed. Not deployed.
