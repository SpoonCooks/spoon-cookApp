"""
Tile the V14 comparison artefacts into contact sheets, so 47 screens can actually be looked at.

A verdict is only allowed to be recorded after the overlay and the diff have been *seen* — a low
`differingPixelPercent` is not the same as a correct screen, and the classic false pass is a render
that is mostly white against a frame that is also mostly white. But opening 47 pairs one at a time
is how a review gets abandoned half way and the rest waved through on their numbers.

So this lays them out in grids of nine, captioned with the three numbers that decide the verdict:
the differing percentage, the displacement probe's best offset, and the count of reference rows
that were never covered.

Each cell shows one of:

  * ``diff``    — the reference in grey with differing pixels painted red. Best for *where*.
  * ``overlay`` — reference and render blended 50/50, so a geometry shift reads as ghosting.
  * ``pair``    — reference and render side by side. Best for judging whether a screen is right
    at all, which a diff image cannot tell you.

Usage:
    python scripts/visual/contact_sheet.py --kind diff
    python scripts/visual/contact_sheet.py --kind pair --section "Service flow"
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs" / "visual-verification" / "v14"

SECTION_SLUGS = {
    "Login flow": "login-flow",
    "log in flow": "log-in-flow",
    "leave": "leave",
    "performance": "performance",
    "job flow": "job-flow",
    "Service flow": "service-flow",
    "Info": "info",
}

#: Height each screen is scaled to in a cell. Tall enough that a misplaced element is visible,
#: short enough that nine fit on one sheet.
CELL_H = 620
CAPTION_H = 34
PAD = 10


def cell_for(out: Path, kind: str) -> Image.Image | None:
    if kind == "pair":
        ref, emu = out / "figma.png", out / "emulator.png"
        if not (ref.exists() and emu.exists()):
            return None
        a, b = Image.open(ref).convert("RGB"), Image.open(emu).convert("RGB")
        a = a.resize((round(a.width * CELL_H / a.height), CELL_H))
        b = b.resize((round(b.width * CELL_H / b.height), CELL_H))
        joined = Image.new("RGB", (a.width + b.width + 6, CELL_H), "white")
        joined.paste(a, (0, 0))
        joined.paste(b, (a.width + 6, 0))
        return joined
    path = out / f"{kind}.png"
    if not path.exists():
        return None
    img = Image.open(path).convert("RGB")
    return img.resize((max(1, round(img.width * CELL_H / img.height)), CELL_H))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", choices=["diff", "overlay", "pair"], default="diff")
    parser.add_argument("--section", default=None, help="Only this section")
    parser.add_argument("--per-sheet", type=int, default=9)
    parser.add_argument("--out", default=None, help="Output directory")
    args = parser.parse_args()

    inventory = json.loads((EVIDENCE / "inventory.json").read_text(encoding="utf-8"))
    if args.section:
        inventory = [r for r in inventory if r["section"] == args.section]

    out_dir = Path(args.out) if args.out else EVIDENCE / "contact-sheets"
    out_dir.mkdir(parents=True, exist_ok=True)

    cells = []
    for row in inventory:
        out = EVIDENCE / SECTION_SLUGS[row["section"]] / row["nodeId"].replace(":", "-")
        image = cell_for(out, args.kind)
        if image is None:
            continue
        result = out / "result.json"
        if result.exists():
            r = json.loads(result.read_text(encoding="utf-8"))
            caption = (
                f"{row['nodeId']} {row['name'][:22]} "
                f"d={r['differingPixelPercent']:.1f}% "
                f"s={r['displacementProbe']['bestVerticalOffsetPx']:+d} "
                f"u={r['uncomparedReferenceRows']}"
            )
        else:
            caption = f"{row['nodeId']} {row['name'][:22]} (not compared)"
        cells.append((caption, image))

    if not cells:
        print("!! nothing to tile — no artefacts of that kind on disk yet")
        return 1

    written = []
    for start in range(0, len(cells), args.per_sheet):
        batch = cells[start : start + args.per_sheet]
        cols = 3
        rows_n = (len(batch) + cols - 1) // cols
        col_w = max(c.width for _, c in batch) + PAD
        sheet = Image.new(
            "RGB",
            (cols * col_w + PAD, rows_n * (CELL_H + CAPTION_H + PAD) + PAD),
            "#f4f4f4",
        )
        draw = ImageDraw.Draw(sheet)
        for index, (caption, image) in enumerate(batch):
            cx = PAD + (index % cols) * col_w
            cy = PAD + (index // cols) * (CELL_H + CAPTION_H + PAD)
            sheet.paste(image, (cx, cy))
            draw.text((cx + 2, cy + CELL_H + 8), caption, fill="black")
        path = out_dir / f"{args.kind}-{start // args.per_sheet + 1}.png"
        sheet.save(path)
        written.append(path)
        print(f"ok {path.relative_to(ROOT)}  ({len(batch)} screens)")

    print(f"\n{len(cells)} screens over {len(written)} sheet(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
