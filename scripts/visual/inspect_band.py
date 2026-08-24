"""
Crop one aligned reference/render band pair out of an existing comparison, side by side.

`compare.py` reports *that* a row differs; this reports *what* is on it. It rebuilds exactly the
same aligned pair (same crop, same chrome exclusion, same area-average downscale) and writes a
stacked strip -- reference on top, render beneath, difference below that -- so a residual can be
classified by eye instead of by percentage. Nothing here feeds a verdict; it is a reading aid.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import (  # noqa: E402
    COMPARISON_PROFILES,
    DEFAULT_EMULATOR_NAV_PX,
    DEFAULT_EMULATOR_STATUS_PX,
    load_rgb,
)
from viewport import figma_viewport_crop  # noqa: E402


def aligned_pair(
    figma_path: Path, emulator_path: Path, section: str, frame_w: float, frame_h: float
) -> tuple[Image.Image, Image.Image]:
    figma = load_rgb(figma_path)
    figma_array = np.asarray(figma).astype(int)
    crop = figma_viewport_crop(section, frame_w, frame_h, figma.width, figma.height, figma_array)
    viewport = figma.crop((crop.left, crop.top, crop.right, crop.bottom))
    profile = COMPARISON_PROFILES[section]
    status_rows = round(profile.status_band * crop.scale)
    indicator_rows = round(profile.home_indicator * crop.scale)
    reference = viewport.crop((0, status_rows, viewport.width, viewport.height - indicator_rows))

    emulator = load_rgb(emulator_path)
    content = emulator.crop(
        (0, DEFAULT_EMULATOR_STATUS_PX, emulator.width, emulator.height - DEFAULT_EMULATOR_NAV_PX)
    )
    target_h = round(content.height * reference.width / content.width)
    scaled = content.resize((reference.width, target_h), Image.BOX)
    return reference, scaled


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True, help="evidence directory holding the PNG pair")
    parser.add_argument("--section", required=True)
    parser.add_argument("--frame-w", type=float, required=True)
    parser.add_argument("--frame-h", type=float, required=True)
    parser.add_argument("--top", type=int, required=True, help="first row of the band")
    parser.add_argument("--height", type=int, default=60)
    parser.add_argument("--zoom", type=int, default=3)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    d = Path(args.dir)
    reference, scaled = aligned_pair(
        d / "figma.png", d / "emulator.png", args.section, args.frame_w, args.frame_h
    )
    bottom = args.top + args.height
    ref_band = reference.crop((0, args.top, reference.width, min(bottom, reference.height)))
    emu_band = scaled.crop((0, args.top, scaled.width, min(bottom, scaled.height)))

    h = min(ref_band.height, emu_band.height)
    ref_band, emu_band = ref_band.crop((0, 0, ref_band.width, h)), emu_band.crop(
        (0, 0, emu_band.width, h)
    )
    delta = np.abs(
        np.asarray(ref_band).astype(np.int16) - np.asarray(emu_band).astype(np.int16)
    ).max(axis=2)
    heat = np.zeros((h, ref_band.width, 3), dtype=np.uint8)
    heat[..., 0] = np.clip(delta, 0, 255)

    gap = 4
    strip = Image.new("RGB", (ref_band.width, h * 3 + gap * 2), (0, 128, 255))
    strip.paste(ref_band, (0, 0))
    strip.paste(emu_band, (0, h + gap))
    strip.paste(Image.fromarray(heat), (0, h * 2 + gap * 2))
    z = args.zoom
    strip = strip.resize((strip.width * z, strip.height * z), Image.NEAREST)
    strip.save(args.out)
    print(f"rows {args.top}..{args.top + h} -> {args.out}  (reference / render / delta)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
