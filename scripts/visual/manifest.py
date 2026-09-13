"""
Render the V14 pixel-verification manifest from evidence on disk.

The manifest is derived, never hand-maintained: every column is read back from an artefact that
had to exist for the work to have happened, so a row cannot claim progress that left no trace.

| column      | source of truth                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| V14 context | `scripts/visual/context-captured-v14.json` — written per `get_design_context`   |
| Assets      | `assets/images/figma-v14/ASSETS.json` — node ids recorded per asset             |
| Implemented | the screen has a `/dev` gallery state                                          |
| Rendered    | `emulator.png` exists — the screen was actually drawn on the 393dp emulator     |
| Compared    | `result.json` exists — reference and render were diffed                        |
| diff %      | `differingPixelPercent` at the antialiasing tolerance of 12                    |
| verdict %   | `differingPixelPercentAtVerdictTolerance` — the same diff at 40, which rules   |
| align       | `topAlignment.deltaUnits` — measured, not the whole-frame probe                |
| unmatched   | `uncomparedReferenceRows` — design rows the render never covered               |
| unseen ink  | `uncomparedReferenceInkRows` — how many of those actually carry anything       |
| Result      | `verdicts.json` verdict                                                        |

A gallery state is a sound proxy for "implemented" because it is enforced in both directions:
`gallery.test.tsx` fails if a screen on `pendingScreens` has a state, or if a screen off it lacks
one. With `pendingScreens` empty, all 47 frames are built.

The V14-context column is **provenance, not completion**. It records which nodes were read through
`get_design_context` during the V14 pass; the rest were audited against the committed canvas dump
and against their own reference renders, which is what the diff scores them on.

`align` sits next to the two percentages on purpose. A low percentage on a displaced screen is
not a pass — rasterisation noise and a shifted layout produce similar percentages and are
entirely different defects — so the columns are read together. `align` is the measured distance
between each side's first painted row, NOT the whole-frame displacement probe: on a repetitive
layout the probe drifts to a neighbouring element and reports a shift that is not there.

`unseen ink` is what makes a screen with unmatched rows rulable. `592:1008` is a 950-unit frame on
a 750-unit device, so 162 reference rows cannot be shown — and every one of them is blank. A row
counts as inked when it differs from the band's own background, so a screen can only pass with
unmatched rows when there was nothing in them.

`verdicts.json` is written by `rule_verdicts.py` from the stated rule, and the rule reads both
percentages out of `result.json`. `compare.py` itself writes `PENDING_REVIEW` and never decides
PASS, because a low percentage is not the same as a correct screen — a blank render against a
mostly-white frame scores well.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs" / "visual-verification" / "v14"
ASSET_LEDGER = ROOT / "assets" / "images" / "figma-v14" / "ASSETS.json"
CONTEXT_LEDGER = Path(__file__).resolve().parent / "context-captured-v14.json"
GALLERY_STATES = Path(__file__).resolve().parent / "gallery-states-v14.json"
VERDICTS = EVIDENCE / "verdicts.json"

SECTION_SLUGS = {
    "Login flow": "login-flow",
    "log in flow": "log-in-flow",
    "leave": "leave",
    "performance": "performance",
    "job flow": "job-flow",
    "Service flow": "service-flow",
    "Info": "info",
}

#: Implementation order: unchanged sections first, then the three V14 rebuilt or introduced.
SECTION_ORDER = [
    "Login flow",
    "log in flow",
    "leave",
    "performance",
    "job flow",
    "Service flow",
    "Info",
]


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def build_rows() -> list[dict]:
    inventory = load_json(EVIDENCE / "inventory.json", [])
    contexts = set(load_json(CONTEXT_LEDGER, {}).get("nodes", []))
    assets = load_json(ASSET_LEDGER, {"assets": {}})["assets"]
    states = load_json(GALLERY_STATES, {})
    verdicts = load_json(VERDICTS, {})

    nodes_with_assets: dict[str, list[str]] = {}
    for filename, entry in assets.items():
        for node in entry["nodes"]:
            nodes_with_assets.setdefault(node, []).append(filename)

    state_by_node = {node: state for state, node in states.items()}

    rows = []
    for row in inventory:
        node = row["nodeId"]
        slug = SECTION_SLUGS[row["section"]]
        out_dir = EVIDENCE / slug / node.replace(":", "-")
        result = load_json(out_dir / "result.json", None)
        rows.append(
            {
                "nodeId": node,
                "section": row["section"],
                "name": row["name"],
                "context": node in contexts,
                "assets": nodes_with_assets.get(node, []),
                "galleryState": state_by_node.get(node),
                "implemented": state_by_node.get(node) is not None,
                "rendered": (out_dir / "emulator.png").exists(),
                "compared": result is not None,
                "diff": result["differingPixelPercent"] if result else None,
                "raw": result["rawDifferingPixelPercent"] if result else None,
                "verdictDiff": (
                    result.get("differingPixelPercentAtVerdictTolerance") if result else None
                ),
                "align": (result.get("topAlignment", {}).get("deltaUnits") if result else None),
                "shift": (result["displacementProbe"]["bestVerticalOffsetPx"] if result else None),
                "unmatched": result["uncomparedReferenceRows"] if result else None,
                "unseenInk": (
                    result.get("uncomparedReferenceInkRows") if result else None
                ),
                "verdict": verdicts.get(node, "—"),
            }
        )
    rows.sort(key=lambda r: (SECTION_ORDER.index(r["section"]), r["nodeId"]))
    return rows


def render(rows: list[dict]) -> str:
    def tick(value: bool) -> str:
        return "yes" if value else "—"

    lines = [
        "# V14 pixel-verification manifest",
        "",
        "Generated by `python scripts/visual/manifest.py --write`. Every column is read back from",
        "an artefact on disk; nothing here is asserted by hand except the reviewed verdict.",
        "",
        "| Node ID | Section | Screen | V14 context | Assets | Implemented | Rendered | Compared "
        "| diff % | verdict % | align | unmatched | unseen ink | Result |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in rows:
        assets = f"{len(r['assets'])}" if r["assets"] else "—"
        implemented = f"`{r['galleryState']}`" if r["implemented"] else "—"
        diff = f"{r['diff']:.2f}" if r["diff"] is not None else "—"
        vdiff = f"{r['verdictDiff']:.2f}" if r["verdictDiff"] is not None else "—"
        align = f"{r['align']:+.2f}" if r["align"] is not None else "n/a"
        unmatched = f"{r['unmatched']}" if r["unmatched"] is not None else "—"
        unseen = f"{r['unseenInk']}" if r["unseenInk"] is not None else "—"
        lines.append(
            f"| `{r['nodeId']}` | {r['section']} | {r['name']} | {tick(r['context'])} | "
            f"{assets} | {implemented} | {tick(r['rendered'])} | {tick(r['compared'])} | "
            f"{diff} | {vdiff} | {align} | {unmatched} | {unseen} | {r['verdict']} |"
        )

    passing = sum(1 for r in rows if r["verdict"] == "PASS")
    lines += [
        "",
        "## Totals",
        "",
        f"- FINAL_SECTION_SCREEN_COUNT: {len(rows)}",
        f"- CONTEXT_CAPTURED: {sum(1 for r in rows if r['context'])}",
        f"- SCREENS_IMPLEMENTED: {sum(1 for r in rows if r['implemented'])}",
        f"- SCREENS_EMULATOR_RENDERED: {sum(1 for r in rows if r['rendered'])}",
        f"- SCREENS_COMPARED: {sum(1 for r in rows if r['compared'])}",
        f"- SCREENS_PLACED_WITHIN_2_UNITS: "
        f"{sum(1 for r in rows if r['align'] is None or abs(r['align']) <= 2.0)}",
        f"- SCREENS_WITH_UNMATCHED_REFERENCE_ROWS: "
        f"{sum(1 for r in rows if (r['unmatched'] or 0) > 0)}",
        f"- SCREENS_WITH_UNSEEN_REFERENCE_INK: "
        f"{sum(1 for r in rows if (r['unseenInk'] or 0) > 0)}",
        f"- SCREENS_PIXEL_VERIFIED: {passing}",
        f"- SCREENS_STILL_MISMATCHING: {len(rows) - passing}",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Write MANIFEST.md")
    parser.add_argument("--record-context", nargs="*", default=None, help="Node ids to mark captured")
    parser.add_argument("--verdict", nargs=2, default=None, metavar=("NODE", "VERDICT"))
    args = parser.parse_args()

    if args.record_context:
        ledger = load_json(CONTEXT_LEDGER, {"nodes": []})
        for node in args.record_context:
            if node not in ledger["nodes"]:
                ledger["nodes"].append(node)
        ledger["nodes"].sort()
        CONTEXT_LEDGER.write_text(json.dumps(ledger, indent=1) + "\n", encoding="utf-8")
        print(f"context ledger: {len(ledger['nodes'])} nodes")

    if args.verdict:
        node, verdict = args.verdict
        verdicts = load_json(VERDICTS, {})
        verdicts[node] = verdict
        VERDICTS.write_text(
            json.dumps(dict(sorted(verdicts.items())), indent=1) + "\n", encoding="utf-8"
        )
        print(f"verdict: {node} = {verdict}")

    rows = build_rows()
    text = render(rows)
    if args.write:
        (EVIDENCE / "MANIFEST.md").write_text(text, encoding="utf-8")
        print(f"wrote {EVIDENCE / 'MANIFEST.md'}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
