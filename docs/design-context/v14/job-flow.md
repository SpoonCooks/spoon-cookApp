# `job flow` — `583:375` and `583:427`

Captured 2026-08-25 from `3iYf9ckrUDZLPlJP56dyKI`. `583:401`, `583:453` and `583:479` were read
from their committed reference renders rather than fetched: they are these two frames with a
different list and a different lead-card colourway, and both differences are recorded below.

## Frame shell

```
root         flex col, items-center (583:375 also justify-center), size-full
status mock  Component 1 (575:1743), h 32, w 370.44
top nav      bg white, flex items-center justify-center px 16, w-full
  banner     flex-1, items-center, justify-between, overflow-clip, px 4 py 6
    title    "7 November", Livvic Black 20/28, w 179
    Help     h 35, w 98, rounded 16, bg #ffd600, px 8 py 12, justify-between
               "Help" Bold 16/24, w 48, h 23 · WhatsApp size 28
body         bg white, flex col, items-start, overflow-auto, p 16, w-full
               583:375 has NO gap · 583:427 has gap 16
bottom nav   bg white, drop-shadow 0 0 1, px 16 py 8, w 370
  grid       5 equal columns, gap 10, h 52, px 4, overflow-clip
    cell     flex col, gap 2, items-center, justify-center, p 4, rounded 5
    icon     h 26, px 8, w-full   ·   label Livvic Bold 12/16
    active   `Kaam` carries `bg-[#ffef99]`
```

## `aaj ka break` — `573:1204`, on `583:401`/`427`/`453`/`479` only

```
block   px 4 py 6, w-full
card    flex col, gap 16, items-start, rounded 16, w-full   (no fill; the layer name is stale)
row     573:1206 flex, gap 87.41, items-center, w-full
  col   573:1207 flex-1 min-w-px
    box 573:1208 flex col items-start W-FULL   <- load-bearing, see below
      573:1209  "aaj ka break", Livvic Black 18/20, tracking 1, uppercase, nowrap, red
grid    3 equal columns, gap-x 2, gap-y 8, w-full
  col1  573:1211 border-2 #ffd600, rounded 7, p 6 → "12:15 PM" Bold 18/28
  col2  573:1214 rounded 7, p 6 → "TO" Bold 20/28, centred
  col3  573:1217 bg white, border-2 #cfff04, rounded 7, p 6 → "2:15 PM" Bold 18/28
```

`573:1208` being `w-full` is why the design never loses a word. Android under-measures a run
carrying `letterSpacing`, so a label sized to its own content draws wider than the box it was
given and is cut at a word boundary with no ellipsis: the app rendered `AAJ KA` and dropped
`BREAK` on all four frames that show this card.

## The jobs column — `572:1075` / `434:2740`

```
block   flex col, gap 14.01, items-start, px 4 py 6, W-340   (not w-full)
card    bg white, border 1 #ffd600, rounded 20, px 8 py 12, overflow-clip, w-full
  inner flex col, gap 12, items-start, pb 6, w 315
```

### A plain tile — `572:819`

```
head    flex col, h 36, justify-between, w 315
  row   flex items-center justify-between, w-full
    left  div.flex, w 165, gap 12, items-center
      disc bg #ffe666, rounded 100, size 30, overflow-clip; Timer size 28
      time Livvic Black 24/24, tracking -0.6, nowrap
    chip  bg #ffef99, rounded 10, p 6 → Livvic Bold 16/24, colour #0a0a0a
title   Livvic Black 18/28, tracking -0.45, w-full: "Building/ Society"
```

Tiles four to six replace the `h-36` head with a `flex col gap-4` head. The rendered result is
identical; it is recorded because it is what the frames hold.

### The lead card — `572:1076`, on `583:427`/`453`/`479`

Same shell, three differences: the disc is **36** not 30, the countdown is Livvic Black **30/36**
with no tracking, the title is Livvic Black **20/28** with no tracking, and a full-width CTA is
appended:

```
CTA   573:1221  bg <tier>, rounded 16, px 4 py 6, gap 8, justify-center, w-full
      573:1222  Livvic Black 24/30, tracking -0.6, uppercase, centred, nowrap
```

Tier, sampled from each frame's own reference render:

| frame      | countdown  | CTA fill  | CTA text | label      | disc/chip |
| ---------- | ---------- | --------- | -------- | ---------- | --------- |
| `583:427`  | `25 mins`  | `#ffd600` | black    | `CHALO`    | `#ffe666` / `#ffef99` |
| `583:453`  | `20 mins`  | `#cfff04` | black    | `CHALO!!`  | `#ecff9b` |
| `583:479`  | `15 mins`  | `#ff0000` | white    | `CHALO!!`  | `#fdd2d2` |

The frames are NAMED `<45 mins`, `<10 mins` and `<5 mins` and draw 25, 20 and 15. Twenty is not
under ten. Unresolved; the tier stays an explicit presentation input and never gates a command.

## The list each frame publishes — all six rows, in the frame's own order

| frame      | 1                 | 2                | 3                | 4                 | 5                 | 6                 |
| ---------- | ----------------- | ---------------- | ---------------- | ----------------- | ----------------- | ----------------- |
| `583:375`  | 8:30 AM · 1.5 hrs | 8:30 AM · 1.5 hrs | 8:30 AM · 1.5 hrs | 5:30 PM · 30 mins | 3:30 PM · 45 mins | 5:30 PM · 30 mins |
| `583:401`  | 8:25 AM · 1.5 hrs | 8:30 AM · 1.5 hrs | 8:30 AM · 1.5 hrs | 5:25 PM · 30 mins | 3:25 PM · 45 mins | 5:25 PM · 30 mins |
| `583:427`  | 7:55 AM · 1.5 hrs | 8:10 AM · 1.5 hrs | 5:25 PM · 30 mins | 3:25 PM · 45 mins | 5:25 PM · 30 mins | — (lead card takes the slot) |
| `583:453`  | as `583:427`      |                  |                  |                   |                   |                   |
| `583:479`  | as `583:427`      |                  |                  |                   |                   |                   |

Every card reads `Building/ Society`. The three lists are NOT the same list, which is the whole
point of recording them: one shared fixture drew `583:375`'s times on all five frames.

## Asset URLs (expire ~2026-09-01)

| node       | asset       | URL                                                                           |
| ---------- | ----------- | ----------------------------------------------------------------------------- |
| `572:1082` | Timer       | `https://www.figma.com/api/mcp/asset/5e25054a-ed0a-41cb-9473-361475c58db4.png` |
| `583:408`  | WhatsApp    | `https://www.figma.com/api/mcp/asset/ef283e15-ab51-44ac-b6c3-0e539d2c5476.png` |
| `634:1998` | nav Hazri   | `https://www.figma.com/api/mcp/asset/7e0bf5cc-977b-48ad-a385-edbefb40653d.png` |
| `634:2002` | nav Kaam    | `https://www.figma.com/api/mcp/asset/e50cf89e-b018-41ee-985a-1e71f4e3e2d2.png` |
| `634:2006` | nav Chutti  | `https://www.figma.com/api/mcp/asset/a4f7888f-9dd5-4b34-934e-af5cc3d4850a.png` |
| `634:2010` | nav Kamai   | `https://www.figma.com/api/mcp/asset/eee2dd42-b141-4a71-ad92-334382404a9a.png` |
| `634:2014` | nav Niyam   | `https://www.figma.com/api/mcp/asset/e7af4743-2588-4467-9d96-94b43025655e.png` |
| `572:825`  | Timer       | `https://www.figma.com/api/mcp/asset/7ba63550-644e-4da2-bbb1-7bd94ac62f4d.png` |
| `583:356`  | WhatsApp    | `https://www.figma.com/api/mcp/asset/2b4934c4-1c68-44c9-a7cb-992b3dc369fa.png` |
