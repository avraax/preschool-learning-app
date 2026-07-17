# PRD-09 Farver baked-art — Gemini generation prompts (24 curated colour objects)

Self-contained prompts for the Farver baked art (Farvejagt draggable + collected objects, Hvilken Farve? dragged
object, Lær Farver example objects). Generated in **Gemini 2.5 Flash Image ("Nano Banana")**, keyed on the `#00FF00`
green screen via `.claude/rules/scene-assets.md`, dropped into `src/assets/games/farver/`.

**The colour is load-bearing.** Unlike the alphabet/math objects (which were theme-constant single subjects), every
Farver object must be baked **in its hue's true colour** — a *red* apple, a *blue* whale, a *green* cucumber — because
in-game the object rests frameless in the world with **no coloured backing tile**, so the baked art itself must read
the correct colour. Each prompt calls its exact hue out; keep it saturated and unambiguous.

**Colours are NOT generated as art** — the mixing droplets, colour swatches, and shade tiles stay pure-hex data
(`COLOR_SWATCH`/`SHADES`/`primaryColors`). Only these 24 *objects* are baked.

**These are shown SMALL and MANY** (Farvejagt scatters ~12 at once) — keep each simple, rounded, high-contrast and
instantly recognisable, no fine detail that turns to mush when tiny.

> ⚠️ **The four GREEN objects (`cucumber`, `turtle`, `clover`, `tree`) are green subjects on a green screen.** They key
> fine with the **green-EXCESS** method (not distance-to-pure-green — that eats the subject), but the render must keep a
> clearly *muted* green vs the *vivid* `#00FF00` screen. When generating them, lean the object's green a touch deeper /
> less neon so the excess gap is wide. (Same situation as math's crocodile — handled at keying time.)

---

## Setup (do this once, applies to every prompt)

1. **Attach these as style references on every generation** (they lock the clay material, lighting and palette so the
   set matches the app + the shipped alphabet/math art):
   - `art-src/icons/farver.png` (the Farver section icon)
   - `art-src/icons/math.png` (or any already-approved `src/assets/games/math/*.webp` once math ships)
   - (optional 3rd) an already-approved alphabet render, e.g. `src/assets/games/alphabet/A.webp`.
2. **After your first object looks right, also attach that render** as a reference for the rest — keeps scale/lighting
   consistent across the set. (Or generate them all in one Gemini chat so it remembers the style.)
3. **Output:** one flat solid `#00FF00` green background filling the frame, single centered subject, square 1:1,
   highest resolution offered.
4. **⚠️ DOWNLOAD via right-click → "Save image as…", NOT the download button embedded on the image.** The embedded
   button exports a *processed/branded* version — it stamps the ✦ sparkle marker and can composite in stray extra
   elements (a floating bar/blob, framing). Right-click → Save grabs the actual rendered PNG, which is clean. (This was
   the mystery "elements added on download" — it was the export button, not the render.)
5. **Naming:** save/rename each download to its **art id** (the id column in PRD-09 §4) so it places deterministically —
   all ids are ASCII (no Æ/Ø/Å aliasing needed). Then hand me the folder and I key + convert to `≤40 KB` WebP and wire
   it in (auto-registers, no code change).
6. **If the render ITSELF is off** (a genuine second object in the generated image, wrong colour, mangled subject —
   visible in the full-size chat preview, not just the export): regenerate (Gemini is stochastic — a re-roll usually
   comes back clean). If an extra object persists after ~2 re-rolls, append this clause to that prompt:
   > *ABSOLUTELY NOTHING ELSE in the frame — no second object, no props, no floating shapes, no bars or rods, no background elements. ONLY the [subject] and the flat green background.*
   Even a stray floating blob or a stray sparkle in the raw PNG can be dropped at keying time (despeckle /
   floating-island / keep-largest-component removal), so a not-perfectly-clean download is usually salvageable — only a
   stray that **overlaps/touches the subject** needs a re-roll.

Each prompt below is complete on its own — copy one, attach the reference images, generate.

---

## RØD (red) — 4 objects

**apple — æble**  → save as `apple`
> A single shiny bright RED apple: a round glossy red body with a small brown stem and one small green leaf on top, clearly and saturatedly red. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**car — bil**  → save as `car`
> A single cute rounded toy car with a bright saturated RED body, friendly chunky proportions and round dark wheels, seen from a friendly 3/4 front angle, clearly red. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**rose — rose**  → save as `rose`
> A single RED rose bloom seen from a friendly front-top angle: soft rounded red petals spiralling from the centre with a hint of a short green stem, clearly and warmly red. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no thorns). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**strawberry — jordbær**  → save as `strawberry`
> A single plump RED strawberry: a rounded heart-shaped red berry with tiny light seed dots and a small green leafy top, glossy and appetising, clearly red. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## BLÅ (blue) — 4 objects

**whale — hval**  → save as `whale`
> A single cute round friendly BLUE whale seen from the side: a plump blue body, a big happy eye, a small soft tail and a tiny water spout, clearly and cheerfully blue. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**blueberry — blåbær**  → save as `blueberry`
> A single small cluster of round BLUE blueberries (three or four berries touching), deep saturated blue with a soft matte bloom and tiny star-shaped tops, clearly blue. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**truck — lastbil**  → save as `truck`
> A single cute chunky BLUE truck with a friendly rounded cab and a simple cargo box, round dark wheels, seen from a friendly 3/4 front angle, clearly blue. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**shirt — skjorte**  → save as `shirt`
> A single simple BLUE shirt / t-shirt shown flat and front-on with short sleeves and a rounded neckline, one clean saturated blue, soft folds, clearly blue. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## GRØN (green) — 4 objects  ⚠️ green subjects — keep the object's green clearly muted vs the neon screen

**cucumber — agurk**  → save as `cucumber`
> A single GREEN cucumber lying at a slight angle: a rounded elongated deep-green body with a gently bumpy matte skin, clearly a muted natural green (noticeably deeper and less neon than a pure chroma green). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**turtle — skildpadde**  → save as `turtle`
> A single cute GREEN turtle seen from a friendly 3/4 top angle: a rounded muted-green shell, a small friendly head and four little legs, big happy eyes, clearly a natural muted green (deeper and less neon than a pure chroma green). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**clover — kløver**  → save as `clover`
> A single GREEN four-leaf clover seen from the front: four rounded heart-shaped leaves on a tiny short stem, a clearly muted natural green (deeper and less neon than a pure chroma green). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**tree — træ**  → save as `tree`
> A single cute rounded GREEN tree: a chunky brown trunk topped by a soft rounded muted-green leafy canopy, simple and friendly, clearly a natural muted green (deeper and less neon than a pure chroma green). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## GUL (yellow) — 4 objects

**sun — sol**  → save as `sun`
> A single cheerful YELLOW sun: a round golden-yellow face with soft rounded rays and a gentle happy smile, warm and glowing, clearly yellow. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**banana — banan**  → save as `banana`
> A single YELLOW banana with a gentle curve and small brown tips, bright saturated yellow, clearly yellow. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**corn — majs**  → save as `corn`
> A single YELLOW corn cob with neat rounded golden-yellow kernels and a couple of soft green husk leaves at the base, clearly yellow. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**chick — kylling**  → save as `chick`
> A single tiny fluffy YELLOW baby chick: a round soft yellow body, a tiny orange beak, big happy eyes and little wings, clearly yellow. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## LILLA (purple) — 4 objects

**grapes — druer**  → save as `grapes`
> A single bunch of round PURPLE grapes in a soft triangular cluster with a tiny green stem and one small leaf, saturated purple with a soft matte bloom, clearly purple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**eggplant — aubergine**  → save as `eggplant`
> A single PURPLE eggplant / aubergine: a rounded glossy deep-purple body with a small green stem cap, clearly purple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**crystal — krystal**  → save as `crystal`
> A single PURPLE crystal ball / gem: a smooth rounded translucent-looking purple crystal with a soft glossy highlight, magical but calm, clearly purple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**heart — hjerte**  → save as `heart`
> A single plump PURPLE heart: a rounded glossy purple heart shape, cheerful and soft, clearly purple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## ORANGE (orange) — 4 objects

**orange_fruit — appelsin**  → save as `orange_fruit`
> A single ORANGE citrus fruit: a round dimpled orange body with a small green leaf on top, bright saturated orange, clearly orange. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**pumpkin — græskar**  → save as `pumpkin`
> A single friendly ORANGE pumpkin: a rounded ribbed orange body with a small brown stem and one green leaf — plain and cheerful with NO carved face, clearly orange. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no scary carved face). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**fox — ræv**  → save as `fox`
> A single cute ORANGE fox seen from a friendly 3/4 angle: a rounded orange body and head with a white muzzle and chest, soft rounded ears and a fluffy tail, big happy eyes, clearly orange. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no sharp teeth). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**carrot — gulerod**  → save as `carrot`
> A single ORANGE carrot: a rounded tapered orange root with soft ridges and a small green leafy top, bright saturated orange, clearly orange. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

*When the batch is generated + named (by art id), drop the folder path to me — I key on the #00FF00 excess (green
EXCESS, not distance-to-pure-green), trim + square-contain, compress to ≤40 KB WebP, place them in
`src/assets/games/farver/`, and screenshot-verify the objects at small size across all 4 skins. NB the four GREEN
objects (cucumber/turtle/clover/tree) are green subjects on a green screen — I'll key them with a border flood-fill +
size-capped despeckle so the screen goes but the object stays (per scene-assets rules); the deeper-than-neon green you
render is what makes that gap safe.*
