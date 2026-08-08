---
paths:
  - "src/utils/SimplifiedAudioController.ts"
  - "src/contexts/SimplifiedAudioContext.tsx"
  - "src/hooks/useSimplifiedAudio.ts"
  - "src/hooks/useSpeechInput.ts"
  - "src/services/ttsClient.ts"
  - "src/config/audioReadiness.ts"
  - "src/utils/audioLiveness.ts"
  - "src/components/common/AudioBlockedCue.tsx"
  - "src/services/sfxClient.ts"
  - "src/services/audioFormat.test.ts"
  - "prebake-tts.mjs"
  - "src/config/gamePhrases.ts"
---

# Centralized Audio System Rules

All audio in this app goes through one centralized system. No exceptions.

## Architecture

```
SimplifiedAudioController (src/utils/SimplifiedAudioController.ts)  -- singleton, single-audio playback (NO queue)
├── SimplifiedAudioContext (src/contexts/SimplifiedAudioContext.tsx)  -- unlock path + the EVIDENCE behind the verdict
├── useSimplifiedAudioHook() (src/hooks/useSimplifiedAudio.ts)        -- component hook interface
├── config/audioReadiness.ts                                          -- PURE verdict: idle | live | blocked
├── utils/audioLiveness.ts                                            -- clock probe, 263627 recovery, userActivation, audioSession
└── AudioBlockedCue (src/components/common/AudioBlockedCue.tsx)        -- small NON-BLOCKING "Tryk for lyd" chip
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

**The manifest is a DYNAMIC import, and the lookup MUST NOT await it** (Performance PRD-01 W7). It is
166 KB of lookup table that nothing needs at mount, so it was the third-largest thing in the eager
preload; `ttsClient` now `import()`s it and kicks that load at module init. The constraint is the iOS one
already stated below: **iOS consumes the transient user-activation across an `await`**, and the prebaked
branch of `synthesizeAndPlay` reaches `this.play()` with NOTHING awaited in front of it — that is what
keeps the first tap in-gesture. So `prebakedFor()` reads a synchronously-available map or reports a
**MISS**, and a miss falls through to live Azure, which is the path dynamic text already takes: a slower
first clip, never silence. Awaiting the manifest inside the lookup would trade a load win for silent
first-tap failures on the one device this matters on. Verify with `cdp.mjs --audio-report` — the first tap
must play a `/sounds/tts/<hash>.mp3`, not a live synth.

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
- **To prove a refactor changed NO clip, check every enumerated key against the manifest** — don't eyeball
  the strings. Folding a line that was composed inline in a `.tsx` *and* hand-copied in the enumerator into
  one shared builder is a routine and worthwhile change (the two agree only by luck until they don't), and
  this is the check that makes it safe: `collectNarrationClips()` → assert `PREBAKED_TTS[c.key]` for every
  clip and report `0 of N missing`. A single altered character shows up as a miss, so a green run means the
  refactor is byte-identical and no prebake is needed.
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
  **For a SPELL-OUT the step is per LETTER**, not one fixed value: `src/config/letterClipTiming.ts` holds
  each letter name's measured spoken length (422ms for A, 1044ms for W), so a word costs what its own
  letters cost instead of the worst case — Sig et Ord's awaited version plodded at ~1.5–1.9s per letter.
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
  in Vite/tsc too. **`.ts` is right HERE and wrong for a Vercel function** — `api/**`/`lib/**` and the
  `src/config` modules they import use `.js`, because Vercel ships the compiled sibling
  (`.claude/rules/api-endpoints.md`). The two graphs OVERLAP at `src/config`, so an extension change
  for one side silently breaks the other: switching `stickers.ts` for the server took
  `tts:prebake` / `tts:eval` / `audit:*` down with it, and nothing type-checks those `.mjs` entries.
  They now carry `--import ./scripts/js-to-ts-resolve.mjs`; after touching any extension, RUN each
  script (`npm run audit:check` is the cheap one) rather than reasoning about the graph.

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
- **`letterPhrase` asserts a FACT, so it is only reusable where the fact holds.** "{bogstav} som {ord}"
  means *"K, as in Kat"* — true only when the word STARTS with that letter. Reaching for it to name a
  letter at some POSITION in a word produces a false line ("O som ko"), which mis-teaches the child
  exactly what he is learning; it would also need one clip per letter×word (156 of them for Stav Ordet's
  pool). To name a letter that isn't a word's initial, speak the letter NAME — baked for all 29, and
  already what placing a letter echoes.

## The five rules, and why each one exists

1. No audio management outside this system — the single-audio-at-a-time guarantee is enforced in one
   place, and a second owner reintroduces overlapping narration.
2. No component importing Web Speech API, Howler or HTML5 Audio directly. The one deliberate exception
   is `sfx` (`src/services/sfxClient.ts`), a separate short channel that must NOT be folded in here —
   it is what lets a tap cue and a spoken line overlap.
3. No component-level `isPlaying`/audio state — two sources of truth drift, and the hook already
   exposes it.
4. Components reach audio through `useSimplifiedAudioHook()` (aliased `useSimplifiedAudio`), so
   cancellation and the readiness verdict apply uniformly.
5. New capabilities go on `SimplifiedAudioController` and are exposed through the hook, for the same
   reason as rule 1.

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

## Navigation cleanup, and the audio-readiness verdict

Audio cancels automatically on navigation via `NavigationAudioCleanup` in `App.tsx` and the controller's
own listeners.

**There is NO blocking permission modal.** The old full-screen "Tænd for lyd" primer was deleted (Audio
activation PRD-01) because it was wrong in both directions on the owner's iPad: it covered a board that
was already talking, and dismissing it changed nothing. Unlock happens on the **first gesture anywhere**
— the document-wide listeners in `SimplifiedAudioContext` — which is what every reference implementation
does (Howler's `_unlockAudio`, Tone.js, PlayCanvas, Chrome's own autoplay guidance), and the child has to
tap the home menu to reach any game, so a primer had no job to do.

**The verdict is EVIDENCE-BASED, and the evidence is only ever something that made (or provably failed to
make) a sound.** `src/config/audioReadiness.ts` is pure and returns `idle | live | blocked` from five
inputs: `primePlaybackElement()`'s result, `playbackOkOnce`, a moving AudioContext clock, the consecutive
playback-failure count, and `hasBeenActive`. `blocked` — and only `blocked` — renders the small
non-blocking `AudioBlockedCue` chip ("Tryk for lyd"). Nothing latches: there is no `showPrompt`, no arming
timer and no dismiss flag, so the cue cannot go stale over an app that has started talking.

What each rule is protecting against, because each one cost a wrong verdict:

- **`speechSynthesis.speak(<empty utterance>)` NOT THROWING IS NOT EVIDENCE.** No `onstart`, no `onend`,
  nothing observed. It used to be OR'd into the verdict, where it could single-handedly latch a whole
  session as "working". The call is kept (it does unlock Web Speech); its "success" is discarded.
  Guarded by a source-reading assertion in `src/config/audioReadiness.test.ts`.
- **`ctx.state === 'running'` IS NOT LIVENESS, in either direction.** Narration plays through
  `ttsClient`'s `<audio>` element, SFX through `Howler.ctx`, music through Howler's HTML5 backend — all
  three can be audible while a probe context sits `suspended` (that was the reported false negative). And
  WebKit bug 263627 (open, iOS 17.0.3) has a context report `running` with `currentTime` **frozen**.
  Liveness is a **moving clock over ~120 ms** (`probeContextLive`); the recovery for a frozen one is
  `suspend()` → `resume()` (`recoverFrozenContext`, run on `visibilitychange → visible`, throttled).
  The readiness model takes **no `state` input at all**, and a test asserts that structurally.
  **`ctxLive` is a SAMPLED reading, not a live one** — it is refreshed by an unlock attempt and by a
  return-to-foreground, nothing else, so a bug report can legitimately show `ctxLive: false` beside a
  context that has since gone `running` (measured; a report from the blocked simulation shows exactly
  that). It self-heals in the direction that matters, because `updateUserInteraction` re-runs the unlock
  — and therefore the probe — whenever the last prime was `blocked`. The other direction (stale `live`
  over a context that has died) is deliberately left alone: it fails toward silence rather than toward a
  false accusation, and actual narration death is `narrationHealth`'s job, not the cue's. **Don't "fix"
  it with a poll** — a periodic probe on a 2017 iPad is exactly the per-frame style cost that
  `.claude/rules/animation-and-performance.md` exists to keep out.
- **An interruption ENDS IN `suspended`, not `running`** (WebKit's own
  `LayoutTests/webaudio/audiocontext-state-interrupted.html`: "running AudioContexts will not resume
  after an interruption ends"). So `onstatechange → suspended | interrupted` is the NORMAL aftermath of
  every iPad app switch, Siri call and phone call. It re-arms silent re-unlock via `markNeedsUserAction`
  and **must never feed `blocked`** — accusing the device there is what made the old modal bounce back
  after every dismiss. `playbackOkOnce` (never cleared) is what makes this hold: audio that has been
  heard once is not un-heard by a suspend.
- **`hasBeenActive` is what separates "blocked" from "untapped"** (`navigator.userActivation`, Safari
  16.4+). **Unsupported ⇒ `false` ⇒ never `blocked`** — fail toward silence, never toward a false
  accusation, and report support as its own field so an unsupported environment stays distinguishable
  from a genuinely untapped one.
- **`navigator.audioSession.type = 'playback'` is set in-gesture**, feature-detected, as the first
  statement of the synchronous block. Since iOS 17 the default type is `ambient`, which is **silenced by
  the device mute state** (WebKit 237322, Apple's own answer) — a candidate root cause of the "sometimes
  audio really IS off" half of the report. Only `.type` is unconditionally exposed in WebKit's IDL, so
  feature-detect, don't assume.
- **`bl-audio-ever-worked`** (device-scoped localStorage, NOT `progressStore`) records that the verdict
  once reached `live`. It **gates nothing** — a device where audio worked yesterday can be blocked today.
  Its jobs are the adult "Lyd på denne enhed" line and a bug-report field.
- **The unverified state is `idle`, not `blocked`.** Tapped, nothing positive, nothing negative ⇒ say
  nothing. Same rule as `narrationHealth`: a cold start must never read as dead.

**The tap-through rule, unchanged and general to ANY overlay**: an overlay that acts on a down-event —
`pointerdown`/`touchstart` — **or from any async work a down-event can start** hands the rest of the
gesture to whatever it was covering. A `click` is the LAST event of a tap and its target is resolved
before the handler runs, so acting there cannot retarget anything. This shipped twice: the deleted modal
closed itself from `initializeAudio`'s async continuation, so one tap on its button ALSO pressed the
answer tile behind it (owner, 2026-08-03). The cue is small, so its blast radius is smaller; the rule is
unconditional, and `audioReadiness.test.ts` asserts `AudioBlockedCue` carries no early-event handler.

**ONE BLOCKING OVERLAY AT A TIME still applies even though the cue does not block.** The final render
decision is `shouldShowAudioCue()` in the same pure module: it stands the cue down while `authUiOpen`
(any auth/onboarding surface — lock screen, PIN pad, mandatory PIN setup, "who is playing?") and under
`?nogate=1`. "Tryk for lyd" is meaningless before you know who is playing, and the modal it replaced
painted over the PIN-setup dialog twice — the first fix was a z-index bump, which is the wrong shape.
**A new blocking surface claims `authUiOpen` (see `AuthContext`) instead of joining a z-index arms
race.** The cue itself sits below MUI's modal tier (1300), so an adult dialog covers it.

**Verifying it: `webkit.mjs` cannot play audio at all**, so a real WebKit run legitimately reaches
`blocked` and legitimately shows the cue. Rung 2 may assert layout, no-crash and the cue's geometry; it
may **never** be cited as evidence about the verdict. Use `cdp.mjs --audio-report` for that (and
`--block-autoplay` to make the cue appear on purpose, `--simulate-hung-resume` for a `resume()` that never
settles — the only way to reach a hung unlock headlessly, since `--block-autoplay` cannot: Chrome hands
the app a context that is already `running`, so the code never calls `resume()` at all), and the owner's
iPad for the residue — cold
launch, app-switcher round trip, Siri, and the Control-Centre mute switch, which is the only way to test
`audioSession.type`.

iOS robustness gotchas (PRD-06), easy to regress:
- **iOS consumes the transient user-activation across an `await`.** Everything that needs the gesture —
  `audioSession.type`, `resume()`, `primePlaybackElement()`, `speechSynthesis.speak()` — must run
  **synchronously before the first `await`** in the unlock path: set the session type, kick `resume()`
  (don't await it), prime + speak in-gesture, THEN await only to verify. Priming *after* `await resume()`
  silently failed → **no sound at all**. WebKit is stricter than the spec here on purpose:
  `shouldDocumentAllowWebAudioToAutoPlay` in `AudioContext.cpp` requires `hasTransientActivation()` —
  the sticky `hasHadUserInteraction()` branch is a site quirk for zoom.com. **The clock probe
  (`probeContextLive`) must therefore run AFTER the gesture's synchronous work**, never inside it.
- The unlock gesture must prime **`ttsClient`'s shared `<audio>` element** (`primePlaybackElement()`),
  not just the probe `AudioContext` — narration plays through that element, so it's the one iOS needs
  user-activated, or the first post-fetch `play()` throws `NotAllowedError`. **Its `src=`/`play()` pair
  stays synchronous**; only its RESULT is observable (`'ok' | 'blocked' | 'error'`), and that result is
  the app's single strongest activation signal. `'error'` (a decode/format problem) is deliberately NOT
  an activation verdict — that class is what `consecutivePlaybackFailures` sees.
- Howler 2.2.4's iOS `_cleanBuffer` crash (`undefined is not an object (evaluating '…bufferSource')`,
  from its internal `_ended` timer on a torn-down node) is patched once at load in
  `src/services/howlerGuard.ts` — keep it; upstream is unfixed.
- Match `'interrupted'` (iOS calls/Siri/backgrounding) alongside `'suspended'` everywhere recovery is
  armed — WebKit uses `'interrupted'`, which is outside the TS `AudioContextState` union.
- `visibilitychange:hidden` cancels TTS so the stall timer is disarmed; otherwise a backgrounded PWA
  re-speaks the clip (in the Web Speech voice) on return.
- `ensureAudioReady` is **async** and awaits `initializeAudio()`, so the first tap after load/suspension
  isn't silently swallowed — but **every await in the unlock path is BOUNDED** (`settleWithin`, with the
  two budgets in `utils/audioLiveness.ts`). An iOS `AudioContext.resume()` promise **can never settle**,
  and one bare `await` on it left the whole app mute for a session: `initializeAudio()` never resolved, so
  its de-dupe promise (`initPromiseRef`) never cleared and every later `speak()` awaited the same dead
  promise, while Howler's music and SFX played on. Verification is allowed to fail to ARRIVE; it is not
  allowed to hang. A timeout is **no evidence** (`'unknown'`, never `'blocked'` — the prime had already
  succeeded) and it **plays anyway**, for the same reason `isWorking` is permissive. Two independent
  brakes, because the thing that wedges is inside one of them: `resume()`/prime inside `initializeAudio`,
  and the whole unlock from `ensureAudioReady`.

## Narration health: `isWorking` is not "the child can hear it"

Two games are UNANSWERABLE in silence by design — Tal Quiz (a speaker and an equalizer, nothing else) and
Lyt og Find (audio→picture). Both are correct *while audio works*, and this app has shipped total silence
on the target iPad twice. So a board like that reads **`audio.narrationHealthy`**, never `isAudioReady`.

- **`isWorking` was TRUE right through the Ogg failure.** The `<audio>` element existed and accepted a
  src; the bytes were simply undecodable. So "can we play audio at all" is the wrong question — the signal
  is `ttsClient`'s **consecutive PLAYBACK failure** count (decode error, timeout, blocked `play()`), reset
  by a clip that actually plays, and exposed in the bug-report health snapshot. The pure rule is
  `src/config/narrationHealth.ts`.
- **`isWorking` is DELIBERATELY PERMISSIVE, and that is not the same field as the readiness verdict.** It
  is now `readiness !== 'blocked'`, because `ensureAudioReady()` SKIPS a `speak()` when it is false and
  the games gate their welcome on it — and attempting playback is how evidence gets gathered in the first
  place, so a stricter reading would make the app mute itself into permanent uncertainty. What changed is
  that it can now go false on real proof, where before only a suspended probe context could lower it and
  the speechSynthesis lie kept raising it. `narrationHealth`'s BEHAVIOUR is unchanged by design (Audio
  activation PRD-01 §4.6) — its `unlockedOnce && !isWorking` clause exists because the naive form printed
  Tal Quiz's numeral over its own answer tiles on every cold launch. Don't "unify" the two.
- **A cancellation is NEUTRAL** — neither a failure nor a success. The no-queue model pre-empts constantly
  (a healthy run reports several `AbortError`s), so counting a cancel as success is exactly how a real
  failure streak would hide, and counting it as failure would degrade normal fast tapping.
- **"Not unlocked yet" is not "dead".** Requiring positive evidence — two failed plays, or audio that
  worked and then stopped — is load-bearing, not a refinement: the naive `isWorking && failures < 2` form
  called a COLD START dead and printed Tal Quiz's numeral over its own answer tiles on entry. A giveaway
  flash on every cold launch is worse than the bug the degraded mode fixes.
- While unhealthy those two boards **reveal their answer as type** and revert automatically when a clip
  sounds. That deliberately re-creates a giveaway the owner removed, and it is the right trade only there:
  a solvable board beats an unanswerable one. Play grants XP as normal throughout (never punish a child
  for a broken iPad). **The `degraded` flag and the `audioOnly` config flag are DELETED** (Endless Play
  PRD-01 W3): they existed only to withhold a personal best, and personal bests no longer exist. The
  reveal hangs directly off `narrationHealthy` at the render site — pinned by `narrationHealth.test.ts`,
  which now asserts that **exactly two components** contain one. No child-facing warning: a warning is
  for the adult, who already gets audio health in the report.
- Drive it on rung 1 with **`?mute-tts=1`** (`DEV || __HARNESS__`, so absent from a deploy build), and
  remember the focal band is already full — anything added there needs re-measuring at phone landscape
  (`.claude/rules/responsive-design.md`).

## Speech INPUT (separate from playback)

`Sig et Ord` captures audio via `src/hooks/useSpeechInput.ts` (MediaRecorder -> `/api/stt`, Google STT v2).
This is the *capture* side and sits beside the controller. It must NOT record while TTS is playing — call
`audio.stopAll()` before starting capture.

- **THE MODEL IS THE GAME.** This screen sends ONE isolated word, and the `short` model returns **zero
  results** for that — measured over 16 common Danish words × 4 child-like distortions: 0–1 of 16, while a
  full SENTENCE from the same voice transcribed at 0.94. Not credentials, container, level or length; the
  da-DK `short`/`long` models simply discard a lone monosyllable. `chirp_3` hears them, and lives ONLY in
  the `eu` multi-region (`chirp`/`chirp_2` are not there, and chirp_2 via europe-west4 measured worse).
  `api/stt.ts` carries the numbers; **`src/config/sttConfig.test.ts` pins the model, the `da-DK` language,
  the EU region and the profanity flag in BOTH `api/stt.ts` and its `dev-server.js` mirror**, which is the
  only thing stopping a "simplification" back to `short` from silently returning the game to
  "det hørte jeg ikke helt" on every attempt.
- **The mic is opened ONCE per visit and held** (`prime()`), so `startRecording()` is **synchronous**.
  Opening it inside the press cost 100–500ms during which the board already said "Jeg lytter" — the first
  syllable, often the whole word, was never captured. **Never let the UI claim to be listening before the
  recorder is actually running**; the honest in-between is its own state.
- **`prime()` owns the generation counter** (`genRef`), and `release()`/`cancel()` bump it: an in-flight
  `getUserMedia` self-aborts and stops the granted tracks, so the OS mic never lingers after the child
  navigates away. `stopAndRecognize()` deliberately does NOT bump it (it keeps the stream for the next
  word). The hook releases on unmount itself, so a component can't leak the indicator by forgetting.
- **Recognition must be bounded by a race, not an abort signal.** `authorizedFetch` awaits a token mint
  BEFORE `fetch`, which no `AbortController` can cancel — that left the board on "Lad mig tænke…" forever.
  The board carries a second, longer watchdog for the same reason: two independent brakes, because one of
  them is inside the thing that could be wedged.
- **`normalizeSpokenWord`** (`src/config/spokenWordInput.ts`, replaces the old `extractFirstWord`) is the
  one place a transcript becomes a word: masked/blocked profanity → nothing, a leading one-letter token
  dropped, a one-letter result rejected, digits → Danish number words, lowercased (the prebaked key AND the
  case-sensitive PLS lexicon both need it), and a measured-only table repairing non-Danish spellings of
  Danish homophones ("cat" → "kat"). **The Danish blocklist is load-bearing, not belt-and-braces**:
  measured, `chirp_3` masks English profanity and passes Danish through in the clear — and this game
  SPELLS ALOUD whatever it hears. Server side in `.claude/rules/api-endpoints.md`.
- Verify it end-to-end without a voice: `.claude/skills/ui-screenshot/mic.mjs` (fake microphone fed real
  Danish, plus silence and short-press runs). Rung 3 still owns "does it understand a real 5-year-old".
