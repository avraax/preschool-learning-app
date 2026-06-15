// Runtime TTS voice override — THROWAWAY internal tool (see tmp-prd-audio-rebuild.md §10).
//
// Lets the owner audition Danish Azure voices + a speaking-rate inside the real games via the
// VoiceOverridePanel. When set, ttsClient swaps the da-DK voice app-wide. Persisted to
// localStorage so it survives reloads. Removed once the production voice is locked.

export interface VoiceOverride {
  /** Full Azure voice name, e.g. 'da-DK-ChristelNeural'. */
  name: string
  /** Azure <prosody rate> multiplier (1.0 = natural). */
  speakingRate: number
}

const KEY = 'voicelab_voice_override_v2'

export function loadVoiceOverride(): VoiceOverride | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.name === 'string' && typeof parsed.speakingRate === 'number') {
      return parsed as VoiceOverride
    }
  } catch {
    /* ignore malformed / unavailable storage */
  }
  return null
}

export function saveVoiceOverride(override: VoiceOverride | null): void {
  try {
    if (override) localStorage.setItem(KEY, JSON.stringify(override))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore unavailable storage */
  }
}
