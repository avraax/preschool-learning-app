import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addStroke, canUndo, colorsUsed, deserialise, emptyDrawing, hasInk, serialise, undo, seedFor,
  UNDO_DEPTH, PALETTE_8, PALETTE_12, type CrayonColor, type Drawing, type Stroke,
} from './strokeModel.ts'

const crayon = (color: CrayonColor, i = 0): Stroke => ({ tool: 'crayon', color, points: [10 + i, 20, 30 + i, 40], seed: seedFor(i) })
const brush = (tool: 'rainbow' | 'glitter' | 'eraser', i = 0): Stroke => ({ tool, points: [1, 2, 3, 4], seed: seedFor(i) })

test("palettes: 12 named crayons, and Let's 8 are a subset of them", () => {
  assert.equal(PALETTE_12.length, 12)
  assert.equal(PALETTE_8.length, 8)
  for (const c of PALETTE_8) assert.ok(PALETTE_12.includes(c), c)
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
