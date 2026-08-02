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

**Browses carry no counter and no progress bar** (removed 2026-08-01, owner: no educational purpose) —
a browse has no score and no finish line, so a filling bar only implied a list to get through. The only
thing in a browse's HUD is the shared reward ring; `answered/total` pips belong to bounded ROUNDS. This
retired `announcePosition` ("Du er ved tal 18 ud af 100") from the audio controller entirely.

Shared shape: task games run bounded rounds → `RoundResultScreen`, grant **live per-task XP** (via
`useRound`'s `gameId`), and never punish wrong answers (they only break a question's first-try flag).
Calm "Lær …" browses run no round — they earn **per-new-item browse XP** (`useBrowseXp`). Stickers
are the **trophy of a level-up** now (not per-round / per-browse) — see CLAUDE.md Progression.
gameIds are `<section>.<game>`.

## Math — `math.counting/.addition/.subtraction/.comparison/.patterns`
- Distractors are **near-number** (digit-swap, off-by-one/ten), not random.
- **NOTHING on a math board restates a number that's already on it.** Every countable stand-in has now
  been removed by the owner: Lær Tal's star/dot cluster and Sammenlign Tal's piles (2026-08-01), Tal
  Quiz's object row and Plus/Minus's ten-frame under the number sentence (2026-08-02). Each one let the
  child reach the answer by counting blobs instead of reading the numerals, which is the skill. Don't
  re-add a countable layer to a board whose numbers are visible — the reading IS the task.
- **Tal Quiz is LISTEN-then-recognise, and shows NOTHING of the answer** (owner 2026-08-01): the
  number lives only in the spoken "Find tallet N" (+ Hør igen) and the focal zone is the shared
  `ListenHero` (speaker + audio-driven equalizer, also used by Lyt og Find). Both earlier visuals were
  removed as giveaways — the printed numeral (a tile row containing it made the tap shape-matching)
  AND the n-objects "Hvor mange?" counting row (a second visible copy of the answer). The task is real
  because Danish inverts the number word ("syvogtredive" = seven-and-thirty), which is what the
  digit-swap distractors test.
- Plus/Minus/Sammenlign **speak the completed fact** on a correct tap ("tre plus fire er syv"); Hvad
  Mangler reads the finished sequence — instead of echoing the tapped number.
- Lær Tal's **"Hør tallene"** pill counts 1→N out loud (the number sibling of Lær Alfabetet's autoplay:
  same run token + fire-and-forget onset step, its own wider step because Danish number words are longer —
  `src/config/numberAutoplay.ts`; shared pacing facts in `autoplayPace.ts`). **One steady flow, no
  grouping and no tempo change** — that phrasing belongs to reciting the alphabet, not to counting. It
  follows the VISIBLE range (100, or 60 at Let) so the ring always has a cell, and earns no XP.
  `NUMBER_BROWSE_RATE` is the single source for the faster number rate — tap, autoplay and the prebake
  enumerator all read it (a rate is part of the cache key).
- Plus/Minus's prompt is the **number sentence alone** on its clay tile (`a op b = ?`), with the
  `?`→answer POP on a correct tap. PRD-15 W1's countable ten-frame beneath it is gone (see above).
- Sammenlign Tal: tap the **bigger** number (crocodile >/< "eats" it); **equality was dropped**. It shows
  **numerals ONLY** — the counted object piles beside them were removed 2026-08-01 (owner): comparing two
  piles of blobs let the child win without reading either numeral, which is the whole skill. Don't
  re-add them as a "counting aid".
- The equation/comparison symbols `+ − = ? > <` are **baked soft-3D `SymbolTile` art**
  (`src/assets/symbols`), not emoji/glyphs — don't re-bake or emoji them. Numerals stay Typography.

## Alphabet — `alphabet.quiz` (+ Lær Alfabetet browse)
- Bogstav Quiz is **all word-association**: show a picture, tap the letter the word starts with (the
  trivial "hør bogstavet" recognition mode was removed). The prompt subject is baked soft-3D art (not a
  flat emoji). **Q is the only letter never asked** (distractor-only) — W/X/Å are askable. The askable
  set is `WORD_LETTERS`; the full display manifest (incl. Q) is `LETTER_WORDS`.
- Distractors are **confusable-seeded**, not random: Normal/Svær draw from the correct letter's
  look-/sound-alike group (M/N, B/D/P, Æ/Ø/Å…) so a right answer means the child told them apart, and
  **Let deliberately EXCLUDES that group** so its options read as maximally dissimilar.
- Lær Alfabetet (browse) speaks **"{bogstav} som {ord}"** on a TAP, never the bare letter name — a child
  who already knows every letter learns nothing from the name. Both this and the quiz's correct-answer
  fact go through the shared builders in `src/config/letterWords.ts` (per-letter pronunciation overrides
  — see `audio-system.md`).
- Lær Alfabetet's **"Hør alfabetet"** pill autoplays A→Å: the bare letter NAMES (the sequence is the
  lesson here, so no "som {ord}"), grouped A–G · H–N · O–U · V–Z · Æ Ø Å with a longer breath between
  groups (`src/config/alphabetGroups.ts` — the tempo levers), driving `currentIndex` so the ring + bloom
  travel in step. The letters are paced on a fixed **onset-to-onset step** and deliberately NOT awaited —
  awaiting the padded clips halved the pace (see `audio-system.md`); the step's floor is the longest
  spoken name plus playback startup. **Earns no XP** (browse XP stays tap-only; one press would otherwise mint the whole
  section's allowance). An incrementing run token aborts the loop on a letter tap, a re-press or
  unmount — `mountedRef` alone is not enough.

## Ordleg — `ordleg.read/.spelling/.mic`
- Læs Ordet **never AUTO-reads the prompt word** — silent decoding IS the exercise (the prompt carries
  a silent first-letter decode cue via `questionVisual.emphasizeFirstLetter`, styling only). The
  correct-tap **does** speak the tapped picture's name — that names the child's *choice*, not the
  prompt, so it's not a violation. Thin `UnifiedQuizGame`; after 2 wrong picture taps the correct
  picture pulses.
- Stav Ordet (hand-rolled): after 2 wrong taps on a slot the correct tile pulses (never-fail
  next-letter hint; reduced-motion → static glow; using it costs a star).
- Sig et Ord is **open-ended** — say any word → it's spelled back. **No target word, no STT grading**;
  a recognized word counts, an STT mishear stays on the same question without counting.

## English — `english.listen/.word/.translate`
- Thin `UnifiedQuizGame` configs. Distractors **random**, themes **mixed** (no minimal-pairs, no
  per-theme rounds) — a deliberate beginner floor.
- **The three are distinct skills** (PRD-17 W1 — don't collapse them): Lyt og Find = audio→picture;
  **Find det Engelske Ord** = picture→English word (recognition, keeps the baked picture prompt);
  **Dansk til Engelsk** = Danish word, NO picture → English word (translation). Picture-presence is
  the deliberate differentiator — never re-add a picture to Translate.
- Lyt og Find's listen-hero equalizer is driven by the **real `audio.isPlaying`** state (bars dance
  during playback, settle when idle) — read the audio hook, never a component-level `isPlaying`.
- English words spoken by en-US Ava (`speakEnglish`); Translate's Danish prompt uses the Danish voice.

## Farver — `colors.farvejagt/.ramfarven/.quiz/.nuancer` (+ Lær Farver browse)
All drag-based except the calm Lær Farver browse; hand-rolled dnd-kit — see `drag-and-drop.md`.
- Farvejagt: drag objects into the target-color circle; a correct drop snaps into a ring + spoken
  "{objektet} er {farve}".
- Ram Farven: drag 2 droplets into the pot; correct → recipe reveal + spoken "rød og blå bliver
  lilla"; wrong → fizz, **no spoken feedback**; `Tøm` empties the pot. Its mixing recipes
  (`primaryColors`/`possibleTargets`/`mixingRules`) live in **`src/config/colorMixing.ts`** — moved out of
  the component 2026-08-02 because the game speaks lines built from them, and data stranded in a `.tsx`
  can never be enumerated for prebake (see `audio-system.md`'s protocol). The pot mechanics and the
  **difficulty-gated** target pool (Let → Normal → Svær widen from the iconic secondaries to all 9) stay
  in the game.
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
