# Game Depth PRD-01 — Farver object art: Gemini prompts (12 new renders)

Sibling of `tmp-prd-game-depth-01-variation.md` (§3.1, W2). These are the **only** new renders the PRD needs;
every other added object reuses art that already ships (copied, see the PRD's W1). Generated in **Gemini 2.5 Flash
Image ("Nano Banana")**, keyed on `#00FF00` with the pipeline in `.claude/rules/scene-assets.md`, dropped into
`src/assets/games/farver/` under the **art id** in each heading. The code ships art-gated (W2's objects are added to
`DANISH_OBJECTS` only when their file exists — see the PRD's §4 trap 9), so these can land in any order.

**The owner's ask (2026-10-04): the new objects must look like the same set as the 25 that ship.** That is what the
reference images and the fixed style block below are for. Don't paraphrase the style block per prompt — the identical
sentence on every prompt is the point.

## Setup — do this once

1. **Attach these three reference images on EVERY generation** (they are in this folder, PNG on the same green):
   - `STYLE-REFERENCE-farver-objects.png` — all 25 shipped Farver objects on one sheet. This is the set the new
     ones must join: same clay material, same soft top-left light, same chunky proportions, same saturation.
   - `ref-apple.png` and `ref-cucumber.png` — two single objects at full size, so Gemini sees the material and the
     contact shadow up close. For a **purple** subject swap `ref-cucumber.png` for `ref-grapes.png`.
2. **Start every prompt with this sentence** (it is already in each prompt below):
   > *Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and
   > saturation — the new object must look like it belongs to that same set.*
3. **Generate all 12 in ONE Gemini chat**, and after the first one looks right, also attach that render — it keeps
   scale and lighting consistent across the batch.
4. **Output:** one flat solid `#00FF00` background filling the frame, one centered subject, square 1:1, highest
   resolution offered.
5. **Download with right-click → "Save image as…", never the download button on the image** — that button exports a
   processed copy that stamps the ✦ sparkle and can add stray shapes.
6. **Name each file by its art id** (the `→ save as` value). All ids are ASCII. Hand over the folder; keying,
   ≤40 KB WebP conversion and wiring are the implementing session's job.
7. **If the render itself is off** (two objects, wrong colour, mangled subject): re-roll. If an extra object persists
   after ~2 re-rolls, append: *ABSOLUTELY NOTHING ELSE in the frame — no second object, no props, no floating shapes,
   no background elements. ONLY the [subject] and the flat green background.*

> ⚠️ **The four GREEN subjects (`frog`, `broccoli`, `leaf`, `pea_pod`) are green on a green screen.** They key with the
> **green-EXCESS** method, not distance-to-green, and the render must keep a clearly *muted, deeper* green against the
> vivid `#00FF00` — each green prompt already says so. Same handling as the shipped `cucumber`/`clover`/`tree`/`turtle`.
> Memory note from Reward Pacing: a green subject always needs a keying override; budget a re-key, not a re-roll.

> ⚠️ **No sky, no water scene.** `water_drop` is ONE drop, not a puddle or a sea — a scene subject makes Gemini paint a
> scene (the Reward Pacing "sky subject paints a sky" lesson). The prompt forbids it explicitly.

These are shown **small and many** (Farvejagt scatters up to 14 at once, 62 px on a phone): simple, rounded,
high-contrast silhouettes, no fine detail.

The shared tail on every prompt (already included below):
> Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light +
> subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely
> child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no
> face unless stated. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge.
> Square 1:1 framing.

---

## RØD (red) — 2

**tomato — tomat** → save as `tomato`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single round plump RED tomato with a small green star-shaped stalk on top, glossy and clearly, saturatedly red. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**ladybug — mariehøne** → save as `ladybug`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single cute chunky ladybug seen from slightly above: a round bright RED shell with a few big round black spots, a small black head with two tiny antennae, friendly and toy-like, the red clearly dominant. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## BLÅ (blue) — 1

**water_drop — vanddråbe** → save as `water_drop`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. ONE single plump teardrop-shaped water drop, clearly saturated BLUE, with a soft white highlight on its upper left, standing on its round bottom. NOT a puddle, NOT a sea, NOT a scene — just the single drop. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## GRØN (green) — 4 (green-on-green: keep the green muted and deeper than the screen)

**frog — frø** → save as `frog`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single cute round sitting frog with big friendly eyes, a chunky body in a deep, slightly muted leaf GREEN (clearly darker and less neon than the background), a paler green belly. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**broccoli — broccoli** → save as `broccoli`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single chunky broccoli floret: a rounded bumpy crown and a short thick stalk, in a deep, slightly muted GREEN (clearly darker and less neon than the background). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**leaf — blad** → save as `leaf`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single plump rounded tree leaf with a short stem and a soft central vein, in a deep, slightly muted GREEN (clearly darker and less neon than the background), lying at a slight angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**pea_pod — ærtebælg** → save as `pea_pod`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single plump pea pod split slightly open showing three round peas inside, all in a deep, slightly muted GREEN (clearly darker and less neon than the background). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## GUL (yellow) — 1

**lemon — citron** → save as `lemon`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single whole plump lemon with slightly pointed ends and one small green leaf, clearly saturated YELLOW, gently dimpled peel. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## LILLA (purple) — 4 (attach `ref-grapes.png` instead of `ref-cucumber.png`)

**plum — blomme** → save as `plum`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single round plump PURPLE plum with a soft matte bloom, a short brown stem and one small green leaf, clearly purple (not red, not blue). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**lavender — lavendel** → save as `lavender`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A small tied bunch of three chunky lavender sprigs: rounded PURPLE flower heads on short muted-green stems, the purple clearly dominant. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**umbrella_purple — paraply** → save as `umbrella_purple`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single open toy-like umbrella with a rounded dome canopy in clearly saturated PURPLE and a short curved handle, tilted slightly. No rain, no clouds. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, no face. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**butterfly_purple — sommerfugl** → save as `butterfly_purple`
> Match the attached reference images exactly: same soft-3D clay style, same lighting, same proportions and saturation — the new object must look like it belongs to that same set. A single cute chunky butterfly seen from above with four rounded wings in clearly saturated PURPLE with a few lighter purple dots, a small dark body and two tiny antennae. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.
