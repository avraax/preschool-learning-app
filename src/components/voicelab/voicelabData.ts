// VoiceLab data — Azure voice catalog + fixed Danish/English samples.
//
// THROWAWAY internal tool (see tmp-prd-audio-rebuild.md §10). Lets the owner audition the Azure
// Danish voices (Christel / Jeppe / multilingual) + the en-GB candidates against fixed samples,
// WITH the pronunciation lexicon applied, then lock the production voices. Deleted after lock.

import { DANISH_LETTER_NAMES, getDanishLetterName } from '../../config/danish-phrases'

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
    // "Flersproget" heading already conveys multilingual — keep labels to the first name so the
    // override-panel rows don't wrap to two lines.
    tier: 'Flersproget (taler da-DK)',
    voices: [
      v('en-US-AvaMultilingualNeural', 'Ava', 'F', 'da-DK'),
      v('en-US-AndrewMultilingualNeural', 'Andrew', 'M', 'da-DK'),
      v('de-DE-SeraphinaMultilingualNeural', 'Seraphina', 'F', 'da-DK'),
    ],
  },
  {
    // English-section narration default is Ava (en-US multilingual, in the Flersproget tier above).
    // These en-GB voices remain available to audition.
    tier: 'Engelsk (en-GB)',
    voices: [
      v('en-GB-SoniaNeural', 'Sonia', 'F', 'en-GB'),
      v('en-GB-RyanNeural', 'Ryan', 'M', 'en-GB'),
      v('en-GB-LibbyNeural', 'Libby', 'F', 'en-GB'),
    ],
  },
]

/** In-app override popover: ALL VoiceLab voices, flattened, so the Danish narration voice can be
 *  switched live among every Azure candidate (grouped by tier in the panel via VOICE_TIERS). */
export const OVERRIDE_VOICES: VoiceEntry[] = VOICE_TIERS.flatMap((t) => t.voices)

// ---- Mascot tap-sound candidates --------------------------------------------
// The lower-left mascot spawns a theme burst on tap (bubbles/stars/leaves). We want ONE cute
// vocalization per mascot that matches its burst. Audition the candidates here, then lock one
// per mascot. Each mascot uses a fixed Azure voice + per-character pitch/rate so they sound
// distinct without recordings (pitch via the /api/tts-azure `pitch` param).

export interface MascotSound {
  id: string
  label: string
  /** What the tap spawns — so the chosen sound can match it. */
  burst: string
  voiceName: string
  lang: string
  /** Azure <prosody pitch> e.g. '+35%' / '-25%' → gives each mascot its own character. */
  pitch: string
  /** Azure <prosody rate> multiplier (1.0 = natural). */
  rate: number
  /** Candidate vocalizations — audition and pick one. */
  candidates: string[]
}

export const MASCOT_SOUNDS: MascotSound[] = [
  {
    id: 'octopus', label: 'Blæksprutte', burst: 'bobler',
    voiceName: 'da-DK-ChristelNeural', lang: 'da-DK', pitch: '+35%', rate: 1.05,
    candidates: ['Blub blub blub!', 'Svup!', 'Plask!', 'Bobbib bobbib!', 'Hihi, det kilder!', 'Boblebob!', 'Skvulp!', 'Pluf!', 'Blup blup!'],
  },
  {
    id: 'astronaut', label: 'Astronaut', burst: 'stjerner',
    voiceName: 'da-DK-ChristelNeural', lang: 'da-DK', pitch: '+20%', rate: 1.0,
    candidates: ['Stjernedrys!', 'Blinke-blink!', 'Op i rummet!', 'Bib-bib-boop!', 'Måne-hop!', 'Raket-start!', 'Stjerneregn!', 'Tjuhej, stjerner!'],
  },
  {
    id: 'bear', label: 'Bjørn (Regnbue)', burst: 'stjerner/gnister',
    voiceName: 'da-DK-ChristelNeural', lang: 'da-DK', pitch: '+25%', rate: 1.05,
    candidates: ['Knus!', 'Pyt-pyt, stjerner!', 'Krammebjørn!', 'Hokus pokus!', 'Glimmer-glimt!', 'Trylle-trylle!', 'Stjernekram!', 'Putte-bjørn!'],
  },
  {
    id: 'dino', label: 'Dinosaur', burst: 'blade',
    voiceName: 'da-DK-ChristelNeural', lang: 'da-DK', pitch: '+30%', rate: 1.05,
    candidates: ['Hop hop!', 'Nam-nam, blade!', 'Brøl!', 'Trip-trap!', 'Dino-dans!', 'Rumle-rumle!', 'Blade-fest!'],
  },
]

// ---- Real SFX candidates (CC-BY Google Sound Library, "cartoon" category) ----
// Audition real sound files per mascot in VoiceLab, then lock one (or a small list) each.
// Files live in public/sounds/mascots/<id>/ and play via a plain <audio> element.
// These are SHORT, cartoony, non-scary clips. Labels describe the ACTUAL sound (a pop is "Pop",
// not "bubbles") — so they're honest; relevance is a loose character vibe, not literal.

export interface MascotSfxFile {
  file: string // public URL under /sounds/mascots/<id>/
  label: string
}
export interface MascotSfx {
  id: string
  label: string
  burst: string
  files: MascotSfxFile[]
}

const sfx = (id: string, n: string, label: string): MascotSfxFile => ({
  file: `/sounds/mascots/${id}/${n}.ogg`,
  label,
})

export const MASCOT_SFX: MascotSfx[] = [
  {
    id: 'octopus', label: 'Blæksprutte', burst: 'bobler',
    files: [
      sfx('octopus', '01-pop', 'Pop'),
      sfx('octopus', '02-suction-pop', 'Suge-pop'),
      sfx('octopus', '03-boing', 'Boing'),
      sfx('octopus', '04-deflate', 'Luft-pift'),
      sfx('octopus', '05-rubber-squeak', 'Gummi-pip'),
      sfx('octopus', '06-duck-squeak', 'Ande-pip'),
      sfx('octopus', '07-balloon-inflate', 'Ballon-pust'),
      sfx('octopus', '08-flick', 'Flik'),
      sfx('octopus', '09-slide-whistle', 'Glidefløjte'),
      sfx('octopus', '10-bing', 'Bing'),
    ],
  },
  {
    id: 'astronaut', label: 'Astronaut', burst: 'stjerner',
    files: [
      sfx('astronaut', '01-ufo-zip', 'UFO-zip'),
      sfx('astronaut', '02-slide-up', 'Fløjte op'),
      sfx('astronaut', '03-slide-fall', 'Fløjte ned'),
      sfx('astronaut', '04-xylophone-up', 'Xylofon op'),
      sfx('astronaut', '05-wind-chimes', 'Vindklokker'),
      sfx('astronaut', '06-jingle', 'Bjælder'),
      sfx('astronaut', '07-wind-up-toy', 'Optræks-legetøj'),
      sfx('astronaut', '08-twang', 'Twang'),
      sfx('astronaut', '09-twang-high', 'Twang (høj)'),
      sfx('astronaut', '10-toy-whistle', 'Legetøjsfløjte'),
    ],
  },
  {
    id: 'dino', label: 'Dinosaur', burst: 'blade',
    files: [
      sfx('dino', '01-boing', 'Boing'),
      sfx('dino', '02-woodblock', 'Træblok'),
      sfx('dino', '03-woodblock2', 'Træblok 2'),
      sfx('dino', '04-bing', 'Bing'),
      sfx('dino', '05-metal-thunk', 'Metal-dunk'),
      sfx('dino', '06-spring', 'Fjeder-hop'),
      sfx('dino', '07-guitar-boing', 'Guitar-boing'),
      sfx('dino', '08-flick', 'Flik'),
      sfx('dino', '09-getting-stuck', 'Sjov anstrengelse'),
      sfx('dino', '10-hollow-wood', 'Hul træ-bank'),
    ],
  },
  {
    id: 'bear', label: 'Bjørn (Regnbue)', burst: 'stjerner/gnister',
    files: [
      sfx('bear', '01-pop', 'Pop'),
      sfx('bear', '02-boing', 'Boing'),
      sfx('bear', '03-duck-squeak', 'Ande-pip'),
      sfx('bear', '04-rubber-squeak', 'Gummi-pip'),
      sfx('bear', '05-wind-chimes', 'Vindklokker'),
      sfx('bear', '06-jingle', 'Bjælder'),
      sfx('bear', '07-xylophone-up', 'Xylofon op'),
      sfx('bear', '08-slide-up', 'Fløjte op'),
      sfx('bear', '09-spring', 'Fjeder-hop'),
      sfx('bear', '10-toy-whistle', 'Legetøjsfløjte'),
    ],
  },
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
      // The Danish letter NAMES the app actually speaks — read from the SINGLE source
      // (DANISH_LETTER_NAMES / getDanishLetterName) instead of a hand-copied list. The old literal
      // here still held the RETIRED phonetic respellings ('be se de … jåd … set'), so auditioning it
      // tested strings the app hasn't spoken since PRD-11.
      { label: 'Bogstavnavne', items: Object.keys(DANISH_LETTER_NAMES).map(getDanishLetterName) },
      { label: 'Glyffer (rå)', items: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Æ Ø Å'.split(' ') },
      // A/B candidates for the two letters the owner hears wrong (I and Z). The defect is the LETTER
      // inside a SENTENCE — the "{bogstav} som {ord}" / "{ord} starter med {bogstav}" templates
      // interpolate the RAW GLYPH, bypassing DANISH_LETTER_NAMES — so the candidates must be
      // auditioned in that exact context, not as bare glyphs. Pick the winner per letter, then wire
      // it into the templates' spelling override and re-run `npm run tts:prebake`.
      // Z: SETTLED — 'zet' won (now wired via spokenLetter in letterWords.ts). Kept so the winner can
      // be re-checked against the losers after a voice change.
      {
        label: 'Kandidater: Z i sætning',
        items: ['zet som Zebra', 'Z som Zebra', 'set som Zebra', 'zæt som Zebra', 'Zebra starter med zet'],
      },
      // I: SETTLED — 'I, som en is' won and is now wired via letterPhrase(). It took two fixes, each
      // exposing the next: the COMMA made the letter read as a name instead of the pronoun, which then
      // made Azure carry the "characters" reading into the next token and spell "Is" as I-S; the
      // indefinite ARTICLE + lowercase restored it to a noun (lowercase alone was not enough). Kept so
      // the winner can be re-checked against the losers after a voice change.
      {
        label: 'Kandidater: I + ordet',
        items: [
          'I, som is',
          'I, som en is',
          'I, som Is',
          'I, som is.',
          'I. Som is',
          'I, ligesom is',
        ],
      },
      // MINIMALITY check: RUN AND CLOSED. 'I, som en is' is the only line of 29 that deviates from the
      // "{bogstav} som {ord}" frame, so every shorter variant was hunted — including a LOWERCASE letter
      // (the theory being that characters-mode carry-over, not capitalisation, spells "Is" as I-S).
      // Owner verdict: none of these read correctly; the article is load-bearing. Kept as the record so
      // the experiment isn't repeated, and as a re-check set after a voice change.
      {
        label: 'Kandidater: I minimal (afvist)',
        items: ['i, som is', 'i, som Is', 'I, som is', 'i, som en is', 'I, som en is'],
      },
      // I, SENTENCE-FINAL position: still OPEN. Bogstav Quiz's correct-answer fact puts the letter
      // last ("Is starter med I"), where a trailing comma does nothing — so the lead fix doesn't
      // transfer. These try the equivalent isolation from the other side: a boundary BEFORE the
      // letter, an explicit "bogstavet" carrier, or trailing punctuation that may force phrase-final
      // lengthening. Pick a winner and it goes into startsWithPhrase().
      {
        label: 'Kandidater: I sidst (quiz-linjen)',
        items: [
          'Is starter med I',
          'Is starter med bogstavet I',
          'Is starter med, I',
          'Is starter med I.',
          'Is starter med ... I',
          'Is — den starter med I',
        ],
      },
      // R, SENTENCE-FINAL: OPEN, reported 2026-08-08 from the iPad. "Raket starter med R" is heard as
      // "Raket starter med er" — and "er" is a real Danish word, which is what makes this one worse
      // than a merely muddy letter: the sentence parses as something else entirely. Same mechanism as
      // I (final unstressed position reduces the letter name to a schwa), and the same asymmetry: R
      // is CORRECT in Lær Alfabetet, where letterPhrase puts it first and it gets full stress.
      //
      // The first item is the SHIPPING line (the control — it must sound wrong, or the diagnosis is
      // wrong), and the second is a diagnostic: if 'er' is indistinguishable from it, the reduction
      // hypothesis is confirmed and no respelling will help, only a phrasing change. 'R som Raket' is
      // the proven-correct browse line, i.e. the ruling already taken for I applied to R — it costs
      // the quiz's "first sound" frame, so it is the owner's call, not a default.
      {
        label: 'Kandidater: R sidst (quiz-linjen)',
        items: [
          'Raket starter med R',
          'Raket starter med er',
          'Raket starter med bogstavet R',
          'Raket starter med, R',
          'Raket starter med R.',
          'Raket starter med ... R',
          'Raket starter med ær',
          'R som Raket',
        ],
      },
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
