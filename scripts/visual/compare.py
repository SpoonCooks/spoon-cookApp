"""
Generate pixel-verification evidence for one V13 screen.

Writes `overlay.png`, `diff.png` and `result.json` next to an existing `figma.png` /
`emulator.png` pair, under `docs/visual-verification/v13/<section>/<node-id>/`.

## How the two images are made comparable

The Figma render is cropped to the application viewport (see `viewport.py`) and the emulator
screenshot is scaled to that crop's width. Comparison happens at the FIGMA render's resolution,
never by upscaling Figma to the emulator's 1080px: upscaling invents detail that is not in the
source and would report resampling blur as a design mismatch.

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
) -> dict:
    figma = load_rgb(figma_path)
    crop = figma_viewport_crop(section, frame_w, frame_h, figma.width, figma.height)
    reference = figma.crop((crop.left, crop.top, crop.right, crop.bottom))

    emulator = load_rgb(emulator_path)
    # Scale the emulator render down to the reference width, preserving its aspect ratio.
    target_h = round(emulator.height * reference.width / emulator.width)
    scaled = emulator.resize((reference.width, target_h), Image.LANCZOS)

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
        "scalingTransform": {
            "figmaRenderScale": round(crop.scale, 4),
            "figmaRenderMarginPx": round(crop.margin, 2),
            "note": crop.note,
            "emulatorPx": {"width": emulator.width, "height": emulator.height},
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
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", required=True, help="V13 inventory JSON")
    parser.add_argument("--root", default="docs/visual-verification/v13")
    parser.add_argument("--tolerance", type=int, default=12)
    parser.add_argument("--node", default=None, help="Only this node id")
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
            print(f"skip {row['nodeId']}: missing {'figma' if not figma_path.exists() else 'emulator'}.png")
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
