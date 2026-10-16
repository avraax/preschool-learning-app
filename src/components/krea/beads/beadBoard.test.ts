import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  accepts,
  beadCount,
  freeBoard,
  isComplete,
  moveBead,
  patternBoard,
  pegAt,
  pegCentre,
  placeBead,
  removeBead,
  restoreBeads,
  serialiseBeads,
} from './beadBoard.ts'
import { BEAD_BOARDS, BEAD_PATTERNS, boardMask, boardSize, patternCells } from '../../../config/kreaBeads.ts'
import { PALETTE_12 } from '../../../config/kreaPalette.ts'

// Krea PRD-02 §3, §4.1 — the pure pegboard. `placeBead` is the one resolver both gestures call.

const heart = BEAD_PATTERNS.find((p) => p.id === 'hjerte')!
const n = boardSize('let')
const target = patternCells(heart, 'let')
const redPeg = target.indexOf('roed')
const emptyPeg = target.indexOf(null)

test('pattern: the right colour lands; a wrong one bounces and leaves the beads unchanged', () => {
  const b = patternBoard(n, target)
  const ok = placeBead(b, 'roed', redPeg)
  assert.equal(ok.result, 'placed')
  assert.equal(ok.board.beads[redPeg], 'roed')

  const wrong = placeBead(b, 'blaa', redPeg)
  assert.equal(wrong.result, 'wrong')
  assert.deepEqual(wrong.board.beads, b.beads, 'a bounce must not put the bead down')
  assert.equal(wrong.hint, null, 'one miss is not a hint yet')
})

test('pattern: a peg the pattern does not use bounces too, and is not a miss', () => {
  const b = patternBoard(n, target)
  const r = placeBead(b, 'roed', emptyPeg)
  assert.equal(r.result, 'not-in-pattern')
  assert.deepEqual(r.board.beads, b.beads)
  assert.deepEqual(r.board.misses, b.misses)
})

test('pattern: the 2nd miss on the same peg names the bowl to glow — the never-fail hint', () => {
  let b = patternBoard(n, target)
  b = placeBead(b, 'blaa', redPeg).board
  const second = placeBead(b, 'gul', redPeg)
  assert.equal(second.hint, 'roed')
  // A miss elsewhere does not count toward this peg.
  const other = target.indexOf('roed', redPeg + 1)
  assert.equal(placeBead(patternBoard(n, target), 'blaa', other).hint, null)
})

test('pattern: complete when every pattern peg holds its colour', () => {
  let b = patternBoard(n, target)
  target.forEach((c, i) => {
    if (c) b = placeBead(b, c, i).board
  })
  assert.ok(isComplete(b))
  assert.equal(beadCount(b), target.filter(Boolean).length)
  assert.ok(!isComplete(removeBead(b, redPeg).board))
})

test('free board: anything goes inside the mask, nothing outside it, and it never "completes"', () => {
  const circle = BEAD_BOARDS.find((x) => x.id === 'cirkel')!
  const mask = boardMask(circle, 'let')
  const b = freeBoard(n, mask)
  const inside = mask.indexOf(true)
  const outside = mask.indexOf(false)
  assert.equal(placeBead(b, 'lilla', inside).result, 'placed')
  assert.equal(placeBead(b, 'lilla', outside).result, 'outside')
  assert.deepEqual(placeBead(b, 'lilla', outside).board, b)
  const swapped = placeBead(placeBead(b, 'lilla', inside).board, 'gul', inside)
  assert.equal(swapped.result, 'swapped')
  assert.equal(swapped.board.beads[inside], 'gul')
  assert.ok(!isComplete(swapped.board))
})

test('move: judged by placeBead; a move that would not land leaves the board exactly as it was', () => {
  const b = placeBead(patternBoard(n, target), 'roed', redPeg).board
  const otherRed = target.indexOf('roed', redPeg + 1)
  const moved = moveBead(b, redPeg, otherRed)
  assert.equal(moved.result, 'placed')
  assert.equal(moved.board.beads[redPeg], null)
  assert.equal(moved.board.beads[otherRed], 'roed')
  const bad = moveBead(b, redPeg, emptyPeg)
  assert.equal(bad.result, 'not-in-pattern')
  assert.equal(bad.board, b)
})

test('geometry: a point becomes its peg by arithmetic; off the peg area is -1', () => {
  const g = { left: 100, top: 50, pitch: 40, n: 7 }
  assert.equal(pegAt(g, 101, 51), 0)
  assert.equal(pegAt(g, 100 + 40 * 3 + 39, 50 + 40 * 2 + 1), 2 * 7 + 3)
  assert.equal(pegAt(g, 99, 60), -1)
  assert.equal(pegAt(g, 100 + 40 * 7, 60), -1)
  for (const peg of [0, 8, 24, 48]) {
    const c = pegCentre(g, peg)
    assert.equal(pegAt(g, c.x, c.y), peg)
  }
})

test('session: beads round-trip, and a restore never puts a bead the pattern would bounce', () => {
  const b = placeBead(patternBoard(n, target), 'roed', redPeg).board
  const raw = serialiseBeads(b, PALETTE_12)
  assert.deepEqual(restoreBeads(patternBoard(n, target), raw, PALETTE_12).beads, b.beads)
  const forged = raw.split('')
  forged[emptyPeg] = '0'
  assert.equal(restoreBeads(patternBoard(n, target), forged.join(''), PALETTE_12).beads[emptyPeg], null)
  assert.deepEqual(restoreBeads(patternBoard(n, target), 'garbage', PALETTE_12).beads, patternBoard(n, target).beads)
  assert.equal(accepts(b, -1, 'roed'), 'outside')
})
