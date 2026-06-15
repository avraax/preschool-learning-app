# Overhaul PRD — Ordleg (`-04-`)

**Date:** 2026-06-15
**Part of:** Game Experience Overhaul (see `plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md`).
**Depends on:** Foundation PRD (`plans/games-overhaul/tmp-prd-overhaul-01-foundation.md`) — **already
implemented** (progress store, `useRound`, `RoundResultScreen`, `StickerReveal`, `sfxClient`,
celebration tiers, the `UnifiedQuizGame` round path). Math (`-02-`) and Alphabet (`-03-`) shipped on
top of it; `ComparisonGame.tsx` is the proven hand-rolled-round template this PRD reuses.

> **Self-containment:** written so a fresh implement session builds it with near-zero re-exploration.
> Verbatim current signatures + exact `file:line` integration points are in **Appendix A**. Read this
> whole file plus the Foundation PRD before coding.

## Context

Ordleg is the son's (~5) **emergent-reading frontier** — three games, none yet on the bounded-round /
reward system:

- **Læs Ordet** — silent read → pick the matching picture. Standing rule (owner memory): the prompt
  word is **never read aloud** (he can't spell/read fluently yet — reading it for him defeats the
  exercise).
- **Stav Ordet** — hear the word + see its picture → tap letters in order to spell it.
- **Sig et Ord** — hold the mic, say a word, hear it spelled back (his likely favourite).

All three currently loop endlessly, use the legacy `celebrate()` (or none), and never feed the
sticker hub. **Success looks like:** each finishes in **rounds of 8**, ends on the shared
`RoundResultScreen` (stars → "Ny rekord!" → streak → sticker reveal → replay/album/back), drips
stickers into the album, and uses the celebration **tiers** + **SFX** — at or above today's
immersive polish, with identical reward language to Math & Alphabet.

**Static difficulty only** (standing constraint): no adaptive difficulty, no in-game level pickers,
no word-list expansion. Tuning = editing named constants in a later session.

### Scope

| Game | Route | Component | Type |
|---|---|---|---|
| Læs Ordet | `/ordleg/read` | `LaesOrdetGame.tsx` | `UnifiedQuizGame` config |
| Stav Ordet | `/ordleg/spelling` | `SpellingGame.tsx` | hand-rolled |
| Sig et Ord | `/ordleg/mic` | `SpeakWordGame.tsx` | hand-rolled (STT) |

**Out of scope:** the Ordleg section has no Memory variant (Memory is `-07-`).

## Current state (with concrete weaknesses)

- **`LaesOrdetGame.tsx`** — thin `UnifiedQuizGame` config (`:47-89`). 20 `READING_WORDS` (`:16-37`);
  the word is shown ALL-CAPS via `questionVisual: { emoji: '', word: w.word.toUpperCase() }`
  (`:55`); `showRepeat: false` (`:80`); prompt + repeat audio are deliberate no-ops (`:86`, `:88`);
  tapping a picture names the child's choice (`:87`). **Weakness:** no round → endless loop, no
  reward, no progress memory.
- **`SpellingGame.tsx`** — hand-rolled. 36 `SPELLING_WORDS` (`:22-61`); `DANISH_ALPHABET` distractor
  pool (`:63`); `buildTiles` = word letters + 3 distractors, shuffled (`:180-194`); slots fill
  left-to-right (`handleTileClick :239-272`); word-complete re-speaks + advances (`completeWord
  :274-294`). Uses the **legacy** `useCelebration().celebrate()` (`:108`, `:279`). **Weaknesses:**
  wrong letter only shakes (`:266-271`) — **no `wrong` SFX**; **no first-try tracking**, **no
  round/reward**, and **no hint** when the child gets stuck on a slot.
- **`SpeakWordGame.tsx`** — hand-rolled hold-to-talk STT (`useSpeechInput` → `/api/stt`). Recognizes
  any first word and spells it back letter-by-letter (`runSpellingSequence :183-216`). Uses the
  **legacy** `celebrate()` (`:37`, `:208`). Good STT-fail retry already exists (`handleResult
  :155-181`, friendly "Det hørte jeg ikke helt" at `:158-169`). **Weaknesses:** **no round, no
  score, no reward** — every word is a one-off with the same confetti.

## Target experience

### 1. Læs Ordet — `LaesOrdetGame.tsx` (tiny: add round config only)

**Before:** endless; a correct tap auto-advances forever; no reward.
**After:** add **two fields** to the config object:
```ts
round: { length: 8, starThresholds: { three: 0, two: 2 } },
gameId: 'ordleg.read',
```
The `UnifiedQuizGame` engine then does **everything** with zero further changes here — runs a bounded
8-question round, tracks `firstAttempt`/streak, fires `celebrateTier('micro')` on correct +
`celebrateTier('streak')` every 3rd first-try + `sfx.play('wrong')` on a wrong tap, renders
`RoundResultScreen`, and calls `progressStore.recordRoundResult('ordleg.read', …)`.

**Kept verbatim (do NOT change):** `showRepeat: false`, the no-op `speakQuizPrompt`/`getRepeatAudio`,
`speakClickedItem` (names the tapped picture), the ALL-CAPS word display, random distractors, the
20-word `READING_WORDS` list. **No hints** (owner decision — silent decoding *is* the exercise).

### 2. Stav Ordet — `SpellingGame.tsx` (hand-rolled round wiring, mirror `ComparisonGame.tsx`)

**Before:** legacy `celebrate()`, endless loop, wrong = shake only, can get stuck on a slot.
**After:**

**a) Bounded round + result screen** (copy the `ComparisonGame.tsx` shape):
- `const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })`
- `const firstAttemptRef = useRef(true)` and `const [roundOutcome, setRoundOutcome] =
  useState<RoundOutcome | null>(null)`
- `finishRound(firstTryCorrect, longestStreak)` → `progressStore.recordRoundResult('ordleg.spelling',
  { correct: firstTryCorrect, total: round.length, longestStreak }, { starThresholds: { three: 0,
  two: 2 } })` → `setRoundOutcome(outcome)`.
- `handleReplay()` → `stopCelebration(); setRoundOutcome(null); round.reset(); resetScore();
  generateNewWord()`. (Add `resetScore` to the `useGameState` destructure — currently only `score,
  incrementScore, isScoreNarrating, handleScoreClick` at `:102`.)
- Render: when `roundOutcome` is set, render `<RoundResultScreen outcome={roundOutcome}
  categoryId="ordleg" backRoute="/ordleg" onReplay={handleReplay} />` **in place of** the
  prompt/slots/tiles block (wrap the existing `{gameReady && current && (…)}` body in the
  `roundOutcome ? <RoundResultScreen/> : (…)` branch, exactly like `ComparisonGame.tsx:366-373`).

**b) Celebration tiers + SFX** (replace legacy `celebrate`):
- Destructure `celebrateTier` + `celebrationDuration` from `useCelebration()` (`:108`) and pass
  `duration: celebrationDuration` to the `GameShell` `celebration` prop (`:324`).
- In `completeWord` (`:274-294`), swap `celebrate()` → `celebrateTier('micro')`.
- In the wrong-letter branch (`:266-271`), add `sfx.play('wrong')` alongside the existing shake
  (`import { sfx } from '../../services/sfxClient'`).

**c) First-try tracking** (drives stars/streak):
- Set `firstAttemptRef.current = true` in `generateNewWord` (`:198-228`, near the other resets).
- Set `firstAttemptRef.current = false` on **any** wrong letter tap (`:266`).
- In `completeWord`, after re-speaking the word, replace the bare `generateNewWord()` (`:291`) with:
  ```ts
  const r = round.completeQuestion(firstAttemptRef.current)
  if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
  if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
  else generateNewWord()
  ```

**d) Next-letter hint (never-fail scaffold):**
- Add `const slotWrongRef = useRef(0)` (wrong taps on the **current** slot) and `const [hintTileId,
  setHintTileId] = useState<string | null>(null)`.
- On a wrong tap: `slotWrongRef.current += 1`; if `slotWrongRef.current >= 2`, find the unused tile
  whose `letter === targetLetters[filledCount]` and `setHintTileId(tile.id)`.
- On a **correct** placement and at the **start of each new word**: `slotWrongRef.current = 0;
  setHintTileId(null)` (the next slot starts fresh).
- In the tile render (`:417-472`), when `tile.id === hintTileId`, drive a gentle attention pulse
  (Framer `animate={{ scale: [1, 1.12, 1] }}` loop, or a glow ring in `categoryThemes.ordleg.accentColor`),
  **reduced-motion aware** (`useReducedMotion()` → static highlight instead of the loop). The hint
  only *points*; it never auto-places. (A wrong tap already broke first-try, so using the hint costs
  a star — fair, gentle, and the child can always finish.)

### 3. Sig et Ord — `SpeakWordGame.tsx` (open-ended round, **no target word**)

**Before:** legacy `celebrate()`, endless, no score/reward.
**After — keep the open-ended magic ("say any word → I'll spell it back"), wrap in a round of 8:**

- **A "question" = one recognized word.** The round is "say 8 words". There is **no target word** and
  **no STT grading** (owner decision — keep it pressure-free).
- **State to add:** `const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })`,
  `const firstTryRef = useRef(true)`, `const [roundOutcome, setRoundOutcome] = useState<RoundOutcome
  | null>(null)`, and `useGameState()` (for the in-round count) — `const { score, incrementScore,
  resetScore, isScoreNarrating, handleScoreClick } = useGameState()`.
- **STT-fail path** (`handleResult :158-169`, no word extracted): keep the friendly "Det hørte jeg
  ikke helt – prøv igen!" retry **as-is**, but set `firstTryRef.current = false` and **stay on the
  same question** (do not advance, do not count). This is the only thing that breaks "first try".
- **Recognized-word path** (`handleResult :171-180`): keep `runSpellingSequence` (read back → spell
  letter-by-letter → celebrate → say again), but **swap `celebrate()` → `celebrateTier('micro')`**
  (in `runSpellingSequence :208`) and `incrementScore()`. After the sequence completes, instead of
  the plain `setPhase('idle')` (`:180`):
  ```ts
  const r = round.completeQuestion(firstTryRef.current)
  if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
  if (r.done) { finishRound(r.firstTryCorrect, r.longestStreak) }
  else { firstTryRef.current = true; setPhase('idle') }   // fresh question
  ```
- **first-try** = produced a recognized word on this question **without** a preceding STT-fail retry.
  `firstTryRef.current = true` when a fresh question begins; `false` on each STT-fail retry within the
  same question.
- `finishRound(firstTryCorrect, longestStreak)` → `progressStore.recordRoundResult('ordleg.mic',
  { correct: firstTryCorrect, total: round.length, longestStreak }, { starThresholds: { three: 0,
  two: 2 } })` → `setRoundOutcome(outcome)`.
- `handleReplay()` → `stopCelebration(); setRoundOutcome(null); round.reset(); resetScore();
  firstTryRef.current = true; setPhase('idle')`.
- **In-round progress:** add `<OrdlegScoreChip score={score} disabled={isScoreNarrating}
  onClick={handleScoreClick} />` to the `GameShell` `score` slot (currently none, `:222-229`) —
  shows the words-said count this round. (`import { OrdlegScoreChip } from '../common/ScoreChip'`.)
- **Render:** when `roundOutcome` is set, render `<RoundResultScreen … categoryId="ordleg"
  backRoute="/ordleg" onReplay={handleReplay} />` in place of the mic UI, **inside** the `supported`
  branch (so the `!supported` fallback at `:241-258` is unaffected).
- **Keep untouched:** the `!supported` mic-fallback UI, hold-to-talk gesture (`handlePressStart`/
  `handlePressEnd`), MIN/MAX press guards, `audio.stopAll()` before capture, and the magic mic
  button visuals. Add `celebrateTier`/`celebrationDuration` to the `useCelebration()` destructure
  (`:37`) and pass `duration: celebrationDuration` to the `GameShell` `celebration` prop (`:228`).

## Foundation hooks (how each game plugs in)

| Game | gameId | round | star thresholds | sticker set | tiers fired | SFX |
|---|---|---|---|---|---|---|
| Læs Ordet | `ordleg.read` | length 8 | 3★=0, 2★≤2 | global pool | micro, streak + round/best/sticker/page in result (all engine) | correct, wrong + result cues (engine) |
| Stav Ordet | `ordleg.spelling` | length 8 | 3★=0, 2★≤2 | global pool | micro (word done), streak, + result tiers | **wrong (added)** + result cues |
| Sig et Ord | `ordleg.mic` | length 8 | 3★=0, 2★≤2 | global pool | micro (word recognized), streak, + result tiers | result cues |

- **Sticker pool = global** for all three (no `stickerSetId`).
- The engine / `recordRoundResult` already awards **1 round sticker + a best-bonus** and detects
  **page-complete** — nothing extra to add per game.
- `celebrateTier` **already fires the tier's SFX** — do **not** also call `sfx.play` for those cues
  (only the new Stav Ordet `wrong` cue is a manual `sfx.play`, matching `ComparisonGame.tsx:274`).

## Learning design

- **Læs Ordet:** silent decoding + picture match, no audio scaffold — pure beginning reading. The
  round adds a goal + reward **without changing the cognitive task**. Wrong tap = gentle `wrong` SFX,
  retry, breaks first-try only (engine).
- **Stav Ordet:** hear the word + see its picture → ordered spelling. The **next-letter hint**
  guarantees he can always finish (never-fail) while still **costing a star** (the wrong tap that
  triggered it broke first-try) — so the hint is gentle but not free.
- **Sig et Ord:** open speech production + watching his own word get spelled — confidence and incidental
  phonics exposure. Open-ended keeps it pressure-free; the round just adds a satisfying finish + sticker.
  No STT grading means a mishear never feels like failure.
- **All:** a wrong answer / STT-fail never punishes or ends the round; stars are always ≥1 (no failure
  state for a 5yo). Honors the static-difficulty constraint.

## Visual/asset spec

- **No new raster art, no new SFX files, no new audio/welcome strings.** Welcome strings already
  exist: `laesordet → 'Læs Ordet'`, `spelling → 'Stav Ordet'`, `micword → 'Sig et Ord'` in
  `GAME_WELCOME_MESSAGES` (`SimplifiedAudioController.ts:351`, `:360`, `:361`). Reuse
  `RoundResultScreen`, `StickerReveal`, `AnswerTile`, and the existing slot/tile/mic visuals.
- **Principle 0 (quality floor):** all styling via theme tokens (`categoryThemes.ordleg.*` /
  `useTheme()` / `getCategoryTheme('ordleg')`); correct in **all 6 skins** incl. dark immersive scenes;
  `clamp()` sizing; **no-scroll** full-viewport in portrait + landscape; **reduced-motion** aware.
  The Stav Ordet hint pulse must honor reduced motion (static highlight fallback). `RoundResultScreen`
  is themed/`categoryId="ordleg"` and already meets the bar (used by Math/Alphabet).

## Data & content (concrete, complete)

- **Læs Ordet:** keep `READING_WORDS` (20, `LaesOrdetGame.tsx:16-37`) verbatim:
  ko🐄, is🍦, æg🥚, kat🐱, sol☀️, hus🏠, bil🚗, bog📖, mus🐭, and🦆, sko👟, hat🎩, ost🧀, tog🚂,
  bus🚌, ræv🦊, ged🐐, haj🦈, abe🐒, ski🎿.
- **Stav Ordet:** keep `SPELLING_WORDS` (36, `SpellingGame.tsx:22-61`) + `DANISH_ALPHABET` distractor
  pool (`:63`) verbatim. No changes.
- **Sig et Ord:** no word list (open-ended). No new data.
- **Round length 8, thresholds 3★=0 / 2★≤2** for all three. Tunable constants.

## Files to touch

**Modified**
- `src/components/ordleg/LaesOrdetGame.tsx` — add `round` + `gameId` to the config (only change).
- `src/components/ordleg/SpellingGame.tsx` — round wiring (`useRound`/`firstAttemptRef`/`roundOutcome`/
  `finishRound`/`handleReplay`/`RoundResultScreen`), `celebrateTier('micro'/'streak')`, `sfx.play('wrong')`,
  first-try tracking, next-letter hint, `resetScore`.
- `src/components/ordleg/SpeakWordGame.tsx` — open-ended round wiring, `celebrateTier`, `useGameState` +
  `OrdlegScoreChip`, first-try tracking, `RoundResultScreen`.
- `CLAUDE.md` — add an Ordleg line under the overhaul/progress section (rounds of 8; gameIds
  `ordleg.read` / `ordleg.spelling` / `ordleg.mic`; Sig et Ord stays open-ended with no STT grading).

**No new files. No new SFX assets. No new audio/welcome strings.**

**Reuse (do not reinvent)** — `UnifiedQuizGame` + its round path
(`src/components/common/UnifiedQuizGame.tsx`), `useRound` (`src/hooks/useRound.ts`),
`RoundResultScreen` (`src/components/common/RoundResultScreen.tsx`),
`progressStore.recordRoundResult`/`RoundOutcome` (`src/services/progressStore.ts`),
`useCelebration().celebrateTier`/`celebrationDuration` (`src/components/common/CelebrationEffect.tsx`),
`sfx` (`src/services/sfxClient.ts`), `GameShell`, `AnswerTile`, `OrdlegScoreChip`/`OrdlegRepeatButton`,
`useGameState`, `useReducedMotion`, `getCategoryTheme('ordleg')`/`categoryThemes.ordleg`.
**`ComparisonGame.tsx` is the literal template** for the two hand-rolled conversions (Stav Ordet, Sig et Ord).

## Verification (end-to-end, iPad-sized viewport)

Run both dev servers in **Windows PowerShell** (`npm run dev` + `npm run dev:api` — never WSL; see
project memory). Then:

1. **Rounds end + reward:** each game ends after **8** → `RoundResultScreen` with correct stars for
   0 / 2 / 3 first-try mistakes; the choreography (stars → "Ny rekord!" on a new best → streak →
   sticker reveal) plays; "Spil igen" + "Se bog" + "Tilbage" all work.
2. **Læs Ordet:** still **never** reads the prompt word; pure read-and-match; correct auto-advances,
   wrong = gentle `wrong` SFX + retry.
3. **Stav Ordet:** **2 wrong taps** on the current slot → the correct tile **pulses** (static
   highlight under reduced-motion); each wrong tap fires `wrong` SFX; finishing a word fires `micro`;
   a 3-word first-try streak fires `streak`; replay resets cleanly.
4. **Sig et Ord:** say any word → spelled back → counts as **1/8** (score chip "Ord: n"); an STT-fail
   shows the retry message, stays on the same word, does **not** advance/count; round ends on the
   result screen; `!supported` fallback still shows when the mic is blocked.
5. **Persistence:** stickers/stars/bests survive reload; private window → in-memory, no crash. Mute
   (`progressStore.settings.sfxEnabled`) silences SFX but **not** TTS.
6. **Quality floor:** all three surfaces render correctly + at-or-above current polish in **all 6
   themes**, portrait + landscape, **no scroll**; reduced-motion degrades gracefully.
7. `npm run build` and `npm run lint` clean. Use the `ui-screenshot` skill to confirm layouts + zero
   console errors.

## Open questions resolved this session

- **Sig et Ord = open-ended + round** (say any word → spell it back; **no target word, no STT
  grading**) — keep the pressure-free magic; the round just adds a finish + reward.
- **Round length = 8** for all three; thresholds 3★=0 / 2★≤2.
- **Læs Ordet = no hints** (silent read stays pure); only add round + reward.
- **Stav Ordet = next-letter hint** after 2 wrong taps on a slot; **no undo**, **no bigger-tile /
  drop-snap juice**.
- **Sticker pool = global** for all three; **word lists unchanged**.

## Deferred / not in this PRD

A vocabulary-**goal** mic mode (show a picture → say *that* word) + STT pronunciation grading;
word-list expansion / lowercase Læs Ordet display; Stav Ordet **undo/backspace** + drop-snap landing
juice + bigger tablet tiles; a Læs Ordet first-sound hint ladder; persisting any session-local state.

---

## Appendix A — Embedded implementation reference

Verbatim contracts of the code this PRD extends, cited from the repo at write time (2026-06-15).

### Læs Ordet — the only change point (`src/components/ordleg/LaesOrdetGame.tsx`)
Current config (`:47-89`) is a thin `UnifiedQuizConfig`. Add exactly two fields (anywhere in the
object, e.g. after `gameWelcomeType: 'laesordet'` at `:81`):
```ts
round: { length: 8, starThresholds: { three: 0, two: 2 } },
gameId: 'ordleg.read',
```
Everything else stays: `generateQuizItem` (`:50-57`, `questionVisual:{ emoji:'', word: w.word.toUpperCase() }`),
`generateOptions` (`:59-68`, random distractors), `showRepeat:false` (`:80`), no-op
`speakQuizPrompt`/`getRepeatAudio` (`:86`, `:88`), `speakClickedItem` (`:87`).

### `UnifiedQuizGame` round path — `src/components/common/UnifiedQuizGame.tsx` (already implemented)
```ts
// config interface (:38-78)
round?: RoundConfig            // present → bounded round + RoundResultScreen
gameId?: string                // e.g. 'ordleg.read'
// correct tap (:279): celebrateTier('micro'); incrementScore()
// wrong tap (:283-284): firstAttemptRef.current = false; sfx.play('wrong')
// advance/finish (:298-312):
//   if (!round.enabled) generateNewQuestion()
//   else { const r = round.completeQuestion(firstAttemptRef.current)
//          if (!r.done && r.streak>0 && r.streak%3===0) celebrateTier('streak')
//          if (r.done) finishRound(r.firstTryCorrect, r.longestStreak) else generateNewQuestion() }
// finishRound (:343-351): progressStore.recordRoundResult(config.gameId ?? `quiz.${quizType}`,
//                          { correct, total: round.length, longestStreak },
//                          { starThresholds: config.round?.starThresholds, stickerSetId: config.round?.stickerSetId })
// render (:393-399): roundOutcome ? <RoundResultScreen outcome categoryId={theme.id} backRoute onReplay/> : (…)
```
Læs Ordet needs **nothing** in the engine — the two config fields are enough.

### Hand-rolled round template — `src/components/math/ComparisonGame.tsx` (copy this exactly)
```ts
// imports (:7,:14-16): RoundResultScreen; useRound; progressStore + RoundOutcome; sfx
// state (:87-89):
const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })
const firstAttemptRef = useRef(true)
const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)
// useCelebration (:94): { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration }
// finishRound (:204-211):
const finishRound = (firstTryCorrect: number, longestStreak: number) => {
  const outcome = progressStore.recordRoundResult('math.comparison',
    { correct: firstTryCorrect, total: round.length, longestStreak },
    { starThresholds: { three: 0, two: 2 } })
  setRoundOutcome(outcome)
}
// handleReplay (:213-219): stopCelebration(); setRoundOutcome(null); round.reset(); resetScore(); generateNewProblem()
// correct branch (:246-270): incrementScore(); celebrateTier('micro'); …then after result audio:
//   const r = round.completeQuestion(firstAttemptRef.current)
//   if (!r.done && r.streak>0 && r.streak%3===0) celebrateTier('streak')
//   if (r.done) finishRound(r.firstTryCorrect, r.longestStreak) else generateNewProblem()
// wrong branch (:271-276): firstAttemptRef.current = false; sfx.play('wrong'); (retry)
// generateNewProblem (:184): firstAttemptRef.current = true   (reset per question)
// GameShell celebration prop (:364): { show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }
// render (:366-373): roundOutcome ? <RoundResultScreen outcome categoryId="math" backRoute="/math" onReplay={handleReplay}/> : currentProblem ? (…) : null
```

### `useRound` — `src/hooks/useRound.ts`
```ts
useRound(config?: { length: number; starThresholds?: { three: number; two: number }; stickerSetId?: string })
  => { enabled, length, state, completeQuestion(firstTry: boolean) => RoundState, reset() }
// RoundState: { index, firstTryCorrect, streak, longestStreak, done }
// completeQuestion returns the new state SYNCHRONOUSLY → branch on r.done / r.streak immediately.
```

### `progressStore.recordRoundResult` / `RoundOutcome` — `src/services/progressStore.ts`
```ts
recordRoundResult(gameId: string,
  input: { correct: number; total: number; longestStreak: number },
  options?: { starThresholds?: { three: number; two: number }; stickerSetId?: string }): RoundOutcome
// RoundOutcome { stars, anyNewBest, newBests{streak,stars,count}, previousBests, longestStreak,
//                stickers: StickerAward[], pageCompleted, totals } — fed straight to RoundResultScreen.
```

### `RoundResultScreen` — `src/components/common/RoundResultScreen.tsx`
```tsx
<RoundResultScreen outcome={RoundOutcome} categoryId="ordleg" backRoute="/ordleg" onReplay={() => void} />
// Renders INSIDE GameShell's body (replace the game grid). Plays its own confetti + SFX + one spoken
// Danish summary. "Spil igen" calls onReplay; "Se bog" → /album; "Tilbage" → backRoute.
```

### `celebrateTier` tiers — `src/components/common/CelebrationEffect.tsx`
```ts
const { celebrateTier, celebrationDuration, showCelebration, celebrationIntensity, stopCelebration } = useCelebration()
celebrateTier('micro' | 'streak' | 'round' | 'best' | 'sticker' | 'page')  // sets confetti + fires the tier's SFX
// micro→'correct', streak→'streak-up', round→'round-complete', best→'star', sticker→'sticker-reveal', page→'page-complete'
// Do NOT also sfx.play() those cues. The ONLY manual cue added in this PRD is sfx.play('wrong') in Stav Ordet.
```

### Stav Ordet — current shape to extend (`src/components/ordleg/SpellingGame.tsx`)
- `useGameState()` (`:102`) — add `resetScore` to the destructure.
- `useCelebration()` (`:108`) — add `celebrateTier` + `celebrationDuration`.
- `generateNewWord` (`:198-228`) — add `firstAttemptRef.current = true`, `slotWrongRef.current = 0`,
  `setHintTileId(null)` among the resets (`:208-215`).
- `handleTileClick` wrong branch (`:266-271`) — add `firstAttemptRef.current = false;
  sfx.play('wrong')`, bump `slotWrongRef`, and set `hintTileId` after the 2nd wrong tap.
- `handleTileClick` correct branch (`:250-265`) — reset `slotWrongRef.current = 0; setHintTileId(null)`.
- `completeWord` (`:274-294`) — swap `celebrate()` → `celebrateTier('micro')`; replace the bare
  `generateNewWord()` (`:291`) with the `round.completeQuestion(...)` branch.
- Tile render (`:417-472`) — pulse/glow when `tile.id === hintTileId` (reduced-motion aware via
  `useReducedMotion()`).
- `GameShell` (`:311-325`) — add `duration: celebrationDuration` to the `celebration` prop; wrap the
  body in `roundOutcome ? <RoundResultScreen/> : (…)`.

### Sig et Ord — current shape to extend (`src/components/ordleg/SpeakWordGame.tsx`)
- `useCelebration()` (`:37`) — add `celebrateTier` + `celebrationDuration`.
- Add `useGameState()` + `useRound(...)` + `firstTryRef` + `roundOutcome` state.
- `handleResult` STT-fail branch (`:158-169`) — set `firstTryRef.current = false`, stay on the same
  question (the existing `setPhase('idle')` is fine; do **not** advance the round).
- `handleResult` recognized branch (`:171-180`) — `incrementScore()`; after `runSpellingSequence`,
  replace `setPhase('idle')` (`:180`) with the `round.completeQuestion(...)` branch
  (`finishRound` or fresh question).
- `runSpellingSequence` (`:208`) — swap `celebrate()` → `celebrateTier('micro')`.
- `GameShell` (`:222-229`) — add `score={<OrdlegScoreChip … />}` and `duration: celebrationDuration`
  to the `celebration` prop; render `<RoundResultScreen/>` in place of the mic UI when `roundOutcome`
  is set (inside the `supported` branch; leave the `!supported` fallback at `:241-258` alone).
- Keep `useSpeechInput`, hold-to-talk gesture, MIN/MAX press guards, `audio.stopAll()` before capture,
  and the magic-mic visuals untouched.

### Theme + welcome strings (no changes needed)
- `categoryThemes.ordleg` content at `src/config/categoryThemes.ts:180-206` (3 games; **no title
  changes**). Accent via `categoryThemes.ordleg.accentColor` / `getCategoryTheme('ordleg')`.
- Welcome strings already present in `GAME_WELCOME_MESSAGES` (`SimplifiedAudioController.ts`):
  `laesordet` (`:361`), `spelling` (`:351`), `micword` (`:360`).
- `OrdlegScoreChip` / `OrdlegRepeatButton` exist in `src/components/common/ScoreChip.tsx` /
  `RepeatButton.tsx` (teal variant).

### Layout / rules
- No-scroll full-viewport, `gridAutoRows: minmax(0,1fr)`, landscape overrides, ≥44px targets,
  `clamp()` typography — see `.claude/rules/responsive-design.md` and the existing Ordleg layouts.
  Comic Sans for child-facing text; Danish only. Audio rules: one TTS at a time (no queue); SFX is the
  separate `sfx` channel — never route SFX through `SimplifiedAudioController`.
