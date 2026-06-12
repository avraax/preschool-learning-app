---
description: Audio development rules for the centralized SimplifiedAudioController system
globs: src/**
---

# Audio System Rules

## Mandatory: Use SimplifiedAudioController

All audio in this app flows through a centralized system. The current architecture:

```
SimplifiedAudioController (src/utils/SimplifiedAudioController.ts)
├── SimplifiedAudioContext (src/contexts/SimplifiedAudioContext.tsx)
├── useSimplifiedAudio() hook (src/hooks/useSimplifiedAudio.ts)
├── SimplifiedAudioPermission (src/components/common/SimplifiedAudioPermission.tsx)
└── entryAudioManager (src/utils/entryAudioManager.ts)
```

## NEVER Do

- Create audio management code outside `SimplifiedAudioController`
- Use Web Speech API, Howler.js, or HTML5 Audio directly in components
- Create component-level audio state (`useState` for `isPlaying`, etc.)
- Import `audioManager` or old `AudioController` — these are deprecated
- Use `useAudio()` — use `useSimplifiedAudio()` instead

## ALWAYS Do

- Use `useSimplifiedAudio()` hook in components
- Add new audio functions to `SimplifiedAudioController` class
- Let the controller handle permissions, queueing, and cleanup automatically

## Component Usage Pattern

```typescript
import { useSimplifiedAudio } from '../../hooks/useSimplifiedAudio'

const MyComponent = () => {
  const audio = useSimplifiedAudio()

  const handleAction = async () => {
    await audio.speak('Hej børn!')
    await audio.speakNumber(5)
    await audio.playSuccessSound()
  }

  return <button onClick={handleAction}>Play</button>
}
```

## Adding New Audio Functions

1. Add method to `SimplifiedAudioController` class in `src/utils/SimplifiedAudioController.ts`
2. Export through `useSimplifiedAudio` hook in `src/hooks/useSimplifiedAudio.ts`
3. Use in components via the hook

## Audio Tech Stack

- **Primary**: Google Cloud TTS (Danish Wavenet voices via `/api/tts`)
- **Fallback**: Web Speech API (browser-native Danish)
- **Sound Effects**: Howler.js (managed through controller only)
