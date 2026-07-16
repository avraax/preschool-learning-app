// Canonical letter → example-word → emoji table. Single source shared by Bogstav Quiz
// (AlphabetGame — word-association: "tap the letter the word starts with"), Lær Alfabetet
// (AlphabetLearning's browse bloom) and Hukommelse (MemoryGame), so the games can never drift and a
// letter shows the same baked object + speaks the same word everywhere (PRD-07 §6 consolidation).
//
// Emoji picks are the art-gated fallback (the baked soft-3D subject in src/assets/games/alphabet/
// takes precedence — see letterArt()); they are constrained to ones a Danish child reads back as the
// intended word (the V/Y notes below record two corrections).
//
// Q/W/X/Å (below the divider) now carry a picture too (owner request), so they bloom in Lær Alfabetet
// and appear in Hukommelse like every other letter. They are DISPLAY-ONLY: `WORD_LETTERS` (the set
// Bogstav Quiz asks) deliberately excludes them, because they are weak first-sound teaching letters
// for a Danish pre-reader — they still appear only as distractor tiles in the quiz.
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
  // Display-only extras (picture + word for the browse/memory; NOT asked by the quiz — see below).
  Q: { word: 'Quiz', emoji: '❓' },
  W: { word: 'Wienerbrød', emoji: '🥐' },
  X: { word: 'Xylofon', emoji: '🎵' },
  Å: { word: 'Å', emoji: '🏞️' },
}

// Letters Bogstav Quiz asks about (the correct answer is one of these). W, X and Å are asked too
// (owner request — they have honest picturable words: Wienerbrød / Xylofon / Å-stream). Only Q stays
// excluded — "Quiz" (a question mark) has no natural spoken first-sound word — so Q appears in the
// quiz only as a distractor tile, while still blooming with a picture in Lær Alfabetet and Hukommelse.
export const WORD_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å',
]
