// A guided piece's state (Tegn med Mig) and its undo rule — pure, Node-testable.

import { undo, type Drawing } from './strokeModel.ts'

export interface Piece {
  drawing: Drawing
  /** The step being drawn; `steps.length` once every step is done. */
  step: number
  /** Index of the first stroke drawn during the current step. */
  start: number
  /**
   * Where each COMPLETED step started, oldest first — so undo can take back the line that finished a
   * step and put the step back (owner, 2026-10-17: "I can't undo a line after drawing it").
   */
  starts: number[]
  /** The done ✓ was pressed: the piece has come alive and earned its XP. */
  done: boolean
}

/** Take back the last line; when it was the line that finished a step, go back to that step. Pure. */
export function undoPiece(p: Piece): Piece {
  if (p.done) return p
  if (p.drawing.strokes.length > p.start) return { ...p, drawing: undo(p.drawing) }
  if (!p.starts.length || !p.drawing.strokes.length) return p
  const starts = p.starts.slice(0, -1)
  return { ...p, drawing: undo(p.drawing), step: p.step - 1, start: p.starts[p.starts.length - 1], starts }
}

