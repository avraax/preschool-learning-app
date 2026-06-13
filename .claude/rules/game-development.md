---
paths:
  - "src/components/alphabet/*.tsx"
  - "src/components/math/*.tsx"
  - "src/components/farver/*.tsx"
  - "src/components/learning/*.tsx"
---

# Game Development Rules

## Two Game Types

**Task-based** (quiz/problem): AlphabetGame, MathGame, AdditionGame, ComparisonGame, MemoryGame
- Use `entryAudioManager.onComplete()` for entry audio coordination
- Show full UI immediately with conditional content rendering

**Learning-based** (exploration): AlphabetLearning, NumberLearning, FarvejagtGame, RamFarvenGame
- Direct audio interaction with immediate feedback
- No entry audio coordination needed

## Required Pattern for Task-Based Games

Follow the exact pattern from AlphabetGame/MathGame:

```typescript
const [entryAudioComplete, setEntryAudioComplete] = useState(false)

useEffect(() => {
  entryAudioManager.onComplete('gameType', () => {
    setEntryAudioComplete(true)
    setTimeout(() => generateNewProblem(), 500)
  })
}, [])

// Show full UI immediately - NO loading overlays
return (
  <Box>
    <AppBar>{/* Always visible */}</AppBar>
    <Container>
      <Button disabled={!entryAudioComplete}>Gentag</Button>
      {options.length > 0 ? options.map(...) : null}
    </Container>
  </Box>
)
```

## Strict Rules

1. **MUST** show full UI immediately - never use loading overlays or "Lytter..." screens
2. **MUST** use direct `entryAudioManager.onComplete()` callback registration
3. **MUST** use appropriate `RepeatButton` variant from `src/components/common/RepeatButton.tsx`
4. **MUST** disable repeat button until `entryAudioComplete` is true
5. **MUST** use conditional content rendering: `{content.length > 0 ? ... : null}`
6. **MUST NOT** create loading screens or intermediate states
7. **MUST NOT** use `useTaskBasedGame` hook - use direct pattern instead

## RepeatButton Variants

From `src/components/common/RepeatButton.tsx`:
- `MathRepeatButton` - Purple theme
- `AlphabetRepeatButton` - Blue theme
- `ColorRepeatButton` - Orange theme

## Audio in Games

Always use `useAudio()` hook. See `audio-system.md` rule for details.

## Theming

Use centralized themes from `src/config/categoryThemes.ts`:
```typescript
import { getCategoryTheme } from '../config/categoryThemes'
const theme = getCategoryTheme('alphabet') // or 'math', 'farver'
```
