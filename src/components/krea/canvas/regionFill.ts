// Farvelæg's fill (Krea PRD-01 §4.4) — pure, no DOM, Node-testable.
//
// There is NO flood fill at runtime: `scripts/krea-regions.mjs` already labelled every region, so a tap
// looks up the id under the finger and paints exactly that id's pixels inside its box. It cannot leak,
// and it costs one pass over a box.
//
// The label map ships as a LOSSLESS PNG with the id in R + G×256 (`regionLabel.ts`: 0 = line,
// 0xFFFF = paper you can't colour). Never WebP it: lossy encoding corrupts ids.

import { UNFILLABLE } from './regionLabel.ts'
import { PALETTE_12, type CrayonColor } from '../../../config/kreaPalette.ts'

export { UNFILLABLE }

/** RGBA pixels of the label PNG → one id per pixel. */
export function decodeLabels(rgba: Uint8ClampedArray | Uint8Array): Uint16Array {
  const out = new Uint16Array(rgba.length / 4)
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = rgba[i] | (rgba[i + 1] << 8)
  return out
}

/**
 * The region under a tap at label-map pixel (x, y). A tap on a LINE resolves to the nearest region
 * within `radius` px (a finger is wider than a line); a tap on paper you can't colour resolves to
 * nothing. Returns 0 for nothing.
 */
export function regionAt(labels: Uint16Array, w: number, h: number, x: number, y: number, radius: number): number {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0
  const here = labels[yi * w + xi]
  if (here === UNFILLABLE) return 0
  if (here) return here
  let best = 0
  let bestD = radius * radius + 1
  const r = Math.ceil(radius)
  for (let dy = -r; dy <= r; dy++) {
    const yy = yi + dy
    if (yy < 0 || yy >= h) continue
    for (let dx = -r; dx <= r; dx++) {
      const xx = xi + dx
      if (xx < 0 || xx >= w) continue
      const d = dx * dx + dy * dy
      if (d >= bestD) continue
      const id = labels[yy * w + xx]
      if (id && id !== UNFILLABLE) {
        best = id
        bestD = d
      }
    }
  }
  return best
}

/**
 * Paint region `id` into `out`, an RGBA buffer covering the box [x0, y0, x1, y1] of a `w`-wide label
 * map: its pixels get `rgb` (or transparent, for `null` — the eraser), every other pixel is untouched.
 */
export function paintRegion(
  out: Uint8ClampedArray,
  labels: Uint16Array,
  w: number,
  box: readonly [number, number, number, number],
  id: number,
  rgb: readonly [number, number, number] | null,
): void {
  const [x0, y0, x1, y1] = box
  const bw = x1 - x0 + 1
  for (let y = y0; y <= y1; y++) {
    const row = y * w
    const orow = (y - y0) * bw
    for (let x = x0; x <= x1; x++) {
      if (labels[row + x] !== id) continue
      const o = (orow + (x - x0)) * 4
      if (rgb) {
        out[o] = rgb[0]
        out[o + 1] = rgb[1]
        out[o + 2] = rgb[2]
        out[o + 3] = 255
      } else {
        out[o + 3] = 0
      }
    }
  }
}

// ----- the fill actions --------------------------------------------------------------------------
//
// A page is a list of ACTIONS (fill region r with colour c, or clear it), so undo is "drop the last
// action and replay", the session copy is a few integers, and resume restores undo too.

export type FillAction = [region: number, color: CrayonColor | null]

/** Which colour each region ends up with (absent = unfilled). */
export function fillsOf(actions: readonly FillAction[]): Map<number, CrayonColor> {
  const m = new Map<number, CrayonColor>()
  for (const [r, c] of actions) {
    if (c) m.set(r, c)
    else m.delete(r)
  }
  return m
}

/** Every region has a fill — any colour counts, white too (§2.2.9). */
export const allFilled = (actions: readonly FillAction[], count: number): boolean => count > 0 && fillsOf(actions).size >= count

/** Unfilled region ids, ascending. */
export function unfilled(actions: readonly FillAction[], count: number): number[] {
  const f = fillsOf(actions)
  const out: number[] = []
  for (let r = 1; r <= count; r++) if (!f.has(r)) out.push(r)
  return out
}

const COLORS: ReadonlySet<string> = new Set(PALETTE_12)

export const serialiseFills = (actions: readonly FillAction[]): string => JSON.stringify({ v: 1, a: actions })

/** Parse stored actions, dropping anything malformed (a resume must never crash). */
export function deserialiseFills(raw: string | null | undefined, count: number): FillAction[] {
  if (!raw) return []
  try {
    const p = JSON.parse(raw) as { v?: number; a?: unknown }
    if (p?.v !== 1 || !Array.isArray(p.a)) return []
    const out: FillAction[] = []
    for (const a of p.a as unknown[]) {
      if (!Array.isArray(a) || a.length !== 2) continue
      const [r, c] = a as [unknown, unknown]
      if (!Number.isInteger(r) || (r as number) < 1 || (r as number) > count) continue
      if (c !== null && !COLORS.has(String(c))) continue
      out.push([r as number, c as CrayonColor | null])
    }
    return out
  } catch {
    return []
  }
}
