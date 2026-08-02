# Reward art — chapters 6, 7, 8 (Reward Horizon PRD-01 W6)

**Status:** awaiting the owner's Gemini renders. Until they land,
`src/config/rewardArtCoverage.test.ts` fails the build — that is the gate doing its job, not a
problem to work around (there is no glyph fallback left anywhere in the app).

The three new chapters add 27 rewards. **Ten of them were already baked** as game art and are wired
into `REWARD_REUSE` in `scripts/optimize-theme-art.mjs`, so they need re-trimming, not drawing:

| reward id | label | reused from |
|---|---|---|
| `hj-seng` | Seng | `english/bed` |
| `hj-stol` | Stol | `english/chair` |
| `hj-doer` | Dør | `english/door` |
| `hj-ur` | Ur | `ordleg/ur` |
| `hj-kop` | Kop | `english/cup` |
| `hj-noegle` | Nøgle | `english/key` |
| `leg-bold` | Bold | `english/ball` |
| `leg-ballon` | Ballon | `math/balloon` |
| `sk-and` | And | `ordleg/and` |
| `sk-bi` | Bi | `ordleg/bi` |

Two near-misses were deliberately NOT reused: `leg-bamse` (a teddy bear — `english/bear` is already
`dyr-bjoern`, and two slots showing identical art reads as a bug) and `sk-hoene` (a hen —
`farver/chick` is a chick).

**So the owner draws 17.** They are listed below in four batches of four (the last has five).

---

## How to run these

Paste **one batch per message**, all in **one chat thread** so the lighting and style carry across
the set — four subjects rendered in one pass look like a set, which is what a chapter needs.

Attach 2–3 existing renders from `src/assets/rewards/` (or the higher-res `art-src/` PNGs) as STYLE
references on every generation, and re-use your first good render as the consistency anchor for the
rest.

**Save each image with right-click → "Save image as…", never the download button on the image** —
the embedded button exports a processed copy that stamps the ✦ sparkle marker and can composite in
stray elements. Verify each render full-size; the in-chat preview crops.

Name each file by its **reward id** from the tables below (`hj-bord.png`, `leg-tromme.png`, …) and
drop the folder into `art-src/rewards/`. Then key + trim them with the reward path in
`scripts/optimize-theme-art.mjs`, which writes `src/assets/rewards/<id>.webp` (256×256, ≤20 KB,
square, trimmed, transparent). `rewardArtCoverage.test.ts` goes green when all 27 resolve.

---

## Batch 1 — Hjemmet (3) + Leg (1)

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A small wooden dining table seen from a slight 3/4 angle, four legs clearly visible, warm honey-brown clay. `hj-bord`
> 2. A simple bedside table lamp with a rounded fabric shade, switched on, soft warm glow — the glow must stay ON the lamp, no light spill onto the background. `hj-lampe`
> 3. A single metal teaspoon lying at a slight angle, bowl toward the upper left, soft silver clay with a gentle highlight — **not** greenish or teal-tinted metal. `hj-ske`
> 4. A soft cuddly teddy bear sitting upright, arms out, honey-tan clay with a small ribbon — clearly a TOY bear (stitched, stubby, sitting), not a realistic bear. `leg-bamse`

## Batch 2 — Leg og musik (4)

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A classic rag doll standing upright, round friendly face, simple red dress, yarn hair — soft and blunt, nothing porcelain or uncanny. `leg-dukke`
> 2. A single chunky wooden toy building block, cube, plain warm primary colour, rounded corners, **no letters or numbers on any face**. `leg-klods`
> 3. A small toy drum with a red-and-yellow body, two drumsticks resting across the top. `leg-tromme`
> 4. A small acoustic guitar seen face-on at a slight 3/4 angle, warm wood body, six strings, blunt rounded headstock. `leg-guitar`

## Batch 3 — Leg (1) + Fugle og småkryb (3)

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A simple recorder-style flute lying at a slight diagonal, cream-white clay with a soft mouthpiece, finger holes visible. `leg-floejte`
> 2. Four chunky jigsaw puzzle pieces loosely joined into a small square, each a different bright colour, thick rounded clay edges. `leg-puslespil`
> 3. A friendly round owl perched facing forward, big soft eyes, warm brown and cream feathers, small blunt beak — nothing sharp or staring. `sk-ugle`
> 4. A plump hen standing side-on, white and warm-brown feathers, small red comb, gentle round eye — an adult hen, not a chick. `sk-hoene`

## Batch 4 — Fugle og småkryb (5)

> Generate 5 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A graceful white swan side-on with its neck in a soft S-curve, orange beak, clean white clay. `sk-svane`
> 2. A cheerful parrot perched side-on, bright red body with blue and yellow wing, short blunt curved beak. `sk-papegoeje`
> 3. A butterfly seen from above with wings fully open and symmetrical, warm orange and yellow wings with soft dark edging — **the wings must not be green**, they share the screen's hue and will be keyed away. `sk-sommerfugl`
> 4. A friendly ant seen from a slight 3/4 side angle, three rounded body segments, deep warm red-brown clay, short blunt antennae — cute, never insectile or menacing. `sk-myre`
> 5. A ladybird seen from above, round bright red shell with black spots, small black head — clearly red, not orange. `sk-mariehoene`

---

## Keying notes for whoever processes the folder

Everything here is on the **green** screen (`#00FF00`), so it goes through `greenKeySprite`, not the
magenta path. Two subjects need attention:

- **`sk-sommerfugl`** — the prompt steers it warm/orange precisely because a green-winged butterfly
  is the exact failure mode that has bitten this pipeline twice (`natur-blad`): the hysteresis grow
  eats the subject, and then the despill flattens whatever survives to grey with a perfect
  silhouette. If a render does come back greenish, measure its green-excess histogram and raise
  `vivid` / `faint` / `despill` in `REWARD_KEY_OVERRIDES` above the subject's own excess — and
  **verify by comparing the output's average opaque RGB against the source's**, not by eyeballing
  the cut-out.
- **`hj-ske`** — a silver spoon can pick up a teal cast, and teal (g≈b, both high) slips past
  green-excess because `max(r,b)` is the blue. If it reads green after keying, neutralize on
  `g - r` instead.

Then: `rewardArtCoverage.test.ts` must go green (all 27 present, none over 20 KB, no orphans), and
the chapter chips in Min Bog draw `chapter.rewards[0]` — `hj-seng`, `leg-bold`, `sk-ugle` — so those
three specifically must resolve.

**Narration is already done** for all 27 labels (prebaked + audit-approved, 2026-08-02); the art is
the only thing outstanding.
