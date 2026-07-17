# PRD-11 English baked-art — Gemini generation prompts (58 word-pictures)

Self-contained prompts for the Engelsk baked art — the shared **English-word-picture** set (PRD-11 §4), reused by
**Lyt og Find** (answer pictures), **Find det Engelske Ord** + **Dansk til Engelsk** (prompt picture), and **Lær
Engelsk** (bloom + cards). Generated in **Gemini 2.5 Flash Image ("Nano Banana")**, keyed on the `#00FF00` green screen
via `.claude/rules/scene-assets.md`, dropped into `src/assets/games/english/`.

**These are theme-CONSTANT single subjects** (like the Ordleg/alphabet/math sets, unlike Farver's true-colour objects) —
a cow is just a friendly cow, a car is just a chunky car. **Exception: the 10 colours** are baked *true-colour* (a red
ball is red) — that's the whole point of a colour picture; and the 10 numbers are baked as soft-3D clay **numerals**.
One set, reused across all 4 skins.

**The English WORD text is NOT generated as art.** The English word on the answer tiles (Find det Engelske Ord, Dansk
til Engelsk) and the Danish caption under the Translate prompt stay Comic Sans type — reading the English word IS the
lesson. Only the *depicted picture* is baked. The three abstract themes that stay emoji (via the art-gated fallback) are
**not** generated: **Hilsner** (hello/goodbye/…), **Krop** (hand/foot/eye/…), **Familie** (mom/dad/baby/…) — owner
decision (§6.1): isolated clay body parts read uncanny, and clay people raise representation issues (consistent with
Ordleg keeping mor/far as emoji).

**Owner scope (§6, confirmed this session):** bake all **38 concrete objects** (Dyr + Mad + Ting + **Natur**) **and**
the **10 numbers** (soft-3D numerals) **and** the **10 colours** (true-colour clay balls) — 58 total — so every Lyt og
Find answer tile is a baked object (no mixed emoji/clay tiles).

**Some subjects overlap prior sets** (cat/fish/sun overlap alphabet; car/cow/cat/sun overlap ordleg) — that's fine and
intended (a fresh English-keyed set, per owner decision §6.3). Re-render them here (don't reuse the Danish-keyed files)
so the whole English batch is one stylistically consistent set keyed by the English word.

---

## Setup (do this once, applies to every prompt)

1. **Attach these as style references on every generation** (they lock the clay material, lighting and palette so the
   set matches the app + the shipped alphabet/math/farver/ordleg art):
   - `art-src/icons/english.png` (the Engelsk section icon)
   - one already-approved render, e.g. `src/assets/games/ordleg/kat.webp` or `src/assets/games/alphabet/A.webp`
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
   **ASCII single tokens** derived from the English word (lowercase, no spaces): the only two-word word is `ice cream`
   → `icecream`. Then hand me the folder and I key + convert to `≤40 KB` WebP and wire it in (auto-registers, no code
   change). Anything not yet dropped in just keeps showing today's emoji.
6. **If the render ITSELF is off** (a genuine second object, mangled subject — visible full-size, not just export):
   re-roll (Gemini is stochastic — usually comes back clean). If an extra object persists after ~2 re-rolls, append:
   > *ABSOLUTELY NOTHING ELSE in the frame — no second object, no props, no floating shapes, no bars or rods, no background elements. ONLY the [subject] and the flat green background.*
   A stray floating blob/sparkle in the raw PNG can be dropped at keying time (despeckle / floating-island removal) —
   only a stray that **overlaps/touches the subject** needs a re-roll.

Each prompt below is complete on its own — copy one, attach the reference images, generate.

---

## Dyr — Animals (10)

**dog**  → save as `dog`
> A single friendly cartoon dog sitting calmly: a rounded soft body, floppy ears, big gentle eyes, a little wagging tail and a sweet happy smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**cat**  → save as `cat`
> A single friendly cartoon cat sitting calmly: a rounded fluffy body, pointed soft ears, big gentle eyes, whiskers and a curled tail, a sweet expression. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**fish**  → save as `fish`
> A single friendly cartoon fish: a rounded plump orange body with soft rounded fins and a gentle tail, big friendly eyes and a soft smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**bird**  → save as `bird`
> A single friendly little cartoon bird: a small round plump body with soft blue and yellow feathers, a tiny orange beak, little rounded wings and big gentle eyes, a cheerful expression. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**cow**  → save as `cow`
> A single friendly cartoon cow standing calmly: a rounded white body with soft brown patches, a gentle smiling face, small rounded ears and tiny blunt nub horns, a little pink muzzle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**horse**  → save as `horse`
> A single friendly cartoon horse standing calmly: a rounded warm-brown body, a soft flowing mane and tail, gentle eyes, small rounded ears and a soft smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**pig**  → save as `pig`
> A single friendly cartoon pig standing calmly: a plump rounded pink body, a round snout, small floppy ears, tiny trotters and a little curly tail, a gentle smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**duck**  → save as `duck`
> A single friendly cartoon duck standing calmly: a rounded yellow body, a small orange rounded bill, little wings and webbed feet, a cheerful expression. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**bear**  → save as `bear`
> A single friendly cartoon teddy-ish bear sitting calmly: a rounded fluffy warm-brown body, round ears, big gentle eyes, a small nose and a soft cuddly smile — cute and huggable, NO bared teeth. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no sharp teeth). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**lion**  → save as `lion`
> A single friendly cartoon lion sitting calmly: a rounded golden body, a soft fluffy mane, big gentle eyes and a soft closed smile — cuddly and friendly, NO bared teeth, nothing fierce. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no bared or sharp teeth). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Mad — Food (10)

**apple**  → save as `apple`
> A single glossy red apple: a rounded shiny red apple with a small brown stem and one little green leaf, appetising and clean. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**banana**  → save as `banana`
> A single ripe banana: one gently curved yellow banana with soft rounded ends and a small brown tip, cheerful and appetising. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**milk**  → save as `milk`
> A single tall glass of milk: a clear rounded glass filled with creamy white milk, simple and clean. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**bread**  → save as `bread`
> A single loaf of bread: a rounded golden-brown loaf with a soft crust and a couple of gentle score marks on top, warm and appetising. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**egg**  → save as `egg`
> A single egg: a smooth rounded white/cream chicken egg standing upright, simple and clean. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**cheese**  → save as `cheese`
> A single wedge of cheese: a chunky rounded triangular yellow cheese wedge with a few rounded holes, cheerful and appetising. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**water**  → save as `water`
> A single tall glass of water: a clear rounded glass filled with fresh blue-tinted water, a soft highlight on the rim, clean and simple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**cake**  → save as `cake`
> A single slice of cake: a rounded triangular slice of layered sponge cake with soft cream frosting and a little cherry or berry on top, appetising and cheerful. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**icecream** (ice cream)  → save as `icecream`
> A single ice-cream cone: a light-brown waffle cone holding two rounded scoops of pastel ice cream (e.g. pink and cream), a friendly appetising treat. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**cookie**  → save as `cookie`
> A single round cookie: a golden-brown round biscuit with a few chocolate chips, soft and appetising. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Ting — Objects (10)

**ball**  → save as `ball`
> A single playful ball: a rounded bouncy ball with simple cheerful colour panels (like a soft beach/play ball), glossy and friendly. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**car**  → save as `car`
> A single cute rounded toy car: a friendly chunky body with round dark wheels and simple windows, seen from a friendly 3/4 front angle, a cheerful colour. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**book**  → save as `book`
> A single open book: a chunky book with a colourful cover and softly curved open pages (blank — no text/letters), friendly and inviting. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**chair**  → save as `chair`
> A single friendly little chair: a rounded wooden chair with a soft seat and a gently curved back, chunky and simple, seen from a friendly 3/4 angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**bed**  → save as `bed`
> A single cozy little bed: a chunky rounded bed with a soft pillow and a folded blanket, warm and inviting, seen from a friendly 3/4 angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**cup**  → save as `cup`
> A single friendly cup/mug: a rounded ceramic mug with a small handle, a cheerful solid colour, clean and simple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**shoe**  → save as `shoe`
> A single cute sneaker/shoe: a chunky rounded trainer with a soft toe, simple laces and a friendly colour, seen from a 3/4 side angle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**hat**  → save as `hat`
> A single cheerful hat: a rounded friendly hat (a soft bowler or sun hat) with a simple band, clean and simple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**door**  → save as `door`
> A single friendly door: a chunky rounded wooden door with a simple round knob and a small window panel, warm and inviting, shown as a standalone door (with its frame). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**key**  → save as `key`
> A single friendly key: a chunky rounded golden key with a round looped head and simple teeth, clean and simple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Natur — Nature (8)

**sun**  → save as `sun`
> A single smiling sun: a rounded warm golden-yellow sun with soft rounded rays and a gentle happy face. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**moon**  → save as `moon`
> A single friendly crescent moon: a soft rounded pale-yellow crescent moon with a gentle sleepy smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**star**  → save as `star`
> A single cheerful five-point star: a rounded plump golden-yellow star with soft edges and a gentle glow, friendly and simple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**tree**  → save as `tree`
> A single friendly tree: a chunky brown trunk with a rounded full leafy canopy, simple and cheerful.
> ⚠️ **Green-subject note (keying):** the leafy canopy is green on a green screen — keep the foliage a clearly *muted/deep* green, distinctly less neon than the vivid `#00FF00` background, so the green-EXCESS keyer keeps it (subject greens ~20–50, screen ~130+).
> Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**flower**  → save as `flower`
> A single cheerful flower: a rounded blossom with soft pink or orange petals and a warm-yellow center on a short green stem with one or two leaves.
> ⚠️ **Green-subject note (keying):** keep the stem/leaves a clearly *muted/deep* green (not neon) so the keyer keeps them; lean the petals a strong non-green colour so most of the subject is unambiguous.
> Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**rain**  → save as `rain`
> A single friendly rain cloud: a soft rounded blue-grey cloud with a gentle smile and a few rounded blue raindrops falling beneath it. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**snow**  → save as `snow`
> A single friendly snowman: a small rounded two-ball white snowman with a tiny carrot nose, coal-dot eyes and a cheerful smile, a little scarf.  Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**cloud**  → save as `cloud`
> A single fluffy white cloud: a soft rounded puffy white cloud with gentle bumps and a barely-there friendly expression, calm and simple. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Tal — Numbers (10, soft-3D clay numerals)

> **These are the ONE exception to "no text/letters":** the numeral IS the subject — a single chunky rounded soft-3D
> clay digit. No counted objects, no dice — just the digit shape as a friendly clay object. Give each a cheerful solid
> colour (vary them so the set isn't monotone). Save each by its English word id below.

**one**  → save as `one`
> A single chunky rounded soft-3D clay numeral "1" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**two**  → save as `two`
> A single chunky rounded soft-3D clay numeral "2" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**three**  → save as `three`
> A single chunky rounded soft-3D clay numeral "3" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**four**  → save as `four`
> A single chunky rounded soft-3D clay numeral "4" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**five**  → save as `five`
> A single chunky rounded soft-3D clay numeral "5" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**six**  → save as `six`
> A single chunky rounded soft-3D clay numeral "6" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**seven**  → save as `seven`
> A single chunky rounded soft-3D clay numeral "7" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**eight**  → save as `eight`
> A single chunky rounded soft-3D clay numeral "8" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**nine**  → save as `nine`
> A single chunky rounded soft-3D clay numeral "9" as a friendly standalone object: smooth matte clay, a cheerful solid colour, gently rounded edges. The digit itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**ten**  → save as `ten`
> A single chunky rounded soft-3D clay number "10" (the two digits joined as one friendly standalone object): smooth matte clay, a cheerful solid colour, gently rounded edges. The number itself is the whole subject (no other objects, no counted items). Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

## Farver — Colours (10, true-colour clay balls)

> **These are baked in TRUE colour** (a red ball is red — the colour IS the lesson). Each is a single glossy soft-3D
> clay sphere in that exact colour. Save each by its English word id below.
> ⚠️ **`green` needs the green-subject keying note** (a green ball on a green screen): render it a clearly *muted/deep*
> green, distinctly less neon than the vivid `#00FF00` background, so the green-EXCESS keyer keeps it. `yellow`/`white`
> are safe; `black` is safe (very low green-excess but opaque). Verify `green` full-size before hand-back.

**red**  → save as `red`
> A single glossy soft-3D clay sphere in a clear bright RED, smooth matte-to-soft-glossy clay with a gentle top-left highlight. The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**blue**  → save as `blue`
> A single glossy soft-3D clay sphere in a clear bright BLUE, smooth matte-to-soft-glossy clay with a gentle top-left highlight. The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**green**  → save as `green`
> A single glossy soft-3D clay sphere in a clear GREEN, smooth matte-to-soft-glossy clay with a gentle top-left highlight. The ball is the whole subject.
> ⚠️ **Green-subject note (keying):** make the ball a clearly *muted/deep* green — noticeably less neon and less saturated than the vivid `#00FF00` background — so the green-EXCESS keyer keeps the ball and removes only the screen. Do not use pure `#00FF00` for the ball.
> Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**yellow**  → save as `yellow`
> A single glossy soft-3D clay sphere in a clear bright YELLOW, smooth matte-to-soft-glossy clay with a gentle top-left highlight. The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**orange**  → save as `orange`
> A single glossy soft-3D clay sphere in a clear bright ORANGE, smooth matte-to-soft-glossy clay with a gentle top-left highlight. The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**purple**  → save as `purple`
> A single glossy soft-3D clay sphere in a clear PURPLE, smooth matte-to-soft-glossy clay with a gentle top-left highlight. The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**pink**  → save as `pink`
> A single glossy soft-3D clay sphere in a clear PINK, smooth matte-to-soft-glossy clay with a gentle top-left highlight. The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**black**  → save as `black`
> A single glossy soft-3D clay sphere in a clear BLACK, smooth matte-to-soft-glossy clay with a gentle top-left highlight (so the sphere shape still reads). The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**white**  → save as `white`
> A single glossy soft-3D clay sphere in a clear WHITE / off-white, smooth matte-to-soft-glossy clay with a gentle top-left highlight and soft shading (so the sphere shape still reads). The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**brown**  → save as `brown`
> A single glossy soft-3D clay sphere in a clear warm BROWN, smooth matte-to-soft-glossy clay with a gentle top-left highlight. The ball is the whole subject. Render style: soft-3D claymation / Pixar-lite — rounded, smooth clay-like surface; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## Hand-back

Drop the folder of PNGs (named by art id above). Gemini filenames are random hashes, so if you didn't rename them I'll
identify each subject visually (a `sharp` contact-sheet montage helps), map to ids, then key via the green-EXCESS
pipeline (`.claude/rules/scene-assets.md`) → `≤40 KB` square transparent WebP → `src/assets/games/english/`. They
auto-register (`englishArt`) with no code change; until then every consumer keeps today's emoji. Verify the four
green-subject renders (`tree`, `flower`, `green`) full-size before hand-back.
