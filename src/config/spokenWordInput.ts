// Sig et Ord: turning a Google STT transcript into the ONE word the app shows, speaks and spells.
//
// Lives in `src/config/` (not in the component) so a test can import it — the same rule as every other
// per-game content list here. Pure, no DOM.
//
// **Every rule below is a measured failure shape**, not a precaution. Measured 2026-08-04 over 16 common
// Danish words × 4 child-like distortions (pitch +30/+55%, far+noisy, rushed) through the real
// recognizer, and the raw transcripts are what shaped this file. Re-measure before loosening any of it.
//
// Explicit `.ts` extension: this module sits in the client/test graph, where Node's ESM resolver
// rejects extensionless relative imports (see `.claude/rules/audio-system.md`).
import { getDanishNumberText } from './danish-phrases.ts'

/** Danish STT returns numbers as DIGITS, and 100 is the app's number ceiling everywhere else. */
const NUMBER_WORD_MAX = 100

/**
 * Non-Danish spellings the recognizer returns for Danish words that are near-homophones in another
 * language. `chirp_3` is multilingual and a single word carries no context to anchor the language, so
 * "kat" came back as English "cat" on every distorted variant and "bær" as German "Bär".
 *
 * Spelling CAT back to a Danish 5-year-old who said "kat" teaches him the wrong word — worse than
 * asking him to try again. So this table is deliberately **measured-only**: an entry needs an observed
 * transcript, and the target must be unambiguous. Do NOT guess entries, and do not add anything that is
 * itself a Danish word (`bi`, `is`, `ko` are all real words and must pass through untouched).
 */
const FOREIGN_SPELLINGS: Record<string, string> = {
  cat: 'kat',
  bär: 'bær',
  baer: 'bær',
}

/**
 * Words that must never be shown, spoken or spelled. The recognizer runs with `features.profanityFilter`
 * (which masks as `f****`), but that flag's behaviour on `chirp_3` is undocumented — and this game SPELLS
 * ALOUD whatever it hears, so a filter we can't verify is not a filter we can rely on. Lowercase, matched
 * exactly against the extracted word.
 */
const BLOCKED_WORDS = new Set([
  'fuck', 'fucking', 'shit', 'bitch', 'pik', 'kusse', 'fisse', 'luder', 'røvhul', 'roevhul',
  'skide', 'lort', 'møgsvin', 'fandens', 'satans', 'idiot', 'spasser', 'nigger', 'sex',
])

/**
 * The first usable word of a transcript, normalized for everything downstream at once. Returns `''`
 * when there is nothing safe and usable — the caller's friendly-retry path.
 *
 * - **Masked or blocked profanity → nothing.** See `BLOCKED_WORDS`.
 * - **A leading one-letter token is dropped when more follow.** The recognizer splits a short word into
 *   a filler plus the word: "is" came back as `"i is"` on every single variant, and taking the first
 *   token spelled "I" back to the child.
 * - **A one-letter result is rejected.** "ko" came back as `"k"`; the child said a word, so spelling a
 *   letter back is a wrong answer dressed as a right one. Better to ask again.
 * - **Digits become Danish words.** `"5"` used to be stripped to `''` by the letter-only filter, so a
 *   child saying *fem* got "det hørte jeg ikke helt" for no reason. Now `5 → "fem"` — also a word the
 *   spell-out can teach.
 * - **Lowercase.** STT capitalises the leading word ("Kat"). Two things key off the exact string: the
 *   prebaked-clip cache key (the Ordleg word clips are baked lowercase) and the PLS lexicon, whose
 *   graphemes are case-SENSITIVE and lowercase. So "Kat" would miss both and pay a live Azure
 *   round-trip for a pronunciation fix that then doesn't apply.
 */
export const normalizeSpokenWord = (transcript: string): string => {
  const raw = (transcript || '').trim()
  if (!raw) return ''
  if (raw.includes('*')) return '' // masked profanity — never reveal, never spell

  const tokens = raw.split(/\s+/).filter(Boolean)
  // Drop leading single-character tokens (recognizer filler / mis-segmentation), but only while a real
  // token remains — a lone letter has nothing to fall back to and is rejected below.
  let index = 0
  while (index < tokens.length - 1 && cleanToken(tokens[index]).length <= 1) index += 1

  const word = cleanToken(tokens[index] ?? '')
  if (word.length <= 1) return '' // a single letter is not the word he said
  if (BLOCKED_WORDS.has(word)) return ''
  return FOREIGN_SPELLINGS[word] ?? word
}

/** One token → digits mapped to a Danish number word, otherwise Danish letters + hyphen, lowercased. */
const cleanToken = (token: string): string => {
  const lower = token.toLowerCase()
  const digits = lower.replace(/[^0-9]/g, '')
  if (digits && digits === lower.replace(/[^0-9a-zæøåü-]/g, '')) {
    const n = Number(digits)
    if (Number.isFinite(n) && n >= 0 && n <= NUMBER_WORD_MAX) return getDanishNumberText(n).toLowerCase()
    return ''
  }
  // Keep `ü`/`ä`/`ö` here so a German-spelled homophone ("Bär") can still be matched by the table above;
  // they are stripped from anything that survives it.
  return lower.replace(/[^a-zæøåäöü-]/g, '')
}

/**
 * The art-manifest id for a recognized word: Danish glyphs folded to the ASCII aliases the baked
 * WebP filenames use (æ→ae, ø→oe, å→aa), so æg/ræv/bær/løg/ål/sø match their pictures.
 */
export const spokenWordArtId = (word: string): string =>
  word.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
