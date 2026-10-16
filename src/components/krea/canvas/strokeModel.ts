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
// checkpoint canvas and are no longer undoable (the last `UNDO_DEPTH` stay live).

export const PAPER_W = 1200
export const PAPER_H = 900

/** How many of the most recent strokes stay undoable; older ones are baked into the checkpoint. */
export const UNDO_DEPTH = 30

export type BrushTool = 'crayon' | 'rainbow' | 'glitter' | 'eraser'
export type Tool = BrushTool | 'stamp'

import { PALETTE_12, type CrayonColor } from '../../../config/kreaPalette.ts'
export { PALETTE_12, PALETTE_8, type CrayonColor } from '../../../config/kreaPalette.ts'

export interface BrushStroke {
  tool: BrushTool
  /** Only a crayon has a colour; rainbow and glitter are brushes, not colours (§2.2.6). */
  color?: CrayonColor
  /** Flat [x0, y0, x1, y1, …] in paper units, integers. A tap is a single point. */
  points: number[]
  seed: number
}

export interface StampStroke {
  tool: 'stamp'
  stamp: string
  x: number
  y: number
  size: number
  seed: number
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

export const quantise = (v: number, max: number): number => Math.max(0, Math.min(max, Math.round(v)))

export function addStroke(d: Drawing, s: Stroke): Drawing {
  const strokes = [...d.strokes, s]
  return { strokes, baked: Math.max(d.baked, strokes.length - UNDO_DEPTH) }
}

export const canUndo = (d: Drawing): boolean => d.strokes.length > d.baked

export function undo(d: Drawing): Drawing {
  if (!canUndo(d)) return d
  return { strokes: d.strokes.slice(0, -1), baked: d.baked }
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
const COLORS: ReadonlySet<string> = new Set(PALETTE_12)

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
      strokes.push({
        tool: 'stamp',
        stamp,
        x: quantise(Number(r.x), PAPER_W),
        y: quantise(Number(r.y), PAPER_H),
        size: quantise(Number(r.size) || STAMP_SIZE, PAPER_W),
        seed,
      })
      continue
    }
    const pts = Array.isArray(r.points) ? (r.points as unknown[]) : []
    if (pts.length < 2 || pts.length % 2 !== 0 || !pts.every((n) => Number.isFinite(n))) continue
    const points = (pts as number[]).map((n, i) => quantise(n, i % 2 === 0 ? PAPER_W : PAPER_H))
    const tool = r.tool as BrushTool
    if (tool === 'crayon') {
      if (!COLORS.has(String(r.color))) continue
      strokes.push({ tool, color: r.color as CrayonColor, points, seed })
    } else {
      strokes.push({ tool, points, seed })
    }
  }
  if (!strokes.length) return null
  return { strokes, baked: Math.max(0, strokes.length - UNDO_DEPTH) }
}
