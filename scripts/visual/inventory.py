"""
Derive the V14 Cook-only screen inventory from the persisted canvas metadata.

The inventory is generated, never hand-typed, so the screen list cannot drift from the design.
Its single input is `docs/.figma-canvas-v14-434-2401.xml` — the verbatim `get_metadata` dump of
page `434:2401` ("Cook App") from file `3iYf9ckrUDZLPlJP56dyKI` ("V0_-user-app--14-").

## Scope rule

A screen counts **only if it is a direct child frame of a `SECTION` node on the Cook App page**.
The page itself is the scope boundary: the file's other page (`0:1`, "User App") is never read,
so no User App frame can reach this file. Nested component frames and loose canvas frames are
not screens.

## What is derived, and why it is not inherited from V13

Three per-frame properties decide how a frame is compared, and all three changed in V14:

  * **convention** — `bezel` frames are 390 wide and draw a decorative phone mockup inside
    themselves; `direct` frames *are* the viewport. V13's `Service flow` was bezel. V14 rebuilt
    that section as 371-wide direct frames, so inheriting the V13 profile would displace all
    thirteen Service comparisons before a single element was examined.
  * **statusBand** — the height of the status-bar mock the frame draws, which is chrome the app
    is forbidden to reproduce and which both sides of the comparison must therefore exclude.
    V14 uses three different mocks, and `Info` mixes two of them *within one section*, so the
    band is resolved per frame rather than per section.
  * **bottomNav** — V14 added a 68-unit five-tab nav to 33 of the 47 frames. It accounts for
    almost every geometry change in the carried-over screens, so it is recorded explicitly
    rather than being rediscovered as an unexplained diff.

Usage:
    python scripts/visual/inventory.py --write
"""

from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANVAS = ROOT / "docs" / ".figma-canvas-v14-434-2401.xml"
OUT = ROOT / "docs" / "visual-verification" / "v14" / "inventory.json"

#: The Cook App page. Every screen in the inventory descends from this node.
COOK_PAGE = "434:2401"

#: Frames at least this wide draw the decorative 390x830 phone bezel.
BEZEL_MIN_WIDTH = 385.0

#: Status-bar mock height for a bezel frame, in design units.
BEZEL_STATUS_BAND = 33.0

#: The `phone bar` component (`575:1743`) — a 32-unit mock whose notch island is exactly 24 units.
PHONE_BAR_STATUS_BAND = 32.0

#: The `div.w-full` mock — 36.198 units, and it draws a `#f3f4f6` hairline along its bottom edge.
HAIRLINE_STATUS_BAND = 36.198

#: Implementation order. Login first because it is unchanged and proves the harness, then the
#: carried-over sections, then the three sections V14 rebuilt or introduced.
SECTION_ORDER = [
    "Login flow",
    "log in flow",
    "leave",
    "performance",
    "job flow",
    "Service flow",
    "Info",
]

SECTION_SLUGS = {
    "Login flow": "login-flow",
    "log in flow": "log-in-flow",
    "leave": "leave",
    "performance": "performance",
    "job flow": "job-flow",
    "Service flow": "service-flow",
    "Info": "info",
}


def _num(el: ET.Element, key: str) -> float:
    return float(el.get(key) or 0.0)


def _descendants(el: ET.Element):
    for child in el:
        yield child
        yield from _descendants(child)


def _status_band(frame: ET.Element, width: float) -> tuple[float, str]:
    """
    Resolve the height of the status-bar mock this frame draws.

    Looked up on the frame's own children rather than assumed from its section, because `Info`
    mixes both direct-frame mocks: five of its six frames use the 36.198 hairline row and
    `597:1131` uses the 32-unit `phone bar`.
    """
    if width >= BEZEL_MIN_WIDTH:
        return BEZEL_STATUS_BAND, "bezel phone mockup; 33-unit mock inside the 9px border"

    for child in frame:
        name = child.get("name") or ""
        height = _num(child, "height")
        if name == "phone bar":
            return PHONE_BAR_STATUS_BAND, f"`phone bar` instance {child.get('id')} (32 units)"
        if abs(height - HAIRLINE_STATUS_BAND) < 0.01:
            return HAIRLINE_STATUS_BAND, f"`{name}` {child.get('id')} hairline row (36.198 units)"

    # An absolutely-positioned layout puts the scroll body first; the mock is still a direct child.
    for child in frame:
        for sub in (child, *_descendants(child)):
            if abs(_num(sub, "height") - HAIRLINE_STATUS_BAND) < 0.01:
                return HAIRLINE_STATUS_BAND, f"`{sub.get('name')}` {sub.get('id')} (absolute layout)"

    raise SystemExit(f"!! {frame.get('id')}: no status-bar mock found; refusing to guess")


def build() -> list[dict]:
    root = ET.parse(CANVAS).getroot()
    if root.get("id") != COOK_PAGE:
        raise SystemExit(f"!! canvas is {root.get('id')}, expected the Cook App page {COOK_PAGE}")

    rows: list[dict] = []
    for section in root:
        if section.tag != "section":
            continue
        section_name = section.get("name") or ""
        for frame in section:
            width, height = _num(frame, "width"), _num(frame, "height")
            band, band_note = _status_band(frame, width)
            has_nav = any((d.get("name") == "bottom nav") for d in _descendants(frame))
            rows.append(
                {
                    "section": section_name,
                    "sectionNodeId": section.get("id"),
                    "nodeId": frame.get("id"),
                    "name": frame.get("name"),
                    "w": round(width, 4),
                    "h": round(height, 4),
                    "convention": "bezel" if width >= BEZEL_MIN_WIDTH else "direct",
                    "statusBand": band,
                    "statusBandSource": band_note,
                    "bottomNav": has_nav,
                }
            )

    rows.sort(key=lambda r: (SECTION_ORDER.index(r["section"]), r["nodeId"]))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Write inventory.json")
    args = parser.parse_args()

    rows = build()
    by_section: dict[str, int] = {}
    for row in rows:
        by_section[row["section"]] = by_section.get(row["section"], 0) + 1

    for name in SECTION_ORDER:
        members = [r for r in rows if r["section"] == name]
        bands = sorted({r["statusBand"] for r in members})
        navs = sum(1 for r in members if r["bottomNav"])
        print(
            f"{name:14} {by_section.get(name, 0):>2} frames  "
            f"{members[0]['convention']:6} band={'/'.join(str(b) for b in bands):<14} nav={navs}/{len(members)}"
        )
    print(f"\nFINAL_V14_COOK_SCREEN_COUNT: {len(rows)}")

    if args.write:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(rows, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
