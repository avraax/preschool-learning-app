import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADDEND_MAX,
  ALPHABET_QUIZ,
  COLORS_FARVEJAGT,
  COLORS_NUANCER,
  COLORS_QUIZ,
  COLORS_RAMFARVEN,
  COMPARE_MAX,
  ENGLISH_QUIZ,
  EXEMPT,
  LEVELS,
  MATH_ADDITION,
  MATH_COMPARISON,
  MATH_COUNTING,
  MATH_LEARN,
  MATH_SEQUENCE,
  MATH_SUBTRACTION,
  MEMORY_BOARD,
  MINUEND_MAX,
  NUMBER_MAX,
  OPTION_COUNT,
  OPTION_COUNTS,
  ORDLEG_READ,
  ORDLEG_SPELL,
  SEQUENCE_LENGTH,
  STAR_THRESHOLDS,
  TILE_AXIS_EXEMPT,
  TUNING,
  allSequenceSpecs,
  memoryStarThresholds,
  optionCountFor,
  sequenceSpecsForLevel,
  type DifficultyLevel,
} from './difficulty.ts'
import {
  crossesTen,
  makeAdditionProblem,
  makeComparisonPair,
  makeSequenceQuestion,
  makeSubtractionProblem,
  numberDistractors,
  operationDistractors,
  pickQuizNumber,
  farMinGap,
  sequenceDistractors,
  swapDigits,
} from './mathProblems.ts'
import { sequenceFactText, sequenceNumbers, sequenceStarts } from './gamePhrases.ts'
import { confusablePoolFor } from './letterConfusables.ts'
import { WORD_LETTERS } from './letterWords.ts'
import { ALL_SPELLING_WORDS, READING_ROUND_LENGTH, READING_WORDS, spellingWordsFor, spokenOrdlegWords } from './ordlegWords.ts'
import { collectNarrationClips } from '../../shared-narration-clips.js'

// Difficulty PRD-01 §7. Three independent kinds of guard, because each one alone passes vacuously:
//
//   1. PIN THE VALUES. `difficulty.ts` and the games read the same table, so "the game matches the
//      table" is trivially true — the §4 numbers are asserted literally here instead.
//   2. SAMPLE THE BEHAVIOUR. A table can say `borrow: 'never'` while the generator borrows anyway, so
//      each behavioural invariant is sampled over thousands of generated problems per level.
//   3. NO DEAD LEVEL. A level that produces the same parameters as its neighbour is a bug (that's what
//      shipped for Bogstav Quiz's Svær), so the whole registry is diffed level-against-level.

const SAMPLES = 2000

test('the shared spine is exactly this', () => {
  assert.deepEqual([...LEVELS], ['let', 'normal', 'svaer'])
  // Answer tiles: 3 / 4 / 5.
  assert.deepEqual(OPTION_COUNT, { let: 3, normal: 4, svaer: 5 })
  // Stars in MISTAKES. Svær is more forgiving on purpose: choosing a harder level must not cost the
  // child stars, the same fairness rule that keeps XP difficulty-independent.
  assert.deepEqual(STAR_THRESHOLDS, {
    let: { three: 0, two: 2 },
    normal: { three: 0, two: 2 },
    svaer: { three: 1, two: 3 },
  })
})

test('the narration ceilings are exactly these (the tables must stay inside them)', () => {
  assert.equal(ADDEND_MAX, 10)
  assert.equal(MINUEND_MAX, 20)
  assert.equal(COMPARE_MAX, 20)
  assert.equal(NUMBER_MAX, 100)
  assert.equal(SEQUENCE_LENGTH, 5)
})

test('the §4 per-game tables are exactly these values', () => {
  assert.deepEqual(MATH_COUNTING, {
    let: { options: 3, max: 20, distractors: 'far' },
    normal: { options: 4, max: 50, distractors: 'near' },
    svaer: { options: 5, max: 100, distractors: 'confusable' },
  })
  assert.deepEqual(MATH_ADDITION, {
    let: { options: 3, sumMax: 10, addendMin: 1, crossTen: 'never' },
    normal: { options: 4, sumMax: 20, addendMin: 2, crossTen: 'allowed' },
    svaer: { options: 5, sumMax: 18, addendMin: 2, crossTen: 'always' },
  })
  assert.deepEqual(MATH_SUBTRACTION, {
    let: { options: 3, minuendMax: 10, borrow: 'never', singleDigitShare: 1 },
    normal: { options: 4, minuendMax: 20, borrow: 'never', singleDigitShare: 0.4 },
    svaer: { options: 5, minuendMax: 20, borrow: 'always', singleDigitShare: 0 },
  })
  assert.deepEqual(MATH_COMPARISON, {
    let: { max: 10, gapMin: 5, gapMax: 9 },
    normal: { max: 20, gapMin: 3, gapMax: 19 },
    svaer: { max: 20, gapMin: 1, gapMax: 2 },
  })
  assert.deepEqual(MATH_SEQUENCE, {
    let: { options: 3, weights: [0.55, 0.15, 0.05, 0.05], maxStart: 10 },
    normal: { options: 4, weights: [0.25, 0.2, 0.15, 0.12], maxStart: 40 },
    svaer: { options: 5, weights: [0.1, 0.15, 0.3, 0.3], maxStart: 60 },
  })
  assert.deepEqual(MEMORY_BOARD, { let: { pairs: 6 }, normal: { pairs: 10 }, svaer: { pairs: 15 } })
  assert.deepEqual(MATH_LEARN, { let: { max: 60 }, normal: { max: 100 }, svaer: { max: 100 } })
  assert.deepEqual(ALPHABET_QUIZ, {
    let: { options: 3, confusables: 'exclude' },
    normal: { options: 4, confusables: 'seed' },
    svaer: { options: 5, confusables: 'only' },
  })
  assert.deepEqual(ORDLEG_READ, {
    let: { options: 3, wordMaxLen: 2, sharedInitials: false },
    normal: { options: 4, wordMaxLen: 3, sharedInitials: false },
    // 6, not 5: Læs Ordet's tiles are PICTURES, so a 3×2 grid still reads.
    svaer: { options: 6, wordMaxLen: 3, sharedInitials: true },
  })
  assert.deepEqual(ORDLEG_SPELL, {
    let: { wordMinLen: 2, wordMaxLen: 2, distractors: 1 },
    normal: { wordMinLen: 2, wordMaxLen: 3, distractors: 3 },
    svaer: { wordMinLen: 3, wordMaxLen: 4, distractors: 4 },
  })
  assert.deepEqual(ENGLISH_QUIZ, {
    let: { options: 3, theme: 'different' },
    normal: { options: 4, theme: 'random' },
    svaer: { options: 5, theme: 'same' },
  })
  // `reveal` is the load-bearing one: 'colour' puts the answer on the board (the fox IS orange next
  // to an orange swatch), so only Let may use it.
  assert.deepEqual(COLORS_QUIZ, {
    let: { options: 3, hues: 'non-adjacent', reveal: 'colour' },
    normal: { options: 4, hues: 'random', reveal: 'grey' },
    svaer: { options: 5, hues: 'adjacent', reveal: 'grey' },
  })
  assert.deepEqual(COLORS_FARVEJAGT, {
    let: { distractorColors: 3, perColor: 1 },
    normal: { distractorColors: null, perColor: 1 },
    svaer: { distractorColors: null, perColor: 2 },
  })
  // Let grows from 3 to 4 goals: with 3, an 8-mix round repeats each ~2.7×.
  assert.deepEqual(COLORS_RAMFARVEN, { let: { targets: 4 }, normal: { targets: 6 }, svaer: { targets: 9 } })
  assert.deepEqual(COLORS_NUANCER, {
    let: { slots: 2, decoy: false },
    normal: { slots: 3, decoy: false },
    svaer: { slots: 3, decoy: true },
  })
})

// ------------------------------------------------------------------------------------------------
// The guard that keeps this from drifting again
// ------------------------------------------------------------------------------------------------

test('no non-exempt game has an identical parameter set at two levels', () => {
  const dead: string[] = []
  for (const [gameId, table] of Object.entries(TUNING)) {
    if (gameId in EXEMPT) continue
    for (let i = 0; i < LEVELS.length; i++) {
      for (let j = i + 1; j < LEVELS.length; j++) {
        const a = JSON.stringify(table[LEVELS[i]])
        const b = JSON.stringify(table[LEVELS[j]])
        if (a === b) dead.push(`${gameId}: ${LEVELS[i]} === ${LEVELS[j]} (${a})`)
      }
    }
  }
  // This is the guard that would have caught Bogstav Quiz's Svær, which was byte-identical to Normal.
  assert.deepEqual(dead, [], 'a level that produces the same parameters as another is a dead level')
})

test('every non-exempt game is in the registry, and every exempt one carries a reason', () => {
  for (const [gameId, reason] of Object.entries(EXEMPT)) {
    assert.ok(reason.length > 10, `${gameId} needs a real reason, not "${reason}"`)
  }
  for (const [gameId, reason] of Object.entries(TILE_AXIS_EXEMPT)) {
    assert.ok(reason.length > 10, `${gameId} needs a real tile-axis reason`)
    assert.ok(!(gameId in OPTION_COUNTS), `${gameId} is tile-axis exempt but declares an option count`)
  }
  // Everything with a table is either calibrated on all three levels or listed as exempt — no silent
  // third state.
  for (const gameId of Object.keys(TUNING)) {
    assert.ok(
      gameId in EXEMPT || LEVELS.every((l) => TUNING[gameId][l] !== undefined),
      `${gameId} has no tuning for every level and is not exempt`,
    )
  }
})

test('option counts resolve to 3/4/5 for every quiz (Læs Ordet 3/4/6)', () => {
  const expected: Record<string, [number, number, number]> = {
    'math.counting': [3, 4, 5],
    'math.addition': [3, 4, 5],
    'math.subtraction': [3, 4, 5],
    'math.patterns': [3, 4, 5],
    'alphabet.quiz': [3, 4, 5],
    'ordleg.read': [3, 4, 6],
    'english.listen': [3, 4, 5],
    'english.word': [3, 4, 5],
    'english.translate': [3, 4, 5],
    'colors.quiz': [3, 4, 5],
  }
  assert.deepEqual(Object.keys(OPTION_COUNTS).sort(), Object.keys(expected).sort())
  for (const [gameId, want] of Object.entries(expected)) {
    assert.deepEqual(
      LEVELS.map((l) => optionCountFor(gameId, l)),
      want,
      gameId,
    )
  }
  // An unknown gameId falls back to the spine rather than to a broken grid.
  assert.deepEqual(LEVELS.map((l) => optionCountFor('nope.nope', l)), [3, 4, 5])
  assert.deepEqual(LEVELS.map((l) => optionCountFor(undefined, l)), [3, 4, 5])
})

// ------------------------------------------------------------------------------------------------
// Sampled behaviour — Plus / Minus (the owner's actual complaint)
// ------------------------------------------------------------------------------------------------

test('Plus Let never passes ten; sums stay ≤10', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const { a, b, answer } = makeAdditionProblem('let')
    assert.equal(answer, a + b)
    assert.ok(answer <= 10, `Let sum ${a}+${b}=${answer} exceeds 10`)
    assert.ok(!crossesTen(a, b), `Let ${a}+${b} crosses the ten`)
    assert.ok(a >= 1 && b >= 1 && a <= ADDEND_MAX && b <= ADDEND_MAX)
  }
})

test('Plus Normal: both addends ≥2, sums ≤20', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const { a, b, answer } = makeAdditionProblem('normal')
    assert.ok(a >= 2 && b >= 2, `Normal addend below 2: ${a}+${b}`)
    assert.ok(answer <= 20, `Normal sum ${answer} exceeds 20`)
    assert.ok(a <= ADDEND_MAX && b <= ADDEND_MAX, `Normal addend above ADDEND_MAX: ${a}+${b}`)
  }
})

test('Plus Svær ALWAYS crosses the ten', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const { a, b, answer } = makeAdditionProblem('svaer')
    assert.ok(crossesTen(a, b), `Svær ${a}+${b} does not cross the ten`)
    assert.ok(answer >= 11 && answer <= 18, `Svær sum ${answer} outside 11–18`)
    assert.ok(a <= ADDEND_MAX && b <= ADDEND_MAX)
  }
})

test('Minus Let stays ≤10 and never borrows', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const { a, b, answer } = makeSubtractionProblem('let')
    assert.ok(a <= 10, `Let minuend ${a} exceeds 10`)
    assert.ok(b <= a % 10, `Let ${a}-${b} borrows`)
    assert.ok(answer >= 1, `Let ${a}-${b} has no real result`)
  }
})

test('Minus Normal NEVER borrows (the headline fix), reaches 20, and keeps some single-digit variety', () => {
  let singleDigit = 0
  let twoDigit = 0
  let maxMinuend = 0
  for (let i = 0; i < SAMPLES; i++) {
    const { a, b, answer } = makeSubtractionProblem('normal')
    // The whole point: the subtrahend never exceeds the minuend's units digit, so there is nothing to
    // regroup — 18−6 and 15−3, not 16−9. The countable ten-frame was removed on 2026-08-02, so a borrow
    // problem at Normal has nothing on the board to work it out with.
    assert.ok(b <= a % 10, `Normal ${a}-${b} borrows`)
    assert.ok(a <= MINUEND_MAX, `Normal minuend ${a} exceeds MINUEND_MAX`)
    assert.ok(answer >= 1)
    if (a < 10) singleDigit++
    else twoDigit++
    maxMinuend = Math.max(maxMinuend, a)
  }
  assert.ok(maxMinuend > 10, 'Normal should reach past 10')
  assert.ok(singleDigit > SAMPLES * 0.25, `too little single-digit variety: ${singleDigit}/${SAMPLES}`)
  assert.ok(twoDigit > SAMPLES * 0.4, `too few two-digit problems: ${twoDigit}/${SAMPLES}`)
})

test('Minus Svær ALWAYS borrows and lives in 11–20', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const { a, b, answer } = makeSubtractionProblem('svaer')
    assert.ok(b > a % 10, `Svær ${a}-${b} does not borrow`)
    assert.ok(a >= 11 && a <= MINUEND_MAX, `Svær minuend ${a} outside 11–20`)
    assert.ok(answer >= 1)
  }
})

test('Plus/Minus answer tiles: the right count, distinct, in range, never the answer twice', () => {
  for (const op of ['addition', 'subtraction'] as const) {
    for (const level of LEVELS) {
      const want = optionCountFor(`math.${op === 'addition' ? 'addition' : 'subtraction'}`, level) - 1
      for (let i = 0; i < 400; i++) {
        const problem = op === 'addition' ? makeAdditionProblem(level) : makeSubtractionProblem(level)
        const picks = operationDistractors(op, problem, level, want)
        assert.equal(picks.length, want, `${op}/${level} gave ${picks.length} distractors`)
        assert.equal(new Set(picks).size, want, `${op}/${level} duplicated a distractor`)
        assert.ok(!picks.includes(problem.answer), `${op}/${level} offered the answer as a distractor`)
      }
    }
  }
})

// ------------------------------------------------------------------------------------------------
// Sampled behaviour — Sammenlign Tal
// ------------------------------------------------------------------------------------------------

test('Sammenlign: never equal, inside the level range, inside the level gap band', () => {
  for (const level of LEVELS) {
    const { max, gapMin, gapMax } = MATH_COMPARISON[level]
    for (let i = 0; i < SAMPLES; i++) {
      const { left, right } = makeComparisonPair(level)
      assert.notEqual(left, right, `${level} produced an equal pair`)
      assert.ok(left >= 1 && left <= max && right >= 1 && right <= max, `${level}: ${left} vs ${right} out of range`)
      const gap = Math.abs(left - right)
      assert.ok(gap >= gapMin && gap <= gapMax, `${level}: gap ${gap} outside ${gapMin}–${gapMax}`)
      assert.ok(Math.max(left, right) <= COMPARE_MAX)
    }
  }
})

// The gap IS this game's difficulty axis (it's EXEMPT from the tile axis), so a level whose band
// contains another level's band isn't a step — it's the same game with extra dice. Normal shipped at
// gapMin 1, i.e. a strict superset of Svær's 1–2, so ~1 in 5 Normal questions was a Svær question
// (13 vs 14 — two-digit place-value comparison). The pinned table above would happily accept that
// again, since it just records whatever the numbers are; this asserts the RELATIONSHIP.
test('Sammenlign: Normal does not serve Svær-tight pairs', () => {
  const normal = MATH_COMPARISON.normal
  const svaer = MATH_COMPARISON.svaer
  assert.ok(
    normal.gapMin > svaer.gapMax,
    `Normal's gap floor (${normal.gapMin}) must sit above Svær's ceiling (${svaer.gapMax}) — otherwise Normal contains Svær and stops being its own level`,
  )
  // And prove it on real output, not just on the table: no sampled Normal pair may be Svær-tight.
  for (let i = 0; i < SAMPLES; i++) {
    const { left, right } = makeComparisonPair('normal')
    assert.ok(
      Math.abs(left - right) > svaer.gapMax,
      `Normal produced ${left} vs ${right}, a gap of ${Math.abs(left - right)} — that's a Svær pair`,
    )
  }
})

// ------------------------------------------------------------------------------------------------
// Sampled behaviour — Tal Quiz
// ------------------------------------------------------------------------------------------------

// The gap is `farMinGap(max)` — a quarter of the range, capped at 10 — not a flat 10, which is
// unsatisfiable inside 1–20 (nothing is 10 from 11 except 1). The literal 5 is pinned rather than
// recomputed from the helper: a test that calls the same formula agrees with itself for free.
test('Tal Quiz Let: every distractor is ≥5 away from the answer (a quarter of the 1–20 range)', () => {
  assert.equal(farMinGap(MATH_COUNTING.let.max), 5)
  for (let i = 0; i < SAMPLES; i++) {
    const n = pickQuizNumber('let')
    assert.ok(n >= 1 && n <= 20, `Let asked for ${n}, outside 1–20`)
    for (const d of numberDistractors(n, 'let', 2)) {
      assert.ok(Math.abs(d - n) >= 5, `Let offered ${d} against ${n} (only ${Math.abs(d - n)} away)`)
      assert.ok(d >= 1 && d <= 20)
    }
  }
})

// The rule, not just the number: Danish inverts from 21 up ("enogtyve" = one-and-twenty), which is the
// hardest thing this game asks. At Let it must never come up — nothing on the board, prompt or tile.
// Before the owner's 2026-08-02 play-test the Let ceiling was 50, so 60% of Let questions were an
// inverted compound and measured boards looked like `ask 43 → 17, 20, 43`.
test('Tal Quiz Let never asks or offers an inverted Danish number word (21+)', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const n = pickQuizNumber('let')
    assert.ok(n <= 20, `Let asked ${n} — "${n}" inverts in Danish`)
    for (const d of numberDistractors(n, 'let', 2)) {
      assert.ok(d <= 20, `Let offered ${d} against ${n} — "${d}" inverts in Danish`)
    }
  }
})

// The range has to be a real axis at all three levels. Normal and Svær were BOTH 1–100, so between
// them only the distractor policy moved — half a level of separation.
test('Tal Quiz: each level widens the range strictly', () => {
  assert.ok(
    MATH_COUNTING.let.max < MATH_COUNTING.normal.max &&
      MATH_COUNTING.normal.max < MATH_COUNTING.svaer.max,
    `ranges must strictly widen, got ${MATH_COUNTING.let.max}/${MATH_COUNTING.normal.max}/${MATH_COUNTING.svaer.max}`,
  )
  for (let i = 0; i < SAMPLES; i++) {
    assert.ok(pickQuizNumber('normal') <= MATH_COUNTING.normal.max)
    assert.ok(pickQuizNumber('svaer') <= MATH_COUNTING.svaer.max)
  }
})

test('Tal Quiz Svær ALWAYS offers the digit-swap when one exists', () => {
  let swappable = 0
  for (let i = 0; i < SAMPLES; i++) {
    const n = pickQuizNumber('svaer')
    const swap = swapDigits(n)
    const picks = numberDistractors(n, 'svaer', 4)
    assert.equal(picks.length, 4)
    assert.equal(new Set(picks).size, 4)
    assert.ok(!picks.includes(n))
    if (swap === null) continue
    swappable++
    // Danish inverts the number word ("syvogtredive" = seven-and-thirty), so 37-vs-73 IS the lesson.
    assert.ok(picks.includes(swap), `Svær asked ${n} without offering ${swap}`)
  }
  assert.ok(swappable > SAMPLES * 0.5, 'expected most Svær numbers to have a digit-swap')
})

test('Tal Quiz Normal: distractors are near, distinct and in range', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const n = pickQuizNumber('normal')
    const picks = numberDistractors(n, 'normal', 3)
    assert.equal(picks.length, 3)
    assert.equal(new Set(picks).size, 3)
    assert.ok(!picks.includes(n))
    for (const d of picks) assert.ok(d >= 1 && d <= NUMBER_MAX)
  }
})

// ------------------------------------------------------------------------------------------------
// Sampled behaviour — Hvad Mangler?
// ------------------------------------------------------------------------------------------------

test('every Hvad Mangler sequence stays ≤100 and is one the enumerator baked', () => {
  const baked = new Set(sequenceStarts.map((s) => `${s.start}:${s.step}`))
  for (const level of LEVELS) {
    let numeric = 0
    let pattern = 0
    for (let i = 0; i < SAMPLES; i++) {
      const q = makeSequenceQuestion(level)
      if (q.kind === 'pattern') {
        pattern++
        assert.ok(q.missingIndex >= 1 && q.missingIndex < q.length, `${level}: pattern blank at ${q.missingIndex}`)
        continue
      }
      numeric++
      assert.equal(q.numbers.length, SEQUENCE_LENGTH)
      assert.ok(Math.max(...q.numbers) <= NUMBER_MAX, `${level}: sequence reaches ${Math.max(...q.numbers)}`)
      assert.ok(q.numbers.every((n) => n >= 0))
      // Never the first slot — it gives no context to read the step from.
      assert.ok(q.missingIndex >= 1 && q.missingIndex < SEQUENCE_LENGTH)
      assert.equal(q.missing, q.numbers[q.missingIndex])
      assert.ok(
        baked.has(`${q.spec.start}:${q.spec.step}`),
        `${level}: {start:${q.spec.start}, step:${q.spec.step}} has no prebaked read-back`,
      )
    }
    assert.ok(numeric > 0 && pattern > 0, `${level} should produce both numeric and visual questions`)
  }
})

test('skip-10 no longer emits one fixed sequence, and the starts scale with the level', () => {
  // The bug: `sequenceStarts` was a hardcoded list whose only skip-10 entry was `{start: 10}`, so
  // "10 20 30 40 50" was ~30% of every Svær round, every round, forever.
  const skip10 = (level: DifficultyLevel) => sequenceSpecsForLevel(level).filter((s) => s.step === 10)
  assert.equal(skip10('let').length, 1)
  assert.equal(skip10('normal').length, 4)
  assert.equal(skip10('svaer').length, 6)
  assert.deepEqual(
    LEVELS.map((l) => sequenceSpecsForLevel(l).length),
    [19, 73, 109],
  )
  // Each level's set is a subset of the next, so the union IS Svær's set.
  assert.equal(allSequenceSpecs().length, 109)
  assert.equal(sequenceStarts.length, 109)
  for (const spec of allSequenceSpecs()) {
    assert.ok(Math.max(...sequenceNumbers(spec)) <= NUMBER_MAX, `spec ${spec.start}/${spec.step} runs past 100`)
  }
})

test('Hvad Mangler distractors fill the tile count without duplicating the answer', () => {
  for (const level of LEVELS) {
    const want = optionCountFor('math.patterns', level) - 1
    for (let i = 0; i < 400; i++) {
      const q = makeSequenceQuestion(level)
      if (q.kind !== 'numbers') continue
      const picks = sequenceDistractors(q.missing, want)
      assert.equal(picks.length, want)
      assert.equal(new Set(picks).size, want)
      assert.ok(!picks.includes(q.missing))
      assert.ok(picks.every((n) => n >= 0))
    }
  }
})

// ------------------------------------------------------------------------------------------------
// Bogstav Quiz — the level that was dead
// ------------------------------------------------------------------------------------------------

test('at Svær, every askable letter can fill 4 confusable distractors with no random top-up', () => {
  const need = ALPHABET_QUIZ.svaer.options - 1
  const thin = WORD_LETTERS.filter((l) => confusablePoolFor(l).length < need)
  // Without the broad shape/sound tier, the tight groups top out at 3 mates and Svær would fall through
  // to random letters — i.e. straight back to being Normal-with-an-extra-tile.
  assert.deepEqual(thin, [], 'these letters have too few confusables for a genuine Svær board')
  for (const l of WORD_LETTERS) {
    assert.ok(!confusablePoolFor(l).includes(l), `${l} is its own confusable`)
    assert.equal(new Set(confusablePoolFor(l)).size, confusablePoolFor(l).length, `${l} has duplicate mates`)
  }
})

test('at Let, excluding every confusable still leaves enough letters for a board', () => {
  const need = ALPHABET_QUIZ.let.options - 1
  for (const l of WORD_LETTERS) {
    const excluded = new Set([l, ...confusablePoolFor(l)])
    assert.ok(29 - excluded.size >= need, `${l} leaves only ${29 - excluded.size} dissimilar letters`)
  }
})

// ------------------------------------------------------------------------------------------------
// Ordleg + Memory
// ------------------------------------------------------------------------------------------------

test('Stav Ordet has a real pool at every level, and Svær genuinely reaches 4 letters', () => {
  for (const level of LEVELS) {
    const { wordMinLen, wordMaxLen } = ORDLEG_SPELL[level]
    const pool = spellingWordsFor(level)
    assert.ok(pool.length >= 8, `${level} pool is only ${pool.length} words`)
    for (const w of pool) {
      assert.ok(
        w.word.length >= wordMinLen && w.word.length <= wordMaxLen,
        `${level}: "${w.word}" is outside ${wordMinLen}–${wordMaxLen} letters`,
      )
    }
  }
  // The art gate: Svær ships the 4-letter tier, so it must actually contain 4-letter words.
  assert.ok(spellingWordsFor('svaer').some((w) => w.word.length === 4), 'Svær has no 4-letter word')
  assert.ok(spellingWordsFor('let').every((w) => w.word.length === 2))
})

test('Stav Ordet words are spellable from the tile alphabet (no Q/W/X)', () => {
  // The letter tiles deliberately omit Q, W and X, so a word containing one is unspellable — the game
  // would hand the child a slot no tile can fill.
  const TILE_ALPHABET = new Set('ABCDEFGHIJKLMNOPRSTUVYZÆØÅ')
  for (const w of ALL_SPELLING_WORDS) {
    for (const ch of w.word.toUpperCase()) {
      assert.ok(TILE_ALPHABET.has(ch), `"${w.word}" needs the letter ${ch}, which has no tile`)
    }
  }
})

test('Læs Ordet never grows past 3-letter prompt words at any level', () => {
  // Standing owner rule: he can't spell yet, so Svær's axis is picture COUNT, never a longer word.
  for (const level of LEVELS) assert.ok(ORDLEG_READ[level].wordMaxLen <= 3)
  for (const w of READING_WORDS) assert.ok(w.word.length <= 3, `"${w.word}" is too long for Læs Ordet`)
})

// A pool smaller than the round has to repeat words inside one round, which reads as the game being
// stuck rather than easy — the same complaint that grew Ram Farven's Let target pool. Let's pool WAS 5
// words for 8 questions, and the old guard here asked only for `>= 4`, so it passed happily. Tying it
// to READING_ROUND_LENGTH is what makes the rule real: raise the round and this fails first.
test('every level has at least a full round of distinct Læs Ordet words', () => {
  for (const level of LEVELS) {
    const { wordMaxLen } = ORDLEG_READ[level]
    const pool = READING_WORDS.filter((w) => w.word.length <= wordMaxLen)
    assert.ok(
      pool.length >= READING_ROUND_LENGTH,
      `Læs Ordet at ${level} draws from ${pool.length} words for a ${READING_ROUND_LENGTH}-question round`,
    )
    assert.equal(new Set(pool.map((w) => w.word)).size, pool.length, `${level} pool has a duplicate`)
  }
})

test('memory star thresholds scale with the board and keep the 10-pair curve', () => {
  // 10 pairs at Normal must still be the reachable {9, 18} PRD-05 P3 tuned.
  assert.deepEqual(memoryStarThresholds(10, 'normal'), { three: 9, two: 18 })
  assert.deepEqual(memoryStarThresholds(6, 'let'), { three: 5, two: 11 })
  // Svær = the 15-pair board, and it gets the spine's EXTRA tolerance over Normal (+1/+1) on top.
  assert.deepEqual(memoryStarThresholds(15, 'svaer'), { three: 15, two: 28 })
  for (const level of LEVELS) {
    const pairs = MEMORY_BOARD[level].pairs
    const t = memoryStarThresholds(pairs, level)
    assert.ok(t.three < t.two, `${level}: the 3-star budget must be stricter than the 2-star one`)
    assert.ok(t.three >= 1, `${level}: a memory board with zero mistake tolerance is unreachable`)
  }
})

// ------------------------------------------------------------------------------------------------
// Prebake coverage (the gate the PRD calls out)
// ------------------------------------------------------------------------------------------------

test('every widened sequence read-back and every Ordleg word is enumerated for prebake', () => {
  const enumerated = new Set(collectNarrationClips().map((c: { text: string }) => c.text))
  for (const spec of allSequenceSpecs()) {
    // The read-back the game actually speaks, built by the same builder the enumerator calls. Widening
    // the starts without re-deriving `sequenceStarts` would drop 91 of these to live Azure.
    assert.ok(
      enumerated.has(sequenceFactText(sequenceNumbers(spec))),
      `no prebaked read-back for the sequence starting ${spec.start} step ${spec.step}`,
    )
  }
  for (const word of spokenOrdlegWords()) {
    assert.ok(enumerated.has(word), `Ordleg speaks "${word}" but it is not enumerated for prebake`)
  }
  assert.ok(spokenOrdlegWords().length >= 45, 'the Ordleg spoken-word set looks truncated')
})
