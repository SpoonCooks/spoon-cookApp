"""
Capture an emulator screenshot for every reachable V13 gallery state.

Deep-links into `spooncook://dev/<state>`, waits for the render to settle, and writes
`emulator.png` into `docs/visual-verification/v14/<section>/<node-id>/`.

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
import base64
import json
import os
import re
import subprocess
import time
from pathlib import Path

SECTION_SLUGS = {
    "Login flow": "login-flow",
    "log in flow": "log-in-flow",
    "leave": "leave",
    "performance": "performance",
    "job flow": "job-flow",
    "Service flow": "service-flow",
    "Info": "info",
}

PACKAGE = "com.spoonhelp.cookapp.dev"

#: Height of the V14 five-tab bottom nav in design units (`634:2478`): a 52-unit row inside 8
#: units of vertical padding. Mirrors `BOTTOM_NAV_HEIGHT` in `src/ui/components/BottomNav.tsx`.
BOTTOM_NAV_UNITS = 68

#: Minimum settle after a cold start before the app is polled for readiness.
WARM_FLOOR_SECONDS = 20.0

#: How many times to relaunch when a cold start produces no JS. See `warm_up`.
WARM_LAUNCH_ATTEMPTS = 4

#: Where the debug build should fetch its JS bundle from. See `use_reverse_tunnel`.
DEV_SERVER_HOST = "localhost:8081"

#: React Native reads the dev-server override from this SharedPreferences file.
PREFS_PATH = f"shared_prefs/{PACKAGE}_preferences.xml"

#: Downward drags used to rewind a screen to the top before capturing it. The tallest V13 frame is
#: under two viewports of scroll, so four is comfortably enough and costs nothing when the screen
#: is already at the top.
SCROLL_RESET_SWIPES = 4


from stitch import scroll_capture  # noqa: E402
from viewport import CONTENT_WIDTH_DP  # noqa: E402


def adb(adb_path: str, *args: str, binary: bool = False):
    result = subprocess.run([adb_path, *args], capture_output=True, timeout=120, check=False)
    return result.stdout if binary else result.stdout.decode("utf-8", "replace")


def require_single_device(adb_path: str) -> str:
    """
    Fail loudly when more than one device is attached, naming what to do about it.

    Every `adb` call here is unqualified, so a second attached device — a phone plugged in
    mid-run, a second emulator — makes each one ambiguous. adb then writes `more than one
    device/emulator` to stderr and nothing to stdout, and the first thing downstream that touches
    the empty result is PIL:

        PIL.UnidentifiedImageError: cannot identify image file <_io.BytesIO object ...>

    which says nothing about the actual cause and cost a full capture run to diagnose. The
    evidence is calibrated to one specific AVD anyway — 1080x2392 at 440dpi, with the 136px and
    66px system bars `compare.py` excludes — so a second device is never something to silently
    pick between.
    """
    listing = adb(adb_path, "devices")
    serials = [
        line.split()[0]
        for line in listing.splitlines()[1:]
        if line.strip() and line.split()[-1] == "device"
    ]
    # An explicit ANDROID_SERIAL is how a run is pinned when a phone is also plugged in; adb
    # honours it for every call, so the ambiguity this guard exists to catch is already resolved.
    pinned = os.environ.get("ANDROID_SERIAL")
    if pinned:
        if pinned not in serials:
            raise SystemExit(f"!! ANDROID_SERIAL={pinned} is set but that device is not attached")
        return pinned
    if len(serials) == 1:
        return serials[0]
    if not serials:
        raise SystemExit("!! no device is attached; start the Ref393GA AVD first")
    raise SystemExit(
        f"!! {len(serials)} devices attached ({', '.join(serials)}).\n"
        "   Every adb call in this run is unqualified, so pin one before re-running:\n"
        "       ANDROID_SERIAL=emulator-5554 python scripts/visual/capture_emulator.py ...\n"
        "   The evidence is calibrated to the 393dp AVD; a phone would need its own profile."
    )


def reject_reason(png_bytes: bytes) -> str | None:
    """
    Why this screenshot must not be written, or None if it is usable.

    Several failure modes all produce a plausible-looking PNG: a deep link that never landed (one
    flat colour), a JS exception (React Native's red dev error overlay), a fast-refresh banner, and
    a system dialog dimming an otherwise correct screen. Writing any of them as evidence would put
    a false render into the comparison, so each is named and rejected here rather than left to a
    reviewer to notice.
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
    #
    # Flatness alone is not enough either, in the other direction: `483:4741` is three lines of
    # type on a cream field and is 98% one colour, so a bare flatness test called a correct render
    # blank and no number of retries could ever have passed it. A screen with ink on it has been
    # painted, whatever share of it is background -- so the two are required together.
    flat = float((np.abs(body - body.reshape(-1, 3).mean(axis=0)).max(axis=2) < 8).mean())
    ink = float((body.max(axis=2) < 128).mean())
    if flat > 0.97 and ink < 0.002:
        return f"blank render ({flat:.0%} of pixels one colour, {ink:.2%} ink)"
    if body.mean() < 20:
        return "black screen - nothing painted"

    # The Expo splash screen: a single saturated brand colour behind a small logo. It is neither
    # blank nor an error, and an earlier version of this check wrote it to disk as a screen render
    # -- four `log in flow` frames were captured as splash screens and scored 99% before this was
    # added. Any V13 screen is predominantly white, so a body that is mostly ONE saturated colour
    # means the app has not finished launching.
    buckets = np.bincount(
        (body[:, :, 0] // 8 * 1024 + body[:, :, 1] // 8 * 32 + body[:, :, 2] // 8).ravel()
    )
    dominant = int(buckets.argmax())
    share = float(buckets[dominant]) / float(body.shape[0] * body.shape[1])
    r, g, b = (dominant // 1024) * 8, (dominant // 32 % 32) * 8, (dominant % 32) * 8
    if share > 0.85 and min(r, g, b) < 200:
        return f"splash or single-colour screen ({share:.0%} of pixels near rgb({r},{g},{b}))"

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

    # An Android system dialog -- "System UI isn't responding", a permission prompt, a crash box.
    # It dims everything behind it with a ~50% black scrim and floats a near-white rounded panel in
    # the middle of the window. The screen underneath can be completely correct, which is what
    # makes this dangerous: `575:1744` was captured with its ANR dialog up and scored 99.54%
    # against a render whose every element was in the right place.
    #
    # Detected by three properties together. A wide band of rows whose brightest pixel is still
    # dark, and a bright panel inside that band, are BOTH also true of the `leave` bottom sheets --
    # `592:563`, `592:639` and `592:888` are white sheets presented over an `rgba(0,0,0,0.8)`
    # scrim, and an earlier version of this check refused to capture all three.
    #
    # What separates them is the margins: a dialog is inset, so the scrim is still visible down the
    # left and right of its panel, while a sheet is full-bleed and reaches both edges. So the panel
    # rows are only a dialog when they are ALSO dark at the far edges.
    scrim = (body.max(axis=2) < 170).mean(axis=1) > 0.9
    if scrim.sum() > body.shape[0] * 0.25:
        width = body.shape[1]
        centre = body[:, width // 4 : width * 3 // 4, :]
        panel = (centre.min(axis=2) > 235).mean(axis=1) > 0.8
        margin = width // 12
        edges = body[:, list(range(margin)) + list(range(width - margin, width)), :]
        inset = (edges.max(axis=2) < 170).mean(axis=1) > 0.9
        if (panel & inset).sum() > 60:
            return "an Android system dialog is covering the screen"
    return None


def use_reverse_tunnel(adb_path: str) -> None:
    """
    Point the debug build at `localhost:8081` over `adb reverse`, not the emulator's NAT alias.

    By default React Native resolves the packager to `10.0.2.2:8081`, the emulator's alias for the
    host loopback. On this AVD that path corrupts the bundle download: `BundleDownloader` asks for
    a chunked `multipart/mixed` response and okhttp dies part-way through reading it with

        java.net.ProtocolException: Expected leading [0-9a-fA-F] character but was 0xd

    The process then sits on the splash screen forever with no JS, which is indistinguishable from a
    slow start until you read logcat. Metro is not at fault -- the identical request from the host
    returns 8.9MB over both plain and multipart -- so the corruption is in the NAT path.

    Forwarding the port with `adb reverse` and overriding `debug_http_host` moves the download onto
    the adb transport, where it has not failed once. The preference is written with base64 because
    the device shell strips the quotes out of an XML literal, and unquoted attributes make the file
    unparseable -- Android then silently ignores it and the app goes back to 10.0.2.2.
    """
    adb(adb_path, "reverse", "tcp:8081", "tcp:8081")
    prefs = (
        '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>'
        f'<map><string name="debug_http_host">{DEV_SERVER_HOST}</string></map>'
    )
    encoded = base64.b64encode(prefs.encode("utf-8")).decode("ascii")
    adb(
        adb_path,
        "shell",
        f"run-as {PACKAGE} sh -c 'echo {encoded} | toybox base64 -d > {PREFS_PATH}'",
    )


def warm_up(adb_path: str, budget: float, launches: int = WARM_LAUNCH_ATTEMPTS) -> bool:
    """
    Restart the app and wait until it has actually painted a usable screen.

    A fixed sleep is not enough. Deep-linking into a process that is still mounting corrupts
    expo-router's navigation state (`StackRouter` throws on `state.routes`), and once that has
    happened every further `am start` lands in the broken instance — so a retry loop that only
    re-sends the link spins forever. The reset is therefore a real force-stop, and readiness is
    polled from the screen itself rather than assumed after N seconds.

    ## Why the LAUNCH is retried, not just the poll

    On this emulator the debug bundle is fetched over the host NAT alias (`10.0.2.2:8081`) as a
    chunked multipart stream, and that download intermittently dies inside okhttp:

        java.net.ProtocolException: Expected leading [0-9a-fA-F] character but was 0xd
            at ...MultipartStreamReader.readAllParts / BundleDownloader.processMultipartResponse

    When it does, the process is alive but has no JS, so it sits on the splash or a black frame
    forever and no amount of extra polling helps. Metro is not at fault - the same bundle serves
    cleanly to the host over both plain and multipart requests - so the fix is simply to kill the
    instance and launch again. Measured across a run it succeeds on the first or second attempt;
    giving up after one made whole sections unverifiable for reasons that had nothing to do with
    the screens.
    """
    for attempt in range(1, launches + 1):
        adb(adb_path, "shell", "am", "force-stop", PACKAGE)
        time.sleep(1.0)
        adb(adb_path, "shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1")

        # A floor before polling starts. The splash and the first route both paint
        # acceptable-looking screens well before expo-router has finished mounting, so a poll that
        # accepts the first non-blank frame hands back a process that still drops the next deep
        # link on the floor.
        time.sleep(WARM_FLOOR_SECONDS)

        deadline = time.monotonic() + budget
        stable = 0
        while time.monotonic() < deadline:
            png = adb(adb_path, "exec-out", "screencap", "-p", binary=True)
            reason = reject_reason(png) if len(png) >= 5000 else "screencap returned nothing"
            if reason is None and app_is_focused(adb_path):
                stable += 1
                # Two consecutive clean polls, so a frame caught mid-transition cannot pass.
                if stable >= 2:
                    return True
            else:
                stable = 0
                # A dimmed frame is USUALLY an ANR dialog, and the poll cannot tell the difference
                # between "still starting" and "a dialog has been sitting over this for a minute".
                # Clearing it every failed poll is free when there is nothing to clear, and it is
                # the whole difference between a run and four wasted relaunches: on a software
                # renderer this AVD raises "System UI isn't responding" often enough that a
                # warm-up which never dismisses it simply exhausts its attempts.
                dismiss_system_dialogs(adb_path)
                if not app_is_focused(adb_path):
                    # BACK out of a dialog can land on the launcher. Bring the app back rather
                    # than polling a home screen until the budget runs out.
                    adb(adb_path, "shell", "monkey", "-p", PACKAGE,
                        "-c", "android.intent.category.LAUNCHER", "1")
                    time.sleep(3.0)
            time.sleep(4.0)
        print(f"   warm-up attempt {attempt}/{launches} did not paint; relaunching")
    return False


def app_is_focused(adb_path: str) -> bool:
    """
    True when the app owns the focused window.

    Without this the warm-up poll accepts any screen that is not blank and not dimmed, which
    includes the launcher — and a run that starts from the launcher deep-links into a cold process
    and produces exactly the corrupted navigation state the force-stop exists to avoid.
    """
    focus = adb(adb_path, "shell", "dumpsys", "window")
    for line in focus.splitlines():
        if "mCurrentFocus" in line:
            return PACKAGE in line
    return False


def dismiss_system_dialogs(adb_path: str) -> None:
    """
    Clear any Android dialog sitting over the app.

    The emulator raises "System UI isn't responding" under a software renderer often enough that a
    run will meet one, and it dims the screen behind it — so a capture taken while it is up is
    unusable even though the app underneath is correct. `reject_reason` catches that, but catching
    it only turns a bad capture into a failed one; the dialog has to actually go away or every
    retry meets it again, which is what happened to `592:888`.

    Both signals are sent because neither alone is reliable: the broadcast closes system-owned
    dialogs, and BACK dismisses the ones that ignore it.
    """
    adb(adb_path, "shell", "am", "broadcast", "-a", "android.intent.action.CLOSE_SYSTEM_DIALOGS")
    adb(adb_path, "shell", "input", "keyevent", "KEYCODE_BACK")
    time.sleep(0.8)


def reset_scroll(args, width: int, height: int) -> None:
    """
    Return the screen to the top of its content before it is captured.

    The gallery does not remount between deep links, so three of the `performance` states are the
    same `MoneyPeriodView` with a different period — and a `ScrollView` that was scrolled for the
    previous state is still scrolled for the next one. `575:1884` was captured that way: the
    stitched render was complete and correct and began 324 design rows into the frame, which scored
    as a 69% mismatch against a screen that had nothing wrong with it.

    Downward drags rather than a scroll API, because there is no scroll API over adb. Enough of
    them to cover the tallest frame from its bottom, and they are harmless on a screen that is
    already at the top or does not scroll at all.
    """
    x = width // 2
    top = args.emulator_status_px + int((height - args.emulator_status_px) * 0.30)
    bottom = args.emulator_status_px + int((height - args.emulator_status_px) * 0.80)
    for _ in range(SCROLL_RESET_SWIPES):
        adb(args.adb, "shell", "input", "swipe", str(x), str(top), str(x), str(bottom), "600")
    time.sleep(1.2)


def capture_full_height(args, row: dict, first_png: bytes) -> tuple[bytes, dict | None]:
    """
    Return a render tall enough to cover the whole design frame, scrolling if it has to.

    A frame no taller than the viewport is returned exactly as captured — most screens are one
    screenful and must not be scrolled, because a scroll gesture on a short screen can still bounce
    the content and would make an otherwise stable capture depend on the overscroll animation.

    For a taller frame the screen is scrolled and reassembled by `stitch.scroll_capture`, and what
    it assembled is written next to the render as `capture.json`. That file is the honest part: if
    the app could not scroll far enough to cover the design, the report says so and the comparison
    still reports the rows it never saw, rather than the run quietly scoring a third of a frame.
    """
    from io import BytesIO

    from PIL import Image

    if args.no_scroll:
        return first_png, None

    shot = Image.open(BytesIO(first_png))

    # A design unit in DEVICE pixels — the app's own transform, not the frame's.
    #
    # The screenshot is the app's render, and the app lays a design unit out as
    # `screenWidth / 370` dp. Dividing the screenshot's width by the FRAME's width instead reads
    # the design's coordinate system off a picture drawn in the app's, which on a 371-unit frame
    # is 0.27% short — about two device pixels of scroll target on a tall screen. It never mattered
    # enough to truncate a capture, and it is still the wrong quantity to compute here.
    per_unit = shot.width / CONTENT_WIDTH_DP
    # Per FRAME, not per section: `Info` mixes two status mocks inside one section.
    band = float(row.get("statusBand", 0.0))

    # The V14 bottom nav is a FIXED FOOTER, and stitching has to be told so.
    #
    # `stitch.scroll_capture` locates the next segment by searching for a band lifted off the
    # bottom of what it has assembled. On a frame carrying the nav that band is mostly the nav
    # itself, which does not move when the content scrolls: the template matches at offset ~0,
    # `measure_scroll` reports no movement, and the run stops after one screenful believing it
    # has reached the bottom. Every tall nav-bearing frame would then be scored on its first
    # viewport alone.
    #
    # Passing the bar's height as part of `nav_px` makes the stitcher treat it exactly as it
    # already treats the device's own navigation bar: excluded from the scrolling region, and
    # re-attached once beneath the assembled content. The returned image keeps the shape of a
    # single screenshot, so `compare.py` still needs no special case.
    footer_units = float(BOTTOM_NAV_UNITS) if row.get("bottomNav") else 0.0
    footer_px = int(round(footer_units * per_unit))
    viewport_px = shot.height - args.emulator_status_px - args.emulator_nav_px - footer_px

    # The scrolling region's target excludes the footer, which is captured whole rather than
    # scrolled past.
    target_px = int(round((float(row["h"]) - band - footer_units) * per_unit))
    if target_px <= viewport_px + 8:
        return first_png, None

    def screenshot() -> bytes:
        """
        One screenshot, retried until it actually decodes.

        `exec-out screencap -p` occasionally returns truncated or empty bytes on this emulator,
        and a stitch run turns that into an `UnidentifiedImageError` several segments deep — the
        whole screen is then lost even though the device was fine a second later. Retrying here
        costs a moment; not retrying costs the run.
        """
        for attempt in range(4):
            raw = adb(args.adb, "exec-out", "screencap", "-p", binary=True)
            try:
                Image.open(BytesIO(raw)).load()
                return raw
            except Exception:
                if attempt == 3:
                    raise RuntimeError(
                        f"screencap returned {len(raw)} undecodable bytes four times running"
                    ) from None
                time.sleep(1.0)
        raise AssertionError("unreachable")

    def swipe() -> None:
        x = shot.width // 2
        top = args.emulator_status_px + int(viewport_px * 0.30)
        bottom = args.emulator_status_px + int(viewport_px * 0.80)
        # A slow drag over half a viewport, not a flick across it. A fast or long swipe flings, and
        # a fling both overshoots by an amount that depends on the frame rate the emulator managed
        # and can end in an overscroll bounce that is still settling when the shutter fires -- on
        # `575:2098` that produced an overlap matching nothing at any offset.
        adb(args.adb, "shell", "input", "swipe", str(x), str(bottom), str(x), str(top), "1200")

    image, report = scroll_capture(
        screenshot,
        swipe,
        args.emulator_status_px,
        args.emulator_nav_px + footer_px,
        target_px,
        settle=2.2,
    )
    if footer_px:
        report["fixedFooterPx"] = footer_px
        report["fixedFooterNote"] = (
            "The V14 bottom nav is chrome that does not scroll. It was excluded from the "
            "scrolled region and re-attached once below the assembled content, so the stitch "
            "template could not lock onto it."
        )
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue(), report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", required=True)
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--states", required=True, help="JSON map of galleryState -> nodeId")
    parser.add_argument("--root", default="docs/visual-verification/v14")
    parser.add_argument("--settle", type=float, default=5.0)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--emulator-status-px", type=int, default=136)
    parser.add_argument("--emulator-nav-px", type=int, default=66)
    parser.add_argument(
        "--no-scroll",
        action="store_true",
        help="Capture only the first viewport, even for a frame taller than one.",
    )
    parser.add_argument(
        "--warmup",
        type=float,
        default=45.0,
        help="Seconds per launch attempt to allow the app to restart and paint.",
    )
    parser.add_argument(
        "--only",
        default=None,
        help=(
            "Comma-separated node ids to capture, instead of the whole gallery. Re-rendering all "
            "47 costs about half an hour, and a fix aimed at one component needs the four screens "
            "it touches, not the forty-three it does not. The FINAL run is always unfiltered."
        ),
    )
    args = parser.parse_args()

    inventory = json.loads(Path(args.inventory).read_text(encoding="utf-8"))
    states = json.loads(Path(args.states).read_text(encoding="utf-8"))
    by_node = {row["nodeId"]: row for row in inventory}

    require_single_device(args.adb)

    size = adb(args.adb, "shell", "wm", "size")
    match = re.search(r"(\d+)x(\d+)", size)
    if match is None:
        print(f"!! could not read the display size from `wm size`: {size.strip()!r}")
        return 1
    screen_w, screen_h = int(match.group(1)), int(match.group(2))

    use_reverse_tunnel(args.adb)
    if not warm_up(args.adb, args.warmup):
        print("!! app did not reach a usable screen during warm-up")
        return 1

    if args.only is not None:
        wanted = {n.strip() for n in args.only.split(",") if n.strip()}
        unknown = wanted - set(states.values())
        if unknown:
            print(f"!! --only names nodes with no gallery state: {sorted(unknown)}")
            return 1
        states = {k: v for k, v in states.items() if v in wanted}
        print(f"-- capturing {len(states)} of the gallery, filtered by --only")

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
        scroll_report: dict | None = None
        reason: str | None = "not captured"
        for attempt in range(args.retries + 1):
            if attempt > 0:
                # A reject means the instance is suspect, not just the frame. Clear anything the
                # system has put over it, then reset rather than re-sending the link into whatever
                # state produced the bad capture.
                dismiss_system_dialogs(args.adb)
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
            if not args.no_scroll:
                reset_scroll(args, screen_w, screen_h)
            png = adb(args.adb, "exec-out", "screencap", "-p", binary=True)
            reason = "truncated screencap" if len(png) < 5000 else reject_reason(png)
            if reason is None:
                png, scroll_report = capture_full_height(args, row, png)
                break
            print(f"   retry {attempt + 1}/{args.retries} for {state_id}: {reason}")
        if reason is not None:
            print(f"!! {state_id} ({node_id}): {reason}")
            failed += 1
            continue
        (out_dir / "emulator.png").write_bytes(png)
        if scroll_report is not None:
            (out_dir / "capture.json").write_text(
                json.dumps(scroll_report, indent=2) + "\n", encoding="utf-8"
            )
        ok += 1
        segs = "" if scroll_report is None else f" [{scroll_report['segments']} segments]"
        print(f"ok {state_id:32} -> {node_id} {len(png) // 1024}KB{segs}")

    print(f"\ncaptured={ok} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
