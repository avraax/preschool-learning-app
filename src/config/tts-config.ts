// Re-export the shared configuration with TypeScript types
import { TTS_CONFIG as Config } from '../../shared-tts-config.js';

// Add TypeScript type assertions
export const TTS_CONFIG = {
  voice: {
    ...Config.voice,
    ssmlGender: Config.voice.ssmlGender as 'FEMALE'
  },
  audioConfig: {
    ...Config.audioConfig,
    audioEncoding: Config.audioConfig.audioEncoding as 'OGG_OPUS'
  }
};