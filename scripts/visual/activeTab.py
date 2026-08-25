"""
Report which bottom-nav destination each V14 frame highlights, measured from its reference render.

## Why this is measured rather than assumed

The active tab decides what the development gallery must draw for 33 of the 47 frames, and a
wrong answer is invisible in review: the bar is present, the right height, and in the right
place — only the `#ffef99` pill sits under the wrong glyph. Guessing it from the section name
would be an assumption dressed as a fact, so the pill is read out of the committed reference PNG
instead.

## How the sample points are derived

`BottomNav` and the design agree on the bar's geometry (`634:2478`): 68 units tall, an 8-unit
vertical padding around a 52-unit row, 16 units of outer padding and 4 of inner, then five
58-wide tabs separated by 10-unit gaps. So on a frame of height `h`:

    tab i centre x = 16 + 4 + i*(58 + 10) + 29 = 49 + i*68
    tab centre y   = (h - 68) + 8 + 26        = h - 34

Each centre is sampled at eight points offset 20-22 units horizontally and 14 vertically, which
lands on the pill's field rather than the glyph or the label — a glyph is dark and would read as
"not active" wherever it happens to cover the exact centre.

Usage:
    python scripts/visual/activeTab.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
INVENTORY = ROOT / "docs" / "visual-verification" / "v14" / "inventory.json"
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

#: The five destinations, in the order V14 draws them left to right.
TABS = ("hazri", "kaam", "chutti", "kamai", "niyam")

#: `634:2484` — the active destination's pill.
ACTIVE_FILL = (255, 239, 153)

#: Per-channel slack, for the reference render's own resampling.
CHANNEL_TOLERANCE = 10


def is_active_fill(pixel: tuple[int, int, int]) -> bool:
    return all(abs(pixel[i] - ACTIVE_FILL[i]) <= CHANNEL_TOLERANCE for i in range(3))


def active_tab(image: Image.Image, frame_w: float, frame_h: float) -> list[str]:
    scale = image.width / frame_w
    y = int(round((frame_h - 34) * scale))
    hits = []
    for index, tab in enumerate(TABS):
        x = int(round((49 + index * 68) * scale))
        samples = [
            image.getpixel(
                (
                    min(max(x + dx, 0), image.width - 1),
                    min(max(y + dy, 0), image.height - 1),
                )
            )
            for dx in (-22, -20, 20, 22)
            for dy in (-14, 14)
        ]
        if any(is_active_fill(p) for p in samples):
            hits.append(tab)
    return hits


def main() -> int:
    rows = json.loads(INVENTORY.read_text(encoding="utf-8"))
    failures = 0
    for row in rows:
        if not row["bottomNav"]:
            continue
        path = (
            EVIDENCE
            / SECTION_SLUGS[row["section"]]
            / row["nodeId"].replace(":", "-")
            / "figma.png"
        )
        if not path.exists():
            print(f"!! {row['nodeId']}: no reference render at {path.relative_to(ROOT)}")
            failures += 1
            continue
        hits = active_tab(Image.open(path).convert("RGB"), row["w"], row["h"])
        # Exactly one destination may be highlighted. Zero means the sample points missed the bar
        # (a geometry change); more than one means the pill was matched against something else.
        if len(hits) != 1:
            print(f"!! {row['nodeId']:12} {row['name'][:26]:28} -> {hits or 'NONE'}")
            failures += 1
            continue
        print(f"ok {row['nodeId']:12} {row['section']:13} {row['name'][:26]:28} -> {hits[0]}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
