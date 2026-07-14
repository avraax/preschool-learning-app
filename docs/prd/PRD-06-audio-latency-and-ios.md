# PRD-06 — Audio latency, caching & iOS robustness

**Priority:** P2 (latency + occasional wrong/robot voice; not a hard blocker but felt constantly)
**Scope:** Medium–Large
**Depends on:** none (PRD-02's hook memoization is complementary; can be done independently)

---

## Context

All narration goes through `useSimplifiedAudioHook()` → `SimplifiedAudioController` singleton
(`src/utils/SimplifiedAudioController.ts`), whose `playAudio()` stops current audio then runs the clip
— **no queue**. The engine is `src/services/ttsClient.ts`: `POST /api/tts-azure` returns base64
ogg/opus (`shared-azure-tts.js` builds SSML + a PLS lexicon ref), cached in **localStorage** (24h TTL,
~2.8MB cap), played through one shared `new Audio()` element, with a 3-failure/30s circuit breaker and
a Web Speech fallback. Permission/readiness is in `src/contexts/SimplifiedAudioContext.tsx` +
`SimplifiedAudioPermission.tsx`. SFX (`sfxClient.ts`, Howler WebAudio) and music (`musicClient.ts`,
Howler HTML5) are separate channels; music ducks under TTS and is menu-only.

The finite content set is large but **closed**: 26 letters, numbers 0–100, a fixed pool of prompts and
welcomes, success/encouragement lines. Only Sig et Ord's read-back and a few composed sentences are
truly dynamic.

## Problems (with evidence)

### P1 — No shared/CDN cache; latency re-paid daily; per-insert jank

- The `Cache-Control` set on the **POST** `/api/tts-azure` response (`api/tts-azure.ts` ~83–84) does
  nothing — browsers/edge don't cache POST. Every cache-miss on every device is a full serverless +
  Azure round-trip (~300–1500ms of dead air between tap and voice). **A real 500 was observed** on
  "bus" mid-round, dropping to the robot Web Speech voice.
- The localStorage cache re-stringifies the **entire** map on every insert (`ttsClient.ts` ~366–380) →
  O(n) main-thread work per tap during a first-run browse; a synchronous multi-MB `JSON.parse` at
  startup; a 24h TTL that forces daily full re-synthesis; and a ~130-clip capacity (< letters+numbers).

### P2 — Stale-response race: the last tap doesn't always win

`playAudio` (`SimplifiedAudioController.ts` ~80–123) and `ttsClient.synthesizeAndPlay` (~243–272) don't
re-check that the clip is still the current one after the fetch. Tap "B" (cache miss, slow fetch) then
"K" (cached, plays instantly) → B's fetch resolves and pre-empts K, so the child hears the *previous*
tap. This also desyncs `isPlaying` so **music un-ducks under live narration**. Any two overlapping
speaks with different latencies trigger it; browse games on first run are the hot path. Compounds the
duplicated sticker+echo speak in the browse games (the milestone line and the letter cancel each other
nondeterministically).

### P3 — iOS robustness gaps

- The permission modal resumes a *probe* `AudioContext` + speaks an empty utterance but never primes
  `ttsClient`'s shared `<audio>` element (the thing that actually plays narration), so on iOS the first
  real (post-fetch) `play()` can still throw `NotAllowedError` → re-prompt loop; `isWorking` can be
  true while Azure playback is still blocked (`SimplifiedAudioContext.tsx` ~85–179).
- Suspension recovery only matches `ctx.state === 'suspended'`, but iOS/WebKit reports
  `'interrupted'` for calls/Siri/backgrounding — so the re-prompt path never arms on the most common
  interruption (~lines 122–128).
- Global cleanup hooks `beforeunload`/`pagehide`/`popstate` but **not `visibilitychange`**, so
  backgrounding a standalone PWA mid-clip leaves a stall timer that fires on return → the whole
  sentence re-speaks in the Web Speech voice seconds later (`ttsClient.play` ~132–160).
- First tap after load / after suspension is silently swallowed: `ensureAudioReady` returns false and
  skips the speak entirely instead of retrying after init.

### P4 — Fallback quality & format cliff

- `fallbackWebSpeech` picks the first `da*` voice; on devices without a Danish voice it reads Danish
  with a default (often English) voice, and resolves silently when `speechSynthesis` is absent — so
  audio-prompt-only games (Lyt og Find) become unplayable with no visual error.
- Output is `ogg/opus` only, with no `canPlayType` probe — an older iPad that can't decode ogg gets the
  robot voice permanently, indistinguishable from success in telemetry.

## Goals / Non-goals

**Goals:** near-instant narration for the closed content set; the last tap always wins; music never
ducks incorrectly; iOS unlock/interruption/backgrounding handled; a graceful, visible state when audio
truly can't play.

**Non-goals:** replacing Azure as the provider; the STT/mic side (PRD-03); the SFX/music re-encode
(PRD-07).

## Implementation plan

1. **Pre-bake the closed content set (biggest win).** At build time, synthesize the finite inventory
   (letters, numbers 0–100, fixed prompts/welcomes/encouragements) into `public/sounds/tts/` with a
   manifest keyed by `hash(text|voice|rate|lex)`. `ttsClient` checks the static manifest first and
   plays the file (cacheable via PRD-07's `/sounds` header) before ever hitting Azure. Azure remains
   only for dynamic text. This removes ~90% of calls and all first-tap latency in browse games.
   Provide a small build script (there's precedent: `tts-voice-eval.mjs`, `npm run tts:eval`).
2. **Make the endpoint genuinely cacheable for dynamic text.** Offer a `GET /api/tts-azure?k=<hash>`
   (or store synthesized clips in Blob and 302 to them) so a real shared warm cache exists across
   devices/days; fix the misleading POST `Cache-Control`.
3. **Generation token (P2).** Capture the requested `audioId`/epoch into the play path; after
   `synthesize()` resolves, bail if it's no longer current (both in `playAudio` and
   `synthesizeAndPlay`). Add an epoch counter in `TtsClient`. This also fixes the `isPlaying`/duck
   desync. While here, de-dupe the browse-games' unawaited sticker-line + awaited echo so they don't
   cancel each other.
4. **Move the clip cache to IndexedDB / Cache Storage** with binary blobs, per-entry writes, and a
   30-day TTL — removes the per-insert full-map stringify and the daily cold re-synthesis; raises
   capacity effectively unbounded.
5. **iOS (P3).** In `initializeAudio`, play a ~50ms silent clip **through `ttsClient`'s shared
   `<audio>` element** (and unlock Howler) inside the gesture, so the modal's promise is real. Match
   `'interrupted'` alongside `'suspended'`. Add a `visibilitychange:hidden` handler that pauses/cancels
   TTS and disarms the stall timer. In `ensureAudioReady`/`speak`, retry the last requested phrase once
   after init completes (within ~2s) instead of swallowing it.
6. **Fallback & format (P4).** `canPlayType` probe → if ogg/opus unsupported, request an alternate
   format (mp3/aac) from the endpoint. When both Azure and Web Speech are unavailable, surface a small
   non-blocking visual cue (esp. for audio-only games) rather than silent failure. Prefer a bundled da
   voice check.

## Acceptance criteria

- [ ] Browsing letters/numbers on a fresh load produces audio with no perceptible fetch delay (served
      from prebaked files, not Azure).
- [ ] Rapidly tapping two different items always ends on the **last** tapped item's audio; music stays
      ducked while any narration plays.
- [ ] Backgrounding and returning to the PWA mid-clip does not re-speak the sentence in a different
      voice.
- [ ] The first tap after unlock produces audio (no swallowed first tap).
- [ ] With ogg/opus unsupported (simulated), narration still plays (alternate format) or shows a
      visible cue.

## How to verify

- Use the `ui-screenshot` harness (it logs `/api/tts-azure` POSTs) to confirm browse games make few/no
  Azure calls after prebake, and to reproduce the rapid-tap race (script two quick `speak`-triggering
  taps and check which audio "wins" via controller state exposed on `window` for the test).
- Manual iOS pass on a real iPad for the unlock/interruption/backgrounding items (hardest to automate).
- Confirm the harness console shows no "Azure synthesis failed → Web Speech" during a normal browse.

## Risks / notes

- Prebaking must stay in sync with the content lists — generate from the same source arrays the app
  uses, and fail the build if a required key is missing.
- Voice can be swapped live via the adult VoiceOverridePanel; prebaked files assume the default voice —
  fall back to live synthesis when a non-default voice is active.
- Keep SFX and music on their separate channels; don't route them through the controller.
