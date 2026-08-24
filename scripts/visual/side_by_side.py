"""
Write one aligned reference-beside-render image for a screen, for review by eye.

`compare.py` scores a screen and `inspect_band.py` magnifies one band of it; this shows the whole
compared region at once, which is what you want when a screen is failing for a reason nobody has
named yet. Reference on the left, render on the right, difference on the far right.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_band import aligned_pair  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True)
    parser.add_argument("--section", required=True)
    parser.add_argument("--frame-w", type=float, required=True)
    parser.add_argument("--frame-h", type=float, required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--scale", type=float, default=1.0)
    parser.add_argument("--top", type=int, default=0)
    parser.add_argument("--height", type=int, default=0, help="0 = to the end of the overlap")
    args = parser.parse_args()

    d = Path(args.dir)
    ref, emu = aligned_pair(
        d / "figma.png", d / "emulator.png", args.section, args.frame_w, args.frame_h
    )
    h = min(ref.height, emu.height)
    top = args.top
    bottom = h if args.height == 0 else min(h, top + args.height)
    ref = ref.crop((0, top, ref.width, bottom))
    emu = emu.crop((0, top, emu.width, bottom))

    delta = np.abs(np.asarray(ref).astype(np.int16) - np.asarray(emu).astype(np.int16)).max(axis=2)
    heat = np.zeros((ref.height, ref.width, 3), dtype=np.uint8)
    grey = np.asarray(ref.convert("L")).astype(np.uint8)
    heat[..., 0] = heat[..., 1] = heat[..., 2] = (grey * 0.3).astype(np.uint8)
    mask = delta > 12
    heat[mask] = [255, 0, 0]

    gap = 6
    sheet = Image.new("RGB", (ref.width * 3 + gap * 2, ref.height), (0, 128, 255))
    sheet.paste(ref, (0, 0))
    sheet.paste(emu, (ref.width + gap, 0))
    sheet.paste(Image.fromarray(heat), (ref.width * 2 + gap * 2, 0))
    if args.scale != 1.0:
        sheet = sheet.resize(
            (round(sheet.width * args.scale), round(sheet.height * args.scale)), Image.LANCZOS
        )
    sheet.save(args.out)
    print(f"rows {top}..{bottom} -> {args.out} (reference | render | diff)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
