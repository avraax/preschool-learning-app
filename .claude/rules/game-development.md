---
paths:
  - "src/components/alphabet/*.tsx"
  - "src/components/math/*.tsx"
  - "src/components/farver/*.tsx"
  - "src/components/english/*.tsx"
  - "src/components/ordleg/*.tsx"
  - "src/components/learning/*.tsx"
  - "src/components/common/UnifiedQuizGame.tsx"
---

# Game Development Rules

## Two Game Types

**Task-based** (quiz/problem): the child is asked something and taps/drags an answer.
Examples: AlphabetGame, MathGame, MathOperationGame, ComparisonGame, HvadManglerGame, MemoryGame,
the three English quizzes, LaesOrdetGame, SpellingGame, and the five Farver games
(FarvejagtGame, RamFarvenGame, FarveQuizGame, NuancerGame — all bounded-round drag games).

**Learning-based** (exploration): the child freely browses and taps to hear, no scoring.
Examples: AlphabetLearning, NumberLearning, EnglishLearning, FarverLearning (Lær Farver).
- Direct audio on tap, no entry coordination needed. Earns session-local exploration-milestone
  stickers (every N distinct taps) instead of running a round.

## Prefer UnifiedQuizGame for new quizzes

Most task-based quizzes are a thin **config** over `src/components/common/UnifiedQuizGame.tsx`
(see AlphabetGame, MathGame, the three English games, LaesOrdetGame, HvadManglerGame). The config
(`UnifiedQuizConfig`) provides:

- **Content**: `generateQuizItem()`, `generateOptions(correct)` (return the shuffled tile set — use
  `shuffle()` from `src/utils/shuffle.ts`, never a biased `.sort(() => Math.random())`).
- **Chrome**: `title`, `emoji`, `theme` (a `CategoryTheme`), `ScoreChipComponent`,
  `RepeatButtonComponent`, `backRoute`, `showRepeat` (default true).
- **Audio**: `gameWelcomeType` (add the string to `GAME_WELCOME_MESSAGES` in
  `SimplifiedAudioController.playGameWelcome`) + the callbacks `speakQuizPrompt`, `speakClickedItem`,
  `getRepeatAudio`. Optional `speakCorrectFact(item)` speaks a **completed fact** on a correct tap
  INSTEAD of echoing the tapped item (single channel — replaces, never stacks; e.g. Hvad Mangler's
  finished sequence). `skipFirstPrompt` suppresses voicing the first prompt when the welcome already
  said it.
- **Bounded round + rewards** (opt-in): set `round` (a `RoundConfig`, default 8 questions,
  `starThresholds`) **and** `gameId` (stable progress id, e.g. `'alphabet.quiz'`). The engine then
  runs the round via `useRound`, ends on `RoundResultScreen`, and records to `progressStore`
  (stars/bests/stickers). Absent → legacy endless behavior. Wrong answers never punish; they only
  break the question's first-try flag.
- **Never-fail hint** (PRD-05): `hintAfterNWrong` (2 for every config quiz) pulses the correct
  `AnswerTile` after that many wrong taps (reduced-motion → static glow). The 2 wrongs already broke
  first-try, so no extra star bookkeeping.
- **Custom hero**: `renderHero(item)` renders a richer subject in the `PromptStage` instead of the
  default glyph/emoji — used today by Tal Quiz (numeral + counted objects) and Hvad Mangler (the
  sequence with a pulsing "?"). It's the intended vehicle for absorbing equation-card games
  (MathOperationGame +/−, ComparisonGame) into the engine.

Only hand-roll a full component for genuinely novel mechanics (e.g. SpellingGame, SpeakWordGame, and
the dnd-kit Farver games — see `.claude/rules/drag-and-drop.md`).

## Entry-audio pattern for hand-rolled task-based games

There is **no** `entryAudioManager` and **no** `useTaskBasedGame` hook. The real pattern is a
welcome message followed by a readiness gate:

```typescript
const audio = useSimplifiedAudioHook({ componentId: 'MyGame', autoInitialize: false })
const [gameReady, setGameReady] = useState(false)
const [audioInitialized, setAudioInitialized] = useState(false)
const hasInitialized = useRef(false)

useEffect(() => {
  if (hasInitialized.current) return
  hasInitialized.current = true
  if (audio.isAudioReady) { setAudioInitialized(true); playWelcomeAndStart() }
}, [])

useEffect(() => {                 // start once audio becomes ready (if it wasn't at mount)
  if (audio.isAudioReady && !audioInitialized && !hasInitialized.current) {
    hasInitialized.current = true; setAudioInitialized(true); playWelcomeAndStart()
  }
}, [audio.isAudioReady, audioInitialized])

const playWelcomeAndStart = async () => {
  try {
    await audio.playGameWelcome('myGameType')      // add the string to GAME_WELCOME_MESSAGES
    setTimeout(() => { setGameReady(true); generateNewProblem() }, isIOS() ? 1000 : 1500)
  } catch { setGameReady(true); generateNewProblem() }
}
```

## Strict Rules

1. **MUST** show full UI immediately — never use loading overlays or "Lytter..." screens.
2. **MUST** gate interaction/content on `gameReady` (conditional render: `{gameReady && options.length > 0 ? ... : null}`).
3. **MUST** use the right `RepeatButton` variant and disable it appropriately.
4. **MUST** call `audio.updateUserInteraction()` before audio in tap handlers (iOS), and `audio.cancelCurrentAudio()` for fast tapping.
5. **MUST NOT** create component-level audio/`isPlaying` state — use the hook (see `audio-system.md`).

## Advance-lock, timers & unmount hygiene (task-based games)

A correct answer must resolve a question **exactly once**, and nothing may fire after the child
leaves the screen. Both `UnifiedQuizGame` and the hand-rolled task games (`MathOperationGame`,
`ComparisonGame`, `SpellingGame`) follow this (drag games have the equivalent "advance-guard" — see
`drag-and-drop.md`):

- **Advance-lock**: an `isAdvancing` **ref** set synchronously on a correct tap **before any
  `await`**, checked at the very top of the tap handler, released when the next question generates.
  A `setLocked`/state flag alone is too late — a same-tick double-tap reads the stale value. This
  stops double-record (double stickers/stars on the last question) and stops a tap during the
  celebration dwell from breaking the earned first-try.
- **Track every `setTimeout`** (prompt/echo/advance) in refs and clear them in a **dedicated
  empty-dep unmount effect** — not the init effect's cleanup, which re-runs when its deps change.
- **The advance timer is scheduled AFTER the echo `await`**, so clearing timers on unmount is not
  enough: navigating away during the echo lets the post-await continuation schedule a timer that
  speaks the next prompt over the menu. Guard the continuation with a `mounted` ref checked right
  after each `await`.
- **The `mounted` ref must own its own empty-dep effect** (`true` on mount, `false` on cleanup). If
  it's cleared inside a shared init-effect cleanup that early-returns on re-run, React StrictMode's
  dev mount→cleanup→remount strands it `false` and freezes all advances.

## RepeatButton Variants

From `src/components/common/RepeatButton.tsx`:
- `AlphabetRepeatButton` — blue
- `MathRepeatButton` — purple
- `ColorRepeatButton` — orange
- `EnglishRepeatButton` — green
- `OrdlegRepeatButton` — teal

(`ScoreChip` has matching per-category variants.)

## Audio in Games

Always use the `useSimplifiedAudioHook()` hook. See `audio-system.md` for the full rules.

## Theming

Use centralized themes from `src/config/categoryThemes.ts`:
```typescript
import { getCategoryTheme } from '../../config/categoryThemes'
const theme = getCategoryTheme('alphabet') // or 'math' | 'colors' | 'english' | 'ordleg'
```
