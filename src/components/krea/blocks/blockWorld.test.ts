import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  axisNormal,
  blockAt,
  blockCount,
  emptyWorld,
  removeBlock,
  resolvePlacement,
  restoreWorld,
  serialiseWorld,
  targetCell,
  undo,
  type BlockWorld,
  type Held,
  type PlaceResult,
} from './blockWorld.ts'

const red: Held = { kind: 'cube', color: 'roed' }
const blue: Held = { kind: 'cube', color: 'blaa' }
const placed = (r: PlaceResult): BlockWorld => {
  assert.ok('placed' in r, `expected a placement, got ${'bounce' in r ? r.bounce : '?'}`)
  return r.placed
}

test('a tap on the island places on layer 0; a tap on a face attaches across that face', () => {
  let w = emptyWorld(6, 8)
  w = placed(resolvePlacement(w, { on: 'island', x: 2, z: 3 }, red))
  assert.deepEqual(blockAt(w, { x: 2, y: 0, z: 3 }), red)
  w = placed(resolvePlacement(w, { on: 'block', cell: { x: 2, y: 0, z: 3 }, normal: { x: 0, y: 1, z: 0 } }, blue))
  assert.deepEqual(blockAt(w, { x: 2, y: 1, z: 3 }), blue)
  // Any face, no physics: an overhang off the side of the top block is fine.
  w = placed(resolvePlacement(w, { on: 'block', cell: { x: 2, y: 1, z: 3 }, normal: { x: 1, y: 0, z: 0 } }, red))
  assert.deepEqual(blockAt(w, { x: 3, y: 1, z: 3 }), red)
  assert.equal(blockCount(w), 3)
})

// §4.5: a hit near a rounded edge has a skewed normal; it must snap to ONE axis, never place diagonally.
test('a skewed normal near an edge rounds to its dominant axis', () => {
  assert.deepEqual(axisNormal({ x: 0.62, y: 0.55, z: 0.1 }), { x: 1, y: 0, z: 0 })
  assert.deepEqual(axisNormal({ x: 0.3, y: 0.9, z: -0.4 }), { x: 0, y: 1, z: 0 })
  assert.deepEqual(axisNormal({ x: -0.1, y: 0.2, z: -0.97 }), { x: 0, y: 0, z: -1 })
  const c = targetCell({ on: 'block', cell: { x: 1, y: 0, z: 1 }, normal: { x: 0.6, y: 0.58, z: 0.55 } })
  assert.equal(Math.abs(c.x - 1) + Math.abs(c.y) + Math.abs(c.z - 1), 1, 'exactly one step from the block')
})

// §2.4.16 / §4.5: a bounce leaves the world UNCHANGED — the very same object, not an equal copy.
test('every bounce returns the world unchanged', () => {
  let w = emptyWorld(6, 3)
  w = placed(resolvePlacement(w, { on: 'island', x: 0, z: 0 }, red))
  const cases: [Parameters<typeof resolvePlacement>[1], string][] = [
    [{ on: 'island', x: 0, z: 0 }, 'occupied'],
    [{ on: 'island', x: 6, z: 0 }, 'outside'],
    [{ on: 'block', cell: { x: 0, y: 0, z: 0 }, normal: { x: -1, y: 0, z: 0 } }, 'outside'],
    [{ on: 'block', cell: { x: 4, y: 0, z: 4 }, normal: { x: 0, y: 1, z: 0 } }, 'no-attach'],
  ]
  for (const [t, why] of cases) {
    const r = resolvePlacement(w, t, blue)
    assert.ok('bounce' in r, why)
    assert.equal(r.bounce, why)
    assert.equal(r.world, w, `${why}: the world changed`)
  }
  // The height cap: a 3-high tower takes no 4th.
  w = placed(resolvePlacement(w, { on: 'block', cell: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } }, red))
  w = placed(resolvePlacement(w, { on: 'block', cell: { x: 0, y: 1, z: 0 }, normal: { x: 0, y: 1, z: 0 } }, red))
  const top = resolvePlacement(w, { on: 'block', cell: { x: 0, y: 2, z: 0 }, normal: { x: 0, y: 1, z: 0 } }, red)
  assert.ok('bounce' in top && top.bounce === 'too-high' && top.world === w)
})

test('undo takes back places and removals, in order, all the way to empty', () => {
  const w0 = emptyWorld(6, 8)
  const w1 = placed(resolvePlacement(w0, { on: 'island', x: 1, z: 1 }, red))
  const w2 = placed(resolvePlacement(w1, { on: 'island', x: 2, z: 1 }, blue))
  const w3 = removeBlock(w2, { x: 1, y: 0, z: 1 })!
  assert.equal(blockCount(w3), 1)
  const u1 = undo(w3)!
  assert.deepEqual(u1.cells, w2.cells, 'undoing the eraser brings the red block back')
  const u2 = undo(u1)!
  assert.deepEqual(u2.cells, w1.cells)
  const u3 = undo(u2)!
  assert.deepEqual(u3.cells, {})
  assert.equal(undo(u3), null)
  assert.equal(removeBlock(u3, { x: 0, y: 0, z: 0 }), null, 'erasing nothing is a no-op')
})

test('a session round-trips: resume replays exactly, colours by palette id', () => {
  let w = emptyWorld(8, 8)
  w = placed(resolvePlacement(w, { on: 'island', x: 3, z: 3 }, red))
  w = placed(resolvePlacement(w, { on: 'block', cell: { x: 3, y: 0, z: 3 }, normal: { x: 0, y: 1, z: 0 } }, blue))
  w = removeBlock(w, { x: 3, y: 0, z: 3 })!
  const raw = serialiseWorld(w)
  assert.match(raw, /"roed"/)
  assert.match(raw, /"blaa"/)
  const back = restoreWorld(emptyWorld(8, 8), raw)
  assert.deepEqual(back.cells, w.cells)
  assert.deepEqual(back.actions, w.actions)
  // Undo after resume goes back exactly as before the reload.
  assert.deepEqual(undo(back)!.cells, undo(w)!.cells)
})

test('a stale or corrupt session degrades to what still fits, never a crash', () => {
  const fresh = emptyWorld(6, 8)
  assert.equal(restoreWorld(fresh, null), fresh)
  assert.equal(restoreWorld(fresh, 'not json'), fresh)
  const raw = JSON.stringify([['p', 7, 0, 7, 'roed'], ['p', 1, 0, 1, 'neon'], ['p', 1, 0, 1, 'gul'], 'junk'])
  const w = restoreWorld(fresh, raw)
  assert.equal(blockCount(w), 1, 'the out-of-island block and the unknown colour are dropped')
  assert.deepEqual(blockAt(w, { x: 1, y: 0, z: 1 }), { kind: 'cube', color: 'gul' })
})
