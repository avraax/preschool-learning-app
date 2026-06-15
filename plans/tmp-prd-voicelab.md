# PRD: VoiceLab — hidden Danish TTS voice comparison page

> **Status:** Ready to implement in a fresh session.
> **Type:** Throwaway internal tool (deleted after a voice is chosen). No child-facing changes.

---

## 1. Context & goal

Every spoken line in the app is narrated by **one** Google voice — `da-DK-Wavenet-F`
(defined in `shared-tts-config.js`), chosen ~1 year ago. The owner is not satisfied with how
Danish **numbers, letters, and some phrases** are pronounced; **`"Læs ordet"`** has sounded
off since launch.

Google has since released much newer Danish voices **on the same `/api/tts` endpoint the app
already uses** (Neural2, Chirp-HD, ~30 Chirp3-HD). The browser's native Web Speech Danish voice
is also free. The goal is a **hidden `/voicelab` page** where the owner can listen to every
free Danish voice (male + female) reading a fixed set of Danish samples, and pick the best one
— then a follow-up change swaps the production voice.

**Scope decisions (already made by owner):**
- **Free only**, zero new accounts/keys → **Google (all `da-DK` tiers) + browser Web Speech**.
  (Azure, Polly, ElevenLabs, OpenAI, Cartesia, Acapela were researched and excluded — see §7.)
- **Both genders.**
- **Unlisted route `/voicelab`**, off every menu.
- **No tuning sliders** — fixed samples played at the app's current `audioConfig`
  (`speakingRate 0.8`, `pitch 1.1`) so it reflects what the child actually hears.

---

## 2. How the existing audio system works (read before building)

- TTS goes through `src/services/googleTTS.ts` → `POST /api/tts` (Vercel serverless, `api/tts.ts`;
  mirrored in `dev-server.js` for local dev).
- **`/api/tts` already accepts a per-request `voice` and `audioConfig` override** (see `api/tts.ts`:
  `voice: voice || TTS_CONFIG.voice`). So **any Google `da-DK` voice name works with zero backend
  change** — just POST a different `voice.name`.
- Voice/config defaults live in `shared-tts-config.js` (imported by both client and server).
- The app's normal path wraps text in **SSML** via `createChildFriendlySSML()` (adds pauses,
  `say-as` for numbers, emphasis for letters). **VoiceLab must NOT use this** — see §5.
- Centralized audio rules (`.claude/rules/audio-system.md`) forbid audio outside
  `SimplifiedAudioController`. **VoiceLab is an explicit, documented exception**: it is a
  disposable internal test page that needs to drive arbitrary voice names the controller doesn't
  model. Keep its player fully self-contained in the VoiceLab folder; do not touch production
  audio code.

---

## 3. Route & files

- Add a **lazy** route `/voicelab` in `src/App.tsx`, next to the other lazy routes.
- **Do NOT** add it to `HomePage` or any `*Selection` menu. It is reachable only by URL.
- New folder `src/components/voicelab/`:
  - `VoiceLab.tsx` — the page (UI + self-contained player + voice catalog + samples).
  - (optional) `voicelabData.ts` — the voice catalog + sample arrays, if it keeps `VoiceLab.tsx` tidy.
- PWA is already network-only (no offline precache, per `CLAUDE.md`) so no service-worker change is
  needed. If trivial, set `<meta name="robots" content="noindex">` while on the page.

---

## 4. Voice catalog (show grouped by tier; badge the current voice; label gender)

All `da-DK` Google voices (hard-code this list):

| Tier | Voice name | Gender |
|------|-----------|--------|
| Standard | `da-DK-Standard-F` | F |
| Standard | `da-DK-Standard-G` | M |
| WaveNet | `da-DK-Wavenet-F` | F **← current ("Nuværende")** |
| WaveNet | `da-DK-Wavenet-G` | M |
| Neural2 | `da-DK-Neural2-F` | F |
| Chirp-HD | `da-DK-Chirp-HD-F` | F |
| Chirp-HD | `da-DK-Chirp-HD-O` | F |
| Chirp-HD | `da-DK-Chirp-HD-D` | M |
| Chirp3-HD | see below (~30 voices) | F/M |

**Chirp3-HD voices** (newest, LLM-based, most natural). Show a **curated default shortlist**, with
a "Vis alle Chirp3-HD" expander for the rest:

- Default shortlist — Female: `Achernar`, `Aoede`, `Kore`, `Leda`, `Sulafat`, `Zephyr`
- Default shortlist — Male: `Charon`, `Fenrir`, `Puck`, `Orus`, `Umbriel`, `Algenib`
- Full list (prefix each with `da-DK-Chirp3-HD-`):
  - Female: Achernar, Aoede, Autonoe, Callirrhoe, Despina, Erinome, Gacrux, Kore, Laomedeia,
    Leda, Pulcherrima, Sulafat, Vindemiatrix, Zephyr
  - Male: Achird, Algenib, Algieba, Alnilam, Charon, Enceladus, Fenrir, Iapetus, Orus, Puck,
    Rasalgethi, Sadachbia, Sadaltager, Schedar, Umbriel, Zubenelgenubi
  - (If a name 404s from the API, drop it — the authoritative list is at
    https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types )

**Web Speech voices:** at runtime, `speechSynthesis.getVoices().filter(v => v.lang.startsWith('da'))`
and list whatever the device has (handle the async `voiceschanged` event — voices are often empty
on first call). Label them e.g. "Enhed: <voice.name>".

---

## 5. Playback (self-contained, single-audio)

**Plain text for ALL voices — no SSML.** Reasons: Chirp-HD/Chirp3-HD **reject SSML**, and plain
text gives a fair apples-to-apples comparison of raw voice quality.

- **Google voices:**
  ```
  POST /api/tts
  { text, isSSML: false,
    voice: { languageCode: 'da-DK', name, ssmlGender },
    audioConfig: { ...TTS_CONFIG.audioConfig } }   // rate 0.8, pitch 1.1
  ```
  Play the returned `audioContent` (base64) via **one shared `HTMLAudioElement`**. Stop/replace the
  previous audio before starting a new one (mirror the app's no-queue, single-audio behavior).
- **Web Speech voices:** `SpeechSynthesisUtterance` with `lang='da-DK'`, `voice = <picked>`,
  `rate = 0.8`, `pitch = 1.1`. Call `speechSynthesis.cancel()` before each utterance.
- **A/B compare:** each sample item has a secondary "↔ Nuværende" button that replays the **same
  text** with `da-DK-Wavenet-F` so the owner can hear before/after instantly.
- Replays are fast thanks to the endpoint's existing 24h HTTP cache.
- Show a small "spiller…" / loading state per tap; surface errors inline (don't crash the page).

---

## 6. Sample content (fixed; Danish)

Four segments selectable via a segmented control: **[Tal] [Bogstaver] [Sætninger] [Svære ord]**.

1. **Tal** — digits `"0"` … `"20"` sent as plain text (the da-DK voice reads them in Danish).
   Plus a "Svære tal" row: `21, 30, 50, 55, 70, 90, 99, 100` (tests
   *enogtyve / halvtreds / halvfjerds / halvfems*).
2. **Bogstaver** — all 29 letters as single plain characters:
   `A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Æ Ø Å`
   (watch C, Q, W, X, Y, Z, Æ, Ø, Å).
3. **Sætninger** — exactly these 20 (includes **`Læs ordet`** + hard Danish sounds):
   1. Læs ordet
   2. Stav ordet
   3. Sig et ord
   4. Find bogstavet
   5. Find tallet
   6. Hvad er to plus tre?
   7. Fem minus to er lig med tre.
   8. Hvilket tal er størst?
   9. Godt klaret! Du er så dygtig.
   10. Prøv igen, du kan det!
   11. Hej! Skal vi lege og lære?
   12. Find alle de røde ting.
   13. Træk æblet hen i kurven.
   14. Bland farverne og lav en ny farve.
   15. Du fandt alle parrene! Fantastisk!
   16. Kan du finde bogstavet ø?
   17. Lad os tælle til tyve sammen.
   18. Bjørnen spiser søde røde æbler.
   19. Rødgrød med fløde smager dejligt.
   20. Hunden og katten leger i haven.
4. **Svære ord** — Ordleg easiest-word pool + stød/soft-d minimal pairs:
   `is, ko, ged, kat, hund, sol, bil, æg, ål, øre, mus, ny`, and
   `hun, mor, mad, gade, bid, ned, tør` (compare `hund` vs `hun`).

---

## 7. Researched-but-excluded options (for the record)

- **Free *tier*, needs a key (excluded — owner wants no setup):** Azure (`da-DK-ChristelNeural`,
  `da-DK-JeppeNeural` + new HD voices, F0 free tier); Amazon Polly (`Sofie` neural, 12-mo AWS free tier).
- **Not free for app use:** ElevenLabs (best naturalness, no usable free API), OpenAI
  `gpt-4o-mini-tts` (English-optimized), Cartesia Sonic, Acapela (the historic Danish children's-voice
  specialist — enterprise licensing only).
- Aggregator sites (Fliki, SpeechGen, Murf, Notevibes, ttsMP3) just resell the engines above; free to
  listen, no free integration API.

These can be revisited later if the free Google voices don't satisfy — adding one means a new
serverless endpoint + key, on the same pattern as `api/tts.ts`.

---

## 8. UI notes
- Comic Sans MS, ≥44px touch targets, reuse existing child-app styling/theme tokens where cheap.
- Layout: voice picker (grouped list with tier + F/M + "Nuværende" badge) sets the **active voice**;
  the segment grid below plays the tapped sample with the active voice; each item also has the
  "↔ Nuværende" A/B button.
- Keep it simple and functional — this page is thrown away after the decision.

---

## 9. Applying the winner (follow-up change, after the owner picks)

- **WaveNet / Neural2 / Standard winner:** drop-in — change only `voice.name` in
  `shared-tts-config.js`. SSML pipeline (`createChildFriendlySSML`) and `pitch` keep working.
- **Chirp-HD / Chirp3-HD winner:** these **ignore SSML and `pitch`**. Must:
  - Bypass `createChildFriendlySSML()` for the chosen voice (send plain text); and
  - Speak numbers as Danish **words** via the existing `getDanishNumberText()`
    (`src/config/danish-phrases.ts`) instead of relying on SSML `say-as`.
  - Verify `speakingRate` still applies (it does for Chirp); accept natural pitch.
- Free-tier limits are far above this app's tiny + cached volume → effectively free either way.

---

## 10. Verification (definition of done)
- `npm run dev` (run **both** dev servers in Windows PowerShell — launching Vite from WSL breaks
  `/api`), open `http://localhost:5173/voicelab`.
- Voice picker lists every Google tier (F + M) and any device Web Speech Danish voice.
- All four segments play; **Chirp3-HD voices play** (proves the plain-text path).
- "↔ Nuværende" A/B replays the same text with `da-DK-Wavenet-F`.
- `Læs ordet` and `rødgrød med fløde` are audibly comparable across voices.
- `/voicelab` is in **no** menu; `npm run build` and `npm run lint` pass.

---

## 11. Teardown
Throwaway. After a voice is chosen and applied (§9), delete the `/voicelab` route from `App.tsx`
and remove `src/components/voicelab/`.
