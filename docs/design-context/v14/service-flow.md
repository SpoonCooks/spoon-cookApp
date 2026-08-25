# `Service flow` — `614:453`, `622:801`, `628:1293`

Captured 2026-08-25 from `3iYf9ckrUDZLPlJP56dyKI`. These three carry every structure the section
uses: the travel banner, the customer card with its two actions, the OTP block, and the promo
block. The other ten Service frames are these components in different states.

## Frame shell (all three)

```
root        flex col, items-center, size-full
status      Component 1 (575:1743), h 32, w 370.44
top nav     bg white, flex items-center justify-center, px 16, w-full
  banner    flex-1, items-center, justify-between, overflow-clip, px 4 py 6
    title   "Active job", Livvic Black 24/30, w 179
    Help    h 35, w 98, rounded 16, bg #ffd600, px 8 py 12, justify-between
              "Help" Bold 16/24 w 48 h 23 · WhatsApp size 28
body        bg white, flex col, isolate, overflow-auto, p 16, w-full
              614:453 gap 21, h 648 · 622:801 gap 21, h 839 · 628:1293 gap 16, h 716
bottom nav  identical to the job-flow bar; `Kaam` is the active cell (`#ffef99`)
```

## `614:453` — the travel banner, `464:3856`

```
banner   flex, gap 10, items-center, px 4 py 6, W-338
photo    464:3858  h 150, W-112, p 10 — the <img> is `absolute inset-0 size-full`, so it COVERS
                   the padding. Laying it out as a padded child starts it (10, 10) in.
column   463:3774  h 150, w 206, flex col, justify-between
  head   617:455   bg white, px 12 py 8, rounded 15, w-full
                   "Location ki duri" Livvic Bold 20/16, centred
  count  463:3775  bg #ecff9b, H-103, px 12 py 8, rounded 15, w-full
                   "16 mins" Livvic Black 32/25, tracking 0.32, h 30, centred
```

## The customer card — `462:3579` (and `644:2548` on `622:801`)

```
block    462:3621  flex col, gap 14.01, items-start, px 4 py 6, W-340
card     border 1 #ffd600, rounded 24, p 12, gap 16, items-start, w-full
```

Its five children, in order:

```
1  462:3596  grid, 2 EQUAL COLUMNS, gap 10, rounded 15, w-full
     462:3597  col 1 only: bg #cfff04, h 35, rounded 15, px 12 py 6, gap 8, justify-center
                 Frame size 16 (SVG) · "Map dekhe" Livvic Bold 18/16, centred, nowrap
2  462:3589  W-308, flex col, gap 16, items-start, justify-center, px 12 py 8
     four rows, each: gap 12, h 25, items-center, w-full
       icon box size 25, overflow-clip
       text flex-1 min-w-px, Livvic Black 18/20
       Building name · Tower/ block no. · Floor no. · Flat/ house no.
3  462:3580  flex items-center justify-between, w-full
     462:3585  flex-1 min-w-px, h 24, Livvic Bold 16/24, colour #0a0a0a: "Anjali Sharma"
     chip      bg #ffe666, rounded 5, px 11.889 py 3.889, h-full; Bold 16/16: "1.5 hrs"
4  614:400   grid, 2 EQUAL COLUMNS, gap 10, rounded 15, w-full
     614:405   col 1 only: bg #e2ff68, h 35, rounded 15, px 12 py 6, gap 8, justify-center
                 Frame size 16 (SVG) · "Call kare" Livvic Bold 18/16, centred, nowrap
```

**Both action buttons occupy column one of a two-column grid.** Card inner width is 306, so each
button is `(306 − 10) / 2 = 148` units — half the card. The app drew them `flex: 1` in a plain
row, so both spanned the whole card on all eleven Service frames that draw them.

`622:913` (booking cancelled) omits `Map dekhe`; its card is 230 units tall against 332.

## `622:801` — the Start OTP block, `476:4233`

```
block    bg white, flex col, items-start, px 4 py 6, H-164, W-338
frame    476:4234  bg white, H-152, W-330, overflow-clip, relative
  body   476:4235  ABSOLUTE, bg rgba(236,255,155,0.7), left 0, top 20, W-320, H-130, rounded 20
    lbl  476:4236  ABSOLUTE, left 16, top 73, translateY(-50%), h 20, w 129
                   "Start OTP" Livvic Black 24/30, tracking 0.96
    otp  476:4238  ABSOLUTE, left 160, top 36, W-148, H-74, overflow-clip, py 8
                   grid 3 equal columns, gap-x 15
                   digit: bg #cfff04, rounded 5, self-stretch
                          Livvic Black 30/36, centred
  pill   476:4248  ABSOLUTE, bg #e2ff68, left 38, top 0, W-254, H-40, rounded 26
                   overflow-clip, pt 7 pb 5 pl 13, items-center justify-center
                   "Start" Livvic Bold 25/28, centred, nowrap
```

## The promo blocks — `473:4192`, `628:1252`, `485:4929`

All three are a `Frame 50` image **314 wide** with a caption; only the height and the order change.

```
622:801   473:4192  bg white, flex col, gap 6, items-center, px 12 py 6, H-273, W-338
            art  473:4193  h 217, rounded 20, pr 10, w 314  (image absolute inset-0)
            text 473:4196  Livvic Bold 20/28, centred, w-full: "OTP daalke job start kare"
628:1249  the same block at h 245, caption "OTP daalke job end kare", ABOVE the OTP block
628:1293  485:4929  bg white, flex col, gap 50, items-center, JUSTIFY-CENTER,
                    px 12 py 6, H-535, W-338
            text 485:4931 overflow-clip, w-full
                 485:4932 Livvic Bold 30/36, centred, H-63, w-full
                          "Agle booking mein bhi accha kaam kare!"
            art  485:4930 h 336, pr 10, w-full (image absolute inset-0, object-contain)
```

`485:4929` is a **fixed 535-unit box holding 449 units of content**, centred. That is 43 units of
white above the headline and 43 below the art, and it is the whole of the sixty-unit lift the
render had: sizing the block to its content pushed the headline, the artwork and the CTA up and
left the slack in one lump above the bottom nav.

## `628:1293` CTA — `628:1338`

```
bg #cfff04, flex, gap 12, items-center, justify-center, py 10, rounded 20, w-full
  628:1339  "Kaam dekhe" Livvic Black 30/36, centred, nowrap
  628:1340  Arrow, w 51, h 49
```

## Asset URLs (expire ~2026-09-01)

| node       | asset          | URL                                                                           |
| ---------- | -------------- | ----------------------------------------------------------------------------- |
| `464:3858` | cook walking   | `https://www.figma.com/api/mcp/asset/5e92995e-5b33-4bc0-be27-5861eb805fe3.png` |
| `463:3754` | City Buildings | `https://www.figma.com/api/mcp/asset/f52677f6-5c23-4559-a560-5d8224a1fe9e.png` |
| `463:3755` | Building       | `https://www.figma.com/api/mcp/asset/46689a37-46d0-4daa-8d4f-f4f334dd4218.png` |
| `463:3756` | Stairs Up      | `https://www.figma.com/api/mcp/asset/c3815e89-dd1a-428e-bb5e-93fbda6fb258.png` |
| `463:3757` | Home Page      | `https://www.figma.com/api/mcp/asset/43e66d02-8db3-4eba-99d0-3a0a7e002137.png` |
| `462:3598` | map pin (SVG)  | `https://www.figma.com/api/mcp/asset/6e5380d1-284c-4b8b-9494-292c2b6a0368.svg` |
| `614:406`  | call (SVG)     | `https://www.figma.com/api/mcp/asset/4c3e01cc-bfe9-44fa-86dd-d5b8a5538c7f.svg` |
| `473:4193` | Start OTP art  | `https://www.figma.com/api/mcp/asset/438b42b6-85e3-4b9c-b4d5-32f5706f1465.png` |
| `485:4930` | celebration    | `https://www.figma.com/api/mcp/asset/a30fc7af-ee55-4d4a-ac93-7c887813a14c.png` |
| `628:1340` | Arrow          | `https://www.figma.com/api/mcp/asset/e0e5c07a-851c-4470-b616-56955f8988b9.png` |
