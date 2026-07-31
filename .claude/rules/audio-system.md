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
Because Ava is *multilingual*, she code-switches accent on words that exist in other languages (e.g.
"banana" reads Spanish-ish) — it can sound like a different speaker but it's the same voice, working
as intended (PRD-11 owner ruling: keep en-US Ava, don't chase per-word accent).

**Key behaviour: there is NO audio queue.** Only one audio plays at a time; starting new audio
immediately cancels whatever is playing (`playAudio()` calls `stopCurrentAudio()` first). This is
intentional for fast tapping on iOS. `ttsClient` also carries a **"last request wins" epoch token** —
a slow synth/fetch bails instead of pre-empting a later tap; don't reintroduce play-on-stale-resolve.

## Prebaked TTS

The narrated inventory is a large but CLOSED set, so it's synthesized once at the **default
voice/rate** into `public/sounds/tts/*.mp3` with a committed manifest (`src/config/prebakedTts.ts`).
`ttsClient.synthesizeAndPlay` plays the prebaked file directly **before** touching Azure; Azure now
serves only genuinely dynamic text or a non-default VoiceLab voice.

- **Every audio file the app ships is MP3 — never Ogg/Opus.** Apple added Ogg *container* support only
  in iOS/iPadOS **18.4**, so Ogg clips are undecodable on an older iPad (an iPad Pro 2nd gen caps at
  17.7) and the whole app goes silent except the mp3 music bed — narration, SFX, everything. Three
  things must agree and are asserted by `src/services/audioFormat.test.ts`: `TTS_CONFIG.outputFormat`
  (`audio-24khz-48kbitrate-mono-mp3`), `TTS_CONFIG.mime` (`audio/mpeg`, the data-URL label) and
  `TTS_CONFIG.fileExt` (the prebaked extension). SFX pass Howler an explicit `format: ['mp3']` —
  Howler probes a `.ogg` URL against `codecs="vorbis"`, which Opus-in-Ogg never matched. Re-encode
  curated cues with `node scripts/transcode-sfx.mjs` (ffmpeg-static devDependency).
- **After changing any narrated closed-set content** (letter words, phrases, sticker labels, English
  words, numbers, colours), run `npm run tts:prebake` and **commit** the regenerated `.mp3` files +
  `prebakedTts.ts`. It fails soft — a missing key just falls back to live Azure (slower), never breaks.
- **A NEW spoken-phrase TEMPLATE must be added to `shared-narration-clips.js`** — the enumerator bakes
  only what its loops emit from the source arrays, so the app *speaking* a new pattern (e.g. W3's
  `"{ord} starter med {bogstav}"`) does NOT make it a prebaked/closed-set clip until you add the loop;
  otherwise it silently falls back to live Azure and is never auditioned. Don't trust "already ships" —
  the memory game's `"{bogstav} som {ord}"` lines were never actually prebaked until PRD-14 added them.
- **`tts:prebake` regenerates the manifest and PRUNES orphaned clips**, so a prebake commit can show
  audio DELETIONS unrelated to your change = pre-existing content drift (content edited since the last
  prebake) being synced. Expected, not a bug — confirm the pruned keys are genuinely gone from current
  content (`grep` the phrase) and commit the deletions as part of the prebake output.
- **Then audition it** (PRD-11): the closed set is enumerated once in `shared-narration-clips.js`
  (shared by prebake + the dev-only `/audit` harness). `npm run audit:check` flags any clip not signed
  off in `docs/audit/narration-audit.json` (the audited-OK manifest), so new content surfaces as
  UNAUDITED — listen in `/audit`, mark OK, commit. Letter names live in `DANISH_LETTER_NAMES`
  (glyph-first: bare glyph for most, `X:'eks'`/`Z:'zæt'`; number 1 stays `'en'`, not `'et'`).
- The manifest cache key **must** match between `ttsClient.resolveRequest` and the build script; both
  build it via `shared-tts-key.js` (single source — don't hand-roll the key format).
- Build scripts (`prebake-tts.mjs`, `tts-voice-eval.mjs`) + the shared enumerator
  `shared-narration-clips.js` `import` `src/**/*.ts` directly (Node ≥22 strips types) — generate from
  the real source arrays, never a hand-copied duplicate. **Relative imports anywhere in that
  transitive graph need an explicit `.ts` extension** (e.g. `'../utils/shuffle.ts'`): Node's ESM
  resolver rejects extensionless imports even though Vite/tsc accept them, so a build script silently
  breaks on a source file the app imports fine. `allowImportingTsExtensions` makes the extension safe
  in Vite/tsc too.

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
prompt. iOS suspension recovery is **silent**: a later suspend/`interrupted` or a `NotAllowedError`
still calls `markNeedsUserAction`, but the big permission modal is **never auto-re-shown** once audio
has unlocked once OR the user closed it (`hasUnlockedRef`/`userDismissedRef`; the show decision is the
pure `shouldShowAudioPrompt()` in `src/contexts/audioPromptPolicy.ts`) — the next real interaction
re-unlocks via the document-wide listeners. Both the ✕ AND the "Start lyd nu" button hard-dismiss
(dismiss must not depend on the async unlock result). Re-arming the modal on every transient iOS
suspend was the "modal won't close / button does nothing" bug.

iOS robustness gotchas (PRD-06), easy to regress:
- **iOS consumes the transient user-activation across an `await`.** Everything that needs the gesture —
  `resume()`, `primePlaybackElement()`, `speechSynthesis.speak()` — must run **synchronously before the
  first `await`** in the unlock path: kick `resume()` (don't await it), prime + speak in-gesture, THEN
  await resume only to verify. Priming *after* `await resume()` silently failed → **no sound at all**.
- The unlock gesture must prime **`ttsClient`'s shared `<audio>` element** (`primePlaybackElement()`),
  not just the probe `AudioContext` — narration plays through that element, so it's the one iOS needs
  user-activated, or the first post-fetch `play()` throws `NotAllowedError`.
- Howler 2.2.4's iOS `_cleanBuffer` crash (`undefined is not an object (evaluating '…bufferSource')`,
  from its internal `_ended` timer on a torn-down node) is patched once at load in
  `src/services/howlerGuard.ts` — keep it; upstream is unfixed.
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
