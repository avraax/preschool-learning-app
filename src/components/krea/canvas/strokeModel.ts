// The drawing as DATA (Krea PRD-01 §4.2) — pure, no DOM, Node-testable.
//
// A picture is an ordered list of strokes in a fixed LOGICAL paper space (`PAPER_W` × `PAPER_H`,
// quantised integer points), never pixels. Everything else follows from that:
//   - undo is "drop the last stroke and replay", never a bitmap snapshot (WebKit caps total canvas
//     memory; a full-paper snapshot at dpr 2 is ~20 MB);
//   - resume after a reload is "replay the list", so the session copy is a few KB of integers;
//   - each stroke carries its own SEED, so a replay draws exactly the same grain and glitter
//     (`brushes.ts`) — otherwise an undo would visibly re-roll every star on the page.
//
// `baked` is a render-side hint only: strokes below it have been drawn into the ink layer's one
// checkpoint canvas. It is NOT an undo limit: undo goes all the way back to a blank paper and the
// checkpoint follows (an undo below it rebuilds it from the list). It used to be one — undo silently
// stopped working after 30 steps, which a child hammering the button reads as it breaking.

import { PAPER_H, PAPER_W } from '../../../config/kreaPaper.ts'
export { PAPER_H, PAPER_W } from '../../../config/kreaPaper.ts'

/** How many of the most recent strokes stay undoable; older ones are baked into the checkpoint. */
export const UNDO_DEPTH = 30

export type BrushTool = 'crayon' | 'rainbow' | 'glitter' | 'eraser'
export type Tool = BrushTool | 'stamp'

import { PALETTE_13, type CrayonColor } from '../../../config/kreaPalette.ts'
export { PALETTE_13, PALETTE_9, type CrayonColor } from '../../../config/kreaPalette.ts'

export interface BrushStroke {
  tool: BrushTool
  /** Only a crayon has a colour; rainbow and glitter are brushes, not colours (§2.2.6). */
  color?: CrayonColor
  /** Flat [x0, y0, x1, y1, …] in paper units, integers. A tap is a single point. */
  points: number[]
  seed: number
  /**
   * Tegn med Mig's mirror steps (§4.3): the vertical axis, in paper units, this stroke is ALSO drawn
   * reflected across. Per stroke, not per surface, so a replay mirrors exactly the strokes that were.
   */
  mirror?: number
}

export interface StampStroke {
  tool: 'stamp'
  stamp: string
  x: number
  y: number
  size: number
  seed: number
  /**
   * A DRAGGED stamp (owner, 2026-11-04: "keep painting multiple trees as I drag, as in other paint
   * programs"): the further placements after (x, y), flat [x1, y1, x2, y2, …], `STAMP_STEP` apart along
   * the finger's path. One drag is ONE stroke, so one undo takes the whole trail back. Absent on a tap.
   */
  trail?: number[]
}

export type Stroke = BrushStroke | StampStroke

export interface Drawing {
  strokes: Stroke[]
  baked: number
}

export const emptyDrawing = (): Drawing => ({ strokes: [], baked: 0 })

/** Brush widths in paper units — one value per tool, the same at every level (no size toggle, §2.2.5). */
export const BRUSH_WIDTH: Record<BrushTool, number> = { crayon: 22, rainbow: 22, glitter: 20, eraser: 56 }

export const STAMP_SIZE = 150

/** How far apart (paper units) a dragged stamp's pictures land: just under a picture apart, so a trail
 *  reads as a row of trees rather than one smeared blob, and the pictures' own margins keep them apart. */
export const STAMP_STEP = Math.round(STAMP_SIZE * 0.9)

/** The most pictures one drag may lay (a scribble across the page is ~30); keeps the session copy small. */
export const STAMP_TRAIL_MAX = 60

/** Every placement of a stamp stroke, in drawing order: (x, y) first, then its trail. */
export const stampPlacements = (s: StampStroke): Array<[number, number]> => {
  const out: Array<[number, number]> = [[s.x, s.y]]
  const t = s.trail ?? []
  for (let i = 0; i + 1 < t.length; i += 2) out.push([t[i], t[i + 1]])
  return out
}

/**
 * Extend a dragged stamp's trail toward the finger at (x, y): one placement every `STAMP_STEP` along the
 * straight line from the last placement, so a fast flick lays the same even row a slow drag does.
 * Mutates `trail` (the live stroke's own array); returns how many placements it added.
 */
export function extendStampTrail(s: StampStroke & { trail: number[] }, x: number, y: number): number {
  let added = 0
  const n = s.trail.length
  let lx = n ? s.trail[n - 2] : s.x
  let ly = n ? s.trail[n - 1] : s.y
  let d = Math.hypot(x - lx, y - ly)
  while (d >= STAMP_STEP && s.trail.length / 2 < STAMP_TRAIL_MAX) {
    const k = STAMP_STEP / d
    lx = quantise(lx + (x - lx) * k, PAPER_W)
    ly = quantise(ly + (y - ly) * k, PAPER_H)
    s.trail.push(lx, ly)
    added++
    d = Math.hypot(x - lx, y - ly)
  }
  return added
}

export const quantise = (v: number, max: number): number => Math.max(0, Math.min(max, Math.round(v)))

export function addStroke(d: Drawing, s: Stroke): Drawing {
  const strokes = [...d.strokes, s]
  return { strokes, baked: Math.max(d.baked, strokes.length - UNDO_DEPTH) }
}

export const canUndo = (d: Drawing): boolean => d.strokes.length > 0

export function undo(d: Drawing): Drawing {
  if (!canUndo(d)) return d
  const strokes = d.strokes.slice(0, -1)
  return { strokes, baked: Math.min(d.baked, Math.max(0, strokes.length - UNDO_DEPTH)) }
}

/** Anything on the paper except eraser marks — what makes Fri Tegning's done button appear. */
export const hasInk = (d: Drawing): boolean => d.strokes.some((s) => s.tool !== 'eraser')

/**
 * Distinct palette colours inked — the "Du har brugt {n} farver!" count (§2.3.15). Rainbow and glitter
 * are brushes and do not count; nor do stamps or the eraser.
 */
export function colorsUsed(d: Drawing): number {
  const used = new Set<CrayonColor>()
  for (const s of d.strokes) if (s.tool === 'crayon' && s.color) used.add(s.color)
  return used.size
}

/** A seed derived from the stroke's position in the list — stable across replays and resumes. */
export const seedFor = (index: number): number => (Math.imul(index + 1, 2654435761) >>> 0) || 1

// ----- serialise ---------------------------------------------------------------------------------

const TOOLS: ReadonlySet<string> = new Set(['crayon', 'rainbow', 'glitter', 'eraser', 'stamp'])
const COLORS: ReadonlySet<string> = new Set(PALETTE_13)

export const serialise = (d: Drawing): string => JSON.stringify({ v: 1, s: d.strokes })

/**
 * Parse a stored drawing. Anything malformed is DROPPED stroke by stroke rather than thrown — a resume
 * must never crash the studio, at worst it loses a stroke (§4.6). Returns null when nothing is usable.
 */
export function deserialise(raw: string | null | undefined, stampIds?: ReadonlySet<string>): Drawing | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const list = (parsed as { v?: unknown; s?: unknown })?.s
  if ((parsed as { v?: unknown })?.v !== 1 || !Array.isArray(list)) return null
  const strokes: Stroke[] = []
  for (const r of list as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object' || !TOOLS.has(String(r.tool))) continue
    const seed = Number.isInteger(r.seed) ? (r.seed as number) >>> 0 : seedFor(strokes.length)
    if (r.tool === 'stamp') {
      const stamp = String(r.stamp ?? '')
      if (!stamp || (stampIds && !stampIds.has(stamp))) continue
      // A malformed trail drops the TRAIL, not the stamp: the first picture still stands.
      const tr = Array.isArray(r.trail) ? (r.trail as unknown[]) : []
      const trailOk = tr.length >= 2 && tr.length % 2 === 0 && tr.every((n) => Number.isFinite(n))
      const trail = trailOk ? (tr as number[]).slice(0, STAMP_TRAIL_MAX * 2).map((n, i) => quantise(n, i % 2 === 0 ? PAPER_W : PAPER_H)) : null
      strokes.push({
        tool: 'stamp',
        stamp,
        x: quantise(Number(r.x), PAPER_W),
        y: quantise(Number(r.y), PAPER_H),
        size: quantise(Number(r.size) || STAMP_SIZE, PAPER_W),
        seed,
        ...(trail ? { trail } : {}),
      })
      continue
    }
    const pts = Array.isArray(r.points) ? (r.points as unknown[]) : []
    if (pts.length < 2 || pts.length % 2 !== 0 || !pts.every((n) => Number.isFinite(n))) continue
    const points = (pts as number[]).map((n, i) => quantise(n, i % 2 === 0 ? PAPER_W : PAPER_H))
    const tool = r.tool as BrushTool
    const mirror = Number.isFinite(r.mirror) ? { mirror: quantise(r.mirror as number, PAPER_W) } : {}
    if (tool === 'crayon') {
      if (!COLORS.has(String(r.color))) continue
      strokes.push({ tool, color: r.color as CrayonColor, points, seed, ...mirror })
    } else {
      strokes.push({ tool, points, seed, ...mirror })
    }
  }
  if (!strokes.length) return null
  return { strokes, baked: Math.max(0, strokes.length - UNDO_DEPTH) }
}
