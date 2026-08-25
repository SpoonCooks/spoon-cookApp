"""
Re-verify the V14 asset ledger against the bytes on disk.

Every image and vector the app ships came out of the authoritative Figma file, and
`assets/images/figma-v14/ASSETS.json` records for each one the Figma nodes that reference it, its
size in bytes and its SHA-256. That ledger is only worth anything if it is checked: a file
replaced by hand, an asset borrowed from V12 or V13 because it "looks the same", or a download
truncated by a flaky connection would all leave the ledger reading correct while the app drew
something the design never exported.

So this asserts three things, and names whichever one fails:

  * every ledger entry has a file, and its SHA-256 and byte count are the recorded ones;
  * every file in the directory has a ledger entry, so nothing can be added without provenance;
  * every entry names at least one Figma node, so an orphan cannot accumulate.

Usage:
    python scripts/visual/verify_assets.py
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "assets" / "images" / "figma-v14"
LEDGER = ASSET_DIR / "ASSETS.json"


def main() -> int:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))["assets"]
    on_disk = {p.name for p in ASSET_DIR.iterdir() if p.name != LEDGER.name}

    failures: list[str] = []
    for name, entry in sorted(ledger.items()):
        path = ASSET_DIR / name
        if not path.exists():
            failures.append(f"{name}: ledgered but not on disk")
            continue
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if digest != entry["sha256"]:
            failures.append(f"{name}: sha256 {digest[:16]} != ledger {entry['sha256'][:16]}")
        if len(raw) != entry["bytes"]:
            failures.append(f"{name}: {len(raw)} bytes != ledger {entry['bytes']}")
        if not entry.get("nodes"):
            failures.append(f"{name}: no Figma node recorded")

    for name in sorted(on_disk - set(ledger)):
        failures.append(f"{name}: on disk with no ledger entry")

    print(f"ledger entries {len(ledger)}   files on disk {len(on_disk)}")
    for line in failures:
        print(f"  !! {line}")
    print("ASSET_PROVENANCE_COMPLETE" if not failures else f"FAILURES {len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
