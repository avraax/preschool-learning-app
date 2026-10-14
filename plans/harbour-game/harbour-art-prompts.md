# Fyld Båden — Gemini art prompts (W0)

Status: **ready to paste**, 2026-10-13. Owner generates; the build session keys, trims and wires. Bar
(owner, 2026-10-13): this game is the app's quality benchmark — generate extra variants and pick the
best on the contact sheet rather than accepting a first render.

## How to run it

- **One chat thread per batch** so lighting carries.
- **ATTACH REFERENCE IMAGES ON EVERY MESSAGE — this is what keeps the new art in the app's style.**
  Without them each batch drifts (clay texture, lighting, proportions). Add this line under the opener:
  *"Match the exact clay style, lighting and colours of the attached reference images."*

  | batch | attach (all in this repo) | why |
  |---|---|---|
  | 1 — fish & boxes | `src/assets/games/math/fish.webp` **(content + style)**, `src/assets/themes/icons/games/math.counting.webp` | every fish must BE the app's existing fish |
  | 2 — boats | `src/assets/themes/icons/games/math.counting.webp`, `…/colors.ram-farven.webp`, `src/assets/games/math/fish.webp` | style; the fish so the boat belongs to the same world |
  | 3 — quay & props | same three as batch 2 | style |
  | 4 — water & effects | same three as batch 2 | style |
  | 5 — backdrop | `art-src/kid/scene.png` (painting style of an existing world); NOT `art-src/ocean/scene.png` (it is underwater) | style of a wide scene |
  | 6 — menu icon | `src/assets/themes/icons/games/math.counting.webp`, `…/math.addition.webp`, `src/assets/games/math/fish.webp` | must sit beside the other Tal og Regning icons |

- Once the first good render of a batch exists, attach it too as a consistency anchor for re-rolls.
- **Save with right-click → "Save image as…"**, never the download button on the image (it stamps the ✦
  watermark and can add stray elements). Check each render full-size, not the chat thumbnail.
- Drop everything into one folder (e.g. `art-src/harbour/`) and give me the path. Filenames don't
  matter — I identify each subject from a contact sheet.
- **No text, letters or numerals in any image.** The number on the sail is drawn by the app.
- If a message returns one collage instead of 4 images, ask for a 2×2 grid on one green background
  instead (I split it).

---

## Batch 1 — the learning objects (most important; re-roll until perfect)

**The single fish is NOT generated — the app already has it**: the red clay fish from the counting
games (`src/assets/games/math/fish.webp`, keyed, 576²). It is already simple, one colour, faces right
and has a friendly eye, and it is in the house style by construction. So this batch only makes things
that CONTAIN that fish. Attach it on every message.

Three rules from the 2026-10-14 research, already written into each line: the fish are SIMPLE and
IDENTICAL (exactly the attached fish, no scales or patterns — detail gets counted instead of the fish),
they all FACE THE SAME WAY, and they look LIVELY (open eye) — never caught: no hooks, nets, ice or limp
fish.

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
> Match the exact clay style, lighting and colours of the attached reference images. Every fish below
> is EXACTLY the attached red fish — same shape, colour, eye and fins — just smaller.
>
> 1. ONE open shallow wooden fish box seen from slightly above, holding EXACTLY TEN of the attached red
>    fish lying flat side by side in 2 columns of 5, ALL facing the same way, every fish clearly
>    separate with a visible gap between neighbours, so a child can see ten without counting. No ice, no
>    nets, no labels.
> 2. The same box as subject 1 again (a second take to choose from), ten fish in 2 columns of 5.
> 3. A small friendly wooden basket with about six of the attached red fish peeking out, lively, open
>    eyes, like a supply pile on a harbour quay.
> 4. A neat stack of three of the same wooden fish boxes, each holding ten of the attached fish in 2
>    columns of 5, stacked on top of each other, like a supply pile on a harbour quay.

## Batch 2 — the boats (all four share the same pose and scale)

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
> All four boats: seen from the side with the slight 3/4 top-down angle, bow pointing RIGHT, the SAME
> size in the frame, with a LARGE FLAT EMPTY OPEN CARGO DECK filling the middle of the boat (nothing on
> the deck), and a mast with ONE BLANK plain cream-white sail or banner board (no markings). Waterline
> flat at the bottom. No water — the boat floats on flat solid #00FF00, NOT on a sea.
>
> All four are friendly little Danish FISHING BOATS (kutter) of the same shape — only the colours differ.
>
> 1. A red-and-white fishing boat with a little white wheelhouse at the back. Remember: flat solid
>    #00FF00 behind and below it, NOT a sea.
> 2. A sunny yellow-and-blue fishing boat with a little wheelhouse at the back. Remember: flat solid
>    #00FF00 behind and below it, NOT a sea.
> 3. A navy-blue-and-orange fishing boat with a little wheelhouse at the back. Remember: flat solid
>    #00FF00 behind and below it, NOT a sea.
> 4. A pale-blue-and-white fishing boat with a little wheelhouse at the back. Remember: flat solid
>    #00FF00 behind and below it, NOT a sea.

Keying note for me: no green hulls on purpose (a green hull needs a per-file key override).

## Batch 3 — the quay and props

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A sturdy wooden harbour quay section seen from the side: a wide flat plank top surface with room
>    for two piles of fish boxes, thick wooden posts going down at the front, one rounded iron bollard at the
>    right edge. Nothing standing on it. Remember: flat solid #00FF00 around it, NOT water.
> 2. A big chunky brass ship's horn on a round red push-button base, friendly and toy-like, clearly
>    something to press.
> 3. A friendly round white-and-grey seagull standing, wings folded, small orange beak, cute and calm
>    (not scary). Remember: flat solid #00FF00 behind it, NOT a sky.
> 4. The same seagull flying with wings spread up, seen from the side. Remember: flat solid #00FF00
>    behind it, NOT a sky.

## Batch 4 — water and effects

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A long horizontal band of gentle clay sea waves, deep teal-blue with soft white foam crests,
>    stretching the full width of the image edge to edge, only a thin band in the middle of the frame.
>    Remember: flat solid #00FF00 above and below the band, NOT a sky.
> 2. The same kind of wave band in a lighter, paler blue with smaller crests (the distant row).
>    Remember: flat solid #00FF00 above and below the band, NOT a sky.
> 3. A playful white water splash, the kind a boat's bow makes, chunky clay droplets.
> 4. A small soft puff of light tan dust with a few tiny wood chips, like a cartoon "poof".

Keying note for me: the teal waves sit close to the screen hue — measure green-excess before keying.

## Batch 5 — the harbour backdrop (OPAQUE, NOT on green; one image at a time)

Paste this alone, ask for 2–4 variants and pick one:

> Soft-3D claymation style, Pixar-lite, rounded matte clay, warm and child-safe, gentle morning light.
> A WIDE 16:9 landscape scene of a calm, cosy Danish harbour seen from the water: a soft pale-blue sky
> with a few rounded clay clouds across the top third; along the horizon a small colourful harbour town
> of gabled houses in yellow, red, ochre and white with a little church spire, and a short stone
> breakwater with a small red-and-white lighthouse on the far right (no light beam). The whole lower
> half is calm open teal-blue water, empty — no boats, no quay, no people, no birds, no text. Keep the
> town small and low so the open water and sky dominate. Highest resolution.

## Batch 6 — the menu icon

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1–4. Four variants of: a small red-and-white fishing boat carrying one wooden box of simple orange
> fish and a few happy loose fish, a blank cream sail, cheerful and chunky, filling the frame like an
> app icon. Fish lively with open eyes, no nets or hooks.
> Remember: flat solid #00FF00 behind and below it, NOT a sea.

---

## Sounds (not Gemini — I source these, free, licence logged per file)

horn · bow splash · fish lands (soft, done: Kenney impactSoft) · box lands (wood, done: Kenney
impactWood) · packing (ten fish into a box: a soft whoosh + wooden clunk) ·
boat arrive (small engine chug) · harbour ambience loop (soft waves, distant gulls, no voices or music).
Sources: Kenney (CC0), Sonniss GDC bundle (royalty-free; no AI training, no resale). MP3 only.
