// VoiceLab data — Azure voice catalog + fixed Danish/English samples.
//
// THROWAWAY internal tool (see tmp-prd-audio-rebuild.md §10). Lets the owner audition the Azure
// Danish voices (Christel / Jeppe / multilingual) + the en-GB candidates against fixed samples,
// WITH the pronunciation lexicon applied, then lock the production voices. Deleted after lock.

export type Gender = 'F' | 'M'

export interface VoiceEntry {
  /** Full Azure voice name, e.g. 'da-DK-ChristelNeural'. */
  name: string
  /** Short display label. */
  label: string
  gender: Gender
  /** Azure voice locale, e.g. 'da-DK' / 'en-GB'. */
  lang: string
  /** The current lead/default → badge as "Nuværende". */
  current?: boolean
}

export interface VoiceTier {
  tier: string
  voices: VoiceEntry[]
}

const v = (name: string, label: string, gender: Gender, lang: string, extra: Partial<VoiceEntry> = {}): VoiceEntry => ({
  name,
  label,
  gender,
  lang,
  ...extra,
})

/** The current lead da-DK default (Christel) — also the A/B ("↔ Nuværende") reference. */
export const CURRENT_VOICE: VoiceEntry = v('da-DK-ChristelNeural', 'Christel', 'F', 'da-DK', { current: true })

export const VOICE_TIERS: VoiceTier[] = [
  {
    tier: 'Dansk (da-DK)',
    voices: [
      CURRENT_VOICE,
      v('da-DK-JeppeNeural', 'Jeppe', 'M', 'da-DK'),
    ],
  },
  {
    tier: 'Flersproget (taler da-DK)',
    voices: [
      v('en-US-AvaMultilingualNeural', 'Ava (multilingual)', 'F', 'da-DK'),
      v('en-US-AndrewMultilingualNeural', 'Andrew (multilingual)', 'M', 'da-DK'),
      v('de-DE-SeraphinaMultilingualNeural', 'Seraphina (multilingual)', 'F', 'da-DK'),
    ],
  },
  {
    tier: 'Engelsk (en-GB)',
    voices: [
      v('en-GB-SoniaNeural', 'Sonia', 'F', 'en-GB', { current: true }),
      v('en-GB-RyanNeural', 'Ryan', 'M', 'en-GB'),
      v('en-GB-LibbyNeural', 'Libby', 'F', 'en-GB'),
    ],
  },
]

/** In-app override popover shortlist: lead default + finalists for in-game auditioning. */
export const OVERRIDE_SHORTLIST: VoiceEntry[] = [
  CURRENT_VOICE, // Christel (lead default)
  v('da-DK-JeppeNeural', 'Jeppe', 'M', 'da-DK'),
  v('en-US-AvaMultilingualNeural', 'Ava (multilingual)', 'F', 'da-DK'),
  v('de-DE-SeraphinaMultilingualNeural', 'Seraphina (multilingual)', 'F', 'da-DK'),
]

// ---- Fixed samples ----------------------------------------------------------

export interface SampleGroup {
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
      { label: 'Svære tal', items: ['21', '30', '50', '55', '70', '90', '99', '100'] },
    ],
  },
  {
    id: 'bogstaver',
    label: 'Bogstaver',
    groups: [
      // The Danish letter NAMES the app actually speaks (controller getDanishLetterName).
      { label: 'Bogstavnavne', items: 'a be se de e ef ge hå i jåd kå el em en o pe ku er es te u ve dobbelt-ve eks y set æ ø å'.split(' ') },
      { label: 'Glyffer (rå)', items: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Æ Ø Å'.split(' ') },
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
  {
    id: 'engelsk',
    label: 'Engelsk',
    groups: [
      { label: 'English words', items: ['dog', 'cat', 'apple', 'red', 'blue', 'one', 'two', 'three', 'hello', 'thank you'] },
    ],
  },
]
