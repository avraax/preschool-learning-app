# PRD-04 — Content & data quality (emoji, Danish, sizing)

**Priority:** P1 (the app mis-teaches vocabulary/grammar and scores correct perception as wrong)
**Scope:** Medium (mostly data + a couple of small logic fixes)
**Depends on:** none (touches the same files as PRD-01/PRD-05 — coordinate if run in parallel)

---

## Context

Børnelæring teaches Danish to ages 5–7. The child (per the owner) knows all letters but cannot read
yet, so **pictures and audio carry the meaning**. When a picture contradicts the intended word/answer,
the child is either mis-taught or scored wrong for being right — the worst failure mode for this age.

Relevant data + render sites:
- `src/components/alphabet/AlphabetGame.tsx` and `AlphabetLearning.tsx` — a letter→word→emoji table
  (duplicated, byte-identical) used for word-association ("Hvad starter {word} med?").
- `src/components/learning/MemoryGame.tsx` — a *different* `LETTER_ICONS` letter→word→emoji table.
- `src/config/colorContent.ts` — color objects/names (spoken).
- `src/components/farver/FarveQuizGame.tsx` — "which color is this object?" (drag object → swatch).
- `src/config/englishVocab.ts` — English vocab (emoji, en, da).
- `src/components/common/UnifiedQuizGame.tsx` — renders answer tiles; has an emoji-vs-word size
  heuristic.
- Danish number/letter name helpers: `src/config/danish-phrases.ts`,
  `SimplifiedAudioController.speakLetter/speakNumber`.

## Problems (with evidence)

### P1 — Emoji that mis-teach or unfairly punish

- **Hvilken Farve? (`FarveQuizGame.tsx` + `colorContent.ts`)** shows a white card with only the emoji,
  then scores the child on the object's assigned color. Contradictions found: ⚽ "bold" = rød (a ball
  reads black/white), ☁️ "himmel" = blå (cloud reads white), 🌸 "blomst" = lilla (blossom reads pink),
  👒 "hat" = rød (straw hat reads yellow). The child is marked wrong for correctly seeing the picture.
- **Bogstav Quiz / Lær Alfabetet (`AlphabetGame.tsx` / `AlphabetLearning.tsx`)** teach wrong words via
  the emoji: `Å` = 🐍 (a snake → "slange"→S), `Y` = 🥛 (milk glass → "mælk"→M), `V` = 🍉 (reads
  "melon"→M), `J` = 🎄 (tree). `C` is spelled C but sounds /s/ (a phonetic child taps S and is told
  they're wrong — C arguably belongs with Q/W/X as distractor-only).
- **Memory (`MemoryGame.tsx`)** `D` = "Due" shown as 🦆 (a duck = "and").
- **English (`englishVocab.ts`)** 💇 for "hair" (reads haircut/scissors); 🩷 — a **heart** — for
  "pink" while every other color is a circle.

### P2 — The app speaks grammatically wrong / misspelled Danish

- **Neuter -t agreement missing.** The color echo builds `"{objektet} er {farve}"` in
  `FarvejagtGame.tsx`, `FarveQuizGame.tsx`, and `FarverLearning.tsx`, producing "æblet er **rød**"
  (should be *rødt*), "havet er **blå**" (*blåt*), "bladet/træet er **grøn**" (*grønt*). Common-gender
  and indeclinable colors (lilla/orange) are fine.
- **Misspelled definite forms in `colorContent.ts`** that Azure will mispronounce (wrong vowel length):
  `jordbæret` → **jordbærret**, `blåbæret` → **blåbærret**, `græskaret` → **græskarret**.

### P3 — Multi-codepoint emoji render at half size *(confirmed live)*

`UnifiedQuizGame.tsx` (~lines 603–605) decides "word vs glyph" with `String(display).length > 2`.
Keycap digits (`1️⃣`…`9️⃣`, length 3), variation-selector emoji (`🛏️`, `👁️`, `🌧️`), and ZWJ
sequences (`👨‍👩‍👧`) are misclassified as *words* and rendered small. **Measured in Lyt og Find:**
`👁️` and `1️⃣` at **28px** next to `🔵`/`🍰` at **56px**. The entire English numbers theme plus
bed/eye/rain/family show as tiny pictures.

### P4 — Questions repeat within a round

No generator remembers the previous item, so Bogstav Quiz shows the same letter back-to-back in ~24% of
8-question rounds; Læs Ordet "let" is only 3 words (ko/is/æg) so repeats are constant.
(`AlphabetGame.tsx`, `MathGame.tsx`, `HvadManglerGame.tsx`, `LaesOrdetGame.tsx` generators.)

### P5 — Three divergent letter→word→emoji tables

`AlphabetGame.tsx` and `AlphabetLearning.tsx` are identical copies; `MemoryGame.tsx`'s `LETTER_ICONS`
diverges (A = Abe vs Ananas, B = Bil vs Bjørn, D = Due…), so the child is taught different canonical
words per game, and every P1 fix must be applied in 2–3 places.

### P6 — Stav Ordet word-list nits (`SpellingGame.tsx` word list)

`os` 🧀 (Danish "os" = "us", duplicate cheese emoji with `ost` — child hears "os", sees cheese, spells
OST); `øl` 🍺 (**beer** as content for 5-7yos — Ø is already covered by løg/bær/sø); `ål` shown as 🐍
(reads "slange"). These are less harmful because the word is *spoken*, but the picture contradicts it.

## Goals / Non-goals

**Goals:** every picture matches its intended word/answer (or is removed); spoken Danish is
grammatical and correctly spelled; multi-codepoint emoji render full size; no immediate question
repeats; one canonical letter-word source.

**Non-goals:** the drag mechanic (PRD-01); adding hints/difficulty tuning (PRD-05). This PRD is
deliberately low-risk, high-pedagogy-value data work.

## Implementation plan

1. **Fix the emoji size heuristic (P3).** Replace `.length > 2` with a real test: count grapheme
   clusters via `Intl.Segmenter` (`[...new Intl.Segmenter().segment(s)].length === 1`) or test
   `/\p{Extended_Pictographic}/u`. Treat single-grapheme pictographs (incl. keycaps/VS16/ZWJ) as
   glyphs → large size.
2. **Unify the letter tables (P5) first**, so P1 letter fixes land once: create
   `src/config/letterWords.ts` (letter → { word, emoji }) and consume it in AlphabetGame,
   AlphabetLearning, MemoryGame. Reconcile the divergent words into one agreed set.
3. **Fix the mis-teaching emoji (P1):**
   - Alphabet: `Å` (no eel emoji exists — consider dropping Å as a *target* or using an honest
     picture), `Y` → e.g. "Yoyo 🪀", `V` → keep melon but say "vandmelon" is fine only if the picture
     can't be "melon"; safer to swap, `J` → "Jordbær 🍓", and decide whether `C` stays a target.
   - Memory `D` → 🕊️ (due/dove) or pick a clearer D word.
   - English: swap 💇 for a clearer "hair" or drop the word; make "pink" a circle swatch like its
     color siblings.
   - Hvilken Farve: add a `quizSafe: false` flag in `colorContent.ts` to exclude ⚽/☁️/🌸/👒 from the
     quiz pool, **or** tint the object card with `item.hex` (like Farvejagt) so the color is on the
     card, not just implied by the emoji. Prefer the flag for the clearest ones.
4. **Danish grammar/spelling (P2):** add an inflected neuter predicate to `colorContent.ts` (either a
   per-object `neuter: boolean` flag or a precomputed `predicate` string like "er rødt"), and use it
   in the three echo sites. Fix the three misspelled definite forms.
5. **Anti-repeat guard (P4):** in each generator, keep a `previousValue` ref and re-roll once if the
   new item equals the last. Widen Læs Ordet "let" (bias 2-letter, allow easy 3-letter).
6. **Stav Ordet list (P6):** delete `os`, replace `øl`, re-emoji or drop `ål`.

## Acceptance criteria

- [ ] In Lyt og Find, keycap-digit and VS16 options render at the same large size as plain emoji.
- [ ] No game shows a picture that names a different word than the intended answer (spot-check the
      list above).
- [ ] Color echoes speak grammatical Danish ("æblet er rødt", "havet er blåt").
- [ ] `jordbærret`/`blåbærret`/`græskarret` spellings corrected.
- [ ] No letter/number/word repeats back-to-back within a round across ~10 sampled rounds.
- [ ] One letter-word source; AlphabetGame, AlphabetLearning, and Memory read from it.

## How to verify

- Use the `ui-screenshot` harness to screenshot Lyt og Find and measure option font-sizes
  (`getComputedStyle`), confirming parity.
- Drive Hvilken Farve and confirm the pool no longer includes the contradictory objects (or the card
  is tinted).
- Read the TTS POST bodies the harness logs (`/api/tts-azure`) to confirm the spoken color strings are
  now inflected/correctly spelled.
- Play several rounds of Bogstav Quiz / Læs Ordet; confirm no immediate repeats.

## Risks / notes

- Coordinate with PRD-01 (also edits `colorContent.ts`/Farver) and PRD-05 (difficulty in the same
  generators) to avoid merge churn.
- Keep the existing "audio names the word" behaviour — the picture fix is what matters most.
- Re-capture affected `docs/ui-reference/` screenshots after the emoji swaps.
