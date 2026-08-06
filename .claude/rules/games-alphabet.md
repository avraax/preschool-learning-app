---
paths:
  - "src/components/alphabet/*.tsx"
---

# Games catalog — Alphabet — `alphabet.quiz` (+ Lær Alfabetet browse)

One section of the games catalog. The cross-game invariants it relies on — the difficulty spine, the
no-giveaway rule, pool-vs-bag, both-gestures — are in `.claude/rules/games-catalog.md`, which loads
alongside this file.

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
