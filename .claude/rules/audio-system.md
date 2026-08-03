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

**As of 2026-08-02 EVERY line the app speaks is prebaked**, including the composed sentences (math
questions + facts, comparison facts, sequence read-backs, colour-mix lines, quiz questions). The one
deliberate exception is Sig et Ord, which reads back whatever word the child said — genuinely
unbounded. Treat "this line hits Azure at runtime" as a bug to be fixed, not a normal state.

## PROTOCOL: adding or changing a spoken line

Follow this every time, for any new narration — a new prompt, a new fact, a reworded line, a new
game. Skipping a step doesn't fail loudly; it just leaves that line on live Azure (~1.1s of latency
per utterance, measured) and invisible to `/audit`, which is how several lines quietly ended up there.

1. **Build the string in `src/config/`, never inline in a component.** Pronunciation-sensitive
   letter↔word lines → `letterWords.ts`; every other composed sentence → `gamePhrases.ts`. The
   enumerator is a plain Node script: it can import `src/config/*.ts` and nothing else, so a string
   composed in a `.tsx` is unreachable and therefore unbakeable.
2. **If the line varies over a range, export the BOUNDS from that module too** and have the game read
   them (`ADDEND_MAX`, `MINUEND_MAX`, `COMPARE_MAX`, `SEQUENCE_LENGTH`). A range widened in a game
   against a hardcoded literal outruns the baked set silently.
3. **Enumerate it in `shared-narration-clips.js` by calling the SAME builder** — never a hand-copied
   template. Enumerating a SUPERSET is safe (an unplayed clip costs disk); a subset is not.
4. **Guard it with a test that pins the exact string** *and* asserts it's enumerated — see
   `gamePhrases.test.ts` / `letterWords.test.ts`. Pin the literal value: app and enumerator call the
   same builder, so "the two sides agree" passes vacuously when the builder itself changes.
5. **`npm run tts:prebake`** and commit the new `.mp3`s + `prebakedTts.ts` (it also prunes orphans).
6. **`npm run audit:check`** → the new lines show as UNAUDITED → listen in `/audit` and sign off (owner
   bulk path: `npm run audit:approve-all`), then commit `docs/audit/*`.
7. **Only genuinely unbounded text stays live.** If it's bounded but only known late, `warmSpeech(text)`
   it as early as the app can compose it (see `warmDynamic` below) instead of leaving it on the tap.
8. **Never `await` narration to pace anything** — not a timed sequence, not a game's advance. See the
   `DWELL_*` note in `src/theme/motion.ts` and `.claude/rules/game-development.md`.

New **SFX** cues follow the sibling rules instead: MP3 only, trimmed short (a cue plays in full — no
sprite), re-encoded with `node scripts/transcode-sfx.mjs`, into `public/sounds/ui/`, played through
`sfx`, never through `SimplifiedAudioController`.

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
  prebake) being synced. Expected, not a bug — commit the deletions as part of the prebake output.
  **But verify a prune by DIFFING the manifest, never by grepping the phrase you removed.** Clips dedupe
  by cache key, so a word is baked if ANY loop emits it — which means **a clip can be baked purely as a
  side effect of an unrelated game's content**, and deleting that game's enumerator loop silently
  un-bakes words a surviving game still speaks. Removing Dansk til Engelsk dropped the Danish-gloss loop
  and took `hvid` and `sort` with it; Ram Farven speaks those on every white/black droplet drop, and they
  had never had a loop of their own. Get the exact list, then check each entry against the surviving
  `speak()` call sites:
  ```bash
  git show HEAD:src/config/prebakedTts.ts | grep -oE '"azure\|[^"]*"' | sed 's/.*lex1|//; s/"$//' | sort > /tmp/o
  grep -oE '"azure\|[^"]*"' src/config/prebakedTts.ts | sed 's/.*lex1|//; s/"$//' | sort | comm -23 /tmp/o -
  ```
  The durable fix is the same shape every time: enumerate the words a game speaks **from that game's own
  data** (`primaryColors`/`possibleTargets` for Ram Farven), so no game's clips depend on another's.
- **The `/audit` manifest is never pruned** — `docs/audit/narration-audit.json` keeps sign-off records
  for clips that have left the closed set (102 of them today, mostly PRD-09's dropped `quizSafe:false`
  objects). `audit:check` reports clean anyway, because it only asks whether every *current* clip is
  signed off. So a stale record is not a bug and not evidence your change went wrong — don't chase them
  mid-task.
- **Editing `public/da-DK.pls` alone changes NOTHING you can hear.** The cache key records the lexicon
  as a boolean (`lex…` via `shared-tts-key.js`), not a content hash, and prebake reuses any existing
  file on disk — so a prebaked clip keeps its old pronunciation until you DELETE its mp3 + manifest
  line and re-run. Two more lexicon traps: PLS graphemes are **case-sensitive and lowercase**, so a
  capitalised content word never matches (the shipped `hund` stød entry has never applied to `"Hund"`);
  and prebake synthesizes against the **prod** lexicon URL while local dev has none (Azure can't fetch
  localhost), so a local `/voicelab` audition is not necessarily the baked clip.
- **Then audition it** (PRD-11): the closed set is enumerated once in `shared-narration-clips.js`
  (shared by prebake + the dev-only `/audit` harness). `npm run audit:check` flags any clip not signed
  off in `docs/audit/narration-audit.json` (the audited-OK manifest), so new content surfaces as
  UNAUDITED — listen in `/audit`, mark OK, commit. Letter names live in `DANISH_LETTER_NAMES`
  (glyph-first: bare glyph for most, `X:'eks'`/`Z:'zæt'`; number 1 stays `'en'`, not `'et'`).
- **Never `await` a prebaked clip to pace a timed sequence.** Azure pads every clip: measured across the
  29 letter names, ~0.22 s of silence before the name and 0.4–0.7 s after it (clip 1.25–1.73 s, name only
  0.2–0.83 s), and the shared `<audio>` element then takes another ~250 ms to start producing sound.
  Awaiting `speak*` therefore waits out padding you can't hear — it made the alphabet autoplay plod at
  2.4 s per letter. Pace on a fixed step instead and let the next clip cancel the previous tail (no
  queue = new audio cancels current), and keep the step ≥ the longest spoken part + that startup or it
  cuts names off mid-word (see `src/config/alphabetGroups.ts`). `ttsClient.prefetchPrebaked()` /
  `controller.prefetchLetters()` warm the files first; that trims the fetch, NOT the padding.
  **The same rule governs a game's correct-answer beat** — never `await` the echo/fact before
  celebrating or advancing; see `.claude/rules/game-development.md` and the `DWELL_*` note in
  `src/theme/motion.ts`.
- **Warm a dynamic line before you need it**: `controller.warmSpeech(text)` → `ttsClient.warmDynamic`
  runs the synth and caches it (in-memory + localStorage, keyed on the exact text) while playing and
  cancelling nothing. Live Azure costs ~1.1 s measured, so a sentence a screen can compose in advance
  (the math games' fact line, known when the problem is generated) should never be synthesized at the
  moment it must play. Prebaked text short-circuits — that's `prefetchPrebaked`'s job.
- **Measure a clip, never guess it**, before choosing any timing: `ffmpeg silencedetect` over the
  prebaked mp3 gives the real speech start/end inside the padding (ffmpeg-static is already a
  devDependency — `spawnSync(ffmpeg, ['-i', file, '-af', 'silencedetect=noise=-45dB:d=0.04', '-f',
  'null', '-'])`, read `stderr`). File size ÷ bitrate is NOT the spoken length.
- **A custom `speakingRate` is part of the cache key**, so a screen that speaks at a non-default rate
  needs its own baked set — and that rate must be ONE exported constant read by the component *and*
  `shared-narration-clips.js` (Lær Tal: `NUMBER_BROWSE_RATE` in `src/config/numberAutoplay.ts`). A bare
  literal in the component silently un-prebakes every clip it touches to live Azure, unauditioned.
- The manifest cache key **must** match between `ttsClient.resolveRequest` and the build script; both
  build it via `shared-tts-key.js` (single source — don't hand-roll the key format).
- Build scripts (`prebake-tts.mjs`, `tts-voice-eval.mjs`) + the shared enumerator
  `shared-narration-clips.js` `import` `src/**/*.ts` directly (Node ≥22 strips types) — generate from
  the real source arrays, never a hand-copied duplicate — this covers `/voicelab`'s sample lists
  (`voicelabData.ts`) too: its hand-typed letter-name group silently kept auditioning the respellings
  the app dropped at PRD-11. **Relative imports anywhere in that
  transitive graph need an explicit `.ts` extension** (e.g. `'../utils/shuffle.ts'`): Node's ESM
  resolver rejects extensionless imports even though Vite/tsc accept them, so a build script silently
  breaks on a source file the app imports fine. `allowImportingTsExtensions` makes the extension safe
  in Vite/tsc too.

## Pronunciation fixes (da-DK)

Azure da-DK reads a letter **differently inside a sentence than standing alone** — `DANISH_LETTER_NAMES`
governs only the standalone `speakLetter` read (and its own entries are ear-audited for that context;
don't assume they transfer). So the letter↔word narration lines are built ONLY through
`letterPhrase()` / `startsWithPhrase()` in `src/config/letterWords.ts`, which carry the per-letter
overrides — components AND `shared-narration-clips.js` call the same builders, guarded by
`letterWords.test.ts`.

- **Phrasing beats spelling.** A context-driven misread usually can't be respelled, because the token
  alone is already correct — the sentence is what demotes it (a lone Danish letter becomes a function
  word: short, unstressed, no stød). Punctuation is the lever: a comma gives the letter its own
  prosodic phrase.
- **Fixing one token can push the defect to the NEXT one.** After a phrase boundary Azure carries its
  letter-name/"characters" reading forward, so a short capitalised noun right after it gets spelled out
  as an initialism. An article or carrier noun re-anchors it as a word.
- **The oracle is the owner's ear**, auditioned in `/voicelab` in **full sentence context** — never as
  bare tokens, which is exactly the reading that isn't broken. Vary tempo too (the Tempo control), since
  "too fast / no depth" is a real defect shape for a clipped letter name.
- **Record the rejected variants** in a comment beside the fix. These strings look like typos
  (a stray comma, a "misspelled" letter, an odd article), so without the negative results someone
  tidies them away and silently regresses the pronunciation.

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

**`hidePrompt` is the ONLY thing that may close the modal, and every caller must be a `click`
handler** (the scrim, the ✕, the button — a tap anywhere on the overlay dismisses it, since with the
async close gone a scrim tap would otherwise unlock audio and leave the modal standing). This is a
**tap-through** rule, not a style one: `initializeAudio` used to set `showPrompt: false` itself, and the
provider's document-wide `touchstart` listener calls it — so its async continuation unmounted the modal
**between the tap's `touchstart` and the `click` that same tap produces**, and the browser then
hit-tested that click against the page the modal had been covering. One tap on "Start lyd nu" also
pressed the answer tile behind it (owner, 2026-08-03). A click is the LAST event of a tap and its
target is resolved before the handler runs, so closing there cannot retarget anything; closing on
`pointerdown`/`touchstart` — **or from any async work a down-event can start** — always can. The same
edit removed the catch branch's `showPrompt: isIOS()`, which both re-armed past the
`userDismissed`/`hasUnlockedOnce` guards on iOS and did this exact mid-gesture close everywhere else;
flipping `needsUserAction`/`isWorking` is enough, because the delayed effect re-consults
`shouldShowAudioPrompt`. Guarded by source-reading assertions in `audioPromptPolicy.test.ts` (they
strip comments first — the rule is explained in a comment right beside the code it protects).
**Generalise it to any blocking overlay**: an overlay that closes itself off a down-event or off async
work hands the rest of the gesture to whatever it was covering.

**ONE BLOCKING OVERLAY AT A TIME.** The final render decision is `shouldRenderAudioPrompt()` in the same
policy module: it also stands the modal down while `authUiOpen` (any auth/onboarding surface — lock
screen, PIN pad, mandatory PIN setup, "who is playing?") and under `?nogate=1`. "Turn on sound" is
meaningless before you know who is playing, and this modal painted over the PIN-setup dialog twice —
the first fix was a z-index bump, which is the wrong shape. **A new blocking surface claims `authUiOpen`
(see `AuthContext`) instead of joining a z-index arms race.**

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
