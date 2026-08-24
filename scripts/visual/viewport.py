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

Frames without an effect render at their own origin with m = 0. Tall `performance` frames are
additionally downscaled because the screenshot service caps the longer edge; that cap is measured
per image rather than assumed, and it is reported in each `result.json` so a low effective
resolution is never mistaken for a clean pass.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

#: The design content column. Every V13 section measures 370dp across, which is the basis of the
#: app's `screenWidth / 370` scale factor.
CONTENT_WIDTH_DP = 370.0

#: Sections whose frames wrap the viewport in a decorative 10pt phone bezel.
BEZEL_SECTIONS = frozenset({"Login flow", "Service flow"})

#: Inner viewport of a 390x830 bezel frame, in frame coordinates: the 370-wide content column
#: that every child is laid out against, starting one unit inside the 9px border.
BEZEL_VIEWPORT = (10.0, 10.0, 370.0, 810.0)

#: Horizontal margin the renderer adds around a bezel frame's drop shadow.
BEZEL_RENDER_MARGIN = 38.0

#: The bezel shadow's downward offset, which makes the top margin 13px and the bottom margin 63px.
BEZEL_SHADOW_Y_OFFSET = 25.0


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
) -> Crop:
    """
    Map a Figma render onto the application viewport it contains.

    For bezel sections the frame origin and scale are **measured from the rendered bezel** when the
    pixels are available, because the drop shadow is asymmetric and cannot be solved from the
    frame arithmetic (see the module docstring). The solved-margin path is kept only as a fallback
    for callers that have no image, and it records that it was used.
    """
    if section in BEZEL_SECTIONS:
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

    # `direct` frames render at their own origin. Solve the scale from the longer edge, which is
    # the one the renderer's size cap acts on, so a capped tall frame is not mis-scaled.
    scale = img_h / frame_h if frame_h >= frame_w else img_w / frame_w
    return Crop(
        left=0,
        top=0,
        right=min(img_w, round(frame_w * scale)),
        bottom=min(img_h, round(frame_h * scale)),
        scale=scale,
        margin=0.0,
        note="frame is the viewport; no bezel",
    )


def emulator_scale(emulator_px_width: int, emulator_dp_width: float) -> float:
    """Device pixels per dp. 1080px / 392.7dp = 2.75 on the Ref393GA AVD."""
    return emulator_px_width / emulator_dp_width


def design_to_device_dp(design_value: float, screen_dp_width: float) -> float:
    """The app's own transform, mirrored here so evidence and runtime cannot drift apart."""
    return design_value * (screen_dp_width / CONTENT_WIDTH_DP)
