"""
Measure where each render's first painted row sits against its reference's, and record it.

## Why the displacement probe is not enough

`compare.py` finds the vertical offset that minimises the difference over the whole frame. On a
screen of repeated elements that is not the same question as "is this screen in the right place":
a `job flow` list repeats a card every ~108 units, so shifting by 10 can improve the local match
against a neighbouring card's edge and the probe reports `-10` for a screen whose first row is
exactly where it belongs. Every one of the 26 screens ruled OPEN in the first pass carried a
non-zero probe offset, and all of them measure within **0.8 design units** here.

So this measures the thing directly: the first row either side that has ink on it, converted to
design units, after each side's system chrome is removed. It is a blunt instrument — it says
nothing about what happens further down the screen — but it is unambiguous about the one thing the
probe was being read for, and the two together separate "misplaced" from "different".

Usage:
    python scripts/visual/alignment.py            # all screens
    python scripts/visual/alignment.py --write    # also merge into each result.json
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

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs" / "visual-verification" / "v14"

SECTION_SLUGS = {
    "Login flow": "login-flow",
    "log in flow": "log-in-flow",
    "leave": "leave",
    "performance": "performance",
    "job flow": "job-flow",
    "Service flow": "service-flow",
    "Info": "info",
}

#: Mirrors `compare.py`. The emulator's own bars are not application content.
EMULATOR_STATUS_PX = 136
EMULATOR_NAV_PX = 66

#: A row counts as painted when more than this many pixels differ from white by more than the
#: channel threshold. Three pixels rejects a stray antialiased corner without needing a real
#: element to be wide.
MIN_INK_PIXELS = 3
INK_THRESHOLD = 25


def first_ink_row(image: Image.Image, start: int) -> int | None:
    array = np.asarray(image).astype(int)
    for y in range(start, image.height):
        if (np.abs(array[y] - 255).max(axis=1) > INK_THRESHOLD).sum() > MIN_INK_PIXELS:
            return y
    return None


def measure(row: dict) -> dict | None:
    # A `bezel` frame draws a decorative phone mockup around the viewport, so its first painted row
    # is the bezel's own border, not design content -- the measure would compare that edge against
    # the app's first element and report ~30 units on a screen that is correct. Those five frames
    # are ruled on their residual alone, which for `Login flow` is 0.18-1.68% at tolerance 40.
    if row.get("convention") == "bezel":
        return {"notApplicable": "bezel frame; first ink is the phone mockup's border"}

    out = EVIDENCE / SECTION_SLUGS[row["section"]] / row["nodeId"].replace(":", "-")
    reference, render = out / "figma.png", out / "emulator.png"
    if not (reference.exists() and render.exists()):
        return None

    ref = Image.open(reference).convert("RGB")
    emu = Image.open(render).convert("RGB")

    # The frame is LOCATED in its render, exactly as `compare.py` locates it. Dividing the render's
    # width by the frame's instead treats the effect margin as part of the frame, which is worth
    # about half a design unit here — and half a unit is the whole size of the number this
    # measures, so the two must not derive it separately.
    crop = figma_viewport_crop(
        row["section"],
        float(row["w"]),
        float(row["h"]),
        ref.width,
        ref.height,
        np.asarray(ref).astype(int),
        row["convention"],
    )
    ref_scale = crop.scale
    emu_scale = emu.width / float(row["w"])

    band = crop.top + row["statusBand"] * ref_scale
    ref_y = first_ink_row(ref, int(band))
    emu_y = first_ink_row(emu, EMULATOR_STATUS_PX)
    if ref_y is None or emu_y is None:
        return None

    ref_units = (ref_y - band) / ref_scale
    emu_units = (emu_y - EMULATOR_STATUS_PX) / emu_scale
    return {
        "referenceFirstInkUnits": round(ref_units, 2),
        "renderFirstInkUnits": round(emu_units, 2),
        "deltaUnits": round(emu_units - ref_units, 2),
        "note": (
            "Design units between each side's first painted row and the first row the application "
            "owns. Read WITH displacementProbe, never instead of it: the probe optimises over the "
            "whole frame and drifts to a neighbouring element on a repetitive layout, so a "
            "non-zero probe offset with a delta near zero means the screen is placed correctly and "
            "differs in its content."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Merge into each result.json")
    args = parser.parse_args()

    inventory = json.loads((EVIDENCE / "inventory.json").read_text(encoding="utf-8"))
    worst = 0.0
    missing = 0
    print(f"{'node':12} {'section':13} {'ref':>8} {'render':>8} {'delta':>8}")
    for row in inventory:
        found = measure(row)
        if found is None:
            missing += 1
            continue
        if "notApplicable" in found:
            print(f"{row['nodeId']:12} {row['section']:13} {'— bezel frame, not measured':>28}")
            if args.write:
                out = EVIDENCE / SECTION_SLUGS[row["section"]] / row["nodeId"].replace(":", "-")
                rp = out / "result.json"
                if rp.exists():
                    result = json.loads(rp.read_text(encoding="utf-8"))
                    result["topAlignment"] = found
                    rp.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
            continue
        worst = max(worst, abs(found["deltaUnits"]))
        print(
            f"{row['nodeId']:12} {row['section']:13} "
            f"{found['referenceFirstInkUnits']:8.2f} {found['renderFirstInkUnits']:8.2f} "
            f"{found['deltaUnits']:+8.2f}"
        )
        if args.write:
            out = EVIDENCE / SECTION_SLUGS[row["section"]] / row["nodeId"].replace(":", "-")
            result_path = out / "result.json"
            if result_path.exists():
                result = json.loads(result_path.read_text(encoding="utf-8"))
                result["topAlignment"] = found
                result_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    print(f"\nworst absolute delta: {worst:.2f} design units")
    if missing:
        print(f"not measured: {missing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
