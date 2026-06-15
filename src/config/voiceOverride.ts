// Runtime TTS voice override — THROWAWAY internal tool (see tmp-prd-voicelab.md).
//
// Lets the owner audition a shortlist of Danish voices + a speaking-rate inside the real
// games via a small popover (VoiceOverridePanel). When set, googleTTS swaps the Danish
// "primary" voice app-wide. Persisted to localStorage so it survives reloads and is picked
// up by googleTTS on construction. Removed once a production voice is chosen.

export interface VoiceOverride {
  /** Full Google voice name, e.g. 'da-DK-Chirp3-HD-Sulafat'. */
  name: string
  ssmlGender: 'FEMALE' | 'MALE'
  /** Google speakingRate (0.25–2.0). */
  speakingRate: number
}

const KEY = 'voicelab_voice_override'

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

/** Chirp voices reject SSML and the `pitch` parameter — send plain text, drop pitch. */
export function isChirpVoice(name: string): boolean {
  return name.includes('Chirp')
}
