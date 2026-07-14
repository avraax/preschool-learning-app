// Canonical letter → example-word → emoji table. Single source shared by Bogstav Quiz
// (AlphabetGame — word-association: "tap the letter the word starts with") and Lær Alfabetet
// (AlphabetLearning's browse bloom), so the two can never drift.
//
// Emoji picks are constrained to ones that a Danish child reads back as the intended word (the
// V/Y notes below record two corrections). Q, W and X have no honest Danish example word and Å has
// no honest picture, so they are omitted here — they still appear as distractor letters in the quiz
// and, for Å, as a picture-less bloom in the browse.
export const LETTER_WORDS: Record<string, { word: string; emoji: string }> = {
  A: { word: 'Abe', emoji: '🐒' },
  B: { word: 'Bil', emoji: '🚗' },
  C: { word: 'Cykel', emoji: '🚲' },
  D: { word: 'Drage', emoji: '🐉' },
  E: { word: 'Elefant', emoji: '🐘' },
  F: { word: 'Fisk', emoji: '🐟' },
  G: { word: 'Giraf', emoji: '🦒' },
  H: { word: 'Hund', emoji: '🐕' },
  I: { word: 'Is', emoji: '🍦' },
  J: { word: 'Jul', emoji: '🎄' },
  K: { word: 'Kat', emoji: '🐱' },
  L: { word: 'Løve', emoji: '🦁' },
  M: { word: 'Mus', emoji: '🐭' },
  N: { word: 'Næsehorn', emoji: '🦏' },
  O: { word: 'Orm', emoji: '🪱' },
  P: { word: 'Panda', emoji: '🐼' },
  R: { word: 'Raket', emoji: '🚀' },
  S: { word: 'Sol', emoji: '☀️' },
  T: { word: 'Tog', emoji: '🚂' },
  U: { word: 'Ugle', emoji: '🦉' },
  V: { word: 'Vulkan', emoji: '🌋' },   // was 🍉 (reads "melon" → M)
  Y: { word: 'Yoyo', emoji: '🪀' },     // was 🥛 (milk glass reads "mælk" → M)
  Z: { word: 'Zebra', emoji: '🦓' },
  Æ: { word: 'Æble', emoji: '🍎' },
  Ø: { word: 'Ørn', emoji: '🦅' },
  // Å dropped as a target: no honest Å picture exists (🐍 reads "slange" → S). Å still appears as a
  // distractor letter and in Lær Alfabetet's browse (its bloom just shows the letter, no example).
}

// Letters that have an example word — the only letters Bogstav Quiz asks about (the others appear
// solely as distractors).
export const WORD_LETTERS = Object.keys(LETTER_WORDS)
