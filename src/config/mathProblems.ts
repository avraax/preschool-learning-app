// The math generators, lifted out of the components as PURE functions of `(level, rnd)`
// (Difficulty PRD-01 W2).
//
// Two reasons this is a module and not component code, both hard requirements:
//   1. The §7 invariants (Minus Normal never borrows, Plus Svær always crosses the ten, every sequence
//      ≤ 100 and enumerated) can only be SAMPLED — thousands of problems per level — if the generators
//      are callable outside React.
//   2. The prebake enumerator needs the same code the game runs; a spoken line whose range is shaped
//      inside a `.tsx` is unreachable for `shared-narration-clips.js`.
//
// `MathOperationGame` / `ComparisonGame` / `HvadManglerGame` / `MathGame` keep ALL their animation and
// audio behaviour and just call these. Explicit `.ts` extensions: this module is in the enumerator's
// import graph (see `.claude/rules/audio-system.md`).
import {
  MATH_ADDITION,
  MATH_COMPARISON,
  MATH_COUNTING,
  MATH_SEQUENCE,
  MATH_SUBTRACTION,
  SEQUENCE_LENGTH,
  SEQUENCE_STEPS,
  sequenceSpecsForLevel,
  type DifficultyLevel,
  type SequenceSpec,
} from './difficulty.ts'
import { shuffle } from '../utils/shuffle.ts'

/** A 0-to-1 random source. Injectable so tests can sample deterministically. */
export type Rnd = () => number

const randInt = (rnd: Rnd, min: number, max: number): number =>
  min + Math.floor(rnd() * (max - min + 1))

const pickOne = <T,>(rnd: Rnd, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]

/** Take the first `count` DISTINCT values from `candidates`, then top up from `fallback`. */
const fillDistinct = (
  candidates: readonly number[],
  count: number,
  fallback: () => number,
): number[] => {
  const picks: number[] = []
  for (const c of candidates) {
    if (picks.length >= count) break
    if (!picks.includes(c)) picks.push(c)
  }
  let guard = 0
  while (picks.length < count && guard++ < 500) {
    const r = fallback()
    if (!picks.includes(r)) picks.push(r)
  }
  return picks
}

// ================================================================================================
// Plus / Minus
// ================================================================================================

export interface OperationProblem {
  a: number
  b: number
  answer: number
}

/**
 * True when the sum goes ABOVE ten — "crossing the ten", the skill Plus Svær forces and Plus Let
 * avoids entirely. `> 10`, not `>= 10`: landing exactly on ten (4+6) is the *make-ten* case, which is
 * the easy anchor, not the crossing. With both addends ≤ 9 (Svær's band) this is equivalent to the
 * units digits carrying.
 */
export const crossesTen = (a: number, b: number): boolean => a + b > 10

/**
 * Plus Opgaver. Let: sums ≤10. Normal: sums ≤20 with both addends ≥2 (crossing allowed — counting *on*
 * to 20 on fingers is a skill he has). Svær: ALWAYS crosses the ten, which caps the sum at 18 because
 * a crossing pair of addends ≤10 can't reach 19 (9+10) or 20 (10+10).
 */
export const makeAdditionProblem = (
  level: DifficultyLevel,
  rnd: Rnd = Math.random,
): OperationProblem => {
  const t = MATH_ADDITION[level]
  let a: number
  let b: number
  if (t.crossTen === 'always') {
    // Both addends 2..9 with a+b ≥ 11 ⇒ (a%10)+(b%10) = a+b ≥ 11, so every problem crosses.
    a = randInt(rnd, t.addendMin, 9)
    b = randInt(rnd, Math.max(t.addendMin, 11 - a), 9)
  } else if (t.crossTen === 'never') {
    a = randInt(rnd, t.addendMin, t.sumMax - t.addendMin)
    b = randInt(rnd, t.addendMin, t.sumMax - a)
  } else {
    a = randInt(rnd, t.addendMin, 10)
    b = randInt(rnd, t.addendMin, Math.min(10, t.sumMax - a))
  }
  return { a, b, answer: a + b }
}

/**
 * Minus Opgaver — the PRD's headline fix. Normal NEVER borrows (subtrahend ≤ the minuend's units
 * digit), so 18−6 / 15−3 is its shape: the same effort as Plus at Normal. Svær ALWAYS borrows.
 * The result is always ≥1, so there's a real subtraction to do.
 */
export const makeSubtractionProblem = (
  level: DifficultyLevel,
  rnd: Rnd = Math.random,
): OperationProblem => {
  const t = MATH_SUBTRACTION[level]

  if (t.borrow === 'always') {
    // Two-digit minuend, subtrahend strictly greater than its units digit → counting BACK across the
    // ten. 11 (units 1) still leaves 2..10, so the band is never empty.
    const a = randInt(rnd, 11, t.minuendMax)
    const b = randInt(rnd, (a % 10) + 1, a - 1)
    return { a, b, answer: a - b }
  }

  // No borrow. A single-digit minuend can never borrow (b ≤ a-1 < a = a%10), so the variety branch is
  // free; the two-digit branch clamps the subtrahend to the units digit and skips minuends ending in
  // 0 (units 0 leaves no legal subtrahend).
  const singleDigit = t.minuendMax <= 10 || rnd() < t.singleDigitShare
  if (singleDigit) {
    const a = randInt(rnd, 3, 9)
    const b = randInt(rnd, 1, a - 1)
    return { a, b, answer: a - b }
  }
  const a = randInt(rnd, 11, Math.min(19, t.minuendMax))
  const b = randInt(rnd, 1, a % 10)
  return { a, b, answer: a - b }
}

/**
 * The wrong answer tiles for Plus/Minus: near-answer confusions (off-by-one/two, and for Minus the
 * operands, which are the classic "read the wrong number off the sentence" error) clamped to the valid
 * result range. Random in-range values top up only when too few distinct confusables exist.
 */
export const operationDistractors = (
  op: 'addition' | 'subtraction',
  problem: OperationProblem,
  level: DifficultyLevel,
  count: number,
  rnd: Rnd = Math.random,
): number[] => {
  const { a, b, answer } = problem
  const isAddition = op === 'addition'
  const lo = isAddition ? 1 : 0
  // Subtraction results reach 19 at Normal/Svær, so distractors must span up to 20 there — otherwise a
  // correct answer of 15 could get only ≤10 distractors and be trivially obvious.
  const hi = isAddition ? 20 : level === 'let' ? 10 : 20
  const confusables = (
    isAddition ? [answer - 1, answer + 1, answer - 2, answer + 2] : [answer - 1, answer + 1, answer + 2, a, b]
  ).filter((c) => c >= lo && c <= hi && c !== answer)

  return fillDistinct(shuffle(confusables, rnd), count, () => {
    const r = randInt(rnd, lo, hi)
    return r === answer ? (r + 1 > hi ? lo : r + 1) : r
  })
}

// ================================================================================================
// Sammenlign Tal
// ================================================================================================

export interface ComparisonPair {
  left: number
  right: number
}

/**
 * Sammenlign Tal. Let: 1–10 with a gap ≥5 so the bigger number is obvious. Normal: 1–20, any distinct
 * pair. Svær: 1–20 with a gap of 1–2. Never equal (equality was dropped — one clear rule: tap the
 * bigger).
 */
export const makeComparisonPair = (
  level: DifficultyLevel,
  rnd: Rnd = Math.random,
): ComparisonPair => {
  const { max, gapMin, gapMax } = MATH_COMPARISON[level]
  const left = randInt(rnd, 1, max)
  const candidates: number[] = []
  for (let n = 1; n <= max; n++) {
    const gap = Math.abs(n - left)
    if (gap >= gapMin && gap <= gapMax) candidates.push(n)
  }
  // The bands above always leave at least one partner inside 1..max, but never trust that at runtime.
  const right = candidates.length > 0 ? pickOne(rnd, candidates) : left === max ? 1 : max
  return { left, right }
}

// ================================================================================================
// Tal Quiz
// ================================================================================================

/**
 * Swap a two-digit number's tens/units digit (23 → 32). `null` for single-digit or palindromic numbers
 * (11, 22, …) where the swap isn't a distinct confusable. This IS the lesson Tal Quiz tests: Danish
 * inverts the number word ("syvogtredive" = seven-and-thirty).
 */
export const swapDigits = (n: number): number | null => {
  if (n < 10) return null
  const tens = Math.floor(n / 10)
  const units = n % 10
  if (tens === units) return null
  return units * 10 + tens
}

/** The number Tal Quiz asks for, inside the level's range. */
export const pickQuizNumber = (level: DifficultyLevel, rnd: Rnd = Math.random): number =>
  randInt(rnd, 1, MATH_COUNTING[level].max)

/**
 * The minimum distance a `far` (Let) distractor must keep from the answer, DERIVED from the level's
 * own ceiling rather than fixed at 10.
 *
 * A flat 10 is unsatisfiable in a narrow range: inside 1–20 the only number ≥10 from 11 is 1, so the
 * generator silently fell through to a random top-up and Let produced boards like `11 → 1, 8, 11` —
 * the exact opposite of "maximally dissimilar". A quarter of the range is the same *relative* gap the
 * flat 10 gave at the old 1–50 ceiling, and it stays capped at 10 so a wider range can't demand more
 * separation than the policy ever intended.
 */
export const farMinGap = (max: number): number => Math.min(10, Math.max(3, Math.floor(max / 4)))

/**
 * Tal Quiz's wrong tiles.
 *   Let (`far`)         — `farMinGap(max)` away AND sharing neither digit position, so the options
 *                          read as maximally dissimilar.
 *   Normal (`near`)     — digit-swap + off-by-one/ten (the real confusions at this scale); small
 *                          counts have no meaningful swap/±10, so they bias to ±1/±2.
 *   Svær (`confusable`) — the digit-swap is ALWAYS offered when one exists (else ±1), then the near
 *                          neighbours fill in.
 */
export const numberDistractors = (
  n: number,
  level: DifficultyLevel,
  count: number,
  rnd: Rnd = Math.random,
): number[] => {
  const { max, distractors } = MATH_COUNTING[level]
  const valid = (c: number | null): c is number => c !== null && c >= 1 && c <= max && c !== n
  const swap = swapDigits(n)
  const topUp = () => {
    const r = randInt(rnd, 1, max)
    return r === n ? (r === max ? Math.max(1, max - 1) : r + 1) : r
  }

  if (distractors === 'far') {
    const gap = farMinGap(max)
    const far: number[] = []
    const justFar: number[] = []
    for (let c = 1; c <= max; c++) {
      if (!valid(c) || Math.abs(c - n) < gap) continue
      justFar.push(c)
      if (c % 10 === n % 10) continue
      if (Math.floor(c / 10) === Math.floor(n / 10)) continue
      far.push(c)
    }
    // Tiers, widest constraint first: both-digits-differ → merely ≥10 away → anything in range.
    return fillDistinct([...shuffle(far, rnd), ...shuffle(justFar, rnd)], count, topUp)
  }

  if (distractors === 'confusable') {
    // The swap goes FIRST so it is always present when one exists (§7 pins this).
    const head = valid(swap) ? [swap] : [n - 1, n + 1].filter(valid)
    const near = shuffle([n - 1, n + 1, n - 10, n + 10, n - 2, n + 2], rnd).filter(valid)
    return fillDistinct([...head, ...near], count, topUp)
  }

  const near = (n < 10 ? [n - 1, n + 1, n - 2, n + 2] : [swap, n - 1, n + 1, n - 10, n + 10]).filter(valid)
  return fillDistinct(shuffle(near, rnd), count, topUp)
}

// ================================================================================================
// Hvad Mangler?
// ================================================================================================

export interface NumberSequenceQuestion {
  kind: 'numbers'
  spec: SequenceSpec
  /** The complete sequence — `sequenceNumbers(spec)`. */
  numbers: number[]
  /** Index of the blanked element. Never 0 (the first slot gives no context to read from). */
  missingIndex: number
  missing: number
}

/** The visual repeating pattern branch. The TOKENS live in the component (they're CSS clay pips). */
export interface PatternSequenceQuestion {
  kind: 'pattern'
  /** Distinct tokens in the repeating unit (2 or 3) and the run length. */
  unitSize: number
  length: number
  missingIndex: number
}

export type SequenceQuestion = NumberSequenceQuestion | PatternSequenceQuestion

/**
 * One Hvad Mangler? question. The branch is drawn from the level's weights (count-by-1 / skip-2 /
 * skip-5 / skip-10, remainder = visual pattern) and the numeric start is drawn from
 * `sequenceSpecsForLevel`, so **every emitted sequence is one the enumerator baked** — `skip-10` no
 * longer emits the identical `10 20 30 40 50` forever.
 */
export const makeSequenceQuestion = (
  level: DifficultyLevel,
  rnd: Rnd = Math.random,
): SequenceQuestion => {
  const weights = MATH_SEQUENCE[level].weights
  const roll = rnd()
  let acc = 0
  let step: number | null = null
  for (let i = 0; i < SEQUENCE_STEPS.length; i++) {
    acc += weights[i]
    if (roll < acc) {
      step = SEQUENCE_STEPS[i]
      break
    }
  }

  if (step === null) {
    // Visual repeating pattern: ABAB? (5) or ABCABC? (6).
    const unitSize = rnd() < 0.5 ? 2 : 3
    const length = unitSize === 2 ? 5 : 6
    const missingIndex = rnd() < 0.6 ? length - 1 : randInt(rnd, 1, length - 1)
    return { kind: 'pattern', unitSize, length, missingIndex }
  }

  const specs = sequenceSpecsForLevel(level).filter((s) => s.step === step)
  const spec = pickOne(rnd, specs)
  const numbers = Array.from({ length: SEQUENCE_LENGTH }, (_, i) => spec.start + i * spec.step)
  // Prefer blanking the LAST or a middle slot; never the first, which gives no context.
  const missingIndex = rnd() < 0.5 ? SEQUENCE_LENGTH - 1 : randInt(rnd, 1, SEQUENCE_LENGTH - 1)
  return { kind: 'numbers', spec, numbers, missingIndex, missing: numbers[missingIndex] }
}

/**
 * Hvad Mangler?'s wrong tiles for a NUMERIC question: near-value neighbours first (a wrong option
 * should be a real sequence error, not a far +10 outlier), with +5/+10 as the fallback tail.
 */
export const sequenceDistractors = (
  correct: number,
  count: number,
  rnd: Rnd = Math.random,
): number[] => {
  const near = [...shuffle([correct - 2, correct - 1, correct + 1, correct + 2], rnd), correct + 5, correct + 10]
    .filter((c) => c >= 0 && c !== correct)
  let next = correct + 11
  return fillDistinct(near, count, () => next++)
}
