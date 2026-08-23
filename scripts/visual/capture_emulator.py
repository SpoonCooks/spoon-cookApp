"""
Capture an emulator screenshot for every reachable V13 gallery state.

Deep-links into `spooncook://dev/<state>`, waits for the render to settle, and writes
`emulator.png` into `docs/visual-verification/v13/<section>/<node-id>/`.

Requires: the debug APK installed, Metro serving, `adb reverse tcp:8081 tcp:8081` in place.

The wait is a fixed settle delay rather than a readiness probe because the gallery draws no
chrome of its own — there is no marker element to poll for that would not also pollute the
screenshot. The delay is generous enough for a Metro-served debug bundle on a software-rendered
emulator, and each capture is verified non-blank before it is written.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from pathlib import Path

SECTION_SLUGS = {
    "Login flow": "login-flow",
    "leave": "leave",
    "log in flow": "log-in-flow",
    "performance": "performance",
    "Service flow": "service-flow",
}

PACKAGE = "com.spoonhelp.cookapp.dev"


def adb(adb_path: str, *args: str, binary: bool = False):
    result = subprocess.run(
        [adb_path, *args], capture_output=True, timeout=120, check=False
    )
    return result.stdout if binary else result.stdout.decode("utf-8", "replace")


def is_blank(png_bytes: bytes) -> bool:
    """A screenshot with a single colour means the deep link did not land."""
    from io import BytesIO

    import numpy as np
    from PIL import Image

    arr = np.asarray(Image.open(BytesIO(png_bytes)).convert("RGB"))
    # Ignore the system status bar band when judging blankness.
    body = arr[120:, :, :]
    return bool(body.std() < 1.5)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", required=True)
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--states", required=True, help="JSON map of galleryState -> nodeId")
    parser.add_argument("--root", default="docs/visual-verification/v13")
    parser.add_argument("--settle", type=float, default=5.0)
    args = parser.parse_args()

    inventory = json.loads(Path(args.inventory).read_text(encoding="utf-8"))
    states = json.loads(Path(args.states).read_text(encoding="utf-8"))
    by_node = {row["nodeId"]: row for row in inventory}

    ok = failed = 0
    for state_id, node_id in states.items():
        row = by_node.get(node_id)
        if row is None:
            print(f"!! {state_id}: node {node_id} not in inventory")
            failed += 1
            continue
        out_dir = Path(args.root) / SECTION_SLUGS[row["section"]] / node_id.replace(":", "-")
        out_dir.mkdir(parents=True, exist_ok=True)

        adb(
            args.adb,
            "shell",
            "am",
            "start",
            "-a",
            "android.intent.action.VIEW",
            "-d",
            f"spooncook://dev/{state_id}",
            PACKAGE,
        )
        time.sleep(args.settle)
        png = adb(args.adb, "exec-out", "screencap", "-p", binary=True)
        if len(png) < 5000 or is_blank(png):
            print(f"!! {state_id} ({node_id}): blank or missing render")
            failed += 1
            continue
        (out_dir / "emulator.png").write_bytes(png)
        ok += 1
        print(f"ok {state_id:32} -> {node_id} {len(png) // 1024}KB")

    print(f"\ncaptured={ok} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
