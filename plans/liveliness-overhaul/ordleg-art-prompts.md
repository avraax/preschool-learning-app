# PRD-10 Ordleg baked-art — Gemini generation prompts (29 word-pictures)

Self-contained prompts for the Ordleg baked art — the shared **word-picture** set (PRD-10 §4), reused by **Læs Ordet**
(answer pictures), **Stav Ordet** (prompt picture), and **Sig et Ord** (match-bloom). Generated in **Gemini 2.5 Flash
Image ("Nano Banana")**, keyed on the `#00FF00` green screen via `.claude/rules/scene-assets.md`, dropped into
`src/assets/games/ordleg/`.

**These are theme-CONSTANT single subjects** (unlike Farver's true-colour objects) — a cow is just a friendly cow, a
car is just a chunky car, colour doesn't matter. One set, reused across all 4 skins, exactly like the alphabet/math art.

**Words + letters are NOT generated as art.** The uppercase prompt word (Læs Ordet), the letter tiles + slots (Stav
Ordet) and the spelled letters (Sig et Ord) stay Comic Sans type — recognising / reading / spelling the glyphs IS the
lesson. Only these 29 *depicted objects* are baked. The ~7 abstract Stav words (hej/arm/ben/fod/hul/mor/far) are
deliberately **not** baked — they keep their emoji via the art-gated fallback.

**Some subjects overlap the alphabet set** (abe/bil/kat/mus/sol/tog) — that's fine and intended (a fresh word-keyed
Ordleg set, per owner decision §6.5), exactly as Farver accepted car/sun/fox overlapping alphabet. Re-render them here
(don't reuse the letter files) so the whole Ordleg batch is one stylistically consistent set keyed by word.

---

## Setup (do this once, applies to every prompt)

1. **Attach these as style references on every generation** (they lock the clay material, lighting and palette so the
   set matches the app + the shipped alphabet/math/farver art):
   - `art-src/icons/ordleg.png` (the Ordleg section icon)
   - one already-approved render, e.g. `src/assets/games/alphabet/A.webp` or `src/assets/games/math/apple.webp`
   - (optional 3rd) a second approved render for scale/lighting consistency.
2. **After your first object looks right, also attach that render** as a reference for the rest — keeps scale/lighting
   consistent across the set. (Or generate them all in one Gemini chat so it remembers the style.)
3. **Output:** one flat solid `#00FF00` green background filling the frame, single centered subject, square 1:1,
   highest resolution offered.
4. **⚠️ DOWNLOAD via right-click → "Save image as…", NOT the download button embedded on the image.** The embedded
   button exports a *processed/branded* version — it stamps the ✦ sparkle marker and can composite in stray extra
   elements (a floating bar/blob, framing). Right-click → Save grabs the actual rendered PNG, which is clean. (Also:
   the in-chat preview crops — verify each render full-size, not from the thumbnail.)
5. **Naming:** save/rename each download to its **art id** (the → id below) so it places deterministically. All ids are
   **ASCII** — the Danish-glyph words use aliases: `aeg` (æg), `raev` (ræv), `baer` (bær), `loeg` (løg), `aal` (ål),
   `soe` (sø). Then hand me the folder and I key + convert to `≤40 KB` WebP and wire it in (auto-registers, no code
   change). Anything not yet dropped in just keeps showing today's emoji.
6. **If the render ITSELF is off** (a genuine second object, mangled subject — visible full-size, not just export):
   re-roll (Gemini is stochastic — usually comes back clean). If an extra object persists after ~2 re-rolls, append:
   > *ABSOLUTELY NOTHING ELSE in the frame — no second object, no props, no floating shapes, no bars or rods, no background elements. ONLY the [subject] and the flat green background.*
   A stray floating blob/sparkle in the raw PNG can be dropped at keying time (despeckle / floating-island removal) —
   only a stray that **overlaps/touches the subject** needs a re-roll.

Each prompt below is complete on its own — copy one, attach the reference images, generate.

---

## Animals

**ko — cow**  → save as `ko`
> A single friendly cartoon cow standing calmly: a rounded white body with soft brown patches, a gentle smiling face, small rounded ears and tiny blunt nub horns, a little pink muzzle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**so — pig**  → save as `so`
> A single friendly cartoon pig standing calmly: a plump rounded pink body, a round snout, small floppy ears, tiny trotters and a little curly tail, a gentle smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**kat — cat**  → save as `kat`
> A single friendly cartoon cat sitting calmly: a rounded fluffy body, pointed soft ears, big gentle eyes, whiskers and a curled tail, a sweet expression. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**mus — mouse**  → save as `mus`
> A single friendly little cartoon mouse sitting calmly: a small rounded grey body, big round ears, tiny paws, a little pink nose and a thin tail, a sweet smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**and — duck**  → save as `and`
> A single friendly cartoon duck standing calmly: a rounded yellow body, a small orange rounded bill, little wings and webbed feet, a cheerful expression. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**raev — fox**  → save as `raev`
> A single cute friendly cartoon fox sitting calmly: a rounded orange body with a white chest and belly, a big soft bushy tail with a white tip, pointed ears and a gentle smiling face. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no sharp teeth). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**ged — goat**  → save as `ged`
> A single friendly cartoon goat standing calmly: a rounded cream-white body, a little beard, small floppy ears and small BLUNT rounded horns (soft, not sharp), a gentle smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (blunt horns, nothing sharp). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**haj — shark**  → save as `haj`
> A single friendly cartoon shark: a rounded chubby blue-grey body with a white belly, a soft rounded dorsal fin, big gentle friendly eyes and a soft closed smile — NO sharp teeth, nothing scary, more cute than fierce. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (absolutely no bared or sharp teeth). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**abe — monkey**  → save as `abe`
> A single friendly cartoon monkey sitting calmly: a rounded brown body with a lighter face and belly, big round ears, a long curled tail and little hands, a cheerful smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**bi — bee**  → save as `bi`
> A single friendly cartoon bee: a small plump rounded body with soft yellow and black stripes, tiny translucent rounded wings, big gentle eyes and a happy smile, a soft blunt (non-scary) tail. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no scary stinger). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**ulv — wolf**  → save as `ulv`
> A single friendly cartoon wolf sitting calmly: a rounded fluffy grey body, pointed soft ears, a bushy tail, big gentle eyes and a soft closed smile — friendly and cuddly, NO bared teeth, nothing scary. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no bared or sharp teeth). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**aal — eel**  → save as `aal`
> A single friendly cartoon EEL (a fish, NOT a snake): a smooth rounded elongated blue-green fish body gently curved into a soft S, small rounded fins, big gentle friendly eyes and a soft smile. Clearly a water animal / eel, not a snake — give it fins and a fish tail. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (a gentle eel, not scary). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Food & drink

**is — ice-cream cone**  → save as `is`
> A single ice-cream cone: a light-brown waffle cone holding two rounded scoops of pastel ice cream (e.g. pink and cream), a friendly appetising treat. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**aeg — egg**  → save as `aeg`
> A single egg: a smooth rounded white/cream chicken egg standing upright, simple and clean. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**ost — cheese**  → save as `ost`
> A single wedge of cheese: a chunky rounded triangular yellow cheese wedge with a few rounded holes, cheerful and appetising. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**baer — berry (strawberry)**  → save as `baer`
> A single plump strawberry: a rounded heart-shaped red berry with tiny light seed dots and a small green leafy top, glossy and appetising. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**loeg — onion**  → save as `loeg`
> A single onion: a rounded golden-brown papery-skinned onion bulb with a small dry top and a hint of light roots at the base, simple and friendly. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**te — cup of tea**  → save as `te`
> A single cup of tea: a rounded ceramic mug/cup with a small handle, filled with warm amber tea, a soft wisp of steam curling up. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Everyday objects

**ur — wristwatch / clock**  → save as `ur`
> A single friendly wristwatch/clock: a round watch face with simple clock hands and a chunky rounded band, clean and cheerful (no readable numbers/text — just simple tick marks). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**sol — sun**  → save as `sol`
> A single smiling sun: a rounded warm golden-yellow sun with soft rounded rays and a gentle happy face. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**hus — house**  → save as `hus`
> A single cozy little house: a rounded cube body with a warm-coloured pitched roof, a door and a couple of windows and a small chimney, cheerful and simple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**bog — book**  → save as `bog`
> A single open book: a chunky book with a colourful cover and softly curved open pages (blank — no text/letters), friendly and inviting. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**sko — shoe**  → save as `sko`
> A single cute sneaker/shoe: a chunky rounded trainer with a soft toe, simple laces and a friendly colour, seen from a 3/4 side angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**hat — hat**  → save as `hat`
> A single cheerful hat: a rounded top hat or a friendly party/bowler hat with a soft band, clean and simple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**ski — pair of skis**  → save as `ski`
> A single pair of skis standing together: two slim rounded skis with softly upturned tips and simple bindings, a cheerful winter colour. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Vehicles

**bil — car**  → save as `bil`
> A single cute rounded toy car: a friendly chunky body with round dark wheels and simple windows, seen from a friendly 3/4 front angle, a cheerful colour. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**tog — steam train**  → save as `tog`
> A single cute steam train engine: a chunky rounded locomotive with a friendly round front, a little chimney, round wheels and a cheerful colour, seen from a friendly 3/4 front angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**bus — bus**  → save as `bus`
> A single cute rounded bus: a friendly chunky body with a row of simple windows, round dark wheels and a cheerful colour, seen from a friendly 3/4 front angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Nature

**soe — lake / pond**  → save as `soe`
> A single little lake/pond: a rounded pool of calm blue water with soft rounded green banks around its edge and maybe one small lily pad, peaceful and simple.
> ⚠️ **Green-subject note (keying):** the banks/grass are green on a green screen — keep them a clearly *muted/deep* green, distinctly less neon than the vivid `#00FF00` background, so the green-EXCESS keyer keeps them. Lean the water strongly blue so most of the subject is unambiguous.
> Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## Hand-back

Drop the folder of PNGs (named by art id above). Gemini filenames are random hashes, so if you didn't rename them I'll
identify each subject visually (a `sharp` contact-sheet montage helps), map to ids, then key via the green-EXCESS
pipeline (`.claude/rules/scene-assets.md`) → `≤40 KB` square transparent WebP → `src/assets/games/ordleg/`. They
auto-register (`ordlegArt`) with no code change; until then every consumer keeps today's emoji.
