---
paths:
  - "src/components/alphabet/*.tsx"
  - "src/components/math/*.tsx"
  - "src/components/farver/*.tsx"
  - "src/components/english/*.tsx"
  - "src/components/ordleg/*.tsx"
  - "src/components/learning/*.tsx"
---

# Games catalog (per section)

What each game is + its `gameId` + the **durable design invariants** (the *why*). Tuning values —
star thresholds, milestone tap-counts, number ranges, round lengths — live in each component's
"tuning levers", NOT here. How to build a game: `game-development.md`. Drag games: `drag-and-drop.md`.

Shared shape: task games run bounded rounds → `RoundResultScreen`, grant **live per-task XP** (via
`useRound`'s `gameId`), and never punish wrong answers (they only break a question's first-try flag).
Calm "Lær …" browses run no round — they earn **per-new-item browse XP** (`useBrowseXp`). Stickers
are the **trophy of a level-up** now (not per-round / per-browse) — see CLAUDE.md Progression.
gameIds are `<section>.<game>`.

## Math — `math.counting/.addition/.subtraction/.comparison/.patterns`
- Distractors are **near-number** (digit-swap, off-by-one/ten), not random.
- **Tal Quiz counts, it doesn't symbol-match**: for small n the numeral is hidden and exactly n
  objects are shown ("Hvor mange?"); only larger n shows the bare numeral (recognition) — never a
  capped object row that misrepresents the count.
- Plus/Minus/Sammenlign **speak the completed fact** on a correct tap ("tre plus fire er syv"); Hvad
  Mangler reads the finished sequence — instead of echoing the tapped number.
- Sammenlign Tal: tap the **bigger** number (crocodile >/< "eats" it); **equality was dropped**; the
  object piles are fixed-height shrink-to-fit and order-match the numerals.
- The equation/comparison symbols `+ − = ? > <` are **baked soft-3D `SymbolTile` art**
  (`src/assets/symbols`), not emoji/glyphs — don't re-bake or emoji them. Numerals stay Typography.

## Alphabet — `alphabet.quiz`
- Bogstav Quiz is **all word-association**: show a picture, tap the letter the word starts with (the
  trivial "hør bogstavet" recognition mode was removed). The prompt subject is baked soft-3D art (not a
  flat emoji). Distractors random; **Q is the only letter never asked** (distractor-only) — W/X/Å are
  askable. The askable set is `WORD_LETTERS`; the full display manifest (incl. Q) is `LETTER_WORDS`.

## Ordleg — `ordleg.read/.spelling/.mic`
- Læs Ordet **never reads the prompt word aloud** — silent decoding IS the exercise. Thin
  `UnifiedQuizGame`; after 2 wrong picture taps the correct picture pulses.
- Stav Ordet (hand-rolled): after 2 wrong taps on a slot the correct tile pulses (never-fail
  next-letter hint; reduced-motion → static glow; using it costs a star).
- Sig et Ord is **open-ended** — say any word → it's spelled back. **No target word, no STT grading**;
  a recognized word counts, an STT mishear stays on the same question without counting.

## English — `english.listen/.word/.translate`
- Thin `UnifiedQuizGame` configs. Distractors **random**, themes **mixed** (no minimal-pairs, no
  per-theme rounds) — a deliberate beginner floor. The green `EnglishRepeatButton` is the only audio
  affordance (no "audio playing" cue).

## Farver — `colors.farvejagt/.ramfarven/.quiz/.nuancer` (+ Lær Farver browse)
All drag-based except the calm Lær Farver browse; hand-rolled dnd-kit — see `drag-and-drop.md`.
- Farvejagt: drag objects into the target-color circle; a correct drop snaps into a ring + spoken
  "{objektet} er {farve}".
- Ram Farven: drag 2 droplets into the pot; correct → recipe reveal + spoken "rød og blå bliver
  lilla"; wrong → fizz, **no spoken feedback**; `Tøm` empties the pot. Its mixing recipes
  (`primaryColors`/`possibleTargets`/`mixingRules`) live in `RamFarvenGame.tsx` (NOT colorContent); the
  target pool is **difficulty-gated** (Let → Normal → Svær widen from the iconic secondaries to all 9).
- Hvilken Farve?: drag the object onto the matching color swatch.
- Nuancer: drag 3 shades into slots **light→dark** (left = lightest).
- **Educational color content is data** in `src/config/colorContent.ts` (NOT themeable); color hexes
  stay data, never themed.
- **Content-quality invariants (PRD-04):** the spoken echo must go through `spokenColor(hue, neuter)`
  so the adjective agrees in gender ("æblet er rødt", "havet er blåt" — not "rød"/"blå"); every
  `ColorObject` carries a `neuter` flag, and objects whose emoji contradict their color (⚽/👒/☁️/🌸)
  carry `quizSafe:false` so Hvilken Farve never scores the child on a misleading picture.

## Memory — `memory.letters.10/.20`, `memory.numbers.10/.20`
- One engine (`UnifiedMemoryGame.tsx`) + config factory (`MemoryGame.tsx`); letters/numbers × 10/20
  pairs as separate static-difficulty routes.
- **One board = one round** (no `useRound` — every pair is always found, so the only skill signal is
  mismatches): `recordRoundResult(gameId, { correct: pairs, total: pairs + mismatches, longestStreak })`
  → stars scale with mismatches, and longest match-streak is the record.
- Juice: `flip` on reveal, `match` + a light pop on a pair (deliberately NOT a full `celebrateTier`),
  `celebrateTier('streak')` every 3rd consecutive match, gentle `wrong` on a mismatch.
