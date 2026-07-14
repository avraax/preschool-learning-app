---
paths:
  - "src/utils/SimplifiedAudioController.ts"
  - "src/contexts/SimplifiedAudioContext.tsx"
  - "src/hooks/useSimplifiedAudio.ts"
  - "src/hooks/useSpeechInput.ts"
  - "src/services/ttsClient.ts"
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

Stack: Azure AI Speech (single TTS provider) -> Web Speech API (fallback) -> Howler.js (sound effects).
TTS goes through `src/services/ttsClient.ts` (the playback engine) and the `/api/tts-azure` endpoint.
The Engelsk section uses the Azure `en-US-AvaMultilingualNeural` voice via `speakEnglish()` (voiceType `'english'`). Danish
pronunciation fixes live in the hosted PLS lexicon (`public/da-DK.pls`). The shared Azure synthesis
core (`shared-azure-tts.js`) is used by both the dev server and the Vercel function so they can't drift.

**Key behaviour: there is NO audio queue.** Only one audio plays at a time; starting new audio
immediately cancels whatever is playing (`playAudio()` calls `stopCurrentAudio()` first). This is
intentional for fast tapping on iOS. `ttsClient` also carries a **"last request wins" epoch token** —
a slow synth/fetch bails instead of pre-empting a later tap; don't reintroduce play-on-stale-resolve.

## Prebaked TTS

The narrated inventory is a large but CLOSED set, so it's synthesized once at the **default
voice/rate** into `public/sounds/tts/*.ogg` with a committed manifest (`src/config/prebakedTts.ts`).
`ttsClient.synthesizeAndPlay` plays the prebaked file directly **before** touching Azure; Azure now
serves only genuinely dynamic text or a non-default VoiceLab voice.

- **After changing any narrated closed-set content** (letter words, phrases, sticker labels, English
  words, numbers, colours), run `npm run tts:prebake` and **commit** the regenerated `.ogg` files +
  `prebakedTts.ts`. It fails soft — a missing key just falls back to live Azure (slower), never breaks.
- The manifest cache key **must** match between `ttsClient.resolveRequest` and the build script; both
  build it via `shared-tts-key.js` (single source — don't hand-roll the key format).
- Build scripts (`prebake-tts.mjs`, `tts-voice-eval.mjs`) `import` `src/**/*.ts` directly (Node ≥22
  strips types) — generate from the real source arrays, never a hand-copied duplicate.

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
    await audio.speakEnglish('dog')  // en-US Ava (multilingual)
  }
}
```

## Adding New Audio Functions

1. Add a method to `SimplifiedAudioController` that wraps work in `this.playAudio(...)`:

```typescript
async speakNewThing(text: string): Promise<string> {
  return this.playAudio(async () => {
    this.updateUserInteraction()
    if (!(await this.ensureAudioReady())) return   // async: awaits init so the first tap isn't dropped
    await this.ttsClient.synthesizeAndPlay(text, 'primary', true)
  })
}
```

2. Expose it: add it to the `SimplifiedAudioHook` interface **and** to the module-level
   `STABLE_AUDIO_METHODS` object in `useSimplifiedAudio.ts` (bound once). The hook returns a
   `useMemo`'d object whose identity only changes when a reactive field changes — do **not** add
   per-render `.bind()`s to the returned object or rely on the hook's identity changing.
3. Use it in components via the hook.

## Game Audio Entry Pattern

Task-based games play a welcome (`audio.playGameWelcome(<type>)`) then start after a short iOS-tuned
delay, gating interaction on a `gameReady` flag. Welcome strings live in `GAME_WELCOME_MESSAGES` inside
`SimplifiedAudioController.playGameWelcome` — add an entry there for a new game's `gameWelcomeType`.

## Navigation Cleanup & Permission

Audio cancels automatically on navigation via `NavigationAudioCleanup` in `App.tsx` and the controller's
own listeners. Permission is session-based and automatic; `SimplifiedAudioPermission` handles the iOS
prompt. iOS suspension recovery: if the AudioContext later suspends or playback hits a
`NotAllowedError`, the engine calls back into the provider (`markNeedsUserAction`) to re-prompt.

iOS robustness gotchas (PRD-06), easy to regress:
- The unlock gesture must prime **`ttsClient`'s shared `<audio>` element** (`primePlaybackElement()`),
  not just the probe `AudioContext` — narration plays through that element, so it's the one iOS needs
  user-activated, or the first post-fetch `play()` throws `NotAllowedError`.
- Match `'interrupted'` (iOS calls/Siri/backgrounding) alongside `'suspended'` everywhere recovery is
  armed — WebKit uses `'interrupted'`, which is outside the TS `AudioContextState` union.
- `visibilitychange:hidden` cancels TTS so the stall timer is disarmed; otherwise a backgrounded PWA
  re-speaks the clip (in the Web Speech voice) on return.
- `ensureAudioReady` is **async** and awaits `initializeAudio()`, so the first tap after load/suspension
  isn't silently swallowed.

## Speech INPUT (separate from playback)

`Sig et Ord` captures audio via `src/hooks/useSpeechInput.ts` (MediaRecorder -> `/api/stt`, Google STT v2).
This is the *capture* side and sits beside the controller. It must NOT record while TTS is playing — call
`audio.stopAll()` before starting capture.

`start()` guards against a mid-flight unmount with a **generation counter** (`genRef`):
`cancel()`/`stopAndRecognize()` bump it, and `start()` re-checks after each `await`, stopping the
granted tracks if it went stale — so the OS mic never lingers when the child taps mic then navigates
away (`SpeakWordGame`'s unmount calls `speech.cancel()`). `extractFirstWord` drops any `*`-masked
(profanity-filtered) STT token so it's never read back / spelled aloud. See the STT server side
(`features.profanityFilter`) in `.claude/rules/api-endpoints.md`.
