"""
Capture an emulator screenshot for every reachable V13 gallery state.

Deep-links into `spooncook://dev/<state>`, waits for the render to settle, and writes
`emulator.png` into `docs/visual-verification/v13/<section>/<node-id>/`.

Requires: the debug APK installed, Metro serving, `adb reverse tcp:8081 tcp:8081` in place.

## The app is warmed up before the first deep link, and this is not optional

Sending a `VIEW` intent to a **cold** process makes expo-router build its navigation state from
the link before the root layout has mounted, and `StackRouter.getStateForRouteNamesChange` then
throws `Cannot read property 'filter' of undefined` on `state.routes`. The screen that results is
the red dev error overlay, not the gallery entry — and an earlier version of the blank check
happily wrote it to disk as `emulator.png`, because an error overlay is far from blank.

So the run launches the app through its LAUNCHER intent first, waits for the bundle, and only then
deep-links. It never force-stops between states, for the same reason.

The per-state wait is a fixed settle delay rather than a readiness probe because the gallery draws
no chrome of its own — there is no marker element to poll for that would not also pollute the
screenshot. The delay is generous enough for a Metro-served debug bundle on a software-rendered
emulator, and each capture is verified non-blank AND non-error before it is written.
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

#: Minimum settle after a cold start before the app is polled for readiness.
WARM_FLOOR_SECONDS = 20.0


def adb(adb_path: str, *args: str, binary: bool = False):
    result = subprocess.run(
        [adb_path, *args], capture_output=True, timeout=120, check=False
    )
    return result.stdout if binary else result.stdout.decode("utf-8", "replace")


def reject_reason(png_bytes: bytes) -> str | None:
    """
    Why this screenshot must not be written, or None if it is usable.

    Two failure modes both produce a plausible-looking PNG: a deep link that never landed (one
    flat colour) and a JS exception (React Native's red dev error overlay). Writing either as
    evidence would put a false render into the comparison, so both are named and rejected here
    rather than left to a reviewer to notice.
    """
    from io import BytesIO

    import numpy as np
    from PIL import Image

    arr = np.asarray(Image.open(BytesIO(png_bytes)).convert("RGB")).astype(int)
    # Ignore the system status bar band when judging blankness.
    body = arr[120:, :, :]

    # Flatness, not standard deviation. A screen that is entirely black except for the gesture
    # pill still has enough variance to clear a std threshold, which is how an unpainted frame
    # was written to disk as evidence; the fraction of pixels sitting on the mean catches it.
    flat = float((np.abs(body - body.reshape(-1, 3).mean(axis=0)).max(axis=2) < 8).mean())
    if flat > 0.97:
        return f"blank render ({flat:.0%} of pixels one colour)"
    if body.mean() < 20:
        return "black screen - nothing painted"

    # React Native's error overlay paints a saturated red banner across the full width.
    red = (
        (np.abs(body[:, :, 0] - 244) < 26)
        & (np.abs(body[:, :, 1] - 80) < 40)
        & (np.abs(body[:, :, 2] - 102) < 40)
    )
    if red.mean() > 0.01:
        return "React Native error overlay (JS exception)"

    # Metro's fast-refresh banner: a full-width dark grey strip near the top of the window. It
    # appears whenever the bundle is re-sent, which is exactly when a capture run follows an edit,
    # and it looks nothing like an error - so without this check it lands on disk as evidence.
    banner = np.all(np.abs(arr[:600] - 61) < 12, axis=2)
    if (banner.mean(axis=1) > 0.9).sum() > 30:
        return "Metro reload banner still on screen"
    return None


def warm_up(adb_path: str, budget: float) -> bool:
    """
    Restart the app and wait until it has actually painted a usable screen.

    A fixed sleep is not enough. Deep-linking into a process that is still mounting corrupts
    expo-router's navigation state (`StackRouter` throws on `state.routes`), and once that has
    happened every further `am start` lands in the broken instance — so a retry loop that only
    re-sends the link spins forever. The reset is therefore a real force-stop, and readiness is
    polled from the screen itself rather than assumed after N seconds.
    """
    adb(adb_path, "shell", "am", "force-stop", PACKAGE)
    time.sleep(1.0)
    adb(adb_path, "shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1")

    # A floor before polling starts. The splash and the first route both paint acceptable-looking
    # screens well before expo-router has finished mounting, so a poll that accepts the first
    # non-blank frame hands back a process that still drops the next deep link on the floor.
    time.sleep(WARM_FLOOR_SECONDS)

    deadline = time.monotonic() + budget
    stable = 0
    while time.monotonic() < deadline:
        png = adb(adb_path, "exec-out", "screencap", "-p", binary=True)
        if len(png) >= 5000 and reject_reason(png) is None:
            stable += 1
            # Two consecutive clean polls, so a frame caught mid-transition cannot pass as ready.
            if stable >= 2:
                return True
        else:
            stable = 0
        time.sleep(4.0)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", required=True)
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--states", required=True, help="JSON map of galleryState -> nodeId")
    parser.add_argument("--root", default="docs/visual-verification/v13")
    parser.add_argument("--settle", type=float, default=5.0)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument(
        "--warmup",
        type=float,
        default=90.0,
        help="Seconds to allow for the app to restart and paint before deep-linking.",
    )
    args = parser.parse_args()

    inventory = json.loads(Path(args.inventory).read_text(encoding="utf-8"))
    states = json.loads(Path(args.states).read_text(encoding="utf-8"))
    by_node = {row["nodeId"]: row for row in inventory}

    if not warm_up(args.adb, args.warmup):
        print("!! app did not reach a usable screen during warm-up")
        return 1

    ok = failed = 0
    for state_id, node_id in states.items():
        row = by_node.get(node_id)
        if row is None:
            print(f"!! {state_id}: node {node_id} not in inventory")
            failed += 1
            continue
        out_dir = Path(args.root) / SECTION_SLUGS[row["section"]] / node_id.replace(":", "-")
        out_dir.mkdir(parents=True, exist_ok=True)

        # Retry rather than fail on a transient reject. A reload banner or a half-painted frame
        # clears on its own; failing the first time would make the run depend on how recently the
        # bundle changed, which is not a property of the screen being verified.
        png = b""
        reason: str | None = "not captured"
        for attempt in range(args.retries + 1):
            if attempt > 0:
                # A reject means the instance is suspect, not just the frame. Reset it rather than
                # re-sending the link into whatever state produced the bad capture.
                warm_up(args.adb, args.warmup)
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
            reason = "truncated screencap" if len(png) < 5000 else reject_reason(png)
            if reason is None:
                break
            print(f"   retry {attempt + 1}/{args.retries} for {state_id}: {reason}")
        if reason is not None:
            print(f"!! {state_id} ({node_id}): {reason}")
            failed += 1
            continue
        (out_dir / "emulator.png").write_bytes(png)
        ok += 1
        print(f"ok {state_id:32} -> {node_id} {len(png) // 1024}KB")

    print(f"\ncaptured={ok} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
