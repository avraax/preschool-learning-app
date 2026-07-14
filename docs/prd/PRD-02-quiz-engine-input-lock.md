# PRD-02 — Quiz-engine input lock, timer hygiene & hook stability

**Priority:** P0 (double-rewards and unfairly lost stars across ~11 games)
**Scope:** Medium
**Depends on:** none (but PRD-10's refactor builds on the result)

---

## Context

Task-based games run **bounded rounds of 8 questions** (3★ = 0 mistakes, 2★ ≤ 2), ending on a
`RoundResultScreen`, using the `useRound` hook (`src/hooks/useRound.ts`) and persisting via
`progressStore.recordRoundResult(gameId, …)` (`src/services/progressStore.ts`). Wrong answers don't
punish score directly — they only break that question's *first-try* flag.

The shared quiz engine is `src/components/common/UnifiedQuizGame.tsx`. Most quizzes are thin configs
over it (AlphabetGame, MathGame, HvadManglerGame, LaesOrdetGame, the 3 English games). Some games
hand-roll the same scaffolding: `src/components/math/MathOperationGame.tsx` (plus/minus),
`src/components/math/ComparisonGame.tsx` (crocodile), `src/components/ordleg/SpellingGame.tsx`.

Audio goes through `useSimplifiedAudioHook()` (`src/hooks/useSimplifiedAudio.ts`) →
`SimplifiedAudioController` singleton. There is **no audio queue**: starting new audio cancels
whatever is playing.

## Problems (with evidence)

### P1 — No input-lock during the correct-answer dwell → double-advance & double round-record

`UnifiedQuizGame.tsx` `handleItemClick` (~lines 287–358) guards only `!gameReady || !currentItem`.
Tiles are never disabled (the `disabled` prop exists on `AnswerTile.tsx` but is never passed). After a
correct tap it `await`s `speakClickedItem(...)` then schedules an **untracked** advance
`setTimeout` (~line 335) of `DWELL_CORRECT()` = 1100–1400ms (`src/theme/motion.ts`).

- **Double-tapping the correct tile** (classic 5yo behaviour) runs the correct path twice →
  `round.completeQuestion()` fires twice → the round index jumps 2. On **question 8** both timers see
  the round done → `finishRound()` → `progressStore.recordRoundResult()` runs **twice**: double
  stickers, `totalStars += stars` twice, `roundsCompleted += 2`.
- Same hole in `MathOperationGame.tsx` (~lines 263–315, timer ~299).
- `ComparisonGame.tsx` has a `locked` flag but sets it only *after* an `await` (~lines 280–287), a
  narrower but real window.

### P2 — A tap during the celebration retroactively poisons an earned first-try

`UnifiedQuizGame.tsx:~329` sets `firstAttemptRef.current = false` on any wrong-tile tap — **including
during the ~1.4s dwell after the correct answer was already found** (tiles stay enabled). The pending
advance reads the ref at fire time (~line 344), so a question won on the first try is recorded as a
mistake — silently turning a 3★ round into 2★/1★. Kids tap everything during confetti. Same in
`MathOperationGame.tsx:~294`.

### P3 — SpellingGame completion race

`SpellingGame.tsx` (~lines 292–332): on the last correct tile it `await`s the letter echo *before*
setting `isAdvancing.current = true`. A tap on a leftover distractor tile during that ~1s echo hits the
wrong branch (`targetLetters[filledCount]` is `undefined`), fires the `wrong` SFX + shake and sets
`firstAttemptRef.current = false` → the completed word's star is lost. Fix: set `isAdvancing` when
`newFilled === targetLetters.length`, **before** the await.

### P4 — Broken effect cleanup → timers fire after unmount → ghost TTS on the menu

`useSimplifiedAudioHook` (`useSimplifiedAudio.ts`, ~lines 132–188) returns a **brand-new object of 30+
fresh `.bind()`s every render**. In `UnifiedQuizGame.tsx` (init effect ~lines 234–257), this makes the
effect's deps change every render, so it re-runs each render — but after the first run it early-returns
at `if (hasInitialized.current) return` **without returning a cleanup**. Net: React has no cleanup to
run on unmount, so `timeoutRef`/the per-question prompt timer (~line 181) and the advance timer (~335,
untracked) survive unmount. Navigating away within ~1.4s of a correct answer can start the *next*
question's prompt speaking over whatever screen the child is now on. `NavigationAudioCleanup` in
`App.tsx` ran at navigation time, *before* this later `speak()`, so it doesn't help. Same structure in
`MathOperationGame.tsx` and `SpellingGame.tsx`.

## Goals / Non-goals

**Goals:** a correct tap resolves a question exactly once; taps after resolution can't change its
score; no timer or `speak()` runs after unmount; the audio hook has a stable identity so dependency
arrays and cleanups behave.

**Non-goals:** merging the hand-rolled games into the engine (PRD-10); adding the never-fail hint to
the engine (PRD-05); audio latency/caching (PRD-06).

## Implementation plan

1. **Advance-lock (P1/P2/P3).** In `UnifiedQuizGame.tsx` add an `isAdvancing = useRef(false)`. At the
   very top of `handleItemClick`, `if (isAdvancing.current) return`. On a **correct** tap set
   `isAdvancing.current = true` synchronously (before any `await`). Clear it in `generateNewQuestion`
   (start of the next question). Also pass `disabled={isAdvancing.current}` (or `feedback != null`) to
   the `AnswerTile`s so they visibly stop responding. Apply the same pattern to `MathOperationGame.tsx`.
   In `ComparisonGame.tsx`, move `setLocked(true)` above its `await`. In `SpellingGame.tsx`, set
   `isAdvancing.current = true` as soon as the final correct letter fills the word, before the echo await.

2. **Track and clear timers (P4).** Store the advance/prompt timeouts in refs and clear them in a
   dedicated **empty-dep** unmount effect (`useEffect(() => () => { clearTimeout(promptRef.current);
   clearTimeout(advanceRef.current); … }, [])`). Keep the init logic in its own effect; don't rely on
   the init effect's cleanup for teardown.

3. **Memoize the audio hook (root cause of P4, perf win everywhere).** In
   `src/hooks/useSimplifiedAudio.ts`, the methods are all binds of a singleton — hoist the stable
   method set to a module-level object (or `useMemo(() => ({...}), [])`), and only recompute the
   reactive fields (`isPlaying`, `isAudioReady`) per render. Return a `useMemo`'d object so its
   identity is stable across renders when nothing reactive changed. This makes every downstream
   dependency array in the app honest and cuts a re-render of every mounted game on every TTS
   start/stop boundary. **Verify no component relied on the object changing identity** (they shouldn't).

## Acceptance criteria

- [ ] Double-tapping the correct tile on question 8 records the round **once** (one sticker grant, one
      `totalStars` increment). Add/inspect a log or read `progressStore` state before/after.
- [ ] Tapping a wrong tile during the correct-answer celebration does **not** change the round's star
      result.
- [ ] In SpellingGame, tapping leftover tiles right after completing a word does not cost the star.
- [ ] Navigating Back within ~1.5s of answering does not produce audio on the next screen.
- [ ] No regression in normal play: each of AlphabetGame, MathGame, MathOperationGame, ComparisonGame,
      HvadMangler, the 3 English games, LaesOrdet, SpellingGame completes an 8-question round and lands
      on `RoundResultScreen`.

## How to verify

- Drive a quiz with the `ui-screenshot` harness; script a **double `element.click()`** on the correct
  tile with no delay and confirm the round advances by exactly one and the result screen shows a single
  sticker pair.
- Script: answer correctly, then immediately click a wrong tile; confirm the final star count matches a
  clean first-try round.
- Watch the harness console-error/exception lines throughout.
- For P4: navigate into a game, answer, and `--click` the back arrow ~1s later; assert no new
  `/api/tts-azure` POST fires after the route change (the harness logs network; or add a temporary log).

## Risks / notes

- `useRound` is synchronous/ref-backed, so the fix is about not calling `completeQuestion` twice, not
  about async state.
- The hook memoization touches a widely-used file — run the full game sweep in the harness after.
- Keep the streak chime behaviour (every 3rd correct, not on the final question) intact.
