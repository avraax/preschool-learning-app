import { test } from 'node:test'
import assert from 'node:assert/strict'
import { undoPiece, type Piece } from './guidedPiece.ts'
import { addStroke, emptyDrawing, seedFor, type Drawing } from './strokeModel.ts'

const line = (i: number) => ({ tool: 'crayon' as const, color: 'roed' as const, points: [i, i, i + 50, i], seed: seedFor(i) })
const drawn = (n: number): Drawing => {
  let d = emptyDrawing()
  for (let i = 0; i < n; i++) d = addStroke(d, line(i))
  return d
}

// Owner, 2026-10-17: "I can't undo a line after drawing it" — undo was walled at the current step's
// start, so the line that FINISHED a step could never be taken back.
test('undo takes back the line that finished a step, and the step goes back with it', () => {
  // Step 0 took strokes 0–1, step 1 took stroke 2; now on step 2 with nothing drawn yet.
  const p: Piece = { drawing: drawn(3), step: 2, start: 3, starts: [0, 2], done: false }
  const a = undoPiece(p)
  assert.deepEqual([a.drawing.strokes.length, a.step, a.start, a.starts], [2, 1, 2, [0]])
  const b = undoPiece(a) // inside step 1 there is nothing left past its start → back into step 0
  assert.deepEqual([b.drawing.strokes.length, b.step, b.start, b.starts], [1, 0, 0, []])
  const c = undoPiece(b) // an ordinary undo inside step 0
  assert.deepEqual([c.drawing.strokes.length, c.step, c.start], [0, 0, 0])
  assert.equal(undoPiece(c), c, 'a blank paper has nothing to undo')
})

test('a finished, shown piece is not undone', () => {
  const p: Piece = { drawing: drawn(2), step: 1, start: 2, starts: [0], done: true }
  assert.equal(undoPiece(p), p)
})
