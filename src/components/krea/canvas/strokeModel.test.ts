import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addStroke, canUndo, colorsUsed, deserialise, emptyDrawing, hasInk, serialise, undo, seedFor,
  UNDO_DEPTH, PALETTE_9, PALETTE_13, type CrayonColor, type Drawing, type Stroke,
} from './strokeModel.ts'

const crayon = (color: CrayonColor, i = 0): Stroke => ({ tool: 'crayon', color, points: [10 + i, 20, 30 + i, 40], seed: seedFor(i) })
const brush = (tool: 'rainbow' | 'glitter' | 'eraser', i = 0): Stroke => ({ tool, points: [1, 2, 3, 4], seed: seedFor(i) })

test("palettes: 13 named crayons, and Let's 9 are a subset of them — beige in both", () => {
  assert.equal(PALETTE_13.length, 13)
  assert.equal(PALETTE_9.length, 9)
  assert.ok(PALETTE_13.includes('beige') && PALETTE_9.includes('beige'))
  for (const c of PALETTE_9) assert.ok(PALETTE_13.includes(c), c)
})

test('the colour count counts distinct crayons only — rainbow, glitter, stamps and the eraser never count', () => {
  let d: Drawing = emptyDrawing()
  for (const s of [crayon('roed'), crayon('roed', 1), crayon('blaa', 2), brush('rainbow'), brush('glitter'), brush('eraser')]) d = addStroke(d, s)
  d = addStroke(d, { tool: 'stamp', stamp: 'fish', x: 5, y: 5, size: 100, seed: 1 })
  assert.equal(colorsUsed(d), 2)
  assert.equal(colorsUsed(addStroke(emptyDrawing(), brush('rainbow'))), 0)
})

test('ink: an eraser mark alone is not ink; anything else is', () => {
  assert.equal(hasInk(addStroke(emptyDrawing(), brush('eraser'))), false)
  assert.equal(hasInk(addStroke(emptyDrawing(), brush('glitter'))), true)
})

// Undo used to stop dead after UNDO_DEPTH steps (the checkpoint was a wall), and a child hammering the
// button read that as it breaking. It goes all the way back now; the checkpoint just follows.
test('undo drops the last stroke, all the way back to a blank paper', () => {
  let d = emptyDrawing()
  for (let i = 0; i < UNDO_DEPTH + 15; i++) d = addStroke(d, crayon('roed', i))
  assert.equal(d.baked, 15)
  for (let i = 0; i < UNDO_DEPTH + 15; i++) {
    assert.ok(canUndo(d), `undo refused at ${d.strokes.length} strokes`)
    const before = d.strokes
    d = undo(d)
    assert.deepEqual(d.strokes, before.slice(0, -1))
    assert.ok(d.baked <= d.strokes.length, 'the checkpoint can never hold more than the list')
  }
  assert.equal(d.strokes.length, 0)
  assert.equal(canUndo(d), false)
  assert.equal(undo(d), d, 'undo on a blank paper is a no-op')
})

test('serialise round-trips exactly, and resume never throws on junk', () => {
  let d = emptyDrawing()
  d = addStroke(d, crayon('gul'))
  d = addStroke(d, brush('glitter', 1))
  d = addStroke(d, { tool: 'stamp', stamp: 'sun', x: 600, y: 450, size: 150, seed: 7 })
  assert.deepEqual(deserialise(serialise(d)), d)
  const junk = [null, '', '{', '{"v":2,"s":[]}', '{"v":1,"s":"x"}', '{"v":1,"s":[{"tool":"crayon","color":"pink","points":[1,2]}]}']
  for (const j of junk) assert.equal(deserialise(j), null, String(j))
  // A bad stroke is dropped, the good one survives; out-of-range points are clamped to the paper.
  const mixed = deserialise('{"v":1,"s":[{"tool":"crayon","color":"roed","points":[-5,2000,3,4],"seed":1},{"tool":"laser","points":[1,2]}]}')
  assert.deepEqual(mixed?.strokes, [{ tool: 'crayon', color: 'roed', points: [0, 900, 3, 4], seed: 1 }])
  assert.equal(deserialise('{"v":1,"s":[{"tool":"stamp","stamp":"nope","x":1,"y":1,"size":1,"seed":1}]}', new Set(['sun'])), null)
})

// ─── A dragged stamp (owner 2026-11-04, ANTC2): a drag lays a row, a TAP still lays exactly one ────────

test('stamp trail: a tap — still or with a 5-year-old’s jitter — adds NOTHING; only a real drag trails', async () => {
  const { extendStampTrail, STAMP_STEP } = await import('./strokeModel.ts')
  const fresh = () => ({ tool: 'stamp' as const, stamp: 'sun', x: 500, y: 400, size: 150, seed: 1, trail: [] as number[] })
  // A tap: 0 px, then wobbles of up to ~10 CSS px. A paper unit is ≈ 0.75–1.4 CSS px across every
  // screen, so 14 units is MORE than a 10 px wobble on any of them.
  for (const [dx, dy] of [[0, 0], [6, 0], [0, -8], [10, 10], [-14, 3]]) {
    const s = fresh()
    assert.equal(extendStampTrail(s, 500 + dx, 400 + dy), 0, `jitter ${dx},${dy}`)
    assert.deepEqual(s.trail, [])
  }
  // The threshold is a whole picture's spacing, far past any jitter.
  assert.ok(STAMP_STEP >= 100, `STAMP_STEP ${STAMP_STEP} is too small to tell a tap from a drag`)
  // A drag across the paper: an even row, one picture per STAMP_STEP, whatever the event rate.
  const slow = fresh()
  for (let x = 500; x <= 1100; x += 7) extendStampTrail(slow, x, 400)
  const fast = fresh()
  extendStampTrail(fast, 1100, 400)
  assert.equal(slow.trail.length / 2, Math.floor(600 / STAMP_STEP))
  assert.deepEqual(fast.trail, slow.trail, 'a flick lays the same row as a slow drag')
  for (let i = 0; i < fast.trail.length; i += 2) assert.equal(fast.trail[i] - (i ? fast.trail[i - 2] : 500), STAMP_STEP)
})

test('stamp trail: one drag is ONE stroke — one undo takes the whole row; it survives a resume', async () => {
  const { extendStampTrail, stampPlacements } = await import('./strokeModel.ts')
  const s = { tool: 'stamp' as const, stamp: 'sun', x: 100, y: 100, size: 150, seed: 3, trail: [] as number[] }
  extendStampTrail(s, 800, 600)
  assert.ok(s.trail.length >= 6)
  let d = addStroke(addStroke(emptyDrawing(), crayon('roed')), s)
  assert.equal(d.strokes.length, 2)
  const back = deserialise(serialise(d), new Set(['sun']))!
  assert.deepEqual(back.strokes[1], s)
  assert.equal(stampPlacements(back.strokes[1] as typeof s).length, 1 + s.trail.length / 2)
  d = undo(d)
  assert.equal(d.strokes.length, 1, 'one undo removes the whole dragged row')
  // A broken trail drops the trail, never the stamp.
  const bad = deserialise('{"v":1,"s":[{"tool":"stamp","stamp":"sun","x":1,"y":1,"size":150,"seed":1,"trail":[1,"x"]}]}', new Set(['sun']))!
  assert.equal(bad.strokes.length, 1)
  assert.equal((bad.strokes[0] as { trail?: number[] }).trail, undefined)
})
