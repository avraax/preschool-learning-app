// The guide shapes of Tegn med Mig (Krea PRD-01 §4.3) — pure, no DOM, Node-testable.
//
// A guided step is drawn from SHAPES, not free SVG: the lesson is the shape ("a big circle for the
// head"), so the data names it, and one source produces both the dotted guide the child sees
// (`shapePath`) and the points the coverage rule measures against (`sampleShape`). A hand-written SVG
// path would need a path parser in Node and could silently disagree with what is sampled.
//
// Coordinates are in a normalised 0–1000 SUBJECT box; `subjectToPaper` maps it into the paper.

export type Shape =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  /** An open run of straight segments (a line is two points); `closed` joins the last to the first. */
  | { kind: 'poly'; pts: number[]; closed?: boolean }
  /** A smooth open curve through the points (quadratic through midpoints, like a stroke). */
  | { kind: 'curve'; pts: number[] }
  /** Part of a circle, angles in degrees, 0 = right, 90 = down (screen space). */
  | { kind: 'arc'; cx: number; cy: number; r: number; from: number; to: number }

export const SUBJECT_BOX = 1000

/** How far apart guide samples lie, in subject units (§4.3: "every ~8 units"). */
export const SAMPLE_STEP = 8

// ----- the paper mapping -------------------------------------------------------------------------

import { PAPER_H, PAPER_W } from './kreaPaper.ts'

/** The subject box sits centred on the paper, a square of this side with a small margin. */
const BOX_SIDE = PAPER_H * 0.92
const BOX_X = (PAPER_W - BOX_SIDE) / 2
const BOX_Y = (PAPER_H - BOX_SIDE) / 2
const K = BOX_SIDE / SUBJECT_BOX

export const subjectToPaper = (x: number, y: number): [number, number] => [BOX_X + x * K, BOX_Y + y * K]
/** A subject-box x on the paper (the mirror axis). */
export const subjectXToPaper = (x: number): number => BOX_X + x * K
/** Subject units → paper units, for lengths. */
export const SUBJECT_TO_PAPER = K
/** The subject box on the paper, as an SVG viewBox — a picker card shows just this square. */
export const SUBJECT_VIEWBOX = `${BOX_X} ${BOX_Y} ${BOX_SIDE} ${BOX_SIDE}`

// ----- sampling ----------------------------------------------------------------------------------

const ellipsePts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, step: number): number[] => {
  const len = Math.abs(a1 - a0) * ((rx + ry) / 2)
  const n = Math.max(8, Math.ceil(len / step))
  const out: number[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)
  }
  return out
}

const lerpRun = (pts: number[], step: number): number[] => {
  const out: number[] = []
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3]
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step))
    for (let j = i === 0 ? 0 : 1; j <= n; j++) out.push(x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n)
  }
  return out
}

/** The quadratic-through-midpoints control polygon of a curve, as [sx,sy, cx,cy, ex,ey] runs. */
const curveRuns = (pts: number[]): number[][] => {
  const n = pts.length / 2
  if (n < 3) return [[pts[0], pts[1], pts[0], pts[1], pts[2] ?? pts[0], pts[3] ?? pts[1]]]
  const runs: number[][] = []
  let sx = pts[0], sy = pts[1]
  for (let i = 1; i < n - 1; i++) {
    const cx = pts[i * 2], cy = pts[i * 2 + 1]
    const last = i === n - 2
    const ex = last ? pts[(n - 1) * 2] : (cx + pts[(i + 1) * 2]) / 2
    const ey = last ? pts[(n - 1) * 2 + 1] : (cy + pts[(i + 1) * 2 + 1]) / 2
    runs.push([sx, sy, cx, cy, ex, ey])
    sx = ex
    sy = ey
  }
  return runs
}

/** Points along a shape, ~`step` subject units apart, as a flat [x0,y0,x1,y1,…] list. */
export function sampleShape(s: Shape, step = SAMPLE_STEP): number[] {
  switch (s.kind) {
    case 'circle':
      return ellipsePts(s.cx, s.cy, s.r, s.r, 0, Math.PI * 2, step)
    case 'ellipse':
      return ellipsePts(s.cx, s.cy, s.rx, s.ry, 0, Math.PI * 2, step)
    case 'arc':
      return ellipsePts(s.cx, s.cy, s.r, s.r, (s.from * Math.PI) / 180, (s.to * Math.PI) / 180, step)
    case 'poly':
      return lerpRun(s.closed ? [...s.pts, s.pts[0], s.pts[1]] : s.pts, step)
    case 'curve': {
      const out: number[] = []
      for (const [sx, sy, cx, cy, ex, ey] of curveRuns(s.pts)) {
        const len = Math.hypot(cx - sx, cy - sy) + Math.hypot(ex - cx, ey - cy)
        const n = Math.max(2, Math.ceil(len / step))
        for (let j = out.length ? 1 : 0; j <= n; j++) {
          const t = j / n
          const u = 1 - t
          out.push(u * u * sx + 2 * u * t * cx + t * t * ex, u * u * sy + 2 * u * t * cy + t * t * ey)
        }
      }
      return out
    }
  }
}

const f = (n: number) => Math.round(n * 10) / 10

/** The shape as an SVG path `d`, in PAPER units (the guide overlay's viewBox is the paper). */
export function shapePath(s: Shape): string {
  const P = (x: number, y: number) => subjectToPaper(x, y).map(f).join(' ')
  switch (s.kind) {
    case 'circle':
    case 'ellipse': {
      const rx = (s.kind === 'circle' ? s.r : s.rx) * K
      const ry = (s.kind === 'circle' ? s.r : s.ry) * K
      const [cx, cy] = subjectToPaper(s.cx, s.cy)
      return `M ${f(cx - rx)} ${f(cy)} a ${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0 a ${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
    }
    case 'arc': {
      const a0 = (s.from * Math.PI) / 180
      const a1 = (s.to * Math.PI) / 180
      const [x0, y0] = subjectToPaper(s.cx + Math.cos(a0) * s.r, s.cy + Math.sin(a0) * s.r)
      const [x1, y1] = subjectToPaper(s.cx + Math.cos(a1) * s.r, s.cy + Math.sin(a1) * s.r)
      const large = Math.abs(s.to - s.from) > 180 ? 1 : 0
      const sweep = s.to > s.from ? 1 : 0
      return `M ${f(x0)} ${f(y0)} A ${f(s.r * K)} ${f(s.r * K)} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}`
    }
    case 'poly': {
      let d = `M ${P(s.pts[0], s.pts[1])}`
      for (let i = 2; i < s.pts.length; i += 2) d += ` L ${P(s.pts[i], s.pts[i + 1])}`
      return s.closed ? `${d} Z` : d
    }
    case 'curve': {
      const runs = curveRuns(s.pts)
      let d = `M ${P(runs[0][0], runs[0][1])}`
      for (const [, , cx, cy, ex, ey] of runs) d += ` Q ${P(cx, cy)} ${P(ex, ey)}`
      return d
    }
  }
}

/** Reflect a shape across the vertical line x = `axis` (subject units) — a mirror step's other side. */
export function mirrorShape(s: Shape, axis: number): Shape {
  const mx = (x: number) => 2 * axis - x
  const mpts = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? mx(v) : v))
  switch (s.kind) {
    case 'circle':
    case 'ellipse':
      return { ...s, cx: mx(s.cx) }
    case 'arc':
      return { kind: 'arc', cx: mx(s.cx), cy: s.cy, r: s.r, from: 180 - s.to, to: 180 - s.from }
    case 'poly':
      return { ...s, pts: mpts(s.pts) }
    case 'curve':
      return { kind: 'curve', pts: mpts(s.pts) }
  }
}
