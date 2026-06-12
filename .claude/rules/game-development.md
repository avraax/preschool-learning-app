---
description: Game component implementation patterns and rules
globs: src/components/**
---

# Game Development Rules

## Critical: No Loading Overlays

Show full UI immediately. Never display loading screens or "Lytter..." overlays.

## Required Pattern (follows AlphabetGame/MathGame)

### 1. Direct Callback Registration

```typescript
const [entryAudioComplete, setEntryAudioComplete] = useState(false)

useEffect(() => {
  entryAudioManager.onComplete('gameType', () => {
    setEntryAudioComplete(true)
    setTimeout(() => generateNewProblem(), 500)
  })
}, [])
```

### 2. Full UI Always Visible

```typescript
return (
  <Box>
    <AppBar>{/* Always visible */}</AppBar>
    <Container>
      <Typography>Game Title</Typography>
      <Button disabled={!entryAudioComplete}>Gentag</Button>
      {options.length > 0 ? options.map(...) : null}
    </Container>
  </Box>
)
```

### 3. Use RepeatButton Variants

```typescript
import { MathRepeatButton, AlphabetRepeatButton, ColorRepeatButton } from '../common/RepeatButton'

<MathRepeatButton onClick={repeatProblem} disabled={!entryAudioComplete || isPlaying} label="Hor igen" />
```

## Checklist for New Task-Based Games

- [ ] Show full UI immediately — no loading overlays
- [ ] Use `entryAudioManager.onComplete()` for entry audio coordination
- [ ] Use appropriate RepeatButton variant
- [ ] Disable repeat button until `entryAudioComplete`
- [ ] Conditional content: `{content.length > 0 ? ... : null}`
- [ ] Use `useSimplifiedAudio()` for all audio
- [ ] Follow AlphabetGame/MathGame patterns exactly
