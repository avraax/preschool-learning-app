// Byggeklodser's world (Krea PRD-03 §3) — PURE: no three.js, no React, no DOM. All truth lives here and
// the GPU is only a picture of it (§4.1): a context loss rebuilds from this state, undo and resume replay
// its action list.
//
// THE ONE RESOLVER (§4.3): `resolvePlacement` is the only path that adds a block from a gesture. A tap on
// a face and a drop of a dragged tray item both call it; `blocks.test.ts` fails the build if the game
// grows a second path. A bounce returns the world UNCHANGED (the same object).
//
// Every action is a CHANGE SET — each touched cell with what was there before and after — because a door
// takes two cells and a window or door tapped into a wall REPLACES the wall block. Undo puts back exactly
// the "before" of every cell, so a replaced wall block comes back too.
//
// Coordinates: x and z across the plate (0 … size-1), y up (0 = standing on the plate).

import { PALETTE_13, type CrayonColor } from '../../../config/kreaPalette.ts'

export type Cell = { x: number; y: number; z: number }

/**
 * Cubes + three specials: tag (roof), vindue (window), dør (door). Owner, 2026-11-06 (GR5YE): the door is
 * 1 wide × 2 tall and the window a pane set INTO a wall, both thin panels — not block-sized boxes; the
 * wheel is gone. Window and door have a FIXED look; the cube and the roof take the picked colour.
 */
export const BLOCK_KINDS = ['cube', 'roof', 'window', 'door'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]
export const SPECIAL_KINDS = ['roof', 'window', 'door'] as const satisfies readonly BlockKind[]
/** Kinds whose look follows the picked colour; the others always look like themselves. */
export const takesColor = (k: BlockKind): boolean => k === 'cube' || k === 'roof'
/** Nothing attaches TO a roof (§4.5): it slopes away. */
export const isCapping = (k: BlockKind): boolean => k === 'roof'

/**
 * Which horizontal way a block faces (§4.6). A window/door looks out this way, a roof slopes DOWN this
 * way. A cube has one too and ignores it. NEVER chosen by the child: there is no rotate step, ever.
 */
export const FACINGS = ['px', 'nx', 'pz', 'nz'] as const
export type Facing = (typeof FACINGS)[number]
export const facingVector = (f: Facing): { x: number; z: number } =>
  f === 'px' ? { x: 1, z: 0 } : f === 'nx' ? { x: -1, z: 0 } : f === 'pz' ? { x: 0, z: 1 } : { x: 0, z: -1 }
export const facingOf = (v: { x: number; z: number }): Facing =>
  Math.abs(v.x) >= Math.abs(v.z) ? (v.x >= 0 ? 'px' : 'nx') : v.z >= 0 ? 'pz' : 'nz'

/** `part: 'top'` marks a door's upper cell; the door is drawn once, from its bottom cell. */
export type Block = { kind: BlockKind; color: CrayonColor; facing: Facing; part?: 'top' }
/** What is in the child's hand: a tray pick (sticky) or a dragged item (one-off). The colour is the one
 * currently picked; a fixed-look special carries it but ignores it. */
export type Held = { kind: BlockKind; color: CrayonColor }

/** What a tap or a drop landed on, as the scene's raycast reports it (§4.5). */
export type Target =
  | { on: 'island'; x: number; z: number }
  | { on: 'block'; cell: Cell; normal: Cell }

/** One cell's change. `before`/`after` undefined = empty. */
export type Change = { cell: Cell; before?: Block; after?: Block }
export type Action = { t: 'place' | 'remove'; changes: Change[] }
/** A change with its empty sides left OUT (not `undefined`), so a replayed session is deep-equal to the live one. */
const change = (cell: Cell, before?: Block, after?: Block): Change => ({ cell, ...(before ? { before } : {}), ...(after ? { after } : {}) })

export interface BlockWorld {
  readonly size: number
  readonly heightCap: number
  /** `"x,y,z"` → block. Never mutated: every change returns a new world. */
  readonly cells: Readonly<Record<string, Block>>
  /** Everything the child did, in order — undo pops it, resume replays it. */
  readonly actions: readonly Action[]
}

export type BounceReason = 'outside' | 'too-high' | 'occupied' | 'no-attach' | 'no-room'
export type PlaceResult = { placed: BlockWorld; cell: Cell } | { bounce: BounceReason; world: BlockWorld }

export const cellKey = (c: Cell): string => `${c.x},${c.y},${c.z}`
export const parseKey = (k: string): Cell => {
  const [x, y, z] = k.split(',').map(Number)
  return { x, y, z }
}
const above = (c: Cell): Cell => ({ x: c.x, y: c.y + 1, z: c.z })
const below = (c: Cell): Cell => ({ x: c.x, y: c.y - 1, z: c.z })

export const emptyWorld = (size: number, heightCap: number): BlockWorld => ({ size, heightCap, cells: {}, actions: [] })

export const blockAt = (w: BlockWorld, c: Cell): Block | undefined => w.cells[cellKey(c)]
/** Blocks as a child counts them: a door is ONE block, though it fills two cells. */
export const blockCount = (w: BlockWorld): number => Object.values(w.cells).filter((b) => b.part !== 'top').length

const inBounds = (w: BlockWorld, c: Cell): boolean =>
  c.x >= 0 && c.z >= 0 && c.x < w.size && c.z < w.size && c.y >= 0 && c.y < w.heightCap

/** Round a hit normal to its dominant axis (§4.5: rounded edges skew normals; never trust one raw). */
export const axisNormal = (n: Cell): Cell => {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z)
  if (ay >= ax && ay >= az) return { x: 0, y: Math.sign(n.y) || 1, z: 0 }
  if (ax >= az) return { x: Math.sign(n.x), y: 0, z: 0 }
  return { x: 0, y: 0, z: Math.sign(n.z) }
}

/** The cell a target would fill — the plate cell, or the block's neighbour across the hit face. */
export const targetCell = (t: Target): Cell => {
  if (t.on === 'island') return { x: t.x, y: 0, z: t.z }
  const n = axisNormal(t.normal)
  return { x: t.cell.x + n.x, y: t.cell.y + n.y, z: t.cell.z + n.z }
}

/** The tapped face's outward direction when it is a SIDE face of a block, else null. */
const sideNormal = (t: Target): { x: number; z: number } | null => {
  if (t.on !== 'block') return null
  const n = axisNormal(t.normal)
  return n.y === 0 ? { x: n.x, z: n.z } : null
}

/**
 * The facing rule (§4.6). On a SIDE face the block faces outward, along the face's normal. On a top or
 * bottom face, or on the plate, it faces the camera's nearest horizontal axis — towards the child.
 */
export const facingFor = (t: Target, towardsCamera: { x: number; z: number }): Facing => facingOf(sideNormal(t) ?? towardsCamera)

/** The cells a held item would change, and what goes in them — or why it can't. Pure planning. */
const plan = (w: BlockWorld, t: Target, held: Held, towardsCamera: { x: number; z: number }): Change[] | BounceReason => {
  let on: Block | undefined
  if (t.on === 'block') {
    on = blockAt(w, t.cell)
    if (!on || isCapping(on.kind)) return 'no-attach'
  }
  const facing = facingFor(t, towardsCamera)
  const make = (part?: 'top'): Block => ({ kind: held.kind, color: held.color, facing, ...(part ? { part } : {}) })
  // A window or door tapped onto the SIDE of a cube goes INTO the wall: it replaces that cube (owner:
  // "a pane set into the wall", not a box stuck on it).
  const intoWall = (held.kind === 'window' || held.kind === 'door') && on?.kind === 'cube' && !!sideNormal(t)
  const base = intoWall ? (t as { cell: Cell }).cell : targetCell(t)
  if (!inBounds(w, base)) return base.y >= w.heightCap ? 'too-high' : 'outside'
  const baseNow = blockAt(w, base)
  if (!intoWall && baseNow) return 'occupied'
  const changes: Change[] = [change(base, baseNow, make())]
  if (held.kind === 'door') {
    const top = above(base)
    const topNow = blockAt(w, top)
    // The door's upper half needs room: an empty cell, or (going into a wall) a wall cube it replaces.
    if (!inBounds(w, top) || (topNow && !(intoWall && topNow.kind === 'cube'))) return 'no-room'
    changes.push(change(top, topNow, make('top')))
  }
  return changes
}

/** Why a target can't take this block, or null when it can. */
export const whyNot = (w: BlockWorld, t: Target, held: Held = { kind: 'cube', color: 'roed' }, towardsCamera = { x: 0, z: 1 }): BounceReason | null => {
  const p = plan(w, t, held, towardsCamera)
  return typeof p === 'string' ? p : null
}

/** The cells a placement would fill (the ghost shows them), or null when it would bounce. */
export const previewCells = (w: BlockWorld, t: Target, held: Held, towardsCamera: { x: number; z: number }): Cell[] | null => {
  const p = plan(w, t, held, towardsCamera)
  return typeof p === 'string' ? null : p.map((c) => c.cell)
}

const apply = (w: BlockWorld, changes: Change[], take: 'before' | 'after'): Record<string, Block> => {
  const cells = { ...w.cells }
  for (const c of changes) {
    const b = c[take]
    if (b) cells[cellKey(c.cell)] = b
    else delete cells[cellKey(c.cell)]
  }
  return cells
}

/**
 * THE resolver — the only way a gesture adds a block (§4.3). `towardsCamera` decides the facing of a
 * special placed on a top face or the plate. A bounce returns the world unchanged.
 */
export const resolvePlacement = (w: BlockWorld, t: Target, held: Held, towardsCamera: { x: number; z: number }): PlaceResult => {
  const p = plan(w, t, held, towardsCamera)
  if (typeof p === 'string') return { bounce: p, world: w }
  return { placed: { ...w, cells: apply(w, p, 'after'), actions: [...w.actions, { t: 'place', changes: p }] }, cell: p[0].cell }
}

/** The eraser: take the block at `cell` off — a door goes whole, from either half. Null when empty. */
export const removeBlock = (w: BlockWorld, cell: Cell): BlockWorld | null => {
  const b = blockAt(w, cell)
  if (!b) return null
  const changes: Change[] = [change(cell, b)]
  if (b.kind === 'door') {
    const other = b.part === 'top' ? below(cell) : above(cell)
    const ob = blockAt(w, other)
    if (ob?.kind === 'door') changes.push(change(other, ob))
  }
  return { ...w, cells: apply(w, changes, 'after'), actions: [...w.actions, { t: 'remove', changes }] }
}

/** Undo the last place or removal (§2.2.11: unlimited). Restores every cell's "before" — a replaced wall too. */
export const undo = (w: BlockWorld): BlockWorld | null => {
  const last = w.actions[w.actions.length - 1]
  if (!last) return null
  return { ...w, cells: apply(w, last.changes, 'before'), actions: w.actions.slice(0, -1) }
}

// ----- session (§4.12): the ACTION LIST, colours by palette ID (never an index) ------------------------

type SavedBlock = [kind: string, color: string, facing: string, part?: 'top']
type SavedChange = [x: number, y: number, z: number, before: SavedBlock | 0, after: SavedBlock | 0]
type SavedAction = { t: 'p' | 'r'; c: SavedChange[] }

const saveBlock = (b?: Block): SavedBlock | 0 => (b ? (b.part ? [b.kind, b.color, b.facing, b.part] : [b.kind, b.color, b.facing]) : 0)
const loadBlock = (s: unknown): Block | undefined | null => {
  if (s === 0) return undefined
  if (!Array.isArray(s)) return null
  const [kind, color, facing, part] = s as SavedBlock
  if (!(BLOCK_KINDS as readonly string[]).includes(kind) || !(PALETTE_13 as readonly string[]).includes(color) || !(FACINGS as readonly string[]).includes(facing)) return null
  if (part !== undefined && part !== 'top') return null
  return { kind: kind as BlockKind, color: color as CrayonColor, facing: facing as Facing, ...(part ? { part } : {}) }
}

export const serialiseWorld = (w: BlockWorld): string =>
  JSON.stringify(
    w.actions.map((a): SavedAction => ({
      t: a.t === 'place' ? 'p' : 'r',
      c: a.changes.map((c) => [c.cell.x, c.cell.y, c.cell.z, saveBlock(c.before), saveBlock(c.after)]),
    })),
  )

/**
 * Replay a saved action list onto a fresh world. An action that no longer fits (a level change shrank
 * the plate, an unknown kind, a cell that doesn't hold its "before") is dropped whole, and an older
 * session format is ignored — a stale session degrades, never crashes.
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
    const a = item as SavedAction
    if (!a || (a.t !== 'p' && a.t !== 'r') || !Array.isArray(a.c) || !a.c.length) continue
    const changes: Change[] = []
    let ok = true
    for (const sc of a.c) {
      if (!Array.isArray(sc) || sc.length !== 5) { ok = false; break }
      const [x, y, z, sb, sa] = sc
      const cell = { x, y, z }
      const before = loadBlock(sb), after = loadBlock(sa)
      if (before === null || after === null || ![x, y, z].every(Number.isInteger) || !inBounds(w, cell)) { ok = false; break }
      const now = blockAt(w, cell)
      if (JSON.stringify(now) !== JSON.stringify(before)) { ok = false; break }
      changes.push(change(cell, before, after))
    }
    if (!ok) continue
    w = { ...w, cells: apply(w, changes, 'after'), actions: [...w.actions, { t: a.t === 'p' ? 'place' : 'remove', changes }] }
  }
  return w
}

/** Every block as a list — what the scene draws (a door's upper half included; the scene skips it). */
export const blockList = (w: BlockWorld): { cell: Cell; block: Block }[] =>
  Object.entries(w.cells).map(([k, block]) => ({ cell: parseKey(k), block }))
