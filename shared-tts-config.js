// Shared TTS configuration for both the dev server and the client.
// This is a .js file so Node.js (dev-server.js, api/*) can import it directly,
// and the client reads it through the typed re-export in src/config/tts-config.ts.
//
// Provider: Azure AI Speech (single provider). Danish pronunciation is corrected via a
// hosted W3C PLS lexicon (public/da-DK.pls) + inline IPA <phoneme> — see shared-azure-tts.js.
export const TTS_CONFIG = {
  provider: 'azure',

  // Azure REST output format. Opus in an Ogg container is iOS-Safari friendly and small.
  // The client must label the data-URL to match: audio/ogg (see `mime`).
  outputFormat: 'ogg-24khz-16bit-mono-opus',
  mime: 'audio/ogg',

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
