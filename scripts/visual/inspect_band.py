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

import json

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import SECTION_SLUGS, aligned_views  # noqa: E402


def inventory_row(inventory: Path, node_id: str) -> dict:
    """The one inventory row for a node, which carries its convention, band and nav flag."""
    rows = json.loads(inventory.read_text(encoding="utf-8"))
    for row in rows:
        if row["nodeId"] == node_id:
            return row
    raise SystemExit(f"{node_id} is not in {inventory}")


def evidence_dir(root: Path, row: dict) -> Path:
    return root / SECTION_SLUGS[row["section"]] / row["nodeId"].replace(":", "-")


def aligned_pair(inventory: Path, root: Path, node_id: str) -> tuple[Image.Image, Image.Image]:
    """Exactly the pair `compare.py` scores, for the same node."""
    row = inventory_row(inventory, node_id)
    d = evidence_dir(root, row)
    pair = aligned_views(
        d / "figma.png",
        d / "emulator.png",
        row,
        row["section"],
        row["nodeId"],
        float(row["w"]),
        float(row["h"]),
    )
    return pair.reference, pair.render


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--root", default="docs/visual-verification/v14")
    parser.add_argument("--node", required=True)
    parser.add_argument("--top", type=int, required=True, help="first row of the band")
    parser.add_argument("--height", type=int, default=60)
    parser.add_argument("--zoom", type=int, default=3)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    reference, scaled = aligned_pair(Path(args.inventory), Path(args.root), args.node)
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
