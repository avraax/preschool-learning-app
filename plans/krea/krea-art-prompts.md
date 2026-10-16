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

# RE-RENDERS — validation of the first pass (2026-10-16)

All 47 files in `C:\Users\AllanBrinkVraa\Downloads\art-krea` were measured and looked at full size.
**24 are accepted**, **18 need a re-render** (below), and **1 picture was never asked for and is
needed** (Batch J, the demo pencil). Put the new files in the same folder; the old ones can stay — the
accepted list below names exactly which files are used.

Why each one goes back, in one line each:
- **Crayons 5–12 (all of Batches C and D).** The two batches came back as three different crayon
  shapes. Green, light green and purple have a dark brown HALO around them (Gemini over-did the "soft
  dark outline" the first prompt asked for — the outline turned out not to be needed: the greens
  measure keyable without it). Brown has a BLUE end cap. Black and white have no paper wrapper, so
  they read as markers. In the app all twelve lie side by side in one row, so the row must look like
  ONE box of crayons. Re-rendered against the accepted red crayon as an exact shape reference.
- **Rainbow crayon.** A third, stubbier shape, and a dark vignetted background (it keys worse).
- **Undo arrow.** It came back as a pile of clay pebbles with a tiny arrow on one.
- **Owl page.** A PHOTO of a colouring book on a table: grey surround and paper shadow — the region
  script rejects grey, and the page is not square-on.
- **Train page.** The train is a thin strip across the middle third: wheels and windows end up ~20 px
  on the iPad, too small for a five-year-old to hit.
- **Sailboat page.** The sea and the sky are ONE region (the wave stops before the edge, so a tap on the
  sky fills the sea too).
- **Ice cream page.** The waffle grid on the cone is dozens of tiny diamonds; the region script merges
  them into the lines and the cone can't be coloured at all.
- **Dragon & castle page.** Thin lines (half the weight of the others), brick detail, and the ground
  line stops short, so the ground and the sky are one region.
- **Bead-heart tile icon (PRD-02).** The board stands on a grey table filling the bottom half — not
  keyable.
- **Pegboard (PRD-02).** Clear plastic on a green screen IS green: 93% of the board measures as screen
  colour, so the key would delete it. It must be milky/opaque.
- **Tweezers (PRD-02).** A blue U-shape with no tips; it reads as a magnet, not tweezers.

**Optional:** the beach page is usable (big sky/sea/sand regions) but its lines are thin and it has
footprints and a shell too small to colour. Re-render only if you are in the line-art chat anyway.

## R1 — crayons 5–8, re-render (one chat for R1 + R2 + R3)

**Attach these 3 files:**
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\1ac5cf90-10fc-4583-9312-66ee2429e009.jpg` — **the shape
  to copy exactly** (the accepted red crayon)
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single crayon on its own full green background.

Copy the attached RED CRAYON EXACTLY: the same shape, the same thickness, the same rounded end, the same pointed tip, the same cream paper wrapper band around the middle, the same diagonal pose, the same size in the frame, the same camera, the same soft contact shadow and the same lighting. ONLY the colour of the wax changes. No outline, no halo and no border around the crayon. The other two attached images are for the clay style only.

Background for every image: flat solid #00FF00 green, edge to edge, no vignette, no gradient. Square 1:1. No text or letters.

Image 1: the crayon in a DEEP FOREST GREEN (clearly darker than the background).
Image 2: the crayon in a PALE YELLOW-GREEN (soft lime).
Image 3: the crayon in PURPLE.
Image 4: the crayon in soft BUBBLE-GUM PINK.

Remember: the exact shape of the attached red crayon, no outline — and four separate image files, not one picture containing four.
```

## R2 — crayons 9–12, re-render (same chat)

```
FOUR SEPARATE IMAGES again — the SAME crayon as the attached red one, copied exactly: same shape, thickness, rounded end, pointed tip, cream paper wrapper band, pose, size, camera, shadow and light. Only the wax colour changes. No outline, no halo. Flat solid #00FF00 green background edge to edge, no vignette. Not one picture containing four.

Image 1: the crayon in LIGHT SKY BLUE.
Image 2: the crayon in CHOCOLATE BROWN — the WHOLE wax body brown, both ends brown, nothing blue.
Image 3: the crayon in soft clay BLACK, still with a gentle highlight, WITH the same cream paper wrapper band.
Image 4: the crayon in clay WHITE with soft grey shading so it reads on a light background, WITH the same cream paper wrapper band.
```

## R3 — the rainbow crayon, re-render (same chat)

```
Generate exactly ONE image: the SAME crayon as the attached red one, copied exactly (shape, thickness, rounded end, pointed tip, cream paper wrapper band, pose, size, camera, shadow, light), but its wax is striped in RAINBOW bands running around the crayon — red, orange, yellow, DARK green, blue, purple — on the parts not covered by the wrapper. The tip is red. Flat solid #00FF00 green background edge to edge, no vignette, no gradient. One image only.
```

## R4 — the undo arrow, re-render (new chat)

**Attach these 2 files:**
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\7aa67d00-961a-415d-9fc0-173545fdca0f.jpg` — the accepted
  orange "next" button, for style and size
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`

```
Generate exactly ONE image: a single chunky curved ARROW made of warm-blue clay, like an "undo" sign — a thick rounded arc that curls over from right to left and ends in a big rounded arrow head pointing to the LEFT. Nothing else: no pebbles, no balls, no stones, no button under it, no base. Soft-3D claymation style matching the attached orange button (same clay, same lighting, same soft contact shadow). One centered subject filling most of the square, flat solid #00FF00 green background edge to edge, square 1:1, no text. One image only.
```

## R5 — colour-in pages, re-render (new chat, NOTHING attached)

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet.

Style for every image: a children's colouring-book page for a 5-year-old, drawn DIGITALLY — not a photo of a book, no paper, no table, no shadow. THICK, smooth, solid BLACK outlines, all of the SAME heavy weight, on a pure WHITE background. Every shape is a CLOSED outline with no gaps, so each area can be filled with colour. Any horizon, ground or water line runs ALL THE WAY from the left edge to the right edge of the picture. Large simple areas, at most about 15 areas in the whole picture, NO tiny details, no patterns, no hatching, no texture, NO grey, NO shading, NO colour, no text, no letters. The subject FILLS most of the square. Square 1:1, seen straight on.

Image 1: a round owl sitting on a branch, big eyes, a few big feathers — no small leaves.
Image 2: a little steam train with ONE engine and TWO wagons, seen from the side, BIG — the train fills the whole width of the picture and half its height; big round wheels.
Image 3: a sailing boat with a big triangular sail on the sea: a horizon line from the left edge to the right edge separates the sky from the sea; one big wave; no birds.
Image 4: an ice cream cone with three big round scoops; the cone is PLAIN, with at most two simple lines on it — NO waffle grid.

Remember: digital line art, thick equal black closed outlines on pure white, lines that cross the whole picture from edge to edge, NO grey — and four separate image files, not one picture containing four.
```

Same chat, one more:

```
Generate exactly ONE more image in exactly the same colouring-book style (thick equal black closed outlines on pure white, no grey, no tiny details, at most about 15 areas): a friendly round dragon standing in FRONT of a small castle with two towers. The ground line runs from the left edge to the right edge. The castle walls are PLAIN — no bricks. The dragon and the castle together fill most of the square. One image only.
```

## R6 — Perleplade props, re-render (PRD-02 — not needed until Perleplade is built)

**Attach these 2 files:**
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\dd8e498b-b886-4c89-94e8-a783b4bf0e1f.jpg` — the accepted
  bowl, for style
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`

```
I need THREE SEPARATE IMAGES — three individual image files, one per subject below. Do NOT combine them into one picture. Each image shows ONLY its own single object on its own full flat solid #00FF00 green background, edge to edge — NOT on a table, NOT on a floor.

Style for every image: soft-3D claymation style matching the attached bowl (same clay, same lighting, same soft contact shadow), square 1:1, no text.

Image 1: a square children's pegboard for ironing beads, seen STRAIGHT from above, made of OPAQUE MILKY-WHITE plastic (NOT clear, NOT transparent — no green may show through it), with a grid of small round pegs and a clearly visible rounded edge.
Image 2: a pair of chunky children's plastic TWEEZERS in bright blue: two straight arms joined at the top, the two tips close together at the bottom, clearly a pair of tweezers. Seen from the side, tips pointing down-left.
Image 3: the same milky-white square pegboard seen from slightly above, with a HEART made of shiny red round ironing beads sitting on its pegs. It floats on flat solid #00FF00 — no table under it.

Remember: flat solid #00FF00 behind every object, nothing under them — and three separate image files.
```

## Batch J — the demo pencil (NEW: never asked for, needed by Tegn med Mig)

At Let, each guided step first shows a pencil tracing the dotted guide once (PRD-01 §4.3). It needs one
pencil sprite, drawn pointing down-left so its TIP is the point that follows the line.

**Attach these 2 files:**
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\04ac73e3-f609-4e0d-9677-f6ab0ea2288e.jpg` — the accepted
  "Tegn med Mig" icon; copy ITS pencil
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`

```
Generate exactly ONE image: a single chunky children's pencil, exactly like the pencil in the attached "cat drawing" image (same clay style, colours and lighting), alone — no paper, no cat, no drawing. It lies diagonally with its sharpened TIP pointing DOWN-LEFT, the pink eraser end at the upper right. One centered subject filling most of the square, soft contact shadow, flat solid #00FF00 green background edge to edge, square 1:1, no text. One image only.
```

---

# SECOND PASS — validation of the re-renders + how the art looks IN the game (2026-10-16)

All 19 re-renders (`Downloads\art-krea\re-render`) arrived, and **17 are accepted and already wired
into the app**. The crayons are one consistent box now, the undo arrow, the five pages, the three
Perleplade props and the pencil are right. What looking at it IN the studio showed:

- **Green and light green are the wrong colours (must redo).** Measured on the wax: green came out a
  dull dark green (`#3b5b40`) — almost the same darkness as the black crayon (`#454440`), so a child
  confuses the two — and far darker than the green it DRAWS (`#2E9D44`): you pick up a dark crayon and a
  bright line comes out. Light green came out pale yellow (`#c7cc78`), next to the yellow crayon
  (`#dccc50`). → **N1**.
- **The studio backdrop works, but it is the weakest piece (recommended redo).** The wall's two big
  colour-blob paintings compete with the child's own paper right beside it (and "Nyt papir" sits on top
  of one), and a 1024 px image stretched over an iPad is visibly soft. The bigger issue is the CAMERA: a
  wall seen straight on has a table only along the bottom, so every tool has to sit in rows under the
  paper to look like it lies on something — which costs the paper ~35% of its size in landscape. A
  table seen FROM ABOVE would let the tools lie beside the paper and give it that size back. → **N2**
  (the code switches layout when it lands).
- **The rainbow crayon is fine but reads weakly (optional).** With the shared wrapper, only its two ends
  are rainbow, so at button size it is "a crayon with stripy ends". → **N3**.
- **The easel is fine (optional).** Matched to the other five on home it is the right size, but an easel
  is a thin shape and reads lighter than the globe or the books beside it. → **N4**.

## N1 — green + light green crayons (MUST, one chat)

**Attach these 3 files:**
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\1ac5cf90-10fc-4583-9312-66ee2429e009.jpg` — the red crayon:
  **copy its shape AND its brightness**
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\6752ea9e-c031-4988-ba98-2529b6979e9b.jpg` — the yellow
  crayon, so light green is visibly NOT yellow
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`

```
I need TWO SEPARATE IMAGES — two individual image files. Do NOT combine them into one picture.

Copy the attached RED CRAYON EXACTLY: the same shape, thickness, rounded end, pointed tip, cream paper wrapper band, diagonal pose, size in the frame, camera, soft contact shadow and lighting. Only the wax colour changes. No outline, no halo. The wax must be as BRIGHT and SATURATED as the red crayon's — a fresh toy colour, not a dark or dusty one. Flat solid #00FF00 green background edge to edge, no vignette. Square 1:1, no text.

Image 1: the crayon in bright GRASS GREEN — the green of a fresh spring leaf in sunshine, clearly lighter and brighter than a dark forest green, and clearly different from the #00FF00 background (a deeper, slightly bluer green than the background).
Image 2: the crayon in LIGHT MINT GREEN — a soft pale green that is clearly GREEN, NOT yellow (compare the attached yellow crayon: it must not look like that one).

Remember: the exact shape of the red crayon, bright clean colours — and two separate image files.
```

## N2 — the studio backdrop seen from above (RECOMMENDED, new chat)

**Attach these 2 files:**
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\1ac5cf90-10fc-4583-9312-66ee2429e009.jpg` — a crayon
  that will lie on this table: match its light and its 3/4-from-above angle
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\597b7fb8-10dc-448b-936a-35616e4eefa4.jpg` — the current
  studio: keep its warm honey wood and soft daylight, but NOT its camera

```
Generate exactly ONE image: a wide landscape picture, 16:9. Soft-3D claymation style, Pixar-lite, warm and child-safe.

A children's craft table seen FROM ABOVE: the camera looks down at the table top at a gentle angle, like a child sitting at it, so the honey-wood table top fills the WHOLE picture edge to edge. Light, warm honey wood with a soft, even grain — calm and low in detail, no knots, no scratches, no stains. Soft daylight falls from the upper left, so the upper-left corner is a little brighter.

The table is EMPTY across its whole middle — nothing on it — because a sheet of paper, crayons and tools will be placed on it later. Only at the very edges, small and partly cut off by the frame: the rim of a clay pot with a green plant in the top-right corner, and nothing else. No people, no hands, no paper, no crayons, no text, no letters, no numbers.

Match the warm wood colour and soft daylight of the attached studio picture, but NOT its camera — this one looks DOWN at the table, not at a wall.
```

If the plant in the corner keeps coming back big or in the middle, drop it: *"…the table is completely
empty, edge to edge, nothing on it at all."*

## N3 — the rainbow crayon, stronger (OPTIONAL, same chat as N1)

```
Generate exactly ONE image: the SAME crayon as the attached red one, same shape, pose, size, camera and light, but with only a NARROW cream paper wrapper band (about a third as wide as the red crayon's), so most of the crayon shows its wax. The wax is striped in RAINBOW bands running along the crayon — red, orange, yellow, DARK green, blue, purple — and the tip is red. Bright, clean colours. Flat solid #00FF00 green background edge to edge, no vignette. One image only.
```

## N4 — a chunkier easel for the home screen (OPTIONAL, new chat)

**Attach these 3 files:**
- `C:\Users\AllanBrinkVraa\Downloads\art-krea\8e6213d2-b124-4c3e-b867-de27ee959ade.jpg` — the current
  easel: keep its style and its rainbow canvas
- `C:\Source\preschool-learning-app\src\assets\themes\icons\english.webp` — the globe beside it on home:
  match how SOLID and full it is
- `C:\Source\preschool-learning-app\src\assets\themes\icons\math.webp`

```
Generate exactly ONE image: the same wooden children's art easel as the attached one, with its rainbow scribble canvas and the little cup of crayons, but CHUNKIER: a BIG canvas that is almost as wide as the whole easel, short thick rounded clay legs, the cup of crayons bigger and right in front. The whole object should look as solid and full as the attached globe and abacus — a compact, chunky toy, not a tall thin stand. Soft-3D claymation, same lighting as the attached images, slight 3/4 top-down angle, flat solid #FF00FF magenta background edge to edge, square 1:1, no text. One image only.
```

## Accepted files (second pass) — already in `art-src/krea/`

The build session has copied every accepted file into the repo under readable names
(`art-src/krea/crayon-*.jpg`, `undo.jpg`, `pencil.jpg`, `pages/*.jpg`, `beads/*.jpg`, …), so the
GUID file names no longer matter. Drop N1–N4 into `Downloads\art-krea\pass-3` and the build session maps
them in.

---

## Accepted files (first pass) — what the build session uses

| use | file in `Downloads\art-krea` |
|---|---|
| studio backdrop (A) | `597b7fb8-…` (take 2, `80942e6d-…`, is near-identical) |
| crayon red / orange / yellow / blue | `1ac5cf90-…` / `d0610af6-…` / `6752ea9e-…` / `efb86c8e-…` (the deeper of the two blues — the other, `495ee1d5-…`, is too close to light blue) |
| glitter shaker · stamp · eraser | `8f546711-…` · `7bb39f38-…` · `9f380477-…` |
| fresh paper · done ✓ · next → | `ae41cf2f-…` · `4dc6d607-…` · `7aa67d00-…` |
| section icon (easel, magenta) | `8e6213d2-…` |
| tiles: Fri Tegning · Tegn med Mig · Farvelæg | `04192dab-…` · `04ac73e3-…` · `564d50c3-…` |
| pages: dog · frog · beach · forest · town · unicorn · rocket | `6fb9d0a8-…` · `4756bf1b-…` · `6a45d0c3-…` · `3fbb3a6d-…` · `b235d605-…` · `f506f5f6-…` · `ff723c54-…` |
| bead bowl · picture-card frame (PRD-02) | `dd8e498b-…` · `51d60b8d-…` |
| duplicates, unused | `1465e666-…`, `d9d21f28-…`, `953d2854-…` (second red/orange/yellow), `495ee1d5-…` |
| re-render (above) | `dca03ae1` `1d9ae1c7` `297b7241` `18c978e2` `9ce102e2` `4de2c828` `250a38ff` `73500dde` `47201622` `ff1dc260` `a558d2b0` `54b7a0d0` `80a7f85a` `49ad1f20` `0e4d283a` `0207aa7c` `62ca5990` `caa582a0` |

No new art is needed for: the picker cards (they render the child's own work), "keep my drawing" in
the confirm (reuses the Fri Tegning tile), the crayon tool button (reuses the red crayon), beads/pegs
and guide lines (code).

## For the build session (not for pasting)

- Validate before keying: screen-green share of the frame (~75–95% is a good render; far less means
  Gemini painted a scene), item count, ✦ watermark, collage gutters (split + crop ~420 px quadrants).
- Key with `scripts/optimize-theme-art.mjs`, never a hand-rolled key; judge green subjects by the
  `g − max(r,b)` histogram, not by eye. Expected overrides: Batch C green + light green, Batch F
  emerald button, the rainbow crayon's green band.
- The backdrop (A) is an opaque passthrough, upscaled if it arrives at ~1024×576.
- Line art (H) goes through `krea-regions.mjs` (grey-pixel rejection, min-area merge) — PRD-01 §4.4.
