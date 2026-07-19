# PRD-18 W2 — new baked art: **Å → Ål (eel)** (1 subject)

Replaces the current Å picture. The old `AA.webp` is a **stream/river** — a Danish 5-year-old reads
that as *"vand"/"bæk"*, which fights the spoken prompt in Bogstav Quiz. `Ål` (eel) is an unambiguous,
child-known noun that genuinely starts with **Å**, so picture and audio finally agree.

Generated in **Gemini 2.5 Flash Image ("Nano Banana")**, keyed on the `#00FF00` green screen per
`.claude/rules/scene-assets.md`, then handed back to me — I key + convert to `≤40 KB` WebP and drop it
in as `src/assets/games/alphabet/AA.webp` (the `AA` stem is the ASCII alias for the Å glyph; it
overwrites the existing stream file, auto-registers, no code change).

---

## Setup

1. **Attach these as style references** (they lock the clay material, lighting and palette so it matches
   the rest of the alphabet set — reuse the **fish** one especially, so the eel reads as the same kind
   of friendly water-creature):
   - `src/assets/games/alphabet/F.webp` (Fisk — the app's existing water animal; best content+style anchor)
   - `art-src/icons/alphabet.png`
   - (optional 3rd) `art-src/icons/colors.png`
2. **Output:** one flat solid `#00FF00` green background filling the frame edge to edge, single centered
   subject, square 1:1, highest resolution offered. Download as **PNG via right-click → "Save image
   as…"** (NOT the button embedded on the image — that stamps the ✦ sparkle + can add stray elements).
3. **Naming:** save the download as `AA` (or the raw glyph `Å`). Hand me the file/folder.

---

## The prompt (copy this whole block)

**Å — Ål (eel)**
> A single friendly, cute cartoon eel — a long, gently curved smooth-bodied fish with a rounded head,
> one or two small soft fins, big happy friendly eyes and a gentle closed smile — shown as a cheerful
> aquatic creature (clearly a fish/eel, NOT a snake): give it a soft dorsal fin ridge and a rounded fish
> tail fin so it reads as a water animal. Body in a soft blue-green or olive colour with a paler belly,
> curved into a soft "S". Render style: soft-3D claymation / Pixar-lite — rounded, smooth, matte
> clay-like surfaces; gentle soft studio lighting with a soft top-left key light and a subtle rim light;
> soft ambient occlusion and a soft contact shadow beneath. Warm, friendly, calm and completely
> child-safe (nothing scary, absolutely NO sharp teeth, no fangs, no forked tongue, not menacing —
> huggable and gentle). Slight 3/4 top-down camera, single isolated subject, centered with generous
> margin, no text/letters/words, high detail, high quality, consistent scale and lighting with the
> reference icons. Background: one flat solid chroma-key green (#00FF00) filling the whole frame edge to
> edge. Square 1:1 framing.

**Why the fish cues matter:** an eel drawn plainly looks like a snake (scary + wrong word). The dorsal
fin + fish tail + water-animal styling (anchored on `F.webp`) keep it unmistakably an *ål* and keep it
child-safe.

---

## After you hand it back (my steps)

1. Key on green-**excess** + convert → overwrite `src/assets/games/alphabet/AA.webp` (≤40 KB, square,
   transparent). Verify over magenta (no green fringe) + in-app across all 4 skins.
2. `npm run tts:prebake` — the two changed spoken lines are new closed-set content: **"Å som Ål"**
   (Lær Alfabetet tap) and **"Ål starter med Å"** (Bogstav Quiz correct-fact). Commit the regenerated
   `.ogg` + `prebakedTts.ts`.
3. `npm run audit:check` → listen to the two new clips in `/audit`, mark OK, commit
   `docs/audit/narration-audit.json`.
