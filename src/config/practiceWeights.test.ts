// The practice ledger's decision logic, its effect on a real bag, and the mechanical form of "this is
// NOT adaptive difficulty" (Practice Loop PRD-01 W2).
//
// The offsets are pinned as LITERALS. The simulation then drives the REAL wiring
// (`wirePracticeReask` + `makePromptBag`) rather than a re-implementation of it — a test that re-derived
// "and then it requeues" would keep passing after the product stopped doing it, which is exactly the
// vacuity /re-break exists to catch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MAX_FRONT_LOADED,
  REQUEUE_BASE,
  REQUEUE_MISS_CAP,
  frontLoadKeys,
  requeueAhead,
  wirePracticeReask,
  type PracticeSource,
} from './practiceWeights.ts'
import { makePromptBag } from './promptBag.ts'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

// ---- The rule, as literals -----------------------------------------------------------------------

test('the re-ask distance expands with each miss, then stops', () => {
  // `2 + min(misses, 3)`, pinned by VALUE — not recomputed from the constants, which would agree with
  // itself after a re-tune. The shape is what matters: soon the first time, further out each time, and
  // never past the cap (expanding retrieval, not exile).
  assert.equal(requeueAhead(1), 3)
  assert.equal(requeueAhead(2), 4)
  assert.equal(requeueAhead(3), 5)
  assert.equal(requeueAhead(4), 5)
  assert.equal(requeueAhead(50), 5)
  // Defensive inputs: a 0-miss / negative / fractional count must not produce "the very next draw".
  assert.equal(requeueAhead(0), 2)
  assert.equal(requeueAhead(-3), 2)
  assert.equal(requeueAhead(1.9), 3)
  assert.equal(REQUEUE_BASE, 2)
  assert.equal(REQUEUE_MISS_CAP, 3)
})

test('at most 2 of a pool front-load a pass, worst first', () => {
  assert.equal(MAX_FRONT_LOADED, 2)
  const misses: Record<string, number> = { A: 5, B: 1, C: 9, D: 0, E: 3 }
  // Worst first, capped at 2 — C(9) then A(5). E(3) and B(1) wait for a later pass; a round must not
  // become a drill of the same three letters, which is the failure mode that makes a 5-year-old quit.
  assert.deepEqual(frontLoadKeys(['A', 'B', 'C', 'D', 'E'], (k) => misses[k] ?? 0), ['C', 'A'])
  // Nothing missed → nothing front-loaded: a fresh child's rounds are pure shuffle, and none of this is
  // visible until he has actually got something wrong.
  assert.deepEqual(frontLoadKeys(['A', 'B'], () => 0), [])
  // Ties keep the pool's own order, so a refill is deterministic.
  assert.deepEqual(frontLoadKeys(['A', 'B', 'C'], () => 2), ['A', 'B'])
})

test('the most-missed items LEAD the next pass, worst first', () => {
  // The pure `frontLoadKeys` ranking is asserted above; this is the wiring half — that the ranking
  // actually reaches a pass. Without it the whole front-load is inert with both tests still green.
  const misses: Record<string, number> = { C: 9, A: 5 }
  const pool = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  const bag = makePromptBag(pool, {
    rnd: seeded(555),
    window: 8,
    frontLoad: (live) => frontLoadKeys(live as readonly string[], (k) => misses[k] ?? 0),
  })
  assert.deepEqual([bag.next(), bag.next()], ['C', 'A'], 'the pass does not open with the most-missed')
  // …and the rest of the pass is still a full, non-repeating cover of the pool.
  const rest = Array.from({ length: pool.length - 2 }, () => bag.next())
  assert.deepEqual([...rest, 'C', 'A'].sort(), [...pool].sort())
})

// ---- The simulation: the child who always misses Æ ------------------------------------------------

/** A ledger stand-in with the real interface, so the wiring under test is the shipping one. */
const fakeSource = () => {
  const misses = new Map<string, number>()
  const listeners = new Set<(g: string, k: string, m: number) => void>()
  return {
    missesFor: (gameId: string, itemKey: string) => misses.get(`${gameId}:${itemKey}`) ?? 0,
    onMiss(l: (g: string, k: string, m: number) => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    /** What the game's resolve does on a wrong tap. */
    recordMiss(gameId: string, itemKey: string) {
      const id = `${gameId}:${itemKey}`
      const next = (misses.get(id) ?? 0) + 1
      misses.set(id, next)
      listeners.forEach((l) => l(gameId, itemKey, next))
    },
  } satisfies PracticeSource & { recordMiss: (g: string, k: string) => void }
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'Æ', 'Ø', 'Å']
const ROUND = 8

test('a missed item comes back within 3 questions — and the round stays varied', () => {
  const source = fakeSource()
  const rnd = seeded(4242)
  const bag = makePromptBag(LETTERS, {
    rnd,
    window: ROUND,
    frontLoad: (pool) => frontLoadKeys(pool as readonly string[], (k) => source.missesFor('alphabet.quiz', k)),
  })
  const stop = wirePracticeReask<string>({
    gameId: 'alphabet.quiz',
    bag,
    poolAt: () => LETTERS,
    keyOf: (l) => l,
    source,
  })

  // Play 25 rounds of 8. He gets Æ wrong EVERY time it is asked, and everything else right.
  const asked: string[] = []
  const gapsAfterMiss: number[] = []
  let sinceMiss = -1
  for (let q = 0; q < 25 * ROUND; q++) {
    const item = bag.next()
    asked.push(item)
    if (sinceMiss >= 0) {
      sinceMiss++
      if (item === 'Æ') {
        gapsAfterMiss.push(sinceMiss)
        sinceMiss = -1
      }
    }
    if (item === 'Æ') {
      source.recordMiss('alphabet.quiz', 'Æ')
      sinceMiss = 0
    }
  }
  stop()

  // THE assertion this work item exists for: after a miss, Æ is re-asked within `requeueAhead` draws —
  // 3 the first time, never more than 5. Before W2, the next Æ was wherever the shuffle put it, which
  // over a 15-item pool averaged ~15 questions and could be 29.
  assert.ok(gapsAfterMiss.length >= 10, `only ${gapsAfterMiss.length} re-asks measured — sim too short?`)
  assert.ok(gapsAfterMiss[0] <= 3, `the first re-ask came ${gapsAfterMiss[0]} questions later, not <= 3`)
  assert.ok(
    Math.max(...gapsAfterMiss) <= REQUEUE_BASE + REQUEUE_MISS_CAP,
    `a re-ask came ${Math.max(...gapsAfterMiss)} questions later, past the cap`,
  )

  // …and the drill guard: a round still shows plenty of DIFFERENT letters. This is the number that goes
  // wrong if someone raises MAX_FRONT_LOADED or shortens the requeue — the child would be answering the
  // same three letters, which is what makes him quit.
  let worstDistinct = ROUND
  let worstAeCount = 0
  for (let r = 0; r + ROUND <= asked.length; r += ROUND) {
    const round = asked.slice(r, r + ROUND)
    worstDistinct = Math.min(worstDistinct, new Set(round).size)
    worstAeCount = Math.max(worstAeCount, round.filter((l) => l === 'Æ').length)
  }
  assert.ok(worstDistinct >= 6, `a round asked only ${worstDistinct} distinct letters`)
  assert.ok(worstAeCount <= 3, `Æ filled ${worstAeCount} of ${ROUND} questions in one round`)
})

test('a miss for a DIFFERENT game never touches this bag', () => {
  const source = fakeSource()
  const bag = makePromptBag(LETTERS, { rnd: seeded(7), window: ROUND })
  const seen: string[] = []
  wirePracticeReask<string>({
    gameId: 'alphabet.quiz',
    bag,
    poolAt: () => LETTERS,
    keyOf: (l) => l,
    source,
    onUnknownKey: (k) => seen.push(k),
  })
  const first = Array.from({ length: 5 }, () => bag.next())
  source.recordMiss('english.listen', 'cat')
  const after = Array.from({ length: 5 }, () => bag.next())
  assert.deepEqual(seen, [], 'a miss from another game reached this bag')
  assert.equal(new Set([...first, ...after]).size, 10, 'the pass was disturbed by another game')
})

test('a miss whose key is not in the pool is REPORTED, not silently dropped', () => {
  // The write point hands over a plain string. If it is not the bag's key the re-ask simply never
  // happens, and nothing about play looks different — so it has to be loud.
  const source = fakeSource()
  const bag = makePromptBag(LETTERS, { rnd: seeded(9), window: ROUND })
  const unknown: string[] = []
  wirePracticeReask<string>({
    gameId: 'alphabet.quiz',
    bag,
    poolAt: () => LETTERS,
    keyOf: (l) => l,
    source,
    onUnknownKey: (k) => unknown.push(k),
  })
  source.recordMiss('alphabet.quiz', 'not-a-letter')
  assert.deepEqual(unknown, ['not-a-letter'])
})

// ---- "This is not adaptivity", mechanically -------------------------------------------------------

test('the practice layer cannot reach the difficulty layer', () => {
  // `difficulty.ts`'s header says nothing reading it may look at the child's performance. That rule is
  // still true, and THIS is what keeps it true: misses and levels are separated by construction, so a
  // future session can see the feature is legal rather than deleting it on sight.
  //
  // Note the PRD's literal phrasing ("no `difficultyFor()` call site may import the ledger") is not the
  // rule enforced here, because it is unsatisfiable: Stav Ordet legitimately reads its level to build a
  // pool AND records a miss. The enforceable rule is stronger where it matters — nothing that decides a
  // level can READ a miss.
  const weights = codeOf('config/practiceWeights.ts')
  assert.ok(!weights.includes('difficulty'), 'practiceWeights must not import difficulty.ts')
  assert.ok(!/^import /m.test(weights), 'practiceWeights imports something — keep it import-free')

  // The difficulty layer must not read the practice layer, in either direction.
  for (const rel of ['config/difficulty.ts', 'config/mathProblems.ts']) {
    const code = codeOf(rel)
    assert.ok(!code.includes('practiceLedger'), `${rel} must not read the practice ledger`)
    assert.ok(!code.includes('practiceWeights'), `${rel} must not read practice weights`)
  }
})

test('only the prompt bag may READ a miss — games may only record one', () => {
  // The ledger's read surface is what a level could theoretically be a function of, so it has exactly
  // one consumer. Games get `recordAttempt` and nothing else; a component that wanted to branch on
  // misses would have to add itself to this list, which is the review moment.
  // `practiceWeights.ts` DECLARES the read surface (its `PracticeSource` interface) and is the layer
  // allowed to think about misses at all — it is separately guarded above against reaching difficulty.
  // `usePromptBag.ts` is the only place a real ledger is passed in.
  const READERS = ['hooks/usePromptBag.ts', 'config/practiceWeights.ts']
  const offenders: string[] = []
  const walk = (dir: string): string[] =>
    readdirSync(path.join(SRC, dir)).flatMap((entry) => {
      const rel = `${dir}/${entry}`
      if (statSync(path.join(SRC, rel)).isDirectory()) return walk(rel)
      return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [rel] : []
    })
  for (const rel of [...walk('components'), ...walk('hooks'), ...walk('services'), ...walk('config')]) {
    if (rel.endsWith('services/practiceLedger.ts')) continue // the ledger itself defines them
    const code = codeOf(rel)
    if (/\b(missesFor|entryFor)\s*\(/.test(code) && !READERS.includes(rel.replace(/^\.\//, ''))) {
      offenders.push(rel)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these read a miss count: ${offenders.join(', ')} — only the prompt bag may (see the header)`,
  )
})
