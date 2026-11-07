import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  axisNormal,
  blockAt,
  blockCount,
  emptyWorld,
  facingFor,
  previewCells,
  removeBlock,
  resolvePlacement,
  restoreWorld,
  serialiseWorld,
  targetCell,
  undo,
  type BlockWorld,
  type Held,
  type PlaceResult,
  type Target,
} from './blockWorld.ts'

const red: Held = { kind: 'cube', color: 'roed' }
const blue: Held = { kind: 'cube', color: 'blaa' }
const door: Held = { kind: 'door', color: 'roed' }
const window_: Held = { kind: 'window', color: 'roed' }
/** The camera's nearest horizontal axis: +z (towards the child). */
const T = { x: 0, z: 1 }
const cube = (h: Held) => ({ ...h, facing: 'pz' as const })
const up = { x: 0, y: 1, z: 0 }
const placed = (r: PlaceResult): BlockWorld => {
  assert.ok('placed' in r, `expected a placement, got ${'bounce' in r ? r.bounce : '?'}`)
  return r.placed
}
const put = (w: BlockWorld, t: Target, h: Held) => placed(resolvePlacement(w, t, h, T))

test('a tap on the plate places on layer 0; a tap on a face attaches across that face', () => {
  let w = emptyWorld(6, 8)
  w = put(w, { on: 'island', x: 2, z: 3 }, red)
  assert.deepEqual(blockAt(w, { x: 2, y: 0, z: 3 }), cube(red))
  w = put(w, { on: 'block', cell: { x: 2, y: 0, z: 3 }, normal: up }, blue)
  assert.deepEqual(blockAt(w, { x: 2, y: 1, z: 3 }), cube(blue))
  // Any face, no physics: an overhang off the side of the top block is fine.
  w = put(w, { on: 'block', cell: { x: 2, y: 1, z: 3 }, normal: { x: 1, y: 0, z: 0 } }, red)
  assert.deepEqual(blockAt(w, { x: 3, y: 1, z: 3 }), { ...red, facing: 'px' })
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
  w = put(w, { on: 'island', x: 0, z: 0 }, red)
  const cases: [Target, Held, string][] = [
    [{ on: 'island', x: 0, z: 0 }, blue, 'occupied'],
    [{ on: 'island', x: 6, z: 0 }, blue, 'outside'],
    [{ on: 'block', cell: { x: 0, y: 0, z: 0 }, normal: { x: -1, y: 0, z: 0 } }, blue, 'outside'],
    [{ on: 'block', cell: { x: 4, y: 0, z: 4 }, normal: up }, blue, 'no-attach'],
  ]
  for (const [t, h, why] of cases) {
    const r = resolvePlacement(w, t, h, T)
    assert.ok('bounce' in r, why)
    assert.equal(r.bounce, why)
    assert.equal(r.world, w, `${why}: the world changed`)
  }
  // The height cap: a 3-high tower takes no 4th.
  w = put(w, { on: 'block', cell: { x: 0, y: 0, z: 0 }, normal: up }, red)
  w = put(w, { on: 'block', cell: { x: 0, y: 1, z: 0 }, normal: up }, red)
  const top = resolvePlacement(w, { on: 'block', cell: { x: 0, y: 2, z: 0 }, normal: up }, red, T)
  assert.ok('bounce' in top && top.bounce === 'too-high' && top.world === w)
})

test('undo takes back places and removals, in order, all the way to empty', () => {
  const w0 = emptyWorld(6, 8)
  const w1 = put(w0, { on: 'island', x: 1, z: 1 }, red)
  const w2 = put(w1, { on: 'island', x: 2, z: 1 }, blue)
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

// Owner, 2026-11-06 (GR5YE): a door is 1 wide × 2 tall — one block to a child, two cells to the world.
test('a door stands two cells tall, counts as one block, and goes whole from either half', () => {
  let w = emptyWorld(8, 8)
  w = put(w, { on: 'island', x: 3, z: 3 }, door)
  assert.deepEqual(blockAt(w, { x: 3, y: 0, z: 3 }), { ...door, facing: 'pz' })
  assert.deepEqual(blockAt(w, { x: 3, y: 1, z: 3 }), { ...door, facing: 'pz', part: 'top' })
  assert.equal(blockCount(w), 1)
  assert.deepEqual(previewCells(w, { on: 'island', x: 5, z: 5 }, door, T), [{ x: 5, y: 0, z: 5 }, { x: 5, y: 1, z: 5 }])
  // Its top half is a full cell: a block can sit on it.
  w = put(w, { on: 'block', cell: { x: 3, y: 1, z: 3 }, normal: up }, red)
  const gone = removeBlock(w, { x: 3, y: 1, z: 3 })!
  assert.equal(blockAt(gone, { x: 3, y: 0, z: 3 }), undefined, 'erasing the top half takes the whole door')
  assert.deepEqual(undo(gone)!.cells, w.cells, 'undo brings both halves back')
  // No room above → it bounces, unchanged.
  const low = put(emptyWorld(8, 1), { on: 'island', x: 0, z: 0 }, red)
  const r = resolvePlacement(low, { on: 'island', x: 2, z: 2 }, door, T)
  assert.ok('bounce' in r && r.bounce === 'no-room' && r.world === low)
})

// "A pane set INTO the wall": a window or door tapped onto a cube's side replaces that cube, facing out —
// and undo puts the wall back.
test('a window or door tapped into a wall replaces the wall block, and undo restores it', () => {
  let w = emptyWorld(8, 8)
  w = put(w, { on: 'island', x: 4, z: 4 }, red)
  w = put(w, { on: 'block', cell: { x: 4, y: 0, z: 4 }, normal: up }, red)
  const wall = w
  const side = { on: 'block' as const, cell: { x: 4, y: 0, z: 4 }, normal: { x: -1, y: 0, z: 0 } }
  w = put(w, side, window_)
  assert.deepEqual(blockAt(w, { x: 4, y: 0, z: 4 }), { ...window_, facing: 'nx' }, 'the wall cube became a window looking west')
  assert.equal(blockAt(w, { x: 3, y: 0, z: 4 }), undefined, 'nothing stuck on the outside')
  assert.deepEqual(undo(w)!.cells, wall.cells, 'undo puts the wall cube back')
  // A door into the wall takes the tapped cube and the one above it.
  const d = put(wall, side, door)
  assert.equal(blockAt(d, { x: 4, y: 0, z: 4 })?.kind, 'door')
  assert.equal(blockAt(d, { x: 4, y: 1, z: 4 })?.part, 'top')
  assert.deepEqual(undo(d)!.cells, wall.cells)
  // On the plate or a top face it stands on its own, facing the child.
  const free = put(emptyWorld(8, 8), { on: 'island', x: 1, z: 1 }, window_)
  assert.deepEqual(blockAt(free, { x: 1, y: 0, z: 1 }), { ...window_, facing: 'pz' })
})

// §4.6: a special's direction is never the child's job.
test('specials face outward on a side face and towards the child on top or on the plate', () => {
  let w = emptyWorld(8, 8)
  w = put(w, { on: 'island', x: 3, z: 3 }, red)
  w = placed(resolvePlacement(w, { on: 'block', cell: { x: 3, y: 0, z: 3 }, normal: up }, { kind: 'window', color: 'blaa' }, { x: 0, z: -1 }))
  assert.deepEqual(blockAt(w, { x: 3, y: 1, z: 3 }), { kind: 'window', color: 'blaa', facing: 'nz' }, 'a window on top faces the child')
  assert.equal(facingFor({ on: 'block', cell: { x: 0, y: 0, z: 0 }, normal: { x: 0.2, y: 0.1, z: -0.9 } }, T), 'nz')
})

test('a material box builds like a cube, and a window or door goes INTO it', () => {
  const wood: Held = { kind: 'wood', color: 'roed' }
  let w = emptyWorld(8, 8)
  w = put(w, { on: 'island', x: 3, z: 3 }, wood)
  w = put(w, { on: 'block', cell: { x: 3, y: 0, z: 3 }, normal: up }, { kind: 'glass', color: 'roed' })
  assert.equal(blockAt(w, { x: 3, y: 1, z: 3 })?.kind, 'glass', 'a box stacks on a material box')
  w = put(w, { on: 'block', cell: { x: 3, y: 0, z: 3 }, normal: { x: 1, y: 0, z: 0 } }, door)
  assert.equal(blockAt(w, { x: 3, y: 0, z: 3 })?.kind, 'door', 'a door replaces the wooden box it was set into')
  assert.equal(blockAt(w, { x: 3, y: 1, z: 3 })?.part, 'top', '…and the glass box above it')
  assert.equal(restoreWorld(emptyWorld(8, 8), serialiseWorld(w)).cells['3,0,3']?.kind, 'door', 'a session with materials round-trips')
})

test('a session round-trips exactly — doors, replaced walls, undo after resume', () => {
  let w = emptyWorld(8, 8)
  w = put(w, { on: 'island', x: 3, z: 3 }, red)
  w = put(w, { on: 'block', cell: { x: 3, y: 0, z: 3 }, normal: up }, blue)
  w = put(w, { on: 'block', cell: { x: 3, y: 0, z: 3 }, normal: { x: 1, y: 0, z: 0 } }, door)
  w = removeBlock(w, { x: 3, y: 1, z: 3 })!
  const raw = serialiseWorld(w)
  assert.match(raw, /"roed"/)
  const back = restoreWorld(emptyWorld(8, 8), raw)
  assert.deepEqual(back.cells, w.cells)
  assert.deepEqual(back.actions, w.actions)
  assert.deepEqual(undo(back)!.cells, undo(w)!.cells)
})

test('a stale, older or corrupt session degrades to what still fits, never a crash', () => {
  const fresh = emptyWorld(6, 8)
  assert.equal(restoreWorld(fresh, null), fresh)
  assert.equal(restoreWorld(fresh, 'not json'), fresh)
  assert.equal(blockCount(restoreWorld(fresh, JSON.stringify([['p', 1, 0, 1, 'gul']]))), 0, 'a W1/W2-format session is ignored')
  const raw = JSON.stringify([
    { t: 'p', c: [[7, 0, 7, 0, ['cube', 'roed', 'pz']]] }, // off a 6-plate
    { t: 'p', c: [[1, 0, 1, 0, ['wheel', 'roed', 'pz']]] }, // a kind that left the set
    { t: 'p', c: [[1, 0, 1, 0, ['cube', 'gul', 'pz']]] },
    'junk',
  ])
  const w = restoreWorld(fresh, raw)
  assert.equal(blockCount(w), 1)
  assert.deepEqual(blockAt(w, { x: 1, y: 0, z: 1 }), { kind: 'cube', color: 'gul', facing: 'pz' })
})
