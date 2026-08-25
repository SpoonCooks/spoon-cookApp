"""
Generate pixel-verification evidence for one V13 screen.

Writes `overlay.png`, `diff.png` and `result.json` next to an existing `figma.png` /
`emulator.png` pair, under `docs/visual-verification/v14/<section>/<node-id>/`.

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
    "log in flow": "log-in-flow",
    "leave": "leave",
    "performance": "performance",
    "job flow": "job-flow",
    "Service flow": "service-flow",
    "Info": "info",
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

#: Height of the status-bar mock in a **leave** frame, in design units. Mirrors
#: `LEAVE_STATUS_BAND_HEIGHT` in `src/ui/theme/viewport.ts`.
#:
#: A third value, and again not a guess: `526:348` is an explicit `h-[36.198px]` row that also
#: carries a `#f3f4f6` hairline along its bottom edge, which the `log in flow` mock does not have.
LEAVE_STATUS_BAND_HEIGHT = 36.198

#: Height of the status-bar mock in a **Service flow** frame, in design units. Mirrors
#: `SERVICE_STATUS_BAND_HEIGHT` in `src/ui/theme/viewport.ts`.
#:
#: A fourth value, and not the bezel's 33. `462:3660` is an explicit `h-[36.198px]` row carrying a
#: `#f3f4f6` hairline along its bottom edge -- the same component the `leave` frames use, not the
#: one `Login flow` uses. Comparing Service against 33 leaves three design rows of chrome at the
#: top of the reference, displacing every Service screen by three rows before any element is
#: examined. Read from the persisted design context for `462:3617`, not inferred.
SERVICE_STATUS_BAND_HEIGHT = 36.198

#: Frames whose content is anchored to the BOTTOM of the viewport rather than the top.
#:
#: These are the bottom sheets. Each is 846 content units tall against the verified emulator's 750,
#: so 96 units cannot be shown. On a top-anchored screen the missing rows are at the bottom -- the
#: user scrolls to them. On a sheet they are at the TOP, and they are scrim: the sheet keeps its
#: design height and stays against the bottom edge, which is what the app draws and what a device
#: does. Aligning these by their first row would displace every sheet element by 96 units and score
#: a correct render as a total failure, so they are aligned by their last row instead. The rows that
#: go uncompared are still counted, and `anchor` is written into every `result.json`.
#:
#: In the committed canvas dump every one of these is a 36.198 status mock at y=0, a single content
#: child, and no nav of any kind. Seven of the eight are the tall sheet -- **y=239.2, height 643**;
#: `592:888` is the short one, **y=396.2, height 486**. What makes them all bottom-anchored is the
#: scrim above the sheet, not the sheet's own height.
#:
#: The three `leave` sheets were listed first. The five `Info` rule sheets are the same component
#: and were missing, which would have reported every one of them as ~96 units displaced.
#: Height of the V14 five-tab bottom nav in design units (`634:2478`): a 52-unit row inside 8
#: units of vertical padding. Mirrors `BOTTOM_NAV_HEIGHT` in `src/ui/components/BottomNav.tsx` and
#: `BOTTOM_NAV_UNITS` in `capture_emulator.py`.
BOTTOM_NAV_UNITS = 68


def _stack(top: "Image.Image", bottom: "Image.Image") -> "Image.Image":
    """Join two equal-width crops vertically, so the artefacts stay one picture of one screen."""
    out = Image.new("RGB", (top.width, top.height + bottom.height))
    out.paste(top, (0, 0))
    out.paste(bottom, (0, top.height))
    return out


BOTTOM_ANCHORED_NODES = frozenset(
    {
        # leave
        "592:563",  # long leave
        "592:639",  # long leave selected
        "592:888",  # short leave
        # Info -- identical geometry, added after the canvas dump was re-read
        "597:1221",  # rating tiers
        "603:1865",  # No Show
        "603:1924",  # >7 bonus
        "605:2027",  # 5+ bonus
        "605:2094",  # Late
    }
)


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


def profile_for(row: dict) -> "ComparisonProfile":
    """The comparison profile for one inventory row."""
    return ComparisonProfile(
        status_band=float(row["statusBand"]),
        # Only a bezel frame draws the home-indicator strip; a direct frame ends at its last row.
        home_indicator=10.0 if row["convention"] == "bezel" else 0.0,
    )


BEZEL_PROFILE = ComparisonProfile(status_band=STATUS_BAND_HEIGHT, home_indicator=10.0)
SERVICE_PROFILE = ComparisonProfile(status_band=SERVICE_STATUS_BAND_HEIGHT, home_indicator=10.0)
DIRECT_PROFILE = ComparisonProfile(status_band=DIRECT_STATUS_BAND_HEIGHT, home_indicator=0.0)
LEAVE_PROFILE = ComparisonProfile(status_band=LEAVE_STATUS_BAND_HEIGHT, home_indicator=0.0)

#: Section -> comparison profile. Keyed by the same section names `viewport.py` branches on, so a
#: section can never pick up the bezel crop and the direct status band, or any other mixture.
COMPARISON_PROFILES = {
    "Login flow": BEZEL_PROFILE,
    "Service flow": SERVICE_PROFILE,
    "leave": LEAVE_PROFILE,
    "log in flow": DIRECT_PROFILE,
    "performance": DIRECT_PROFILE,
}

#: Measured on the Ref393GA AVD with `dumpsys window displays`:
#:   InsetsSource type=statusBars      frame=[0,0][1080,136]
#:   InsetsSource type=navigationBars  frame=[0,2326][1080,2392]
DEFAULT_EMULATOR_STATUS_PX = 136
DEFAULT_EMULATOR_NAV_PX = 66

#: The tolerance a VERDICT is taken at, as opposed to the reporting tolerance of 12.
#:
#: A rasterisation residual collapses when the tolerance widens -- those pixels are edge pixels a
#: few levels apart. A real difference does not, because a wrong fill, a missing element or a
#: displaced block differs by far more than 40 levels. Every `result.json` carries the figure at
#: both tolerances so a ruling can be re-derived from the artefact rather than trusted.
VERDICT_TOLERANCE = 40


def load_rgb(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


@dataclass(frozen=True)
class AlignedPair:
    """The two views a screen is actually scored on, plus how they were derived."""

    reference: "Image.Image"
    render: "Image.Image"
    crop: object
    profile: "ComparisonProfile"
    status_rows: int
    indicator_rows: int
    anchor: str
    bands: dict
    uncompared: int
    #: The reference rows the device could not show, cropped out for inspection.
    unseen: "Image.Image"
    height: int
    #: The full application-owned reference before the overlap crop, for row arithmetic.
    reference_full: "Image.Image"
    #: The emulator content scaled to the reference width, before the overlap crop.
    render_full: "Image.Image"
    figma_size: tuple
    emulator_size: tuple
    emulator_content_size: tuple


def aligned_views(
    figma_path: Path,
    emulator_path: Path,
    row: dict,
    section: str,
    node_id: str,
    frame_w: float,
    frame_h: float,
    emulator_status_px: int = DEFAULT_EMULATOR_STATUS_PX,
    emulator_nav_px: int = DEFAULT_EMULATOR_NAV_PX,
) -> AlignedPair:
    """
    Build the reference/render pair a verdict is computed from.

    Every consumer -- the scorer, the band inspector, the side-by-side sheet -- goes through this
    one function, so a reading aid can never show a different alignment from the one that was
    scored. It used to be duplicated in `inspect_band.py` against a section-keyed profile table,
    which had no entry for `Info` or `job flow` and ignored bottom anchoring entirely.
    """
    figma = load_rgb(figma_path)
    figma_array = np.asarray(figma).astype(int)
    crop = figma_viewport_crop(
        section, frame_w, frame_h, figma.width, figma.height, figma_array, row["convention"]
    )
    viewport = figma.crop((crop.left, crop.top, crop.right, crop.bottom))

    profile = profile_for(row)
    status_rows = round(profile.status_band * crop.scale)
    indicator_rows = round(profile.home_indicator * crop.scale)
    reference = viewport.crop((0, status_rows, viewport.width, viewport.height - indicator_rows))

    emulator = load_rgb(emulator_path)
    emulator_content = emulator.crop(
        (0, emulator_status_px, emulator.width, emulator.height - emulator_nav_px)
    )
    target_h = round(emulator_content.height * reference.width / emulator_content.width)
    scaled = emulator_content.resize((reference.width, target_h), Image.BOX)

    nav_rows = round(BOTTOM_NAV_UNITS * crop.scale) if row.get("bottomNav") else 0
    if nav_rows and (reference.height <= nav_rows or scaled.height <= nav_rows):
        nav_rows = 0

    anchor = "bottom" if node_id in BOTTOM_ANCHORED_NODES else "top"

    if nav_rows:
        ref_body = reference.crop((0, 0, reference.width, reference.height - nav_rows))
        emu_body = scaled.crop((0, 0, reference.width, scaled.height - nav_rows))
        body_h = min(ref_body.height, emu_body.height)
        ref_view = ref_body.crop((0, 0, reference.width, body_h))
        emu_view = emu_body.crop((0, 0, reference.width, body_h))
        ref_nav = reference.crop(
            (0, reference.height - nav_rows, reference.width, reference.height)
        )
        emu_nav = scaled.crop((0, scaled.height - nav_rows, reference.width, scaled.height))
        ref_view = _stack(ref_view, ref_nav)
        emu_view = _stack(emu_view, emu_nav)
        height = body_h + nav_rows
        uncompared = max(0, ref_body.height - body_h)
        # The rows the device could not show sit BETWEEN the compared body and the fixed nav,
        # not at the end of the frame.
        unseen = ref_body.crop((0, body_h, reference.width, ref_body.height))
        bands = {
            "mode": "body top-anchored, nav bottom-anchored",
            "navBandPx": nav_rows,
            "bodyComparedPx": body_h,
            "bodyReferencePx": ref_body.height,
            "bodyUncomparedPx": uncompared,
            "why": (
                "The nav is fixed chrome on the bottom edge in both the design and the app, and "
                "the body between them is what the shorter device has to give up. Comparing the "
                "whole frame from the top would line the render's nav up against reference body "
                "rows and score a correct bar as a total mismatch."
            ),
        }
    else:
        height = min(reference.height, scaled.height)
        if anchor == "bottom":
            ref_box = (0, reference.height - height, reference.width, reference.height)
            emu_box = (0, scaled.height - height, reference.width, scaled.height)
        else:
            ref_box = (0, 0, reference.width, height)
            emu_box = (0, 0, reference.width, height)
        ref_view = reference.crop(ref_box)
        emu_view = scaled.crop(emu_box)
        uncompared = max(0, reference.height - height)
        unseen = (
            reference.crop((0, 0, reference.width, uncompared))
            if anchor == "bottom"
            else reference.crop((0, height, reference.width, reference.height))
        )
        bands = {"mode": "single band", "navBandPx": 0}

    return AlignedPair(
        reference=ref_view,
        render=emu_view,
        crop=crop,
        profile=profile,
        status_rows=status_rows,
        indicator_rows=indicator_rows,
        anchor=anchor,
        bands=bands,
        uncompared=uncompared,
        unseen=unseen,
        height=height,
        reference_full=reference,
        render_full=scaled,
        figma_size=(figma.width, figma.height),
        emulator_size=(emulator.width, emulator.height),
        emulator_content_size=(emulator_content.width, emulator_content.height),
    )


def _inked_rows(band: "Image.Image") -> int:
    """
    Rows in the uncompared band that carry something other than the frame's background.

    The background is taken from the band's own modal colour rather than assumed white, so a
    scrim-backed sheet is judged against its scrim.
    """
    if band.height <= 0:
        return 0
    arr = np.asarray(band).astype(int)
    flat = arr.reshape(-1, 3)
    values, counts = np.unique(flat, axis=0, return_counts=True)
    background = values[int(np.argmax(counts))]
    ink = np.abs(arr - background).max(axis=2) > 24
    return int((ink.sum(axis=1) > 2).sum())


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
    #: The inventory row, which carries this frame's own convention and status band.
    row: dict,
    tolerance: int = 12,
    emulator_status_px: int = DEFAULT_EMULATOR_STATUS_PX,
    emulator_nav_px: int = DEFAULT_EMULATOR_NAV_PX,
) -> dict:
    pair = aligned_views(
        figma_path,
        emulator_path,
        row,
        section,
        node_id,
        frame_w,
        frame_h,
        emulator_status_px,
        emulator_nav_px,
    )
    ref_view, emu_view = pair.reference, pair.render
    crop, profile = pair.crop, pair.profile
    status_rows, indicator_rows = pair.status_rows, pair.indicator_rows
    anchor, bands = pair.anchor, pair.bands
    uncompared, height = pair.uncompared, pair.height
    reference, target_h = pair.reference_full, pair.render_full.height

    # How many of the rows we could NOT compare actually carry ink.
    #
    # `uncomparedReferenceRows` alone is not a verdict input, because it does not say what is in
    # them: `592:1008` is a 950-unit frame whose last 111 units are empty white, and reporting
    # "162 rows unseen" reads like a third of a screen went unchecked when the app has nothing
    # left to draw there. A row counts as inked when it differs from the reference's own
    # background, so a screen can only be passed with unseen rows when those rows are blank.
    uncompared_ink = _inked_rows(pair.unseen)

    ref_a = np.asarray(ref_view).astype(np.int16)
    emu_a = np.asarray(emu_view).astype(np.int16)

    delta = np.abs(ref_a - emu_a)
    per_pixel = delta.max(axis=2)
    total = per_pixel.size
    raw_diff = int((per_pixel > 0).sum())
    tol_diff = int((per_pixel > tolerance).sum())
    # The verdict tolerance, always, whatever `--tolerance` was asked for.
    #
    # It used to be a second manual run whose 47 numbers were pasted into a table inside
    # `rule_verdicts.py`. A hand-maintained table cannot survive a re-render: the moment one
    # screen is re-captured its residual is stale and nothing says so. Scoring both here costs one
    # comparison of an array already in memory, and makes the verdict derivable from the artefact.
    verdict_diff = int((per_pixel > VERDICT_TOLERANCE).sum())

    out_dir.mkdir(parents=True, exist_ok=True)

    # 50% overlay: the reference and the render blended, so a geometry shift shows as ghosting.
    Image.blend(ref_view, emu_view, 0.5).save(out_dir / "overlay.png")

    # Difference image: greyscale render with differing pixels painted red.
    grey = np.asarray(ref_view.convert("L").convert("RGB")).astype(np.uint8)
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
        "figmaRenderPx": {"width": pair.figma_size[0], "height": pair.figma_size[1]},
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
            "emulatorPx": {"width": pair.emulator_size[0], "height": pair.emulator_size[1]},
            "emulatorContentPx": {
                "width": pair.emulator_content_size[0],
                "height": pair.emulator_content_size[1],
            },
            "emulatorScaledToPx": {"width": reference.width, "height": target_h},
            "comparedAtPx": {"width": reference.width, "height": height},
        },
        "anchor": anchor,
        "comparedHeightPx": height,
        "referenceHeightPx": reference.height,
        "emulatorScaledHeightPx": target_h,
        "uncomparedReferenceRows": uncompared,
        "uncomparedReferenceInkRows": uncompared_ink,
        "bandSplit": bands,
        "antialiasingTolerance": tolerance,
        "differingPixelPercent": round(100.0 * tol_diff / total, 4),
        "rawDifferingPixelPercent": round(100.0 * raw_diff / total, 4),
        "verdictTolerance": VERDICT_TOLERANCE,
        "differingPixelPercentAtVerdictTolerance": round(100.0 * verdict_diff / total, 4),
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
    parser.add_argument("--root", default="docs/visual-verification/v14")
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
            row,
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
