// Game Depth PRD-01 §3.11 — the task-shape bag. "About 1 in 3" must be EXACT per pass, and two
// alternates must never touch across a pass seam (a coin flip deals three in a row routinely).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeFormatBag, hasAlternate } from './formatBag.ts'

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

test('a share of 0 never deals an alternate', () => {
  const bag = makeFormatBag(0, seeded(1))
  for (let i = 0; i < 300; i++) assert.equal(bag.next(), 'main')
  assert.equal(hasAlternate(0), false)
  assert.equal(hasAlternate({ alt: 0, of: 3 }), false)
})

test('every pass of `of` tasks holds exactly `alt` alternates', () => {
  for (let seed = 1; seed < 40; seed++) {
    const bag = makeFormatBag({ alt: 1, of: 3 }, seeded(seed * 7919))
    for (let pass = 0; pass < 50; pass++) {
      const chunk = [bag.next(), bag.next(), bag.next()]
      assert.equal(chunk.filter((f) => f === 'alt').length, 1, `seed ${seed} pass ${pass}: ${chunk}`)
    }
  }
})

test('never two alternates in a row with alt 1 of 3 — the seam rule', () => {
  for (let seed = 1; seed < 60; seed++) {
    const bag = makeFormatBag({ alt: 1, of: 3 }, seeded(seed * 104729))
    let prev = 'main'
    for (let i = 0; i < 600; i++) {
      const f = bag.next()
      assert.ok(!(prev === 'alt' && f === 'alt'), `seed ${seed} draw ${i}: alt, alt`)
      prev = f
    }
  }
})

test('the alternate is not pinned to one position in the pass', () => {
  const positions = new Set<number>()
  const bag = makeFormatBag({ alt: 1, of: 3 }, seeded(99))
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i < 3; i++) if (bag.next() === 'alt') positions.add(i)
  }
  assert.ok(positions.size >= 2, `alternate only ever at ${[...positions]}`)
})
