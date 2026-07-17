# PRD-08 Math baked-art — Gemini generation prompts (8 counting objects + 1 krokodille)

Self-contained prompts for the math baked art (Tal Quiz counting hero, Lær Tal bloom count, Sammenlign
Tal object piles + krokodille, Hukommelse Tal card icon). Generated in **Gemini 2.5 Flash Image
("Nano Banana")**, keyed on the `#00FF00` green screen via `.claude/rules/scene-assets.md`, dropped
into `src/assets/games/math/`.

**Numerals are NOT generated** (glyphs stay Typography — recognising the numeral IS the lesson). The
math operators `+ − = ? > <` are also NOT here (already baked as `SymbolTile` art). Only the *counting
objects* (things the child counts) and the *krokodille character* are baked.

**Counting objects must read cleanly at SMALL size** — up to ~20–30 are shown at once, so keep each one
simple, rounded, high-contrast and instantly countable (no fine detail that turns to mush when tiny).

---

## Setup (do this once, applies to every prompt)

1. **Attach these as style references on every generation** (they lock the clay material, lighting and
   palette so the set matches the app):
   - `art-src/icons/math.png`
   - `art-src/icons/alphabet.png`
   - (optional 3rd) any already-approved alphabet render (e.g. `src/assets/games/alphabet/A.webp`).
2. **After your first object looks right, also attach that render** as a reference for the rest — it
   keeps scale/lighting consistent across the whole set. (Or generate them all in one Gemini chat so
   it remembers the style.)
3. **Output:** one flat solid `#00FF00` green background filling the frame, single centered subject,
   square 1:1, highest resolution offered. Download as PNG.
4. **Naming:** save/rename each download to its id so the art places deterministically —
   `apple`, `balloon`, `star`, `flower`, `car`, `ball`, `bird`, `fish`, and `crocodile`. Then hand me
   the folder and I key + convert to `≤40 KB` WebP and wire it in (no code change — it auto-registers).

Each prompt below is complete on its own — copy one, attach the reference images, generate.

---

## The 8 counting objects

**apple — æble**  → save as `apple`
> A single shiny red apple: a round glossy red body with a small brown stem and one green leaf on top, fresh and appetizing, a simple clean shape that stays clearly countable when shown small. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary or sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**balloon — ballon**  → save as `balloon`
> A single cheerful party balloon: a round glossy balloon in one bright cheerful colour with a small knot and a short curly string, a simple clean shape that stays clearly countable when shown small. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary or sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**star — stjerne**  → save as `star`
> A single plump five-pointed star with soft rounded points in a warm golden-yellow, cheerful and glowing gently, a simple clean shape that stays clearly countable when shown small. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary or sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**flower — blomst**  → save as `flower`
> A single simple cheerful flower seen from the front: a round centre with a ring of soft rounded petals in one bright cheerful colour and a tiny green stem hint, a simple clean shape that stays clearly countable when shown small. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary or sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**car — bil**  → save as `car`
> A single cute rounded toy car with a bright cheerful body, friendly chunky proportions and round wheels, seen from a friendly 3/4 front angle, a simple clean shape that stays clearly countable when shown small. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary or sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**ball — bold**  → save as `ball`
> A single cheerful play ball: a round ball with a simple friendly two-colour pattern, glossy and bouncy-looking, a simple clean shape that stays clearly countable when shown small. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary or sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**bird — fugl**  → save as `bird`
> A single tiny round friendly cartoon bird with a plump body in a cheerful colour, a small soft beak, big happy eyes and tiny rounded wings, a simple clean shape that stays clearly countable when shown small. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary or sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**fish — fisk**  → save as `fish`
> A single cute cartoon fish with a rounded body in a bright cheerful colour, one big friendly eye and soft rounded fins, seen from the side, a simple clean shape that stays clearly countable when shown small. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary or sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## The krokodille character (Sammenlign Tal)

**crocodile — krokodille**  → save as `crocodile`
> A single friendly, cute cartoon crocodile seen in side profile, with a soft rounded body, a gentle rounded snout and a friendly closed or softly-smiling mouth — absolutely NO sharp or bared teeth, huggable and calm, definitely not scary. It should look ready to gently "chomp" but be completely child-safe. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no sharp teeth, no dark or startling elements). Side profile so it faces left/right, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

*When the batch is generated + named, drop the folder path to me — I key on the #00FF00 excess (green
EXCESS, not distance-to-pure-green — the crocodile is green and must NOT be eaten), trim + square-contain,
compress to ≤40 KB WebP, place them in `src/assets/games/math/`, and screenshot-verify the counting piles
at small size across the skins. NB the crocodile is a green subject on a green screen — I'll key it with a
border flood-fill + size-capped despeckle so the screen goes but the croc stays (per scene-assets rules).*
