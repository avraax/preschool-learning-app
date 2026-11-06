// Byggeklodser's world (Krea PRD-03 §3) — PURE: no three.js, no React, no DOM. All truth lives here and
// the GPU is only a picture of it (§4.1): a context loss rebuilds from this state, undo and resume replay
// its action list.
//
// THE ONE RESOLVER (§4.3): `resolvePlacement` is the only path that adds a block from a gesture. A tap on
// a face and a drop of a dragged tray item both call it; `blocks.test.ts` fails the build if the game
// grows a second path. A bounce returns the world UNCHANGED (the same object).
//
// Coordinates: x and z across the island (0 … size-1), y up (0 = standing on the island).

import { PALETTE_13, type CrayonColor } from '../../../config/kreaPalette.ts'

export type Cell = { x: number; y: number; z: number }

/**
 * Cubes + the four specials (§2.2.7): tag (roof), vindue (window), dør (door), hjul (wheel). Window, door
 * and wheel have a FIXED look; the cube and the roof take the picked colour.
 */
export const BLOCK_KINDS = ['cube', 'roof', 'window', 'door', 'wheel'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]
export const SPECIAL_KINDS = ['roof', 'window', 'door', 'wheel'] as const satisfies readonly BlockKind[]
/** Kinds whose look follows the picked colour; the others always look like themselves. */
export const takesColor = (k: BlockKind): boolean => k === 'cube' || k === 'roof'
/** Nothing attaches TO these (§4.5): a roof slopes away, a wheel is round. */
export const isCapping = (k: BlockKind): boolean => k === 'roof' || k === 'wheel'

/**
 * Which horizontal way a block faces (§4.6). A window/door looks out this way, a roof slopes DOWN this
 * way, a wheel's axle lies along it. A cube has one too and ignores it. NEVER chosen by the child: there
 * is no rotate step, ever.
 */
export const FACINGS = ['px', 'nx', 'pz', 'nz'] as const
export type Facing = (typeof FACINGS)[number]
export const facingVector = (f: Facing): { x: number; z: number } =>
  f === 'px' ? { x: 1, z: 0 } : f === 'nx' ? { x: -1, z: 0 } : f === 'pz' ? { x: 0, z: 1 } : { x: 0, z: -1 }
export const facingOf = (v: { x: number; z: number }): Facing =>
  Math.abs(v.x) >= Math.abs(v.z) ? (v.x >= 0 ? 'px' : 'nx') : v.z >= 0 ? 'pz' : 'nz'

export type Block = { kind: BlockKind; color: CrayonColor; facing: Facing }
/** What is in the child's hand: a tray pick (sticky) or a dragged item (one-off). The colour is the one
 * currently picked; a fixed-look special carries it but ignores it. */
export type Held = { kind: BlockKind; color: CrayonColor }

/** What a tap or a drop landed on, as the scene's raycast reports it (§4.5). */
export type Target =
  | { on: 'island'; x: number; z: number }
  | { on: 'block'; cell: Cell; normal: Cell }

export type Action = { t: 'place'; cell: Cell; block: Block } | { t: 'remove'; cell: Cell; block: Block }

export interface BlockWorld {
  readonly size: number
  readonly heightCap: number
  /** `"x,y,z"` → block. Never mutated: every change returns a new world. */
  readonly cells: Readonly<Record<string, Block>>
  /** Everything the child did, in order — undo pops it, resume replays it. */
  readonly actions: readonly Action[]
}

export type BounceReason = 'outside' | 'too-high' | 'occupied' | 'no-attach' | 'wheel-needs-side'
export type PlaceResult = { placed: BlockWorld; cell: Cell } | { bounce: BounceReason; world: BlockWorld }

export const cellKey = (c: Cell): string => `${c.x},${c.y},${c.z}`
export const parseKey = (k: string): Cell => {
  const [x, y, z] = k.split(',').map(Number)
  return { x, y, z }
}

export const emptyWorld = (size: number, heightCap: number): BlockWorld => ({ size, heightCap, cells: {}, actions: [] })

export const blockAt = (w: BlockWorld, c: Cell): Block | undefined => w.cells[cellKey(c)]
export const blockCount = (w: BlockWorld): number => Object.keys(w.cells).length

const inBounds = (w: BlockWorld, c: Cell): boolean =>
  c.x >= 0 && c.z >= 0 && c.x < w.size && c.z < w.size && c.y >= 0

/** Round a hit normal to its dominant axis (§4.5: rounded edges skew normals; never trust one raw). */
export const axisNormal = (n: Cell): Cell => {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z)
  if (ay >= ax && ay >= az) return { x: 0, y: Math.sign(n.y) || 1, z: 0 }
  if (ax >= az) return { x: Math.sign(n.x), y: 0, z: 0 }
  return { x: 0, y: 0, z: Math.sign(n.z) }
}

/** The cell a target would fill — the island cell, or the block's neighbour across the hit face. */
export const targetCell = (t: Target): Cell => {
  if (t.on === 'island') return { x: t.x, y: 0, z: t.z }
  const n = axisNormal(t.normal)
  return { x: t.cell.x + n.x, y: t.cell.y + n.y, z: t.cell.z + n.z }
}

/** Whether the target is a SIDE face of a block (the only place a wheel may go). */
const sideNormal = (t: Target): { x: number; z: number } | null => {
  if (t.on !== 'block') return null
  const n = axisNormal(t.normal)
  return n.y === 0 ? { x: n.x, z: n.z } : null
}

/**
 * The facing rule (§4.6). On a SIDE face the block faces outward, along the face's normal. On a top or
 * bottom face, or on the island, it faces the camera's nearest horizontal axis — towards the child.
 */
export const facingFor = (t: Target, towardsCamera: { x: number; z: number }): Facing => facingOf(sideNormal(t) ?? towardsCamera)

/** Apply one action to the cells. Internal: callers reach it through the resolver, remove, or a replay. */
const apply = (w: BlockWorld, a: Action, record: boolean): BlockWorld => {
  const cells = { ...w.cells }
  const k = cellKey(a.cell)
  if (a.t === 'place') cells[k] = a.block
  else delete cells[k]
  return { ...w, cells, actions: record ? [...w.actions, a] : w.actions }
}

/**
 * Why a target can't take this block, or null when it can. Any face, no physics (§2.2.9): overhangs and
 * bridges are fine. The island's edge, the height cap, an occupied cell, a roof or wheel underneath the
 * tap (nothing attaches to those) and a wheel anywhere but a side face refuse.
 */
export const whyNot = (w: BlockWorld, t: Target, held?: Held): BounceReason | null => {
  if (t.on === 'block') {
    const on = blockAt(w, t.cell)
    if (!on || isCapping(on.kind)) return 'no-attach'
  }
  if (held?.kind === 'wheel' && !sideNormal(t)) return 'wheel-needs-side'
  const c = targetCell(t)
  if (!inBounds(w, c)) return 'outside'
  if (c.y >= w.heightCap) return 'too-high'
  if (blockAt(w, c)) return 'occupied'
  return null
}

/**
 * THE resolver — the only way a gesture adds a block (§4.3). `towardsCamera` decides the facing of a
 * special placed on a top face or the island. A bounce returns the world unchanged.
 */
export const resolvePlacement = (w: BlockWorld, t: Target, held: Held, towardsCamera: { x: number; z: number }): PlaceResult => {
  const why = whyNot(w, t, held)
  if (why) return { bounce: why, world: w }
  const cell = targetCell(t)
  const block: Block = { kind: held.kind, color: held.color, facing: facingFor(t, towardsCamera) }
  return { placed: apply(w, { t: 'place', cell, block }, true), cell }
}

/** The eraser: take the block at `cell` off. Null when there is none (a soft no-op). */
export const removeBlock = (w: BlockWorld, cell: Cell): BlockWorld | null => {
  const block = blockAt(w, cell)
  return block ? apply(w, { t: 'remove', cell, block }, true) : null
}

/** Undo the last place or removal (§2.2.11: unlimited within the piece). Null when there is nothing to undo. */
export const undo = (w: BlockWorld): BlockWorld | null => {
  const last = w.actions[w.actions.length - 1]
  if (!last) return null
  const reverse: Action = last.t === 'place' ? { t: 'remove', cell: last.cell, block: last.block } : { t: 'place', cell: last.cell, block: last.block }
  return { ...apply(w, reverse, false), actions: w.actions.slice(0, -1) }
}

// ----- session (§4.12): the ACTION LIST, colours by palette ID (never an index) ------------------------

type SavedAction = [t: 'p' | 'r', x: number, y: number, z: number, color: string, kind?: string, facing?: string]

export const serialiseWorld = (w: BlockWorld): string =>
  JSON.stringify(
    w.actions.map((a): SavedAction => [a.t === 'place' ? 'p' : 'r', a.cell.x, a.cell.y, a.cell.z, a.block.color, a.block.kind, a.block.facing]),
  )

/**
 * Replay a saved action list onto a fresh world. Anything that no longer fits (a level change shrank the
 * island, an unknown colour or kind) is dropped rather than trusted — a stale session degrades, never
 * crashes. A 5-field entry is a W1 session: a cube facing +z.
 */
export const restoreWorld = (fresh: BlockWorld, raw: string | null): BlockWorld => {
  if (!raw) return fresh
  let list: unknown
  try {
    list = JSON.parse(raw)
  } catch {
    return fresh
  }
  if (!Array.isArray(list)) return fresh
  let w = fresh
  for (const item of list) {
    if (!Array.isArray(item) || (item.length !== 5 && item.length !== 7)) continue
    const [t, x, y, z, color, kind = 'cube', facing = 'pz'] = item as SavedAction
    if (!(PALETTE_13 as readonly string[]).includes(color)) continue
    if (!(BLOCK_KINDS as readonly string[]).includes(kind) || !(FACINGS as readonly string[]).includes(facing)) continue
    const cell = { x, y, z }
    if (![x, y, z].every(Number.isInteger) || !inBounds(w, cell) || y >= w.heightCap) continue
    const block: Block = { kind: kind as BlockKind, color: color as CrayonColor, facing: facing as Facing }
    if (t === 'p' && !blockAt(w, cell)) w = apply(w, { t: 'place', cell, block }, true)
    else if (t === 'r' && blockAt(w, cell)) w = apply(w, { t: 'remove', cell, block: blockAt(w, cell)! }, true)
  }
  return w
}

/** Every block as a list — what the scene draws. */
export const blockList = (w: BlockWorld): { cell: Cell; block: Block }[] =>
  Object.entries(w.cells).map(([k, block]) => ({ cell: parseKey(k), block }))
