# Krea — Gemini art prompts

Status: **draft, authored 2026-10-16 with the PRDs.** The implementing session (PRD-01 W0) re-checks
this against `.claude/rules/scene-assets.md` and the then-current art before handing it to the owner.
Every batch = attach the files listed under it + paste its grey block as ONE message.

## How to use this (read once)

- **Attach** the listed reference files (style anchors), then **paste** the grey block.
- **Save with right-click → "Save image as…"** into `C:\Users\AllanBrinkVraa\Downloads\art-krea`.
  Never the download button (it stamps a ✦ watermark).
- If Gemini returns one picture with four images inside, save it anyway; it can be cut. First try once:
  *"Please send them as 4 separate images, not one picture."*
- Tell the implementer when done. Every image is validated (keying, silhouette at true size, ink not
  box) before anything is wired, and you get a contact sheet.
- **Not generated:** beads, pegs, guide lines, numerals and the paper's ink. Those are drawn in code.
  **Stamps reuse existing game art** (fish, sun, flowers, animals already in `src/assets/games/`).

Style references for every claymation batch:
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\math.counting.webp`
- `C:\Source\preschool-learning-app\src\assets\themes\icons\games\colors.ram-farven.webp`

---

## Batch A — the studio scene (PRD-01)

The backdrop is a **scene layer, not a keyed subject**: wide, opaque, no green
(`scene-assets.md` scene-layer convention). Two takes are welcome.

```
Make ONE wide landscape image, 16:9, highest resolution, soft-3D claymation style, Pixar-lite, rounded matte clay, warm and child-safe, soft daylight from a window on the upper left.

A cosy children's art studio seen straight on at a child's eye level: a big light honey-wood table fills the whole lower third of the image, its top edge perfectly horizontal and seen slightly from above. Behind the table, a pale warm-cream wall with one large window showing soft daylight, a few clay leaves of a plant on the windowsill, and a couple of children's paintings pinned to the wall (simple, abstract colour blobs, no faces, no text). The middle of the table is EMPTY — nothing on it — because a sheet of paper will be placed there later. No people, no text, no letters, no numbers. Calm, uncluttered, gentle colours so that bright crayon colours will stand out in front of it.
```

## Batch B — crayons 1–4 (PRD-01)

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet.

Style for every image: one centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1, highest resolution. Match the exact clay style and lighting of the attached reference images.

Every image is the SAME chunky children's wax crayon: short and fat, lying diagonally from lower-left to upper-right, pointed tip at the upper right, a plain paper wrapper band around the middle with NO writing. Identical shape, size and pose in all four; only the colour differs. The colour must be pure and saturated, exactly as named.

Image 1: RED crayon (pure red, like a fire truck).
Image 2: ORANGE crayon.
Image 3: YELLOW crayon (sunny lemon yellow).
Image 4: BLUE crayon (pure medium blue).

Remember: four separate image files, one subject each.
```

## Batch C — crayons 5–8 (PRD-01)

Same block as Batch B, with these four lines instead. **Green crayons need a per-file keying override**
(`FARVER_KEY_OVERRIDES` pattern, measure the histogram). The implementer handles it, but expect a
re-take if the edge eats in.

```
Image 1: GREEN crayon (grass green). It sits on #00FF00 green — keep the crayon a clearly DIFFERENT, darker grass green with a soft dark outline so it separates from the background.
Image 2: LIGHT GREEN crayon (pale lime). Same: clearly different from the #00FF00 background, soft darker outline.
Image 3: PURPLE crayon.
Image 4: PINK crayon (soft bubble-gum pink).
```

## Batch D — crayons 9–12 (PRD-01)

Same block as Batch B, with:

```
Image 1: LIGHT BLUE crayon (sky blue).
Image 2: BROWN crayon (chocolate brown).
Image 3: BLACK crayon (soft clay black, still with a gentle highlight).
Image 4: WHITE crayon (clay white with soft grey shading so it reads on a light background).
```

## Batch E — tool props (PRD-01)

Same opener as Batch B (four separate images, claymation, #00FF00, 1:1), with:

```
Image 1: a RAINBOW crayon — the same chunky crayon shape, but its body is striped in rainbow bands (red, orange, yellow, DARK green, blue, purple) running along its length.
Image 2: a small glitter shaker tube with a star-shaped cap, sparkly gold glitter visible inside, a few tiny gold stars floating out of the top.
Image 3: a chunky children's rubber stamp with a round wooden handle on top and a red rubber base, seen from a 3/4 angle.
Image 4: a soft pink rubber eraser, chunky and rounded, slightly worn at one corner.
```

## Batch F — buttons as objects (PRD-01)

Same opener as Batch B, with:

```
Image 1: a fresh, clean, slightly curled sheet of white paper, seen from above at a slight angle, completely blank.
Image 2: a small curved clay arrow pointing back to the left, like an "undo" arrow, in warm blue.
Image 3: a big round friendly clay button in a DEEP emerald green (clearly darker than the #00FF00 background, with a soft dark outline) with a chunky white tick mark on it (a check mark, no letters).
Image 4: a big round friendly clay button in warm orange with a chunky white arrow pointing right on it.
```

## Batch G — the section and tile icons (two messages)

Checked 2026-10-16 (W0): the first draft had the section icon as a clay paint PALETTE — that is
**Farver's home icon already**, so the two would be twins side by side on the home arc. It is an easel
now. **The section icon is on legacy MAGENTA** (`scene-assets.md`), the tiles on green.

Message 1 — attach the two style references, paste:

```
I need ONE image.

Style: one centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down angle, no text or letters, flat solid #FF00FF magenta background edge to edge, square 1:1, highest resolution. Match the exact clay style and lighting of the attached reference images.

The subject: a small wooden children's art easel holding a canvas with a bright rainbow scribble painted on it, and a little cup of chunky crayons standing at the easel's foot. Keep it clearly an EASEL — not a paint palette.
```

Message 2 — same thread, paste:

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture. Do NOT make a grid, collage, panel or contact sheet.

Style for every image: one centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down angle, no text or letters, flat solid #00FF00 green background edge to edge, square 1:1, highest resolution. Match the exact clay style and lighting of the attached reference images.

Image 1: a sheet of white paper with a bright rainbow scribble on it and a chunky red crayon lying on it.
Image 2: a sheet of white paper with a cat's head drawn in thick friendly black lines (a circle head, two triangle ears, dot eyes), with a pencil beside it.
Image 3: a simple flower picture on white paper, half coloured in (the petals pink, the rest still white), with a small open paint pot beside it. The stem stays white/uncoloured — no green.
Image 4: a small square clear pegboard with a heart made of red ironing beads on it, seen from above at a slight angle.

Remember: four separate image files, one subject each.
```

## Batch H — colour-in pages (PRD-01 Farvelæg), 12 pages in 3 messages

**This is LINE ART, not claymation.** A different opener; do not attach the clay references. Each page
goes through `scripts/krea-regions.mjs`, which **rejects** grey shading, so the "no shading" wording
matters.

```
I need FOUR SEPARATE IMAGES — four individual image files, one per subject below. Do NOT combine them into one picture.

Style for every image: a children's colouring-book page for a 5-year-old. THICK, smooth, solid BLACK outlines only, all of equal heavy weight, on a pure WHITE background. Every shape is a CLOSED outline (no gaps in any line) so each area can be filled with colour. Large simple areas, at most about 15 areas in the whole picture, no tiny details, no hatching, no texture, NO grey, NO shading, NO colour, no text, no letters. Friendly, rounded, cute. The subject fills most of the square. Square 1:1, highest resolution.

Image 1: a happy dog sitting, seen from the front.
Image 2: a round owl on a branch with big eyes.
Image 3: a smiling frog sitting on a lily pad.
Image 4: a beach with a big sun, one wave, a bucket and a spade.
```

Message 2, same opener:

```
Image 1: a forest with two round trees and three big mushrooms in front.
Image 2: a town at night: three simple houses with windows, a big moon and a few big stars.
Image 3: a little steam train with three wagons seen from the side.
Image 4: a sailing boat on one wave with a big triangular sail.
```

Message 3, same opener:

```
Image 1: an ice cream cone with three big scoops.
Image 2: a friendly unicorn standing, seen from the side.
Image 3: a round rocket ship with two windows and flames at the bottom, a planet behind it.
Image 4: a friendly dragon standing in front of a small castle with two towers.
```

## Batch I — Perleplade props (PRD-02)

Same opener as Batch B (claymation, #00FF00):

```
Image 1: a small round shallow clay bowl, seen from slightly above, EMPTY, in soft warm white.
Image 2: a clear transparent square plastic pegboard for children's ironing beads, seen straight from above, slightly frosted, the pegs visible as a grid of tiny bumps. It sits on #00FF00 green — the board must stay clearly visible: give it a soft frosted white tint and a visible edge.
Image 3: a pair of chunky children's plastic tweezers in bright blue, seen from the side, tips pointing down-left.
Image 4: a rounded clay picture card frame in warm cream with a soft border, EMPTY inside (blank cream centre).
```

The circle, heart, star and fish board outlines are **masks drawn in code** over the square board's
plastic. No extra art is needed.
