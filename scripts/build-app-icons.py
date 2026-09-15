#!/usr/bin/env python3
"""
Derive every launcher asset from one source tile.

    python3 scripts/build-app-icons.py

Reads `assets/images/app-icon.png` and rewrites it squared, plus the two Android adaptive-icon
layers beside it. Re-runnable: the source is only ever padded, never cropped, so running it twice
gives the same result as running it once.

## Why a script, and why it lives here now

`app.config.ts` used to credit `../spoon-frontend/scripts/build-app-icons.py`. That repository is
not checked out beside this one and may no longer exist, so the recipe for three committed binary
assets was unreproducible: nobody could tell how they had been derived, or regenerate them when
the brand art changed. This is that recipe, in the repo that needs it.

## The one rule that governs all of it

An Android adaptive icon is a 108dp canvas of which only the central **72dp** is guaranteed to
survive the launcher's mask — circle, squircle or rounded square, the OEM chooses. Everything
outside can be cropped. So the foreground layer must keep its content inside that 66.7%, and the
background colour shows through wherever the foreground is transparent.

The current source is a FINISHED tile: rounded-rect background, lime over yellow, with the
wordmark running edge to edge and a `PARTNER` band across the bottom. Measured, its ink reaches
1.006x the tile's own half-width, which means the tile clips under a circular mask at any size at
or above 71.6dp. It is therefore placed at 68dp — just inside the safe zone — and the brand yellow
behind it reads as a frame rather than as a mistake, because the tile's own lower band is that
same yellow.

Full-bleed was tried and rejected: at 108dp a circular mask cut `PARTNER` down to `RTNE` and
sliced both ends off the wordmark.

## The monochrome layer is deliberately NOT the tile

Themed icons are tinted by the launcher from the alpha channel alone, so a tile's lime and yellow
are discarded no matter what is supplied — only a silhouette survives. The wordmark alone reads at
launcher size; the wordmark plus a band of small caps does not. So this layer carries the mark and
drops the band.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "assets" / "images"
SOURCE = IMAGES / "app-icon.png"

CANVAS = 1024
"""Expo's expected icon size. Every asset is written at this resolution."""

TILE_DP = 68
"""
Tile size on the 108dp adaptive canvas.

72 is the nominal safe zone; this source measures as clipping at 71.6, so 68 leaves a margin
without visibly shrinking the mark. Re-measure with `ink_radius_fraction` if the art changes.
"""

INK_LUMA = 110
"""Below this luminance a pixel is the mark rather than the lime or yellow behind it."""

SAFE_FRACTION = 72 / 108
"""The guaranteed-visible diameter, as a fraction of the adaptive canvas."""


def squared(image: Image.Image) -> Image.Image:
    """Centre on a transparent square. Padding only — the art is never cropped."""
    side = max(image.size)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(image, ((side - image.width) // 2, (side - image.height) // 2), image)
    return out


def ink_radius_fraction(tile: Image.Image) -> float:
    """
    How far the furthest ink pixel sits from centre, as a fraction of the tile's half-width.

    Above 1.0 means ink touches the tile's own edge, and the tile cannot be drawn full-bleed under
    a circular mask without losing some of it. Printed by `__main__` so a new source announces its
    own constraint instead of being discovered on a handset.
    """
    pixels = tile.convert("RGBA").load()
    width, height = tile.size
    cx, cy = width / 2, height / 2
    furthest = 0.0
    for y in range(0, height, 3):
        for x in range(0, width, 3):
            r, g, b, a = pixels[x, y]
            if a > 128 and (0.299 * r + 0.587 * g + 0.114 * b) < INK_LUMA:
                furthest = max(furthest, ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5)
    return furthest / (width / 2)


def yellow_band_top(tile: Image.Image) -> int:
    """
    The row where the lime gives way to the yellow `PARTNER` band.

    Both brand colours are bright with almost no blue, so the test is which channel leads: yellow
    `#ffd600` has red above green, lime `#cfff04` has green above red. A naive "is it yellow" check
    matches the lime too, and silently returns row 0.
    """
    pixels = tile.convert("RGBA").load()
    width, height = tile.size
    for y in range(height):
        r, g, b, a = pixels[width // 2, y]
        if a > 128 and r > 200 and b < 90 and r > g + 20:
            return y
    return height


def mark_only(tile: Image.Image) -> Image.Image:
    """
    The wordmark as a silhouette, with the lime behind it removed.

    Cropping the lime region gives a rectangle of lime, not a mark — the background has to be
    dropped by luminance, leaving the ink as alpha for the launcher to tint.
    """
    top = tile.crop((0, 0, tile.width, yellow_band_top(tile))).convert("RGBA")
    pixels = top.load()
    out = Image.new("RGBA", top.size, (0, 0, 0, 0))
    target = out.load()
    for y in range(top.height):
        for x in range(top.width):
            r, g, b, a = pixels[x, y]
            if a > 128 and (0.299 * r + 0.587 * g + 0.114 * b) < INK_LUMA:
                target[x, y] = (0, 0, 0, 255)
    return out.crop(out.split()[3].getbbox())


def fits_safe_circle(content: Image.Image) -> float:
    """
    The widest this artwork can be drawn, as a fraction of the canvas, without a circular mask
    cutting it.

    A centred w x h rectangle survives a circle of diameter d only while its DIAGONAL fits inside
    it, which for wide artwork is far less generous than the diameter suggests. Hard-coding a
    width instead is how the first attempt drew the wordmark at 0.72 and lost both ends of it:
    0.72 is comfortably inside 0.667 on the horizontal alone, and still far outside once the
    height is counted.
    """
    aspect = content.width / content.height
    return SAFE_FRACTION * aspect / ((aspect ** 2 + 1) ** 0.5)


def centred(content: Image.Image, fraction: float) -> Image.Image:
    """Fit `content` to `fraction` of a transparent CANVAS square, centred."""
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    width = round(CANVAS * fraction)
    height = round(width * content.height / content.width)
    scaled = content.resize((width, height), Image.LANCZOS)
    out.paste(scaled, ((CANVAS - width) // 2, (CANVAS - height) // 2), scaled)
    return out


def main() -> None:
    tile = squared(Image.open(SOURCE).convert("RGBA"))
    print(f"source ink reaches {ink_radius_fraction(tile):.3f} x half-width")

    tile.resize((CANVAS, CANVAS), Image.LANCZOS).save(SOURCE)
    print(f"wrote {SOURCE.relative_to(ROOT)} ({CANVAS}x{CANVAS}, squared)")

    foreground = centred(tile, TILE_DP / 108)
    foreground.save(IMAGES / "android-icon-foreground.png")
    print(f"wrote android-icon-foreground.png (tile at {TILE_DP}dp of 108)")

    mark = mark_only(tile)
    # 0.96 of the limit, so a rounding difference in a launcher's mask cannot shave the wordmark.
    mono_fraction = fits_safe_circle(mark) * 0.96
    centred(mark, mono_fraction).save(IMAGES / "android-icon-monochrome.png")
    print(f"wrote android-icon-monochrome.png (mark silhouette at {mono_fraction:.2f} of canvas)")


if __name__ == "__main__":
    main()
