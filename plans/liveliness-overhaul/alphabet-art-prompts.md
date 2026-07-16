# PRD-07 Alphabet baked-art — Gemini generation prompts (25 subjects)

Self-contained prompts for the alphabet letter-subject art (Bogstav Quiz hero, Lær Alfabetet bloom,
Hukommelse card icon). Generated in **Gemini 2.5 Flash Image ("Nano Banana")**, keyed on the
`#00FF00` green screen via `.claude/rules/scene-assets.md`, dropped into `src/assets/games/alphabet/`.

**Q, W, X, Å are intentionally NOT generated** (owner decision — glyph-only everywhere).

---

## Setup (do this once, applies to every prompt)

1. **Attach these as style references on every generation** (they lock the clay material, lighting and
   palette so the 25 match each other and the rest of the app):
   - `art-src/icons/math.png`
   - `art-src/icons/alphabet.png`
   - (optional 3rd) `art-src/icons/colors.png`
2. **After your first subject looks right, also attach that render** as a reference for the remaining
   24 — it keeps scale/lighting consistent across the whole set. (Or generate them all in one Gemini
   chat so it remembers the style.)
3. **Output:** one flat solid `#00FF00` green background filling the frame, single centered subject,
   square 1:1, highest resolution offered. Download as PNG.
4. **Naming:** save/rename each download to its letter so the art can be placed deterministically —
   `A`, `B`, `C` … `Z`, and **`AE` for Æ, `OE` for Ø** (or the raw glyph `Æ`/`Ø`). Then hand me the
   folder and I key + convert to `≤40 KB` WebP and wire it in (no code change — it auto-registers).

Each prompt below is complete on its own — copy one, attach the reference images, generate.

---

## The 25 prompts

**A — Abe (monkey)**
> A single friendly, cute cartoon monkey with soft brown fur, big happy eyes and a gentle smile, sitting upright and waving one hand. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no sharp teeth, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**B — Bil (car)**
> A single cute rounded toy car with a bright cherry-red body, friendly chunky proportions and round wheels, seen from a friendly 3/4 front angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**C — Cykel (bicycle)**
> A single cute child's bicycle with two round wheels, a friendly rounded frame in a cheerful color and a small front basket, standing upright seen from a 3/4 side angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**D — Drage (dragon)**
> A single friendly, cute baby dragon with a rounded chunky body, small soft wings, big happy eyes and tiny rounded horns, smiling — huggable and gentle, absolutely NO sharp teeth or claws, not scary. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**E — Elefant (elephant)**
> A single friendly, cute cartoon elephant with a soft grey body, big floppy ears, a gentle curved trunk and happy eyes, standing. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**F — Fisk (fish)**
> A single cute cartoon fish with a rounded body in a bright cheerful color, one big friendly eye and soft rounded fins, seen from the side. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**G — Giraf (giraffe)**
> A single friendly, cute cartoon giraffe with a long soft neck, a yellow-orange coat with soft brown patches, tiny rounded ossicone horns and happy eyes, standing. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**H — Hund (dog)**
> A single cute, friendly cartoon puppy dog with soft fur, floppy ears, big happy eyes and a gentle smile, sitting. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**I — Is (ice-cream cone)**
> A single ice-cream cone with one or two rounded soft scoops in cheerful pastel colors on a golden waffle cone, appetizing and cheerful. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**J — Jul (Christmas tree)**
> A single decorated Christmas tree: a green conical fir with small round baubles in cheerful colors and a soft star on top, festive and friendly. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**K — Kat (cat)**
> A single cute, friendly cartoon cat with soft fur, rounded ears, big happy eyes, a gentle smile and a curled tail, sitting. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**L — Løve (lion)**
> A single friendly, cute cartoon lion with a soft rounded mane, warm golden fur, big happy eyes and a gentle smile — cuddly and not fierce, NO sharp teeth, sitting. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**M — Mus (mouse)**
> A single cute, friendly cartoon mouse with a small grey body, big round ears, a tiny pink nose, happy eyes and a long soft tail, standing. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**N — Næsehorn (rhinoceros)**
> A single friendly, cute cartoon rhinoceros with a chunky grey body, a soft rounded blunt horn (not sharp), happy eyes and a gentle smile, standing. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**O — Orm (worm)**
> A single cute, friendly cartoon earthworm with a soft pinkish segmented body curved in a gentle arc, big happy eyes and a small smile — cheerful, not creepy. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**P — Panda (panda)**
> A single cute, friendly cartoon panda with a round black-and-white body, big black eye patches, happy eyes and a gentle smile, sitting. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**R — Raket (rocket)**
> A single cute cartoon rocket ship with a rounded red-and-white body, small fins, a round window porthole and a soft warm flame at the base, pointing upward. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**S — Sol (sun)**
> A single cheerful cartoon sun: a round warm golden-yellow body with soft rounded rays and a gentle friendly smiling face, bright and warm. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**T — Tog (steam train)**
> A single cute cartoon steam-train locomotive with a rounded friendly engine, a chimney with a little soft steam puff, round wheels and a cheerful color, seen from a friendly 3/4 angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**U — Ugle (owl)**
> A single cute, friendly cartoon owl with a round fluffy body, big round eyes, a small soft beak and tiny wings, perched — sweet and calm. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**V — Vulkan (volcano)**
> A single friendly cartoon volcano: a rounded brown-grey mountain with a small gentle glow of warm orange lava at the top and a soft puff of smoke — cheerful and NOT scary, no violent eruption. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Y — Yoyo (yo-yo)**
> A single cute yo-yo toy: two round discs joined by an axle in a cheerful two-tone color, with a string and a small finger loop, seen from a friendly 3/4 angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Z — Zebra (zebra)**
> A single friendly, cute cartoon zebra with a rounded white body and soft black stripes, a short mane, big happy eyes and a gentle smile, standing. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Æ — Æble (red apple)**  → save as `AE`
> A single shiny red apple: a round glossy red body with a small brown stem and one green leaf on top, fresh and appetizing. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Ø — Ørn (eagle)**  → save as `OE`
> A single friendly, cute cartoon eagle with a rounded brown body, a white head, big happy eyes, a small soft golden beak and soft folded wings — gentle, not fierce, no emphasized talons. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## The extra 4 (Q / W / X / Å) — previously glyph-only, now with art

No entry in the shared word manifest, so these use the most honest picturable Danish subject.
**Wiring caveat:** to make them actually appear in-game they need `LETTER_WORDS` entries (I'll add
them when the art lands). That gives them a picture+word in **Lær Alfabetet** and **Hukommelse**
for free; whether they should also become *askable* Bogstav Quiz prompt letters is a separate call
(Q especially has no natural spoken first-sound word) — I'll confirm with you before enabling that.

**Q — Quiz (a friendly question mark)**  → save as `Q`
> A single big, chunky, friendly question-mark symbol sculpted as a rounded 3D clay object in a cheerful bright color (with its round dot below it), the playful "quiz" icon. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin — the single question-mark symbol is the intended subject; no other text, letters or words anywhere. High detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**W — Wienerbrød (Danish pastry)**  → save as `W`
> A single Danish pastry (wienerbrød): a golden, flaky glazed swirl pastry with a little white icing drizzle, appetizing and cheerful. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**X — Xylofon (xylophone)**  → save as `X`
> A single cute toy xylophone: a row of rainbow-colored bars on a friendly rounded frame with two small mallets resting beside it, cheerful and playful. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Å — Å (a small stream / brook)**  → save as `AA`
> A single small winding stream (a little blue-water brook curving through soft green grassy banks with a few smooth rounded pebbles), calm and cheerful. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely child-safe (nothing scary, no dark or startling elements). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

*When the batch is generated + named, drop the folder path to me — I key on the #00FF00 excess,
trim + square-contain, compress to ≤40 KB WebP, place them in `src/assets/games/alphabet/`, and
screenshot-verify across the skins.*
