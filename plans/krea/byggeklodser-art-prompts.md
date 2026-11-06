# Byggeklodser — Gemini art prompts

Status: authored 2026-11-06 with `tmp-prd-krea-03-byggeklodser.md`. **Not rendered yet.** Every batch is
SELF-CONTAINED: attach its listed files, paste its grey block as ONE message.

**Revised 2026-11-06 (owner): the first wording returned ONE picture with every variation inside it.**
The batch openers and closers now copy the shape that worked for Krea's colouring pages and Perleplade's
pegboard: say the count as "N SEPARATE IMAGES — N individual image files", forbid combining in so many
words ("Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet"), give
every subject its OWN full background, label them "Image 1/2/3…", and close with the same rule again
("N separate image files, not one picture containing N"). Keep that shape when you add a batch.

## How to use this (read once)

- **One chat per batch letter.** Attach that batch's files with the FIRST message only.
- **Save with right-click → "Save image as…"** into `C:\Users\AllanBrinkVraa\Downloads\art-krea-blocks`.
  Never the download button (it stamps a ✦ watermark).
- If a message returns ONE picture with several inside, save it anyway; the implementer cuts it.
- Tell the implementer when a batch is done. Everything is validated (watermark, keying, flatness) and you
  get a contact sheet before anything is wired.

**Why some of these look odd:** the blocks, the island's shape and the wheels are **3D shapes built in
code**, so they can turn. Gemini paints only **flat pictures that get wrapped onto them**: the island's
top and side, the window and door faces, and the wheel's hub. Those must be **FLAT-LIT**, painted as if
lit evenly from the front with **no shadows and no shine**, because the 3D lights them itself. A baked
highlight would sit in the wrong place whenever the build turns. The prompts say this every time; if an
image comes back with a strong shadow or glossy spot, re-roll it.

**Not generated:** the blocks, the roof, the grid lines, the model card, the numerals, the eraser and
undo buttons (reused from Krea). Tray chips and picker cards are rendered by the game itself.

What each reference image is FOR:
- `math.counting.webp`, `colors.ram-farven.webp`: **style only** (the clay, the light).
- `src/assets/games/krea/backdrop.webp`: **consistency** with the Krea studio's painting style.

---

## Batch A — three sky backdrops (scene layers, opaque, no green)

**Attach these 3 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`
- `C:\Source\preschool-learning-app\src\assets\games\krea\backdrop.webp`

```
I need THREE SEPARATE IMAGES — three individual image files, one per scene below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image is its own complete, full-frame sky.

Style for every image: a wide landscape picture, 16:9, soft-3D claymation style, Pixar-lite, rounded matte clay, warm and child-safe, soft daylight, highest resolution. Match the clay style and light of the attached images (style only, NOT their subjects). No text or letters, no characters, no animals, no buildings.

These are BACKGROUNDS ONLY: a little floating island will be placed in the CENTRE of each picture later, so the centre must be calm open sky with nothing in it. Keep all detail in the outer edges and the lower quarter, far away and small.

Image 1 (summer): a soft blue sky with a few round clay clouds near the top corners; far away at the bottom, gentle green clay hills and a hint of sea, small and soft.
Image 2 (winter): a pale ice-blue winter sky with soft clay snowflakes floating near the edges; far away at the bottom, small snowy clay hills and a few snowy pine trees.
Image 3 (beach): a warm light turquoise sky with a soft clay sun in the upper left corner; far away at the bottom, a calm clay sea with tiny soft waves and a thin sandy shore.

Remember: the centre of each picture left as empty sky — and three separate image files, not one picture containing three.
```

---

## Batch B — island top textures (flat, full frame, square)

**Attach these 2 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need THREE SEPARATE IMAGES — three individual image files, one per surface below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel, swatch sheet or contact sheet. Each image shows ONLY its own single surface, filling its own whole square.

Each image is a FLAT TEXTURE seen from DIRECTLY ABOVE (exactly top-down, no perspective, no horizon), filling the whole square edge to edge, square 1:1, highest resolution. Soft-3D claymation style: rounded matte clay with gentle hand-made texture, matching the clay style of the attached images (style only).

Most important: FLAT EVEN LIGHT. No shadows, no highlights, no shine, no vignette, no darker corners. The texture must look the same brightness everywhere, as if lit evenly from straight in front. No objects on it, no text.

Image 1: short soft clay GRASS, a fresh medium green, tiny rounded tufts, even all over.
Image 2: soft clay SNOW, white with a very faint cool blue tint, gentle soft lumps, even all over.
Image 3: soft clay SAND, warm light golden beige, a few tiny smooth ripples, even all over.

Remember: flat, top-down, evenly lit, nothing on them — and three separate image files, not one picture containing three.
```

---

**If Gemini answers "I don't seem to have access to that content"** (owner, 2026-11-06, on this batch): it
could not read an attachment. Attach PNG copies instead of the `.webp` files, or send this version with
NO attachments at all — a texture needs no style reference:

```
I need THREE SEPARATE IMAGES — three individual image files, one per surface below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel, swatch sheet or contact sheet. Each image shows ONLY its own single surface, filling its own whole square.

Each image is a FLAT TEXTURE seen from DIRECTLY ABOVE (exactly top-down, no perspective, no horizon), filling the whole square edge to edge, square 1:1, highest resolution. Style: soft modelling clay, like a children's claymation film — rounded, matte, gently hand-made, warm and friendly.

Most important: FLAT EVEN LIGHT. No shadows, no highlights, no shine, no vignette, no darker corners. The texture must look the same brightness everywhere. No objects on it, no text.

Image 1: short soft clay GRASS, a fresh medium green, tiny rounded tufts, even all over.
Image 2: soft clay SNOW, white with a very faint cool blue tint, gentle soft lumps, even all over.
Image 3: soft clay SAND, warm light golden beige, a few tiny smooth ripples, even all over.

Remember: flat, top-down, evenly lit, nothing on them — and three separate image files, not one picture containing three.
```

Batches C and D attach the same two files; if they hit the same reply, drop the attachments the same way
(replace "matching the attached images (style only)" with the style sentence above).

---

## Batch C — island side textures (the island's edge, flat, full frame)

**Attach these 2 files:** (same as Batch B)

```
I need THREE SEPARATE IMAGES — three individual image files, one per surface below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel, swatch sheet or contact sheet. Each image shows ONLY its own single surface, filling its own whole square.

Each image is a FLAT TEXTURE seen straight on from the side, filling the whole square edge to edge, square 1:1, highest resolution. Soft-3D claymation style, rounded matte clay, matching the attached images (style only). It will be wrapped around the edge of a small floating island, so it shows layers of ground in horizontal bands.

Most important: FLAT EVEN LIGHT. No shadows, no shine, no vignette. No objects, no text.

Image 1: the top tenth is a strip of clay grass hanging slightly over the edge, below it warm brown clay earth with a few small rounded pebbles and a tiny root or two.
Image 2: the top tenth is a strip of clay snow hanging slightly over the edge, below it cool grey-brown clay earth with a few small rounded pebbles.
Image 3: the top tenth is a strip of light golden clay sand, below it light warm sandstone-coloured clay in soft layers.

Remember: flat, evenly lit, bands running horizontally — and three separate image files, not one picture containing three.
```

---

## Batch D — special block faces (flat, full frame)

**Attach these 2 files:** (same as Batch B)

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet. Each image shows ONLY its own single face, filling its own whole square.

Each image is a FLAT, FRONT-ON TEXTURE that fills the whole square edge to edge, square 1:1, highest resolution: it will be printed on the face of a toy clay block. Soft-3D claymation style, rounded matte clay, matching the attached images (style only).

Most important: FLAT EVEN LIGHT. No shadows, no shine, no reflections, no perspective. No text.

Image 1: a WINDOW: a thick soft white clay frame running along all four edges of the square, a white clay cross in the middle dividing it into four panes, and the panes a calm light sky-blue clay (glass), plain, no reflections.
Image 2: a DOOR: a warm brown clay wooden door filling the square, three soft vertical planks, a small round golden knob on the right side at the middle.
Image 3: a WHEEL seen straight on: a round black clay tyre filling the square almost to its edges, a light grey clay hub in the centre with five small round bolts. The four corners outside the circle are plain dark grey.
Image 4: a plain soft WHITE clay surface (the sides of the window block): gentle hand-made clay texture, even all over.

Remember: flat, front-on, evenly lit, no shine — and four separate image files, not one picture containing four.
```

---

## Batch E — the tile icon (keyed on green)

**Attach these 2 files:**
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\krea.beads.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

```
I need exactly ONE image file showing ONE subject — not a grid, not variations, not a collage. A single centred subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution. Match the attached game icons' style and size (style only).

The subject: a small playful tower of chunky clay toy BLOCKS with smooth rounded edges and NO studs on top: a RED block and a YELLOW block side by side at the bottom, a BLUE block on top of them, and a little ORANGE roof (a sloped wedge) on top. A small white window on the red block. No green anywhere on the blocks.

Remember: one subject, nothing else, flat solid #00FF00 behind it edge to edge — NOT on a table, NOT on a floor — and one image file.
```

---

## Hand-off

Tell the implementer which batches are saved in `Downloads\art-krea-blocks`. W2 wires them. Until then
the game runs on code-only placeholders (W1).
