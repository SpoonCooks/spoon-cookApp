"""
Rank the V14 comparisons by how much they still disagree with the design.

A pixel run produces 47 `result.json` files, and reading them in inventory order buries the two
screens that are actually wrong under forty-five that are not. This orders them by severity so a
review starts where the evidence is worst, and it prints the three numbers that distinguish the
failure modes from each other:

  * **diff %** — how much of the compared area differs beyond the antialiasing tolerance.
  * **shift** — the vertical offset that minimises that difference. Zero means the render is on
    its design row and the residual is rasterisation; anything else is a layout error even when
    the percentage is low, which is exactly the case a headline percentage hides.
  * **unmatched** — reference rows the render never covered, because the emulator supplies less
    height than the design frame or a scroll stopped early. These are excluded from the
    denominator, so a screen can score well precisely because a third of it went unscored.

`worst` names the single worst row band, which is usually enough to say *where* a screen fails
without opening the image.

Usage:
    python scripts/visual/triage.py            # all screens, worst first
    python scripts/visual/triage.py --limit 10
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=0, help="Show only the worst N")
    parser.add_argument("--root", default=str(EVIDENCE))
    args = parser.parse_args()

    root = Path(args.root)
    inventory = json.loads((root / "inventory.json").read_text(encoding="utf-8"))

    rows = []
    missing = []
    for row in inventory:
        out = root / SECTION_SLUGS[row["section"]] / row["nodeId"].replace(":", "-")
        result_path = out / "result.json"
        if not result_path.exists():
            missing.append(row["nodeId"])
            continue
        result = json.loads(result_path.read_text(encoding="utf-8"))
        worst = max(result["worstRows"], key=lambda r: r["percent"], default=None)
        rows.append(
            {
                "node": row["nodeId"],
                "section": row["section"],
                "name": row["name"],
                "diff": result["differingPixelPercent"],
                "shift": result["displacementProbe"]["bestVerticalOffsetPx"],
                "atBest": result["displacementProbe"]["percentAtBestOffset"],
                "unmatched": result["uncomparedReferenceRows"],
                "compared": result["comparedHeightPx"],
                "worstRow": worst["row"] if worst else None,
                "worstPct": worst["percent"] if worst else None,
            }
        )

    # Severity: a displaced screen outranks a noisy one at the same percentage, and unscored
    # reference rows outrank both — an unscored row is not a passing row, it is an absent one.
    rows.sort(
        key=lambda r: (
            r["unmatched"] > 0,
            abs(r["shift"]) > 0,
            r["diff"],
        ),
        reverse=True,
    )

    print(
        f"{'node':12} {'section':13} {'screen':26} {'diff%':>7} {'shift':>6} "
        f"{'best%':>7} {'unmatch':>8} {'worstRow':>9} {'worst%':>7}"
    )
    shown = rows[: args.limit] if args.limit else rows
    for r in shown:
        print(
            f"{r['node']:12} {r['section']:13} {r['name'][:26]:26} {r['diff']:7.2f} "
            f"{r['shift']:+6d} {r['atBest'] if r['atBest'] is not None else -1:7.2f} "
            f"{r['unmatched']:8d} {str(r['worstRow']):>9} {r['worstPct']:7.2f}"
        )

    print()
    print(f"compared: {len(rows)}/{len(inventory)}")
    if missing:
        print(f"NOT COMPARED ({len(missing)}): {', '.join(missing)}")
    print(f"shift == 0:            {sum(1 for r in rows if r['shift'] == 0)}")
    print(f"unmatched rows == 0:   {sum(1 for r in rows if r['unmatched'] == 0)}")
    print(f"diff <= 2%:            {sum(1 for r in rows if r['diff'] <= 2.0)}")
    print(f"diff <= 5%:            {sum(1 for r in rows if r['diff'] <= 5.0)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
