---
paths:
  - "src/utils/SimplifiedAudioController.ts"
  - "src/contexts/SimplifiedAudioContext.tsx"
  - "src/hooks/useSimplifiedAudio.ts"
  - "src/hooks/useSpeechInput.ts"
  - "src/services/googleTTS.ts"
  - "src/components/common/SimplifiedAudioPermission.tsx"
  - "src/components/**/*.tsx"
---

# Centralized Audio System Rules

All audio in this app goes through one centralized system. No exceptions.

## Architecture

```
SimplifiedAudioController (src/utils/SimplifiedAudioController.ts)  -- singleton, single-audio playback (NO queue)
├── SimplifiedAudioContext (src/contexts/SimplifiedAudioContext.tsx)  -- React permission + readiness state
├── useSimplifiedAudioHook() (src/hooks/useSimplifiedAudio.ts)        -- component hook interface
└── SimplifiedAudioPermission (src/components/common/SimplifiedAudioPermission.tsx)  -- session permission modal (iOS)
```

Stack: Google Cloud TTS (primary) -> Web Speech API (fallback) -> Howler.js (sound effects).
TTS goes through `src/services/googleTTS.ts` and the `/api/tts` endpoint. The Engelsk section
uses a British `en-GB` voice via `speakEnglish()` (voiceType `'english'` in googleTTS).

**Key behaviour: there is NO audio queue.** Only one audio plays at a time; starting new audio
immediately cancels whatever is playing (`playAudio()` calls `stopCurrentAudio()` first). This is
intentional for fast tapping on iOS.

## Mandatory Rules

1. **NEVER** create audio management code outside this system
2. **NEVER** use Web Speech API, Howler.js, or HTML5 Audio directly in components
3. **NEVER** create component-level `isPlaying`/audio state (read it from the hook if needed)
4. **ALWAYS** use the `useSimplifiedAudioHook()` hook in components
5. **ALWAYS** add new audio capabilities as methods on `SimplifiedAudioController`, exposed through the hook

## Correct Pattern

```typescript
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

const MyComponent = () => {
  const audio = useSimplifiedAudioHook({ componentId: 'MyComponent', autoInitialize: false })

  const handleAction = async () => {
    audio.updateUserInteraction()   // iOS: refresh interaction timestamp before playback
    await audio.speak('Hej børn!')
    await audio.speakNumber(5)
    await audio.speakEnglish('dog')  // en-GB
  }
}
```

## Adding New Audio Functions

1. Add a method to `SimplifiedAudioController` that wraps work in `this.playAudio(...)`:

```typescript
async speakNewThing(text: string): Promise<string> {
  return this.playAudio(async () => {
    this.updateUserInteraction()
    if (!this.ensureAudioReady()) return
    await this.googleTTS.synthesizeAndPlay(text, 'primary', true)
  })
}
```

2. Expose it through `useSimplifiedAudio` (add to the `SimplifiedAudioHook` interface and bind it in the returned object).
3. Use it in components via the hook.

## Game Audio Entry Pattern

Task-based games play a welcome (`audio.playGameWelcome(<type>)`) then start after a short iOS-tuned
delay, gating interaction on a `gameReady` flag. Welcome strings live in `GAME_WELCOME_MESSAGES` inside
`SimplifiedAudioController.playGameWelcome` — add an entry there for a new game's `gameWelcomeType`.

## Navigation Cleanup & Permission

Audio cancels automatically on navigation via `NavigationAudioCleanup` in `App.tsx` and the controller's
own listeners. Permission is session-based and automatic; `SimplifiedAudioPermission` handles the iOS
prompt. The iOS Safari interaction-timeout handling lives in `googleTTS.ts`.

## Speech INPUT (separate from playback)

`Sig et Ord` captures audio via `src/hooks/useSpeechInput.ts` (MediaRecorder -> `/api/stt`, Google STT v2).
This is the *capture* side and sits beside the controller. It must NOT record while TTS is playing — call
`audio.stopAll()` before starting capture.
