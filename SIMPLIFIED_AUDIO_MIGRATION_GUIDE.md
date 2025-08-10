# Simplified Audio System Migration Guide

## Overview
This guide provides step-by-step instructions for migrating games from the legacy audio system to the new simplified, iOS-optimized audio system.

## Key Differences

### Legacy System (Remove)
- Complex queue management
- 5-state permission tracking
- Multiple AudioContext instances
- Session-based permission modal
- Direct audioManager imports

### Simplified System (Adopt)
- Single audio at a time (no queue)
- 3-boolean state management
- Single reused AudioContext
- On-demand permission handling
- React hook-based interface

## Migration Steps

### Step 1: Update Imports

**Remove:**
```typescript
import { useAudio } from '../../hooks/useAudio'
import { audioManager } from '../../utils/audio'
import { entryAudioManager } from '../../utils/entryAudioManager'
```

**Replace with:**
```typescript
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
```

### Step 2: Initialize Audio Hook

**Remove:**
```typescript
const audio = useAudio({ componentId: 'GameName' })
```

**Replace with:**
```typescript
const audio = useSimplifiedAudioHook({ 
  componentId: 'GameName',
  autoInitialize: false // Set to true for auto-init on mount
})
```

### Step 3: Update Audio Calls

#### Speaking Text
**Before:**
```typescript
await audio.speak('Text to speak')
```

**After:**
```typescript
await audio.speak('Text to speak')  // Same API, different implementation
```

#### Cancelling Audio
**Before:**
```typescript
// Various patterns used
audio.cancelAllAudio()
audioManager.cancelCurrentAudio()
```

**After:**
```typescript
audio.cancelCurrentAudio()  // Unified method
```

#### Game Welcome
**Before:**
```typescript
await audio.playEntryAudio('alphabet')
```

**After:**
```typescript
await audio.playGameWelcome('alphabet')
```

### Step 4: Remove Entry Audio Manager

**Remove all references to:**
```typescript
entryAudioManager.onComplete('gameType', callback)
```

**Replace with direct game logic:**
```typescript
useEffect(() => {
  const playWelcomeAndStart = async () => {
    await audio.playGameWelcome('gameType')
    // Start game logic here
    generateNewQuestion()
  }
  
  if (audio.isAudioReady) {
    playWelcomeAndStart()
  }
}, [audio.isAudioReady])
```

### Step 5: Update Permission Handling

**Remove:**
- Component-level permission state management
- Manual permission prompts
- Complex permission checking

**Add (if needed):**
```typescript
// Simple permission UI for iOS
{!audio.isAudioReady && audio.needsUserAction && (
  <Button onClick={() => audio.initializeAudio()}>
    Aktivér Lyd
  </Button>
)}
```

### Step 6: Handle User Interactions

**Add before audio plays (especially on iOS):**
```typescript
const handleUserAction = async () => {
  audio.updateUserInteraction()  // Update timestamp
  audio.cancelCurrentAudio()      // Cancel any playing audio
  await audio.speak('New audio')  // Play new audio
}
```

### Step 7: Clean Up Navigation

**Remove:**
```typescript
// Complex navigation cleanup patterns
```

**Add:**
```typescript
// In navigation handlers
const handleBack = () => {
  audio.cancelCurrentAudio()
  navigate('/path')
}
```

## Common Patterns

### Quiz Game Pattern
```typescript
const QuizGame = () => {
  const audio = useSimplifiedAudioHook({ 
    componentId: 'QuizGame',
    autoInitialize: false
  })
  
  const [gameReady, setGameReady] = useState(false)
  
  useEffect(() => {
    if (audio.isAudioReady) {
      playWelcomeAndStart()
    }
  }, [audio.isAudioReady])
  
  const playWelcomeAndStart = async () => {
    await audio.playGameWelcome('quiz')
    setGameReady(true)
    generateNewQuestion()
  }
  
  const handleAnswerClick = async (answer: string) => {
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    
    if (isCorrect(answer)) {
      await audio.announceGameResult(true)
      generateNewQuestion()
    } else {
      await audio.announceGameResult(false)
    }
  }
  
  const repeatQuestion = async () => {
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    await audio.speakQuizPromptWithRepeat(questionText, keyword)
  }
  
  return (
    <Box>
      {/* Game UI */}
      <RepeatButton 
        onClick={repeatQuestion}
        disabled={!gameReady || audio.isPlaying}
      />
    </Box>
  )
}
```

### Learning Game Pattern
```typescript
const LearningGame = () => {
  const audio = useSimplifiedAudioHook({ 
    componentId: 'LearningGame',
    autoInitialize: true  // Auto-init for exploration games
  })
  
  const handleItemClick = async (item: string) => {
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    await audio.speak(item)
  }
  
  return (
    <Grid>
      {items.map(item => (
        <Card 
          key={item}
          onClick={() => handleItemClick(item)}
        />
      ))}
    </Grid>
  )
}
```

## Testing Checklist

After migration, verify:

- [ ] Audio plays on first user interaction
- [ ] iOS Safari compatibility (test on real device)
- [ ] Audio cancellation when clicking rapidly
- [ ] Navigation properly cancels audio
- [ ] Score narration works (Danish numbers)
- [ ] No console errors in production
- [ ] Permission prompt appears when needed (iOS)
- [ ] Audio continues working after navigation

## Files to Update

Priority games to migrate (currently using old system):
1. `AlphabetGame.tsx` - Main alphabet quiz
2. `AlphabetLearning.tsx` - Letter exploration
3. `MathGame.tsx` - Counting game
4. `NumberLearning.tsx` - Number exploration
5. `AdditionGame.tsx` - Addition practice
6. `ComparisonGame.tsx` - Number comparison
7. `FarvejagtGame.tsx` - Color hunt
8. `RamFarvenGame.tsx` - Color mixing
9. `MemoryGame.tsx` - Memory cards
10. Demo games (11 files in `/demo/games/`)

## Important Notes

1. **No Loading Overlays**: Show full UI immediately, use disabled states
2. **Always Cancel Audio**: Cancel current audio before playing new audio
3. **Update User Interaction**: Call `updateUserInteraction()` on user actions
4. **iOS Compatibility**: Test thoroughly on iOS Safari
5. **Error Handling**: Errors are logged but don't break functionality

## Support

For questions about the migration, refer to:
- `AlphabetGameSimplified.tsx` - Reference implementation
- `SimplifiedAudioController.ts` - Core audio logic
- `useSimplifiedAudio.ts` - Hook interface