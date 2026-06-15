// Typed re-export of the shared Azure TTS configuration (single source of voice truth).
import { TTS_CONFIG as Config } from '../../shared-tts-config.js'

export type VoiceType = 'primary' | 'backup' | 'male' | 'english'

export const TTS_CONFIG = {
  provider: Config.provider,
  outputFormat: Config.outputFormat,
  mime: Config.mime,
  speakingRate: Config.speakingRate,
  voices: Config.voices as Record<VoiceType, { name: string; lang: string }>,
}
