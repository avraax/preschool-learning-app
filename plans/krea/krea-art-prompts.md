# Krea — Gemini art prompts

Status: **checked 2026-10-16 (PRD-01 W0), rewritten the same day with the Fyld Båden lessons**
(`plans/harbour-game/harbour-art-prompts.md`, `.claude/rules/scene-assets.md`). Every batch is
SELF-CONTAINED: attach its listed files, paste its grey block as ONE message. Nothing refers back to
another batch.

## How to use this (read once)

- **One chat per batch letter.** Attach that batch's files with the FIRST message only; the style
  carries within the thread.
- **Four separate images per message mostly works, and is not guaranteed.** If one comes back as ONE
  picture with four inside, save it anyway — the implementer cuts it into quadrants. If a subject
  matters or keeps coming back wrong, use the **one-per-message form** at the bottom of each batch;
  that is the only form that is reliably separate.
- **Save with right-click → "Save image as…"** into `C:\Users\AllanBrinkVraa\Downloads\art-krea`. Never
  the download button on the image: it stamps a ✦ watermark and can add stray elements.
- **Resolution comes back at ~1024 px** whatever is asked. That is enough for every icon and crayon;
  the backdrop is upscaled afterwards if needed.
- Tell the implementer when a batch is done. Every image is validated before anything is wired (the
  share of the frame that is screen green, item count, watermark, keying, silhouette at true size) and
  you get a contact sheet.
- **Not generated:** beads, pegs, guide lines, numerals and the paper's ink are drawn in code. **Stamps
  reuse existing game art** (sun, heart, star, flower, fish, butterfly, cat, dog).

What each reference image is FOR (said in every prompt so Gemini doesn't copy the wrong thing):
- `math.counting.webp`, `colors.ram-farven.webp` — **style only**: the clay, the lighting, the shadow.
- `art-src/...` / a shipped Krea render — **consistency** with an earlier batch, once one exists.

---

## Batch A — the studio backdrop (PRD-01)

A **scene layer, not a keyed subject**: wide, opaque, no green. Two takes are welcome.

**Attach these 2 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
Generate exactly ONE image: a wide landscape picture, 16:9. Soft-3D claymation style, Pixar-lite, rounded matte clay, warm and child-safe, soft daylight from a window on the upper left. Match the clay style and lighting of the attached images, but NOT their subjects and NOT their green background — this picture has a real room behind it.

A cosy children's art studio seen STRAIGHT ON at a child's eye level. CAMERA (most important): looking straight at the wall, not turned; the table's front edge is a perfectly HORIZONTAL straight line, parallel to the bottom of the image.

A big light honey-wood table fills the whole lower third of the image, seen slightly from above. Behind it, a pale warm-cream wall with ONE large window on the left showing soft daylight, a few clay leaves of a plant on the windowsill, and two children's paintings pinned to the wall (simple abstract colour blobs, no faces, no text).

The middle of the table is EMPTY — nothing on it at all — because a sheet of paper will be placed there later. No people, no hands, no crayons, no text, no letters, no numbers. Calm, uncluttered, gentle colours, so bright crayon colours stand out in front of it.
```

Second take, same chat:

```
Generate exactly ONE more image: a second take of the SAME studio, same camera, same style and colours, the table still EMPTY in the middle. One image only.
```

## Batch B — crayons 1–4 (PRD-01)

**Attach these 2 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single crayon on its own full green background.

Style for every image: soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1. Match the clay style and lighting of the attached images (style only — not their subjects).

Every image is the SAME chunky children's wax crayon: short and fat, about FOUR times as long as it is wide (not longer), lying diagonally from lower-left to upper-right, pointed tip at the upper right, a plain paper wrapper band around the middle with NO writing. Identical shape, size, pose and camera in all four; only the colour differs. The colour is pure and saturated, exactly as named.

Image 1: a RED crayon (pure red, like a fire truck).
Image 2: an ORANGE crayon.
Image 3: a YELLOW crayon (sunny lemon yellow).
Image 4: a BLUE crayon (pure medium blue).

Remember: one crayon per image on flat solid #00FF00 — and four separate image files, not one picture containing four.
```

One-per-message form (same chat): *"Generate exactly ONE image: the same chunky crayon, same shape, pose, camera and flat solid #00FF00 background, in RED. One image only."* — then repeat with each colour.

## Batch C — crayons 5–8 (PRD-01)

The two greens sit on a green screen, so each gets its own keying override; expect a re-take if an edge
gets eaten.

**Attach these 2 files** (plus your best crayon from Batch B as a third, if you have it):
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single crayon on its own full green background.

Style for every image: soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1. Match the clay style and lighting of the attached images (style only).

Every image is the SAME chunky children's wax crayon: short and fat, about FOUR times as long as it is wide, lying diagonally from lower-left to upper-right, pointed tip at the upper right, a plain paper wrapper band with NO writing. Identical shape, size, pose and camera in all four; only the colour differs.

Image 1: a GREEN crayon in a DARK grass green — clearly darker than the #00FF00 background, with a soft dark outline so it separates from it.
Image 2: a LIGHT GREEN crayon (pale lime) — clearly different from the #00FF00 background, with a soft darker outline.
Image 3: a PURPLE crayon.
Image 4: a PINK crayon (soft bubble-gum pink).

Remember: one crayon per image on flat solid #00FF00 — and four separate image files, not one picture containing four.
```

## Batch D — crayons 9–12 (PRD-01)

**Attach these 2 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single crayon on its own full green background.

Style for every image: soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1. Match the clay style and lighting of the attached images (style only).

Every image is the SAME chunky children's wax crayon: short and fat, about FOUR times as long as it is wide, lying diagonally from lower-left to upper-right, pointed tip at the upper right, a plain paper wrapper band with NO writing. Identical shape, size, pose and camera in all four; only the colour differs.

Image 1: a LIGHT BLUE crayon (sky blue).
Image 2: a BROWN crayon (chocolate brown).
Image 3: a BLACK crayon (soft clay black, still with a gentle highlight).
Image 4: a WHITE crayon (clay white with soft grey shading so it reads on a light background).

Remember: one crayon per image on flat solid #00FF00 — and four separate image files, not one picture containing four.
```

## Batch E — tool props (PRD-01)

**Attach these 2 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single object on its own full green background.

Style for every image: one centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down angle, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1. Match the clay style and lighting of the attached images (style only).

Image 1: a RAINBOW crayon — a chunky short crayon, about four times as long as it is wide, lying diagonally, its body striped in rainbow bands (red, orange, yellow, DARK green, blue, purple) running along its length.
Image 2: a small glitter shaker tube with a star-shaped cap, sparkly gold glitter inside, three tiny gold stars floating just above the cap. The stars float on flat solid #00FF00 — NOT on a sky.
Image 3: a chunky children's rubber stamp with a round wooden handle on top and a red rubber base, seen from a 3/4 angle.
Image 4: a soft pink rubber eraser, chunky and rounded, slightly worn at one corner.

Remember: one object per image on flat solid #00FF00 — and four separate image files, not one picture containing four.
```

## Batch F — buttons as objects (PRD-01)

**Attach these 2 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single object on its own full green background.

Style for every image: one centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1. Match the clay style and lighting of the attached images (style only).

Image 1: a fresh, clean, slightly curled sheet of white paper, seen from above at a slight angle, completely blank, with one corner gently curled up.
Image 2: a small curved clay arrow pointing back to the left, like an "undo" arrow, in warm blue.
Image 3: a big round friendly clay button in a DEEP emerald green — clearly darker than the #00FF00 background, with a soft dark outline — with a chunky white tick mark on it (a check mark, no letters).
Image 4: a big round friendly clay button in warm orange with a chunky white arrow pointing right on it.

Remember: one object per image on flat solid #00FF00 — and four separate image files, not one picture containing four.
```

## Batch G — the section icon and the tile icons (two messages)

Checked 2026-10-16: the first draft's section icon was a clay paint PALETTE — **Farver's home icon
already**, so the two would be twins side by side on the home arc. It is an easel. **The section icon
is on legacy MAGENTA** (`scene-assets.md`); the tiles are on green.

**Attach these 3 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\colors.webp` — a section icon, for style
  and the MAGENTA-keyed look; do NOT copy its palette subject
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

Message 1:

```
Generate exactly ONE image.

Style: one centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down angle, no text or letters, flat solid #FF00FF magenta background edge to edge, square 1:1. Match the clay style and lighting of the attached images — style only, NOT their subjects (the attached paint palette is a DIFFERENT section's icon; do not draw a palette).

The subject: a small wooden children's art easel holding a canvas with a bright rainbow scribble painted on it, and a little cup of chunky crayons standing at the easel's foot. It is clearly an EASEL — not a paint palette.

Remember: one image, flat solid #FF00FF magenta behind it.
```

Message 2, same chat:

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single subject on its own full GREEN background.

Style for every image: one centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down angle, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1. Same clay style and lighting as the easel.

Image 1: a sheet of white paper with a bright rainbow scribble on it and a chunky red crayon lying on it.
Image 2: a sheet of white paper with a cat's head drawn in thick friendly black lines (a circle head, two triangle ears, dot eyes), with a pencil beside it.
Image 3: a simple flower picture on white paper, half coloured in (the petals pink, the rest still white), with a small open paint pot beside it. The stem stays white — no green.
Image 4: a small square clear pegboard with a heart made of red ironing beads on it, seen from above at a slight angle.

Remember: flat solid #00FF00 green this time (not magenta) — and four separate image files, not one picture containing four.
```

## Batch H — colour-in pages (PRD-01 Farvelæg), 12 pages in 3 messages

**This is LINE ART, not claymation. Attach NOTHING** — a clay reference pulls in shading. Each page goes
through `scripts/krea-regions.mjs`, which **rejects** grey shading, so the "no shading" wording matters.

Message 1:

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet.

Style for every image: a children's colouring-book page for a 5-year-old. THICK, smooth, solid BLACK outlines only, all of equal heavy weight, on a pure WHITE background. Every shape is a CLOSED outline (no gaps in any line) so each area can be filled with colour. Large simple areas, at most about 15 areas in the whole picture, no tiny details, no hatching, no texture, NO grey, NO shading, NO colour, no text, no letters. Friendly, rounded, cute. The subject fills most of the square. Square 1:1.

Image 1: a happy dog sitting, seen from the front.
Image 2: a round owl on a branch with big eyes.
Image 3: a smiling frog sitting on a lily pad.
Image 4: a beach with a big sun, one wave, a bucket and a spade.

Remember: black outlines on white only, NO grey and NO shading — and four separate image files, not one picture containing four.
```

Message 2, same chat:

```
FOUR SEPARATE IMAGES again, exactly the same colouring-book style: thick equal black closed outlines on pure white, at most about 15 large areas, NO grey, NO shading, NO colour, no text. Not one picture containing four.

Image 1: a forest with two round trees and three big mushrooms in front.
Image 2: a town at night: three simple houses with windows, a big moon and a few big stars. (Black OUTLINES only — the night sky stays WHITE.)
Image 3: a little steam train with three wagons seen from the side.
Image 4: a sailing boat on one wave with a big triangular sail.
```

Message 3, same chat:

```
FOUR SEPARATE IMAGES again, exactly the same colouring-book style: thick equal black closed outlines on pure white, at most about 15 large areas, NO grey, NO shading, NO colour, no text. Not one picture containing four.

Image 1: an ice cream cone with three big scoops.
Image 2: a friendly unicorn standing, seen from the side.
Image 3: a round rocket ship with two windows and flames at the bottom, a planet behind it. (Outlines only — the space behind stays WHITE.)
Image 4: a friendly dragon standing in front of a small castle with two towers.
```

## Batch I — Perleplade props (PRD-02)

**Attach these 2 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single object on its own full green background.

Style for every image: one centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1. Match the clay style and lighting of the attached images (style only).

Image 1: a small round shallow clay bowl, seen from slightly above, EMPTY, in soft warm white.
Image 2: a clear square plastic pegboard for children's ironing beads, seen STRAIGHT from above (not tilted), slightly frosted, the pegs a grid of tiny bumps. It must stay clearly visible on the green: give it a soft frosted WHITE tint and a visible edge.
Image 3: a pair of chunky children's plastic tweezers in bright blue, seen from the side, tips pointing down-left.
Image 4: a rounded clay picture-card frame in warm cream with a soft border, EMPTY inside (a blank cream centre).

Remember: one object per image on flat solid #00FF00 — and four separate image files, not one picture containing four.
```

The circle, heart, star and fish board outlines are **masks drawn in code** over the square board's
plastic. No extra art is needed.

---

## For the build session (not for pasting)

- Validate before keying: screen-green share of the frame (~75–95% is a good render; far less means
  Gemini painted a scene), item count, ✦ watermark, collage gutters (split + crop ~420 px quadrants).
- Key with `scripts/optimize-theme-art.mjs`, never a hand-rolled key; judge green subjects by the
  `g − max(r,b)` histogram, not by eye. Expected overrides: Batch C green + light green, Batch F
  emerald button, the rainbow crayon's green band.
- The backdrop (A) is an opaque passthrough, upscaled if it arrives at ~1024×576.
- Line art (H) goes through `krea-regions.mjs` (grey-pixel rejection, min-area merge) — PRD-01 §4.4.
