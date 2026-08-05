// The bag's semantics, and the MEASURED before/after that says W1 actually changed what the child is
// asked (Practice Loop PRD-01 §3.3).
//
// The numbers below are pinned as LITERALS, not derived from the same functions the product uses — a
// derived pin agrees with itself while the product regresses. The "before" column is the old draw
// (sampling with replacement from the identical pool), simulated here rather than quoted from the PRD,
// because the PRD's own estimate for Læs Ordet turned out to be a guess.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makePromptBag } from './promptBag.ts'
import { PROMPT_POOLS } from './promptPools.ts'
import { LEVELS, type DifficultyLevel } from './difficulty.ts'

/** Seeded LCG — same technique as the math generators, so every number here is reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const rnd = seeded(20260804)

// ---- Semantics (§3.1) ----------------------------------------------------------------------------

test('1. a pass yields every item exactly once', () => {
  const pool = ['a', 'b', 'c', 'd', 'e']
  const bag = makePromptBag(pool, { rnd })
  const pass = Array.from({ length: pool.length }, () => bag.next())
  assert.deepEqual([...pass].sort(), [...pool].sort())
})

test('2. no item repeats within the WINDOW, including across the pass seam', () => {
  // The seam is where the naive fix fails: two bags, and the repeat straddles them. With window 2
  // (makeTargetBag's `avoidFirst`) only the adjacent pair is protected; with window = the round length
  // a whole round is protected wherever it starts.
  for (const window of [2, 8]) {
    for (let trial = 0; trial < 200; trial++) {
      const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
      const bag = makePromptBag(pool, { rnd, window })
      const drawn = Array.from({ length: 60 }, () => bag.next())
      for (let i = 0; i < drawn.length; i++) {
        for (let j = i + 1; j < Math.min(i + window, drawn.length); j++) {
          assert.notEqual(drawn[j], drawn[i], `window ${window}: ${drawn[i]} repeated ${j - i} draws later`)
        }
      }
    }
  }
})

test('2b. a pool SMALLER than the window degrades instead of hanging', () => {
  // Nuancer asks 8 questions over 6 hues, so a repeat inside the round is arithmetic, not a bug. What
  // must hold is that all 6 appear before any comes back — the repeat lands as late as it can.
  const pool = ['rød', 'blå', 'grøn', 'gul', 'lilla', 'orange']
  const bag = makePromptBag(pool, { rnd, window: 8 })
  const drawn = Array.from({ length: 24 }, () => bag.next())
  for (let start = 0; start + 6 <= drawn.length; start += 6) {
    assert.equal(new Set(drawn.slice(start, start + 6)).size, 6, 'a full pass must still cover the pool')
  }
})

test('3. a pool of 1 returns that item forever', () => {
  const bag = makePromptBag(['grå'], { rnd, window: 8 })
  assert.deepEqual(Array.from({ length: 5 }, () => bag.next()), ['grå', 'grå', 'grå', 'grå', 'grå'])
})

test('4. reset() is idempotent for an unchanged pool — the pass keeps walking', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f']
  const bag = makePromptBag(pool, { rnd })
  const first = [bag.next(), bag.next()]
  // A mid-game difficulty change that doesn't move the pool must NOT restart the pass; otherwise every
  // adult-menu poke reshuffles and the no-repeat guarantee erodes.
  for (let i = 0; i < 4; i++) bag.reset([...pool])
  const rest = [bag.next(), bag.next(), bag.next(), bag.next()]
  assert.deepEqual([...first, ...rest].sort(), [...pool].sort(), 'the pass restarted, so an item repeated')

  // A pool that DID change deals from the new one immediately.
  bag.reset(['x', 'y'])
  assert.ok(['x', 'y'].includes(bag.next()))
})

test('5. rnd is injectable — two bags on the same seed deal the same pass', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const draw = () => {
    const bag = makePromptBag(pool, { rnd: seeded(77), window: 4 })
    return Array.from({ length: 20 }, () => bag.next()).join('')
  }
  assert.equal(draw(), draw())
})

test('requeue puts an item back at the promised distance (W2 depends on this)', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const bag = makePromptBag(pool, { rnd, window: 8 })
  const missed = bag.next()
  bag.requeue(missed, 3)
  const following = [bag.next(), bag.next(), bag.next()]
  assert.equal(following[2], missed, `re-ask landed at ${following.indexOf(missed) + 1}, not 3`)

  // A re-miss RE-schedules rather than stacking copies.
  bag.requeue(missed, 2)
  bag.requeue(missed, 4)
  const after = Array.from({ length: 6 }, () => bag.next())
  assert.equal(after.filter((i) => i === missed).length, 1, 'requeue stacked duplicate copies')

  // Outrunning the remaining pass puts it at the FRONT of the NEXT one, not nowhere — the rest of the
  // current pass is dealt first (§4.3: "if fewer draws remain, it goes to the front of the next pass").
  const small = makePromptBag(['p', 'q'], { rnd, window: 2 })
  const drawn = small.next()
  const other = drawn === 'p' ? 'q' : 'p'
  small.requeue(drawn, 9)
  assert.deepEqual([small.next(), small.next()], [other, drawn], 'the re-ask must open the next pass')
})

// ---- The measured before/after (§3.3) ------------------------------------------------------------

const TRIALS = 200

interface Measured {
  repeatRate: number
  minDistinct: number
}

/** Round up the way a percentage is read, so a pinned literal is stable across trial counts. */
const round2 = (n: number) => Math.round(n * 100) / 100

/** `draw` is called TRIALS × round times as one continuing session, sliced into rounds. */
const measure = (draw: () => string, round: number): Measured => {
  let repeats = 0
  let minDistinct = round
  for (let trial = 0; trial < TRIALS; trial++) {
    const asked = Array.from({ length: round }, draw)
    const distinct = new Set(asked).size
    if (distinct < asked.length) repeats++
    minDistinct = Math.min(minDistinct, distinct)
  }
  return { repeatRate: round2(repeats / TRIALS), minDistinct }
}

const measureGame = (
  pool: readonly unknown[],
  key: (i: unknown) => string,
  round: number,
): { before: Measured; after: Measured } => {
  // BEFORE: the shipped draw until now — `pool[Math.floor(Math.random() * pool.length)]`, i.e. sampling
  // WITH REPLACEMENT. Anti-repeat windows (Læs Ordet's recent-3, Hvilken Farve's avoid-previous) bounded
  // adjacency only, so they are deliberately not modelled: they do not change this number materially.
  const beforeRnd = seeded(31337)
  const before = measure(() => key(pool[Math.floor(beforeRnd() * pool.length)]), round)
  // AFTER: the bag, as one session across many rounds (the bag lives for the life of the screen, so a
  // round can start mid-pass — which is exactly why the window has to be the round length).
  const bag = makePromptBag(pool, { key, rnd: seeded(31337), window: round })
  const after = measure(() => key(bag.next()), round)
  return { before, after }
}

/**
 * The pinned measurement. `before` is what shipped until W1; `after` is what ships now. Every value is a
 * literal — including the pool sizes, so a pool that silently shrinks below its round length fails here
 * rather than quietly reintroducing repeats.
 */
type Pinned = { pool: number; round: number; before: number; beforeWorst: number; after: number; distinct: number }
const EXPECTED: Record<string, Record<DifficultyLevel, Pinned>> = {
  // The headline case: 8 questions, 28 letters, and two thirds of rounds asked something twice. The
  // worst measured round asked only 5 distinct letters out of 28.
  'alphabet.quiz': {
    let: { pool: 28, round: 8, before: 0.67, beforeWorst: 5, after: 0, distinct: 8 },
    normal: { pool: 28, round: 8, before: 0.67, beforeWorst: 5, after: 0, distinct: 8 },
    svaer: { pool: 28, round: 8, before: 0.67, beforeWorst: 5, after: 0, distinct: 8 },
  },
  'english.listen': {
    let: { pool: 74, round: 8, before: 0.28, beforeWorst: 5, after: 0, distinct: 8 },
    normal: { pool: 74, round: 8, before: 0.28, beforeWorst: 5, after: 0, distinct: 8 },
    svaer: { pool: 74, round: 8, before: 0.28, beforeWorst: 5, after: 0, distinct: 8 },
  },
  'english.word': {
    let: { pool: 74, round: 8, before: 0.28, beforeWorst: 5, after: 0, distinct: 8 },
    normal: { pool: 74, round: 8, before: 0.28, beforeWorst: 5, after: 0, distinct: 8 },
    svaer: { pool: 74, round: 8, before: 0.28, beforeWorst: 5, after: 0, distinct: 8 },
  },
  // Læs Ordet's Let pool was grown 5 -> 9 words in response to the owner's "reads as stuck rather than
  // easy", and it did not help: 98% of Let rounds still repeated a word, and the worst asked THREE
  // distinct words in eight questions. This is the number the PRD asked to measure rather than trust —
  // it guessed the recent-3 window already bounded it, and a window bounds adjacency, not frequency.
  'ordleg.read': {
    let: { pool: 9, round: 8, before: 0.98, beforeWorst: 3, after: 0, distinct: 8 },
    normal: { pool: 26, round: 8, before: 0.68, beforeWorst: 4, after: 0, distinct: 8 },
    svaer: { pool: 26, round: 8, before: 0.68, beforeWorst: 4, after: 0, distinct: 8 },
  },
  // Let's pool is EXACTLY the round length, so with replacement essentially every round repeated.
  'ordleg.spelling': {
    let: { pool: 8, round: 8, before: 1, beforeWorst: 3, after: 0, distinct: 8 },
    normal: { pool: 35, round: 8, before: 0.52, beforeWorst: 5, after: 0, distinct: 8 },
    svaer: { pool: 42, round: 8, before: 0.51, beforeWorst: 5, after: 0, distinct: 8 },
  },
  // Difficulty PRD-02 moved this game's pools: the object is desaturated at every level now, so the six
  // non-canonical colours are askable nowhere (18, not 24) and LET asks only the 12 unambiguous
  // subjects. Let is therefore the SMALLEST pool here and the one the old draw served worst.
  'colors.quiz': {
    let: { pool: 12, round: 8, before: 0.97, beforeWorst: 4, after: 0, distinct: 8 },
    normal: { pool: 18, round: 8, before: 0.8, beforeWorst: 4, after: 0, distinct: 8 },
    svaer: { pool: 18, round: 8, before: 0.8, beforeWorst: 4, after: 0, distinct: 8 },
  },
  // Nuancer asks 8 orderings over 6 hues, so a repeat inside the round is arithmetic — `after` stays 1.
  // What changed: every round now shows all 6 hues (the worst measured round used to show 3).
  'colors.nuancer': {
    let: { pool: 6, round: 8, before: 1, beforeWorst: 3, after: 1, distinct: 6 },
    normal: { pool: 6, round: 8, before: 1, beforeWorst: 3, after: 1, distinct: 6 },
    svaer: { pool: 6, round: 8, before: 1, beforeWorst: 3, after: 1, distinct: 6 },
  },
  // 5 boards from 6 colours: the worst measured round hunted the SAME colour five times.
  'colors.farvejagt': {
    let: { pool: 6, round: 5, before: 0.9, beforeWorst: 1, after: 0, distinct: 5 },
    normal: { pool: 6, round: 5, before: 0.9, beforeWorst: 1, after: 0, distinct: 5 },
    svaer: { pool: 6, round: 5, before: 0.9, beforeWorst: 1, after: 0, distinct: 5 },
  },
}

test('every game that draws a prompt is measured', () => {
  assert.deepEqual(
    PROMPT_POOLS.map((p) => p.gameId).sort(),
    Object.keys(EXPECTED).sort(),
    'a game was added to PROMPT_POOLS without a measured before/after',
  )
})

test('the bag removes in-round repeats — measured, per game, per level', () => {
  for (const spec of PROMPT_POOLS) {
    for (const level of LEVELS) {
      const pool = spec.pool(level)
      const expect = EXPECTED[spec.gameId][level]
      const where = `${spec.gameId} @ ${level}`

      assert.equal(pool.length, expect.pool, `${where}: pool is ${pool.length}, pinned at ${expect.pool}`)
      // The round length is pinned too: it is the bag's no-repeat WINDOW, so a round that grows past
      // what was measured silently reintroduces the repeat this whole work item removed.
      assert.equal(spec.round, expect.round, `${where}: round is ${spec.round}, pinned at ${expect.round}`)

      const { before, after } = measureGame(pool, spec.key, spec.round)
      // The "before" is a measurement of the OLD draw over today's pool, so it is allowed to move a
      // little with the pool; a wide tolerance still fails if someone claims an improvement that isn't
      // one (i.e. if `before` collapses toward `after`).
      assert.ok(
        Math.abs(before.repeatRate - expect.before) <= 0.06,
        `${where}: the old draw measured ${before.repeatRate}, pinned at ${expect.before}`,
      )
      // The "after" is an INVARIANT, not a measurement — it must be exactly this.
      assert.equal(after.repeatRate, expect.after, `${where}: the bag repeats in ${after.repeatRate} of rounds`)
      assert.equal(
        after.minDistinct,
        expect.distinct,
        `${where}: a round asked only ${after.minDistinct} distinct items`,
      )
      // The WORST round is the number a child actually notices — "the game keeps asking the same thing".
      assert.equal(
        before.minDistinct,
        expect.beforeWorst,
        `${where}: the old draw's worst round asked ${before.minDistinct} distinct, pinned at ${expect.beforeWorst}`,
      )
      // And the improvement is real, not a rounding artefact.
      assert.ok(after.repeatRate <= before.repeatRate, `${where}: the bag is no better than random`)
      assert.ok(after.minDistinct > before.minDistinct, `${where}: the bag's worst round is no better`)
    }
  }
})
