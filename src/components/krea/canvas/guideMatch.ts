// The guided-step coverage rule (Krea PRD-01 §4.3) — pure, no DOM, Node-testable.
//
// A step counts when the child has drawn ROUGHLY along the guide: at least 60% of the guide's samples
// lie within the tolerance band of any ink drawn during this step, checked when the pointer comes up.
// It is deliberately forgiving — tracing skill grows mostly after age 6–8 — and it can never fail:
// after 3 strokes on a step that still don't pass, the step is accepted anyway. There is no visible
// "miss", ever, and the child's own wobbly line is the picture (nothing is snapped or redrawn).

import { sampleShape, subjectToPaper, subjectXToPaper, type Shape } from '../../../config/kreaShapes.ts'
import { MIRROR_AXIS, type GuideStep } from '../../../config/kreaSubjects.ts'
import { BRUSH_WIDTH, PAPER_W } from './strokeModel.ts'

/** The share of guide samples that must be inked. */
export const COVERAGE_PASS = 0.6
/** Strokes on one step that don't pass before the step is accepted anyway. */
export const NEVER_FAIL_STROKES = 3

/** A step's guide as paper-unit sample points (the drawn side only, for a mirror step). */
export function guideSamples(shapes: readonly Shape[]): number[] {
  const out: number[] = []
  for (const s of shapes) {
    const pts = sampleShape(s)
    for (let i = 0; i < pts.length; i += 2) out.push(...subjectToPaper(pts[i], pts[i + 1]))
  }
  return out
}

const segDist2 = (px: number, py: number, x0: number, y0: number, x1: number, y1: number): number => {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const ex = x0 + t * dx - px
  const ey = y0 + t * dy - py
  return ex * ex + ey * ey
}

/**
 * The share (0–1) of `guide` samples within `tol` paper units of any ink polyline. `ink` holds each
 * stroke's flat point list; a single point is a dot.
 */
export function coverage(guide: readonly number[], ink: readonly (readonly number[])[], tol: number): number {
  const n = guide.length / 2
  if (!n) return 1
  const tol2 = tol * tol
  let hit = 0
  for (let g = 0; g < n; g++) {
    const gx = guide[g * 2]
    const gy = guide[g * 2 + 1]
    let near = false
    for (const p of ink) {
      if (p.length === 2) {
        if ((p[0] - gx) ** 2 + (p[1] - gy) ** 2 <= tol2) near = true
      } else {
        for (let i = 0; i + 3 < p.length && !near; i += 2) {
          if (segDist2(gx, gy, p[i], p[i + 1], p[i + 2], p[i + 3]) <= tol2) near = true
        }
      }
      if (near) break
    }
    if (near) hit++
  }
  return hit / n
}

/** Reflect a stroke's points across a vertical paper-unit axis. */
const reflect = (pts: readonly number[], axis: number): number[] => pts.map((v, i) => (i % 2 === 0 ? 2 * axis - v : v))

/**
 * The tolerance band in paper units for a band of `tolPx` CSS px on a paper `paperCssWidth` px wide —
 * the finger is the same size whatever the paper's size, so the band is set in CSS px — plus half the
 * crayon's width (its edge, not its centre line, is what reaches the guide). Capped so a phone's small
 * paper doesn't turn the band into "anywhere".
 */
export function toleranceInPaper(tolPx: number, paperCssWidth: number): number {
  const band = paperCssWidth > 0 ? (tolPx * PAPER_W) / paperCssWidth : tolPx
  return Math.min(band, 120) + BRUSH_WIDTH.crayon / 2
}

export interface StepJudgement {
  coverage: number
  passed: boolean
  /** Passed by the never-fail rule rather than by coverage. */
  waved: boolean
}

/**
 * Judge a step after a pointer-up. `strokes` are the point lists drawn during this step, oldest first.
 * A mirror step matches the ink AND its reflection, so a child who draws on the "wrong" side is not
 * penalised for it.
 */
export function judgeStep(step: GuideStep, strokes: readonly (readonly number[])[], tol: number): StepJudgement {
  const guide = guideSamples(step.shapes)
  const axis = subjectXToPaper(MIRROR_AXIS)
  const ink = step.mirror ? [...strokes, ...strokes.map((p) => reflect(p, axis))] : strokes
  const c = coverage(guide, ink, tol)
  if (c >= COVERAGE_PASS) return { coverage: c, passed: true, waved: false }
  const waved = strokes.length >= NEVER_FAIL_STROKES
  return { coverage: c, passed: waved, waved }
}
