"""
Save Figma reference renders into the V14 evidence tree.

`get_screenshot` returns a short-lived URL per node; this writes those bytes to
`docs/visual-verification/v14/<section-slug>/<node-id>/figma.png`, resolving the slug from
`inventory.json` so a reference can never land in the wrong section's folder.

Usage:
    python scripts/visual/fetch_reference.py 434:3116=https://... [node=url ...]
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

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


def main() -> int:
    rows = {r["nodeId"]: r for r in json.loads(INVENTORY.read_text(encoding="utf-8"))}
    failures = 0
    for pair in sys.argv[1:]:
        node, _, url = pair.partition("=")
        row = rows.get(node)
        if row is None:
            print(f"!! {node}: not in the V14 inventory")
            failures += 1
            continue
        out = EVIDENCE / SECTION_SLUGS[row["section"]] / node.replace(":", "-")
        out.mkdir(parents=True, exist_ok=True)
        # curl, not urllib: figma.com's asset CDN answers urllib with a 200 and an empty body.
        result = subprocess.run(
            ["curl", "-sSL", "--fail", "--max-time", "120", url],
            capture_output=True,
            check=False,
        )
        if result.returncode != 0 or not result.stdout:
            print(f"!! {node}: download failed rc={result.returncode}")
            failures += 1
            continue
        (out / "figma.png").write_bytes(result.stdout)
        print(f"ok {node:12} -> {out.relative_to(ROOT)}/figma.png ({len(result.stdout)//1024}KB)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
