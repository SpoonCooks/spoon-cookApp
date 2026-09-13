"""
Classify what a screen's differing pixels actually are.

A percentage on its own does not say whether a screen is wrong. Two renders can both differ on 10%
of their pixels when one has every element in the right place and loses the argument only at glyph
edges, and the other is missing a card. The brief requires a residual analysis for every screen
over 5%, and this is it — run over the same aligned pair `compare.py` scores, so the two can never
disagree about which pixels are in question.

## The classification

Every differing pixel is put in exactly one bucket:

- **edge** — the reference has a strong local gradient there, so the pixel sits on the boundary of
  a glyph, a stroke or an image. Figma and Android do not rasterise those identically and never
  will: different hinting, different gamma, different coverage arithmetic. This is the residue the
  brief calls negligible.
- **area** — the reference is locally flat there. A flat region that differs is a real mismatch:
  a wrong fill, a missing element, a shifted block, text where there should be none.

`area` pixels are then grouped into connected blobs, because ten thousand of them scattered one per
card reads very differently from ten thousand in one rectangle. The largest blobs are reported with
their bounding boxes so a reviewer can go straight to the place on the screen that is wrong.

## What this does not do

It does not adjust, mask or excuse any number. `compare.py` still reports the raw and tolerated
percentages over every pixel; this only says what those pixels are, and both go into the record.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import BOTTOM_ANCHORED_NODES  # noqa: E402
from inspect_band import aligned_pair  # noqa: E402

#: How steep a local change in the reference has to be for a pixel to count as sitting on an edge.
#: A glyph boundary swings far more than this; a flat fill with a little noise does not.
EDGE_GRADIENT = 24

#: An `area` blob smaller than this is not reported individually. Below it a blob is a couple of
#: stray pixels at a corner, which is still rasterisation by another name.
MIN_BLOB_PX = 40


def edge_mask(reference: np.ndarray) -> np.ndarray:
    """
    Pixels where the reference changes sharply within one pixel, in any direction.

    Measured per channel and then maximised, NOT on a brightness collapse. Brightness is blind to
    exactly the edges this design is full of: `#ffd600` on white differs by 214 levels of blue and
    not at all in red, so a one-unit yellow card border reads as perfectly flat to any single-value
    summary — and every border on every `leave` card was being classified as a real area mismatch
    because of it.
    """
    padded = np.pad(reference.astype(np.int16), ((1, 1), (1, 1), (0, 0)), mode="edge")
    height, width = reference.shape[0], reference.shape[1]
    strongest = np.zeros((height, width), dtype=np.int16)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            shifted = padded[1 + dy : 1 + dy + height, 1 + dx : 1 + dx + width, :]
            delta = np.abs(shifted - reference.astype(np.int16)).max(axis=2)
            strongest = np.maximum(strongest, delta)
    return strongest >= EDGE_GRADIENT


def blobs(mask: np.ndarray, limit: int = 8) -> list[dict]:
    """Connected runs of `mask`, largest first, as bounding boxes. Row-merge, no scipy."""
    labels = np.zeros(mask.shape, dtype=np.int32)
    parent: dict[int, int] = {}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    nxt = 1
    for y in range(mask.shape[0]):
        row = mask[y]
        if not row.any():
            continue
        xs = np.flatnonzero(row)
        starts = np.r_[0, np.flatnonzero(np.diff(xs) > 1) + 1]
        ends = np.r_[starts[1:] - 1, len(xs) - 1]
        for s, e in zip(starts, ends):
            x0, x1 = int(xs[s]), int(xs[e])
            above = labels[y - 1, x0 : x1 + 1] if y else np.zeros(0, dtype=np.int32)
            touching = sorted({int(v) for v in above if v})
            if touching:
                label = touching[0]
                for other in touching[1:]:
                    union(label, other)
            else:
                label, parent[nxt], nxt = nxt, nxt, nxt + 1
            labels[y, x0 : x1 + 1] = label

    if nxt == 1:
        return []
    flat = np.zeros(nxt, dtype=np.int32)
    for label in range(1, nxt):
        flat[label] = find(label)
    resolved = flat[labels]

    out: list[dict] = []
    for label, count in zip(*np.unique(resolved[resolved > 0], return_counts=True)):
        if count < MIN_BLOB_PX:
            continue
        ys, xs = np.nonzero(resolved == label)
        out.append(
            {
                "pixels": int(count),
                "top": int(ys.min()),
                "bottom": int(ys.max()),
                "left": int(xs.min()),
                "right": int(xs.max()),
            }
        )
    out.sort(key=lambda b: -b["pixels"])
    return out[:limit]


def analyse(
    evidence: Path, section: str, node_id: str, frame_w: float, frame_h: float, tolerance: int
) -> dict:
    reference, scaled = aligned_pair(
        evidence / "figma.png", evidence / "emulator.png", section, frame_w, frame_h
    )
    height = min(reference.height, scaled.height)
    if node_id in BOTTOM_ANCHORED_NODES:
        ref_view = reference.crop((0, reference.height - height, reference.width, reference.height))
        emu_view = scaled.crop((0, scaled.height - height, scaled.width, scaled.height))
    else:
        ref_view = reference.crop((0, 0, reference.width, height))
        emu_view = scaled.crop((0, 0, scaled.width, height))

    ref = np.asarray(ref_view).astype(np.int16)
    emu = np.asarray(emu_view).astype(np.int16)
    differing = np.abs(ref - emu).max(axis=2) > tolerance
    total = differing.size
    count = int(differing.sum())

    edges = edge_mask(ref)
    on_edge = int((differing & edges).sum())
    in_area = differing & ~edges
    area_count = int(in_area.sum())

    return {
        "node": node_id,
        "section": section,
        "comparedPx": int(total),
        "differingPx": count,
        "differingPercent": round(100.0 * count / total, 4),
        "edgePx": on_edge,
        "edgeShareOfDiffering": round(100.0 * on_edge / count, 2) if count else 0.0,
        "areaPx": area_count,
        "areaPercentOfScreen": round(100.0 * area_count / total, 4),
        "areaBlobs": blobs(in_area),
        "note": (
            "`edge` pixels sit on a gradient in the reference and are rasterisation. `area` pixels "
            "sit in a flat region and are a real difference; the blobs locate them. Neither figure "
            "adjusts the headline percentage in result.json."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--root", default="docs/visual-verification/v13")
    parser.add_argument("--node", default=None)
    parser.add_argument("--tolerance", type=int, default=12)
    args = parser.parse_args()

    from compare import SECTION_SLUGS

    inventory = json.loads(Path(args.inventory).read_text(encoding="utf-8"))
    print(f"{'node':10} {'diff%':>7} {'edge share':>11} {'area%':>7}  blobs")
    for row in inventory:
        if args.node is not None and row["nodeId"] != args.node:
            continue
        evidence = Path(args.root) / SECTION_SLUGS[row["section"]] / row["nodeId"].replace(":", "-")
        if not (evidence / "emulator.png").exists():
            continue
        report = analyse(
            evidence, row["section"], row["nodeId"], row["w"], row["h"], args.tolerance
        )
        (evidence / "residuals.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8"
        )
        biggest = report["areaBlobs"][0]["pixels"] if report["areaBlobs"] else 0
        print(
            f"{row['nodeId']:10} {report['differingPercent']:7.2f} "
            f"{report['edgeShareOfDiffering']:10.1f}% {report['areaPercentOfScreen']:7.3f}  "
            f"{len(report['areaBlobs'])} (largest {biggest}px)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
