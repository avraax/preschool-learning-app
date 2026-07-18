// Canonical letter → example-word table. Single source shared by Bogstav Quiz
// (AlphabetGame — word-association: "tap the letter the word starts with"), Lær Alfabetet
// (AlphabetLearning's browse bloom) and Hukommelse (MemoryGame), so the games can never drift and a
// letter shows the same baked object + speaks the same word everywhere (PRD-07 §6 consolidation).
//
// The subject is the baked soft-3D picture in src/assets/games/alphabet/ (see letterArt()); the whole
// 29-letter set is baked and shipping (PRD-12 dropped the flat-emoji fallback column). The words were
// chosen so a Danish child reads the picture back as the intended word.
//
// Q/W/X/Å now carry a picture too (owner request), so they bloom in Lær Alfabetet and appear in
// Hukommelse like every other letter. They are DISPLAY-ONLY: `WORD_LETTERS` (the set Bogstav Quiz
// asks) deliberately excludes them, because they are weak first-sound teaching letters for a Danish
// pre-reader — they still appear only as distractor tiles in the quiz.
export const LETTER_WORDS: Record<string, { word: string }> = {
  A: { word: 'Abe' },
  B: { word: 'Bil' },
  C: { word: 'Cykel' },
  D: { word: 'Drage' },
  E: { word: 'Elefant' },
  F: { word: 'Fisk' },
  G: { word: 'Giraf' },
  H: { word: 'Hund' },
  I: { word: 'Is' },
  J: { word: 'Jul' },
  K: { word: 'Kat' },
  L: { word: 'Løve' },
  M: { word: 'Mus' },
  N: { word: 'Næsehorn' },
  O: { word: 'Orm' },
  P: { word: 'Panda' },
  R: { word: 'Raket' },
  S: { word: 'Sol' },
  T: { word: 'Tog' },
  U: { word: 'Ugle' },
  V: { word: 'Vulkan' },
  Y: { word: 'Yoyo' },
  Z: { word: 'Zebra' },
  Æ: { word: 'Æble' },
  Ø: { word: 'Ørn' },
  // Display-only extras (picture + word for the browse/memory; NOT asked by the quiz — see below).
  Q: { word: 'Quiz' },
  W: { word: 'Wienerbrød' },
  X: { word: 'Xylofon' },
  Å: { word: 'Å' },
}

// Letters Bogstav Quiz asks about (the correct answer is one of these). W, X and Å are asked too
// (owner request — they have honest picturable words: Wienerbrød / Xylofon / Å-stream). Only Q stays
// excluded — "Quiz" (a question mark) has no natural spoken first-sound word — so Q appears in the
// quiz only as a distractor tile, while still blooming with a picture in Lær Alfabetet and Hukommelse.
export const WORD_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å',
]
