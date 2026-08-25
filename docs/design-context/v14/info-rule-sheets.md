# `Info` rule sheets — `597:1221`, `603:1865`, `603:1924`, `605:2027`, `605:2094`

Captured 2026-08-25 from `3iYf9ckrUDZLPlJP56dyKI`. Five frames, one component, five sets of
per-frame overrides. They are recorded together because the value of this record is the **diff
between them** — the previous run treated the component as uniform, and four of the five were
wrong in exactly the places it is not.

## Frame shell (identical on all five)

```
root         371 x 882.2, bg rgba(0,0,0,0.8), flex col, items-center, justify-between
status row   h 36.198, white, border-b 0.889 #f3f4f6, px 24/23.99, pt 12, pb 4
sheet        white, flex col, gap 16, h 643, p 16, rounded-t 20, w-full, overflow-auto
```

## Sheet children, in z-order

### `CTA` — absolute, `bottom 24`, `left calc(50% - 0.5px)`, `translateX(-50%)`, `w 338`, `px 4 py 6`

```
button   bg #ffd600, px 12, py 8, rounded 15, w-full, drop-shadow 0 0 2 rgba(0,0,0,.15)
label    "Samajh gyi", Livvic Black 24/30, centred
```

`left: calc(50% - 0.5px)` with `translateX(-50%)` resolves to **x = 16** against the 371 frame, so
the button occupies 20..350. The containing block is the sheet's padding box, which INCLUDES its
16 units of padding: `bottom: 24` measures from y=643, not y=627, and the same is true across.

### `top banner` — `h 38`, items-center, justify-between, overflow-clip, `px 4 py 6`

```
title box   h 32, w per frame:  597:1221 174 · 603:1865 150 · 603:1924 182
                                605:2027 154 · 605:2094 97
  chevron   absolute left 0, size 32, top 0   (SVG asset)
  title     absolute left 44, top 16, translateY(-50%), Livvic Black 24/30
            597:1221 "Rating" (w 130) · 603:1865 "No Show" · 603:1924 "Extra hours"
            605:2027 "5+ rating" · 605:2094 "Late"   (all but Rating nowrap, no width)
Help button h 25.335, w 73, rounded 16, bg #ffd600, px 36.06, pt 12.445, pb 12.89
  "Help"    absolute top 3, bottom 2.33, left calc(50% - 12.5px), w 48, Livvic Bold 12/15.2
  WhatsApp  absolute left 45, top 0, w 22, h 25  (PNG asset)
```

### `blurb` — `px 4`, and `py` DIFFERS

| frame      | node       | `py` | icon     | text width | copy                             |
| ---------- | ---------- | ---- | -------- | ---------- | -------------------------------- |
| `597:1221` | `597:1247` | —    | Star     | 247        | `ACCHA kaam, ACCHI kamai`        |
| `603:1865` | `603:1891` | 6    | Multiply | 291        | `NO SHOW: booking pe nahi jaana` |
| `603:1924` | `603:1950` | 6    | Timer    | 291        | `Extra hours: 7 hours se upar`   |
| `605:2027` | `605:2053` | 6    | Star     | 290        | `5+ : bohot he zyada accha kaam` |
| `605:2094` | `605:2120` | 6    | Clock    | 291        | `LATE: booking pe late jaana`    |

**`597:1247` has no vertical padding and the other four have six units of it.** That single
difference is the whole of the 13-unit displacement the pixel run measured on all four policy
sheets, and it is why the rating sheet never shared it.

```
row       gap 12, items-center, justify-center, rounded 24, w-full
          drop-shadow 0 4 10 rgba(0,0,0,0.03)
icon box  size 30, overflow-clip; image size 30 at top -0.2 (Star also left +0.5)
text      Livvic Bold 18/28, centred, fixed width per the table above
```

### `matrix` / `policy` — `px 4 py 6` on all five

`597:1221` is a rating matrix (`597:1342`); the other four are policy cards.

#### `597:1342` rating matrix

```
border 1 #ffd600, rounded 24, px 12 py 16, gap-x 10 gap-y 12
shadow 0 4 20 rgba(0,0,0,0.03)
cols   106 · 1fr · 1fr
rows   24 · 41 · 41 · fit · fit · fit
header fill #ffd600, rounded 15, Livvic Bold 16/24 centred: Rating · Din · Mahina
tiers  rounded 5, Livvic SemiBold 16/16 centred
       #cfff04 41  4.8 · 4.9 · 5    ₹1,175   ₹35,250
       #ecff9b 41  4.5 · 4.6 · 4.7  ₹1,075   ₹32,250
       #ffe666 41  4.2 · 4.3 · 4.4  ₹925     ₹27,750
       #ffef99 41  4 · 4.1          ₹725     ₹21,750
       #f5f5f5 25  4 se neeche      ID block ID block
```

#### The four policy cards

```
card    border 1 #ffd600, rounded 15, px 12 py 16, gap 10, items-center, overflow-clip
pill    w 281, px 12 py 4, rounded 15, Livvic Bold 18/28 centred
matrix  bg white, rounded 24, px 12 py 8, gap-x 10 gap-y 12
foot    w 281, bg #ecff9b, px 12 py 8, rounded 5, Livvic SemiBold 18 centred, spans 27
```

| frame      | pill fill | pill copy                | cols          | header chips         | cell type          | foot tracking |
| ---------- | --------- | ------------------------ | ------------- | -------------------- | ------------------ | ------------- |
| `603:1865` | `#ffd600` | `1 cycle ke NO SHOWS`    | 175 · 1fr     | none                 | SemiBold **20**/16 | **0.18**      |
| `603:1924` | `#e2ff68` | `7 se zyada ke kaam`     | 87 · 76 · 100 | `#cfff04` rounded 15 | SemiBold **18**/16 | none          |
| `605:2027` | `#e2ff68` | `5+ rating se kamai`     | 76 · 86 · 100 | `#cfff04` rounded 15 | SemiBold **18**/16 | none          |
| `605:2094` | `#ffd600` | `Kisi job pe late jaana` | 175 · 1fr     | none                 | SemiBold **20**/16 | **0.18**      |

Header chips are **Livvic Bold 18/28 on a 15-unit radius**, not the data cells' SemiBold on a
5-unit radius. Data rows are `#ffef99`, 35 units tall, radius 5, on all four.

```
603:1865  1- pehla -₹300 · 2- dusra -₹400 · 3- teesra -₹500
603:1924  Ghante/Din/Mahina · 8 hrs +₹150 +₹4,500 · 9 hrs +₹300 +₹9,000 · 10 hrs +₹450 +₹13,500
605:2027  5+/Cycle/Mahina · 3 +₹300 +₹1,200 · 6 +₹600 +₹2,400 · 12 +₹1,200 +₹4,800
605:2094  3 mins -₹30 · 5 mins -₹50 · 10 mins -₹100 · 15 mins -₹150
```

Footnote runs, with the design's own bold spans (`|` marks a span boundary):

```
603:1918  Har |**1 NO SHOW**| ke baad penalty |**₹100**| se badh jaegi
603:1973  7 se upar har |**1 extra ghante**| ka |**₹150 bonus**| hai
609:349   Har ghar se |**5+**| laane ka |**₹100 bonus **|hai
605:2143  Diye gaye time ke baad, |**har minute,**| |**₹10**| ka nuksaan hai
```

Note where the bold ENDS: `₹150 bonus`, `₹100 bonus ` and `har minute,` carry the following word
inside the emphasis. The previous transcription dropped all three.

### `partner` — `px 4 py 6` on all five

```
row    bg #ecff9b, px 12 py 8, rounded 15, items-center, overflow-clip, w-full
label  Livvic Bold 16/24, red
value  Livvic Black 20/25, centred IN ITS OWN BOX
```

| frame      | row justification | label                  | label width | value width |
| ---------- | ----------------- | ---------------------- | ----------- | ----------- |
| `597:1221` | `gap 104`         | `Aapki rating`         | flex        | 58          |
| `603:1865` | `justify-between` | `Cycle ke NO SHOWS`    | 183         | 58          |
| `603:1924` | `justify-between` | `Cycle ke extra hours` | 183         | flex        |
| `605:2027` | `justify-between` | `Cycle ke 5+ ratings`  | 183         | 58          |
| `605:2094` | `justify-between` | `Cycle ke total late`  | 165         | flex        |

The value is **centred in its box**, never right-aligned. On a 58-unit box pinned to x=339 that
puts the glyph at x≈310; right-aligning draws it at 339, twenty-two units out.

## Asset URLs (expire ~2026-09-01)

| node       | asset    | URL                                                                           |
| ---------- | -------- | ----------------------------------------------------------------------------- |
| `597:1240` | chevron  | `https://www.figma.com/api/mcp/asset/da473298-7d71-46e1-8936-7e71736a5d08.svg` |
| `602:1825` | Star     | `https://www.figma.com/api/mcp/asset/1bc24577-61bb-40a1-8aae-3c8d228974be.png` |
| `597:1246` | WhatsApp | `https://www.figma.com/api/mcp/asset/a6e8b396-42c7-4f03-bf37-e5d5fa795dc0.png` |
| `603:1884` | chevron  | `https://www.figma.com/api/mcp/asset/2522fb2a-c36d-4d3e-b2d3-09239e4ef4f1.svg` |
| `603:1894` | Multiply | `https://www.figma.com/api/mcp/asset/71a822c0-f34d-44b0-9454-45dc9ca53bb9.png` |
| `603:1890` | WhatsApp | `https://www.figma.com/api/mcp/asset/3f9f5215-b6ca-46e3-9007-b6cc5c2885c1.png` |
| `603:1943` | chevron  | `https://www.figma.com/api/mcp/asset/a067c633-18d8-4b87-aa4b-63cc8a00152f.svg` |
| `611:395`  | Timer    | `https://www.figma.com/api/mcp/asset/8b466f07-6781-4194-8bfd-c23283e7c7d0.png` |
| `603:1949` | WhatsApp | `https://www.figma.com/api/mcp/asset/3af50684-e953-4167-9b09-8f1f1d6e2119.png` |
| `605:2046` | chevron  | `https://www.figma.com/api/mcp/asset/4b2cf6e4-18e0-44ef-aad7-e578c49b5159.svg` |
| `611:396`  | Star     | `https://www.figma.com/api/mcp/asset/77ed53b9-e95e-4b48-a91b-981ed21e3922.png` |
| `605:2052` | WhatsApp | `https://www.figma.com/api/mcp/asset/d07a17ba-bf82-493f-a7fa-edf41627862d.png` |
| `605:2113` | chevron  | `https://www.figma.com/api/mcp/asset/9c62bd72-058c-4c75-985a-ec9bb768464c.svg` |
| `611:397`  | Clock    | `https://www.figma.com/api/mcp/asset/1ebbe931-86ee-44ad-9fcb-20ee5ade0c48.png` |
| `605:2119` | WhatsApp | `https://www.figma.com/api/mcp/asset/16940065-8864-47c2-b11d-d2f7f6012579.png` |

The chevron and the WhatsApp glyph are the same artwork on every frame; the URLs differ only
because each export is a fresh upload. The four blurb icons — Star, Multiply, Timer, Clock — are
already committed under `assets/images/figma-v14/` and hashed in the asset ledger.
