# Overhaul PRD — Math (`-02-`)

**Date:** 2026-06-15
**Part of:** Game Experience Overhaul (see `plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md`).
**Depends on:** Foundation PRD (`plans/games-overhaul/tmp-prd-overhaul-01-foundation.md`) — **already
implemented** (progress store, `useRound`, `RoundResultScreen`, `StickerReveal`, `sfxClient`,
celebration tiers; the alphabet quiz is the wired reference).

> **Self-containment:** this PRD is written so a fresh implement session can build it with near-zero
> re-exploration. Verbatim current signatures + exact `file:line` integration points are in
> **Appendix A**. Read this whole file plus the Foundation PRD before coding.

---

## Context

Math is the richest learning surface and where the son is most actively progressing. He is ~5,
counts to 60–70, **adds to 20 on his fingers**, does basic subtraction, knows all letters. The
recurring gaps the overhaul inventory found in Math:

- **Flat, endless rounds** with one-size confetti and no memory between sessions.
- **Random distractors** — a correct tap can be a lucky guess rather than a real discrimination.
- **Sammenlign Tal is genuinely confusing**: it randomly asks "largest? / smallest? / equal?" and
  makes you pick among `>` `<` `=` tiles — three things vary at once.
- **Lære Tal is a passive poster** — tap a number, hear it; no goal.

**Success looks like:** he plays a bounded round, finishes on a reward screen that shows stars +
whether he beat his best + a new sticker, and his album/bests survive across sessions — all at or
above today's immersive themed polish.

**Static difficulty only** (standing constraint): no adaptive difficulty, no in-game level pickers.
Tuning = editing the constants named in this PRD in a later session.

### Scope

Six Math surfaces. **Memory** (`/learning/memory/numbers`) is **out of scope** here — it is the
shared engine handled in `-07-`.

| Game | Route | Component | Type |
|---|---|---|---|
| Tal Quiz | `/math/counting` | `MathGame.tsx` | `UnifiedQuizGame` config |
| Lær Tal | `/math/numbers` | `NumberLearning.tsx` | hand-rolled browse |
| Plus Opgaver | `/math/addition` | `MathOperationGame.tsx` (`operation='addition'`) | hand-rolled |
| Minus Opgaver | `/math/subtraction` | `MathOperationGame.tsx` (`operation='subtraction'`) | hand-rolled |
| Sammenlign Tal | `/math/comparison` | `ComparisonGame.tsx` | hand-rolled |
| Hvad Mangler? | `/math/patterns` | `HvadManglerGame.tsx` | `UnifiedQuizGame` config |

---

## Current state (with concrete weaknesses)

- **`MathGame.tsx`** (Tal Quiz) — thin `UnifiedQuizGame` config. `MAX_NUMBER = 50`. Distractors are
  **purely random** in `generateOptions` (`MathGame.tsx:28-44`) — no targeting of real confusions.
  No `round`/`gameId` → endless, no reward screen.
- **`MathOperationGame.tsx`** (Plus/Minus) — hand-rolled. Addition: `firstNum` 1–10, `secondNum`
  chosen so sum ≤20 (`:134-137`); Subtraction: result 0–9 (`:139-143`). **Distractors random**
  (`:150-158`). Uses legacy `celebrate()` + `playCelebrationWithStandardTiming` (`:206-229`), no
  rounds, no SFX.
- **`ComparisonGame.tsx`** — hand-rolled, **confusing**: numbers 1–20, 25% forced-equal (`:154-165`),
  random `questionType` of `largest`/`smallest`/`equal` (`:182-191`), child picks among `>` `<` `=`
  tiles (`:480-498`), with a long wrong-answer explanation path (`:298-356`). Three independent
  things vary per question. No rounds/SFX.
- **`NumberLearning.tsx`** (Lær Tal) — learning-based 1–100 browse via `LearningGrid`
  (`:200-206`); taps speak the number. **No goal, no reward.**
- **`HvadManglerGame.tsx`** — `UnifiedQuizGame` config mixing count-by-1, skip-2/5/10, and abstract
  visual `ABAB` emoji patterns (`:42-88`). Distractors already near-number/pool (`:90-114`). No
  `round`/`gameId`.

---

## Target experience

Bounded rounds + the Foundation reward flow on every game, near-number distractors, and a clarified
Sammenlign mechanic. Per game:

### 1. Tal Quiz — `MathGame.tsx`

**Before:** endless; random distractors.
**After:**
- Bounded round: `round: { length: 8, starThresholds: { three: 0, two: 2 } }`, `gameId: 'math.counting'`.
- **Near-number distractors** (replace `generateOptions`): build 3 wrong options from
  `[swapDigits(n), n−1, n+1, n−10, n+10]`, keep those in `1..50`, dedupe against `n` and each other,
  shuffle, take 3. Fall back to random-in-range only if fewer than 3 valid confusables exist
  (small/large edge numbers).
- Range stays **1–50**.

### 2. Plus Opgaver / Minus Opgaver — `MathOperationGame.tsx`

**Before:** endless; legacy celebration; random distractors.
**After (both operations, hand-rolled wiring of Foundation):**
- Bounded round via `useRound({ length: 8, starThresholds: { three: 0, two: 2 } })`;
  `gameId = isAddition ? 'math.addition' : 'math.subtraction'`. On round end render
  `RoundResultScreen` **in place of** the equation+answers (inside `GameShell`), exactly like the
  engine does (Appendix A shows the engine's pattern).
- **First-attempt tracking:** a `firstAttemptRef` per problem; a wrong tile sets it false (and fires
  `sfx.play('wrong')`), so a wrong-then-right does not extend the streak. On the correct tap, call
  `round.completeQuestion(firstAttemptRef.current)`; fire `celebrateTier('streak')` on every 3rd
  first-try; if `done` → `progressStore.recordRoundResult(gameId, { correct, total, longestStreak }, …)`
  → set `roundOutcome`; else generate the next problem.
- **Juice:** replace `celebrate()` (`:208`) with `celebrateTier('micro')`; keep the spoken result.
  Keep the resilient start + the corner-guide reaction.
- **Near-answer distractors** (replace `:150-158`): build wrong options from
  `[answer−1, answer+1, answer−2, answer+2]` clamped to the valid result range (addition 1–20,
  subtraction 0–10), dedupe, shuffle, take 3.
- **Ranges unchanged:** addition operands 1–10 with sum ≤20; subtraction result 0–9.

### 3. Sammenlign Tal — `ComparisonGame.tsx` (largest rework)

**Before:** 25% equal; random largest/smallest/equal question; pick among `>` `<` `=`.
**After — one consistent rule, the hungry-mouth metaphor:**
- Generate **two different** numbers `1..20` (no equality). Show each side as the existing emoji
  quantity rows (keep `OBJECT_TYPES` + `getEmojiFontSize`) and the numeral.
- **Question is always:** spoken + shown **"Tryk på det største tal."** The child **taps the bigger
  number's side** (the side becomes the answer target — reuse `AnswerTile` state on each side, or a
  tap target around each number).
- On a correct tap, an animated **krokodille `>`/`<` mouth** between the two sides **opens toward the
  chosen (bigger) number** ("the mouth eats the bigger one"), reinforcing the symbol. `>` if left is
  bigger, `<` if right is bigger. Use `SymbolTile`/an emoji 🐊 + Framer spring; reduced-motion →
  static symbol.
- **Removed:** the equality case, the `largest`/`smallest`/`equal` variance, and the long
  wrong-answer `explanation` path (`:298-356`). Wrong tap → gentle `sfx.play('wrong')` + the mouth
  does **not** open; he can retry (first-attempt flag breaks).
- Wire `useRound(8)` + `RoundResultScreen` + `progressStore` (`gameId: 'math.comparison'`) + tiers/SFX
  exactly as Plus/Minus.

### 4. Lær Tal — `NumberLearning.tsx` (browse + challenge)

**Before:** passive 1–100 poster.
**After:**
- **Keep** the calm browse (the `LearningGrid` + the big current-number card) exactly as today.
- **"Find tallet" challenge:** a button in the header toggles a bounded round. In challenge mode,
  audio says **"Find tallet N"** (reuse `DANISH_PHRASES.gamePrompts.findNumber`), the child taps that
  number on the grid; correct → `celebrateTier('micro')` + advance, wrong → `sfx.play('wrong')` +
  first-attempt breaks. Use `useRound({ length: 8 })`, `gameId: 'math.numbers'`,
  `RoundResultScreen` on completion, then return to browse.
- **Exploration stickers (session-local):** maintain an in-component `Set<number>` of distinct
  numbers tapped in browse; when its size crosses each new multiple of **12**, call
  `progressStore.awardSticker()` and show a `StickerReveal` + `celebrateTier('sticker')`. (No new
  persisted schema — this is intentionally lightweight; bests/stickers themselves persist via the
  store as usual.)

### 5. Hvad Mangler? — `HvadManglerGame.tsx`

**Before:** all three modes, no rounds.
**After:**
- **Keep all three modes** (count-1, skip-2/5/10, visual `ABAB`/`ABCABC`). Add
  `round: { length: 8, starThresholds: { three: 0, two: 2 } }`, `gameId: 'math.patterns'`.
- Keep the existing near-number/pool distractor logic (`:90-114`) — it's already good.

---

## Foundation hooks (how each game plugs in)

| Game | gameId | round | star thresholds | sticker set | tiers fired | SFX |
|---|---|---|---|---|---|---|
| Tal Quiz | `math.counting` | length 8 | 3★=0, 2★≤2 mistakes | global pool | micro, streak, (round/best/sticker/page in result) | tap, correct, wrong + result cues |
| Plus | `math.addition` | length 8 | 3★=0, 2★≤2 | global | micro, streak | tap, correct, wrong + result cues |
| Minus | `math.subtraction` | length 8 | 3★=0, 2★≤2 | global | micro, streak | tap, correct, wrong + result cues |
| Sammenlign | `math.comparison` | length 8 | 3★=0, 2★≤2 | global | micro, streak | tap, correct, wrong + result cues |
| Lær Tal (challenge) | `math.numbers` | length 8 | 3★=0, 2★≤2 | global | micro; sticker on browse-milestone | tap, correct, wrong + result cues |
| Hvad Mangler? | `math.patterns` | length 8 | 3★=0, 2★≤2 | global | micro, streak | tap, correct, wrong + result cues |

- **Sticker pool = global** for all six (pass no `stickerSetId`). `recordRoundResult` already awards 1
  round sticker + a bonus on any new best, and detects page-complete — nothing extra to do.
- **`celebrateTier`** comes from `useCelebration()` (Appendix A); it sets confetti intensity/duration
  **and** fires the tier's SFX, so don't also call `sfx.play` for those cues.
- `RoundResultScreen` owns the round/best/sticker/page beats, the star "tings", and the single
  spoken Danish summary — games just hand it the `RoundOutcome`.

---

## Learning design

- **Comparison gets one clear rule.** "Tap the bigger; the mouth eats it" removes the triple-variance
  that made the old game incoherent, while still teaching `>`/`<`.
- **Near-number distractors** target the actual confusions (digit order, off-by-one/ten) so a correct
  answer means something.
- **Static difficulty** honoured: all ranges/thresholds are constants (named below), tuned by hand
  later. No adaptivity, no level picker.
- **No punishment:** wrong answers never end a round or scold (gentle `wrong` SFX only); they only
  break the question's first-try flag (stars/streak). Always ≥1 star.

---

## Visual/asset spec

- **Krokodille mouth (Sammenlign):** a `>`/`<` built from `SymbolTile` or a 🐊 glyph that springs open
  toward the bigger side; static fallback under reduced-motion.
- **`RoundResultScreen` / `StickerReveal`** are reused as-is (already at the quality bar).
- **No new raster art required.** Everything is CSS/emoji/Framer. (Flag later only if we want a
  custom-illustrated crocodile — not needed for v1.)
- Everything meets Principle 0: theme-token colours only, correct on all 6 skins incl. dark immersive
  scenes, `clamp()` sizing, no-scroll, reduced-motion aware.

---

## Data & content (concrete, complete)

- **Tal Quiz range:** `MAX_NUMBER = 50` (unchanged). **Near-number distractor pool** for target `n`:
  `swapDigits(n)` (e.g. 23→32; skip if palindromic/single-digit), `n−1`, `n+1`, `n−10`, `n+10`; filter
  to `1..50`, exclude `n`, dedupe, shuffle, take 3; top up with random `1..50` only if short.
- **Plus:** `num1 ∈ 1..10`; `num2 ∈ 1..min(20−num1,10)`; `answer = num1+num2` (≤20). **Distractors:**
  from `{answer−1, answer+1, answer−2, answer+2}` clamped `1..20`, dedupe vs answer, take 3 (top up
  random `1..20`).
- **Minus:** `num1 ∈ 1..10`; `num2 ∈ 1..num1`; `answer = num1−num2` (0..9). **Distractors:** from
  `{answer−1, answer+1, answer+2, num1, num2}` clamped `0..10`, dedupe vs answer, take 3 (top up
  random `0..10`).
- **Sammenlign:** two distinct `1..20`; keep `OBJECT_TYPES`, `DANISH_NUMBERS`, `getEmojiFontSize`
  (Appendix A lists them). Question always "Tryk på det største tal."
- **Lær Tal:** `numbers = 1..100` (unchanged). Challenge picks a random `numbers[i]`; speaks
  `DANISH_PHRASES.gamePrompts.findNumber(n)`. Milestone every **12** distinct taps.
- **Hvad Mangler:** keep the existing generators verbatim (`buildNumberSequence`, `buildVisualPattern`,
  the `r`-thresholded mode mix at `:47-79`, and `generateOptions`).
- **Round length 8, thresholds 3★=0 / 2★≤2** for all six.

---

## Files to touch

**Modified**
- `src/components/math/MathGame.tsx` — round + gameId, near-number distractors.
- `src/components/math/MathOperationGame.tsx` — `useRound`/`RoundResultScreen`/`progressStore`/tiers/SFX,
  first-attempt tracking, near-answer distractors.
- `src/components/math/ComparisonGame.tsx` — new tap-the-bigger mechanic + krokodille, drop equality
  & explanation path, wire rounds/result/tiers/SFX.
- `src/components/math/NumberLearning.tsx` — "Find tallet" challenge (round/result),
  session-local exploration-milestone stickers.
- `src/components/math/HvadManglerGame.tsx` — round + gameId.
- `CLAUDE.md` — document the `math.*` gameIds under the progress/overhaul notes.

**No new files.**

**Reuse (do not reinvent)** — `useRound` (`src/hooks/useRound.ts`), `progressStore` +
`RoundOutcome`/`recordRoundResult`/`awardSticker` (`src/services/progressStore.ts`),
`RoundResultScreen` + `StickerReveal` (`src/components/common/`), `sfx`/`SfxCue`
(`src/services/sfxClient.ts`), `useCelebration().celebrateTier` (`src/components/common/CelebrationEffect.tsx`),
`AnswerTile` + `SymbolTile`, `GameShell`, `LearningGrid`, `getCategoryTheme`/`categoryThemes.math`,
`DANISH_PHRASES.gamePrompts`, `useGameState`, `isIOS`, the resilient welcome-start pattern already in
each hand-rolled game.

---

## Verification (end-to-end, iPad-sized viewport)

Run both dev servers in **Windows PowerShell** (`npm run dev` + `npm run dev:api` — never WSL; see
project memory). Then:

1. **Rounds:** each of `/math/counting`, `/math/addition`, `/math/subtraction`, `/math/comparison`,
   `/math/patterns` ends after **8** questions → `RoundResultScreen` (stars for 0 / 2 / 3 mistakes),
   replay + "Se bog" + "Tilbage" work.
2. **Sammenlign:** always "tap the bigger"; tapping the bigger opens the krokodille `>`/`<` toward it;
   no equality appears; wrong tap = gentle SFX + retry.
3. **Lær Tal:** browse still calm + speaks numbers; "Find tallet" runs an 8-question round → result;
   ~every 12 distinct taps pops a sticker.
4. **Persistence & best:** beat a streak/stars/count → "Ny rekord!" old→new; reload → album + stars +
   bests survive; private window → no crash.
5. **SFX/juice:** `tap` on tiles, `correct`/`wrong`, `streak-up` every 3rd first-try, the
   result-screen star/round/sticker cues; mute (`progressStore.settings.sfxEnabled`) silences SFX but
   not TTS.
6. **Quality floor:** every surface renders correctly and at-or-above current polish in **all 6
   themes**, portrait + landscape, **no scroll**; reduced-motion degrades gracefully.
7. `npm run build` and `npm run lint` clean. Use the `ui-screenshot` skill to confirm layouts + zero
   console errors.

---

## Open questions resolved this session

- Plus & Minus **stay separate**.
- Hvad Mangler? **keeps all three modes**.
- Tal Quiz = **near-number distractors**, range **1–50** kept.
- Sammenlign = **hungry-mouth (krokodille)**, **tap the bigger**, **equality dropped**.
- Lær Tal = **browse + "Find tallet" challenge**, exploration stickers **session-local**.
- Round length = **8**; star thresholds **3★=0 / 2★≤2**; sticker pool **global**.

---

## Appendix A — Embedded implementation reference

Verbatim contracts of the code this PRD extends, cited from the repo at write time (2026-06-15).

### `UnifiedQuizGame` — `src/components/common/UnifiedQuizGame.tsx`
The config interface (already round-aware from the Foundation):
```ts
export interface QuizItem {
  value: string | number
  display: string | number
  audioPrompt: string
  repeatWord: string
  questionVisual?: { emoji: string; word?: string }
}
export interface UnifiedQuizConfig {
  quizType: 'alphabet' | 'counting' | 'arithmetic' | 'english' | 'ordleg'
  generateQuizItem: () => QuizItem
  generateOptions: (correctAnswer: QuizItem) => QuizItem[]
  title: string; emoji: string
  teacherCharacter: 'owl' | 'fox'
  theme: CategoryTheme; backRoute: string
  ScoreChipComponent: React.ComponentType<any>
  RepeatButtonComponent: React.ComponentType<any>
  showRepeat?: boolean
  gameWelcomeType: string
  speakQuizPrompt: (item: QuizItem, audio: any) => Promise<string>
  speakClickedItem: (item: QuizItem, audio: any) => Promise<string>
  getRepeatAudio: (item: QuizItem, audio: any) => Promise<string>
  round?: RoundConfig            // Foundation §3 — present → bounded round + RoundResultScreen
  gameId?: string                // stable progress id, e.g. 'math.counting'
}
```
- **Round path already implemented** (mirror it for hand-rolled games): correct-answer handler
  `handleItemClick` (`:239-315`); the advance/finish block is **`:285-304`**:
```ts
setTimeout(() => {
  if (!isCorrect) return
  stopCelebration()
  if (!round.enabled) { generateNewQuestion(); return }
  const r = round.completeQuestion(firstAttemptRef.current)
  if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
  if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
  else generateNewQuestion()
}, isIOS() ? 1500 : 2000)
```
- `finishRound` (`:334-342`) calls `progressStore.recordRoundResult` and `setRoundOutcome`; replay
  `handleReplay` (`:345-351`) resets round+score and regenerates. `firstAttemptRef` reset in
  `generateNewQuestion` (`:129`); broken on a wrong tap (`:274`) with `sfx.play('wrong')`.
- Result render: `roundOutcome ? <RoundResultScreen outcome categoryId={config.theme.id}
  backRoute={config.backRoute} onReplay={handleReplay}/> : (…grid…)`.

### `useRound` — `src/hooks/useRound.ts`
```ts
export interface RoundConfig { length: number; starThresholds?: { three: number; two: number }; stickerSetId?: string }
export interface RoundState { index: number; firstTryCorrect: number; streak: number; longestStreak: number; done: boolean }
export interface UseRound {
  enabled: boolean
  length: number
  state: RoundState
  completeQuestion: (firstTry: boolean) => RoundState   // returns fresh state synchronously
  reset: () => void
}
export const useRound: (config?: RoundConfig) => UseRound
```

### `progressStore` — `src/services/progressStore.ts`
```ts
progressStore.recordRoundResult(
  gameId: string,
  input: { correct: number; total: number; longestStreak: number },
  options?: { starThresholds?: { three: number; two: number }; stickerSetId?: string },
): RoundOutcome
progressStore.awardSticker(setId?: string): StickerAward       // single award (exploration milestones)
progressStore.getGame(gameId: string): PerGameStats
progressStore.setSetting(key, value); progressStore.resetAll(); progressStore.get()

interface RoundOutcome {
  gameId: string; correct: number; total: number; mistakes: number
  stars: number /* 1–3, always ≥1 */; longestStreak: number
  previousBests: { streak: number; stars: number; count: number }
  newBests: { streak: boolean; stars: boolean; count: boolean }; anyNewBest: boolean
  stickers: StickerAward[]; pageCompleted: { id: string; title: string; emoji: string } | null
  totals: { totalStars: number; totalStickers: number }
}
```
- `recordRoundResult` computes stars from MISTAKES (`total−correct`), updates bests, awards 1 round
  sticker + a bonus on any new best, and detects page-complete. Default thresholds 3★=0 / 2★≤2.

### Celebration tiers — `src/components/common/CelebrationEffect.tsx`
```ts
useCelebration() => {
  showCelebration: boolean
  celebrationIntensity: 'low'|'medium'|'high'
  celebrationDuration: number
  celebrate(intensity?: 'low'|'medium'|'high'): void   // legacy
  celebrateTier(tier: 'micro'|'streak'|'round'|'best'|'sticker'|'page'): void  // sets confetti + fires SFX
  stopCelebration(): void
}
// <CelebrationEffect show intensity duration onComplete .../>
// GameShell receives celebration={{ show, intensity, duration, onComplete }}.
```
`celebrateTier` already fires the tier's SFX (`micro→correct`, `streak→streak-up`, …) — don't double-play.

### SFX — `src/services/sfxClient.ts`
```ts
import { sfx } from '../../services/sfxClient'
sfx.play('tap' | 'correct' | 'wrong' | 'drop-snap' | 'flip' | 'streak-up' | 'star'
         | 'sticker-reveal' | 'round-complete' | 'page-complete', { rate?, volume? })
sfx.preload(); sfx.setEnabled(bool); sfx.isEnabled(); sfx.stopAll()
```
Mute respects `progressStore.settings.sfxEnabled`. Missing file → silent. Never route through
`SimplifiedAudioController`.

### Audio hook — `src/hooks/useSimplifiedAudio.ts` (methods Math uses)
```ts
const audio = useSimplifiedAudioHook({ componentId, autoInitialize: false })
audio.isAudioReady; audio.updateUserInteraction(); audio.cancelCurrentAudio()
audio.playGameWelcome(gameType)            // existing welcome strings: 'math','addition','subtraction','comparison','patterns','numberlearning'
audio.speakNumber(n, customSpeed?)         // Lær Tal uses 1.2
audio.speakAdditionProblem(a, b, 'primary'); audio.speakSubtractionProblem(a, b, 'primary')
audio.speakQuizPromptWithRepeat(text, repeatWord); audio.speak(text); audio.announceGameResult(isCorrect)
audio.announcePosition(currentIndex, total, 'tal')
// Sammenlign now only needs a single "biggest" prompt — reuse audio.speak('Tryk på det største tal').
```

### `AnswerTile` — `src/components/common/AnswerTile.tsx`
```tsx
<AnswerTile onClick accent={hex} state={'idle'|'correct'|'wrong'} disabled?>{children}</AnswerTile>
```
Depth language used across surfaces: 3px accent border, `darken(accent,0.3)` 3D lip, layered ambient
shadow (`dark` deepens it), top-light surface gradient, `:active` sink, reduced-motion-aware. Helpers
`darken`, `hexToRgba` live in `src/theme/tokens/helpers.ts`.

### `MathOperationGame.tsx` — hand-roll integration points
- Operation prop: `{ operation: 'addition' | 'subtraction' }`; `isAddition`, `operator`.
- State: `num1,num2,correctAnswer,options,feedback,guideReaction`; `useGameState()` →
  `{ score, incrementScore, isScoreNarrating, handleScoreClick }`; `useCelebration()` →
  `{ showCelebration, celebrationIntensity, celebrate, stopCelebration }` (**switch to
  `celebrationDuration` + `celebrateTier`**).
- Problem gen `generateNewProblem` (`:123-171`); distractor loop **`:150-158`** (replace).
- Correct/feedback handler `handleAnswerClick` (`:186-230`); legacy advance via
  `playCelebrationWithStandardTiming({ nextAction: generateNewProblem })` (**`:211-229`** — replace
  with the round path from the engine snippet above; track `firstAttemptRef`).
- Render: `GameShell` (`:256-264`) with `celebration={{ show, intensity, onComplete }}` (add
  `duration: celebrationDuration`); equation block (`:267-324`); answers grid (`:326-386`). Put
  `RoundResultScreen` in place of equation+answers when `roundOutcome` is set.

### `ComparisonGame.tsx` — current pieces to reuse / replace
- `OBJECT_TYPES` (`:19-28`), `DANISH_NUMBERS` (`:30-33`), `getEmojiFontSize` (`:36-40`) — **keep**.
- `ComparisonProblem` interface (`:42-49`), `generateNewProblem` (`:149-220`) — **rewrite** (two
  distinct 1–20, no equality, no questionType variance).
- `handleSymbolClick` (`:244-367`) incl. the `explanation` path (`:298-356`) — **replace** with
  tap-the-bigger + krokodille; wire round/result.
- Symbol-tile picker (`:480-498`) — **replace** with side tap targets + the animated mouth.
- `GameShell` (`:385-393`) + the two-side `Paper`/`Grid` (`:395-561`) — keep the layout shell, adapt
  the middle column to the krokodille.

### Theme + phrases
- `categoryThemes.math` content at `src/config/categoryThemes.ts:71-125` (games list; **no title
  changes planned**). Accent via `categoryThemes.math.accentColor` / `getCategoryTheme('math')`.
- `DANISH_PHRASES.gamePrompts` at `src/config/danish-phrases.ts:57-`:
  `findNumber: (n) => \`Find tallet ${n}\``, `findLetter`, `mathQuestion.addition/…`.

### Layout / rules
- No-scroll full-viewport, `gridAutoRows: minmax(0,1fr)`, `@media (orientation: landscape)`
  overrides, ≥44px targets, `clamp()` typography — see `.claude/rules/responsive-design.md` and the
  existing math grids. Comic Sans for child-facing text; Danish only.

## Deferred / not in this PRD
Memory (`-07-`); custom-illustrated crocodile art (emoji/CSS for v1); persisting Lær Tal exploration
progress across sessions (kept session-local); any home-screen/parent-reset changes (Foundation).
