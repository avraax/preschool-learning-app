# De-emoji — Gemini generation prompts (UI symbols)

> ## ✅ LANDED 2026-07-31 — this doc is now a record, not a to-do
> The owner generated **trophy · flame · sparkle**; sources archived in `art-src/ui/*.jpg`, keyed into
> `src/assets/ui/*.webp` (17 KB total) by the reproducible `node scripts/optimize-theme-art.mjs ui` pass,
> and wired through `src/assets/ui/index.ts`. `star` and `book` are reused from the game sets as
> recommended. All five W3 call sites are emoji-free and their `noEmoji` allowlist entries are gone.
> Re-run the pass after replacing any source; regenerate a subject only if you want it re-rendered.

Self-contained prompts for the **load-bearing UI symbols** in de-emoji PRD-01 §4 W3 / §6.2 — the glyphs that are
still emoji because they *carry meaning* (the star IS the score, the trophy IS "new record"). Each gets one baked
soft-3D render on the `#00FF00` green screen per `.claude/rules/scene-assets.md`, and lands in
`src/assets/ui/<name>.webp` (a new folder with the same glob-manifest shape as `src/assets/symbols/`).

Everything else in W5 (confetti particles, the transition wipes) is **already done and needs no art** — it reuses
each skin's existing `ambientSprites`.

---

## ⚠️ Read this first: you only need to generate 3, not 5

The PRD listed 5 subjects (star · trophy · flame · book · sparkle). Checking the shipped art, **two already exist**,
baked in the same style and already keyed:

| PRD subject | Status |
|---|---|
| ⭐ star | **Reuse** `src/assets/games/math/star.webp` — a clean gold soft-3D star (it's the counting-object star). |
| 📖 book | **Reuse** `src/assets/games/english/book.webp` — an open blue soft-3D book. |
| 🏆 trophy | 🆕 **generate** |
| 🔥 flame | 🆕 **generate** |
| ✨ sparkle | 🆕 **generate** |

**My recommendation: generate the 3 🆕 only.** The one argument for rendering fresh star/book anyway is that both
reused pictures already appear inside games (the star as a counting subject, the book as an English answer), so the
child sees the same picture in two roles. If you'd rather they were distinct, prompts 4 and 5 below are written out
in full — generate them and I'll use yours instead. Either way the wiring is identical.

---

## Setup (once, applies to every prompt)

1. **Attach 2–3 STYLE references on every generation** so the material, lighting and palette match the app:
   - `art-src/symbols/plus.png` or `art-src/symbols/question.png` (the existing soft-3D UI symbols — the closest
     relatives of this batch), and
   - `art-src/icons/math.png` (higher-res than the shipped webp), and optionally
   - `src/assets/games/math/star.webp` — the gold star this batch has to sit beside on the result screen.
2. **After the first render looks right, attach it too** as the consistency anchor for the rest (or generate all
   three in one Gemini chat so it keeps the style).
3. **Output:** flat solid `#00FF00` green filling the frame edge-to-edge, single centered subject, square 1:1,
   highest resolution offered, **PNG**.
4. **⚠️ DOWNLOAD via right-click → "Save image as…", NOT the download button on the image.** The embedded button
   exports a *processed/branded* copy: it stamps the ✦ sparkle marker and can composite in stray extra elements.
   Right-click → Save grabs the clean rendered PNG. (The in-chat preview also **crops** — check each render
   full-size, not the thumbnail.)
5. **Naming:** save each as its id — `trophy.png`, `flame.png`, `sparkle.png` (plus `star.png` / `book.png` only if
   you generate those) — and drop them in `art-src/ui/`. Hand me the folder path; I key them, convert to ≤20 KB
   WebP into `src/assets/ui/`, and delete each emoji from the code (PRD D5: once the art lands there is no path
   back to a flat glyph).
6. **No pink/magenta and no green in these subjects.** Green is the key colour; magenta is what the older
   `src/assets/symbols/` pipeline keys on, and keeping both out means either pipeline can process the batch.

---

## 1 · Trophy → `trophy.png`

> A friendly soft-3D claymation trophy cup — a rounded gold two-handled cup on a short warm base, no text or
> engraving. Pixar-lite children's-app style: rounded matte clay material, soft top-left key light with a gentle rim
> light, soft contact shadow under the subject, warm and child-safe (nothing scary, nothing sharp or spiky), slight
> 3/4 top-down view, single centered subject, no text or letters anywhere, flat solid #00FF00 green background
> edge-to-edge, square 1:1, high resolution.

**Where it renders:** the `Ny rekord!` ribbon on the round-result screen, at roughly **28–34 px** — so keep the
silhouette simple and chunky. A trophy with thin filigree handles will turn to mush at that size; think "one fat
gold cup".

## 2 · Flame → `flame.png`

> A friendly soft-3D claymation flame — a single rounded teardrop flame in warm orange and gold with a soft lighter
> core, cheerful rather than dangerous. Pixar-lite children's-app style: rounded matte clay material, soft top-left
> key light with a gentle rim light, soft contact shadow under the subject, warm and child-safe (nothing scary,
> nothing sharp), slight 3/4 top-down view, single centered subject, no smoke, no logs, no text or letters, flat
> solid #00FF00 green background edge-to-edge, square 1:1, high resolution.

**Where it renders:** the `{n} i træk!` streak readout on the round-result screen, at roughly **26–32 px**, right
next to the trophy — so it should read as a **warm orange** mass at a glance and not be mistaken for it. One flame,
not a campfire.

## 3 · Sparkle → `sparkle.png`

> A friendly soft-3D claymation sparkle — one plump four-pointed star-sparkle in pale gold/cream with a soft glow,
> like a rounded clay twinkle. Pixar-lite children's-app style: rounded matte clay material, soft top-left key light
> with a gentle rim light, very soft contact shadow, warm and child-safe, slight 3/4 top-down view, single centered
> subject (no cluster of little sparkles, no trailing dust), no text or letters, flat solid #00FF00 green background
> edge-to-edge, square 1:1, high resolution.

**Where it renders:** the smallest and most-reused of the batch — the "book full" state in the corner reward ring
and the home shelf, the gold-duplicate badge in Min Bog and on `StickerReveal`, and the result-screen reward meter,
at roughly **16–26 px**. It must survive being tiny **and** sit on both dark scenes (Rummet) and light ones
(Havet/Regnbue), so keep it a bright pale gold with a clear four-point silhouette — not white (invisible on Regnbue)
and not deep amber (muddy on Rummet). Distinct from prompt 4's five-pointed star: **four fat points**.

---

## Optional — only if you'd rather not reuse the existing art

## 4 · Star → `star.png` *(otherwise reused from `src/assets/games/math/star.webp`)*

> A friendly soft-3D claymation five-pointed star — plump rounded gold star, softly bevelled points, no face.
> Pixar-lite children's-app style: rounded matte clay material, soft top-left key light with a gentle rim light,
> soft contact shadow under the subject, warm and child-safe (nothing sharp), slight 3/4 top-down view, single
> centered subject, no text or letters, flat solid #00FF00 green background edge-to-edge, square 1:1, high
> resolution.

**Where it renders:** the **score itself** — the three stars on the round-result screen, up to **67 px** on iPad and
32 px on phone-landscape. Unearned stars reuse the SAME render, greyed out and dimmed in code, so one gold star
covers both states — don't render an empty/outline variant.

## 5 · Book → `book.png` *(otherwise reused from `src/assets/games/english/book.webp`)*

> A friendly soft-3D claymation open book — rounded clay covers in a soft blue with plump cream pages, blank (no
> writing, no letters, no pictures on the pages). Pixar-lite children's-app style: rounded matte clay material, soft
> top-left key light with a gentle rim light, soft contact shadow under the subject, warm and child-safe, slight 3/4
> top-down view, single centered subject, flat solid #00FF00 green background edge-to-edge, square 1:1, high
> resolution.

**Where it renders:** three places, one asset — the Min Bog title, the Min Bog count pill, and the home shelf — at
roughly **28–44 px**. It stands for the child's own reward book, so an *open* book (something being filled in) reads
better than a closed one.

---

## What happens when you hand the folder over

1. I key the green screen (green-EXCESS, border flood-fill + hysteresis for the baked contact shadow, despeckle the
   ✦ watermark), trim + square-contain to the house 81 % fill, and encode to WebP — the same pass W5 used to re-key
   the ambient sprites in place.
2. `src/assets/ui/index.ts` gets a small typed manifest (mirroring `src/assets/symbols/index.ts`), and a `ui` pass
   goes into `scripts/optimize-theme-art.mjs` so the batch is reproducible.
3. Each emoji is **deleted** at its call site, with an explicit width/height (art is a sized `<img>`, emoji were
   font-sized text — the PRD §10 layout-shift risk), and I re-measure the affected rows against
   `docs/ui-reference/`.
4. `✅` (the Min Bog chapter-complete tab) is deliberately **not** in this batch — it's a UI affordance, not a toy,
   so it becomes a lucide `Check` icon in code. No art needed.
5. The `noEmoji` guard's allowlist loses the five W3 entries (`RoundResultScreen`, `StickerAlbum`, `RewardRing`,
   `StickerReveal`, `HomePage`), which is the enforceable version of "the emoji can't come back".
