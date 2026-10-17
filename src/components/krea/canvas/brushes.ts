// The brush renderers (Krea PRD-01 §2.2.5, §4.2). Each draws ONE stroke from the data model onto a 2D
// context, in paper units scaled by `env.scale`. They are DETERMINISTIC: every random choice comes from
// a PRNG seeded by the stroke's own seed, so replaying a list (undo, resume) paints the identical
// picture. `brushes.test.ts` proves it by recording the canvas calls twice.
//
// The crayon is a SOLID colour (owner, 2026-10-16) — the earlier wax grain read as white dots in the line.

import { BRUSH_WIDTH, type CrayonColor, type Stroke } from './strokeModel.ts'

/** The crayon colours as drawn. Pure, saturated, like the baked crayons' names promise. */
export const CRAYON_HEX: Record<CrayonColor, string> = {
  roed: '#E53935',
  orange: '#FB8C00',
  gul: '#FDD835',
  // Matched to the crayons as rendered (pass 3): light green is a soft MINT, green a bright grass
  // green — a crayon must draw the colour the child sees on it.
  lysegroen: '#8ED6A6',
  groen: '#47AD2E',
  lyseblaa: '#4FC3F7',
  blaa: '#1E63D6',
  lilla: '#8E44AD',
  lyseroed: '#F48FB1',
  brun: '#8D5524',
  sort: '#2B2B2B',
  hvid: '#FFFFFF',
}

/** mulberry32 — tiny, fast, good enough for stamp tilt and sparkle placement. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BrushEnv {
  ctx: CanvasRenderingContext2D
  /** Device pixels per paper unit. */
  scale: number
  /** The crayon paint for a colour — its solid `CRAYON_HEX`. */
  crayonPaint: (color: CrayonColor) => CanvasPattern | string
  /** A loaded stamp image, or null while it is still loading (the surface redraws on load). */
  stampImage: (id: string) => CanvasImageSource | null
  /**
   * A vertical mirror axis in paper units (Tegn med Mig's mirror steps, §4.3): when set, the stroke is
   * ALSO drawn reflected across it, live, onto the same layer.
   */
  mirrorX?: number
}

const GLITTER_COLORS = ['#FFD54F', '#FFF59D', '#FFFFFF', '#F8BBD0', '#B3E5FC', '#FFE082']

// ----- the painter: one stroke, painted INCREMENTALLY -----------------------------------------------
//
// A stroke is painted as a run of short smoothed SEGMENTS (quadratic curves through the midpoints, so a
// fast stroke isn't a polygon). The live layer paints only the segments that are new since the last
// frame — never the whole stroke again, which made every frame cost O(stroke length): measured at 4×
// CPU throttle, a long scribble's last second ran at 330–550 ms a frame. The committed stroke is
// painted by a fresh painter through the SAME segment loop, so live and committed are the same marks.
// That only holds because every brush paints OPAQUE (solid colours, no transparency):
// where two segments' round caps overlap, an opaque mark painted twice is still the same pixel.

interface PainterState {
  sx: number
  sy: number
  /** Rainbow: distance travelled so far, which drives the hue. */
  dist: number
  /** The next point to walk to (1-based edge end), and whether the pointer-up stretch is painted. */
  edge: number
  done: boolean
  /** Glitter: the leftover distance to the next star, and the seeded generator. */
  carry: number
  r: () => number
  stamped: boolean
}

export interface StrokePainter {
  /** Paint whatever is new. `final` also paints the last segment to the last point (pointer is up). */
  paint(env: BrushEnv, final: boolean): void
}

const STAR_STEP = 12

/** A soft gold, OPAQUE — a translucent trail would darken where its segments overlap. */
const GLITTER_TRAIL = '#F6DC8F'

export function createPainter(s: Stroke): StrokePainter {
  const st: PainterState = { sx: 0, sy: 0, dist: 0, edge: 1, done: false, carry: STAR_STEP, r: rng(s.seed), stamped: false }
  if (s.tool !== 'stamp') {
    st.sx = s.points[0]
    st.sy = s.points[1]
  }
  return {
    paint(env, final) {
      const { ctx, scale: k } = env
      const mx = s.tool !== 'stamp' && s.mirror !== undefined ? s.mirror : env.mirrorX
      const xs = (x: number): number[] => (mx === undefined ? [x] : [x, 2 * mx - x])
      ctx.save()
      if (s.tool === 'stamp') {
        const img = env.stampImage(s.stamp)
        if (img && !st.stamped) {
          st.stamped = true
          const tilt = (rng(s.seed)() - 0.5) * 0.24
          const size = s.size * k
          for (const x of xs(s.x)) {
            ctx.save()
            ctx.translate(x * k, s.y * k)
            ctx.rotate(tilt)
            ctx.drawImage(img, -size / 2, -size / 2, size, size)
            ctx.restore()
          }
        }
        ctx.restore()
        return
      }
      const p = s.points
      const n = p.length / 2
      const w = BRUSH_WIDTH[s.tool] * k
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over'
      if (s.tool === 'crayon' && s.color) ctx.strokeStyle = env.crayonPaint(s.color)
      else if (s.tool === 'eraser') ctx.strokeStyle = '#000'
      else if (s.tool === 'glitter') ctx.strokeStyle = GLITTER_TRAIL
      ctx.lineWidth = s.tool === 'glitter' ? w * 0.5 : w

      // One curve from the current start to (ex, ey) via control (cx, cy) — and its mirror image.
      const curve = (cx: number, cy: number, ex: number, ey: number) => {
        if (s.tool === 'rainbow') {
          st.dist += Math.hypot(cx - st.sx, cy - st.sy)
          ctx.strokeStyle = `hsl(${Math.round(st.dist * 0.9) % 360}, 85%, 55%)`
        }
        const sxs = xs(st.sx), cxs = xs(cx), exs = xs(ex)
        for (let m = 0; m < sxs.length; m++) {
          ctx.beginPath()
          ctx.moveTo(sxs[m] * k, st.sy * k)
          ctx.quadraticCurveTo(cxs[m] * k, cy * k, exs[m] * k, ey * k)
          ctx.stroke()
        }
        st.sx = ex
        st.sy = ey
      }

      const r = st.r
      const star = (cx: number, cy: number) => {
        const size = (9 + r() * 12) * k
        const rot = r() * Math.PI
        const jx = (r() - 0.5) * BRUSH_WIDTH.glitter
        const jy = (r() - 0.5) * BRUSH_WIDTH.glitter
        ctx.fillStyle = GLITTER_COLORS[Math.floor(r() * GLITTER_COLORS.length)]
        for (const x of xs(cx + jx)) {
          ctx.beginPath()
          for (let j = 0; j < 8; j++) {
            const rad = j % 2 === 0 ? size : size * 0.38
            const a = rot + (j * Math.PI) / 4
            const px = x * k + Math.cos(a) * rad
            const py = (cy + jy) * k + Math.sin(a) * rad
            if (j === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.fill()
        }
      }
      const glitter = s.tool === 'glitter'

      // ONE walk over the points, in the same order whether this call paints a whole stroke or the
      // last few points of a live one: at point j, the curve segment that point j completes, then the
      // glitter stars along the raw edge ending at j. A whole paint and a frame-by-frame paint
      // therefore stack every mark in the same order (the trail can't end up over a star on lift).
      for (; st.edge < n; st.edge++) {
        const j = st.edge
        if (j >= 2) {
          const i = j - 1
          curve(p[i * 2], p[i * 2 + 1], (p[i * 2] + p[j * 2]) / 2, (p[i * 2 + 1] + p[j * 2 + 1]) / 2)
        }
        if (glitter) {
          const x0 = p[j * 2 - 2], y0 = p[j * 2 - 1], x1 = p[j * 2], y1 = p[j * 2 + 1]
          const len = Math.hypot(x1 - x0, y1 - y0)
          let t = st.carry
          while (t <= len) {
            star(x0 + ((x1 - x0) * t) / len, y0 + ((y1 - y0) * t) / len)
            t += STAR_STEP
          }
          st.carry = t - len
        }
      }
      // Pointer up: the last stretch to the very last point (or, for a tap, one dot).
      if (final && !st.done) {
        st.done = true
        if (n === 1) {
          curve(p[0] + 0.01, p[1], p[0] + 0.02, p[1])
          if (glitter) star(p[0], p[1])
        } else {
          const lx = p[(n - 1) * 2], ly = p[(n - 1) * 2 + 1]
          curve((st.sx + lx) / 2, (st.sy + ly) / 2, lx, ly)
        }
      }
      ctx.restore()
    },
  }
}

/** Draw one whole stroke (and its mirror image, when the env has a mirror axis). */
export function drawStroke(env: BrushEnv, s: Stroke): void {
  createPainter(s).paint(env, true)
}
