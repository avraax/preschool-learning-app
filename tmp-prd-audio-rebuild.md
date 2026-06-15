# PRD: Audio v2 — scoped rebuild of the audio/TTS system (+ Azure migration & pronunciation lexicon)

> **Status:** Ready to implement in a fresh session.
> **Type:** Internal rebuild of the audio subsystem. Behavior-preserving for the games; provider + engine change underneath.
> **Owner decision (2026-06-14):** Do a **scoped rebuild**, NOT a from-scratch rewrite. Rebuild the playback engine, swap TTS provider to **Azure AI Speech**, add a **pronunciation lexicon**; refactor backend/cache/permission/logging; **keep** the `useSimplifiedAudio` hook API, the game components, and the speech-input (mic) flow unchanged.
>
> **Confirmed scope decisions (2026-06-14):**
> 1. **Remove Google TTS entirely** at cutover and **move the English section to an Azure `en-GB` voice** too → single TTS provider (Azure).
> 2. **Logging:** fix the relative-URL bug AND make `remoteConsole` logging **dev-only / off in production** (durable Vercel KV storage is explicitly NOT required).
> 3. **Default Danish voice:** keep the **VoiceLab audition step** (Christel vs Jeppe vs multilingual, with the lexicon applied) before locking — `da-DK-ChristelNeural` is the lead candidate, not yet final.

This PRD is self-contained: it includes the audit that motivated the rebuild, the exact API contract to preserve, the new architecture, the Azure integration details, and a file-by-file plan. An implementer with no prior context should be able to execute it.

---

## 0. Setup status & verified facts (done before this PRD — do NOT redo)

Azure was provisioned and validated on 2026-06-14. The implementer starts from here:

- **Azure resource exists** (Speech, **region `westeurope`**, Free **F0** tier). Key is valid.
- **Env vars are already set:**
  - `.env.local` (local dev): `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION=westeurope` (alongside the existing `GOOGLE_*` vars). `.env.local` is gitignored.
  - **Vercel: `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` set for Production, Preview, and Development.** ✅ (all three confirmed via `vercel env ls`)
  - ⏳ `AZURE_LEXICON_URI` not set yet (Phase 2, once the PLS file is hosted).
- **Verified working via `curl` against `https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1`:**
  - `da-DK-ChristelNeural` synthesizes Danish → HTTP 200, valid **Ogg/Opus 24 kHz** (`X-Microsoft-OutputFormat: ogg-24khz-16bit-mono-opus`).
  - **da-DK inline IPA works:** `<phoneme alphabet='ipa' ph='sɛd'>Z</phoneme>` → HTTP 200, audio. **Pronunciation control for Danish is proven.**
- **⚠️ Critical implementation gotcha (cost us a 400):** the request body MUST be sent as **UTF‑8** with header **`Content-Type: application/ssml+xml; charset=utf-8`**. Passing non-ASCII IPA (`ɛ`, `ˀ`) in a raw inline string returns HTTP 400; a properly UTF‑8-encoded body works. In the serverless function, build the SSML string in JS (UTF‑8 by default) and set the charset header.
- **Region auto-detect trick (FYI):** `POST https://<region>.api.cognitive.microsoft.com/sts/v1.0/issueToken` with `Ocp-Apim-Subscription-Key` returns 200 for the correct region, 401 otherwise — handy for validating a key.

---

## 1. Background & why we're doing this

The audio/TTS system was built ~1 year ago and has thrown errors for the app's entire life. Three independent code audits (2026-06-14) found that the system is **mostly healthy** but has a **fundamentally unsound playback engine** plus two "smoking-gun" bugs. We are also changing TTS providers (Google → Azure) because **no free Google voice gives correct Danish pronunciation and Google Cloud TTS has no `da-DK` phoneme/IPA support** — so pronunciation can never be corrected on Google. Azure is the only researched option that offers exact Danish pronunciation control (SSML IPA `<phoneme>` + a durable hosted PLS lexicon) at near-zero cost. Doing the engine rebuild and the provider swap together avoids bolting a new provider onto distrusted code.

### 1.1 The two root-cause bugs ("why it's been broken for a year")

1. **Server errors were never logged.** `api/tts.ts:111` and `api/stt.ts:96` call `fetch('/api/log-error', …)` with a **relative URL**. In a Vercel serverless function there is no origin, so `fetch` throws `TypeError: Failed to parse URL`, caught and reduced to a `console.warn`. Every server-side TTS/STT failure (Google credential errors, quota, timeouts) was silently dropped. This is why the `/api/log-error` store is always empty.

2. **The playback engine reports success as failure and failure as success.** In `googleTTS.ts`, `playAudioFromData` (lines ~537–839) decides completion via a 4-way race: `ended` / `timeupdate` / `pause` / a flat timeout. A flat **5s iOS timeout `reject`s healthy audio** longer than 5s; the **`pause` path can resolve clips that were actually cancelled**. Plus: a 75-phrase preload burst at startup trips the **circuit breaker** (3 failures → all audio disabled for 30s on launch), and a `voiceschanged`-`once` listener with no timeout can **hang forever**.

### 1.2 Audit verdict by layer

| Layer | Verdict | Evidence (file:line) |
|---|---|---|
| Playback engine — `googleTTS.ts` `playAudioFromData` + `synthesizeAndPlay` | **REBUILD** | ~300-line `new Promise(async …)` executor; 3-stage iOS retry ladder (716–817); overlapping double-Web-Speech (804 + 1033); completion race (555–661); `voiceschanged`-once hang (932) |
| Backend — `api/tts.ts`, `api/stt.ts`, `dev-server.js` | **REFACTOR** | relative-URL log bug (tts.ts:111, stt.ts:96); dev/prod drift (no 5000-char guard, CORS, error-string mismatch in dev-server.js); open/unauthenticated endpoints; `as any` at the untrusted boundary (tts.ts:86) |
| Caching — localStorage base64 in `googleTTS.ts` | **REFACTOR** | swallowed `QuotaExceededError` (311–312); double-computed cache key (424 + 287); item-count cap not byte cap (344–350); `cleanCache` defined but never called |
| Permission/readiness — `SimplifiedAudioContext.tsx` | **REFACTOR** | latches `isWorking=true` on **unverified** synth unlock (122,130–137); no recovery if iOS context later suspends; no non-iOS prompt (155,200); fragile controller↔context mutable-global bridge (controller 13–18 ↔ context 223–229) |
| Hook contract — `useSimplifiedAudio.ts` | **KEEP** | small, sane surface; ~20 components depend on it through 2 shared quiz components |
| Speech input — `useSpeechInput.ts` | **KEEP** | cleanest module; correctly coordinated with playback (SpeakWordGame.tsx:94–95) |
| Logging — `remoteConsole.ts` | **RETHINK** | on-by-default in prod; double-logs every audio issue (348–364); ephemeral per-instance store you can't read back |

### 1.3 Audit cleanup notes (dead/confusing code found — delete during rebuild)

- `googleTTS.ts:9` `globalAudioPermissionContext` is declared, read (671), but **never assigned** → dead branch.
- `SimplifiedAudioController.ts:25` `this.sounds` Howler `Map` is **never populated** → all Howler iteration in `stopCurrentAudio`/`emergencyStop` operates on an empty map. Howler is effectively unused for playback.
- `stopCurrentAudio` (controller 120–173) calls `speechSynthesis.cancel()` up to **6×** and does a **page-wide `document.querySelectorAll('audio')`** pause/clear on every new audio start — over-aggressive; a plausible cause of iOS synth wedging and races.
- `speakSlowly`/`speakWithEnthusiasm` are identical to `speak` (controller 276–282).
- MIME mismatch: audio synthesized as **OGG_OPUS** but built as `data:audio/mp3;base64,…` (googleTTS.ts:531). Fix the label.
- Config: `voiceConfigs.backup`/`male` are hardcoded in `googleTTS.ts:36–44` (a second source of voice truth not in `shared-tts-config.js`).

---

## 2. Goals & non-goals

**Goals**
1. A playback engine that is correct and diagnosable: one clear resolve/reject/cancel model, no retry ladders, no page-wide audio nuking.
2. TTS via **Azure AI Speech**, with **exact, permanent Danish pronunciation** via a hosted PLS lexicon + inline IPA.
3. Fix the two root-cause bugs and the cache/permission/logging defects.
4. **Zero or near-zero changes to game components** — preserve the `useSimplifiedAudio` hook API exactly (§4).
5. Keep cost near-zero (Azure F0 free tier; 24h caching retained).

**Non-goals**
- No redesign of the games or the hook's method names/signatures.
- No change to the speech-input (mic/STT) capture flow beyond what's needed to keep it coordinated.
- The `/voicelab` page and `VoiceOverridePanel` are throwaway tools (see §10) — extend for Azure auditioning, then remove after the voice is locked.

**Decided (was previously open):**
- **English section moves to an Azure `en-GB` voice** (Google is removed entirely). Keep `speakEnglish` behavior identical; only the underlying voice/provider changes. Audition an en-GB voice (e.g. `en-GB-SoniaNeural` / `en-GB-RyanNeural`) alongside the Danish voices.
- **Logging is dev-only in production** (see §9.3).

---

## 3. Current system map (files)

```
src/
  utils/SimplifiedAudioController.ts   (705 lines) facade singleton; ~25 speak* methods; single-audio gate; nav cleanup
  services/googleTTS.ts                (1138 lines) playback engine: synthesize → /api/tts, cache, iOS playback, Web Speech fallback
  contexts/SimplifiedAudioContext.tsx  React permission/readiness provider (3 booleans: isWorking/needsUserAction/showPrompt)
  hooks/useSimplifiedAudio.ts          the component hook (API to PRESERVE — see §4)
  hooks/useSpeechInput.ts              mic capture → /api/stt (KEEP as-is)
  components/common/SimplifiedAudioPermission.tsx   iOS permission modal
  config/tts-config.ts                 thin typed re-export of shared-tts-config.js
  config/danish-phrases.ts             DANISH_PHRASES, getDanishNumberText(), success/encouragement phrases
  config/voiceOverride.ts              THROWAWAY runtime override (voicelab tool)
  components/voicelab/                  THROWAWAY /voicelab page + VoiceOverridePanel + voicelabData
  utils/remoteConsole.ts               console interception → /api/log-error (RETHINK)
api/tts.ts, api/stt.ts, api/log-error.ts   Vercel serverless (Node)
dev-server.js                          local Express mirror of the api/* handlers
shared-tts-config.js                   single source for voice + audioConfig (imported by client + servers)
```

The active default voice today is `da-DK-Chirp3-HD-Sulafat` @ speakingRate 0.9 (set in `shared-tts-config.js`). This will be replaced by an Azure voice (§6).

---

## 4. The contract to PRESERVE — `useSimplifiedAudio` hook API

The rebuild MUST keep this interface identical (names + signatures) so no game component changes. Source: `src/hooks/useSimplifiedAudio.ts`. The hook returns a `SimplifiedAudioHook`:

```ts
interface SimplifiedAudioHook {
  isPlaying: boolean
  speak: (text: string, voiceType?: 'primary'|'backup'|'male', useSSML?: boolean, customSpeed?: number) => Promise<string>
  speakLetter: (letter: string) => Promise<string>
  speakNumber: (number: number, customSpeed?: number) => Promise<string>
  speakEnglish: (text: string) => Promise<string>
  speakWithEnthusiasm: (text: string, voiceType?) => Promise<string>
  speakSlowly: (text: string, voiceType?) => Promise<string>
  speakQuizPromptWithRepeat: (text: string, repeatWord: string, voiceType?) => Promise<string>
  speakMathProblem: (problem: string, voiceType?) => Promise<string>
  speakAdditionProblem: (num1: number, num2: number, voiceType?) => Promise<string>
  speakSubtractionProblem: (num1: number, num2: number, voiceType?) => Promise<string>
  announceGameResult: (isCorrect: boolean, voiceType?) => Promise<string>
  announceScore: (score: number, voiceType?) => Promise<string>
  playGameWelcome: (gameType: string, voiceType?) => Promise<string>
  playSuccessSound: () => Promise<string>
  playEncouragementSound: () => Promise<string>
  stopAll: () => void
  emergencyStop: () => void
  cancelCurrentAudio: () => void
  updateUserInteraction: () => void
  registerNavigationCleanup: (cb: () => void) => () => void
  getTTSStatus: () => { cacheStats: {size:number;oldestEntry:number;newestEntry:number}; isPlaying: boolean; currentAudioId: string|null }
  handleCompleteGameResult: (options: {...}) => Promise<string>
  announcePosition: (currentIndex: number, totalItems: number, itemType: string) => Promise<string>
  speakColorHuntInstructions: (phrase: string) => Promise<string>
  speakColorMixingInstructions: (targetColor: string) => Promise<string>
  speakComparisonProblem: (left:number,right:number,leftObj:string,rightObj:string,type:'largest'|'smallest'|'equal') => Promise<string>
  handleGameCompletion: (options: {...}) => Promise<string>
  speakNewColorHuntGame: () => Promise<string>
  playCelebrationWithStandardTiming: (options: {...}) => Promise<void>
  isAudioReady: boolean
  needsUserAction: boolean
  initializeAudio: () => Promise<boolean>
}
```

(Full option-object shapes for `handleCompleteGameResult` / `handleGameCompletion` / `playCelebrationWithStandardTiming` are in the current `useSimplifiedAudio.ts` lines 50–86 — copy them verbatim.)

**Real usage (from the coupling audit)** — the heavily-used members are: `speak` (~14 components), `updateUserInteraction` (~10), `isAudioReady` (8), `cancelCurrentAudio` (8), `playGameWelcome` (7), `announceGameResult`, `handleCompleteGameResult`/`handleGameCompletion`, `isPlaying` (read-only visual pulse), plus `stopAll`+`speakLetter` (SpeakWordGame only). ~20 components depend on the hook, but most route through `UnifiedQuizGame` and `UnifiedMemoryGame`. Keep all methods (even rarely-used ones) to guarantee zero call-site churn.

`SimplifiedAudioController` keeps these methods as the facade; only their **internals** change to call the new engine. The number-as-words behavior (`getDanishNumberText`) and the `GAME_WELCOME_MESSAGES` map inside `playGameWelcome` must be preserved.

---

## 5. New playback engine (the core rebuild)

Replace `googleTTS.ts`'s `playAudioFromData` + `synthesizeAndPlay` (and trim the rest) with a small, correct engine. Recommended new module: `src/services/ttsClient.ts` (or rewrite `googleTTS.ts` in place — keep the singleton export name the controller imports, or update the one import in `SimplifiedAudioController.ts`).

### 5.1 Playback rules (single source of correctness)

- **One shared `HTMLAudioElement`** reused for all clips; `stopCurrent()` = `pause()` + clear `src`. **Do NOT** query/iterate the whole DOM. **Do NOT** call `speechSynthesis.cancel()` more than once per stop.
- **`play(base64, mime)` returns a Promise that:**
  - resolves on the `ended` event,
  - rejects on a *real* `error` event (decode/network), **with the original error attached as `cause`**,
  - treats **cancellation** (a newer clip or navigation calling `stopCurrent()`) as a distinct, **non-error** outcome — resolve with a sentinel like `{cancelled:true}` or a custom `CancelledError` that callers ignore. Cancellation MUST NOT log as an error.
  - arms **one** timeout sized to `audio.duration` when known (e.g. `duration*1000 + 2000ms` buffer), with a conservative fallback (e.g. 15s) only when `duration` is `NaN`. Never a flat 5s.
- **No retry ladder.** One attempt. If `audio.play()` rejects with `NotAllowedError` (autoplay/gesture), surface `needsUserAction` to the permission layer rather than retrying blindly.
- **Single fallback, one place:** if Azure synthesis or playback fails (non-cancellation), fall back to Web Speech **once**. The Web Speech path MUST arm its own timeout *before* awaiting `voiceschanged` (fixing the hang), and resolve/reject deterministically.
- **MIME correctness:** if synthesizing OGG/Opus use `data:audio/ogg;base64,…`; if MP3 use `data:audio/mpeg;base64,…`. Match the Azure `X-Microsoft-OutputFormat` (§6.3).
- **Circuit breaker:** keep a breaker for *interactive* synthesis failures, but **scope it so the startup preload cannot trip it** (preload failures must not disable interactive audio). Prefer: no preload burst at all, or a preload that bypasses the breaker and never disables playback.

### 5.2 Synthesis

- `synthesize(text, {voiceType, useSSML, speed})` → POST to the new `/api/tts-azure` (§6), returns base64 audio.
- Keep the existing cache layer but **fixed** (§7). Cache key must be a single, lossless function of `(provider, voiceName, outputFormat, speed, useSSML, exactText)` — do not double-encode, do not `toLowerCase()`/strip characters that distinguish inputs.
- Danish voiceTypes (`primary`/`backup`/`male`) map to Azure da-DK voices; `english` maps to an Azure `en-GB` voice. The SSML wraps the chosen `<voice name>` and references the lexicon (§8).

### 5.3 Keep / delete

- **Keep:** the controller facade + its ~25 methods; `getDanishNumberText` usage; `GAME_WELCOME_MESSAGES`; the single-audio (no-queue) model; navigation cleanup wiring (`NavigationAudioCleanup` in `App.tsx`).
- **Delete:** the 3-stage iOS `attemptIOSPlayback` ladder; `window.__globalAudioContext`/`__creatingAudioContext` global locking; the dead `globalAudioPermissionContext`; the empty Howler `sounds` map handling; page-wide `<audio>` teardown; the duplicate Web-Speech invocation; tombstone comments.

---

## 6. Azure AI Speech integration

All facts below are from the deep-research pass (2026-06-14), verified against Microsoft Learn. **Re-verify pricing/voice lists before coding — TTS specifics change.**

### 6.1 Voices (objective pick: correctness first)
- **`da-DK-ChristelNeural`** (Female) — lead candidate / default.
- **`da-DK-JeppeNeural`** (Male) — alternate / "male" voiceType.
- Multilingual voices (`en-US-AvaMultilingualNeural`, `AndrewMultilingual`, etc.) can also speak da-DK — audition as alternates.
- English section: pick an `en-GB` neural voice (e.g. `en-GB-SoniaNeural` / `en-GB-RyanNeural`) to **replace** the Google en-GB voice (Google is removed entirely); keep `speakEnglish` behavior identical.
- **Audition step is retained** (owner decision): compare Christel vs Jeppe vs multilingual (da-DK) and the en-GB candidates in the VoiceLab tool (§10) **with the lexicon applied**, then lock. `da-DK-ChristelNeural` is the lead candidate but not final.
- ✅ Already verified: Christel returns valid Ogg/Opus and da-DK IPA `<phoneme>` works (see §0).

### 6.2 Cost & tier
- **F0 free tier:** 0.5M neural characters/month. **S0 paid:** $15 / 1M chars (NeuralHD $22 / 1M). With 24h caching + tiny content, cost is effectively zero on F0.
- **Open question:** whether creating an F0 Speech resource requires a credit card (Azure signup generally asks for one even for free). Owner must create the resource.

### 6.3 REST synthesis (Node serverless — same shape as the Google call)
- **Endpoint:** `https://<REGION>.tts.speech.microsoft.com/cognitiveservices/v1` (REGION e.g. `westeurope` / `northeurope`). (Resource-style `https://<resource>.cognitiveservices.azure.com/...` also works.)
- **Method:** `POST`
- **Headers (all required):**
  - `Ocp-Apim-Subscription-Key: <AZURE_SPEECH_KEY>` (single-header auth — simplest; Bearer token also possible)
  - `Content-Type: application/ssml+xml`
  - `X-Microsoft-OutputFormat: ogg-24khz-16bit-mono-opus` (iOS-friendly Opus, ✅ verified; or `audio-24khz-48kbitrate-mono-mp3`). Match the client MIME label (`data:audio/ogg;base64,…` for Opus).
  - `User-Agent: <any non-empty string>` (Azure rejects requests without it)
  - ⚠️ Use `Content-Type: application/ssml+xml; charset=utf-8` and send a UTF‑8 body — required for the IPA/`<phoneme>` non-ASCII characters (see §0).
- **Body:** SSML (not JSON). Voice + lexicon + phonemes ride inside the SSML (§8). The response body is the raw audio bytes → base64-encode and return `{ audioContent }` to match the existing client contract.

### 6.4 Pronunciation control
- **Inline IPA:** `<phoneme alphabet="ipa" ph="…">word</phoneme>` — works for da-DK (Danish must use IPA; the SAPI phonetic set excludes da-DK).
- **Durable lexicon:** `<lexicon uri="https://…/da-DK.pls"/>` referenced inside `<voice>`. See §8.

---

## 7. Caching fixes (localStorage)

Keep the localStorage base64 cache (good for offline-ish + instant replays) but make it robust:
1. **Single lossless cache key** (§5.2) — drop the double `generateCacheKey`-on-a-composite-string scheme; do not normalize away distinguishing characters.
2. **Catch `QuotaExceededError`** on write → evict oldest entries until the write succeeds (or skip persistence gracefully). Never let a quota error surface as a logged error.
3. **Bound by total bytes**, not item count (current 100-item cap doesn't bound size; a few large clips can blow the ~5MB Safari quota which counts UTF-16 ≈ 2×).
4. **Call `cleanCache()` on load** (it's defined but never invoked) to sweep expired entries.
5. Store under a **new key** (e.g. `tts_audio_cache_v2`) so old Google-voice base64 doesn't linger.

---

## 8. Pronunciation lexicon (the "perfect Danish" payoff)

Author one da-DK W3C **PLS v1.0** XML file and host it at a public URL (Azure Blob recommended; public GitHub raw works). Reference via `<lexicon uri="…"/>`. Limits: 30 KB/file (F0), 100 KB/file (S0); one locale per file (`xml:lang`); grapheme matching is case-sensitive; lexicon file characters are **not billed**.

Skeleton:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
         alphabet="ipa" xml:lang="da-DK">
  <!-- Letter names (fixes C/Q/W/X/Y/Z and Æ/Ø/Å) -->
  <lexeme><grapheme>Z</grapheme><phoneme>sɛd</phoneme></lexeme>
  <lexeme><grapheme>W</grapheme><phoneme>dʌbəlˀ ve</phoneme></lexeme>
  <!-- Tricky stød / soft-d minimal pairs -->
  <lexeme><grapheme>hund</grapheme><phoneme>hunˀ</phoneme></lexeme>
  <lexeme><grapheme>hun</grapheme><phoneme>hun</phoneme></lexeme>
  <!-- …expand from the owner's defect list… -->
</lexicon>
```

**Defect-list workflow:** the owner audits which exact letters/words/sentences sound wrong on the chosen Azure voice (using VoiceLab, §10) and supplies the list; each becomes a `<lexeme>` (or an inline `<phoneme>` for one-offs). Because the app's content is finite (29 letters, numbers, ~20 sentences, small word pool), the lexicon stays well under 30 KB.

**Letter names** — note `SimplifiedAudioController.speakLetter` currently sends the bare glyph. Either (a) add a Danish letter-name map in the controller, or (b) rely on the lexicon to map single uppercase graphemes to their Danish names. The lexicon route is preferred (one source of pronunciation truth), but verify single-character grapheme matching behaves as expected for letters; otherwise use the controller map for letter NAMES and reserve the lexicon for words.

---

## 9. Backend, permission, and logging refactors

### 9.1 Backend (`/api/tts-azure`, shared core with STT)
- Add `api/tts-azure.ts` mirroring the structure of `api/tts.ts` but calling Azure (§6.3). Mirror it in `dev-server.js` **from a shared module** so dev/prod can't drift (extract a shared `synthesize()` used by both, or at minimum keep them byte-identical and tested).
- **Fix the logging fan-out bug:** replace `fetch('/api/log-error')` with either an in-process call or an absolute URL built from the request host. Do this in `api/tts.ts`, `api/stt.ts`, and the new endpoint.
- **Validate inputs** at the boundary (voice/audioConfig shape) instead of `as any`.
- **Lock down abuse:** add an origin allowlist (the app's own domain) or a lightweight shared secret on `/api/tts*` and `/api/stt`; protect `DELETE /api/log-error`. These are open today (billing-abuse exposure).
- **Google is removed entirely at cutover** (owner decision). During the build, keep the Google `/api/tts` endpoint until Azure is validated end-to-end, then delete `api/tts.ts` + its `dev-server.js` mirror + the Google client/config. The **English section also moves to Azure `en-GB`** (no Google path remains). Web Speech stays as the sole runtime fallback.

### 9.2 Permission state machine (`SimplifiedAudioContext.tsx`)
- **Verify the unlock actually worked** instead of latching `isWorking=true` unconditionally on an empty utterance (current 122,130–137).
- **Recover from suspension:** if the `AudioContext` later suspends (iOS backgrounding), transition back to `needsUserAction` and re-prompt rather than silently producing no audio.
- **Desktop/Android prompt:** don't gate the prompt solely on `isIOS()`.
- **Collapse the controller↔context bridge:** the controller currently reaches React state through a mutable module global (`simplifiedAudioContextInstance`) and can call `initializeAudio()` out of band, racing the provider. Make the provider the single owner of permission state; the controller reads readiness through one clean accessor. Keep `isAudioReady`/`needsUserAction`/`initializeAudio` on the hook unchanged.
- Fix the dismiss-to-stuck gap (closing the modal lands in `needsUserAction=true, showPrompt=false` with no re-prompt path).

### 9.3 Logging (`remoteConsole.ts`) — DECIDED: fix bug + dev-only
- **Make logging dev-only / OFF in production** (owner decision — durable storage is explicitly NOT wanted). Gate `remoteConsole` so the console interception + `/api/log-error` POSTs only run on localhost/dev, not for end users.
- **Fix the relative-URL bug** (§9.1) so that any server-side errors that DO get logged in dev are actually recorded (absolute URL or in-process call).
- **Stop double-logging:** `logAudioIssue` both `console.error`s (→ intercepted → POST) and calls `addEnhancedError` (→ POST). One log per issue.
- The prod per-instance memory store in `log-error.ts` becomes moot once prod logging is off; leave the endpoint but it should receive ~no traffic. (No Vercel KV/Blob work.)

---

## 10. VoiceLab / override tools (throwaway — audition then remove)

The hidden `/voicelab` page, `VoiceOverridePanel` (the floating 🎙️), `src/config/voiceOverride.ts`, and `src/components/voicelab/` were built to audition Google voices. For this rebuild:
1. **Extend** VoiceLab to also synthesize through `/api/tts-azure` so the owner can audition Christel/Jeppe/multilingual **with the lexicon applied** on the fixed samples (numbers, 29 letters, 20 sentences incl. "Læs ordet", tricky stød/soft-d words).
2. Use it to (a) pick the Azure voice and (b) build/tune the lexicon defect list (§8).
3. **After the voice + lexicon are locked**, delete `/voicelab`, `VoiceOverridePanel`, `voiceOverride.ts`, the override branch in the engine, and `src/components/voicelab/` (per the voicelab PRD teardown).

---

## 11. Environment & config

- Env vars: `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` are **already set** in `.env.local` and Vercel Production+Development (region `westeurope`); add to Vercel **Preview** (pending). `AZURE_LEXICON_URI` (public PLS URL) to be added in Phase 2.
- Update `shared-tts-config.js` to hold the Azure default voice (the chosen da-DK voice — Christel lead), the Azure `en-GB` voice for the English section, output format (`ogg-24khz-16bit-mono-opus`), and speaking rate; keep it the single source (move the `backup`/`male`/`english` voice definitions out of `googleTTS.ts` into the shared config). Remove Google-specific voice config at cutover.
- Keep `src/config/tts-config.ts` as the thin typed re-export.

---

## 12. Implementation phases

1. **Backend first (Azure endpoint + bug fix).** Add `api/tts-azure.ts` + dev-server mirror (shared core; UTF‑8 SSML + `charset=utf-8` header per §0). Support both da-DK and `en-GB` voices (English moves to Azure). Fix the relative-URL log bug in all handlers. Add input validation + origin lock. Verify with `curl` that Christel/Jeppe/multilingual + the en-GB voice return audio, and that an SSML body with `<phoneme>` + `<lexicon>` works for da-DK. (Run both dev servers in Windows PowerShell — launching Vite from WSL breaks `/api`.) ✅ Christel + inline IPA already verified (§0).
2. **Lexicon.** Author + host the da-DK PLS file; wire `AZURE_LEXICON_URI` into the SSML. Confirm a known-bad word (e.g. `hund` vs `hun`, letter `Z`) is corrected.
3. **New playback engine.** Build the clean engine (§5) behind the controller; delete the old `playAudioFromData`/`synthesizeAndPlay`/iOS ladder. Keep the controller's public methods.
4. **Permission refactor (§9.2).** Behind the unchanged hook API.
5. **Cache + logging fixes (§7, §9.3).**
6. **VoiceLab audition (§10).** Owner picks the final da-DK voice (Christel/Jeppe/multilingual) + the en-GB voice + finalizes the lexicon.
7. **English → Azure.** Repoint `speakEnglish` to the chosen Azure `en-GB` voice; verify the English section.
8. **Cutover.** Make Azure the default for all sections; **delete** the Google `/api/tts` endpoint + dev mirror + Google client/config; turn prod logging off; remove the voicelab tools; update `shared-tts-config.js`.

Each phase should leave the app working (the hook API never changes), so phases can ship independently.

---

## 13. Verification (definition of done)

- `npm run build` (tsc + Vite) and `npm run lint` pass (no NEW errors vs the pre-existing baseline).
- Every game still plays audio with **no code changes to game components** — alphabet letters, math numbers (as Danish words), ordleg words, English section, memory, colors, comparison, welcome messages, success/encouragement.
- **Correctness:** the owner's defect-list letters/words/sentences are audibly correct via the lexicon; `hund` ≠ `hun`; letter `Z`/`W`/`Q` correct; "Læs ordet" and "rødgrød med fløde" sound right.
- **Engine correctness:** a clip longer than 5s plays fully without a spurious "timeout" error; cancelling audio (fast tapping / navigation) never logs an error; no overlapping/double audio; app launch never disables audio for 30s.
- **iOS:** audio works on the deployed iPad build after a single user gesture; if the context suspends, a re-prompt recovers it.
- **English section** plays via the Azure `en-GB` voice (Google fully removed).
- **Logging:** prod logging is OFF (no `/api/log-error` traffic from end users); in dev, a forced server-side error is actually recorded (relative-URL bug fixed).
- **Cost/abuse:** endpoints reject foreign origins (or require the secret); F0 usage stays within free tier.
- **Google fully removed:** `git grep -i "googleTTS\|/api/tts\b\|Wavenet\|Chirp"` shows no remaining Google TTS code paths; `api/tts.ts` + its dev mirror + Google client/config deleted; `/voicelab` + override tools removed.

---

## 14. Open questions (resolve during implementation)

Resolved already: F0 resource created (key valid); da-DK IPA `<phoneme>` works (§0); logging = dev-only (no durable storage); Google removed entirely + English→Azure; audition step retained.

Remaining:
1. Does Azure's da-DK IPA set cover all needed Danish distinctions — in particular the **stød** marker `ˀ` (e.g. `hunˀ`)? §0 verified `sɛd`; re-test stød specifically with a proper UTF‑8 body during Phase 2 against the defect list.
2. Single-character grapheme matching in the lexicon for letter NAMES — does it work, or do we need a controller-side Danish letter-name map (§8)?
3. Which `en-GB` Azure voice best matches the current English-section feel (Sonia/Ryan/other)? Decide in the audition (Phase 6).

---

## 15. Teardown of this effort's scaffolding
After cutover: remove `/voicelab`, `VoiceOverridePanel`, `src/config/voiceOverride.ts`, `src/components/voicelab/`, the Google `/api/tts` endpoint (and its dev mirror) if fully replaced, and any override branches in the engine. Keep `api/tts-azure.ts`, the lexicon, the new engine, the refactored permission/cache/logging, the hook API, the games, and `useSpeechInput`.
