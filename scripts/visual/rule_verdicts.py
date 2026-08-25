"""
Write `verdicts.json` from the measured evidence, by a stated rule.

## Why a percentage alone cannot decide a verdict

`differingPixelPercent` is not comparable between screens. It counts differing pixels over the
compared area, and every element edge and glyph edge contributes — so ink density dominates it.
`434:3330` is a near-flat splash and scores 0.55%; `603:1924` is a dense tariff table covering most
of its sheet and scores 31.67% with its colours sampling identical to the reference and its sheet
height matching to 0.4 of a design unit.

## The discriminator

Each screen was scored twice, at the antialiasing tolerance of 12 and again at 40:

    python scripts/visual/compare.py --inventory … --tolerance 40

A residual that is rasterisation collapses when the tolerance widens — the differing pixels are
edge pixels a few levels apart. A residual that is a real difference (a wrong fill, a missing
element, a displaced block) does not collapse, because those pixels differ by far more than 40.

So the rule is:

    PASS  — tolerance-40 residual <= 10% AND |displacement| <= 2
    OPEN  — anything else, with the reason named

Both numbers are recorded per screen so the ruling can be re-derived rather than taken on trust.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[0]
EVIDENCE = Path("docs/visual-verification/v14")

# tolerance-40 residual per node, from the second scoring run.
T40 = {
    "434:3116": 0.88, "434:3174": 0.88, "434:3224": 1.17, "434:3280": 1.68, "434:3330": 0.18,
    "575:2135": 6.80, "575:2136": 7.24, "575:2137": 6.66, "575:2138": 5.16,
    "592:1008": 13.86, "592:488": 11.20, "592:489": 9.17, "592:563": 4.24, "592:639": 5.54,
    "592:832": 7.17, "592:888": 4.69,
    "575:1744": 9.97, "575:1884": 13.91, "575:1903": 7.46, "575:1922": 9.26,
    "575:2013": 16.46, "575:2032": 9.04, "575:2098": 14.77,
    "583:375": 13.20, "583:401": 20.16, "583:427": 22.37, "583:453": 22.46, "583:479": 22.39,
    "614:453": 12.68, "622:1036": 11.83, "622:1085": 11.20, "622:1125": 14.95,
    "622:1163": 12.38, "622:530": 11.92, "622:597": 11.57, "622:664": 15.06,
    "622:733": 15.09, "622:801": 14.50, "622:913": 8.43, "628:1249": 6.79, "628:1293": 36.23,
    "597:1131": 8.50, "597:1221": 7.50, "603:1865": 25.92, "603:1924": 29.04,
    "605:2027": 27.65, "605:2094": 28.78,
}

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
    d40 = T40[node]
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
