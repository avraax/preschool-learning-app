// Centralized Danish text and phrases for the preschool learning app
// This file contains all narrated text to avoid duplication and enable easy maintenance

export const DANISH_PHRASES = {
  // Success and celebration phrases. Iterated by the TTS prebake (prebake-tts.mjs) so the whole
  // set is synthesized ahead of time — this array is the canonical source of the spoken lines.
  success: [
    'Fantastisk!',
    'Godt!',
    'Super!',
    'Perfekt!',
    'Flot!',
    'Bravo!',
    'Fantastisk arbejde!',
    'Rigtig godt!',
    'Du er dygtig!',
    'Sådan!',
    'Dejligt!',
    'Vildt godt!',
    'Du kan det!',
    'Meget godt!',
    'Fremragende!'
  ],

  // Encouragement phrases for wrong answers (also prebaked, see above).
  encouragement: [
    'Prøv igen!',
    'Du kan det!',
    'Næsten der!',
    'Godt forsøg!',
    'Næsten der! Prøv igen!',
    'Godt forsøg! Du kan det!',
    'Det er okay. Prøv en gang til!',
    'Kom så! Du er så tæt på!',
    'Bare rolig!',
    'Du lærer hurtigt!',
    'Bliv ved!',
    'Prøv lige igen!'
  ],

  // Score announcements (SimplifiedAudioController.announceScore + prebake)
  score: {
    noPoints: 'Du har ingen point endnu',
    onePoint: 'Du har et point',
    multiplePoints: {
      prefix: 'Du har',
      suffix: 'point'
    }
  },

  // Game prompts and instructions
  gamePrompts: {
    findLetter: (letter: string) => `Find bogstavet ${letter}`,
    findNumber: (number: number) => `Find tallet ${number}`,
    mathQuestion: {
      prefix: 'Hvad er'
    }
  },

  // Math terminology (addition/subtraction narration)
  math: {
    plus: 'plus',
    minus: 'minus'
  },

  // Danish number pronunciations (0-100)
  numbers: {
    basic: {
      0: 'nul', 1: 'en', 2: 'to', 3: 'tre', 4: 'fire', 5: 'fem',
      6: 'seks', 7: 'syv', 8: 'otte', 9: 'ni', 10: 'ti',
      11: 'elleve', 12: 'tolv', 13: 'tretten', 14: 'fjorten', 15: 'femten',
      16: 'seksten', 17: 'sytten', 18: 'atten', 19: 'nitten', 20: 'tyve'
    },
    tens: {
      2: 'tyve', 3: 'tredive', 4: 'fyrre', 5: 'halvtreds',
      6: 'tres', 7: 'halvfjerds', 8: 'firs', 9: 'halvfems'
    },
    hundred: 'et hundrede'
  }
}

// Danish letter NAMES — the text speakLetter() sends for each glyph (PRD-11, owner-audited by ear).
// The old phonetic respellings (e.g. J:'jåd', Z:'set') were read wrong or as real words by neural
// Christel. It turns out the da-DK voice reads a BARE lowercase glyph as the correct modern Danish
// letter name for almost every letter — so the map is now the glyph itself, with only the letters
// that don't read right as a glyph keeping an explicit respelling (X:'eks', Z:'zæt'). Object.keys
// here is also the canonical 29-letter list the prebake/audit enumeration walks, so keep all 29.
export const DANISH_LETTER_NAMES: Record<string, string> = {
  A: 'a', B: 'b', C: 'c', D: 'd', E: 'e', F: 'f', G: 'g', H: 'h',
  I: 'i', J: 'j', K: 'k', L: 'l', M: 'm', N: 'n', O: 'o', P: 'p',
  Q: 'q', R: 'r', S: 's', T: 't', U: 'u', V: 'v', W: 'w',
  X: 'eks', Y: 'y', Z: 'zæt', Æ: 'æ', Ø: 'ø', Å: 'å',
}

/** Spoken Danish name for a letter; falls back to the glyph itself if not a known letter. */
export const getDanishLetterName = (letter: string): string => {
  const key = letter.trim().toUpperCase()
  return DANISH_LETTER_NAMES[key] ?? letter
}

// Function to convert numbers to Danish text
export const getDanishNumberText = (number: number): string => {
  const { basic, tens, hundred } = DANISH_PHRASES.numbers

  if (number <= 20) {
    return basic[number as keyof typeof basic] || number.toString()
  } else if (number < 100) {
    const tensDigit = Math.floor(number / 10)
    const onesDigit = number % 10

    if (onesDigit === 0) {
      return tens[tensDigit as keyof typeof tens] || number.toString()
    } else {
      const onesText = basic[onesDigit as keyof typeof basic]
      const tensText = tens[tensDigit as keyof typeof tens]
      return `${onesText}og${tensText}`
    }
  } else if (number === 100) {
    return hundred
  } else {
    return number.toString()
  }
}

export default DANISH_PHRASES
