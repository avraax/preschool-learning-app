// Sværhedsgrad — the SINGLE definition of what Let / Normal / Svær mean, and every game's
// per-level parameter table (Difficulty PRD-01 W1).
//
// Why this file exists: `Sværhedsgrad` was added game-by-game with the anchor "Normal == exactly what
// this game did before", so nobody ever defined what the three levels MEAN. Each game then invented
// its own axis and they drifted — Minus at Normal was far harder than Plus at Normal, Bogstav Quiz's
// Svær was byte-identical to Normal, and three games ignored the setting entirely. Everything is
// declared here once and read by the games; nothing is re-derived inline.
//
// **NO ADAPTIVITY.** This is and stays a static, manual, adult-set level (standing owner rule).
// Nothing in this file — or anything reading it — looks at the child's performance.
//
// **PURE + NODE-IMPORTABLE.** No React, no side effects, and every import is a TYPE (erased at
// runtime). `shared-narration-clips.js` derives the baked sequence read-backs from this module, so
// relative imports in this graph need an explicit `.ts` extension (Node's ESM resolver rejects
// extensionless imports even though Vite/tsc accept them — see `.claude/rules/audio-system.md`).
import type { DifficultyLevel } from './progressSchema.ts'
import type { ColorPool } from './colorContent.ts'

export type { DifficultyLevel }

/** Every level, in escalating order. */
export const LEVELS: readonly DifficultyLevel[] = ['let', 'normal', 'svaer'] as const

// ================================================================================================
// 1. Narration ceilings — shared with the prebake enumerator
// ================================================================================================
// The per-level ranges below are shaped per game, but they all sit inside these ceilings, and
// `shared-narration-clips.js` bakes the full rectangle inside them. They live HERE (not in
// gamePhrases.ts, which re-exports them for back-compat) because they are difficulty bounds: a table
// below that outran a ceiling would silently drop that question's narration to live, unauditioned
// Azure — the exact failure mode `audio-system.md` warns about.

/** Largest addend in Plus Opgaver (all levels); sums stay ≤ 20. */
export const ADDEND_MAX = 10
/** Largest minuend in Minus Opgaver (all levels). */
export const MINUEND_MAX = 20
/** Largest number compared in Sammenlign Tal (both sides). */
export const COMPARE_MAX = 20
/** Largest number spoken anywhere (Tal Quiz's ceiling, Lær Tal's grid, every sequence element). */
export const NUMBER_MAX = 100
/** Elements in a Hvad Mangler? number sequence. */
export const SEQUENCE_LENGTH = 5

// ================================================================================================
// 2. The shared spine — what the three levels MEAN
// ================================================================================================
// | Axis          | Let                  | Normal                     | Svær                     |
// | Intent        | "kan det allerede"   | "kan det med lidt tanke"   | "næste års niveau"       |
// | First-try /8  | ~8                   | 7–8                        | 5–6                      |
// | Answer tiles  | 3                    | 4                          | 5                        |
// | Distractors   | maximally dissimilar | near — real confusions     | confusable-only          |
// | Content range | smallest             | inside his verified reach  | one step beyond          |
// | Stars         | 3★ 0 fejl · 2★ ≤2    | 3★ 0 fejl · 2★ ≤2          | 3★ ≤1 fejl · 2★ ≤3       |
//
// Owner rulings baked in: (1) Normal is COMFORT/fluency, not the edge — the stretch lives in Svær.
// (2) Subtraction across the ten is Svær-only. (3) Svær must never be a no-op — a level producing the
// same parameters as Normal is a bug, and `difficulty.test.ts` fails the build for it. (4) Choosing a
// harder level must not cost rewards → the Svær star tolerance, mirroring the standing rule that XP
// is never difficulty-dependent.

/** The default answer-tile count per level. Games with a different grid override it below. */
export const OPTION_COUNT: Record<DifficultyLevel, number> = { let: 3, normal: 4, svaer: 5 }

// `StarThresholds` / `STAR_THRESHOLDS` / `starThresholdsFor` are DELETED (Endless Play PRD-01 W3).
// They existed to hold ruling 4 — "a harder level must never cost rewards" — by making Svær's star
// budget looser. With stars gone that ruling is TRUE BY CONSTRUCTION: stars were the only channel
// through which a level could ever have cost the child anything, and XP was already
// difficulty-independent. Nothing replaces them; don't re-introduce a per-level score.

// ================================================================================================
// 3. Per-game tables (PRD §4)
// ================================================================================================

// ---- Math --------------------------------------------------------------------------------------

export interface CountingTuning {
  options: number
  /** Highest number the quiz can ask. */
  max: number
  /**
   * `far`        — differ in BOTH digit positions and by ≥10 (maximally dissimilar).
   * `near`       — digit-swap + off-by-one/ten (the real confusions at this scale).
   * `confusable` — the digit-swap is ALWAYS offered when one exists, else ±1.
   */
  distractors: 'far' | 'near' | 'confusable'
}

/**
 * Tal Quiz (`math.counting`). The task is hearing the INVERTED Danish number word ("syvogtredive" =
 * 37), and **Danish only inverts from 21** — 1–20 are ordinary words (tretten, nitten, tyve). That
 * split IS the range axis:
 *
 *   Let    1–20   no inverted compound at all — recognising numbers he already owns
 *   Normal 1–50   the inverted form, at the scale he counts to (~60% of questions)
 *   Svær   1–100  the full range, incl. the halv- tens (halvtreds/halvfjerds)
 *
 * The Let ceiling was 50 and Normal/Svær were BOTH 1–100 (owner play-test, 2026-08-02). So the range
 * wasn't an axis between Normal and Svær at all, and at "Let" 60% of questions were the hardest thing
 * the game has — measured boards like `ask 43 → 17, 20, 43`. The distractor policy remains the second,
 * independent axis; 1–100 is still the prebaked ceiling, so no level needs new narration.
 */
export const MATH_COUNTING: Record<DifficultyLevel, CountingTuning> = {
  let: { options: 3, max: 20, distractors: 'far' },
  normal: { options: 4, max: 50, distractors: 'near' },
  svaer: { options: 5, max: NUMBER_MAX, distractors: 'confusable' },
}

export interface AdditionTuning {
  options: number
  /** Largest sum. */
  sumMax: number
  /** Smallest addend (keeps the floor off "+1"). */
  addendMin: number
  /** Whether a problem may / must cross the ten (units digits summing ≥10). */
  crossTen: 'never' | 'allowed' | 'always'
}

/**
 * Plus Opgaver (`math.addition`). Normal KEEPS crossing the ten (8+7) on purpose: counting *on* to 20
 * on fingers is a skill he has. Svær always crosses — and since both addends are ≤ 10, a crossing sum
 * can't exceed 18 (19 = 9+10 and 20 = 10+10 don't cross), which is why the Svær sum band is 11–18.
 */
export const MATH_ADDITION: Record<DifficultyLevel, AdditionTuning> = {
  let: { options: 3, sumMax: 10, addendMin: 1, crossTen: 'never' },
  normal: { options: 4, sumMax: 20, addendMin: 2, crossTen: 'allowed' },
  svaer: { options: 5, sumMax: 18, addendMin: 2, crossTen: 'always' },
}

export interface SubtractionTuning {
  options: number
  /** Largest minuend. */
  minuendMax: number
  /** `never` → subtrahend ≤ the minuend's units digit; `always` → strictly greater. */
  borrow: 'never' | 'always'
  /** Share of problems kept single-digit for variety (0–1). */
  singleDigitShare: number
}

/**
 * Minus Opgaver (`math.subtraction`) — **the headline fix.** Normal used to draw minuend 2–20 with
 * ANY subtrahend, so a round was dominated by borrow problems (16−9), and PRD-15's countable
 * ten-frame was removed on 2026-08-02, leaving nothing on the board to count with. The no-borrow rule
 * makes 18−6 / 15−3 the Normal shape: the same effort as Plus at Normal, which is the acceptance test.
 * Counting BACK across the ten is the skill he doesn't have yet, so it is Svær-only.
 */
export const MATH_SUBTRACTION: Record<DifficultyLevel, SubtractionTuning> = {
  let: { options: 3, minuendMax: 10, borrow: 'never', singleDigitShare: 1 },
  normal: { options: 4, minuendMax: MINUEND_MAX, borrow: 'never', singleDigitShare: 0.4 },
  svaer: { options: 5, minuendMax: MINUEND_MAX, borrow: 'always', singleDigitShare: 0 },
}

export interface ComparisonTuning {
  /** Largest number on either card. */
  max: number
  /** Smallest / largest allowed |left − right|. */
  gapMin: number
  gapMax: number
}

/**
 * Sammenlign Tal (`math.comparison`). **Exempt from the TILE axis only** — the mechanic is two
 * numbers — so the GAP is its axis: obvious (Let) → clear (Normal) → place-value-close (Svær).
 *
 * **Normal's floor is 3, not 1** (2026-08-03). At `gapMin: 1` its band was a strict SUPERSET of
 * Svær's, so roughly one Normal question in five was a Svær question — 13 vs 14, which needs
 * two-digit place-value comparison rather than "which one is obviously bigger". It satisfied the
 * "no two levels identical" guard on a technicality while not existing as a step. The three bands are
 * now disjoint except where they should overlap (Normal's wide gaps are a superset of Let's, which is
 * correct — Let is Normal's easy end, restricted to 1–10).
 */
export const MATH_COMPARISON: Record<DifficultyLevel, ComparisonTuning> = {
  let: { max: 10, gapMin: 5, gapMax: 9 },
  normal: { max: COMPARE_MAX, gapMin: 3, gapMax: COMPARE_MAX - 1 },
  svaer: { max: COMPARE_MAX, gapMin: 1, gapMax: 2 },
}

export interface SequenceTuning {
  options: number
  /** Branch weights for {count-by-1, skip-2, skip-5, skip-10}; the remainder is the visual pattern. */
  weights: [number, number, number, number]
  /** Highest sequence START. Every element still has to land ≤ NUMBER_MAX. */
  maxStart: number
}

/**
 * Hvad Mangler? (`math.patterns`). Every sequence type now gets a level-scaled RANDOM start — a
 * content-bug fix, not tuning: `skip-10` used to emit the identical `10 20 30 40 50` every time, which
 * at Svær was 30% of all questions, and no range moved with the level at all.
 */
export const MATH_SEQUENCE: Record<DifficultyLevel, SequenceTuning> = {
  let: { options: 3, weights: [0.55, 0.15, 0.05, 0.05], maxStart: 10 },
  normal: { options: 4, weights: [0.25, 0.2, 0.15, 0.12], maxStart: 40 },
  svaer: { options: 5, weights: [0.1, 0.15, 0.3, 0.3], maxStart: 60 },
}

/** The four skip-counting steps Hvad Mangler? can ask, in the order the weights list them. */
export const SEQUENCE_STEPS = [1, 2, 5, 10] as const

export interface SequenceSpec {
  start: number
  step: number
}

/** The first legal start for a step: count-by-1 starts at 1, skip-2 at 0, the rest at the step. */
const firstStart = (step: number): number => (step === 1 ? 1 : step === 2 ? 0 : step)

/**
 * Every `{start, step}` a level can produce. Bounded twice — by the level's `maxStart` AND by
 * `NUMBER_MAX`, since the LAST element (`start + 4·step`) is what has to stay speakable.
 */
export const sequenceSpecsForLevel = (level: DifficultyLevel): SequenceSpec[] => {
  const { maxStart } = MATH_SEQUENCE[level]
  const out: SequenceSpec[] = []
  for (const step of SEQUENCE_STEPS) {
    for (let start = firstStart(step); start <= maxStart; start += step) {
      if (start + (SEQUENCE_LENGTH - 1) * step > NUMBER_MAX) break
      out.push({ start, step })
    }
  }
  return out
}

/**
 * The union over all levels — the whole reachable inventory of spoken sequence read-backs.
 * `gamePhrases.sequenceStarts` is exactly this, so the enumerator can never bake a narrower set than
 * the game can generate (a hand-copied list is what pinned skip-10 to a single start).
 */
export const allSequenceSpecs = (): SequenceSpec[] => {
  const seen = new Set<string>()
  const out: SequenceSpec[] = []
  for (const level of LEVELS) {
    for (const spec of sequenceSpecsForLevel(level)) {
      const key = `${spec.start}:${spec.step}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(spec)
    }
  }
  return out
}

export interface MemoryTuning {
  /** Pairs on the board (one board = one round). */
  pairs: number
}

/**
 * Hukommelse (`memory.letters` / `memory.numbers`). The LEVEL owns the board now — the old
 * "Hukommelse 10" + "Hukommelse 20 (svær)" pair of tiles collapsed into ONE child-facing tile per
 * section (the only place a difficulty was ever named in the child UI).
 */
export const MEMORY_BOARD: Record<DifficultyLevel, MemoryTuning> = {
  let: { pairs: 6 },
  normal: { pairs: 10 },
  svaer: { pairs: 15 },
}

// (`memoryStarThresholds` is DELETED with the stars it scaled — Endless Play PRD-01 W3.)

export interface BrowseRangeTuning {
  /** Highest number/last item shown in the browse grid. */
  max: number
}

/**
 * Lær Tal (`math.learn`) — an ungraded browse, so it's on the EXEMPT list; the range is the only
 * thing that responds. Let stays at his comfortable ~60 ceiling (6 clean rows of ≥44px tiles);
 * Normal/Svær show the full 100 (owner ask).
 */
export const MATH_LEARN: Record<DifficultyLevel, BrowseRangeTuning> = {
  let: { max: 60 },
  normal: { max: NUMBER_MAX },
  svaer: { max: NUMBER_MAX },
}

// ---- Alphabet ----------------------------------------------------------------------------------

export interface LetterQuizTuning {
  options: number
  /**
   * `exclude` — keep the correct letter's look-/sound-alike group OUT (maximally dissimilar).
   * `seed`    — fill from the group first, then random.
   * `only`    — the group is the WHOLE distractor set; random tops up only if it's too small.
   */
  confusables: 'exclude' | 'seed' | 'only'
}

/**
 * Bogstav Quiz (`alphabet.quiz`). Svær was **byte-identical to Normal** before this PRD
 * (`level === 'normal' || level === 'svaer'` seeded the same group) — the clearest dead level in the
 * app. Q stays distractor-only at every level (it's never the asked letter).
 */
export const ALPHABET_QUIZ: Record<DifficultyLevel, LetterQuizTuning> = {
  let: { options: 3, confusables: 'exclude' },
  normal: { options: 4, confusables: 'seed' },
  svaer: { options: 5, confusables: 'only' },
}

// ---- Ordleg ------------------------------------------------------------------------------------

export interface ReadTuning {
  options: number
  /** Longest PROMPT word. Never grows past 3 (standing owner rule: he can't spell yet). */
  wordMaxLen: number
  /** Whether distractor pictures may share the correct word's initial letter. */
  sharedInitials: boolean
}

/**
 * Læs Ordet (`ordleg.read`). Keeps **6** rather than 5 at Svær because its tiles are PICTURES, not
 * glyphs. Word length stays gentle at every level, so Svær's axis is picture count — never a longer
 * prompt word.
 */
export const ORDLEG_READ: Record<DifficultyLevel, ReadTuning> = {
  let: { options: 3, wordMaxLen: 2, sharedInitials: false },
  normal: { options: 4, wordMaxLen: 3, sharedInitials: false },
  svaer: { options: 6, wordMaxLen: 3, sharedInitials: true },
}

export interface SpellTuning {
  /** Prompt-word length band. */
  wordMinLen: number
  wordMaxLen: number
  /** Extra letter tiles beyond the word's own letters. */
  distractors: number
}

/**
 * Stav Ordet (`ordleg.spelling`) — **a new lever**: the game ignored the setting completely before.
 * Svær's 4-letter tier ships because the words it needs (hest/gris/fisk/…) already have baked art
 * reachable through `ordlegArt`'s fallback chain; see `src/config/ordlegWords.ts`.
 */
export const ORDLEG_SPELL: Record<DifficultyLevel, SpellTuning> = {
  let: { wordMinLen: 2, wordMaxLen: 2, distractors: 1 },
  normal: { wordMinLen: 2, wordMaxLen: 3, distractors: 3 },
  svaer: { wordMinLen: 3, wordMaxLen: 4, distractors: 4 },
}

// ---- English -----------------------------------------------------------------------------------

export interface EnglishTuning {
  options: number
  /**
   * `different` — distractors from OTHER themes only (maximally distinct).
   * `random`    — the mixed pool (the deliberate beginner floor).
   * `same`      — same-theme mates only (cow vs horse, not cow vs apple).
   */
  theme: 'different' | 'random' | 'same'
}

/**
 * Both English quizzes (`english.listen` / `.word`) share one table — the word POOL is identical at
 * every level (the deliberate beginner floor stays), so only tiles + distractor theme move. Their
 * distinct skills (audio→picture / picture→word) are untouched.
 *
 * There was a third, `english.translate` (Dansk til Engelsk — Danish word, no picture → English word).
 * Removed entirely 2026-08-03 at the owner's request.
 */
export const ENGLISH_QUIZ: Record<DifficultyLevel, EnglishTuning> = {
  let: { options: 3, theme: 'different' },
  normal: { options: 4, theme: 'random' },
  svaer: { options: 5, theme: 'same' },
}

// ---- Farver ------------------------------------------------------------------------------------

export interface ColorQuizTuning {
  options: number
  /**
   * `non-adjacent` — no distractor next to the answer on the hue wheel.
   * `random`       — any other hue.
   * `adjacent`     — wheel neighbours ONLY (rød/orange, blå/lilla).
   */
  hues: 'non-adjacent' | 'random' | 'adjacent'
  /** Which object pool the level asks from (`colorContent.ts`). */
  pool: ColorPool
  /** Wrong drops before the never-fail hint pulses AND names the colour. */
  hintAfter: number
}

/**
 * Hvilken Farve? (`colors.quiz`). Adjacency comes from `HUE_WHEEL` in `colorContent.ts`.
 *
 * **The object is DESATURATED at every level, and there is no axis that can undo that** (Difficulty
 * PRD-02, owner 2026-08-05). Shown in its true colour the answer is already on the board — the child
 * matches the fox's orange to the orange swatch without ever needing the word, the same "a board must
 * not restate its own answer" defect the owner removed from Tal Quiz and from Bogstav Quiz's old
 * "hear the letter, tap the letter" mode. PRD-01 confined it to Let as the youngest child's winnable
 * tier; that was still the giveaway, so the `reveal` axis is DELETED rather than narrowed. Don't
 * re-add it, in any form, at any level.
 *
 * Let is therefore eased on four axes that leak nothing: the smallest `pool` (only subjects whose
 * colour is unambiguous to a 5-year-old), 3 swatches, distractor hues kept OFF the answer's wheel
 * neighbours (so no near miss is even on the board), and the never-fail hint — which NAMES the
 * colour — after a single wrong drop instead of two. Svær stacks the other way: 5 swatches and
 * wheel-neighbours FIRST, so telling rød from orange is the task.
 */
export const COLORS_QUIZ: Record<DifficultyLevel, ColorQuizTuning> = {
  let: { options: 3, hues: 'non-adjacent', pool: 'obvious', hintAfter: 1 },
  normal: { options: 4, hues: 'random', pool: 'all', hintAfter: 2 },
  svaer: { options: 5, hues: 'adjacent', pool: 'all', hintAfter: 2 },
}

export interface FarvejagtTuning {
  /** How many OTHER hues contribute distractors; `null` = all of them. */
  distractorColors: number | null
  /** Distractors taken from each contributing hue. */
  perColor: number
}

/** Farvejagt (`colors.farvejagt`) — the tile axis maps onto board size (~6 / ~12 / ~20 items). */
export const COLORS_FARVEJAGT: Record<DifficultyLevel, FarvejagtTuning> = {
  let: { distractorColors: 3, perColor: 1 },
  normal: { distractorColors: null, perColor: 1 },
  svaer: { distractorColors: null, perColor: 2 },
}

export interface RamFarvenTuning {
  /** Size of the mixable-goal pool (walked in the game's `TARGET_PRIORITY` order). */
  targets: number
  /** Droplets the tray offers, taken from the HEAD of `primaryColors` — so 4 = no black. */
  sources: number
}

/**
 * Ram Farven (`colors.ramfarven`). Let grows from 3 to **4** goals: over an 8-mix round, 3 targets
 * repeat ~2.7× each, which reads as the game being stuck rather than easy.
 *
 * `sources` is the second axis, added 2026-08-03. The pool size used to be the ONLY thing a level
 * changed, and the side effect nobody noticed was that **black was a dead droplet at Let AND Normal**
 * — none of Let's 4 goals (the 3 secondaries + lyserød) or Normal's 6 (+ the white tints) use it, so
 * the youngest child stared at a source that could not be part of any answer while Normal, where such
 * a decoy is a genuine step up, got no credit for it. Now: Let offers only droplets that appear in
 * some answer, Normal introduces black AS the decoy (and because a wrong-but-valid mix is named
 * aloud, reaching for it teaches mørkerød rather than just failing), and Svær opens all 10 goals so
 * every pair is a real recipe and the child must aim instead of fish. Compare Nuancer's `decoy`.
 *
 * Let's pool (4) is deliberately BELOW the round length (8), contra the games-catalog "pool ≥ round"
 * rule: this pool is the mixable SPACE, not an arbitrary content list — only 10 pairs exist at all —
 * and under the bag draw (`makeTargetBag`) 4 goals over 8 mixes is two clean passes, not the random
 * clustering that rule exists to prevent. Don't "fix" it by padding Let with black-based goals.
 */
export const COLORS_RAMFARVEN: Record<DifficultyLevel, RamFarvenTuning> = {
  let: { targets: 4, sources: 4 },
  normal: { targets: 6, sources: 5 },
  svaer: { targets: 10, sources: 5 },
}

export interface NuancerTuning {
  /** Slots to fill, light→dark. */
  slots: number
  /** Whether the tray carries one shade from a DIFFERENT hue with no slot of its own. */
  decoy: boolean
}

/** Nuancer (`colors.nuancer`) — the tile axis maps onto the tray. */
export const COLORS_NUANCER: Record<DifficultyLevel, NuancerTuning> = {
  let: { slots: 2, decoy: false },
  normal: { slots: 3, decoy: false },
  svaer: { slots: 3, decoy: true },
}

// ================================================================================================
// 4. The registry + the exempt list
// ================================================================================================

/**
 * Every game's table, keyed by `gameId`. This is what `difficulty.test.ts` walks to assert that **no
 * non-exempt game has an identical parameter set at two levels** — the guard that would have caught
 * today's dead alphabet Svær, and the one that keeps this from drifting again.
 */
export const TUNING: Record<string, Record<DifficultyLevel, object>> = {
  'math.counting': MATH_COUNTING,
  'math.addition': MATH_ADDITION,
  'math.subtraction': MATH_SUBTRACTION,
  'math.comparison': MATH_COMPARISON,
  'math.patterns': MATH_SEQUENCE,
  'math.learn': MATH_LEARN,
  'memory.letters': MEMORY_BOARD,
  'memory.numbers': MEMORY_BOARD,
  'alphabet.quiz': ALPHABET_QUIZ,
  'ordleg.read': ORDLEG_READ,
  'ordleg.spelling': ORDLEG_SPELL,
  'english.listen': ENGLISH_QUIZ,
  'english.word': ENGLISH_QUIZ,
  'colors.quiz': COLORS_QUIZ,
  'colors.farvejagt': COLORS_FARVEJAGT,
  'colors.ramfarven': COLORS_RAMFARVEN,
  'colors.nuancer': COLORS_NUANCER,
}

/**
 * Games that legitimately do NOT respond to the level, each with its reason. Everything here is
 * skipped by the distinctness guard; everything NOT here must differ at all three levels.
 */
export const EXEMPT: Record<string, string> = {
  'alphabet.learn': 'ungraded browse — all 29 letters at every level',
  'math.learn': 'ungraded browse — responds only via its visible range (MATH_LEARN)',
  'english.learn': 'ungraded browse — the whole vocabulary at every level',
  'colors.learn': 'ungraded browse — all 6 hues and their shades at every level',
  'ordleg.mic': 'open-ended by design — there is no target word to grade',
}

/**
 * Games exempt from the ANSWER-TILE axis specifically (they still calibrate on other axes). Sammenlign
 * Tal's mechanic is two numbers, so a third card is meaningless; the drag games and Stav Ordet express
 * the same axis as board/tray/letter-pool size instead.
 */
export const TILE_AXIS_EXEMPT: Record<string, string> = {
  'math.comparison': 'two-number mechanic — the gap is its axis, not a tile count',
  'ordleg.spelling': 'letter tray, not answer tiles — the distractor COUNT is its axis',
  'colors.farvejagt': 'drag board — the axis is item count',
  'colors.ramfarven': 'drag bench — the axis is the target pool',
  'colors.nuancer': 'drag tray — the axis is slots + a decoy',
  'memory.letters': 'card board — the axis is pairs',
  'memory.numbers': 'card board — the axis is pairs',
}

/** Answer-tile counts per quiz, keyed by `gameId`. Læs Ordet keeps 6 at Svær (its tiles are pictures). */
export const OPTION_COUNTS: Record<string, Record<DifficultyLevel, number>> = {
  'math.counting': levelMap(MATH_COUNTING, (t) => t.options),
  'math.addition': levelMap(MATH_ADDITION, (t) => t.options),
  'math.subtraction': levelMap(MATH_SUBTRACTION, (t) => t.options),
  'math.patterns': levelMap(MATH_SEQUENCE, (t) => t.options),
  'alphabet.quiz': levelMap(ALPHABET_QUIZ, (t) => t.options),
  'ordleg.read': levelMap(ORDLEG_READ, (t) => t.options),
  'english.listen': levelMap(ENGLISH_QUIZ, (t) => t.options),
  'english.word': levelMap(ENGLISH_QUIZ, (t) => t.options),
  'colors.quiz': levelMap(COLORS_QUIZ, (t) => t.options),
}

function levelMap<T>(
  table: Record<DifficultyLevel, T>,
  read: (t: T) => number,
): Record<DifficultyLevel, number> {
  return { let: read(table.let), normal: read(table.normal), svaer: read(table.svaer) }
}

/**
 * The answer-tile count for a quiz at a level — resolved centrally so the config quizzes stop
 * hand-rolling it. An unknown `gameId` falls back to the spine's 3/4/5.
 */
export const optionCountFor = (gameId: string | undefined, level: DifficultyLevel): number =>
  (gameId ? OPTION_COUNTS[gameId]?.[level] : undefined) ?? OPTION_COUNT[level]
