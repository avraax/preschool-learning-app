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
  // PRD-18 W2 manifest audit: was 'Å' (a stream — a Danish child reads that picture as "vand"/"bæk",
  // which fights the audio). Swapped to 'Ål' (eel), an unambiguous child-known noun that genuinely
  // starts with Å. Needs a re-baked Å-keyed picture (an eel, not a stream) — art is gated on the owner
  // dropping the new AA.webp; until then the OLD stream picture shows under the word "Ål" (mismatch).
  // The two changed spoken lines ("Å som Ål" / "Ål starter med Å") need a tts:prebake + /audit pass.
  Å: { word: 'Ål' },
}

// ----- Spoken letter↔word lines (the ONLY place this text is built) ---------------------------
//
// Two closed-set narration templates put a letter inside a Danish sentence:
//   letterPhrase()      "{bogstav} som {ord}"        — Lær Alfabetet tap + Hukommelse match
//   startsWithPhrase()  "{ord} starter med {bogstav}" — Bogstav Quiz correct-answer fact
//
// Build them ONLY through these helpers. `shared-narration-clips.js` calls the same two, so the
// prebaked keys always match what the app asks for at runtime; if they drift, the fixed line falls
// back to live Azure and never surfaces in /audit (see letterWords.test.ts + audio-system.md).
//
// Azure da-DK misreads two letters in sentence context, and the two defects have DIFFERENT shapes:
//
//   Z — a SPELLING defect. The bare glyph reads English-ish; 'zet' gives the Danish letter name
//       [sɛd̥]. Owner-verified in /voicelab against 'set' / 'zæt' / the raw glyph. Position-
//       independent, so it applies in both templates.
//
//   I — a PHRASING defect, NOT a spelling one, and it took TWO stacked fixes (both owner-verified by
//       ear in /voicelab). Every respelling ('i', 'ih') failed because the token itself is fine: read
//       alone it is correct, but among neighbours Azure demotes it to the pronoun/preposition "i" —
//       short, unstressed, no stød. See LETTER_LINE below for the resulting line.
const LETTER_SPELLING: Record<string, string> = {
  Z: 'zet',
}

// Whole-line overrides for letters whose defect is PHRASING rather than spelling — punctuation and
// function words can't be expressed as a letter substitution. Derived FROM the manifest word, so
// editing LETTER_WORDS can never leave a stale hand-written line behind.
const LETTER_LINE: Record<string, (word: string) => string> = {
  // I — two defects in sequence, each fix exposing the next:
  //  1. The LETTER: a bare "I" reads as the pronoun. A COMMA gives it its own prosodic phrase, which
  //     restores the length + stød of the letter name [iːˀ].
  //  2. The WORD: that boundary then made Azure carry the letter-name ("characters") reading into the
  //     next token and spell the short capitalised "Is" as I-S. The indefinite ARTICLE + lowercase
  //     makes it unambiguously a noun again.
  // DON'T SHORTEN THIS. It is deliberately the only line of 29 that deviates from the plain
  // "{bogstav} som {ord}" frame, and every smaller variant was auditioned and REJECTED by ear:
  // 'I som Is' (letter wrong), 'i'/'ih' respellings (letter wrong), 'I, som Is' and 'I, som is'
  // (word spelled I-S), 'i, som is' / 'i, som Is' (still wrong). The article is load-bearing.
  I: (word) => `I, som en ${word.toLowerCase()}`,
}

/** The spelling to speak for `letter` inside a sentence (position-independent). */
export const spokenLetter = (letter: string): string => LETTER_SPELLING[letter] ?? letter

/** "{bogstav} som {ord}" — Lær Alfabetet's tap echo and Hukommelse's match echo. */
export const letterPhrase = (letter: string, word: string): string =>
  LETTER_LINE[letter]?.(word) ?? `${spokenLetter(letter)} som ${word}`

// Whole-line overrides for the "starter med" template. A letter sitting sentence-FINAL is in the
// weakest prosodic position there is, so the comma trick that fixed the browse line has nothing to
// isolate against and does not transfer.
const STARTS_WITH_LINE: Record<string, (word: string) => string> = {
  // I — every sentence-final phrasing was auditioned and REJECTED by ear: 'Is starter med I',
  // '… bogstavet I', '… med, I', '… med I.', '… med ... I', 'Is — den starter med I', at several
  // tempos. Owner ruling: speak the proven browse line instead. I is therefore the ONE letter whose
  // correct-answer fact names the letter + its picture rather than the first sound — a deliberate
  // exception to the quiz's "{ord} starter med {bogstav}" frame, taken because a mispronounced letter
  // teaches worse than a differently-framed correct one. It also resolves to a string that is
  // byte-identical to letterPhrase('I', …), so it reuses that already-prebaked, already-audited clip.
  I: (word) => letterPhrase('I', word),
}

/**
 * "{ord} starter med {bogstav}" — Bogstav Quiz's correct-answer fact, with the per-letter overrides
 * above (I speaks the browse line instead; Z is respelled).
 */
export const startsWithPhrase = (letter: string, word: string): string =>
  STARTS_WITH_LINE[letter]?.(word) ?? `${word} starter med ${spokenLetter(letter)}`

/**
 * "Hvad starter {Ord} med?" — Bogstav Quiz's spoken QUESTION (the picture's word, then "starts with
 * what"). Only the word is spoken, so no per-letter override applies here. Built through this helper
 * for the same reason as the two above: `shared-narration-clips.js` calls it too, so the baked clip
 * and the runtime request can't drift (drift = a silent fall back to live Azure, never auditioned).
 */
export const startsWithQuestion = (word: string): string => `Hvad starter ${word} med?`

// Letters Bogstav Quiz asks about (the correct answer is one of these). W, X and Å are asked too
// (owner request — they have honest picturable words: Wienerbrød / Xylofon / Å-stream). Only Q stays
// excluded — "Quiz" (a question mark) has no natural spoken first-sound word — so Q appears in the
// quiz only as a distractor tile, while still blooming with a picture in Lær Alfabetet and Hukommelse.
export const WORD_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å',
]
