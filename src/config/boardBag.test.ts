// GUARD 8 (Endless Play PRD-01 §W7 / D7): the Memory board's full-pool cycling.
//
// The behaviour this replaces was `shuffle(pool).slice(0, boardPairs)` per board — a draw WITH
// replacement across boards. At 15 pairs from 29 letters that meant the same letters came back board
// after board while others were never dealt at all, which in ENDLESS play is the whole experience.
//
// Three properties, and the third is the one a naive "just deal from a pass" implementation gets
// wrong: when a pass runs out MID-BOARD, the refill must skip whatever is already on that board.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeBoardBag } from './boardBag.ts'

/** Seeded LCG — same technique as promptBag.test.ts, so every number here is reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVXYZÆØÅabc'.slice(0, 29).split('')

test('every item is dealt once before ANY of them repeats (D7)', () => {
  for (const [poolSize, perBoard] of [
    [29, 15], // letters at Svær — the case that motivated this
    [29, 6],
    [20, 10], // numbers at Normal
    [20, 15],
    [6, 6], // pool exactly the board
  ] as const) {
    const pool = Array.from({ length: poolSize }, (_, i) => `x${i}`)
    const bag = makeBoardBag(pool, { rnd: seeded(4242 + poolSize * 31 + perBoard) })
    const drawn: string[] = []
    // Deal enough boards to cover several whole cycles.
    for (let b = 0; b < 20; b++) drawn.push(...bag.deal(perBoard))

    // Walk the sequence in cycles of `poolSize`: each must be a permutation of the whole pool.
    for (let start = 0; start + poolSize <= drawn.length; start += poolSize) {
      const cycle = drawn.slice(start, start + poolSize)
      assert.equal(
        new Set(cycle).size,
        poolSize,
        `pool ${poolSize} / board ${perBoard}: an item repeated before the cycle was done`,
      )
    }
  }
})

test('no board ever contains a duplicate pair, including across a mid-board refill', () => {
  // 29 at 15 is the interesting one: board 1 takes 15, board 2 takes the remaining 14 and must then
  // reach into a FRESH pass for its 15th — which is exactly where a naive refill deals a duplicate.
  const bag = makeBoardBag(LETTERS, { rnd: seeded(777) })
  let sawRefillMidBoard = false
  let dealtInPass = 0
  for (let b = 0; b < 40; b++) {
    const board = bag.deal(15)
    assert.equal(board.length, 15, `board ${b} came out short`)
    assert.equal(new Set(board).size, 15, `board ${b} contains a duplicate pair`)
    // Track whether a board straddled a pass boundary at all, so a bag that quietly stopped refilling
    // mid-board can't make this test vacuous.
    if (dealtInPass + 15 > LETTERS.length) sawRefillMidBoard = true
    dealtInPass = (dealtInPass + 15) % LETTERS.length
  }
  assert.ok(sawRefillMidBoard, 'no board straddled a pass boundary — this test proved nothing')
})

test('the boards are 15 / 14+1 / … — one cycle of 29 letters, exactly as D7 describes', () => {
  const bag = makeBoardBag(LETTERS, { rnd: seeded(31337) })
  const first = bag.deal(15)
  const second = bag.deal(15)
  // The first cycle is board 1 plus the 14 survivors that open board 2.
  const cycle = [...first, ...second.slice(0, 14)]
  assert.equal(new Set(cycle).size, 29, 'the first 29 dealt items are not one clean pass')
  // Board 2's 15th item comes from the NEXT pass, and it is one board 2 does not already hold.
  assert.ok(!second.slice(0, 14).includes(second[14]))
})

test('a board bigger than the pool is clamped rather than duplicated', () => {
  const bag = makeBoardBag(['a', 'b', 'c'], { rnd: seeded(5) })
  const board = bag.deal(10)
  assert.equal(board.length, 3)
  assert.equal(new Set(board).size, 3)
})
