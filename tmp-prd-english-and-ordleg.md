# PRD: Two New Sections — Engelsk (English) & Ordleg (Word Games + Speech)

**Date:** 2026-06-13
**Author context:** Planned interactively; to be implemented in a later session.
**Child context:** Son is ~5, confident Danish reader/counter for his age (counts to 60–70, adds to 20, knows all letters, reads simple Danish words). Now getting curious about **English** as a *total beginner* with *some* passive exposure (occasional shows/songs). He uses the app on **iPad (Safari)** and **desktop/laptop (Chrome)**.
**Constraints (unchanged from prior PRD):** NO adaptive difficulty, NO level selection, NO progression systems. All games static difficulty, manually tuned via future Claude sessions. Danish for all UI/instructions. Comic Sans MS, min 44px touch targets, full-viewport no-scroll layouts.

This PRD defines **two new top-level sections**:
1. **Engelsk** — beginner English learning (green theme).
2. **Ordleg** — Danish word games (teal theme): the existing **Stav Ordet** game *moves here*, plus a brand-new **microphone "say a word"** game (the app's first speech-*input* feature).

---

## Architecture primer (how sections are wired today — read first)

Confirmed by reading the codebase:

- **`src/config/categoryThemes.ts`** is the single source of truth for each section's theme + game list. Each section is a `CategoryTheme` with `name`, `gradient`, `accentColor`, `borderColor`, `hoverBorderColor`, `icon`, `iconSize`, `description`, and a `games[]` array (`{ id, title, emoji, route, gradient }`).
- **Selection screens are data-driven.** e.g. `MathSelection.tsx` is literally:
  ```tsx
  <GameSelectionLayout categoryId="math" games={categoryThemes.math.games} />
  ```
  So adding games to a section = adding entries to its `games[]` array. (This is why the prior PRD's Minus Opgaver / Stav Ordet entries already show in their menus — they were added to `categoryThemes`.)
- **The Home screen is NOT data-driven.** `HomePage` in `src/App.tsx` (~lines 88–650) renders each section card as a **hardcoded JSX block** (alphabet, math, colors), each referencing `categoryThemes.<id>.*` and an `onClick={() => navigate('/<id>')}`. **Adding a root section requires adding a new card block here.** There are currently **3 cards**; this PRD adds **2 more (→ 5)** — verify the home grid/layout handles 5 cards responsively in portrait + landscape.
- **Routes** live in `src/App.tsx` (`<Routes>`, ~line 850+).
- **Audio** is centralized — see `.claude/rules/audio-system.md`. Components use `useAudio()`; new audio capabilities are added as methods on `AudioController`. Never call TTS/Web Speech/Howler directly in components.
- **TTS endpoints already accept a per-request `voice` + `audioConfig`** (`api/tts.ts` line 62/79–83 and `dev-server.js` line 44/52–56: `voice: voice || TTS_CONFIG.voice`). So English audio needs **no backend change** — only a client path to request an `en-GB` voice.
- **Two API runtimes must stay in sync:** `api/*.ts` (Vercel serverless, prod) and `dev-server.js` (local Express, dev). Any new endpoint must be added to **both**.

---

## Prerequisites & current repo state (read before starting)

**Repo state when this PRD was written (2026-06-13):** The prior PRD's work (`tmp-prd-game-upgrades.md`) is **uncommitted on `master`** — difficulty upgrades, plus `SubtractionGame.tsx` and `SpellingGame.tsx` (the latter currently at route **`/alphabet/spelling`**, registered in `categoryThemes.alphabet.games`). Start from the current working tree, not a clean checkout. Stav Ordet will be **relocated** to `/ordleg/spelling` by this PRD (Part 2.1).

**Google Cloud setup (REQUIRED for the speech game — do this first):**
- The project already has **Text-to-Speech** enabled. **Speech-to-Text is a separate API** — enable the **Cloud Speech-to-Text API** in the same GCP project (`gcloud services enable speech.googleapis.com`, or via Console).
- Ensure the existing service account (the one in `GOOGLE_CLOUD_*` env vars / `.env.local`) has a role permitting STT, e.g. **`roles/speech.client`** (or it already works under the broad role it uses for TTS — verify, don't assume).
- No new credentials/env vars are needed beyond confirming the above; STT reuses `GOOGLE_CLOUD_PROJECT_ID` / `GOOGLE_CLOUD_CLIENT_EMAIL` / `GOOGLE_CLOUD_PRIVATE_KEY(_BASE64)`.
- For privacy (children's app), opt out of STT data logging (note: may carry a price surcharge).

**Local dev environment (Windows) — avoid a known time-sink:**
- Run **both** servers from **Windows PowerShell**, in two terminals: `npm run dev:api` (Express API, port 3001) and `npm run dev` (Vite, port 5173, proxies `/api` → `127.0.0.1:3001`).
- **Do NOT launch `npm run dev` from a WSL/Ubuntu shell.** If Vite runs in WSL while the API runs on Windows, they're in different network namespaces and every `/api/*` call returns **502** (Vite-in-WSL can't reach `127.0.0.1:3001` on Windows). Tell-tale: Vite prints a `10.255.255.254` Network URL (WSL) instead of the real LAN IP. Both terminals must be native Windows PowerShell.
- **Mic testing requires a secure context.** `localhost` is secure (dev OK). To test the speech game on the **actual iPad**, you need HTTPS — use a Vercel preview deploy (preferred) or an HTTPS tunnel; plain `http://<LAN-IP>:5173` will have `navigator.mediaDevices` undefined on the iPad. And test in **installed-PWA standalone mode**, not just the Safari tab (see Part 3.4 risks).

---

# PART 1 — Engelsk (English Section)

**Section id:** `english`
**Route base:** `/english`
**Danish section name:** `Engelsk`
**Theme color:** **Green** (distinct from alphabet=blue, math=purple, colors=orange). Suggested palette below.
**Teaching language:** **Danish instructions** — the app speaks/explains in Danish; only the *target word* is English. (e.g. "Tryk på hunden — på engelsk hedder den *dog*.")
**Target-word display:** Show the **written English word** (text) alongside picture + audio. Reading exposure is wanted.
**English accent:** **British (en-GB)**. Use a clear, child-friendly female `en-GB` voice (e.g. `en-GB-Neural2-A` or `en-GB-Wavenet-A` — implementer picks the warmest; keep it female to match the Danish `da-DK-Wavenet-F`).

### 1.1 Vocabulary (keep super simple — ~8–10 words per theme)

Themes in scope: **First words** (animals, food, everyday objects), **Numbers 1–10**, **Colors**, **Greetings & phrases**.

Each entry needs: English word, Danish translation (for Danish→English game + instructions), emoji/picture. Draft lists (implementer may finalize/swap for clearer emoji):

```ts
// Animals
[ {en:'dog', da:'hund', emoji:'🐕'}, {en:'cat', da:'kat', emoji:'🐱'}, {en:'fish', da:'fisk', emoji:'🐟'},
  {en:'bird', da:'fugl', emoji:'🐦'}, {en:'cow', da:'ko', emoji:'🐄'}, {en:'horse', da:'hest', emoji:'🐴'},
  {en:'pig', da:'gris', emoji:'🐷'}, {en:'duck', da:'and', emoji:'🦆'}, {en:'bear', da:'bjørn', emoji:'🐻'},
  {en:'lion', da:'løve', emoji:'🦁'} ]

// Food
[ {en:'apple', da:'æble', emoji:'🍎'}, {en:'banana', da:'banan', emoji:'🍌'}, {en:'milk', da:'mælk', emoji:'🥛'},
  {en:'bread', da:'brød', emoji:'🍞'}, {en:'egg', da:'æg', emoji:'🥚'}, {en:'cheese', da:'ost', emoji:'🧀'},
  {en:'water', da:'vand', emoji:'💧'}, {en:'cake', da:'kage', emoji:'🍰'}, {en:'ice cream', da:'is', emoji:'🍦'},
  {en:'cookie', da:'småkage', emoji:'🍪'} ]

// Everyday objects
[ {en:'ball', da:'bold', emoji:'⚽'}, {en:'car', da:'bil', emoji:'🚗'}, {en:'book', da:'bog', emoji:'📖'},
  {en:'chair', da:'stol', emoji:'🪑'}, {en:'bed', da:'seng', emoji:'🛏️'}, {en:'cup', da:'kop', emoji:'☕'},
  {en:'shoe', da:'sko', emoji:'👟'}, {en:'hat', da:'hat', emoji:'🎩'}, {en:'door', da:'dør', emoji:'🚪'},
  {en:'key', da:'nøgle', emoji:'🔑'} ]

// Numbers 1–10
[ {en:'one', da:'en', n:1}, {en:'two', da:'to', n:2}, {en:'three', da:'tre', n:3}, {en:'four', da:'fire', n:4},
  {en:'five', da:'fem', n:5}, {en:'six', da:'seks', n:6}, {en:'seven', da:'syv', n:7}, {en:'eight', da:'otte', n:8},
  {en:'nine', da:'ni', n:9}, {en:'ten', da:'ti', n:10} ]

// Colors
[ {en:'red', da:'rød', hex:'#E53935'}, {en:'blue', da:'blå', hex:'#1E88E5'}, {en:'green', da:'grøn', hex:'#43A047'},
  {en:'yellow', da:'gul', hex:'#FDD835'}, {en:'orange', da:'orange', hex:'#FB8C00'}, {en:'purple', da:'lilla', hex:'#8E24AA'},
  {en:'pink', da:'lyserød', hex:'#EC407A'}, {en:'black', da:'sort', hex:'#212121'}, {en:'white', da:'hvid', hex:'#FAFAFA'},
  {en:'brown', da:'brun', hex:'#6D4C41'} ]

// Greetings & phrases (~8)
[ {en:'hello', da:'hej'}, {en:'goodbye', da:'farvel'}, {en:'thank you', da:'tak'}, {en:'please', da:'vær så venlig'},
  {en:'yes', da:'ja'}, {en:'no', da:'nej'}, {en:'good morning', da:'godmorgen'}, {en:'good night', da:'godnat'} ]
```

> Store as a typed module, e.g. `src/config/englishVocab.ts`.

### 1.2 Games (4 — all map to existing patterns)

All are **task-based** quizzes except Explore (learning-based). Follow `.claude/rules/game-development.md`. **Reuse `UnifiedQuizGame`** (`src/components/common/UnifiedQuizGame.tsx`) — verified reusable for these:
- **Question side:** it already supports `questionVisual?: { emoji, word }` (added during the prior PRD's alphabet word-association work) — use it to show the picture/word prompt.
- **Answer options:** each option renders `item.display` (string/number). For **picture answers** (Lyt og Find), set `display` to the **emoji** — it renders fine as a large glyph. For **word answers** (Find det Engelske Ord / Dansk til Engelsk), set `display` to the English word text.
- **GAP to close — prompt language:** `UnifiedQuizGame` currently speaks `audioPrompt` through the **Danish** audio path. The English games need the *target word* spoken in **en-GB**. Add an opt-in to the quiz config (e.g. `promptLanguage?: 'da-DK' | 'en-GB'`, or a `speakPrompt` override callback) so English prompts route through `AudioController.speakEnglish()` (Part 1.3) while Danish instruction text stays `da-DK`. This is the one real extension `UnifiedQuizGame` needs; everything else is config.

| Game | Danish title | Route | Pattern | Description |
|---|---|---|---|---|
| **A. Listen & match** | `Lyt og Find` | `/english/listen` | Task quiz | App speaks an English word (en-GB). Child taps the matching **picture** from 4 options. Pure listening comprehension. Danish prompt: "Hvad hørte du? Tryk på det rigtige billede." |
| **B. Picture → English word** | `Find det Engelske Ord` | `/english/word` | Task quiz | Show a picture. Child picks the correct **written English word** from 4 options. Early English reading. Danish prompt + the English option words shown as text. |
| **C. Danish → English** | `Dansk til Engelsk` | `/english/translate` | Task quiz | Show/speak a Danish word he knows (+emoji). Child picks the **English** equivalent (text + audio on tap). Bridges from native language. |
| **D. Explore / learn** | `Lær Engelsk` | `/english/learn` | Learning | Browse cards freely: picture + English word (text) + tap-to-hear (en-GB) + optional Danish translation. Mirrors `AlphabetLearning`/`NumberLearning`. |

Common rules for the quiz games:
- 4 answer options, static difficulty, no progression.
- Danish instruction/feedback audio; English only for the target word.
- Reuse `CelebrationEffect`, `LottieCharacter`, score chip, and an English-themed `RepeatButton` variant (green).
- Full-viewport no-scroll layout per `.claude/rules/responsive-design.md`.

### 1.3 English audio (en-GB) — the one client change needed

Backend already supports per-request voice. Per audio rules, add a method to `AudioController` (do NOT call TTS directly in components):

```ts
// AudioController.ts — new method
async speakEnglish(text: string): Promise<string> {
  return this.queueAudio(async () => {
    /* same guard/permission flow as speak(), but pass an en-GB voice + en-GB audioConfig
       to googleTTS.synthesizeAndPlay so the request voice overrides TTS_CONFIG.voice */
  })
}
```
- Expose via `useAudio()` (e.g. `audio.speakEnglish('dog')`).
- Define the en-GB voice constant centrally (e.g. extend `shared-tts-config.js` with an `EN_VOICE` block, or pass an explicit `voice` object). Keep `da-DK` as the default for all existing Danish audio.
- Caching: the existing TTS cache keys on text — ensure the cache key also incorporates voice/language so `"dog"` (en-GB) and any Danish homograph don't collide. **Verify/extend the cache key in `googleTTS.ts` to include voice name.** (Important correctness check.)

---

# PART 2 — Ordleg (Word Games + Speech Section)

**Section id:** `ordleg`
**Route base:** `/ordleg`
**Danish section name:** `Ordleg`
**Theme color:** **Teal** (suggested palette below).
**Contents:** (1) **Stav Ordet** (moved here), (2) **new microphone game**.

### 2.1 Move Stav Ordet into Ordleg

Currently `Stav Ordet` lives under Alphabet: `categoryThemes.alphabet.games` has `{ id:'spelling', route:'/alphabet/spelling' }`, component `src/components/alphabet/SpellingGame.tsx`, route in `App.tsx`.

Changes:
1. **Remove** the `spelling` entry from `categoryThemes.alphabet.games`.
2. **Add** it to the new `categoryThemes.ordleg.games` with route **`/ordleg/spelling`** (teal gradient).
3. **Move the file** `src/components/alphabet/SpellingGame.tsx` → `src/components/ordleg/SpellingGame.tsx` (new folder), update its import path in `App.tsx`, and re-theme its colors blue→teal (it currently uses `AlphabetRepeatButton`; introduce/use an `OrdlegRepeatButton` teal variant).
4. **Update the route** in `App.tsx`: `/alphabet/spelling` → `/ordleg/spelling`. (Optional: keep a redirect from the old path; not required since it was never released.)
5. Update **`CLAUDE.md`** route table accordingly.

> Note: this is a relocation, not a rewrite. Keep the game's behavior identical.

### 2.2 NEW GAME — Microphone "Say a Word" (Danish speech input)

**Working Danish title:** `Sig et Ord` *(alternatives to consider: "Den Magiske Mikrofon", "Hvad Siger Du?")*
**Route:** `/ordleg/mic` (or `/ordleg/sig-et-ord`)
**Component:** `src/components/ordleg/SpeakWordGame.tsx`

This is the app's **first speech-input feature**. It is **open-vocabulary**: the child says *any* Danish word; the app recognizes it, shows it, reads it back, and spells it.

#### Gameplay flow
1. **Idle "magic mic" screen:** big mic button + friendly character inviting him to speak. No prompt word (open vocabulary). Danish: e.g. "Sig et ord, så staver jeg det for dig!"
2. **Hold to talk:** he **presses and holds** the mic button while speaking, **releases** to send. (Pointer events — works on iPad + desktop.)
3. **Recognize:** audio → Google Cloud STT (Danish) → transcript.
4. **If multiple words / a sentence:** use **only the first word**.
5. **If nothing recognized** (silence/noise/unclear/low confidence): **friendly retry** — character says e.g. *"Det hørte jeg ikke helt – prøv igen!"* and re-enables the mic. No failure feeling.
6. **On success:**
   - **Show the recognized Danish word as text** (large, Comic Sans).
   - **Read it back** via TTS (da-DK).
   - **Spell it out:** each letter appears on screen **one-by-one** while the Danish **letter sound** plays (reuse the per-letter audio approach from Stav Ordet), then say the whole word again.
   - Celebration effect.
7. Return to idle for the next word.

#### UX / behavior details
- **Recording trigger:** hold-to-talk. Start capture on `pointerdown` (this *is* the user gesture iOS requires for `getUserMedia`), stop on `pointerup`/`pointercancel`/`pointerleave` (handle all three so a finger sliding off still stops). Call `e.preventDefault()` to suppress the iOS long-press callout menu.
- **Max-duration safety cap:** auto-stop at **~5 s** (single words need 3–5 s; also caps cost at the 15-s billing floor and prevents a stuck button recording forever). **Min duration ~300–500 ms** to ignore accidental taps.
- **Visual while recording:** clear "listening" state (pulsing mic / simple animation). No "Lytter…" full-screen takeover — keep UI present per game rules.
- **Spelling visuals:** "Word text + letters" — show the full recognized word as text, then animate letters building up with per-letter audio.
- **Release mic tracks** (`track.stop()`) after each utterance so the iOS mic indicator clears and audio output routing isn't held.

---

# PART 3 — Speech-to-Text Technical Implementation (the new capability)

> Engine decision: **Google Cloud Speech-to-Text**, reusing the existing Google Cloud project/service-account credentials (same env vars as TTS). Chosen because it gives **consistent Danish recognition on iPad Safari AND Chrome** — browser Web Speech API is unreliable for Danish on iOS Safari.

### 3.1 Recognition API & model
- **Use Speech-to-Text v2** with the **`@google-cloud/speech` v2 client** (`SpeechClient` from the `.v2` namespace). Add dependency `@google-cloud/speech`.
- **Key enabler:** use **`autoDecodingConfig` (AutoDetectDecodingConfig)** — it auto-detects container/codec from the file header and supports **both `WEBM_OPUS` (Chrome) and `MP4_AAC` (Safari)**. → **One server pipeline, zero client transcoding.** Do NOT set `encoding`/`sampleRateHertz` when using auto-decode.
- **Model:** `short` (v2's short-utterance model) — best fit for single "hold to talk" words. Optionally evaluate `chirp_2` later if children's-speech accuracy needs improvement.
- **Language:** `languageCodes: ['da-DK']` (v2 uses an **array**, not `languageCode`).
- **Region constraint (HARD):** Danish is **not served from `global`**. Use a **regional recognizer**:
  - `short` model → location **`eu`**, client `apiEndpoint: 'eu-speech.googleapis.com'`.
  - (`chirp_2` would be `europe-west4` if chosen instead.)
  - Recognizer path: `projects/${PROJECT_ID}/locations/eu/recognizers/_` (trailing `_` = inline default recognizer; no need to pre-create one).
- **Avoid** `latest_short` / `latest_long` — those are v1 names and are **not listed as supported for Danish**.

Conceptual server request shape (reference, not final code):
```ts
import speech from '@google-cloud/speech';             // package: @google-cloud/speech
const { SpeechClient } = speech.v2;                    // MUST use the .v2 namespace (not the default v1)
const client = new SpeechClient({ apiEndpoint: 'eu-speech.googleapis.com', credentials: {...} });
const [resp] = await client.recognize({
  recognizer: `projects/${PROJECT_ID}/locations/eu/recognizers/_`,
  config: { autoDecodingConfig: {}, languageCodes: ['da-DK'], model: 'short' },
  content: audioBytes,            // Buffer from uploaded blob
});
const transcript   = resp.results?.[0]?.alternatives?.[0]?.transcript ?? '';
const confidence   = resp.results?.[0]?.alternatives?.[0]?.confidence ?? 0;
```

### 3.2 New endpoint `/api/stt` — add to BOTH runtimes
- **Vercel:** `api/stt.ts` mirroring `api/tts.ts` (same credential init from `GOOGLE_CLOUD_*` env vars, CORS, POST-only, error logging to `/api/log-error`). Set `export const config = { runtime: 'nodejs', maxDuration: 15 }`.
- **Local dev:** add an `app.post('/api/stt', ...)` handler to `dev-server.js` (Express on 3001; Vite proxies `/api` → `127.0.0.1:3001`).
- **Request:** the recorded audio blob + its `blob.type` (mime). Either multipart/form-data or base64 JSON (match the app's existing style — TTS uses JSON; base64 is simplest to keep consistent, but note 1MB `express.json` limit in `dev-server.js` — a 5 s Opus/AAC clip is tens of KB, well under, but **bump the limit if needed**).
- **Response:** `{ transcript, confidence }`. On low confidence / empty transcript, the **client** decides "friendly retry" (or return a flag).
- **Privacy:** for a children's app, **opt out of data logging** on the STT requests (note: this can carry a price surcharge). Document in the env/setup notes.

### 3.3 Client capture pipeline
1. On mic-button `pointerdown` (user gesture): `navigator.mediaDevices.getUserMedia({ audio: true })`.
2. Pick mime via `MediaRecorder.isTypeSupported` in order `['audio/webm;codecs=opus', 'audio/mp4']` (Chrome → webm/opus, Safari → mp4/aac).
3. Record; collect chunks; on `pointerup` stop, assemble `Blob`, `track.stop()`.
4. POST blob + `blob.type` to `/api/stt`.
5. Handle response → success flow or friendly retry.
- **Per audio rules**, the *playback* side (read-back + spelling) goes through `AudioController`/`useAudio`. The *capture* side is new — encapsulate it in a dedicated hook/util (e.g. `useSpeechInput.ts` / `src/utils/SpeechRecorder.ts`). It does not play audio, so it sits beside (not inside) the AudioController, but must coordinate: **stop/await any AudioController playback before recording** to avoid the TTS feeding into the mic.

### 3.4 Permissions & platform risks (must test on real iPad)
- **Secure context required.** `localhost` counts as secure (dev OK without TLS); Vercel is HTTPS (prod OK).
- **iOS Safari:** call `getUserMedia` **synchronously inside the pointerdown gesture handler**.
- **PWA standalone risk (FLAG):** this app is an installed PWA. WebKit has long-standing bugs where `getUserMedia` misbehaves in **home-screen / standalone** mode (WebKit bugs 185448, 252465). **Must test mic specifically in installed-PWA mode on iPad**, not just the Safari tab. Have a graceful fallback message if `getUserMedia` rejects.
- **Audio routing:** starting mic capture on iOS can force output to the built-in speaker; relevant because we play TTS right after. Releasing tracks after each utterance mitigates lingering effects.
- **iOS version check:** verify the current shipping iOS doesn't carry a `getUserMedia` regression (one was reported in an iOS 26.1 beta: `No AVAudioSessionCaptureDevice`). Test on the actual device/OS.

### 3.5 Cost
- STT standard v2: ~**$0.016/min**, billed in 15-s increments → each short utterance ≈ **$0.004**. First **60 min/month free** (~240 utterances). For one child, effectively free. Data-logging opt-out may add ~40% to the per-minute rate.

**Sources:** Google Cloud STT v2 [supported languages](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages), [encoding/decoding](https://docs.cloud.google.com/speech-to-text/docs/encoding), [v2 RPC ref](https://docs.cloud.google.com/speech-to-text/docs/reference/rpc/google.cloud.speech.v2), [pricing](https://cloud.google.com/speech-to-text/pricing); [WebKit MediaRecorder](https://webkit.org/blog/11353/mediarecorder-api/); [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia); WebKit PWA mic bugs [185448](https://bugs.webkit.org/show_bug.cgi?id=185448), [252465](https://bugs.webkit.org/show_bug.cgi?id=252465). *(Verify the live da-DK/region price line and current iOS behavior at build time.)*

---

# PART 4 — Routes, Navigation & Home Screen

### 4.1 New routes (`src/App.tsx`)
```tsx
// English
<Route path="/english" element={<EnglishSelection />} />
<Route path="/english/listen" element={<EnglishListenGame />} />
<Route path="/english/word" element={<EnglishWordGame />} />
<Route path="/english/translate" element={<EnglishTranslateGame />} />
<Route path="/english/learn" element={<EnglishLearning />} />

// Ordleg
<Route path="/ordleg" element={<OrdlegSelection />} />
<Route path="/ordleg/spelling" element={<SpellingGame />} />   {/* moved from /alphabet/spelling */}
<Route path="/ordleg/mic" element={<SpeakWordGame />} />
```
Remove the old `<Route path="/alphabet/spelling" .../>`.

### 4.2 Selection wrappers (mirror `MathSelection.tsx`)
```tsx
// EnglishSelection.tsx
<GameSelectionLayout categoryId="english" games={categoryThemes.english.games} />
// OrdlegSelection.tsx
<GameSelectionLayout categoryId="ordleg" games={categoryThemes.ordleg.games} />
```

### 4.3 Home screen cards (`HomePage` in `src/App.tsx`)
Add **two new hardcoded section card blocks** (copy an existing block, e.g. the colors one) for `english` and `ordleg`, each `onClick={() => navigate('/english')}` / `navigate('/ordleg')` and referencing `categoryThemes.english.*` / `categoryThemes.ordleg.*`.
- **Layout:** home goes from 3 → 5 cards. **Verify the grid is responsive** in portrait + landscape on iPad and desktop (per responsive rules). Likely need to adjust the home grid column counts.

### 4.4 `categoryThemes.ts` — add two sections + move spelling
```ts
english: {
  id: 'english', name: 'Engelsk',
  gradient: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 50%, #A5D6A7 100%)',
  accentColor: '#2E7D32', borderColor: '#66BB6A', hoverBorderColor: '#2E7D32',
  icon: '🇬🇧', iconSize: '6rem',
  description: 'Lær dine første engelske ord med billeder og lyd',
  games: [
    { id:'listen',    title:'Lyt og Find',           emoji:'👂', route:'/english/listen',    gradient:'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)' },
    { id:'word',      title:'Find det Engelske Ord', emoji:'🔤', route:'/english/word',      gradient:'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)' },
    { id:'translate', title:'Dansk til Engelsk',     emoji:'🔁', route:'/english/translate', gradient:'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)' },
    { id:'learn',     title:'Lær Engelsk',           emoji:'📚', route:'/english/learn',     gradient:'linear-gradient(135deg, #388E3C 0%, #1B5E20 100%)' },
  ],
},
ordleg: {
  id: 'ordleg', name: 'Ordleg',
  gradient: 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 50%, #80CBC4 100%)',
  accentColor: '#00796B', borderColor: '#4DB6AC', hoverBorderColor: '#00796B',
  icon: '🗣️', iconSize: '6rem',
  description: 'Stav ord og sig ord højt med din stemme',
  games: [
    { id:'spelling', title:'Stav Ordet', emoji:'✏️',  route:'/ordleg/spelling', gradient:'linear-gradient(135deg, #26A69A 0%, #00897B 100%)' },
    { id:'mic',      title:'Sig et Ord',  emoji:'🎤',  route:'/ordleg/mic',      gradient:'linear-gradient(135deg, #00897B 0%, #00695C 100%)' },
  ],
},
```
And **remove** the `spelling` entry from `alphabet.games`.

### 4.5 `CLAUDE.md` route table
Add:
```
/english                 English section menu
/english/listen          Listen & match (audio→picture)
/english/word            Picture → English word
/english/translate       Danish → English match
/english/learn           Explore English words
/ordleg                  Ordleg section menu
/ordleg/spelling         Stav Ordet (moved from /alphabet/spelling)
/ordleg/mic              Sig et Ord (microphone game)
```
Remove `/alphabet/spelling`.

---

# PART 5 — Theming Summary

| Section | id | Danish name | Color | accentColor |
|---|---|---|---|---|
| Alphabet | alphabet | Alfabetet | Blue | `#1976D2` (existing) |
| Math | math | Tal og Regning | Purple | `#9C27B0` (existing) |
| Colors | colors | Farver | Orange | `#E65100` (existing) |
| **English** | **english** | **Engelsk** | **Green** | `#2E7D32` |
| **Ordleg** | **ordleg** | **Ordleg** | **Teal** | `#00796B` |

Add matching `RepeatButton` variants: `EnglishRepeatButton` (green), `OrdlegRepeatButton` (teal) in `src/components/common/RepeatButton.tsx`. Consider routing exact shades through the `child-ui-designer` agent during implementation if desired.

---

# PART 6 — Architecture Rules (mandatory)

- **Audio:** centralized only. New playback (English en-GB, read-back, per-letter spelling) → methods on `AudioController`, exposed via `useAudio()`. See `.claude/rules/audio-system.md`. Speech *capture* is new — isolate in a hook/util, coordinate with AudioController (don't record while TTS plays).
- **Games:** task-based games use `entryAudioManager.onComplete()`, show full UI immediately, use `RepeatButton`, disable until `entryAudioComplete`. The mic game is a new sub-pattern (speech input) — still no loading-screen takeovers. See `.claude/rules/game-development.md`.
- **Layout:** full-viewport, no-scroll, CSS Grid, 44px+ touch targets, portrait + landscape. See `.claude/rules/responsive-design.md`.
- **State:** local React state only. **Language:** all UI/instructions Danish. **Type:** TS strict. **Font:** Comic Sans MS.

---

# PART 7 — Open Questions / Risks to resolve during implementation

1. **iPad PWA mic** — biggest risk. Must test `getUserMedia` in installed standalone mode, not just Safari tab. Have a fallback.
2. **TTS cache key** must include voice/language once English (en-GB) is added — otherwise English/Danish audio could collide. Verify in `googleTTS.ts`.
3. **Open-vocabulary spelling of special characters** — recognized words with æ/ø/å must spell correctly with the existing per-letter Danish audio (Stav Ordet already handles æøå; reuse it).
4. **First-word extraction** — define "first word" (split on whitespace; strip punctuation STT may add).
5. **Confidence threshold** for "friendly retry" vs accept — tune on the device.
6. **Home grid** must look good with 5 section cards (currently designed for 3).
7. **en-GB voice selection** — pick the warmest child-friendly female voice; confirm it's available (Neural2/Wavenet/Studio tier) and not deprecated.
8. **STT data-logging opt-out** for a children's app (privacy) + the price implication.

---

# PART 8 — Suggested Execution Order

1. **Scaffolding:** add `english` + `ordleg` to `categoryThemes.ts`; add green/teal `RepeatButton` variants; add the two home cards + verify 5-card grid.
2. **Move Stav Ordet** → `ordleg` (file move, route `/ordleg/spelling`, re-theme teal). Verify it still works.
3. **English audio path:** add `AudioController.speakEnglish()` + `useAudio` exposure + en-GB voice config + cache-key fix.
4. **English games** (D Explore first as it's simplest, then A → B → C). Build vocab module `englishVocab.ts`.
5. **STT backend:** `api/stt.ts` + `dev-server.js` `/api/stt`; add `@google-cloud/speech`; test with a hardcoded sample blob.
6. **Speech capture util/hook** (`useSpeechInput`) — hold-to-talk, mime detection, POST to `/api/stt`. Test on Chrome, then **iPad Safari + installed PWA**.
7. **Sig et Ord game** — wire capture → recognize → first-word → show text → read back → spell (reuse Stav Ordet per-letter audio) → celebrate; friendly-retry path.
8. **Routes + CLAUDE.md + final responsive pass** on iPad and desktop.

Steps 1–4 are mostly pattern-following (lower risk). Steps 5–7 are the genuinely new speech capability (higher risk — budget testing time on the iPad).

---

# Appendix A — Mandatory patterns (condensed, so this PRD is self-contained)

> These are the actionable essentials of `.claude/rules/audio-system.md`, `game-development.md`, and `responsive-design.md`. Those files are the canonical source (and auto-load in this repo); this appendix lets the PRD stand alone.

### A.1 Audio system
- **All audio goes through the centralized 3-tier system. No exceptions.** `AudioController` singleton (`src/utils/AudioController.ts`) → `useAudio()` hook (`src/hooks/useAudio.ts`) → `GlobalAudioPermission` (session permission modal) + `entryAudioManager` (game-entry audio). Stack: Google Cloud TTS (primary) → Web Speech API (fallback) → Howler.js (SFX).
- **Never:** create audio code outside the system; call Web Speech/Howler/HTML5 Audio directly in components; create component-level `isPlaying`/audio state; bypass the AudioController queue.
- **Always:** use `useAudio()` in components; add new audio capabilities as **methods on `AudioController`**, exposed via `useAudio`; route everything through the queue.
- **Component pattern:**
  ```ts
  const audio = useAudio({ componentId: 'MyGame' })
  await audio.speak('Hej børn!'); await audio.speakNumber(5); await audio.playSuccessSound()
  ```
- **Adding a method** (e.g. `speakEnglish`, `speakLetter`): wrap body in `this.queueAudio(async () => { this.updateUserInteraction(); const ok = await this.checkAudioPermission(); if (!ok) return; await this.googleTTS.synthesizeAndPlay(text, 'primary', true) })`, then export through `useAudio`.
- Navigation cleanup is automatic (`NavigationAudioCleanup` in `App.tsx`). Permission is session-based/automatic; iOS Safari 10s interaction timeout is handled in `AudioController`.

### A.2 Game development
- **Two game types.** *Task-based* (quiz/problem): use `entryAudioManager.onComplete()`. *Learning-based* (exploration, e.g. the English "Lær Engelsk" browse): direct audio on tap, no entry coordination.
- **Task-based required pattern:**
  ```ts
  const [entryAudioComplete, setEntryAudioComplete] = useState(false)
  useEffect(() => {
    entryAudioManager.onComplete('gameType', () => {
      setEntryAudioComplete(true)
      setTimeout(() => generateNewProblem(), 500)
    })
  }, [])
  // Render full UI immediately: <AppBar> always visible; <Button disabled={!entryAudioComplete}>Gentag</Button>;
  // content via conditional rendering: {options.length > 0 ? options.map(...) : null}
  ```
- **Strict rules:** show full UI immediately — **no loading overlays / "Lytter…" screens**; register `entryAudioManager.onComplete()` directly (do NOT use a `useTaskBasedGame` hook); use the right `RepeatButton` variant; disable repeat until `entryAudioComplete`; use conditional content rendering; no intermediate states.
- **RepeatButton variants** (`src/components/common/RepeatButton.tsx`): `MathRepeatButton` (purple), `AlphabetRepeatButton` (blue), `ColorRepeatButton` (orange). **This PRD adds `EnglishRepeatButton` (green) + `OrdlegRepeatButton` (teal).**
- **Theming:** `import { getCategoryTheme } from '../config/categoryThemes'` → `getCategoryTheme('english' | 'ordleg' | ...)`.

### A.3 Responsive design / layout
- **Every game layout fills the screen with NO scrolling, in portrait AND landscape.**
- **Layout skeleton:**
  ```tsx
  <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <AppBar sx={{ flex: '0 0 auto' }} />
    <Container sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ flex: 1, display: 'grid', gridAutoRows: 'minmax(0, 1fr)', gap: { xs: '8px', md: '12px' } }}>
        {/* content */}
      </Box>
    </Container>
  </Box>
  ```
- **Grid:** CSS Grid with dynamic sizing, never fixed dimensions; responsive columns by orientation/size (e.g. `gridTemplateColumns: { xs: 'repeat(6,1fr)', sm: 'repeat(8,1fr)', md: 'repeat(10,1fr)' }`); `gridAutoRows: 'minmax(0,1fr)'`; add `'@media (orientation: landscape)'` column overrides.
- **Aspect ratios:** quiz cards 4:3 (min 80px / max 120px); memory cards 3:4; action buttons 3:2–4:3 (min 44px); display cards 1:1–4:3. When using aspect ratios set `gridAutoRows: 'auto'`.
- **Typography:** `clamp()` (e.g. `fontSize: 'clamp(1rem, 3.5vw, 1.5rem)'`), adjust for landscape. **Touch targets ≥ 44px.**
- **Don'ts:** no fixed heights (`height: 200px`); no breakpoints without orientation queries; no small touch targets; no layouts needing scroll. Reference implementation: `src/components/common/LearningGrid.tsx`.
