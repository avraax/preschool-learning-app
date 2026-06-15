// VoiceLab data — voice catalog + fixed Danish samples.
//
// THROWAWAY internal tool (see tmp-prd-voicelab.md). Lists every free Danish voice
// so the owner can audition them against fixed samples, then pick a production voice.
// Deleted once a voice is chosen.

export type Gender = 'F' | 'M'

export interface VoiceEntry {
  /** Full Google voice name, e.g. 'da-DK-Wavenet-F'. */
  name: string
  /** Short display label (the part after the tier prefix). */
  label: string
  gender: Gender
  /** Google ssmlGender to send in the per-request voice override. */
  ssmlGender: 'FEMALE' | 'MALE'
  /** The production voice today → badge as "Nuværende". */
  current?: boolean
  /** Chirp3-HD only: part of the curated default shortlist (rest behind an expander). */
  shortlist?: boolean
}

export interface VoiceTier {
  /** Tier display name. */
  tier: string
  voices: VoiceEntry[]
}

const g = (name: string, label: string, gender: Gender, extra: Partial<VoiceEntry> = {}): VoiceEntry => ({
  name,
  label,
  gender,
  ssmlGender: gender === 'F' ? 'FEMALE' : 'MALE',
  ...extra,
})

/** The current production default voice (Sulafat @ speakingRate 0.90, set in shared-tts-config.js)
 *  — also the A/B ("↔ Nuværende") reference and the override panel's reset target. */
export const CURRENT_VOICE: VoiceEntry = g('da-DK-Chirp3-HD-Sulafat', 'Sulafat', 'F', { current: true })

/** Previous default (before Sulafat) — kept selectable in the tools for comparison. */
export const PREVIOUS_VOICE: VoiceEntry = g('da-DK-Wavenet-F', 'Wavenet-F', 'F')

// Chirp3-HD full lists (prefix da-DK-Chirp3-HD-). Shortlist names get shortlist:true.
const CHIRP3_FEMALE = [
  'Achernar', 'Aoede', 'Autonoe', 'Callirrhoe', 'Despina', 'Erinome', 'Gacrux', 'Kore',
  'Laomedeia', 'Leda', 'Pulcherrima', 'Sulafat', 'Vindemiatrix', 'Zephyr',
]
const CHIRP3_MALE = [
  'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Charon', 'Enceladus', 'Fenrir', 'Iapetus',
  'Orus', 'Puck', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Umbriel', 'Zubenelgenubi',
]
const CHIRP3_SHORTLIST = new Set([
  'Achernar', 'Aoede', 'Kore', 'Leda', 'Sulafat', 'Zephyr', // F
  'Charon', 'Fenrir', 'Puck', 'Orus', 'Umbriel', 'Algenib', // M
])

const chirp3 = (chirpName: string, gender: Gender): VoiceEntry =>
  g(`da-DK-Chirp3-HD-${chirpName}`, chirpName, gender, {
    shortlist: CHIRP3_SHORTLIST.has(chirpName),
    current: chirpName === 'Sulafat', // current app default → badge in the catalog
  })

export const VOICE_TIERS: VoiceTier[] = [
  {
    tier: 'Standard',
    voices: [g('da-DK-Standard-F', 'Standard-F', 'F'), g('da-DK-Standard-G', 'Standard-G', 'M')],
  },
  {
    tier: 'WaveNet',
    voices: [PREVIOUS_VOICE, g('da-DK-Wavenet-G', 'Wavenet-G', 'M')],
  },
  {
    tier: 'Neural2',
    voices: [g('da-DK-Neural2-F', 'Neural2-F', 'F')],
  },
  // NOTE: the standalone "Chirp-HD" tier (Chirp-HD-F/O/D) from the PRD does NOT exist for
  // da-DK per Google's listVoices API — dropped (PRD §4: "if a name 404s, drop it").
  // Only the newer Chirp3-HD tier below is available.
  {
    tier: 'Chirp3-HD',
    voices: [
      ...CHIRP3_FEMALE.map((n) => chirp3(n, 'F')),
      ...CHIRP3_MALE.map((n) => chirp3(n, 'M')),
    ],
  },
]

/** In-app override popover shortlist: current default (Sulafat) + finalists + previous voice. */
export const OVERRIDE_SHORTLIST: VoiceEntry[] = [
  CURRENT_VOICE, // Sulafat (current default)
  g('da-DK-Chirp3-HD-Zephyr', 'Zephyr', 'F'),
  g('da-DK-Chirp3-HD-Orus', 'Orus', 'M'),
  g('da-DK-Chirp3-HD-Puck', 'Puck', 'M'),
  PREVIOUS_VOICE, // Wavenet-F (tidligere standard)
]

// ---- Fixed Danish samples ----------------------------------------------------

export interface SampleGroup {
  /** Optional sub-heading within a segment. */
  label?: string
  items: string[]
}

export interface SampleSegment {
  id: string
  label: string
  groups: SampleGroup[]
}

const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

export const SAMPLE_SEGMENTS: SampleSegment[] = [
  {
    id: 'tal',
    label: 'Tal',
    groups: [
      { label: '0–20', items: range(0, 20) },
      // Tests enogtyve / halvtreds / halvfjerds / halvfems.
      { label: 'Svære tal', items: ['21', '30', '50', '55', '70', '90', '99', '100'] },
    ],
  },
  {
    id: 'bogstaver',
    label: 'Bogstaver',
    groups: [
      { items: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Æ Ø Å'.split(' ') },
    ],
  },
  {
    id: 'saetninger',
    label: 'Sætninger',
    groups: [
      {
        items: [
          'Læs ordet',
          'Stav ordet',
          'Sig et ord',
          'Find bogstavet',
          'Find tallet',
          'Hvad er to plus tre?',
          'Fem minus to er lig med tre.',
          'Hvilket tal er størst?',
          'Godt klaret! Du er så dygtig.',
          'Prøv igen, du kan det!',
          'Hej! Skal vi lege og lære?',
          'Find alle de røde ting.',
          'Træk æblet hen i kurven.',
          'Bland farverne og lav en ny farve.',
          'Du fandt alle parrene! Fantastisk!',
          'Kan du finde bogstavet ø?',
          'Lad os tælle til tyve sammen.',
          'Bjørnen spiser søde røde æbler.',
          'Rødgrød med fløde smager dejligt.',
          'Hunden og katten leger i haven.',
        ],
      },
    ],
  },
  {
    id: 'svaere-ord',
    label: 'Svære ord',
    groups: [
      { label: 'Ordleg-pulje', items: ['is', 'ko', 'ged', 'kat', 'hund', 'sol', 'bil', 'æg', 'ål', 'øre', 'mus', 'ny'] },
      // stød / blødt-d minimalpar (sammenlign hund vs hun).
      { label: 'Stød / blødt d', items: ['hun', 'mor', 'mad', 'gade', 'bid', 'ned', 'tør'] },
    ],
  },
]
