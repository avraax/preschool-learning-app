# Reward Book — Gemini generation prompts (45 rewards, 5 chapters × 9)

> **STATUS: DONE (2026-08-01).** The owner generated the 16 🆕 and I re-trimmed the 29 reuses, so all
> 45 ship in `src/assets/rewards/`. `Reward.emoji` and `RewardChapter.emoji` are deleted;
> `rewardArtCoverage.test.ts` now guards the set. Build the assets with
> `node scripts/optimize-theme-art.mjs rewards` (the reuse map lives in that script). Kept as the
> record of the batch — re-run a prompt below if a subject ever needs regenerating.
>
> Two things worth knowing before regenerating: the **chapter tab icons** are now the art of each
> chapter's FIRST reward (Hund / Bil / Æble / Træ / Fisk), so those five carry a second job; and
> `natur-blad` needs the per-image keying override in `REWARD_KEY_OVERRIDES` — a green leaf on a green
> screen defeats both the default flood-fill AND the despill (it came out first as a black streak,
> then as a grey leaf). Details are in the script's comments.

Self-contained prompts for the **Reward Book** art (Reward Book PRD-01 §8 W0 / D4). Each of the 45 rewards on the
path gets one baked soft-3D render, keyed on the `#00FF00` green screen per `.claude/rules/scene-assets.md`, and
dropped into `src/assets/rewards/<rewardId>.webp`.

These are **theme-CONSTANT single subjects** — one set, reused across all 4 skins, exactly like the alphabet / math /
ordleg art. A dog is just a friendly dog.

The app is **already playable without any of this**: every reward falls back to its emoji until its `.webp` lands, so
you can generate **one chapter at a time** and the book fills in progressively. Chapter 1 (Dyr) is what a new player
sees first, so it's the highest-value chapter to do first.

---

## ⚠️ Read this before generating: 29 of the 45 already exist

While writing this doc I checked the shipped art against the reward list. **29 of the 45 subjects are already baked,
keyed and approved** in `src/assets/games/` from the earlier uplift batches. I can copy those into
`src/assets/rewards/` (re-trimmed to the 256×256 reward size) at zero cost to you.

**So you only need to generate the 16 marked 🆕 below.** Every prompt is still written out in full, so if you'd
rather have a freshly-rendered reward set — the argument for it is that a reward feels more special if the child
hasn't already seen that exact picture as a quiz answer — you can generate all 45 and I'll use yours instead.

**My recommendation: generate the 16 🆕 only.** The reused 29 are stylistically identical (same style guide, same
green-screen pipeline), the overlap is with *pictures the child already loves*, and it cuts your work by two thirds.
Tell me either way — the wiring is the same.

| Chapter | Reuse (no work needed) | 🆕 Generate |
|---|---|---|
| 1 · Dyr 🐾 | Hund, Kat, Ko, Hest, Gris, Ræv, Bjørn (7) | **Får, Kanin** (2) |
| 2 · Køretøjer 🚗 | Bil, Bus, Tog, Lastbil (4) | **Fly, Båd, Cykel, Helikopter, Raket** (5) |
| 3 · Mad 🍎 | Æble, Banan, Jordbær, Gulerod, Brød, Ost, Is, Kage (8) | **Pizza** (1) |
| 4 · Natur 🌳 | Træ, Blomst, Sol, Måne, Stjerne, Sky (6) | **Regnbue, Svamp, Blad** (3) |
| 5 · Havet 🌊 | Fisk, Haj, Hval, Skildpadde (4) | **Delfin, Sæl, Krabbe, Blæksprutte, Musling** (5) |
| | **29** | **16** |

---

## Setup (do this once, applies to every prompt)

1. **Attach these as STYLE references on every generation** — they lock the clay material, lighting and palette so
   the reward set matches the rest of the app:
   - `art-src/icons/*.png` (any one section icon — higher-res than the shipped webp), and
   - one already-approved render, e.g. `src/assets/games/english/dog.webp` or `src/assets/games/ordleg/kat.webp`.
   - (optional 3rd) a second approved render, for scale/lighting consistency.
2. **After your first reward looks right, attach that render too** as the consistency anchor for the rest of the
   batch. (Or generate a whole chapter in one Gemini chat so it remembers the style.)
3. **Output:** one flat solid `#00FF00` green background filling the frame, single centered subject, square 1:1,
   highest resolution offered, PNG.
4. **⚠️ DOWNLOAD via right-click → "Save image as…", NOT the download button embedded on the image.** The embedded
   button exports a *processed/branded* copy — it stamps the ✦ sparkle marker and can composite in stray extra
   elements (a floating bar/blob, framing). Right-click → Save grabs the actual rendered PNG, which is clean.
   (Also: the in-chat preview **crops** — verify each render full-size, not from the thumbnail.)
5. **Naming:** save/rename each download to its **reward id** (the → id under each prompt) so it places
   deterministically. All ids are ASCII — the Danish glyphs use aliases (`aeble`, `faar`, `raev`, `bjoern`, `baad`,
   `broed`, `jordbaer`, `maane`, `trae`, `sael`, `blaeksprutte`). Then hand me the folder and I key + convert to
   ≤20 KB WebP and wire it in. Anything not dropped in keeps showing today's emoji.
6. **If the render ITSELF is off** (a genuine second object, mangled subject — visible full-size, not just the
   export): re-roll, Gemini is stochastic and usually comes back clean. If an extra object persists after ~2
   re-rolls, append:
   > *ABSOLUTELY NOTHING ELSE in the frame — no second object, no props, no floating shapes, no bars or rods, no background elements. ONLY the [subject] and the flat green background.*

   A stray floating blob/sparkle in the raw PNG can be dropped at keying time (despeckle / floating-island removal)
   — only a stray that **overlaps or touches the subject** needs a re-roll.
7. **These are collectibles — make them appealing.** Slightly more "trophy" than the in-game quiz art is good: a
   little brighter, a little more charm. But keep the same material and lighting, and keep the subject *centered and
   isolated* — no plinths, no frames, no confetti, no sparkles baked in (the app adds its own gold/shine treatment
   for duplicates).

Each prompt below is complete on its own — copy one, attach the reference images, generate.

---

## Chapter 1 — Dyr 🐾  (slots 1–9)

**Hund — dog** → save as `dyr-hund` · *reuse available: `src/assets/games/english/dog.webp`*
> A single friendly cartoon dog sitting calmly: a rounded fluffy golden-brown body, soft floppy ears, big gentle eyes, a little black nose and a happy wagging tail, a cheerful open smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Kat — cat** → save as `dyr-kat` · *reuse available: `src/assets/games/english/cat.webp`*
> A single friendly cartoon cat sitting calmly: a rounded fluffy grey-and-white body, pointed soft ears, big gentle eyes, whiskers and a curled tail, a sweet content expression. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Ko — cow** → save as `dyr-ko` · *reuse available: `src/assets/games/english/cow.webp`*
> A single friendly cartoon cow standing calmly: a rounded white body with soft brown patches, a gentle smiling face, small rounded ears and tiny blunt nub horns, a little pink muzzle. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Hest — horse** → save as `dyr-hest` · *reuse available: `src/assets/games/english/horse.webp`*
> A single friendly cartoon horse standing calmly: a rounded warm-brown body, a soft flowing darker mane and tail, small rounded ears, big gentle eyes and a soft muzzle, a calm friendly expression. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Gris — pig** → save as `dyr-gris` · *reuse available: `src/assets/games/english/pig.webp`*
> A single friendly cartoon pig standing calmly: a plump rounded pink body, a round snout, small floppy ears, tiny trotters and a little curly tail, a gentle smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Får — sheep** → save as `dyr-faar`
> A single friendly cartoon sheep standing calmly: a big soft fluffy cloud-like cream-white woolly body, a small dark rounded face with big gentle eyes, tiny floppy ears and short stubby legs, a sweet smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Kanin — rabbit** → save as `dyr-kanin`
> A single friendly cartoon rabbit sitting calmly: a rounded soft white-and-grey body, two long upright rounded ears with pale pink inners, a tiny fluffy round tail, big gentle eyes, a little pink nose and a sweet smile. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Ræv — fox** → save as `dyr-raev` · *reuse available: `src/assets/games/ordleg/raev.webp`*
> A single cute friendly cartoon fox sitting calmly: a rounded orange body with a white chest and belly, a big soft bushy tail with a white tip, pointed ears and a gentle smiling face. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (no sharp teeth). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Bjørn — bear** → save as `dyr-bjoern` · *reuse available: `src/assets/games/english/bear.webp`*
> A single friendly cartoon bear sitting calmly: a big rounded cuddly warm-brown body, small round ears, a lighter muzzle, big gentle eyes and a soft closed smile — teddy-bear friendly, NO bared teeth, nothing fierce. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## Chapter 2 — Køretøjer 🚗  (slots 10–18)

**Bil — car** → save as `kt-bil` · *reuse available: `src/assets/games/english/car.webp`*
> A single chunky friendly cartoon car seen from a front 3/4 angle: a rounded stubby toy-like red body, big soft round wheels, a large curved windscreen and two round friendly headlights. Cute and toy-like, no driver, no license plate. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Bus — bus** → save as `kt-bus` · *reuse available: `src/assets/games/ordleg/bus.webp`*
> A single chunky friendly cartoon bus seen from a front 3/4 angle: a rounded stubby yellow body, a row of big rounded windows, soft round wheels and two friendly round headlights. Cute and toy-like, no passengers, no text or numbers anywhere on it. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Tog — train** → save as `kt-tog` · *reuse available: `src/assets/games/ordleg/tog.webp`*
> A single chunky friendly cartoon steam train engine seen from a front 3/4 angle: a rounded stubby blue locomotive with a red cow-catcher front, a short funnel chimney, a rounded cab with a big window and soft round wheels. Cute and toy-like, one engine only, no carriages, no smoke, no text or numbers. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Fly — aeroplane** → save as `kt-fly`
> A single chunky friendly cartoon passenger aeroplane seen from a slight front 3/4 angle: a rounded stubby white-and-blue fuselage, short rounded wings, a small rounded tail fin and a row of little round windows. Cute and toy-like, sitting level as if parked, no clouds, no contrails, no text or numbers anywhere on it. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Båd — sailing boat** → save as `kt-baad`
> A single chunky friendly cartoon sailing boat: a rounded stubby wooden-red hull with a small mast and one big soft rounded white sail (plus a tiny triangular front sail), a little rounded cabin. Cute and toy-like, no water, no waves, no sea — just the boat itself as a toy object, no text or letters on the sail. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Cykel — bicycle** → save as `kt-cykel`
> A single chunky friendly cartoon bicycle seen from the side at a slight 3/4 angle: a rounded thick teal frame, two fat soft round black wheels, curved handlebars, a soft rounded saddle and a little bell. Cute and toy-like, standing upright on its own, no rider, no kickstand clutter, no text. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Lastbil — lorry / truck** → save as `kt-lastbil` · *reuse available: `src/assets/games/farver/truck.webp`*
> A single chunky friendly cartoon lorry seen from a front 3/4 angle: a rounded stubby cab in warm orange with a big curved windscreen and round friendly headlights, pulling a short rounded cargo box, on big soft round wheels. Cute and toy-like, no driver, no text or logos anywhere on it. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Helikopter — helicopter** → save as `kt-helikopter`
> A single chunky friendly cartoon helicopter seen from a slight front 3/4 angle: a rounded bubble-shaped red-and-white body with a big curved glass canopy, a short tail boom with a small rounded tail rotor, soft rounded landing skids, and two soft rotor blades resting still on top. Cute and toy-like, sitting parked, no motion blur, no text or numbers. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Raket — rocket** → save as `kt-raket`
> A single chunky friendly cartoon rocket standing upright: a rounded stubby white body with red fins and a red rounded nose cone, one round porthole window, resting on its fins. Cute and toy-like, NO flames, NO smoke, no exhaust, no stars or space background — just the rocket as a toy object, no text or numbers. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## Chapter 3 — Mad 🍎  (slots 19–27)

**Æble — apple** → save as `mad-aeble` · *reuse available: `src/assets/games/english/apple.webp`*
> A single glossy-matte cartoon apple: a plump rounded bright red apple with a short brown stalk and one small rounded green leaf, a soft highlight on the upper left. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Banan — banana** → save as `mad-banan` · *reuse available: `src/assets/games/english/banana.webp`*
> A single cartoon banana: one plump gently curved bright yellow banana with soft rounded ends and a little brown stem tip. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Jordbær — strawberry** → save as `mad-jordbaer` · *reuse available: `src/assets/games/farver/strawberry.webp`*
> A single cartoon strawberry: one plump rounded heart-shaped bright red berry with tiny soft golden seed dots and a small green leafy crown on top. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Gulerod — carrot** → save as `mad-gulerod` · *reuse available: `src/assets/games/farver/carrot.webp`*
> A single cartoon carrot: one plump tapered bright orange carrot with soft rounded ridges and a small tuft of rounded green leafy top. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Brød — bread** → save as `mad-broed` · *reuse available: `src/assets/games/english/bread.webp`*
> A single cartoon loaf of bread: one plump rounded golden-brown loaf with a soft domed crusty top and a lighter base, warm and freshly baked looking. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Ost — cheese** → save as `mad-ost` · *reuse available: `src/assets/games/english/cheese.webp`*
> A single cartoon wedge of cheese: one chunky rounded golden-yellow cheese wedge with a few soft round holes, soft rounded edges. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Is — ice cream** → save as `mad-is` · *reuse available: `src/assets/games/english/icecream.webp`*
> A single cartoon ice cream cone: a chunky rounded waffle cone in warm golden brown topped with two soft rounded scoops — one pale pink, one creamy vanilla. Cute and appetising, nothing melting or messy. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Kage — cake** → save as `mad-kage` · *reuse available: `src/assets/games/english/cake.webp`*
> A single cartoon slice of cake: one chunky rounded triangular slice with soft sponge layers, pale pink frosting on top and a single small red berry. Cute and appetising, no candles, no text. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Pizza — pizza** → save as `mad-pizza`
> A single cartoon slice of pizza: one chunky rounded triangular slice with a soft puffy golden crust, red tomato sauce, melted pale-yellow cheese and three little round red pepperoni discs. Cute and appetising, one slice only, nothing stringy or messy, no plate, no box. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, appetising, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## Chapter 4 — Natur 🌳  (slots 28–36)

> **Keying note for this chapter (implementer):** Træ, Blad and Svamp have **green subject mass** that shares the
> screen's hue. Key them with the border flood-fill + **skip the faint-green grow**, per
> `.claude/rules/scene-assets.md` — the vivid-screen removal alone is safe thanks to the excess gap.

**Træ — tree** → save as `natur-trae` · *reuse available: `src/assets/games/english/tree.webp`*
> A single friendly cartoon tree: a short chunky rounded brown trunk topped with one big soft rounded cloud-like green canopy, a couple of slightly darker green lobes for depth. Cute and storybook-like, no roots showing, no grass, no other plants. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Blomst — flower** → save as `natur-blomst` · *reuse available: `src/assets/games/english/flower.webp`*
> A single friendly cartoon flower: one upright stem with two small rounded leaves, topped with five plump rounded pink petals around a soft yellow round centre. Cute and storybook-like, one flower only, no pot, no soil. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Sol — sun** → save as `natur-sol` · *reuse available: `src/assets/games/english/sun.webp`*
> A single friendly cartoon sun: a plump rounded golden-yellow sphere with a ring of short soft rounded triangular rays, a warm gentle glow, no face. Cute and storybook-like, no clouds, no sky, no lens flare. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Måne — moon** → save as `natur-maane` · *reuse available: `src/assets/games/english/moon.webp`*
> A single friendly cartoon crescent moon: a plump rounded pale cream-yellow crescent with soft rounded tips and two or three shallow soft craters, no face. Cute and storybook-like, no stars, no night sky. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Stjerne — star** → save as `natur-stjerne` · *reuse available: `src/assets/games/english/star.webp`*
> A single friendly cartoon five-pointed star: a plump puffy golden-yellow star with soft rounded points and a gentle warm highlight, like a soft clay star. Cute and storybook-like, no face, no sparkles, no trail. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Regnbue — rainbow** → save as `natur-regnbue`
> A single friendly cartoon rainbow: one chunky soft arch of plump rounded bands in red, orange, yellow, green, blue and purple, with a small soft rounded white cloud tucked at each end of the arch. Cute and storybook-like, thick chunky clay bands (not thin lines), no rain, no sky, no pot of gold, no sparkles. **Important: this subject contains a green band — keep the arch's green band clearly deeper and more muted than the background screen green so it can be separated.** Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Sky — cloud** → save as `natur-sky` · *reuse available: `src/assets/games/english/cloud.webp`*
> A single friendly cartoon cloud: one plump puffy rounded white cloud made of soft overlapping lobes, with gentle blue-grey shading underneath, no face. Cute and storybook-like, one cloud only, no rain, no sky. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Svamp — mushroom** → save as `natur-svamp`
> A single friendly cartoon toadstool mushroom: a plump rounded cream-white stalk under a big domed red cap with soft rounded white spots. Cute and storybook-like, clearly a friendly fairy-tale toadstool, one mushroom only, no grass, no soil, nothing spooky. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Blad — leaf** → save as `natur-blad`
> A single friendly cartoon autumn leaf: one plump rounded maple-shaped leaf in warm orange-red with soft raised veins and a short stem. Cute and storybook-like, one leaf only, lying at a slight angle, no branch, no pile of leaves. **Warm autumn colours, deliberately NOT green** so it separates cleanly from the background. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## Chapter 5 — Havet 🌊  (slots 37–45)

> **Note:** every sea creature here is a *single subject on green* — **no water, no waves, no bubbles, no seabed.**
> They're collectible figures, not an aquarium scene.

**Fisk — fish** → save as `hav-fisk` · *reuse available: `src/assets/games/english/fish.webp`*
> A single friendly cartoon fish seen from the side: a plump rounded orange body with soft rounded fins, a cheerful rounded tail, one big gentle eye and a small smile. Cute and toy-like, no water, no bubbles. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Haj — shark** → save as `hav-haj` · *reuse available: `src/assets/games/ordleg/haj.webp`*
> A single friendly cartoon shark: a rounded chubby blue-grey body with a white belly, a soft rounded dorsal fin, big gentle friendly eyes and a soft closed smile — NO sharp teeth, nothing scary, more cute than fierce. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (absolutely no bared or sharp teeth). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Hval — whale** → save as `hav-hval` · *reuse available: `src/assets/games/farver/whale.webp`*
> A single friendly cartoon whale: a big plump rounded blue body with a pale belly, small rounded flippers, a soft rounded tail fluke, one big gentle eye and a soft smile. Cute and toy-like, no water spout, no waves. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Delfin — dolphin** → save as `hav-delfin`
> A single friendly cartoon dolphin: a smooth rounded light-blue-grey body with a pale belly, a short rounded beak, a soft curved dorsal fin, small flippers and a rounded tail fluke, one big gentle eye and a happy smile. Cute and toy-like, gently arched as if leaping, but with NO water, no splash, no waves. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Sæl — seal** → save as `hav-sael`
> A single friendly cartoon seal sitting up: a plump rounded silver-grey body with a pale belly, small rounded front flippers, a rounded tail, big gentle dark eyes, whiskers and a sweet smile. Cute and toy-like, no rock, no water, no ball on its nose. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Krabbe — crab** → save as `hav-krabbe`
> A single friendly cartoon crab seen from the front: a plump rounded red-orange shell, two big soft ROUNDED claws (blunt, not sharp or pinching), four little stubby legs, two big gentle eyes on short soft stalks and a happy smile. Cute and toy-like, no sand, no water. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe (blunt rounded claws, nothing sharp or nipping). Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Blæksprutte — octopus** → save as `hav-blaeksprutte`
> A single friendly cartoon octopus: a big plump rounded purple-pink dome head, big gentle friendly eyes and a happy smile, with eight short soft rounded tentacles curling neatly outward beneath it. Cute and toy-like, tentacles chunky and tidy (not stringy or grabby), no water, no ink, no bubbles. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**Skildpadde — turtle** → save as `hav-skildpadde` · *reuse available: `src/assets/games/farver/turtle.webp`*
> A single friendly cartoon sea turtle: a rounded domed green-brown shell with soft rounded plate markings, four little rounded flippers, a small friendly head with big gentle eyes and a sweet smile. Cute and toy-like, no water, no sand. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

**🆕 Musling — seashell** → save as `hav-musling`
> A single cartoon seashell: one plump rounded fan-shaped scallop shell in soft pink and cream, with gentle raised ribs fanning out and a small rounded hinge at the base, a soft pearly sheen. Cute and toy-like, one shell only, closed, no sand, no water, no pearl. Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte clay-like surfaces; soft top-left key light + subtle rim light; soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm, completely child-safe. Slight 3/4 top-down camera, single isolated subject, centered with generous margin, no text/letters, high detail, consistent scale and lighting with the reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to edge. Square 1:1 framing.

---

## Implementer checklist (for whoever keys these)

Per `.claude/rules/scene-assets.md`:

1. **Key by green-EXCESS** `g - max(r,b)`, hysteresis flood-fill: seed from the border through vivid screen
   (excess ~90), then grow the transparent region through faint green (~26) to eat the AI-baked contact shadow.
   **Skip the faint-green grow** for the green-subject sprites (`natur-trae`, `natur-blad` if green, `natur-regnbue`,
   `hav-skildpadde`) — verify the excess gap with a histogram per batch first.
2. **Size-capped despeckle** afterwards to drop the ✦ sparkle watermark; cap small so subject mass is never touched.
3. **Sprites TRIM + square-contain** (not full-frame like scene layers) → 256×256 WebP, **≤20 KB each**.
4. **Verify over magenta** before wiring — any leftover green spill screams.
5. Output `src/assets/rewards/<rewardId>.webp`; wire a static `Record<string, string>` in
   `src/assets/rewards/index.ts` (mirror `src/assets/themes/icons/index.ts`), then set `art:` on each `Reward` in
   `src/config/stickers.ts`.
6. Temp `sharp` `.mjs` goes in the **repo root** (so `import 'sharp'` resolves) and gets deleted after — check for
   stray `*.mjs` before committing (`node x.mjs && rm x.mjs` leaves it behind on failure).
7. Screenshot `/album` + a game header ring across all 4 skins after wiring — the silhouette treatment
   (`brightness(0) invert(1)` on dark worlds) is what actually has to read, not the full-colour art.
