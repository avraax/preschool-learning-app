// WHAT each game may ask, per level — the prompt POOL, in one importable place (Practice Loop PRD-01 W1).
//
// The pools themselves already live in config (`letterWords`, `englishVocab`, `ordlegWords`,
// `colorContent`); what was stranded in the `.tsx` components was the per-level FILTER that turns a
// content list into "the things this level asks". That mattered for exactly the reason
// `game-development.md` gives: a test cannot read a list out of a `.tsx`, so the measured before/after
// in `promptBag.test.ts` would otherwise have had to re-derive each pool by hand — and a guard that
// re-derives its subject agrees with itself while the product regresses.
//
// So each game's prompt pool is a pure function here, the component calls it, and the simulation
// samples the SAME function. PURE + Node-importable → relative imports need the `.ts` extension.
import { COLORS_QUIZ, ORDLEG_READ, type DifficultyLevel } from './difficulty.ts'
import { WORD_LETTERS } from './letterWords.ts'
import { quizEnglishWords, type EnglishWord } from './englishVocab.ts'
import {
  READING_ROUND_LENGTH,
  READING_WORDS,
  spellingWordsFor,
  type OrdlegWord,
} from './ordlegWords.ts'
import {
  COLOR_TARGETS,
  COLORS_QUIZ_ROUND,
  HUE_ORDER,
  quizObjectPool,
  type QuizObject,
} from './colorContent.ts'

// ---- Round lengths ------------------------------------------------------------------------------
//
// A game's round length is now needed in THREE places — its `RoundConfig`, its bag's no-repeat WINDOW
// (see `makePromptBag`), and the measured simulation — so it lives here as one value, the same rule that
// already put `READING_ROUND_LENGTH` and `COLORS_QUIZ_ROUND` beside their content. Those two keep their
// existing homes; these are the games that only ever had a literal in the component.

/** Bogstav Quiz: 8 pictures per round. */
export const ALPHABET_ROUND = 8
/** Both English quizzes: 8 words per round. */
export const ENGLISH_ROUND = 8
/** Stav Ordet: 8 words per round. */
export const SPELLING_ROUND = 8
/** Nuancer: 8 orderings per round (deliberately more than its 6 hues — see the window note in promptBag). */
export const NUANCER_ROUND = 8
/** Farvejagt: 5 boards per round (a board is a whole hunt, so fewer of them). */
export const FARVEJAGT_ROUND = 5

// ---- Pools --------------------------------------------------------------------------------------

/** Bogstav Quiz asks the 28 letters that have a picture word (Q is distractor-only). */
export const alphabetPromptPool = (): readonly string[] => WORD_LETTERS

/**
 * Both English quizzes ask the same words at every level — the deliberate beginner floor; the level
 * moves the DISTRACTORS (`ENGLISH_QUIZ[level].theme`), never the pool.
 */
export const englishPromptPool = (): readonly EnglishWord[] => quizEnglishWords

/** Læs Ordet: 2-letter words at Let, the whole 2–3-letter pool above it (`wordMaxLen`). */
export const readingPromptPool = (level: DifficultyLevel): readonly OrdlegWord[] =>
  READING_WORDS.filter((w) => w.word.length <= ORDLEG_READ[level].wordMaxLen)

/** Stav Ordet: Let 2 letters, Normal 2–3, Svær 3–4 (`spellingWordsFor` owns the band). */
export const spellingPromptPool = (level: DifficultyLevel): readonly OrdlegWord[] =>
  spellingWordsFor(level)

/**
 * Hvilken Farve?: the objects askable from this level's POOL. The object is desaturated at every
 * level, so non-canonical colours are gone everywhere (a greyed-out car has no right answer) and Let
 * additionally asks only the subjects whose colour is unambiguous at 5.
 */
export const colorQuizPromptPool = (level: DifficultyLevel): readonly QuizObject[] =>
  quizObjectPool(COLORS_QUIZ[level].pool)

/** Nuancer asks a HUE (all 6 at every level; the level moves slots + the decoy). */
export const nuancerPromptPool = (): readonly string[] => HUE_ORDER

/** Farvejagt asks a target COLOUR (all 6 at every level; the level moves the board's item counts). */
export const farvejagtPromptPool = (): readonly { color: string; phrase: string }[] => COLOR_TARGETS

/** The item key each bag identifies its pool by — a stable string per askable thing. */
export const englishWordKey = (w: EnglishWord): string => w.en
export const ordlegWordKey = (w: OrdlegWord): string => w.word
export const quizObjectKey = (o: QuizObject): string => `${o.color}-${o.objectName}`
export const colorTargetKey = (t: { color: string }): string => t.color

export interface PromptPoolSpec {
  gameId: string
  /** Questions in one round — mirrors that game's `RoundConfig`, so the simulation measures real rounds. */
  round: number
  pool: (level: DifficultyLevel) => readonly unknown[]
  key: (item: unknown) => string
}

/** Erases the item type at the registry boundary so one loop can sample every game's pool. */
const spec = <T>(
  gameId: string,
  round: number,
  pool: (level: DifficultyLevel) => readonly T[],
  key: (item: T) => string,
): PromptPoolSpec => ({ gameId, round, pool, key: key as (item: unknown) => string })

/**
 * Every game whose prompt is drawn from a pool, for the measured simulation in `promptBag.test.ts`.
 * A game missing from here is a game nothing measures, so `promptDraw.test.ts` asserts this list covers
 * exactly the components that draw a prompt.
 */
export const PROMPT_POOLS: readonly PromptPoolSpec[] = [
  spec('alphabet.quiz', ALPHABET_ROUND, alphabetPromptPool, (l: string) => l),
  spec('english.listen', ENGLISH_ROUND, englishPromptPool, englishWordKey),
  spec('english.word', ENGLISH_ROUND, englishPromptPool, englishWordKey),
  spec('ordleg.read', READING_ROUND_LENGTH, readingPromptPool, ordlegWordKey),
  spec('ordleg.spelling', SPELLING_ROUND, spellingPromptPool, ordlegWordKey),
  spec('colors.quiz', COLORS_QUIZ_ROUND, colorQuizPromptPool, quizObjectKey),
  spec('colors.nuancer', NUANCER_ROUND, nuancerPromptPool, (h: string) => h),
  spec('colors.farvejagt', FARVEJAGT_ROUND, farvejagtPromptPool, colorTargetKey),
]

/**
 * Does this game draw its prompts from a pool a bag can reorder?
 *
 * The practice ledger (W2) is gated on this: its only consumer is a prompt bag, so recording items no
 * bag will ever reorder — the math generators are a parameter SPACE, not a content list — would only
 * push the useful entries out through the ledger's 300-entry cap. The gated total is well inside it.
 */
export const hasPromptPool = (gameId: string | undefined): boolean =>
  !!gameId && PROMPT_POOLS.some((p) => p.gameId === gameId)
