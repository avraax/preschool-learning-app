// Shared TTS configuration for both the dev server and the client.
// This is a .js file so Node.js (dev-server.js, api/*) can import it directly,
// and the client reads it through the typed re-export in src/config/tts-config.ts.
//
// Provider: Azure AI Speech (single provider). Danish pronunciation is corrected via a
// hosted W3C PLS lexicon (public/da-DK.pls) + inline IPA <phoneme> — see shared-azure-tts.js.
export const TTS_CONFIG = {
  provider: 'azure',

  // Azure REST output format. **MP3, not Ogg/Opus** — Apple only added Ogg *container* support in
  // iOS/iPadOS 18.4, so every Ogg clip is undecodable on older iPads (an iPad Pro 2nd gen tops out
  // at 17.7 → the whole app went silent apart from the mp3 music bed). MP3 plays on every Safari.
  // Three things must agree: this format, the `mime` used for the data-URL label, and `fileExt`
  // (the prebaked file extension in public/sounds/tts/) — see prebake-tts.mjs.
  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  mime: 'audio/mpeg',
  fileExt: 'mp3',

  // Speaking rate as an Azure <prosody rate> multiplier (1.0 = natural). Slightly above natural.
  speakingRate: 1.05,

  // voiceType → Azure voice. Danish narration (most of the app) uses Christel; `male` uses Jeppe.
  // English section narration uses Ava (en-US multilingual). The VoiceOverridePanel can swap the
  // Danish narration voice live among all VoiceLab voices for auditioning.
  voices: {
    primary: { name: 'da-DK-ChristelNeural', lang: 'da-DK' },
    backup:  { name: 'da-DK-ChristelNeural', lang: 'da-DK' },
    male:    { name: 'da-DK-JeppeNeural', lang: 'da-DK' },
    english: { name: 'en-US-AvaMultilingualNeural', lang: 'en-US' },
  },
};

// THE LEXICON FILENAME IS VERSIONED, AND THE VERSION MUST BE BUMPED WHENEVER THE FILE CHANGES.
//
// `vercel.json` serves it with `Cache-Control: public, max-age=86400`, and Azure fetches the lexicon
// BY URL and honours that — caching per PATH and ignoring the query string, so `?v=<now>` does not
// bust it (measured 2026-09-05). Editing the file in place therefore leaves Azure reading a
// day-stale copy, and it fails SILENTLY: the SSML is valid, synthesis succeeds, the old
// pronunciation just comes back.
//
// It produced a MIXED prebake once: adding the `fire` lexeme and re-baking gave 16 of 125 clips the
// new pronunciation and 109 the old, because only Azure nodes with no cached copy fetched the new
// file. Five identical-IPA probe files served from fresh PATHS all applied instantly, which is what
// isolated the cache from the lexeme.
//
// So this is the same discipline as a content-hashed asset: change the file, change the name. The
// long max-age is CORRECT for an immutable URL — it is only wrong for a mutable one.
export const LEXICON_FILE = 'da-DK-v2.pls';
