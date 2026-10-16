// The pegboard as a pure model (Krea PRD-02 §3, §4.1) — `placeBead` is THE resolver: a drag dropped on
// the board and a tap on a peg with a bead in the tweezers both end here, so the two gestures can never
// judge a bead differently (house rule, drag-and-drop.md). No React, no DOM; `beadBoard.test.ts` pins it.
//
// Two modes:
//   - `free`: a shaped board, anything goes anywhere inside the mask (a bead on a full peg swaps colour).
//   - `pattern`: a peg takes only its pattern's colour. A wrong colour, or a peg the pattern doesn't use,
//     BOUNCES: the beads are unchanged and the bead goes back to its bowl — never a buzzer, never
//     "forkert" (§2.4, §5). After 2 misses on the same peg the right bowl glows (the never-fail hint).
//
// Peg geometry is arithmetic, not hundreds of droppables (§4.1): the board is ONE droppable and a point
// becomes a peg by its rect and pitch, snapping to the nearest peg within half a pitch.

import type { CrayonColor } from '../../../config/kreaPalette'

export type BeadColor = CrayonColor

export interface BeadBoard {
  mode: 'free' | 'pattern'
  /** Pegs per side; the grid is n × n, row-major. */
  n: number
  /** Where there is a peg at all. */
  mask: readonly boolean[]
  /** Pattern mode: each peg's colour, `null` = not part of the pattern. */
  target: readonly (BeadColor | null)[] | null
  beads: readonly (BeadColor | null)[]
  /** Wrong-colour bounces per peg (pattern mode) — feeds the 2-miss hint, nothing else. */
  misses: readonly number[]
}

export type PlaceResult = 'placed' | 'swapped' | 'occupied' | 'outside' | 'not-in-pattern' | 'wrong'

export const HINT_AFTER_MISSES = 2

export function freeBoard(n: number, mask: readonly boolean[]): BeadBoard {
  return { mode: 'free', n, mask, target: null, beads: Array(n * n).fill(null), misses: Array(n * n).fill(0) }
}

export function patternBoard(n: number, target: readonly (BeadColor | null)[]): BeadBoard {
  return { mode: 'pattern', n, mask: Array(n * n).fill(true), target, beads: Array(n * n).fill(null), misses: Array(n * n).fill(0) }
}

/** Does this peg take this colour? (The bounce rule, without placing anything.) */
export function accepts(b: BeadBoard, peg: number, colour: BeadColor): PlaceResult {
  if (peg < 0 || peg >= b.n * b.n || !b.mask[peg]) return 'outside'
  if (b.mode === 'pattern') {
    const want = b.target![peg]
    if (!want) return 'not-in-pattern'
    if (want !== colour) return 'wrong'
    return b.beads[peg] === colour ? 'occupied' : 'placed'
  }
  const has = b.beads[peg]
  return has === colour ? 'occupied' : has ? 'swapped' : 'placed'
}

export const landed = (r: PlaceResult): boolean => r === 'placed' || r === 'swapped'

/**
 * Put one bead of `colour` on `peg`. The ONE resolver for drag and tap. A bounce returns the same beads;
 * only a `wrong` counts a miss on that peg, and `hint` then names the bowl that should glow.
 */
export function placeBead(b: BeadBoard, colour: BeadColor, peg: number): { board: BeadBoard; result: PlaceResult; hint: BeadColor | null } {
  const result = accepts(b, peg, colour)
  if (landed(result)) {
    const beads = b.beads.slice()
    beads[peg] = colour
    return { board: { ...b, beads }, result, hint: null }
  }
  if (result === 'wrong') {
    const misses = b.misses.slice()
    misses[peg] += 1
    return { board: { ...b, misses }, result, hint: misses[peg] >= HINT_AFTER_MISSES ? b.target![peg] : null }
  }
  return { board: b, result, hint: null }
}

/** Take the bead off `peg` (back to its bowl, or into the tweezers). Returns its colour, or null. */
export function removeBead(b: BeadBoard, peg: number): { board: BeadBoard; colour: BeadColor | null } {
  const colour = b.beads[peg] ?? null
  if (!colour) return { board: b, colour: null }
  const beads = b.beads.slice()
  beads[peg] = null
  return { board: { ...b, beads }, colour }
}

/**
 * Drag a bead from one peg to another — a remove and a `placeBead`, so the move is judged by the same
 * resolver. A move that wouldn't land leaves the board exactly as it was (the bead springs back home).
 */
export function moveBead(b: BeadBoard, from: number, to: number): { board: BeadBoard; result: PlaceResult } {
  if (from === to) return { board: b, result: 'occupied' }
  const lifted = removeBead(b, from)
  if (!lifted.colour) return { board: b, result: 'outside' }
  const r = placeBead(lifted.board, lifted.colour, to)
  return landed(r.result) ? { board: r.board, result: r.result } : { board: b, result: r.result }
}

export const beadCount = (b: BeadBoard): number => b.beads.reduce((n, c) => n + (c ? 1 : 0), 0)

/** Pattern mode: every pattern peg holds its colour. A free board is never "complete" (it has no finish). */
export function isComplete(b: BeadBoard): boolean {
  if (b.mode !== 'pattern') return false
  return b.target!.every((c, i) => !c || b.beads[i] === c)
}

/** The legend counts the child is matching against (pattern mode) — derived, never typed. */
export function targetCounts(b: BeadBoard): Map<BeadColor, number> {
  const m = new Map<BeadColor, number>()
  for (const c of b.target ?? []) if (c) m.set(c, (m.get(c) ?? 0) + 1)
  return m
}

// ----- geometry --------------------------------------------------------------------------------------

export interface PegGeometry {
  /** The board's peg-area rect in client px: the outer pegs' centres sit half a pitch inside it. */
  left: number
  top: number
  pitch: number
  n: number
}

/**
 * The peg under a client point: row/col by arithmetic, accepted within half a pitch of a peg centre
 * (i.e. anywhere inside the peg area), else -1. Mask is the caller's business (`accepts` says `outside`).
 */
export function pegAt(g: PegGeometry, x: number, y: number): number {
  const col = Math.floor((x - g.left) / g.pitch)
  const row = Math.floor((y - g.top) / g.pitch)
  if (col < 0 || row < 0 || col >= g.n || row >= g.n) return -1
  return row * g.n + col
}

export const pegCentre = (g: PegGeometry, peg: number): { x: number; y: number } => ({
  x: g.left + ((peg % g.n) + 0.5) * g.pitch,
  y: g.top + (Math.floor(peg / g.n) + 0.5) * g.pitch,
})

// ----- session (kreaSession value) ---------------------------------------------------------------

/** The placed beads as a compact string: one char per peg, `.` empty, else the palette index in base 36. */
export function serialiseBeads(b: BeadBoard, palette: readonly BeadColor[]): string {
  return b.beads.map((c) => (c ? palette.indexOf(c).toString(36) : '.')).join('')
}

/** Restore saved beads onto a fresh board of the same shape. Anything that doesn't fit is dropped. */
export function restoreBeads(b: BeadBoard, raw: string | null, palette: readonly BeadColor[]): BeadBoard {
  if (!raw || raw.length !== b.n * b.n) return b
  const beads = b.beads.slice()
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '.' || !b.mask[i]) continue
    const c = palette[parseInt(raw[i], 36)]
    if (c && (b.mode === 'free' || b.target![i] === c)) beads[i] = c
  }
  return { ...b, beads }
}
