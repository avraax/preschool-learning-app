// Centralized Danish text and phrases for the preschool learning app
// This file contains all narrated text to avoid duplication and enable easy maintenance

export const DANISH_PHRASES = {
  // Success and celebration phrases - expanded variety as requested
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

  // Encouragement phrases for wrong answers
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

  // Score announcements
  score: {
    noPoints: 'Du har ingen point endnu',
    onePoint: 'Du har et point',
    multiplePoints: {
      prefix: 'Du har',
      suffix: 'point'
    }
  },

  // Position announcements in learning sequences
  position: {
    template: (itemType: 'tal' | 'bogstav', currentNumber: number, total: number) => 
      `Du er ved ${itemType} nummer ${currentNumber} af ${total}`
  },

  // Game prompts and instructions
  gamePrompts: {
    findLetter: (letter: string) => `Find bogstavet ${letter}`,
    findNumber: (number: number) => `Find tallet ${number}`,
    mathQuestion: {
      prefix: 'Hvad er',
      addition: (num1: number, num2: number) => `Hvad er ${num1} plus ${num2}`
    },
    comparison: {
      largest: 'Hvilket tal er størst?',
      smallest: 'Hvilket tal er mindst?'
    }
  },

  // Math terminology
  math: {
    plus: 'plus',
    minus: 'minus',
    equals: 'er lig med'
  },

  // Game completion and special moments
  completion: {
    memoryGameSuccess: 'Fantastisk! Du fandt alle parene!',
    greeting: 'Hej!'
  },

  // UI text that gets narrated
  ui: {
    clickNumber: 'Klik på tallet! 👆',
    findAnswer: 'Find svaret! 🤔'
  },

  // Game descriptions
  descriptions: {
    alphabet: {
      learn: 'Find det rigtige bogstav du hører',
      memory: 'Find par af bogstaver (40 kort)'
    },
    math: {
      counting: 'Find det rigtige tal du hører (1-30)',
      memory: 'Find par af tal (40 kort)'
    },
    colors: {
      hunt: 'Find alle røde ting og træk dem til cirklen!',
      mixing: 'Bland farver for at lave nye farver!',
      rainbow: 'Byg din egen regnbue! Klik på farver for at tilføje dem.',
      memory: 'Find par af farver (40 kort)'
    }
  },

  // Color game specific phrases
  colorGames: {
    // Success phrases specifically for correct color items (cycles through 5)
    correctItem: [
      'Fremragende',
      'Perfekt', 
      'Fantastisk',
      'Super',
      'Godt klaret'
    ],
    // Wrong color item phrases
    wrongColor: {
      template: (itemName: string) => `Nej, ${itemName} er ikke rød. Prøv igen!`
    },
    // Game completion
    allItemsFound: 'Fantastisk! Du fandt alle røde ting!',
    // Game start
    welcomeColorHunt: 'Find alle røde ting og træk dem til cirklen!'
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
  },

  // Commonly preloaded phrases for performance
  preload: [
    'Godt klaret!',
    'Prøv igen!',
    'Du kan det!',
    'Næsten der!',
    'Godt forsøg!',
    'plus',
    'minus',
    'er lig med'
  ]
}

// Danish letter NAMES. speakLetter() sends these (not the bare glyph) so the spoken letter is
// deterministic and locale-correct regardless of how the TTS engine handles single graphemes
// (PRD §8 — controller-side map is the safe option vs. relying on lexicon grapheme matching).
// The owner can refine any of these via VoiceLab; tricky names can also get a lexicon <lexeme>.
export const DANISH_LETTER_NAMES: Record<string, string> = {
  A: 'a', B: 'be', C: 'se', D: 'de', E: 'e', F: 'ef', G: 'ge', H: 'hå',
  I: 'i', J: 'jåd', K: 'kå', L: 'el', M: 'em', N: 'en', O: 'o', P: 'pe',
  Q: 'ku', R: 'er', S: 'es', T: 'te', U: 'u', V: 've', W: 'dobbelt-ve',
  X: 'eks', Y: 'y', Z: 'set', Æ: 'æ', Ø: 'ø', Å: 'å',
}

/** Spoken Danish name for a letter; falls back to the glyph itself if not a known letter. */
export const getDanishLetterName = (letter: string): string => {
  const key = letter.trim().toUpperCase()
  return DANISH_LETTER_NAMES[key] ?? letter
}

// Helper functions for getting random phrases
export const getRandomSuccessPhrase = (): string => {
  const phrases = DANISH_PHRASES.success
  return phrases[Math.floor(Math.random() * phrases.length)]
}

export const getRandomEncouragementPhrase = (): string => {
  const phrases = DANISH_PHRASES.encouragement
  return phrases[Math.floor(Math.random() * phrases.length)]
}

// Color game specific helper functions
export const getRandomCorrectItemPhrase = (): string => {
  const phrases = DANISH_PHRASES.colorGames.correctItem
  return phrases[Math.floor(Math.random() * phrases.length)]
}

export const getWrongColorPhrase = (itemName: string): string => {
  return DANISH_PHRASES.colorGames.wrongColor.template(itemName)
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