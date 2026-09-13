# V14 on real hardware — vivo iQOO I2403

Every one of the 47 Cook screens, captured on a **physical device** rather than the AVD, and scored
against the same committed Figma references by the same harness.

## Why this is a separate root

The emulator evidence in `../v14/` is calibrated to `Ref393GA`, whose system bars are **136px** and
**66px**. This phone's are **110px** and **49px** — it has no punch-hole cutout and a slimmer
gesture bar — so it shows **765 design units** of content against the AVD's 750.

Those two numbers are the whole reason for a second root. `compare.py` takes them as
`--emulator-status-px` / `--emulator-nav-px`; scoring the phone against the AVD's bars would shift
every screen by nine design units before a single element was examined. Nothing else differs: the
panel is 1080x2392 at 440dpi, the same geometry the design scale targets.

Reproduce with:

    ANDROID_SERIAL=<serial> python scripts/visual/capture_emulator.py \
        --adb "$(which adb)" \
        --inventory docs/visual-verification/v14/inventory.json \
        --states scripts/visual/gallery-states-v14.json \
        --root docs/visual-verification/v14-device \
        --emulator-status-px 110 --emulator-nav-px 49

    python scripts/visual/compare.py \
        --inventory docs/visual-verification/v14/inventory.json \
        --root docs/visual-verification/v14-device \
        --emulator-status-px 110 --emulator-nav-px 49

## Result — 47/47

| | device | emulator |
| --- | ---: | ---: |
| Screens passing | **47/47** | 47/47 |
| Worst residual | **8.71** | 8.71 |
| Mean residual | **5.15** | 5.17 |
| Displacement probes | 30 at 0, 17 at +/-1 | 29 at 0, 18 at +/-1 |

Every section is 100%: Login 5/5, log in flow 4/4, leave 7/7, performance 7/7, job flow 5/5,
Service flow 13/13, Info 6/6.

The largest device-vs-AVD divergence on any single screen is **+0.33** points. The hardware panel
and the emulator agree to within rasterisation noise.

### Two captures were contaminated, and re-taken

`434:3116` and `434:3174` first came back at ~99% differing. They were not app failures: an
incoming WhatsApp voice call took the foreground mid-run, and the harness captured the Calls list
and the in-call screen. Re-captured cleanly, both pass. Worth knowing that a real phone can put
something in front of the app in a way an AVD never will.

## Colour audit

Sampled the interior of every region the DESIGN paints a brand colour, eroded 3px so no antialiased
boundary is included, and measured what the app paints at those same pixels:

| brand colour | interior px | median delta | p90 | within 8 levels |
| --- | ---: | ---: | ---: | ---: |
| `#ffd600` brand yellow | 135,632 | **0** | 0 | 99.99% |
| `#cfff04` lime | 161,257 | **0** | 0 | 98.77% |
| `#ecff9b` lime100 | 445,073 | **0** | 0 | 99.84% |
| `#ffef99` tile | 256,018 | **0** | 0 | 99.99% |
| `#ff0000` red | 8,802 | **0** | 0 | 100.00% |
| `#e2ff68` chip | 54,960 | **0** | 0 | 98.78% |
| `#ffe666` disc | 103,111 | **0** | 0 | 100.00% |
| `#0a0a0a` near-black | 818 | 2 | 4 | 100.00% |

Fills are exact. The p99 outliers on `#cfff04` and `#e2ff68` are glyphs sitting on those fills, not
the fills themselves.

## Responsiveness

### Display size — PASS

Driven at three densities on the same panel, which is what Android's "Display size" setting
changes:

| density | effective width | vs native |
| ---: | ---: | ---: |
| 493 | 350.5dp | 3.77% differing |
| 440 | 392.7dp | native |
| 400 | 432.0dp | 3.73% differing |

A 23% swing in available width produces a visually identical layout — same proportions, no reflow,
no clipping. That is `screenWidth / 370` doing exactly what it exists for, confirmed on hardware.

### OS font scale — FAILS at 1.3x

**`allowFontScaling` is never set anywhere in the codebase**, so React Native's default applies and
every string grows with the OS font-size setting — inside boxes whose heights are pinned in design
units (`TILE.leadHeight` 113, the cancelled caption's 70, `SHEET.height` 643, the nav's 47).

At **1.3x**, a common accessibility setting:

| screen | differing vs 1.0x | what happens |
| --- | ---: | --- |
| `login/phone` | 2.51% | absorbs it; the column is not height-constrained |
| `jobs/next-45` | 26.47% | `12:15 PM` wraps to two lines, inflating the 44-unit break cell to ~75; two job cards pushed off screen |
| `info/bonus-over-7` | 30.06% | **title `Extra hours` clipped mid-word**; **`+₹13,500` collides and clips**; footnote grows to three lines; **`4 hrs 5 ...` truncated and overlapping the `Samajh gyi` CTA** |

The Info rule sheets are the worst case because they are a fixed 643-unit sheet with a bottom-
anchored CTA: there is nowhere for grown type to go, so it lands on top of the button.

This is a **product and accessibility decision, not a rendering bug**, and it is left open
deliberately rather than resolved here. The two honest options:

1. `allowFontScaling={false}` on the `Text` primitive — guarantees the pixel contract at any OS
   setting, and ignores the user's stated accessibility preference.
2. `maxFontSizeMultiplier` (around 1.1–1.15) — keeps some of the preference and keeps the sheets
   intact.

Option 1 is what the fixed 370-unit grid implies, but it is a real accessibility trade-off and
belongs to a designer, not to a pixel diff. Screenshots for both scales are not committed; the
numbers above are reproducible with `settings put system font_scale 1.30`.

## What was NOT verified here

The development gallery cannot run on a release build — `__DEV__` is false and
`areFixturesAvailable()` returns false by design, which `fixtureExclusion.test.ts` asserts. These
47 captures therefore come from the **debug** build over Metro. The release APK was verified
separately for cold launch, resume, restart and asset embedding, but not screen by screen, because
the guard that makes that impossible is the guard that keeps invented data out of production.
