"""
Stitch a scrolling screen into one tall render.

## Why a screen has to be stitched at all

Several V13 frames are taller than any phone. `575:2098` is 1284 design units against the 750 the
verified emulator offers between its system bars, and `592:*` sheets, `575:1884` and `575:2013` are
all over a viewport. Comparing only the first screenful scores the part of the design the app
happens to open on and says nothing about the rest — the earlier runs reported
`uncomparedReferenceRows: 503` on `575:2098` and still called the number a result.

So the capture scrolls the screen and reassembles it, and the comparison then runs against the
whole frame.

## Why the overlap is measured rather than assumed

`adb shell input swipe` is a gesture, not a scroll API: Android applies its own fling physics, so
the distance actually travelled is never exactly the distance requested and varies run to run.
Appending a fixed number of rows would therefore duplicate or drop a band of the screen — silently,
and differently each run.

Each new segment is instead matched against the accumulated image to find how far it really moved,
by locating a band lifted from the bottom of what has been assembled so far — see `measure_scroll`
for why a band is searched for rather than the whole overlap scored, and why that band comes off
the bottom rather than anywhere else.

Nothing is appended on a guess. When the band cannot be found the run stops and records why, so a
short render is visible in `capture.json` as a short render instead of arriving as a stitched image
with a duplicated or missing strip that no reviewer would spot.
"""

from __future__ import annotations

import time
from io import BytesIO

import numpy as np
from PIL import Image

#: Rows taken from the bottom of the assembled image as the template to locate in the next
#: segment. Deep enough to be unambiguous on a screen of repeated cards, shallow enough that a
#: large scroll still leaves it on screen.
TEMPLATE_PX = 260

#: A movement smaller than this many device pixels means the screen did not scroll — it is already
#: at the bottom, and the run stops rather than appending a duplicate band.
MIN_SCROLL_PX = 12


def _content(arr: np.ndarray, status_px: int, nav_px: int) -> np.ndarray:
    return arr[status_px : arr.shape[0] - nav_px]


def measure_scroll(base: np.ndarray, nxt: np.ndarray) -> tuple[int, float]:
    """
    How far `nxt` scrolled past the bottom of `base`, and how well it matched there.

    Both are content regions of the same width and height.

    ## Template matching, not overlap correlation

    The obvious method — slide the two images over each other and score the whole overlap — cannot
    see a large scroll. Its search has to stop while the overlap is still big enough to be
    meaningful, which caps the measurable distance at roughly half a viewport; a fling travels
    further than that, and the search then returns its last candidate with a cost that means
    nothing. Both tall `performance` frames failed exactly that way, each reporting a 1125px move
    at the edge of the window.

    So the LAST `TEMPLATE_PX` rows of the assembled image are located in the new segment instead.
    Those rows are by construction scrolling content — they came off the bottom of the previous
    screen, below any fixed header — and finding them at row `p` means the screen moved
    `height - TEMPLATE_PX - p`, which stays measurable right up to a full-viewport scroll.
    """
    height = base.shape[0]
    template = base[height - TEMPLATE_PX : height].astype(np.int16)
    best_p, best_cost = 0, float("inf")
    # Exhaustive over every landing row, including the one that means the screen did not move at
    # all. Including it is what lets a screen already at its bottom be reported as such rather than
    # as a failed match. Exhaustive also means the physics of the fling never has to be modelled.
    for p in range(0, height - TEMPLATE_PX + 1):
        cost = float(np.abs(nxt[p : p + TEMPLATE_PX].astype(np.int16) - template).mean())
        if cost < best_cost:
            best_p, best_cost = p, cost
    return height - TEMPLATE_PX - best_p, best_cost


def scroll_capture(
    screenshot,
    swipe,
    status_px: int,
    nav_px: int,
    target_content_px: int,
    settle: float = 1.2,
    max_segments: int = 16,
    match_tolerance: float = 6.0,
) -> tuple[Image.Image, dict]:
    """
    Capture a screen, scrolling until `target_content_px` of content has been assembled.

    `screenshot()` returns PNG bytes; `swipe()` performs one upward drag. Both are injected so this
    module never talks to adb and can be exercised on fixtures.

    Returns the stitched full-height image — status bar, all the content, then the navigation bar,
    so it is shaped exactly like a single screenshot and the comparison needs no special case — and
    a report of what was assembled, which goes into `result.json` rather than being discarded.
    """
    first = np.asarray(Image.open(BytesIO(screenshot())).convert("RGB"))
    status = first[:status_px]
    nav = first[first.shape[0] - nav_px :]
    stitched = _content(first, status_px, nav_px)
    viewport = stitched.shape[0]

    report: dict = {
        "segments": 1,
        "viewportContentPx": viewport,
        "targetContentPx": target_content_px,
        "scrolls": [],
        "reachedTarget": stitched.shape[0] >= target_content_px,
        "reachedBottom": False,
    }

    while stitched.shape[0] < target_content_px and report["segments"] < max_segments:
        swipe()
        time.sleep(settle)
        nxt = _content(
            np.asarray(Image.open(BytesIO(screenshot())).convert("RGB")), status_px, nav_px
        )
        window = stitched[-viewport:]
        moved, cost = measure_scroll(window, nxt)
        report["scrolls"].append({"movedPx": moved, "matchCost": round(cost, 3)})

        if moved < MIN_SCROLL_PX:
            report["reachedBottom"] = True
            break
        if cost > match_tolerance:
            # The overlap did not actually agree, so the offset is a guess. Appending on a guess is
            # how a stitched render grows a duplicated or missing band that no reviewer would spot,
            # so the run stops and says so instead.
            report["abandoned"] = f"overlap did not match (cost {cost:.1f} > {match_tolerance})"
            break

        stitched = np.vstack([stitched, nxt[viewport - moved :]])
        report["segments"] += 1

    report["contentPx"] = int(stitched.shape[0])
    report["reachedTarget"] = stitched.shape[0] >= target_content_px
    out = np.vstack([status, stitched, nav])
    return Image.fromarray(out), report
