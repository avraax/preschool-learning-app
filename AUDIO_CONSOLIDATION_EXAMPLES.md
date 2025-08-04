# Audio Consolidation Code Examples & Patterns

## Pattern 1: Entry Audio Consolidation

### Before (Duplicated in 5+ games)
```typescript
// AlphabetGame.tsx
const [entryAudioComplete, setEntryAudioComplete] = useState(false)

useEffect(() => {
  entryAudioManager.onComplete('alphabet', () => {
    setEntryAudioComplete(true)
    setTimeout(() => generateNewQuestion(), 500)
  })
  return () => entryAudioManager.cleanup('alphabet')
}, [])

// MathGame.tsx (Same pattern)
const [entryAudioComplete, setEntryAudioComplete] = useState(false)

useEffect(() => {
  entryAudioManager.onComplete('counting', () => {
    setEntryAudioComplete(true)
    setTimeout(() => generateNewProblem(), 500)
  })
  return () => entryAudioManager.cleanup('counting')
}, [])
```

### After (Centralized in AudioController)
```typescript
// AudioController.ts - New method
async playGameEntryWithSetup(
  gameType: GameType,
  setupCallback: () => void,
  delay: number = 500
): Promise<void> {
  // Play entry audio
  await this.playGameEntry(gameType)
  
  // Handle setup with delay
  return new Promise((resolve) => {
    setTimeout(() => {
      setupCallback()
      resolve()
    }, delay)
  })
}

// Usage in components (1 line instead of 10)
useGameAudioSetup('alphabet', generateNewQuestion)
```

### New Hook for Components
```typescript
// hooks/useGameAudioSetup.ts
export function useGameAudioSetup(
  gameType: GameType,
  setupCallback: () => void,
  delay?: number
) {
  const audio = useAudio({ componentId: gameType })
  const [ready, setReady] = useState(false)
  
  useEffect(() => {
    audio.playGameEntryWithSetup(gameType, () => {
      setupCallback()
      setReady(true)
    }, delay)
  }, [])
  
  return { ready, isPlaying: audio.isPlaying }
}
```

## Pattern 2: Unified Repeat Button

### Before (3 separate components)
```typescript
// MathRepeatButton.tsx
export const MathRepeatButton = ({ onClick, disabled, label }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    sx={{
      backgroundColor: '#9c27b0',
      color: 'white',
      '&:hover': { backgroundColor: '#7b1fa2' }
    }}
  >
    {label || "🎵 Hør igen"}
  </Button>
)

// AlphabetRepeatButton.tsx (similar with blue theme)
// ColorRepeatButton.tsx (similar with orange theme)
```

### After (Single configurable component)
```typescript
// AudioRepeatButton.tsx
interface AudioRepeatButtonProps {
  onClick: () => void
  disabled?: boolean
  theme?: 'math' | 'alphabet' | 'color' | 'default'
  label?: string
  size?: 'small' | 'medium' | 'large'
}

const themeColors = {
  math: { bg: '#9c27b0', hover: '#7b1fa2' },
  alphabet: { bg: '#2196f3', hover: '#1976d2' },
  color: { bg: '#ff9800', hover: '#f57c00' },
  default: { bg: '#4caf50', hover: '#388e3c' }
}

export const AudioRepeatButton: React.FC<AudioRepeatButtonProps> = ({
  onClick,
  disabled = false,
  theme = 'default',
  label,
  size = 'medium'
}) => {
  const audio = useAudio({ componentId: 'RepeatButton' })
  const colors = themeColors[theme]
  
  const handleClick = async () => {
    if (!disabled && !audio.isPlaying) {
      await onClick()
    }
  }
  
  return (
    <Button
      onClick={handleClick}
      disabled={disabled || audio.isPlaying}
      size={size}
      sx={{
        backgroundColor: colors.bg,
        color: 'white',
        '&:hover': { backgroundColor: colors.hover },
        '&:disabled': { opacity: 0.5 }
      }}
    >
      {label || "🎵 Hør igen"}
    </Button>
  )
}
```

## Pattern 3: Context-Aware Number Speaking

### Before (Various patterns)
```typescript
// AdditionGame.tsx
await audio.speak(`Hvad er ${num1} plus ${num2}?`)
await audio.speakNumber(answer)

// ComparisonGame.tsx
await audio.speak(`Er ${num1} større end ${num2}?`)

// NumberLearning.tsx
await audio.speak(`Dette er tallet ${number}`)
```

### After (Centralized context system)
```typescript
// AudioController.ts - New methods
async speakMathProblem(
  type: 'addition' | 'subtraction' | 'comparison',
  num1: number,
  num2?: number
): Promise<string> {
  const phrases = {
    addition: `Hvad er ${num1} plus ${num2}?`,
    subtraction: `Hvad er ${num1} minus ${num2}?`,
    comparison: `Er ${num1} større end ${num2}?`
  }
  
  return this.queueAudio(async () => {
    await this.speak(phrases[type])
  })
}

async speakNumberInContext(
  number: number,
  context: 'answer' | 'counting' | 'learning' | 'result'
): Promise<string> {
  const phrases = {
    answer: `Svaret er ${number}`,
    counting: `${number}`,
    learning: `Dette er tallet ${number}`,
    result: `Du fik ${number} rigtige!`
  }
  
  return this.speakNumber(number, { 
    prefix: context !== 'counting' ? phrases[context].split(number.toString())[0] : '',
    suffix: context !== 'counting' ? phrases[context].split(number.toString())[1] : ''
  })
}
```

## Pattern 4: Unified Game Result Handler

### Before (Each game has custom logic)
```typescript
// AlphabetGame.tsx
if (selectedLetter === currentLetter) {
  setScore(score + 1)
  await audio.announceGameResult(true)
  setShowSuccess(true)
  setTimeout(() => {
    setShowSuccess(false)
    generateNewQuestion()
  }, 2000)
} else {
  await audio.announceGameResult(false)
  setShowError(true)
  setTimeout(() => setShowError(false), 1000)
}

// Similar patterns in MathGame, MemoryGame, etc.
```

### After (Centralized handler)
```typescript
// AudioController.ts
interface GameResultOptions {
  success: boolean
  gameType: GameType
  score?: number
  showVisualFeedback?: boolean
  autoAdvance?: boolean
  advanceDelay?: number
  onComplete?: () => void
}

async handleGameResult(options: GameResultOptions): Promise<void> {
  const {
    success,
    gameType,
    score,
    showVisualFeedback = true,
    autoAdvance = true,
    advanceDelay = success ? 2000 : 1000,
    onComplete
  } = options
  
  // Play appropriate audio
  await this.announceGameResult(success, gameType)
  
  // Handle visual feedback if requested
  if (showVisualFeedback) {
    this.emit('visualFeedback', { success, duration: advanceDelay })
  }
  
  // Handle auto-advance
  if (autoAdvance && success) {
    setTimeout(() => {
      onComplete?.()
      this.emit('advanceGame')
    }, advanceDelay)
  }
}

// Usage in components
await audio.handleGameResult({
  success: selectedLetter === currentLetter,
  gameType: 'alphabet',
  score: score + 1,
  onComplete: generateNewQuestion
})
```

## Pattern 5: Audio State Hook

### Before (Local state tracking)
```typescript
// Various components
const [isPlaying, setIsPlaying] = useState(false)
const [audioQueue, setAudioQueue] = useState([])

const playAudio = async () => {
  setIsPlaying(true)
  await audio.speak('Text')
  setIsPlaying(false)
}
```

### After (Centralized state access)
```typescript
// hooks/useAudioState.ts
export function useAudioState() {
  const audioContext = useAudioContext()
  const [queueInfo, setQueueInfo] = useState({
    length: 0,
    currentType: null,
    nextType: null
  })
  
  useEffect(() => {
    const updateQueue = () => {
      const controller = audioContext.audioController
      setQueueInfo({
        length: controller.getQueueLength(),
        currentType: controller.getCurrentAudioType(),
        nextType: controller.getNextAudioType()
      })
    }
    
    // Subscribe to queue changes
    audioContext.on('queueUpdate', updateQueue)
    return () => audioContext.off('queueUpdate', updateQueue)
  }, [])
  
  return {
    isPlaying: audioContext.isPlaying,
    queueLength: queueInfo.length,
    currentAudioType: queueInfo.currentType,
    isQueueEmpty: queueInfo.length === 0,
    hasPermission: audioContext.hasPermission
  }
}

// Usage
const { isPlaying, queueLength, hasPermission } = useAudioState()
```

## Pattern 6: Batch Audio Operations

### Before (Sequential awaits)
```typescript
// Common pattern in games
await audio.speak('Godt gået!')
await audio.speak('Du fik alle rigtige!')
await audio.playSuccessSound()
await audio.speak('Skal vi prøve igen?')
```

### After (Batch operation)
```typescript
// AudioController.ts
async playSequence(
  items: Array<{
    type: 'speak' | 'sound' | 'number'
    content: string | number
    delay?: number
  }>
): Promise<void> {
  for (const item of items) {
    switch (item.type) {
      case 'speak':
        await this.speak(item.content as string)
        break
      case 'sound':
        await this.playSound(item.content as string)
        break
      case 'number':
        await this.speakNumber(item.content as number)
        break
    }
    
    if (item.delay) {
      await this.delay(item.delay)
    }
  }
}

// Usage
await audio.playSequence([
  { type: 'speak', content: 'Godt gået!' },
  { type: 'speak', content: 'Du fik alle rigtige!' },
  { type: 'sound', content: 'success' },
  { type: 'speak', content: 'Skal vi prøve igen?', delay: 500 }
])
```

## Pattern 7: Smart Preloading

### Before (No preloading)
```typescript
// Audio loaded on-demand causing delays
await audio.speak('Long Danish phrase that needs synthesis')
```

### After (Intelligent preloading)
```typescript
// AudioController.ts
private preloadQueue = new Set<string>()

async preloadGameAudio(gameType: GameType): Promise<void> {
  const phrases = this.getCommonPhrasesForGame(gameType)
  
  // Preload in background without blocking
  phrases.forEach(phrase => {
    if (!this.cache.has(phrase)) {
      this.preloadQueue.add(phrase)
    }
  })
  
  // Process preload queue when idle
  this.processPreloadQueue()
}

private async processPreloadQueue(): Promise<void> {
  if (this.isPlaying || this.preloadQueue.size === 0) return
  
  const phrase = this.preloadQueue.values().next().value
  this.preloadQueue.delete(phrase)
  
  try {
    await this.googleTTS.synthesizeAndCache(phrase)
  } catch (error) {
    // Silent fail for preloading
  }
  
  // Continue processing
  setTimeout(() => this.processPreloadQueue(), 100)
}
```

## Migration Guide for Agent

### Step 1: Identify Pattern
```bash
# Search for pattern across codebase
grep -r "entryAudioManager.onComplete" --include="*.tsx"
```

### Step 2: Create Centralized Version
Add new method to AudioController with tests

### Step 3: Create Migration Script
```typescript
// Quick migration for common patterns
const migrateEntryAudio = (fileContent: string): string => {
  return fileContent.replace(
    /const \[entryAudioComplete, setEntryAudioComplete\] = useState\(false\)[\s\S]*?entryAudioManager\.onComplete\([^)]+\)/g,
    'const { ready } = useGameAudioSetup(gameType, setupCallback)'
  )
}
```

### Step 4: Update Components
Systematically update each component with new pattern

### Step 5: Verify & Test
- Run all games
- Test on iOS Safari
- Verify audio queue behavior
- Check TypeScript types

These examples provide concrete patterns for the audio-centralization-expert agent to follow when consolidating code.