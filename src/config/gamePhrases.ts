// Composed spoken lines — the SINGLE source for every sentence a game speaks (2026-08-02).
//
// Why this file exists: a line composed inline in a component can't be reached by
// `shared-narration-clips.js` (a plain Node script — it can only import `src/config/*.ts`, never a
// .tsx). Every such line therefore fell through to LIVE Azure, ~1.1s per utterance, and was never
// auditioned in `/audit`. So the rule is: a game NEVER builds a spoken string inline — it calls a
// builder from here, and the enumerator calls the same builder. See the "new narrated line" protocol
// in `.claude/rules/audio-system.md`.
//
// Pronunciation-sensitive letter↔word lines live in `letterWords.ts` instead (they carry per-letter
// overrides); this file is everything else: math, comparison, sequences, colour mixing.

// Explicit `.ts` extension: this module is in `shared-narration-clips.js`'s import graph, and Node's
// ESM resolver rejects extensionless relative imports even though Vite/tsc accept them (see
// audio-system.md). Dropping it breaks the prebake script while the app keeps working.
import { DANISH_PHRASES, getDanishNumberText } from './danish-phrases.ts'
import {
  ADDEND_MAX,
  MINUEND_MAX,
  COMPARE_MAX,
  SEQUENCE_LENGTH,
  allSequenceSpecs,
  type SequenceSpec,
} from './difficulty.ts'

export type MathOp = 'addition' | 'subtraction'

// --- Bounds shared with the prebake enumerator -------------------------------------------------
// The ceilings themselves now live in `difficulty.ts` alongside the per-level tables that must stay
// inside them (Difficulty PRD-01 W1) — re-exported here so this module stays the one place the
// enumerator and the games read narration bounds from. A bound raised in a table without raising the
// ceiling would silently drop those questions' narration back to live, unauditioned Azure.
export { ADDEND_MAX, MINUEND_MAX, COMPARE_MAX, SEQUENCE_LENGTH }

/** Every (a, b) Plus Opgaver can ask. A superset is safe (it only bakes a clip nothing plays); a
 *  SUBSET is not (the missing question falls back to live Azure), so keep this generous. */
export const additionPairs = (): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (let a = 1; a <= ADDEND_MAX; a++) for (let b = 1; b <= ADDEND_MAX; b++) out.push([a, b])
  return out
}

/** Every (a, b) Minus Opgaver can ask — `b ≤ a`, so the result is never negative. */
export const subtractionPairs = (): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (let a = 1; a <= MINUEND_MAX; a++) for (let b = 1; b <= a; b++) out.push([a, b])
  return out
}

/** Every unordered {bigger, smaller} Sammenlign Tal can show (equality was dropped). */
export const comparisonPairs = (): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (let bigger = 2; bigger <= COMPARE_MAX; bigger++)
    for (let smaller = 1; smaller < bigger; smaller++) out.push([bigger, smaller])
  return out
}

// --- Math ---------------------------------------------------------------------------------------
/** The spoken question: "Hvad er tre plus fire". */
export const mathPromptText = (op: MathOp, a: number, b: number): string =>
  `${DANISH_PHRASES.gamePrompts.mathQuestion.prefix} ${getDanishNumberText(a)} ${
    op === 'addition' ? DANISH_PHRASES.math.plus : DANISH_PHRASES.math.minus
  } ${getDanishNumberText(b)}`

/** The completed fact spoken on a correct tap: "tre plus fire er syv" (PRD-05 P2). */
export const mathFactText = (op: MathOp, a: number, b: number, answer: number): string =>
  `${getDanishNumberText(a)} ${
    op === 'addition' ? DANISH_PHRASES.math.plus : DANISH_PHRASES.math.minus
  } ${getDanishNumberText(b)} er ${getDanishNumberText(answer)}`

// --- Sammenlign Tal ------------------------------------------------------------------------------
export const COMPARE_PROMPT = 'Tryk på det største tal.'
/** "sytten er større end ni" — always bigger-first, so one clip serves either card order. */
export const comparisonFactText = (bigger: number, smaller: number): string =>
  `${getDanishNumberText(bigger)} er større end ${getDanishNumberText(smaller)}`

// --- Hvad Mangler? -------------------------------------------------------------------------------
export const HVAD_MANGLER_PROMPT = 'Hvad mangler?'
/** The finished sequence read back on a correct tap: "to, fire, seks, otte, ti". */
export const sequenceFactText = (numbers: number[]): string =>
  numbers.map(getDanishNumberText).join(', ')

/**
 * Every numeric sequence Hvad Mangler? can complete — **DERIVED from the difficulty table**, never
 * hand-copied (Difficulty PRD-01 W7). It used to be a hardcoded list of exactly the old narrow starts
 * (count-by-1 1–10, skip-2 0/2/4/6, skip-5 5/10/15, skip-10 **only** 10), which is also what pinned
 * `skip-10` to the identical `10 20 30 40 50` question forever. `makeSequenceQuestion` draws from
 * `sequenceSpecsForLevel`, so this union is exactly the reachable inventory of spoken read-backs.
 */
export const sequenceStarts: SequenceSpec[] = allSequenceSpecs()
export const sequenceNumbers = ({ start, step }: SequenceSpec): number[] =>
  Array.from({ length: SEQUENCE_LENGTH }, (_, i) => start + i * step)

// --- Farver -------------------------------------------------------------------------------------
export const NUANCER_INSTRUCTION = 'Sæt farverne fra lys til mørk'
/** Ram Farven's target instruction: "Lav lilla farve ved at blande farverne". */
export const colorMixTargetText = (targetName: string): string =>
  `Lav ${targetName} farve ved at blande farverne`
/** Ram Farven's recipe reveal on a correct mix: "rød og blå bliver lilla". */
export const colorMixResultText = (a: string, b: string, result: string): string =>
  `${a} og ${b} bliver ${result}`
/**
 * The colour-identification line: "æblet er rødt" — Farvejagt's correct-drop echo, Hvilken Farve's
 * correct-drop echo, and (Practice Loop PRD-01 W3) Hvilken Farve's never-fail hint.
 *
 * It was composed INLINE in both `.tsx` games and again as a hand-copied template in
 * `shared-narration-clips.js`. The three agreed, but only by luck — that is exactly the drift step 1 of
 * `audio-system.md`'s protocol exists to prevent, and W3 gave it a fourth caller that has to be
 * provably the baked string. `spokenColor` supplies the gender agreement ("havet er blåt").
 */
export const colorObjectFactText = (
  objectNameDefinite: string,
  spokenHue: string,
): string => `${objectNameDefinite} er ${spokenHue}`
