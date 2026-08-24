"""
Generate pixel-verification evidence for one V13 screen.

Writes `overlay.png`, `diff.png` and `result.json` next to an existing `figma.png` /
`emulator.png` pair, under `docs/visual-verification/v13/<section>/<node-id>/`.

## How the two images are made comparable

The Figma render is cropped to the application viewport (see `viewport.py`) and the emulator
screenshot is scaled to that crop's width. Comparison happens at the FIGMA render's resolution,
never by upscaling Figma to the emulator's 1080px: upscaling invents detail that is not in the
source and would report resampling blur as a design mismatch.

## System chrome is excluded from BOTH sides, and the exclusion is recorded

Every V13 frame draws a **status-bar mock** — a 33-unit band with a 12px clock and signal glyphs —
and the bezel frames also draw a **home-indicator strip**. Neither is application content. On a
device the OS owns those bands, the app is forbidden by the brief from reproducing them, and the
emulator's own bands are a different size anyway: the verified AVD has a 136px status bar (49.45dp,
tall because of its punch-hole cutout) against the design's 33 units, and a 66px gesture bar.

Scoring the app against chrome it must not draw would be meaningless, so the comparison aligns the
two **application-owned regions** — design row `statusBand` and emulator row `statusBarPx` are
treated as the same origin — and excludes the chrome bands from the denominator entirely. Exactly
which rows were dropped, on both sides, is written into `result.json`; nothing is hidden inside a
tolerance.

This alignment is also what makes the comparison sensitive: because the app's `screenWidth / 370`
scale is the exact inverse of the emulator-to-reference downscale, a correctly placed element lands
on its design row to within a pixel, and a real misplacement shows up as a hard red band in
`diff.png` rather than being absorbed by a global offset.

## What "differing pixels" means here

Android and Figma rasterise text with different antialiasing, so a byte-identical render is not
achievable and claiming one would be dishonest. A pixel counts as differing only when its
per-channel distance exceeds `--tolerance` (default 12/255), which absorbs antialiasing while
still catching a wrong colour, a shifted edge or missing content. The raw untoleranced figure is
reported alongside it so the tolerance can never hide a real regression.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from viewport import figma_viewport_crop  # noqa: E402

SECTION_SLUGS = {
    "Login flow": "login-flow",
    "leave": "leave",
    "log in flow": "log-in-flow",
    "performance": "performance",
    "Service flow": "service-flow",
}

#: Height of the status-bar mock inside a **bezel** frame, in design units. Mirrors
#: `STATUS_BAND_HEIGHT` in `src/ui/theme/viewport.ts`; `viewportProfile.test.ts` asserts they agree.
STATUS_BAND_HEIGHT = 33.0

#: Height of the status-bar mock inside a **direct** frame, in design units. Mirrors
#: `DIRECT_STATUS_BAND_HEIGHT` in `src/ui/theme/viewport.ts`.
#:
#: The two are NOT the same number, which is why they are typed separately rather than shared. In
#: the direct sections the mock is `575:1743`, a 32-unit `Component 1` whose notch island is
#: `top-0 bottom-1/4` -- 24 units, and every uncapped direct reference render puts that island on
#: rows 0..23. Using the bezel's 33 here would silently drop one real design row from the top of
#: every `leave`, `log in flow` and `performance` comparison, which is the same class of error as
#: run 1's 25px bezel displacement, just smaller.
DIRECT_STATUS_BAND_HEIGHT = 32.0


@dataclass(frozen=True)
class ComparisonProfile:
    """How one section's reference render maps onto the application-owned region."""

    #: Design units of status-bar mock to drop from the top of the reference.
    status_band: float
    #: Design units of home-indicator strip to drop from the bottom of the reference.
    home_indicator: float

    @property
    def note(self) -> str:
        return f"statusBand={self.status_band} homeIndicator={self.home_indicator}"


BEZEL_PROFILE = ComparisonProfile(status_band=STATUS_BAND_HEIGHT, home_indicator=10.0)
DIRECT_PROFILE = ComparisonProfile(status_band=DIRECT_STATUS_BAND_HEIGHT, home_indicator=0.0)

#: Section -> comparison profile. Keyed by the same section names `viewport.py` branches on, so a
#: section can never pick up the bezel crop and the direct status band, or any other mixture.
COMPARISON_PROFILES = {
    "Login flow": BEZEL_PROFILE,
    "Service flow": BEZEL_PROFILE,
    "leave": DIRECT_PROFILE,
    "log in flow": DIRECT_PROFILE,
    "performance": DIRECT_PROFILE,
}

#: Measured on the Ref393GA AVD with `dumpsys window displays`:
#:   InsetsSource type=statusBars      frame=[0,0][1080,136]
#:   InsetsSource type=navigationBars  frame=[0,2326][1080,2392]
DEFAULT_EMULATOR_STATUS_PX = 136
DEFAULT_EMULATOR_NAV_PX = 66


def load_rgb(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def compare(
    figma_path: Path,
    emulator_path: Path,
    out_dir: Path,
    section: str,
    node_id: str,
    name: str,
    frame_w: float,
    frame_h: float,
    route: str,
    tolerance: int = 12,
    emulator_status_px: int = DEFAULT_EMULATOR_STATUS_PX,
    emulator_nav_px: int = DEFAULT_EMULATOR_NAV_PX,
) -> dict:
    figma = load_rgb(figma_path)
    figma_array = np.asarray(figma).astype(int)
    crop = figma_viewport_crop(section, frame_w, frame_h, figma.width, figma.height, figma_array)
    viewport = figma.crop((crop.left, crop.top, crop.right, crop.bottom))

    # Drop the design's own system-chrome bands, per the section's typed profile.
    profile = COMPARISON_PROFILES[section]
    status_rows = round(profile.status_band * crop.scale)
    indicator_rows = round(profile.home_indicator * crop.scale)
    reference = viewport.crop((0, status_rows, viewport.width, viewport.height - indicator_rows))

    emulator = load_rgb(emulator_path)
    # Drop the emulator's system bars, then scale what remains to the reference width.
    emulator_content = emulator.crop(
        (0, emulator_status_px, emulator.width, emulator.height - emulator_nav_px)
    )
    target_h = round(emulator_content.height * reference.width / emulator_content.width)
    # BOX (area average), not LANCZOS. The emulator renders at 2.92x the reference's resolution, so
    # every comparison is a downsample; LANCZOS is a sharpening kernel and rings around the hard
    # edges this design is full of -- a 1-unit lime card border came back as a 47/255 error on the
    # border row itself plus over/undershoot on the rows either side, none of which is a property
    # of the app's render. Area averaging is what a display actually does when it integrates 2.92
    # device pixels into one, so it introduces no detail of its own. It scores every already-closed
    # `Login flow` screen the same or better, which is the check that it is not simply looser.
    scaled = emulator_content.resize((reference.width, target_h), Image.BOX)

    # Compare over the overlapping height only, and report what was left out.
    height = min(reference.height, scaled.height)
    ref_a = np.asarray(reference.crop((0, 0, reference.width, height))).astype(np.int16)
    emu_a = np.asarray(scaled.crop((0, 0, reference.width, height))).astype(np.int16)

    delta = np.abs(ref_a - emu_a)
    per_pixel = delta.max(axis=2)
    total = per_pixel.size
    raw_diff = int((per_pixel > 0).sum())
    tol_diff = int((per_pixel > tolerance).sum())

    out_dir.mkdir(parents=True, exist_ok=True)

    # 50% overlay: the reference and the render blended, so a geometry shift shows as ghosting.
    Image.blend(
        reference.crop((0, 0, reference.width, height)),
        scaled.crop((0, 0, reference.width, height)),
        0.5,
    ).save(out_dir / "overlay.png")

    # Difference image: greyscale render with differing pixels painted red.
    grey = np.asarray(
        reference.crop((0, 0, reference.width, height)).convert("L").convert("RGB")
    ).astype(np.uint8)
    diff_img = (grey * 0.35).astype(np.uint8)
    mask = per_pixel > tolerance
    diff_img[mask] = [255, 0, 0]
    Image.fromarray(diff_img).save(out_dir / "diff.png")

    # Per-row differing percentage, so a review can see WHERE a screen fails without opening the
    # image — a single bad band reads very differently from uniform drift.
    row_pct = (mask.mean(axis=1) * 100.0).round(2)
    worst = np.argsort(row_pct)[::-1][:8]

    # Global displacement probe. Rasterisation noise and a shifted layout produce similar
    # percentages but are completely different defects, so the comparison searches +/-10 rows for
    # the offset that minimises the difference. A best offset of 0 means the screen is in the right
    # place and the residual is antialiasing; anything else is a real geometry error, and saying so
    # in the artefact stops a low score from being read as a pass when the screen is simply shifted.
    span = 10
    inner = ref_a[span:-span] if height > 2 * span else ref_a
    best_offset, best_pct = 0, None
    if height > 2 * span:
        for offset in range(-span, span + 1):
            window = emu_a[span + offset : height - span + offset]
            if window.shape != inner.shape:
                continue
            pct = float((np.abs(inner - window).max(axis=2) > tolerance).mean())
            if best_pct is None or pct < best_pct:
                best_offset, best_pct = offset, pct

    result = {
        "section": section,
        "screenName": name,
        "figmaNodeId": node_id,
        "route": route,
        "figmaFrameDp": {"width": round(frame_w, 2), "height": round(frame_h, 2)},
        "figmaRenderPx": {"width": figma.width, "height": figma.height},
        "viewportCropPx": {
            "left": crop.left,
            "top": crop.top,
            "width": crop.width,
            "height": crop.height,
        },
        "systemChromeExcluded": {
            "profile": profile.note,
            "designStatusBandPx": status_rows,
            "designHomeIndicatorPx": indicator_rows,
            "emulatorStatusBarPx": emulator_status_px,
            "emulatorNavigationBarPx": emulator_nav_px,
            "note": (
                "Both sides are cropped to the application-owned region before comparison. The "
                "app is forbidden from drawing the design's status-bar mock or home indicator, "
                "and the emulator's own bars are a different size, so those rows are excluded "
                "from the denominator rather than scored."
            ),
        },
        "scalingTransform": {
            "figmaRenderScale": round(crop.scale, 4),
            "figmaRenderOriginYPx": round(crop.margin, 2),
            "note": crop.note,
            "emulatorPx": {"width": emulator.width, "height": emulator.height},
            "emulatorContentPx": {
                "width": emulator_content.width,
                "height": emulator_content.height,
            },
            "emulatorScaledToPx": {"width": reference.width, "height": target_h},
            "comparedAtPx": {"width": reference.width, "height": height},
        },
        "comparedHeightPx": height,
        "referenceHeightPx": reference.height,
        "emulatorScaledHeightPx": target_h,
        "uncomparedReferenceRows": max(0, reference.height - height),
        "antialiasingTolerance": tolerance,
        "differingPixelPercent": round(100.0 * tol_diff / total, 4),
        "rawDifferingPixelPercent": round(100.0 * raw_diff / total, 4),
        "meanChannelDelta": round(float(delta.mean()), 4),
        "maxChannelDelta": int(delta.max()),
        "worstRows": [
            {"row": int(r), "percent": float(row_pct[r])} for r in sorted(worst.tolist())
        ],
        "displacementProbe": {
            "bestVerticalOffsetPx": best_offset,
            "percentAtBestOffset": round(100.0 * best_pct, 4) if best_pct is not None else None,
            "note": (
                "0 means the render is on its design row and the residual is rasterisation. A "
                "non-zero offset is a real layout error even when the headline percentage is low."
            ),
        },
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", required=True, help="V13 inventory JSON")
    parser.add_argument("--root", default="docs/visual-verification/v13")
    parser.add_argument("--tolerance", type=int, default=12)
    parser.add_argument("--node", default=None, help="Only this node id")
    parser.add_argument("--emulator-status-px", type=int, default=DEFAULT_EMULATOR_STATUS_PX)
    parser.add_argument("--emulator-nav-px", type=int, default=DEFAULT_EMULATOR_NAV_PX)
    args = parser.parse_args()

    inventory = json.loads(Path(args.inventory).read_text(encoding="utf-8"))
    root = Path(args.root)
    done = skipped = 0
    for row in inventory:
        if args.node and row["nodeId"] != args.node:
            continue
        slug = SECTION_SLUGS[row["section"]]
        out_dir = root / slug / row["nodeId"].replace(":", "-")
        figma_path = out_dir / "figma.png"
        emulator_path = out_dir / "emulator.png"
        if not figma_path.exists() or not emulator_path.exists():
            skipped += 1
            missing = "figma" if not figma_path.exists() else "emulator"
            print(f"skip {row['nodeId']}: missing {missing}.png")
            continue
        result = compare(
            figma_path,
            emulator_path,
            out_dir,
            row["section"],
            row["nodeId"],
            row["name"],
            row["w"],
            row["h"],
            row.get("route", row.get("galleryState", "")),
            args.tolerance,
            args.emulator_status_px,
            args.emulator_nav_px,
        )
        # PASS/FAIL is decided by a human reading the overlay; the script records the measurement
        # and leaves the verdict field for that review rather than asserting one itself.
        result["verdict"] = "PENDING_REVIEW"
        (out_dir / "result.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        done += 1
        print(
            f"{row['nodeId']:>10} {row['name'][:34]:34} "
            f"diff={result['differingPixelPercent']:6.2f}%  raw={result['rawDifferingPixelPercent']:6.2f}%"
        )
    print(f"\ncompared={done} skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
