# Reward Book chapters 9 & 10 — Gemini prompt doc

> **STATUS 2026-08-04.** Chapter 9 **"Tøj" is SHIPPED** (`8176206`) — 81 slots, 9 chapters, art keyed,
> 18 clips prebaked and signed off. Chapter 10 is **BLOCKED on 4 renders**; its 7 usable sources are
> archived in `art-src/rewards/_pending/` (that folder is a directory, so the optimizer's file filter
> skips it and no orphan art is produced). What is outstanding, and why:
>
> | id | problem | what to do |
> |---|---|---|
> | `vejr-luftballon` | rendered on a **painted blue sky with clouds**, not flat `#00FF00` — unkeyable. Measured: 82% of the frame survives the key (a good render leaves ~15%). | re-render, batch 6 below |
> | `vejr-drage` | same — painted sky + grass, 64% survives | re-render, batch 6 below |
> | `vejr-kaelk` | keys perfectly, but the **silhouette fails**: at 24px the slat gaps disappear and it is an anonymous low blob, the `leg-floejte` failure mode | **change the subject** |
> | `vejr-vindmoelle` | keys perfectly, silhouette is a **2px vertical line** with blades — thin-bar failure, and a re-render cannot fix thinness | **change the subject** |
>
> Both "sky" failures are one lesson: **naming a subject that lives in the sky invites the model to paint
> the sky**, and it overrides "flat solid #00FF00 background edge to edge". Any future airborne subject
> needs the anti-scene instruction spelled out (batch 6 does this).
>
> The 7 that passed and are waiting: `vejr-lyn`, `vejr-regndraabe`, `vejr-paraply`, `vejr-snemand`,
> `vejr-sneskovl` — plus `vejr-kaelk` / `vejr-vindmoelle` which are archived but should be replaced.

For Reward Pacing PRD-01 §10 / D8. The PRD settled these two chapters as **spec only**; this is the
art brief that turns them into renders. Paste the batches below into Gemini as-is.

**17 renders were requested, not 18** — `Hat` is already baked as game art (`src/assets/games/ordleg/hat.webp`,
512×512) and gets reused rather than redrawn, the same way 29 of the first 45 rewards were
(`REWARD_REUSE` in `scripts/optimize-theme-art.mjs`).

---

## 1. Four subjects in the PRD collided with rewards that already exist

Checked against all 72 shipped labels before writing this. **Chapter 4 (Natur) already contains Sol,
Måne, Sky and Regnbue** — which is four of the nine the PRD assigned to chapter 10. Different ids
(`vejr-sol` vs `natur-sol`) so no test would have caught it, but the child would have been handed the
same picture twice, and `rewardNumber() === collectedCount()` ("the number equals the distinct
pictures in your book") would have quietly stopped being true in spirit.

To be fair to the guardrails: `stickers.test.ts`'s existing "ids and labels are unique across ALL
chapters" **would** have caught this the moment the data landed (verified — 90 slots against 86 distinct
labels, red at build time). So this was never going to ship. What finding it now saves is **four wasted
renders**, which is the expensive part of the loop, not a bug.

So chapter 10 keeps its 5 clean subjects and takes 4 replacements. `Paraply` moves in from chapter 9
(it is a weather object), and chapter 9 takes `Rygsæk` in its place. The chapter title widens to
**"Vejr og årstider"**, which is what actually houses a sled and a hot-air balloon.

Everything else in the PRD's spec — ids, ASCII folding, the silhouette discipline — is unchanged.

### Chapter 9 — `toej` "Tøj"

| slot | id | label | render? |
|---|---|---|---|
| 73 | `toej-stoevle` | Støvle | yes |
| 74 | `toej-hat` | Hat | **reuse** `games/ordleg/hat.webp` |
| 75 | `toej-sok` | Sok | yes |
| 76 | `toej-troeje` | Trøje | yes |
| 77 | `toej-bukser` | Bukser | yes |
| 78 | `toej-jakke` | Jakke | yes |
| 79 | `toej-vante` | Vante | yes |
| 80 | `toej-rygsaek` | Rygsæk | yes ← replaces Paraply |
| 81 | `toej-briller` | Briller | yes |

### Chapter 10 — `vejr` "Vejr og årstider"

Slots renumbered: chapter 9 took 73–81, so chapter 10 is **82–90**.

| slot | id | label | status |
|---|---|---|---|
| 82 | `vejr-lyn` | Lyn | ✅ rendered, silhouette passes |
| 83 | `vejr-regndraabe` | Regndråbe | ✅ rendered, silhouette passes |
| 84 | `vejr-paraply` | Paraply | ✅ rendered, silhouette passes |
| 85 | `vejr-snemand` | Snemand | ✅ rendered, silhouette passes |
| 86 | `vejr-sneskovl` | Sneskovl | ✅ rendered, silhouette passes |
| 87 | `vejr-graeskar` | Græskar | ⬜ **replaces Kælk** (blob silhouette) |
| 88 | `vejr-sandslot` | Sandslot | ⬜ **replaces Vindmølle** (2px tower) |
| 89 | `vejr-drage` | Drage | ⬜ re-render, flat green |
| 90 | `vejr-luftballon` | Luftballon | ⬜ re-render, flat green |

The two swaps also give the chapter a real four-seasons spread rather than a rain-and-snow list: rain
(Lyn, Regndråbe, Paraply), winter (Snemand, Sneskovl), spring/sky (Drage, Luftballon), **autumn
(Græskar)**, **summer (Sandslot)** — which is what the title "Vejr og årstider" was widened for.

Deliberately **avoided**, and why, so nobody re-adds them: `Sko` (vs Støvle), `Hue`/`Kasket` (vs Hat),
`Snefnug` and `Stjerneskud` (vs the existing Sol and Stjerne — both read as spiky radial blobs at ring
size), `Gummistøvle` and `Skøjte` (vs the now-shipped Støvle), `Regnfrakke` (vs Jakke), `Solbriller`
(vs Briller), `Termometer` and `Istap` (thin bars — the `leg-floejte` failure mode), `Vandpyt`,
`Snebold` and `Isterning` (no silhouette at all), `Tulipan` (vs Blomst), `Badebold` (vs Bold),
`Sneugle` (vs Ugle).

---

## 2. Before you paste — two things that go wrong every time

- **Save with right-click → "Save image as…"**, never the download button on the image. The embedded
  button exports a processed copy that stamps a ✦ sparkle and can composite in a stray bar or blob that
  isn't in the render. This is the "elements got added on download" mystery.
- **Check each render full-size, not from the chat thumbnail** — the in-chat preview crops.

Attach 2–3 existing `art-src/icons/*.png` as **style** references on every batch, and once you have one
render you like, attach it to the later batches as a consistency anchor. Keep each batch in **one chat
thread** so the lighting carries across the four. No content reference photos are needed — these are all
common nouns.

Name each file by its **id** from the tables above (`toej-stoevle.png`, `vejr-lyn.png`, …).

---

## 3. The batches

### Batch 1 — Tøj (1/2)

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A child's rubber boot, standing upright — give it a clearly defined SOLE and a visible heel so its
>    outline can never be mistaken for a sock.
> 2. A single sock, soft and slouchy, with a folded cuff at the top and a rounded toe — no sole, no
>    heel, obviously a soft tube rather than footwear.
> 3. A cosy knitted pullover sweater, laid flat and seen from the front, CLOSED all the way up with a
>    round neckline and both sleeves out to the sides.
> 4. A pair of trousers, laid flat and seen from the front, with the TWO LEGS clearly separated so
>    there is an open gap between them.

### Batch 2 — Tøj (2/2)

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A child's zip-up jacket, seen from the front, with the front OPEN down the middle and a folded
>    collar at the neck — it must read as clearly different from a closed pullover.
> 2. A single knitted mitten with a stubby separate thumb sticking out to the side — the thumb is what
>    makes the shape readable, so keep it distinct and not tucked in.
> 3. A child's backpack, seen from the front, with two shoulder straps and a small front pocket.
> 4. A pair of round children's eyeglasses, seen straight from the front — two round lenses joined by a
>    bridge, with the arms folded back so the outline is simple.

### Batch 3 — Vejr og årstider (1/3)

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A single cheerful lightning bolt — a bold chunky zigzag in warm yellow, friendly rather than
>    dangerous, nothing scary or jagged-sharp.
> 2. A single large raindrop, a rounded teardrop with a pointed top, in a clear cheerful blue.
> 3. An open umbrella seen from the side, with a shallow domed canopy and a curved hook handle below —
>    keep the canopy wide and shallow, NOT a full sphere.
> 4. A friendly snowman built from TWO clearly separate stacked snowballs — a big one and a smaller
>    one, with a visible waist between them — plus a carrot nose and a small hat.

### Batch 4 — Vejr og årstider (2/3)

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A small wooden toboggan sled seen from the side, low and long, with curved runners underneath and
>    a flat slatted seat on top.
> 2. A snow shovel standing at a slight angle — a wide flat blade at the bottom and a long straight
>    handle with a grip at the top.
> 3. A diamond-shaped kite in bright colours, seen from the front, with a long ribbon tail hanging down
>    below it in a gentle wave — the tail is essential.
> 4. A hot-air balloon — a large round balloon with a small SQUARE wicker basket hanging clearly below
>    it on short ropes. The basket must be obvious, so the outline can never be confused with a plain
>    round balloon or with an umbrella.

### Batch 5 — Vejr og årstider (3/3)

> Generate 1 image of the subject below.
> Single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft top-left key
> light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down angle, no text
> or letters, flat solid #00FF00 background edge to edge, square 1:1, highest resolution.
>
> 1. A modern white wind turbine seen from the front — a tall slim tower with THREE long blades
>    radiating from the hub, spaced evenly like a three-pointed star.

### Batch 6 — the four outstanding chapter-10 subjects

Two of these are re-renders of subjects the model insisted on putting in a scene. **The anti-scene
instruction is spelled out twice on purpose** — the first attempt lost both of them to a painted sky,
and 82% / 64% of the frame survived the green key as a result. Two are replacement subjects whose
silhouettes will hold up where a sled and a wind turbine did not.

> Generate 4 SEPARATE images, one per subject below — not a collage.
> Each: single centered subject, soft-3D claymation style, Pixar-lite, rounded matte clay, soft
> top-left key light, gentle rim light, soft contact shadow, warm and child-safe, slight 3/4 top-down
> angle, no text or letters, square 1:1, highest resolution.
> **The background must be ONE flat solid #00FF00 green, edge to edge — no sky, no clouds, no ground,
> no horizon, no scenery of any kind, even for subjects that would normally be outdoors. The subject
> must float on plain green.**
>
> 1. A hot-air balloon — a large round balloon in bright rainbow stripes, with a small SQUARE wicker
>    basket hanging clearly below it on short ropes. The basket must be obvious. Remember: flat solid
>    #00FF00 behind it, NOT a sky.
> 2. A diamond-shaped kite in bright colours, seen from the front, with a long ribbon tail hanging
>    below it in a gentle wave. The tail is essential. Remember: flat solid #00FF00 behind it, NOT a
>    sky and NOT grass.
> 3. An autumn pumpkin — WIDE and squat rather than tall, in warm orange, with clearly visible vertical
>    ribs and a short chunky stem on top. Keep it distinctly wider than it is tall, so its outline can
>    never be mistaken for an apple.
> 4. A child's sandcastle — a broad sand-coloured base with THREE stepped towers on top, the middle one
>    tallest, each with a small flag-less rounded cap. Chunky and simple, not detailed.

Save with right-click, name them `vejr-luftballon.png`, `vejr-drage.png`, `vejr-graeskar.png`,
`vejr-sandslot.png`, and drop the folder path.

---

## 4. Accepting the renders — the silhouette IS the test

Per `.claude/rules/scene-assets.md`: the acceptance test is the **~24px `brightness(0)` silhouette** the
`RewardRing` draws while that reward is the next prize, **not** the full-colour render and not a contact
sheet. Render each silhouette at true size, zoom it ~6× nearest-neighbour, and ask "would a 5-year-old
know what this is from the shape alone?" Ink coverage is not the criterion and will mislead you.

Check these pairs specifically — each is two subjects in this batch that could collapse to the same
blob, and each has a note in its prompt above aimed at exactly that:

| pair | what must separate them |
|---|---|
| Hat vs Vante | the hat's brim; the mitten's thumb |
| Sok vs Støvle | the boot's sole + heel |
| Trøje vs Jakke | closed round neck vs open front + collar |
| Bukser vs Trøje | the open gap between the two trouser legs |
| Paraply vs Luftballon | shallow wide canopy + hook handle vs full sphere + square basket |
| Snemand vs Luftballon | two stacked balls with a waist vs one ball + basket |
| Sneskovl vs Drage | blade + straight handle vs diamond + wavy tail |
| Græskar vs Æble (ch. 3) | the pumpkin must be visibly WIDER than tall, with ribs |
| Sandslot vs Snemand | three stepped towers vs two stacked balls |

**If a subject can't form a silhouette, change the SUBJECT, not the render.** That is what turned
`leg-floejte` into `leg-xylofon` after two failed attempts. These chapters are unreached by any child,
so their data is free to edit — the append-only rule protects only the frozen first 45.

---

## 5. Landing them (no code — data + art + prebake)

Once the renders are in a folder, hand over the path. Then, in order:

1. **Key + trim** the 17 green-screen PNGs into `src/assets/rewards/<id>.webp` (the pipeline in
   `.claude/rules/scene-assets.md`), and add `toej-hat` to `REWARD_REUSE` in
   `scripts/optimize-theme-art.mjs` so it is copied and re-trimmed from `games/ordleg/hat.webp` rather
   than re-keyed (it already has real alpha and no screen to remove).
   **Export at 384×384, not 256.** The existing 72 are 256, which was right when the ceremony sticker
   was 150px; Reward Pacing grew it to 230px, i.e. ~332 device px on a 2× iPad. Measured, the upscale
   costs only 3–6% edge sharpness on soft clay and is invisible — so the existing 72 are NOT being
   re-exported — but there is no reason to bake new art short. Watch the ≤20KB budget (today: 9KB
   average, 17KB worst).
2. **Append both chapters** to `REWARD_CHAPTERS` in `src/config/stickers.ts`. Append only — never
   insert or reorder, `firstAt` is keyed by reward id and `rebuildCollected` walks slots through the
   path, so reordering silently re-assigns every existing child's book.
3. **Bump the two pinned literals** in `src/config/stickers.test.ts`: 72 → 90 and 8 → 10. Leave
   `FROZEN_FIRST_45` untouched. `rewardArtCoverage.test.ts` stays red until all 18 ids resolve — that
   is the gate working, so do steps 1–3 together rather than committing a red tree.
4. **`npm run tts:prebake`** — 18 labels × (`rewardLine` + the bare label) = 36 new clips. Commit the
   mp3s **and** `src/config/prebakedTts.ts`. Azure credentials are already in `.env.local`.
5. **`npm run audit:check`** → `npm run audit:approve-all` → commit `docs/audit/*`. Per the owner's
   standing preference these are approved-but-unheard; say so rather than implying a listen pass.
6. **`npm run build && npm test && npm run lint`**, then check the new chapter chips in Min Bog
   (`/album?rewards=90`) and one ceremony at `?rewards=80` → chapter 9 close.

Expected totals once chapter 10 lands: **90 slots, 10 chapters**, `xpForSlots(90) = 10 080 XP` ≈ 210–220 rounds of
ordinary play (210 at a clean 48-XP round, 219 at the PRD's 46-XP average). `COMPANION_STAGES` stays 5 — the book grows, the companion art does not, and it must
never regress.
