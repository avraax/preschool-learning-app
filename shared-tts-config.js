// Shared TTS configuration for both development server and client
// This is a .js file so Node.js can import it directly
export const TTS_CONFIG = {
  // App default voice. Sulafat (Chirp3-HD) chosen over the original da-DK-Wavenet-F.
  // Chirp voices reject SSML + pitch, so googleTTS.ts auto-sends plain text and drops pitch
  // for any Chirp voice; numbers are already spoken as Danish words via getDanishNumberText().
  voice: {
    languageCode: 'da-DK',
    name: 'da-DK-Chirp3-HD-Sulafat',
    ssmlGender: 'FEMALE'
  },
  // British English voice for the Engelsk section. Warm, child-friendly female voice
  // to match the Danish da-DK-Wavenet-F. Sent as a per-request voice override so the
  // existing /api/tts endpoint needs no change.
  enVoice: {
    languageCode: 'en-GB',
    name: 'en-GB-Neural2-A',
    ssmlGender: 'FEMALE'
  },
  audioConfig: {
    audioEncoding: 'OGG_OPUS', // Better compatibility with iOS Safari PWA than MP3
    speakingRate: 0.9, // Tuned for Sulafat (0.25-2.0 scale)
    pitch: 1.1,        // Friendly tone — applied to non-Chirp voices only (Chirp ignores/rejects pitch)
    volumeGainDb: 0,
    sampleRateHertz: 24000
  }
};