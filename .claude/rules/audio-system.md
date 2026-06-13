---
paths:
  - "src/utils/AudioController.ts"
  - "src/contexts/AudioContext.tsx"
  - "src/hooks/useAudio.ts"
  - "src/services/googleTTS.ts"
  - "src/components/common/GlobalAudioPermission.tsx"
  - "src/utils/entryAudioManager.ts"
  - "src/components/**/*.tsx"
---

# Centralized Audio System Rules

All audio in this app goes through a centralized 3-tier system. No exceptions.

## Architecture

```
AudioController (src/utils/AudioController.ts)  -- singleton, queue, playback
├── AudioContext (src/contexts/AudioContext.tsx)  -- React permission state
├── useAudio() (src/hooks/useAudio.ts)           -- component hook interface
├── GlobalAudioPermission                        -- session-based permission modal
└── entryAudioManager                            -- game entry audio coordination
```

Stack: Google Cloud TTS (primary) -> Web Speech API (fallback) -> Howler.js (sound effects).

## Mandatory Rules

1. **NEVER** create audio management code outside the centralized system
2. **NEVER** use Web Speech API, Howler.js, or HTML5 Audio directly in components
3. **NEVER** create component-level `isPlaying` state or audio state
4. **NEVER** bypass the AudioController queue
5. **ALWAYS** use `useAudio()` hook in components
6. **ALWAYS** add new audio functions to AudioController class
7. **ALWAYS** use the centralized queue for all playback

## Correct Pattern

```typescript
import { useAudio } from '../../hooks/useAudio'

const MyComponent = () => {
  const audio = useAudio({ componentId: 'MyComponent' })

  const handleAction = async () => {
    await audio.speak('Hej børn!')
    await audio.speakNumber(5)
    await audio.playSuccessSound()
  }
}
```

## Adding New Audio Functions

1. Add method to `AudioController` class in `src/utils/AudioController.ts`
2. Export through `useAudio` hook in `src/hooks/useAudio.ts`
3. Use in components via the hook

```typescript
// In AudioController.ts
async speakNewThing(text: string): Promise<string> {
  return this.queueAudio(async () => {
    this.updateUserInteraction()
    const hasPermission = await this.checkAudioPermission()
    if (!hasPermission) return
    await this.googleTTS.synthesizeAndPlay(text, 'primary', true)
  })
}
```

## Navigation Cleanup

Audio cancels automatically on all navigation (browser back/forward, React Router, direct URLs). Handled by NavigationAudioCleanup in App.tsx and browser event listeners in AudioController. No component changes needed.

## Permission Handling

Session-based, automatic. No manual permission checks in components. The GlobalAudioPermission modal handles everything. iOS Safari 10-second interaction timeout is handled by AudioController.

## Debugging

- Console logs prefixed with `audioController.getTTSStatus()` for queue/cache state
- Check component uses `useAudio()` hook, not direct imports
- Look for navigation cleanup logs in console
