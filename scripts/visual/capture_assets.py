"""
Download the original bytes of Figma V13 assets referenced by a screen's design context.

`get_design_context` returns remote asset URLs that expire in ~7 days, so every URL must be
fetched during the same screen pass that produced it. This script does that, deduplicates by
content hash (the Spoon logo is referenced by five separate Login-flow frames but is one file),
and records provenance so a later reader can prove which node each byte came from.

Usage:
    python scripts/visual/capture_assets.py --node 434:3116 name=url [name=url ...]

Writes into assets/images/figma-v13/ and updates assets/images/figma-v13/ASSETS.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "assets" / "images" / "figma-v13"
LEDGER = ASSET_DIR / "ASSETS.json"


def slugify(name: str) -> str:
    """`imgLogoVariantYellow11` -> `logo-variant-yellow-1-1`."""
    name = re.sub(r"^img", "", name)
    name = re.sub(r"(?<!^)(?=[A-Z])", "-", name)
    name = re.sub(r"(?<=[a-zA-Z])(?=\d)", "-", name)
    name = re.sub(r"[^A-Za-z0-9]+", "-", name)
    return re.sub(r"-+", "-", name).strip("-").lower()


def load_ledger() -> dict:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"assets": {}}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", required=True)
    parser.add_argument("pairs", nargs="+", help="constName=https://...")
    args = parser.parse_args()

    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    ledger = load_ledger()
    by_hash = {v["sha256"]: k for k, v in ledger["assets"].items()}

    for pair in args.pairs:
        const, _, url = pair.partition("=")
        if not url.startswith("http"):
            print(f"!! skipping malformed pair: {pair[:60]}")
            continue
        # curl, not urllib: figma.com's asset CDN answers urllib with a 200 and an empty body,
        # so a urllib fetch silently writes a 0-byte "asset". curl returns the real bytes.
        result = subprocess.run(
            ["curl", "-sSL", "--fail", "--max-time", "120", url],
            capture_output=True,
            check=False,
        )
        body = result.stdout
        if result.returncode != 0 or not body:
            print(f"!! {const}: download failed - rc={result.returncode} {result.stderr[:120]!r}")
            continue

        digest = hashlib.sha256(body).hexdigest()
        ext = ".svg" if body.lstrip()[:5].lower().startswith(b"<svg") or url.endswith(".svg") else ".png"

        existing = by_hash.get(digest)
        if existing:
            entry = ledger["assets"][existing]
            if args.node not in entry["nodes"]:
                entry["nodes"].append(args.node)
            print(f"== {const:34} identical to {existing} (reused)")
            continue

        filename = f"{slugify(const)}{ext}"
        counter = 2
        while filename in ledger["assets"]:
            filename = f"{slugify(const)}-{counter}{ext}"
            counter += 1

        (ASSET_DIR / filename).write_bytes(body)
        ledger["assets"][filename] = {
            "sha256": digest,
            "bytes": len(body),
            "constName": const,
            "nodes": [args.node],
        }
        by_hash[digest] = filename
        print(f"ok {const:34} -> {filename} ({len(body) // 1024}KB, {ext[1:]})")

    LEDGER.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"\nledger: {len(ledger['assets'])} unique assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
