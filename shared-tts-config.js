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

  // Speaking rate as an Azure <prosody rate> multiplier (1.0 = natural). Tuned slow for kids.
  speakingRate: 0.9,

  // voiceType → Azure voice. Danish lead voice is Christel (auditioned in /voicelab; not yet
  // final). `male` uses Jeppe. English section uses an en-GB neural voice.
  voices: {
    primary: { name: 'da-DK-ChristelNeural', lang: 'da-DK' },
    backup:  { name: 'da-DK-ChristelNeural', lang: 'da-DK' },
    male:    { name: 'da-DK-JeppeNeural', lang: 'da-DK' },
    english: { name: 'en-GB-SoniaNeural', lang: 'en-GB' },
  },
};
