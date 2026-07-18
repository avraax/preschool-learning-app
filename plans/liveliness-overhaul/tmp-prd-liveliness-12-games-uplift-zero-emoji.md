# Liveliness PRD-12 — Games Visual Uplift: Zero-Emoji Completion

**Date:** 2026-07-17
**Part of:** Games Visual Uplift sub-program (see `tmp-prd-liveliness-06-games-uplift-foundation.md`).
**Depends on:** PRD-06…-11 shipped (Foundation + all 5 areas). This is the **completion pass**: eliminate every
remaining system EMOJI so all pictorial subjects are baked soft-3D assets (or, for pure UI controls, proper
icon components), and delete the dead emoji data/fallbacks + the retired frosted-card component.
**Owner:** Allan (parent). **Target user:** ~5-year-old, iPad-primary, pre-reader.

> **Why this exists.** The area PRDs (`-08`/`-10`/`-11`) deliberately **kept some subjects as emoji** — English
> body/family/greetings, Ordleg abstract words, Math pattern tokens — under "isolated clay body parts read
> uncanny / abstract tokens aren't depictable / numbers-colours are data." **The owner has overridden this: he
> wants ZERO emoji — every pictorial subject a baked Gemini asset.** A full-repo audit (2026-07-17) found the exact
> surviving set (§2). Everything else pictorial is already baked and shipping.

> **Two phases.** **Phase A (no new art — ship immediately):** delete dead code, convert UI-symbol emoji to icon
> components / CSS clay, remove the dead frosted `PromptStage`. **Phase B (art-gated):** bake the remaining
> *pictorial* subjects in Gemini and wire them, then strip the last emoji fallbacks. Phase A needs no owner art and
> can land first; Phase B waits on the owner's Gemini batch (§4).

---

## 1. What's already done (do NOT redo — verified 2026-07-17)

- **Foundation F0–F4:** `GameIntro` entry-beat removed; `TactileTile` + `PromptFocus` built and adopted; in-game
  world veil softened (`PersistentWorld.tsx:109` `blur(2.5px)`, `:114` `scale(1.03)`, `:150-153` light dim); HUD
  unified onto `TactilePill` (`RepeatButton`, `ScoreChip`); `#ECF1F8` gone from every game board.
- **All concrete pictorial subjects baked & wired:** Alphabet 29 letters; Math counting objects (apple/balloon/
  star/flower/car/ball/bird/fish) + krokodille + memory count-clusters; Farver 24 objects; Ordleg 22 reading +
  ~28 spelling concrete words; English 38 concrete + numbers(10) + colours(10) = 58. All render baked `<img>`.
- The emoji that remain are the **exceptions the area PRDs chose to keep** (now reversed) + UI chrome + dead data.

## 2. Complete live-emoji inventory (exact anchors from the audit)

### 2A. Pictorial subjects still rendered as emoji → **Phase B: bake in Gemini**
| Group | Count | Subjects | Where rendered (file:line) |
|---|--:|---|---|
| English **body** | 8 | hand, foot, eye, ear, nose, mouth, tooth, hair | `englishVocab.ts` (body theme); rendered in `EnglishListenGame`/`EnglishWordGame`/`EnglishTranslateGame` (art-gated fallback → emoji) + `EnglishLearning.tsx:86,225` |
| English **family** | 8 | mom, dad, baby, girl, boy, grandma, grandpa, family | same paths |
| English **greetings** | 8 | hello, goodbye, thank you, please, yes, no, good morning, good night | `EnglishLearning` browse only (excluded from quiz pool, `englishVocab.ts:176-178`) |
| Ordleg **abstract** | 7 | hej, arm, ben, fod, hul, mor, far | `SpellingGame.tsx:52,57,60,61,62,76,77` → `<HeroEmoji>` at `:458-463` |
| Memory **card-backs** | 4 | per-skin motif (space=rocket, ocean=shell, dino=dino, kid=rainbow) | `UnifiedMemoryGame.tsx:57-62` `WORLD_MOTIF`, drawn at `:738,:741-744` on every card back (all 4 memory games) |

> **Overlap:** `mor/far` + body parts appear in BOTH English and Ordleg. Generate each subject **once** and reuse
> (see §4 shared-dir note) — don't bake mum twice.

### 2B. Abstract tokens & reward glyphs → **Phase A: CSS clay / icon (no Gemini)**
| Item | Emoji | File:line | Fix |
|---|---|---|---|
| Math pattern tokens | 🔴🔵🟢🟡🟣🟠⭐❤️ | `HvadManglerGame.tsx:21` `PATTERN_EMOJIS` (hero `:185-226`, tile `:139`) | Replace with **CSS clay pips** — a tinted `Box` circle with `softShadow()` + inner-light per colour; ⭐/❤️ → a small clay star/heart `Box` (SVG or clip-path). Pattern lesson is colour/shape sequence — clay pips read better than emoji and need no art. |
| ScoreChip record | ⭐ | `ScoreChip.tsx:90` | Lucide `Star` (filled, `onAccent` colour) — matches the app's Lucide usage. |
| Blank marker | ❓ | `HvadManglerGame.tsx:40,52` (render `:186`) | Plain typographic `?` in Comic Sans (a glyph, not the red emoji). |

### 2C. UI-symbol / control emoji → **Phase A: Lucide icons (no Gemini)**
The app already uses `lucide-react` (see `RepeatButton useLucideIcons`). These are controls, not subjects.
| Emoji | File:line | Replace with |
|---|---|---|
| 🎵 (in "Hør igen" labels) | `FarvejagtGame.tsx:547`, `RamFarvenGame.tsx:522`, `FarveQuizGame.tsx:322`, `NuancerGame.tsx:348,482` | drop the emoji from the label (the button already has a Volume icon) |
| ➜ | `RamFarvenGame.tsx:634` | Lucide `ArrowRight` |
| ⬇ | `RamFarvenGame.tsx:740` | Lucide `ArrowDown` |
| 🗑️ (Tøm) | `RamFarvenGame.tsx:797` | Lucide `Trash2` |
| 🎉 (Flot!) | `RamFarvenGame.tsx:930` | drop, or Lucide `PartyPopper`/`Sparkles` |
| ☀️ / 🌙 (lys→mørk chip) | `NuancerGame.tsx:418,427` | Lucide `Sun` / `Moon` |
| 👆 | `ComparisonGame.tsx:550` (prompt string) | **delete** from the string |
| 🔊 (listen prompt) | `UnifiedQuizGame.tsx:563` | Lucide `Volume2` (keep it a control — it must never reveal the answer) |
| theme chips 🐾🍎🔢🎨🌳👋👪 | `EnglishLearning.tsx:138` | Lucide per theme OR a representative baked thumbnail (owner decision §5) |

### 2D. Dead emoji data / fallbacks → **Phase A (or Phase B for the ones art depends on): remove**
- Emoji **data fields** now unrendered once §2A art lands: `letterWords.ts` emoji column; `countingObjects.ts:25-32`
  emoji; `colorContent.ts:40-73` `emoji`; `RamFarvenGame.tsx:48,75-79` `💧`; `READING_WORDS` emoji
  (`LaesOrdetGame.tsx:28-49`); concrete `SPELLING_WORDS` emoji; `MemoryGame.tsx:56` `LETTER_ICONS` emoji.
- Emoji **fallback ternaries**: `MathGame.tsx:127`, `ComparisonGame.tsx:463,599`, `NumberLearning.tsx:69`,
  `UnifiedQuizGame.tsx:539(emoji branch),716-717(emoji branch)`, `English*`/`SpellingGame`/`EnglishLearning`
  `art ? … : emoji`. Once §2A subjects are baked, **remove the emoji branch entirely** (render `<HeroArt>`/`<TileArt>`
  unconditionally, or a neutral glyph placeholder for the genuinely-abstract stragglers) so nothing can regress.
- **Dead frosted-card component**: `PromptStage.tsx:1-96` (the `backdrop-filter: blur(12px)` card + `PromptStageProps`)
  is no longer rendered anywhere. Move the still-used helpers `HeroEmoji`/`HeroArt`/`TileArt` (`:100,118,145`) into
  `PromptFocus.tsx` (or a new `PromptArt.tsx`), update the 4 importers (`UnifiedQuizGame.tsx:9`, `SpellingGame.tsx:14`,
  `SpeakWordGame.tsx:14`, `EnglishLearning.tsx:12`), then **delete `PromptStage.tsx`**. (Rename `HeroEmoji`→ keep only
  if still needed for a non-emoji glyph path; otherwise drop it with the emoji fallbacks.)
- Dead config identity glyphs (`AlphabetGame.tsx:116 🎯`, `MathGame 🧮`, `HvadMangler 🧩`, `LaesOrdet 📖`, English
  `👂🔤🔁`) — `UnifiedQuizConfig.emoji` is never rendered (grep-confirmed); safe to blank/remove as tidy-up.

## 3. Guardrails (unchanged from the program)
iPad-first, no-scroll; Danish; Comic Sans; 44px targets; **token-driven** (all 4 skins + flat); reduced-motion
(motion off, art+shadows+audio kept); **no new narration** (SFX only); match-PRD-05 perf; honor
`.claude/rules/drag-and-drop.md` for the Farver symbol swaps (don't touch collision/mechanics); baked art via the
`.claude/rules/scene-assets.md` green-screen pipeline. **Glyphs stay type** (letters/numerals are the lesson — never
baked). Learning-first: a picture must be unambiguous for a pre-reader; if a subject can't be depicted clearly, drop
it from the pool rather than ship a confusing clay blob (§5).

## 4. Phase B baked-art manifest (owner generates in Gemini)

> **Paste-ready prompts:** one complete Gemini prompt per subject is in
> **`tmp-prd-liveliness-12-zero-emoji-art-prompts.md`** (companion doc) — plus the section-word→file mapping. The
> manifest below is the summary; generate from the prompts doc.

Style = PRD-05 §8.2 (soft-3D claymation, soft key+rim light, contact shadow, child-safe, centered, isolated on flat
`#00FF00`, no text). Key + trim + square-contain per `.claude/rules/scene-assets.md`; ≤40 KB WebP. Upload existing
`assets/themes/icons/*.webp` as style refs.

**Shared subjects (generate ONCE, reuse across sections) → new `src/assets/games/shared/`:**
- Body (depict as a **friendly whole character emphasizing the part**, NOT a disembodied limb — avoids uncanny):
  hand (child waving an open hand), arm (character flexing/showing arm), leg/`ben` (character showing leg), foot
  (character pointing at foot), eye, ear, nose, mouth, tooth (a happy tooth character), hair.
- People: mom, dad, baby, girl, boy, grandma, grandpa, family (a small warm group) — friendly, inclusive, simple.

**English-only → `src/assets/games/english/` (greetings):**
- hello (child waving), goodbye (waving, small suitcase optional), yes (thumbs-up / nodding child), no (thumbs-down /
  gentle head-shake), please (hopeful child, hands together), thank you (child with a small heart / grateful gesture),
  good morning (sun rising over hills), good night (moon + stars / sleeping child with zzz).
  > **Weakest to depict:** please / thank you / yes / no are gesture-concepts. Owner decision §5: bake the proposed
  > depiction, or drop these from the browse (they're audio-first reinforcement only).

**Ordleg-only → `src/assets/games/ordleg/`:**
- `hul` (a friendly hole in the ground / a ring with a clear hole). (`hej`=reuse shared hello; `arm/ben/fod/mor/far`=
  reuse shared.)

**Memory card-backs → `src/assets/games/memory-backs/` (one per skin, keyed by motif):**
- `rocket` (space), `shell` (ocean), `dino` (dino), `rainbow` (kid) — a single soft-3D emblem to sit on the clay
  card back (replaces `WORLD_MOTIF` emoji). One asset per skin.

Rough total: **~24 shared + 8 greetings + 1 (`hul`) + 4 card-backs ≈ 37 new renders** (fewer if greetings are dropped).

## 5. Owner decisions (defaults chosen — adjust in the implementing session)
1. **Greetings yes/no/please/thank-you** — [default: bake the proposed depictions]. Alt: drop from the browse pool
   (audio-first; picture optional). If dropped, no art needed for those 4.
2. **English theme-chip icons** (`EnglishLearning.tsx:138`) — [default: Lucide icon per theme]. Alt: a representative
   baked thumbnail per theme.
3. **Body parts** — [default: bake as a friendly whole-character-emphasizing-the-part, per §4]. This resolves the
   original "uncanny disembodied limb" concern that made them emoji.
4. **UI symbols (🎵➜⬇🗑️🎉☀️🌙🔊)** — [default: Lucide icons, no Gemini] since they're controls, not subjects. Say so
   if you'd rather bake them.

## 6. Files to touch
**Phase A (no art):**
- `src/components/math/HvadManglerGame.tsx` — `PATTERN_EMOJIS` → CSS clay pips; `❓` → typographic `?`.
- `src/components/math/ComparisonGame.tsx` — delete `👆` from prompt (`:550`).
- `src/components/common/ScoreChip.tsx` — `⭐` (`:90`) → Lucide `Star`.
- `src/components/farver/{FarvejagtGame,RamFarvenGame,FarveQuizGame,NuancerGame}.tsx` — chrome emoji → Lucide (§2C);
  **do not touch dnd mechanics**.
- `src/components/common/UnifiedQuizGame.tsx` — `🔊` (`:563`) → Lucide `Volume2`.
- `src/components/common/PromptStage.tsx` → move `HeroArt`/`TileArt` (+ glyph helper) into `PromptFocus.tsx`/new
  `PromptArt.tsx`; update 4 importers; **delete `PromptStage.tsx`**.
- Remove dead config `emoji` fields + `💧` + emoji data columns where safe.
**Phase B (art-gated):**
- `src/assets/games/shared/index.ts` + `memory-backs/index.ts` (new loaders) + wire English/Ordleg loaders to fall
  back to `shared`.
- `src/config/englishVocab.ts` — body/family/greetings now resolve baked art (via `englishArt`/shared); remove emoji.
- `src/components/ordleg/SpellingGame.tsx` — the 7 abstract words resolve baked art; remove `<HeroEmoji>` fallback.
- `src/components/common/UnifiedMemoryGame.tsx` — `WORLD_MOTIF` emoji → per-skin baked card-back `<img>` (`:57-62,738,741-744`).
- Strip every remaining `art ? … : emoji` ternary (§2D) once art resolves; remove emoji data fields.

## 7. Verification
- `npm run build` + `npm run lint` clean.
- **The decisive check — zero emoji in game render paths:** grep the game components + content configs for emoji
  (`rg '[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE0F}]' src/components/{alphabet,math,farver,ordleg,english,learning,common} src/config` — expect **0** in render paths; the only allowed hits are dev `console.*` log prefixes). No `art ? <img> : <…emoji>` ternaries remain.
- `ui-screenshot`, all 4 skins, `?nogate=1`: memory card backs show baked emblem (not emoji); Hvad Mangler pattern
  round shows clay pips; every English/Ordleg body/family/greeting/abstract word shows baked `<img>`; Farver chrome
  shows icons; ScoreChip shows a Lucide star. Reduced-motion + phone-portrait hold.
- `PromptStage.tsx` deleted; `rg PromptStage src` → 0 (only `PromptFocus`/`PromptArt`).
- en-US Ava + all narration byte-identical (no `tts:prebake`/`/audit` needed).

## 8. Appendix — exact anchors (from the 2026-07-17 audit)
Body/family/greetings live-fallback: `englishVocab.ts` themes + `EnglishLearning.tsx:86,225`, `EnglishListenGame.tsx:55`,
`EnglishWordGame.tsx:66`, `EnglishTranslateGame.tsx:68`. Ordleg abstract: `SpellingGame.tsx:52,57,60,61,62,76,77`
(render `:458-463`). Memory backs: `UnifiedMemoryGame.tsx:57-62,738,741-744`. Pattern tokens: `HvadManglerGame.tsx:21,139,185-226`;
blank `:40,52,186`. ScoreChip star: `ScoreChip.tsx:90`. Farver chrome: `FarvejagtGame.tsx:547`, `RamFarvenGame.tsx:522,634,740,797,930`,
`FarveQuizGame.tsx:322`, `NuancerGame.tsx:348,418,427,482`. Sammenlign `👆`: `ComparisonGame.tsx:550`. Listen `🔊`:
`UnifiedQuizGame.tsx:563`. Dead frosted card: `PromptStage.tsx:1-96`; Hero* helpers `:100,118,145`; importers
`UnifiedQuizGame.tsx:9`, `SpellingGame.tsx:14`, `SpeakWordGame.tsx:14`, `EnglishLearning.tsx:12`. Dead fallbacks:
`MathGame.tsx:127`, `ComparisonGame.tsx:463,599`, `NumberLearning.tsx:69`, `countingObjects.ts:25-32`, `colorContent.ts:40-73`,
`RamFarvenGame.tsx:48,75-79`.

---
*End PRD-12. Phase A ships immediately (no art). Phase B ships once the owner's Gemini batch (§4) is keyed + wired.
The done-definition is the §7 grep returning zero emoji in game render paths.*
