// Ordleg's word content — the prompt words for Læs Ordet and Stav Ordet.
//
// These lists used to live inside the two `.tsx` components, which meant the words BOTH games speak
// (Læs Ordet names the tapped picture; Stav Ordet says the word and reads it back) were unreachable for
// `shared-narration-clips.js` and therefore never enumerated. They only had prebaked clips by
// COINCIDENCE — a handful (`kat`, `sol`, `ost`, `sko`) happen to be Danish glosses in `englishVocab`,
// while `tog`, `ulv`, `ged`, `abe`, `haj`, `ski`, `mus`, `bus`, `sø`, `ål`, `løg`, `bær`, `te`, `ur`,
// `ræv`, `hul`, `ben`, `arm`, `hus` and `bi` were all falling through to live, unauditioned Azure.
// Moving them here + enumerating them (see `.claude/rules/audio-system.md`'s protocol, step 1) is what
// closes that, and it's a prerequisite for Stav Ordet's new 4-letter Svær tier.
//
// `art` is the baked-art id, resolved via `ordlegArt(art)` — which falls back ordleg → shared → english,
// so a word can reuse a picture from another section (`hest` → `horse.webp`). WORDS AND LETTERS ARE NOT
// ART: the prompt word, the letter tiles and the slots stay Comic Sans type — reading/spelling the
// glyphs IS the exercise.
import { ORDLEG_SPELL, type DifficultyLevel } from './difficulty.ts'

export interface OrdlegWord {
  word: string
  art: string
}

/**
 * Questions in a Læs Ordet round. Exported so the POOL can be guarded against it — a level whose word
 * pool is smaller than this has to repeat words inside a single round, which reads as the game being
 * stuck rather than easy. `LaesOrdetGame` reads this for its `RoundConfig`, so the two can't drift.
 */
export const READING_ROUND_LENGTH = 8

/**
 * Læs Ordet's pool. Concrete, depictable, and **2–3 letters at every level** (standing owner rule: he
 * can't spell yet) — Svær's extra challenge is more distractor PICTURES, never a longer prompt word.
 */
export const READING_WORDS: OrdlegWord[] = [
  // ---- 2 letters: the whole pool at Let (ORDLEG_READ.let.wordMaxLen) ----------------------------
  // There were only FIVE of these, so a Let round of 8 questions had to show most words twice
  // (owner, 2026-08-03 — the same "reads as stuck rather than easy" complaint that grew Ram Farven's
  // Let target pool). `bi`/`sø`/`ål`/`te` were already shipping in SPELLING_WORDS with baked art and
  // prebaked narration, so they cost nothing — and they bring Ø and Å into the reading pool, which
  // previously practised only Æ (via `æg`). Keep this list ≥ the round length; `ordlegWords.test.ts`
  // fails the build otherwise.
  { word: 'ko', art: 'ko' },
  { word: 'is', art: 'is' },
  { word: 'æg', art: 'aeg' },
  { word: 'ur', art: 'ur' },
  { word: 'so', art: 'so' },
  { word: 'bi', art: 'bi' },
  { word: 'sø', art: 'soe' },
  { word: 'ål', art: 'aal' },
  { word: 'te', art: 'te' },
  // ---- 3 letters: added at Normal and above ----------------------------------------------------
  { word: 'kat', art: 'kat' },
  { word: 'sol', art: 'sol' },
  { word: 'hus', art: 'hus' },
  { word: 'bil', art: 'bil' },
  { word: 'bog', art: 'bog' },
  { word: 'mus', art: 'mus' },
  { word: 'and', art: 'and' },
  { word: 'sko', art: 'sko' },
  { word: 'hat', art: 'hat' },
  { word: 'ost', art: 'ost' },
  { word: 'tog', art: 'tog' },
  { word: 'bus', art: 'bus' },
  { word: 'ræv', art: 'raev' },
  { word: 'ged', art: 'ged' },
  { word: 'haj', art: 'haj' },
  { word: 'abe', art: 'abe' },
  { word: 'ski', art: 'ski' },
]

/**
 * Stav Ordet's 2–3 letter pool — the words Let and Normal spell. Includes Æ, Ø and Å so the
 * Danish-specific letters get practised. `os` (a stray dup of `ost`) and `øl` were removed per the
 * owner's §6.2 call; Ø is still practised via `sø` / `løg`.
 */
export const SPELLING_WORDS: OrdlegWord[] = [
  { word: 'ko', art: 'ko' },
  { word: 'bi', art: 'bi' },
  { word: 'is', art: 'is' },
  { word: 'sol', art: 'sol' },
  { word: 'hus', art: 'hus' },
  { word: 'bil', art: 'bil' },
  { word: 'kat', art: 'kat' },
  { word: 'hej', art: 'hello' },
  { word: 'hat', art: 'hat' },
  { word: 'mus', art: 'mus' },
  { word: 'bus', art: 'bus' },
  { word: 'ost', art: 'ost' },
  { word: 'fod', art: 'foot' },
  { word: 'bog', art: 'bog' },
  { word: 'and', art: 'and' },
  { word: 'arm', art: 'arm' },
  { word: 'ben', art: 'leg' },
  { word: 'hul', art: 'hul' },
  { word: 'sø', art: 'soe' },
  { word: 'ål', art: 'aal' },
  { word: 'æg', art: 'aeg' },
  { word: 'te', art: 'te' },
  { word: 'ur', art: 'ur' },
  { word: 'sko', art: 'sko' },
  { word: 'haj', art: 'haj' },
  { word: 'abe', art: 'abe' },
  { word: 'ræv', art: 'raev' },
  { word: 'ulv', art: 'ulv' },
  { word: 'ged', art: 'ged' },
  { word: 'tog', art: 'tog' },
  { word: 'mor', art: 'mom' },
  { word: 'far', art: 'dad' },
  { word: 'bær', art: 'baer' },
  { word: 'løg', art: 'loeg' },
  { word: 'ski', art: 'ski' },
]

/**
 * Stav Ordet's 4-letter tier — Svær only (Difficulty PRD-01 W5 / §6's art gate).
 *
 * The PRD flagged this as optional because none of the 30 keyed files in `src/assets/games/ordleg/` is
 * a 4-letter word. It ships anyway: `ordlegArt` falls back through `shared` to `english`, and every word
 * here resolves to art that is ALREADY baked and shipping (`hest`→`horse.webp`, `gris`→`pig.webp`, …).
 * Every letter is inside Stav Ordet's tile alphabet (which omits Q/W/X), and every word is enumerated
 * for prebake below, so nothing here needs a new render. **Adding a word means checking both** — a
 * resolvable `art` id and a spelling drawable from the tile alphabet.
 */
export const SPELLING_WORDS_LONG: OrdlegWord[] = [
  { word: 'hest', art: 'horse' },
  { word: 'gris', art: 'pig' },
  { word: 'fisk', art: 'fish' },
  { word: 'hund', art: 'dog' },
  { word: 'fugl', art: 'bird' },
  { word: 'løve', art: 'lion' },
  { word: 'kage', art: 'cake' },
  { word: 'brød', art: 'bread' },
  { word: 'mælk', art: 'milk' },
  { word: 'stol', art: 'chair' },
  { word: 'seng', art: 'bed' },
  { word: 'måne', art: 'moon' },
  { word: 'bold', art: 'ball' },
  { word: 'regn', art: 'rain' },
  { word: 'vand', art: 'water' },
]

/** Everything Stav Ordet can ask, at any level. */
export const ALL_SPELLING_WORDS: OrdlegWord[] = [...SPELLING_WORDS, ...SPELLING_WORDS_LONG]

/**
 * Stav Ordet's pool at a level: Let 2–3 (one missing letter, Game Depth PRD-01) · Normal 2–3 · Svær 3–4.
 * The 4-letter tier is what makes
 * Svær a real level here — the game ignored the difficulty setting entirely before this PRD.
 */
export const spellingWordsFor = (level: DifficultyLevel): OrdlegWord[] => {
  const { wordMinLen, wordMaxLen } = ORDLEG_SPELL[level]
  const pool = ALL_SPELLING_WORDS.filter(
    (w) => w.word.length >= wordMinLen && w.word.length <= wordMaxLen,
  )
  // Never hand a game an empty pool, whatever a future table edit says.
  return pool.length > 0 ? pool : SPELLING_WORDS
}

/**
 * Every bare word either Ordleg game speaks — Læs Ordet's tapped-picture name and Stav Ordet's prompt
 * + completed-word read-back are both `speak(word)` with this exact lowercase string. The enumerator
 * bakes this list.
 */
export const spokenOrdlegWords = (): string[] => [
  ...new Set([...READING_WORDS, ...ALL_SPELLING_WORDS].map((w) => w.word)),
]

// ---- Stav Ordet Let — the missing-letter task (Game Depth PRD-01 §3.4) --------------------------------

/**
 * Stav Ordet's letter-tile alphabet. Q/W/X are left out (no word here uses them, and they only add
 * noise as distractors). Moved here from the component so the pure task builder below can use it.
 */
export const SPELLING_ALPHABET: readonly string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T',
  'U', 'V', 'Y', 'Z', 'Æ', 'Ø', 'Å',
]

export interface MissingLetterTask {
  /** The word's letters, uppercase. */
  letters: string[]
  /** The one slot the child fills. */
  blankIndex: number
  /** The tray: the missing letter + `distractors` others, shuffled. */
  tiles: string[]
}

/**
 * One missing-letter task: the word with ONE blank (any position) and a tray of the missing letter plus
 * `distractors` letters that are neither in the word (so a distractor can never ALSO be right) nor in
 * the missing letter's confusable pool (Let means maximally dissimilar — the same policy as Bogstav
 * Quiz Let). `confusablePool` is injected so this module keeps importing nothing but the difficulty
 * table. PURE + seedable.
 */
export const makeMissingLetterTask = (
  word: string,
  distractors: number,
  confusablePool: (letter: string) => readonly string[],
  rnd: () => number = Math.random,
): MissingLetterTask => {
  const letters = word.toUpperCase().split('')
  const blankIndex = Math.floor(rnd() * letters.length)
  const answer = letters[blankIndex]
  const avoid = new Set([...letters, ...confusablePool(answer)])
  const pool = SPELLING_ALPHABET.filter((l) => !avoid.has(l))
  // Fisher-Yates over a copy (no shared-module import: this file stays dependency-free).
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const tiles = [answer, ...shuffled.slice(0, distractors)]
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return { letters, blankIndex, tiles }
}
