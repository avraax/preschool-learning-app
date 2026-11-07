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
 * Cubes + two specials: vindue (window), dør (door), both thin panels with a FIXED look; only the cube
 * takes the picked colour. Owner, 2026-11-07: no roof (J8PYR); the door is 2 WIDE × 3 TALL (6BC2N); and
 * NOTHING EVER REPLACES a block (QHYV8: "I just wanted it on top") — a window or door tapped onto a wall
 * hangs on the wall in the cell in front of it, like any block.
 */
export const BLOCK_KINDS = ['cube', 'wood', 'brick', 'stone', 'metal', 'glass', 'window', 'door'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]
export const SPECIAL_KINDS = ['window', 'door'] as const satisfies readonly BlockKind[]
/**
 * MATERIAL boxes (owner 2026-11-07): a full cube like the clay one, with a FIXED look — træ, mursten, sten,
 * metal, glas. They build exactly like a cube (stack, attach, a window or door goes into them).
 */
export const MATERIAL_KINDS = ['wood', 'brick', 'stone', 'metal', 'glass'] as const satisfies readonly BlockKind[]
export type MaterialKind = (typeof MATERIAL_KINDS)[number]
export const isMaterial = (k: BlockKind): k is MaterialKind => (MATERIAL_KINDS as readonly string[]).includes(k)

/**
 * Which horizontal way a block faces (§4.6). A window/door looks out this way. A cube has one too and ignores it. NEVER chosen by the child: there is no rotate step, ever.
 */
export const FACINGS = ['px', 'nx', 'pz', 'nz'] as const
export type Facing = (typeof FACINGS)[number]
export const facingVector = (f: Facing): { x: number; z: number } =>
  f === 'px' ? { x: 1, z: 0 } : f === 'nx' ? { x: -1, z: 0 } : f === 'pz' ? { x: 0, z: 1 } : { x: 0, z: -1 }
export const facingOf = (v: { x: number; z: number }): Facing =>
  Math.abs(v.x) >= Math.abs(v.z) ? (v.x >= 0 ? 'px' : 'nx') : v.z >= 0 ? 'pz' : 'nz'

/**
 * A door fills 2×3 cells. Its ANCHOR is the bottom cell on the left as seen from the front; every other
 * cell of it carries `anchor` (that cell), so a hit or an erase on any part finds the whole door. The
 * door is drawn once, from its anchor.
 */
export type Block = { kind: BlockKind; color: CrayonColor; facing: Facing; anchor?: Cell }
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

export type BounceReason = 'outside' | 'too-high' | 'occupied' | 'no-attach' | 'no-room' | 'full'

/**
 * The most blocks one world holds. On a plate it never binds (16×16×8 = 2048 cells); on the horizon
 * ground it is THE limit, instead of the area — every block is an instance the old iPad draws each
 * frame, and each shape's instance buffer is sized to this (BlockScene).
 */
export const MAX_BLOCKS = 3000
export type PlaceResult = { placed: BlockWorld; cell: Cell } | { bounce: BounceReason; world: BlockWorld }

export const cellKey = (c: Cell): string => `${c.x},${c.y},${c.z}`
export const parseKey = (k: string): Cell => {
  const [x, y, z] = k.split(',').map(Number)
  return { x, y, z }
}
/** The door's size in cells (owner 6BC2N): wide along the front, tall up. */
export const DOOR_W = 2
export const DOOR_H = 3
/**
 * The way a door grows sideways: to the RIGHT as seen by someone standing in front of it (looking back
 * along −facing). Matches the scene's local +x after its facing rotation (`facingAngle`).
 */
export const doorWidthDir = (f: Facing): { x: number; z: number } => {
  const v = facingVector(f)
  return { x: v.z, z: -v.x }
}
/** Every cell a door anchored at `a`, facing `f`, fills — the anchor first. */
export const doorCells = (a: Cell, f: Facing): Cell[] => {
  const d = doorWidthDir(f)
  const out: Cell[] = []
  for (let j = 0; j < DOOR_H; j++) for (let i = 0; i < DOOR_W; i++) out.push({ x: a.x + d.x * i, y: a.y + j, z: a.z + d.z * i })
  return out
}

export const emptyWorld = (size: number, heightCap: number): BlockWorld => ({ size, heightCap, cells: {}, actions: [] })

export const blockAt = (w: BlockWorld, c: Cell): Block | undefined => w.cells[cellKey(c)]
/** Blocks as a child counts them: a door is ONE block, though it fills six cells. */
export const blockCount = (w: BlockWorld): number => Object.values(w.cells).filter((b) => !b.anchor).length
/** The cells of the whole block at `c` (a door: all six; anything else: just `c`), or [] when empty. */
export const wholeBlockCells = (w: BlockWorld, c: Cell): Cell[] => {
  const b = blockAt(w, c)
  if (!b) return []
  if (b.kind !== 'door') return [c]
  const a = b.anchor ?? c
  const ab = blockAt(w, a)
  return doorCells(a, ab?.facing ?? b.facing).filter((x) => blockAt(w, x)?.kind === 'door')
}

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
    if (!on) return 'no-attach'
  }
  const facing = facingFor(t, towardsCamera)
  // NEVER a replace (owner QHYV8): the block goes in the empty cell across the tapped face, or nowhere.
  const base = targetCell(t)
  if (!inBounds(w, base)) return base.y >= w.heightCap ? 'too-high' : 'outside'
  if (blockAt(w, base)) return 'occupied'
  if (blockCount(w) >= MAX_BLOCKS) return 'full'
  const block: Block = { kind: held.kind, color: held.color, facing }
  if (held.kind !== 'door') return [change(base, undefined, block)]
  // A door needs all six cells free and inside the plate.
  const cells = doorCells(base, facing)
  for (const c of cells) if (!inBounds(w, c) || blockAt(w, c)) return 'no-room'
  return cells.map((c, i) => change(c, undefined, i === 0 ? block : { ...block, anchor: base }))
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

/**
 * MOVE a placed block (owner T59B2: "tap, hold and move it — in all axes"): lift the whole block at `from`
 * and place it where `t` points, through the same planning as a new block (so it lands only where a new
 * one could; a door keeps its 2×3). ONE action: undo puts it back where it was. A bounce leaves the world
 * unchanged. Targets on the lifted block itself are the caller's to ignore (the scene's pick skips them).
 */
export const moveBlock = (w: BlockWorld, from: Cell, t: Target, towardsCamera: { x: number; z: number }): PlaceResult => {
  const cells = wholeBlockCells(w, from)
  const b = cells.length ? blockAt(w, cells[0]) : undefined
  if (!b) return { bounce: 'no-attach', world: w }
  const lifted: BlockWorld = { ...w, cells: apply(w, cells.map((c) => change(c, blockAt(w, c))), 'after') }
  const p = plan(lifted, t, { kind: b.kind, color: b.color }, towardsCamera)
  if (typeof p === 'string') return { bounce: p, world: w }
  // Merge lift + drop per cell, `before` from the world as it was; a cell that ends as it began is no change.
  const merged = new Map<string, Change>()
  for (const c of cells) merged.set(cellKey(c), change(c, blockAt(w, c)))
  for (const ch of p) merged.set(cellKey(ch.cell), change(ch.cell, blockAt(w, ch.cell), ch.after))
  const changes = [...merged.values()].filter((c) => JSON.stringify(c.before) !== JSON.stringify(c.after))
  if (!changes.length) return { bounce: 'occupied', world: w }
  return { placed: { ...w, cells: apply(w, changes, 'after'), actions: [...w.actions, { t: 'place', changes }] }, cell: p[0].cell }
}

/** The eraser: take the block at `cell` off — a door goes whole, from any part. Null when empty. */
export const removeBlock = (w: BlockWorld, cell: Cell): BlockWorld | null => {
  const cells = wholeBlockCells(w, cell)
  if (!cells.length) return null
  const changes: Change[] = cells.map((c) => change(c, blockAt(w, c)))
  return { ...w, cells: apply(w, changes, 'after'), actions: [...w.actions, { t: 'remove', changes }] }
}

/** Undo the last place or removal (§2.2.11: unlimited). Restores every cell's "before". */
export const undo = (w: BlockWorld): BlockWorld | null => {
  const last = w.actions[w.actions.length - 1]
  if (!last) return null
  return { ...w, cells: apply(w, last.changes, 'before'), actions: w.actions.slice(0, -1) }
}

// ----- session (§4.12): the ACTION LIST, colours by palette ID (never an index) ------------------------

/** `anchor` as "x,y,z" on a door's non-anchor cells. (A session from the 1×2 door era is dropped whole.) */
type SavedBlock = [kind: string, color: string, facing: string, anchor?: string]
type SavedChange = [x: number, y: number, z: number, before: SavedBlock | 0, after: SavedBlock | 0]
type SavedAction = { t: 'p' | 'r'; c: SavedChange[] }

const saveBlock = (b?: Block): SavedBlock | 0 => (b ? (b.anchor ? [b.kind, b.color, b.facing, cellKey(b.anchor)] : [b.kind, b.color, b.facing]) : 0)
const loadBlock = (s: unknown): Block | undefined | null => {
  if (s === 0) return undefined
  if (!Array.isArray(s)) return null
  const [kind, color, facing, anchor] = s as SavedBlock
  if (!(BLOCK_KINDS as readonly string[]).includes(kind) || !(PALETTE_13 as readonly string[]).includes(color) || !(FACINGS as readonly string[]).includes(facing)) return null
  let a: Cell | undefined
  if (anchor !== undefined) {
    if (typeof anchor !== 'string' || !/^-?\d+,-?\d+,-?\d+$/.test(anchor)) return null
    a = parseKey(anchor)
  }
  return { kind: kind as BlockKind, color: color as CrayonColor, facing: facing as Facing, ...(a ? { anchor: a } : {}) }
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

/** Every block as a list — what the scene draws (a door's non-anchor cells included; the scene skips them). */
export const blockList = (w: BlockWorld): { cell: Cell; block: Block }[] =>
  Object.entries(w.cells).map(([k, block]) => ({ cell: parseKey(k), block }))
