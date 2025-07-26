// Shared TTS configuration for both development server and client
// This is a .js file so Node.js can import it directly
export const TTS_CONFIG = {
  voice: {
    languageCode: 'da-DK',
    name: 'da-DK-Wavenet-F',
    ssmlGender: 'FEMALE'
  },
  audioConfig: {
    audioEncoding: 'MP3',
    speakingRate: 0.8, // Slower speed for children (0.25-2.0 scale)
    pitch: 1.1,        // Slightly higher pitch for friendly tone
    volumeGainDb: 0,
    sampleRateHertz: 24000
  }
};