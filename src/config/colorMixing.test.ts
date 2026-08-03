import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { primaryColors, possibleTargets, mixingRules, makeTargetBag, TARGET_PRIORITY } from './colorMixing.ts'
import { COLORS_RAMFARVEN, LEVELS } from './difficulty.ts'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

// Ram Farven's content guards. Two things here became correctness surfaces on 2026-08-03: the level
// now slices the TRAY out of `primaryColors` (so that array's order is load-bearing), and every pair
// of sources is supposed to make a real colour (so a wrong-but-valid mix can be named aloud).

const pairKey = (a: string, b: string) => `${a}+${b}`

test('every pair of sources makes a real colour — no dead-end mixes', () => {
  // Pinned as literals, not as `n*(n-1)/2`: the arithmetic moves with the data and would pass just as
  // happily against an empty source list.
  assert.equal(primaryColors.length, 5)
  assert.equal(Object.keys(mixingRules).length, 20) // 10 unordered pairs × both orders

  const missing: string[] = []
  let pairs = 0
  for (let i = 0; i < primaryColors.length; i++) {
    for (let j = i + 1; j < primaryColors.length; j++) {
      const a = primaryColors[i].colorName
      const b = primaryColors[j].colorName
      pairs++
      // BOTH orders must exist — the game keys on drop order, so one direction alone is a mix that
      // works or fails depending on which droplet the child grabbed first.
      for (const key of [pairKey(a, b), pairKey(b, a)]) {
        if (!mixingRules[key]) missing.push(key)
      }
    }
  }
  assert.equal(pairs, 10)
  assert.deepEqual(missing, [], `unmapped pairs: ${missing.join(', ')}`)
})

test('the recipe space is closed: every rule lands on a goal, every goal is reachable', () => {
  const targetNames = new Set(possibleTargets.map((t) => t.name))
  assert.equal(possibleTargets.length, 10)

  for (const [key, result] of Object.entries(mixingRules)) {
    assert.ok(targetNames.has(result.name), `${key} produces ${result.name}, which is not a goal`)
  }
  const produced = new Set(Object.values(mixingRules).map((r) => r.name))
  for (const t of possibleTargets) {
    assert.ok(produced.has(t.name), `${t.name} is a goal no rule can produce — unwinnable`)
  }

  // One name → one hex WITHIN this module (the cross-module drift vs colorContent.ts is a known,
  // separately-tracked defect and deliberately not asserted here).
  const hexOf = new Map<string, string>()
  for (const t of [...possibleTargets, ...Object.values(mixingRules)]) {
    const seen = hexOf.get(t.name)
    if (seen) assert.equal(t.hex, seen, `${t.name} has two hexes: ${seen} vs ${t.hex}`)
    else hexOf.set(t.name, t.hex)
  }
})

test('the source ORDER is load-bearing — the tray is sliced from its head, black last', () => {
  // The level's `sources` count slices this array, so a reorder silently changes which droplets each
  // level offers. Pinned by id.
  assert.deepEqual(
    primaryColors.map((c) => c.id),
    ['red', 'blue', 'yellow', 'white', 'black'],
  )
})

test('TARGET_PRIORITY is a permutation of the goals', () => {
  assert.deepEqual([...TARGET_PRIORITY].sort(), possibleTargets.map((t) => t.name).sort())
  // Long enough for the widest level, or that level's slice would silently come up short.
  const widest = Math.max(...LEVELS.map((l) => COLORS_RAMFARVEN[l].targets))
  assert.ok(TARGET_PRIORITY.length >= widest, `${TARGET_PRIORITY.length} names for ${widest} goals`)
})

test('every level can actually mix every goal it asks for', () => {
  // THE load-bearing one. The tables being right proves nothing: a bad slice, a reordered
  // `primaryColors`, or a TARGET_PRIORITY prefix that reaches a black-based goal before Let gets black
  // all produce a goal the child cannot possibly make — with nothing failing and nothing visible until
  // someone plays that level.
  const makeableFrom = (sources: number): Set<string> => {
    const tray = primaryColors.slice(0, sources).map((c) => c.colorName)
    const out = new Set<string>()
    for (const a of tray) for (const b of tray) {
      if (a !== b && mixingRules[pairKey(a, b)]) out.add(mixingRules[pairKey(a, b)].name)
    }
    return out
  }

  for (const level of LEVELS) {
    const { targets, sources } = COLORS_RAMFARVEN[level]
    const makeable = makeableFrom(sources)
    for (const goal of TARGET_PRIORITY.slice(0, targets)) {
      assert.ok(makeable.has(goal), `${level}: goal "${goal}" cannot be mixed from its ${sources} droplets`)
    }
  }

  // Let's tray, spelled out — it is the only trimmed one, so this is where a reorder bites.
  assert.deepEqual(
    primaryColors.slice(0, COLORS_RAMFARVEN.let.sources).map((c) => c.colorName),
    ['rød', 'blå', 'gul', 'hvid'],
  )
  // Four droplets make SIX colours while Let asks for four, and that headroom is deliberate: the two
  // spare tints are what the child stumbles into and now hears named. So this is a SUBSET invariant —
  // don't tighten it to equality (a first attempt did, and it failed against correct data).
  assert.deepEqual([...makeableFrom(4)].sort(), ['grøn', 'lilla', 'lyseblå', 'lysegul', 'lyserød', 'orange'])
  // Svær opens every pair, so its goal count is exactly the whole recipe space.
  assert.equal(COLORS_RAMFARVEN.svaer.targets, makeableFrom(5).size)
})

test('the bag draw spreads a level evenly and never repeats across the seam', () => {
  // Seeded LCG so the sampling is deterministic — same technique as the math generators.
  let seed = 12345
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const pool = ['lilla', 'orange', 'grøn', 'lyserød']
  for (let trial = 0; trial < 500; trial++) {
    const counts = new Map<string, number>()
    let previous: string | undefined
    // Two bags = one 8-mix Let round: every goal must appear exactly twice, and no two consecutive
    // draws may be equal — including the pair that straddles the refill.
    for (let bagN = 0; bagN < 2; bagN++) {
      const bag = makeTargetBag(pool, rnd, previous)
      assert.deepEqual([...bag].sort(), [...pool].sort(), 'a bag must be a full pass over the pool')
      for (const name of bag) {
        assert.notEqual(name, previous, 'two consecutive draws were the same goal')
        counts.set(name, (counts.get(name) ?? 0) + 1)
        previous = name
      }
    }
    for (const name of pool) assert.equal(counts.get(name), 2, `${name} appeared ${counts.get(name)}× in 8 mixes`)
  }

  // A single-entry pool cannot avoid repeating itself; it must still return that entry, not hang.
  assert.deepEqual(makeTargetBag(['grå'], rnd, 'grå'), ['grå'])
})

test('the game reads both level axes and draws from the bag', () => {
  // Source-read: the config being right is not the game USING it (the Tal Quiz lesson).
  const code = codeOf('components/farver/RamFarvenGame.tsx')
  assert.match(code, /COLORS_RAMFARVEN\[level\]\.sources/)
  assert.match(code, /COLORS_RAMFARVEN\[level\]\.targets/)
  assert.match(code, /makeTargetBag\(/)
  // The tray must not go back to a hardcoded column count now that the droplet count varies.
  assert.doesNotMatch(code, /gridTemplateColumns:\s*'repeat\(5, 1fr\)'/)
  // The ring must reserve real space (padding), never return to a percentage-sized absolute disc.
  assert.match(code, /p:\s*`\$\{GOAL_RING_PX\}px`/)
  assert.doesNotMatch(code, /width:\s*'118%'/)
})
