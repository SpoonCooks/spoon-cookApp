"""
Write `verdicts.json` from the measured evidence, by a stated rule.

## Why a percentage alone cannot decide a verdict

`differingPixelPercent` is not comparable between screens. It counts differing pixels over the
compared area, and every element edge and glyph edge contributes — so ink density dominates it.
`434:3330` is a near-flat splash and scores 0.55%; `603:1924` is a dense tariff table covering most
of its sheet and scores 31.67% with its colours sampling identical to the reference and its sheet
height matching to 0.4 of a design unit.

## The discriminator

Every screen is scored at two tolerances in one pass: the reporting tolerance of 12, which
absorbs antialiasing, and the verdict tolerance of 40. `compare.py` writes both into each
`result.json`, so this file READS them rather than carrying a copy.

A residual that is rasterisation collapses when the tolerance widens — the differing pixels are
edge pixels a few levels apart. A residual that is a real difference (a wrong fill, a missing
element, a displaced block) does not collapse, because those pixels differ by far more than 40.

The 47 verdict figures used to live here as a hand-pasted table from a second scoring run. That
made a verdict stale the moment a screen was re-rendered, with nothing in the artefact to say so.

So the rule is:

    PASS  — tolerance-40 residual <= 10% AND |displacement| <= 2
    OPEN  — anything else, with the reason named

Both numbers are recorded per screen so the ruling can be re-derived rather than taken on trust.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[0]
EVIDENCE = Path("docs/visual-verification/v14")

SLUG = {
    "Login flow": "login-flow", "log in flow": "log-in-flow", "leave": "leave",
    "performance": "performance", "job flow": "job-flow",
    "Service flow": "service-flow", "Info": "info",
}

inventory = json.loads((EVIDENCE / "inventory.json").read_text(encoding="utf-8"))
verdicts, notes, rows = {}, {}, []

for row in inventory:
    node = row["nodeId"]
    out = EVIDENCE / SLUG[row["section"]] / node.replace(":", "-")
    result = json.loads((out / "result.json").read_text(encoding="utf-8"))
    shift = result["displacementProbe"]["bestVerticalOffsetPx"]
    delta = result.get("topAlignment", {}).get("deltaUnits")
    d12 = result["differingPixelPercent"]
    d40 = result["differingPixelPercentAtVerdictTolerance"]
    # Placement is judged by the MEASURED first-ink delta, not the probe: the probe optimises over
    # the whole frame and drifts to a neighbouring element on a repetitive layout. A bezel frame
    # has no usable delta (its first ink is the phone mockup), so it is ruled on residual alone.
    placed = True if delta is None else abs(delta) <= 2.0
    passing = d40 <= 10.0 and placed
    verdicts[node] = "PASS" if passing else "OPEN"
    rows.append((node, row["section"], row["name"], d12, d40, shift, verdicts[node], delta))

(EVIDENCE / "verdicts.json").write_text(
    json.dumps(dict(sorted(verdicts.items())), indent=1) + "\n", encoding="utf-8"
)

p = sum(1 for r in rows if r[6] == "PASS")
print(f"PASS {p}/47   OPEN {47 - p}/47\n")
for node, section, name, d12, d40, shift, v, delta in sorted(rows, key=lambda r: (r[6], -r[4])):
    print(f"{v:5} {node:12} {section:13} {name[:24]:26} t12={d12:6.2f} t40={d40:6.2f} probe={shift:+3d} align={(delta if delta is not None else 0.0):+5.2f}")
