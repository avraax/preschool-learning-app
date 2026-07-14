# PRD-05 — Gameplay fairness & help (engine hint, difficulty, spoken answers)

**Priority:** P2
**Scope:** Medium
**Depends on:** best after PRD-02 (engine input-lock) so the hint plugs into a clean advance path

---

## Context

Task quizzes run bounded rounds of 8 via `useRound` + `src/components/common/UnifiedQuizGame.tsx`
(configs) or hand-rolled components. The five hand-rolled color/spelling games implement a **never-fail
hint** — after 2 wrong tries the correct answer pulses (reduced-motion → static glow); using it costs a
star because the 2 wrongs already broke first-try. A manual, static **Let/Normal/Svær** difficulty
system exists — `src/hooks/useDifficulty.ts`, `src/components/adult/DifficultyPanel.tsx`
(in the "Til de voksne" menu), persisted in `progressStore.settings.difficulty` — consumed by ~12
games and **undocumented in CLAUDE.md**. The owner tunes difficulty manually (no adaptivity by design).

The owner's child (~5) counts to 60–70, adds to 20 on fingers, does basic subtraction, knows all
letters, cannot read/spell yet.

## Problems (with evidence)

### P1 — The engine quizzes have no "stuck" help

The never-fail hint exists in the hand-rolled games but in **none** of the 7 `UnifiedQuizGame`
quizzes (AlphabetGame, MathGame, HvadMangler, LaesOrdet, 3 English). A child stuck in Bogstav Quiz or
Lyt og Find just retries forever — nothing ever marks the correct answer. Inconsistent and
frustrating.

### P2 — Math games never say the completed fact

Plus/Minus (`MathOperationGame.tsx`), Sammenlign (`ComparisonGame.tsx`), and HvadMangler echo only the
tapped number, never "tre plus fire er syv" or "sytten er større end ni". The reinforcement moment —
the whole point of the exercise — is silent.

### P3 — Difficulty calibration vs the child (defaults)

- **Tal Quiz (`MathGame.tsx`)** renders the target numeral giant, so the task is symbol-matching, not
  counting; `MAX_HERO_DOTS = 20` also means "Find tallet 37" shows 37 but only 20 objects. Trivial for
  a child who counts to 70.
- **Memory (`UnifiedMemoryGame.tsx` / `MemoryGame.tsx`)** 3★ thresholds (10-pair {3★≤6}, 20-pair
  {3★≤14}) require near-perfect recall — effectively unreachable for a 5yo, so the games he may play
  most have a flat reward curve.
- **Addition/subtraction "normal"** tops out at sum ≤ 20 / result 0–9 but the easy path is below his
  level; the harder ranges are gated behind Svær.
- **ComparisonGame** object piles are clipped with `overflow: hidden` near counts of 20, so the
  *visible* quantity can contradict the numerals — undermines the compare-quantities pedagogy.

### P4 — Læs Ordet "let" pool too small (also noted in PRD-04)

Only 3 two-letter words, no anti-repeat → constant repetition.

## Goals / Non-goals

**Goals:** a consistent never-fail hint across all quizzes; spoken reinforcement of the completed
fact; difficulty defaults that actually challenge the target child while keeping the manual override
authoritative; visible quantity that matches numerals.

**Non-goals:** any *adaptive* difficulty (explicitly unwanted — keep it manual/static); reward-screen
UX (PRD-09).

## Implementation plan

1. **Engine hint (P1).** Add an opt-in `hintAfterNWrong` (default 2) to `UnifiedQuizConfig`/the
   engine. Track wrong taps on the current question; after N, pulse the correct `AnswerTile`
   (reduced-motion → static glow), matching the hand-rolled games' behaviour. The 2 wrongs already
   break first-try, so no extra star bookkeeping is needed. Enable it for the 7 config quizzes. Fold
   the hint into the PRD-02 advance-lock so it can't fire during the resolve window.
2. **Speak the fact (P2).** In each math correct-branch, `audio.speak(...)` the full sentence
   ("tre plus fire er syv", "sytten er større end ni", the completed pattern) — **instead of**, not
   over, the number echo (single-channel audio, no queue). Add strings via the existing Danish phrase
   helpers.
3. **Difficulty calibration (P3), defaults only — keep manual override authoritative:**
   - Add a "count the objects" counting variant for n ≤ 20 (hide the numeral, show exactly n objects,
     ask the child to pick the count) — makes counting actually happen. Gate it as the normal counting
     experience, or a sub-mode.
   - Retune Memory 3★ thresholds so a strong child can reach 3★ (e.g. 10-pair {three: 9, two: 18},
     20-pair {three: 18, two: 34}) — data only.
   - Review addition/subtraction normal ranges against "adds to 20"; consider bumping normal.
   - Cap ComparisonGame visible piles (~10) and never clip, so visible order always matches the
     numerals.
4. **Læs Ordet let pool (P4).** Widen with more picturable 2-letter (and easy 3-letter) words; add the
   anti-repeat guard (shared with PRD-04 if done together).

## Acceptance criteria

- [ ] After 2 wrong taps in any `UnifiedQuizGame` quiz, the correct tile pulses/glows.
- [ ] Correct answers in Plus/Minus/Sammenlign/HvadMangler are spoken as full facts.
- [ ] Memory 3★ is attainable by strong-but-imperfect play (verify the new thresholds against a
      typical mismatch count).
- [ ] Counting exercises counting for n ≤ 20 (numeral hidden or a dedicated count-the-objects mode).
- [ ] ComparisonGame's visible object piles are never clipped and order-match the numerals.
- [ ] Setting Let/Normal/Svær in the adult menu still overrides all of the above (manual control
      preserved).

## How to verify

- Drive each quiz in the `ui-screenshot` harness; make 2 deliberate wrong taps and screenshot the
  pulsing correct tile.
- Read `/api/tts-azure` POST bodies from the harness to confirm the spoken fact strings.
- Play Memory and count mismatches vs the star awarded; confirm the new curve.
- Screenshot ComparisonGame at high counts (e.g. 18 vs 20) on iPad + phone-landscape sizes and confirm
  no clipping.

## Risks / notes

- Respect the "no adaptive difficulty" constraint — these are *default* changes and new modes, all
  still overridable by the manual panel.
- Document the difficulty system in CLAUDE.md as part of PRD-10 (or note it here if done first).
- Speaking the fact must replace, not stack on, the number echo (single audio channel, no queue).
