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

## Why the 390x830 renders are 466x906

`get_screenshot` returns *effect* bounds, not frame bounds. The 390x830 frames carry a drop
shadow, so their render is inset by a uniform 38px margin at scale 1.0:

    390 * s + 2m = 466  and  830 * s + 2m = 906  =>  440s = 440  =>  s = 1, m = 38

Frames without an effect render at their own origin with m = 0. Tall `performance` frames are
additionally downscaled because the local Dev Mode server caps the longer edge at 1024px; that cap
is measured per image rather than assumed, and it is reported in each `result.json` so a low
effective resolution is never mistaken for a clean pass.
"""

from __future__ import annotations

from dataclasses import dataclass

#: The design content column. Every V13 section measures 370dp across, which is the basis of the
#: app's `screenWidth / 370` scale factor.
CONTENT_WIDTH_DP = 370.0

#: Sections whose frames wrap the viewport in a decorative 10pt phone bezel.
BEZEL_SECTIONS = frozenset({"Login flow", "Service flow"})

#: Inner viewport of a 390x830 bezel frame, in frame coordinates.
BEZEL_VIEWPORT = (10.0, 9.78, 370.44, 810.45)

#: Uniform margin the renderer adds around a frame that carries a drop shadow.
BEZEL_RENDER_MARGIN = 38.0


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


def figma_viewport_crop(section: str, frame_w: float, frame_h: float, img_w: int, img_h: int) -> Crop:
    """
    Map a Figma render onto the application viewport it contains.

    `scale` and `margin` are solved from the rendered size rather than assumed, so a frame that
    gains or loses an effect does not silently shift the crop.
    """
    if section in BEZEL_SECTIONS:
        # Solve s and m from both axes; they agree exactly for an evenly-inset effect bound.
        denom = frame_w - frame_h
        scale = (img_w - img_h) / denom if denom else img_w / frame_w
        margin = (img_w - frame_w * scale) / 2.0
        vx, vy, vw, vh = BEZEL_VIEWPORT
        left = margin + vx * scale
        top = margin + vy * scale
        return Crop(
            left=round(left),
            top=round(top),
            right=round(left + vw * scale),
            bottom=round(top + vh * scale),
            scale=scale,
            margin=margin,
            note="390x830 bezel frame; inner 370.44x810.45 viewport at (10, 9.78)",
        )

    scale = img_w / frame_w
    return Crop(
        left=0,
        top=0,
        right=img_w,
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
