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

**Task-based** (quiz/problem): the child is asked something and taps an answer.
Examples: AlphabetGame, MathGame, MathOperationGame, ComparisonGame, HvadManglerGame, MemoryGame,
the three English quizzes, LaesOrdetGame, SpellingGame.

**Learning-based** (exploration): the child freely browses and taps to hear.
Examples: AlphabetLearning, NumberLearning, EnglishLearning, FarvejagtGame, RamFarvenGame.
- Direct audio on tap, no entry coordination needed.

## Prefer UnifiedQuizGame for new quizzes

Most task-based quizzes are a thin **config** over `src/components/common/UnifiedQuizGame.tsx`
(see AlphabetGame, MathGame, the English games, LaesOrdetGame, HvadManglerGame). Provide
`generateQuizItem`, `generateOptions`, the theme/score-chip/repeat-button, a `gameWelcomeType`,
and the three audio callbacks (`speakQuizPrompt`, `speakClickedItem`, `getRepeatAudio`). Only
hand-roll a full component for genuinely novel mechanics (e.g. SpellingGame, SpeakWordGame).

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
