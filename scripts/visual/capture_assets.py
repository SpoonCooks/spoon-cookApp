"""
Download the original bytes of Figma assets referenced by a screen's design context.

`get_design_context` returns remote asset URLs that expire in ~7 days, so every URL must be
fetched during the same screen pass that produced it. This script does that, deduplicates by
content hash (the Spoon logo is referenced by five separate Login-flow frames but is one file),
and records provenance so a later reader can prove which node each byte came from.

Usage:
    python scripts/visual/capture_assets.py --node 622:1163 name=url [name=url ...]
    python scripts/visual/capture_assets.py --version v13 --node 434:3116 name=url

Writes into assets/images/figma-<version>/ and updates that directory's ASSETS.json. The
version defaults to the current design revision, `v14`; the `v13` tree is kept intact so its
evidence stays readable rather than being overwritten in place.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

#: Current design revision. `v13` remains on disk so its evidence stays readable.
DEFAULT_VERSION = "v14"


def asset_dir(version: str) -> Path:
    return ROOT / "assets" / "images" / f"figma-{version}"


def slugify(name: str) -> str:
    """`imgLogoVariantYellow11` -> `logo-variant-yellow-1-1`."""
    name = re.sub(r"^img", "", name)
    name = re.sub(r"(?<!^)(?=[A-Z])", "-", name)
    name = re.sub(r"(?<=[a-zA-Z])(?=\d)", "-", name)
    name = re.sub(r"[^A-Za-z0-9]+", "-", name)
    return re.sub(r"-+", "-", name).strip("-").lower()


def load_ledger(ledger: Path) -> dict:
    if ledger.exists():
        return json.loads(ledger.read_text(encoding="utf-8"))
    return {"assets": {}}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", required=True)
    parser.add_argument("--version", default=DEFAULT_VERSION, help="design revision, e.g. v14")
    parser.add_argument("pairs", nargs="+", help="constName=https://...")
    args = parser.parse_args()

    directory = asset_dir(args.version)
    ledger_path = directory / "ASSETS.json"
    directory.mkdir(parents=True, exist_ok=True)
    ledger = load_ledger(ledger_path)
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

        (directory / filename).write_bytes(body)
        ledger["assets"][filename] = {
            "sha256": digest,
            "bytes": len(body),
            "constName": const,
            "nodes": [args.node],
        }
        by_hash[digest] = filename
        print(f"ok {const:34} -> {filename} ({len(body) // 1024}KB, {ext[1:]})")

    ledger_path.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"\nledger: {len(ledger['assets'])} unique assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
