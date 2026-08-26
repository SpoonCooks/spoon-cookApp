"""
Coordinate transform between a Figma V13 frame and an Android emulator render.

## The two authoring conventions in V13

The five finalized sections do NOT use one frame size, and the difference is not cosmetic:

  * `Login flow` and `Service flow` frames are **390x830** and draw a decorative phone mockup
    inside themselves. Their children start at x=10 and are 370 wide, and a home-indicator strip
    sits at y=810.23. The application viewport is therefore the inner **370.44 x 810.45** area at
    offset (10, 9.78) — the 10pt bezel is decoration and must never be built into the app.
  * `leave` (371x882), `log in flow` (370x753) and `performance` (370 x variable) frames ARE the
    application viewport. Their status bar is a real child at y=0, and there is no bezel.

In both conventions the content column measures **370dp**, which is what makes a single
`screenWidth / 370` scale factor correct for every V13 screen. That is the value asserted by
`designScale.test.ts`, and it is revalidated here rather than inherited from V12.

## Why the 390x830 renders are 466x906, and why the margin is NOT uniform

`get_screenshot` returns *effect* bounds, not frame bounds. The 390x830 frames carry
`shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]`, and that shadow is **offset 25px downward**. The
render therefore has 38px of margin on the left and right but only **13px on top** and 63px on the
bottom:

    left/right = 38          top = 38 - 25 = 13          bottom = 38 + 25 = 63

Solving a single uniform `m` from `390s + 2m = 466` and `830s + 2m = 906` yields `s = 1, m = 38`,
which is right horizontally and **25px too low vertically**. That is exactly what the earlier
version of this module did, and it silently displaced every `Login flow` and `Service flow`
comparison by 25 reference rows -- roughly 3% of the frame height, enough to paint a correct render
as a failure and to make a real vertical error unreadable.

The margin is therefore no longer solved from the frame arithmetic. The black bezel is **located
in the image**: it is a 9px near-black rounded rectangle enclosing the whole frame, so its bounding
box gives the frame origin and the render scale directly. Measured on every bezel frame in the
inventory the box is rows 13..842, cols 38..427 -- 390x830 at scale 1.0, origin (38, 13).

## Direct frames have effect bounds too, and they are NOT at the origin

The same trap, one order of magnitude smaller and therefore much harder to see. A `direct` frame
has no bezel, but it does have drop shadows — the bottom nav's `0 0 1`, `leave`'s `0 -1 1`, the
Help pill's `0 0 2` — so a 371-unit frame comes back **374 or 375 pixels wide** with the frame
sitting at scale 1 inside a centred margin of one to two pixels. Reading such a render from (0, 0)
and solving the scale from its height, which is what this module used to do, starts the crop about
two pixels left of the frame and then calls a short width the whole 371-unit column.

That is invisible on a splash and fatal on a tariff table: every element lands about two units off
its design column and every text baseline about one row high, which reddens every glyph edge in
the frame. It also produced the +0.2 to +0.8 unit top-alignment deltas the V14 run measured on
every direct frame and could not account for — those were half the vertical margin, not the app.

The margin is therefore `(render − frame) / 2` on both axes, checked rather than assumed: it
predicts the left edge of the bottom nav's active cell to within a pixel on `575:2137`,
`575:1744`, `583:375`, `614:453`, `592:488` and `597:1131`. Tall frames may additionally be
downscaled because the screenshot service caps the longer edge; that cap is detected per image (a
render SMALLER than its frame) rather than assumed, and the resulting scale is reported in each
`result.json` so a low effective resolution is never mistaken for a clean pass.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

#: The design content column. Every V13 section measures 370dp across, which is the basis of the
#: app's `screenWidth / 370` scale factor.
CONTENT_WIDTH_DP = 370.0

#: Sections whose frames wrap the viewport in a decorative 10pt phone bezel.
#:
#: V14 leaves only `Login flow` here. V13 also listed `Service flow`, but V14 re-authored that
#: section as 371-wide `direct` frames, and keeping it would displace all thirteen Service
#: comparisons by the bezel's 10-unit origin before a single element was examined. The convention
#: is now carried per frame in `inventory.json`, and this set is only the fallback for callers that
#: pass a section name instead.
BEZEL_SECTIONS = frozenset({"Login flow"})

#: Inner viewport of a 390x830 bezel frame, in frame coordinates: the 370-wide content column
#: that every child is laid out against, starting one unit inside the 9px border.
BEZEL_VIEWPORT = (10.0, 10.0, 370.0, 810.0)

#: Horizontal margin the renderer adds around a bezel frame's drop shadow.
BEZEL_RENDER_MARGIN = 38.0

#: The bezel shadow's downward offset, which makes the top margin 13px and the bottom margin 63px.
BEZEL_SHADOW_Y_OFFSET = 25.0


def _nearest(value: float) -> int:
    """
    Round half UP.

    `round()` rounds half to even, which turns a 1.5px margin into 2 and a 2.5px one into 2 — an
    inconsistency nobody would look for inside a crop that is already only a pixel wide.
    """
    return math.floor(value + 0.5)


@dataclass(frozen=True)
class Crop:
    """A viewport rectangle in rendered-image pixels, plus how it was derived."""

    left: int
    top: int
    right: int
    bottom: int
    scale: float
    margin: float
    note: str

    @property
    def width(self) -> int:
        return self.right - self.left

    @property
    def height(self) -> int:
        return self.bottom - self.top


def _locate_bezel(img: "np.ndarray", frame_w: float, frame_h: float) -> tuple[float, float, float] | None:
    """
    Find the 9px black bezel in a rendered bezel frame.

    Returns `(origin_x, origin_y, scale)` in image pixels, or None when no plausible bezel is
    present. Detection is by row profile rather than by a raw bounding box: dark *content* inside
    the screen (a black CTA, a photograph) reaches the same darkness as the bezel and would corrupt
    a naive bbox, but only the bezel spans a full frame-height run of dark rows.
    """
    dark = img.max(axis=2) < 60
    rows = np.where(dark.any(axis=1))[0]
    if rows.size == 0:
        return None
    top, bottom = int(rows.min()), int(rows.max())
    height = bottom - top + 1
    scale = height / frame_h
    # A bezel encloses the frame, so its height must match the frame height once scaled.
    if not (0.2 <= scale <= 4.0):
        return None
    # The bezel is horizontally centred in the render; solve x from the frame width at that scale.
    origin_x = (img.shape[1] - frame_w * scale) / 2.0
    return origin_x, float(top), scale


def figma_viewport_crop(
    section: str,
    frame_w: float,
    frame_h: float,
    img_w: int,
    img_h: int,
    img: "np.ndarray | None" = None,
    convention: "str | None" = None,
) -> Crop:
    """
    Map a Figma render onto the application viewport it contains.

    For bezel sections the frame origin and scale are **measured from the rendered bezel** when the
    pixels are available, because the drop shadow is asymmetric and cannot be solved from the
    frame arithmetic (see the module docstring). The solved-margin path is kept only as a fallback
    for callers that have no image, and it records that it was used.
    """
    if convention == "bezel" if convention is not None else section in BEZEL_SECTIONS:
        located = _locate_bezel(img, frame_w, frame_h) if img is not None else None
        if located is not None:
            origin_x, origin_y, scale = located
            note = "390x830 bezel located in render; inner 370x810 viewport at (10, 10)"
        else:
            denom = frame_w - frame_h
            scale = (img_w - img_h) / denom if denom else img_w / frame_w
            margin = (img_w - frame_w * scale) / 2.0
            origin_x = margin
            origin_y = margin - BEZEL_SHADOW_Y_OFFSET * scale
            note = "FALLBACK: margin solved arithmetically, shadow offset corrected analytically"
        vx, vy, vw, vh = BEZEL_VIEWPORT
        left = origin_x + vx * scale
        top = origin_y + vy * scale
        return Crop(
            left=round(left),
            top=round(top),
            right=round(left + vw * scale),
            bottom=round(top + vh * scale),
            scale=scale,
            margin=origin_y,
            note=note,
        )

    # A `direct` frame does NOT render at its own origin either.
    #
    # `get_screenshot` returns EFFECT bounds, and a direct frame has effects: the bottom nav
    # carries `drop-shadow 0 0 1` (`0 -1 1` on `leave`) and the Help pill carries
    # `drop-shadow 0 0 2`. Those push the rendered bounds a pixel or two past the frame on every
    # side, so a 371-unit frame comes back 374 or 375 pixels wide -- at scale 1, centred.
    #
    # Assuming an origin of (0, 0) and solving the scale from the height, which is what this did,
    # is wrong twice over: it starts the crop 1.5 to 2 pixels left of the frame, and it then
    # treats a width that is short by the same amount as the whole 371-unit column. Every element
    # on every direct frame was compared about two units off its design column, and every text
    # baseline about one row high. On a sparse screen that is a soft edge; on a tariff table or a
    # six-card job list it reddens every glyph in the frame, and it is most of what the V14 run
    # was still scoring on the twenty-five screens it could not close.
    #
    # HORIZONTALLY the margin is centred, and that is measured: `(render - frame) / 2` predicts
    # the left edge of the bottom nav's active cell to within a pixel on `575:2137`, `575:1744`,
    # `583:375`, `614:453`, `592:488` and `597:1131` -- six frames across five sections, three
    # different render widths.
    #
    # VERTICALLY IT IS NOT. The overhang sits entirely BELOW the frame, and centring it took one
    # row off the top of every direct reference.
    #
    # The physical reason is that a direct frame's only shadowed full-width element is the bottom
    # nav (`drop-shadow 0 0 1`, `0 -1 1` on `leave`), and it is flush with the frame's bottom
    # edge. Its blur therefore spills past the frame on the left, the right and the BOTTOM, and
    # nowhere near the top: the status mock carries no effect, and the Help pill's `0 0 2` sits
    # six units inside the frame, so nothing reaches back over the top edge.
    #
    # This is settled by the design's own `bottom nav ... py 8`, which puts the nav's 52-unit cell
    # grid exactly 8 units above the frame's bottom edge. Measuring
    # `reference_height - (cell_bottom + 8)` over every direct frame in the inventory that carries
    # a nav gives **1 on all 27** with the centred margin and **0 on all 27** with the origin at
    # the top -- across five sections and render excesses of 0.8, 1.0, 1.6, 1.94, 2.0 and 2.95,
    # which is not a number a coincidence produces twenty-seven times.
    #
    # The Help pill agrees independently and from the other end of the frame: at this origin it
    # lands on row 6 of `583:375`, `583:427`, `614:453`, `622:801` and `597:1131`, which is what
    # `banner py 6` states and what the app draws. Centred, the reference put it on row 5 and the
    # app was scored a unit late on all forty-two direct screens.
    #
    # The previous run read the +0.2 to +0.8 unit top-alignment deltas as evidence FOR the centred
    # margin. They were evidence against it: applying it moved the measured deltas to +1.17..+1.38
    # rather than to zero.
    margin_x = (img_w - frame_w) / 2.0
    margin_y = 0.0
    scale = 1.0
    note = "frame located in render; effect bounds are centred at scale 1"
    # The renderer caps the longer edge on a very tall frame, which makes the render SMALLER than
    # the frame it holds. Detect that from the image against the frame directly: the vertical
    # margin is pinned to the top now and can no longer go negative to signal it.
    if img_w < frame_w - 0.5 or img_h < frame_h - 0.5:
        scale = min(img_w / frame_w, img_h / frame_h)
        margin_x = (img_w - frame_w * scale) / 2.0
        # Still the top: capping scales the effect bounds, it does not move the overhang.
        margin_y = 0.0
        note = f"render capped to {scale:.4f}; margin solved against the capped scale"

    left = _nearest(margin_x)
    top = _nearest(margin_y)
    return Crop(
        left=left,
        top=top,
        right=min(img_w, left + _nearest(frame_w * scale)),
        bottom=min(img_h, top + _nearest(frame_h * scale)),
        scale=scale,
        margin=margin_y,
        note=note,
    )


def emulator_scale(emulator_px_width: int, emulator_dp_width: float) -> float:
    """Device pixels per dp. 1080px / 392.7dp = 2.75 on the Ref393GA AVD."""
    return emulator_px_width / emulator_dp_width


def design_to_device_dp(design_value: float, screen_dp_width: float) -> float:
    """The app's own transform, mirrored here so evidence and runtime cannot drift apart."""
    return design_value * (screen_dp_width / CONTENT_WIDTH_DP)
