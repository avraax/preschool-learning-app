// The brush renderers (Krea PRD-01 §2.2.5, §4.2). Each draws ONE stroke from the data model onto a 2D
// context, in paper units scaled by `env.scale`. They are DETERMINISTIC: every random choice comes from
// a PRNG seeded by the stroke's own seed, so replaying a list (undo, resume) paints the identical
// picture. `brushes.test.ts` proves it by recording the canvas calls twice.
//
// Performance on the A10X: the crayon grain is ONE small tile tinted per colour and used as a pattern
// (cached by the caller), never a per-point random scatter.

import { BRUSH_WIDTH, type CrayonColor, type Stroke } from './strokeModel.ts'

/** The crayon colours as drawn. Pure, saturated, like the baked crayons' names promise. */
export const CRAYON_HEX: Record<CrayonColor, string> = {
  roed: '#E53935',
  orange: '#FB8C00',
  gul: '#FDD835',
  lysegroen: '#9CCC65',
  groen: '#2E9D44',
  lyseblaa: '#4FC3F7',
  blaa: '#1E63D6',
  lilla: '#8E44AD',
  lyseroed: '#F48FB1',
  brun: '#8D5524',
  sort: '#2B2B2B',
  hvid: '#FFFFFF',
}

/** mulberry32 — tiny, fast, good enough for grain and sparkle placement. */
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
  /** The crayon paint for a colour — a cached grain pattern in the browser, a plain colour in tests. */
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

/** Smooth path through the points: quadratic curves through midpoints, so fast strokes aren't polygons. */
function smoothPath(ctx: CanvasRenderingContext2D, pts: number[], k: number): void {
  ctx.beginPath()
  const n = pts.length / 2
  ctx.moveTo(pts[0] * k, pts[1] * k)
  if (n === 1) {
    ctx.lineTo(pts[0] * k + 0.01, pts[1] * k)
    return
  }
  for (let i = 1; i < n - 1; i++) {
    const x = pts[i * 2], y = pts[i * 2 + 1]
    const mx = (x + pts[i * 2 + 2]) / 2, my = (y + pts[i * 2 + 3]) / 2
    ctx.quadraticCurveTo(x * k, y * k, mx * k, my * k)
  }
  ctx.lineTo(pts[(n - 1) * 2] * k, pts[(n - 1) * 2 + 1] * k)
}

const mirrored = (pts: number[], axis: number): number[] => pts.map((v, i) => (i % 2 === 0 ? 2 * axis - v : v))

function drawOnce(env: BrushEnv, s: Stroke, pts: number[] | null): void {
  const { ctx, scale: k } = env
  ctx.save()
  if (s.tool === 'stamp') {
    const img = env.stampImage(s.stamp)
    if (img) {
      const r = rng(s.seed)
      const tilt = (r() - 0.5) * 0.24
      const size = s.size * k
      const x = pts ? pts[0] : s.x
      ctx.translate(x * k, s.y * k)
      ctx.rotate(tilt)
      ctx.drawImage(img, -size / 2, -size / 2, size, size)
    }
    ctx.restore()
    return
  }
  const p = pts ?? s.points
  const w = BRUSH_WIDTH[s.tool] * k
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (s.tool === 'crayon' && s.color) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = env.crayonPaint(s.color)
    ctx.lineWidth = w
    smoothPath(ctx, p, k)
    ctx.stroke()
  } else if (s.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = w
    smoothPath(ctx, p, k)
    ctx.stroke()
  } else if (s.tool === 'rainbow') {
    // The hue follows the distance drawn, so a long stroke runs through the whole rainbow.
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineWidth = w
    const n = p.length / 2
    if (n === 1) {
      ctx.fillStyle = 'hsl(0, 85%, 55%)'
      ctx.beginPath()
      ctx.arc(p[0] * k, p[1] * k, w / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    let dist = 0
    let sx = p[0], sy = p[1]
    for (let i = 1; i < n; i++) {
      const x = p[i * 2], y = p[i * 2 + 1]
      const nx = i < n - 1 ? (x + p[i * 2 + 2]) / 2 : x
      const ny = i < n - 1 ? (y + p[i * 2 + 3]) / 2 : y
      dist += Math.hypot(x - sx, y - sy)
      ctx.strokeStyle = `hsl(${Math.round(dist * 0.9) % 360}, 85%, 55%)`
      ctx.beginPath()
      ctx.moveTo(sx * k, sy * k)
      ctx.quadraticCurveTo(x * k, y * k, nx * k, ny * k)
      ctx.stroke()
      sx = nx
      sy = ny
    }
  } else if (s.tool === 'glitter') {
    ctx.globalCompositeOperation = 'source-over'
    // A soft gold trail, then stars strewn along it.
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = '#F2C94C'
    ctx.lineWidth = w * 0.4
    smoothPath(ctx, p, k)
    ctx.stroke()
    ctx.globalAlpha = 1
    const r = rng(s.seed)
    const STEP = 16
    let carry = STEP
    const n = p.length / 2
    const star = (cx: number, cy: number) => {
      const size = (6 + r() * 9) * k
      const rot = r() * Math.PI
      const jx = (r() - 0.5) * BRUSH_WIDTH.glitter * k
      const jy = (r() - 0.5) * BRUSH_WIDTH.glitter * k
      ctx.fillStyle = GLITTER_COLORS[Math.floor(r() * GLITTER_COLORS.length)]
      ctx.beginPath()
      for (let j = 0; j < 8; j++) {
        const rad = j % 2 === 0 ? size : size * 0.38
        const a = rot + (j * Math.PI) / 4
        const px = cx * k + jx + Math.cos(a) * rad
        const py = cy * k + jy + Math.sin(a) * rad
        if (j === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
    }
    if (n === 1) star(p[0], p[1])
    for (let i = 1; i < n; i++) {
      const x0 = p[i * 2 - 2], y0 = p[i * 2 - 1], x1 = p[i * 2], y1 = p[i * 2 + 1]
      const len = Math.hypot(x1 - x0, y1 - y0)
      let t = carry
      while (t <= len) {
        star(x0 + ((x1 - x0) * t) / len, y0 + ((y1 - y0) * t) / len)
        t += STEP
      }
      carry = t - len
    }
  }
  ctx.restore()
}

/** Draw one stroke (and its mirror image, when the env has a mirror axis). */
export function drawStroke(env: BrushEnv, s: Stroke): void {
  drawOnce(env, s, null)
  if (env.mirrorX !== undefined) {
    if (s.tool === 'stamp') drawOnce(env, s, [2 * env.mirrorX - s.x])
    else drawOnce(env, s, mirrored(s.points, env.mirrorX))
  }
}

/**
 * The crayon grain tile for one colour: the colour with a seeded scatter of lighter pinholes and a few
 * waxy streaks, so a stroke reads as wax on paper rather than a flat marker line. BROWSER ONLY — the
 * caller caches one per colour (`DrawingSurface`).
 */
export function makeCrayonTile(color: CrayonColor, px = 64): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')!
  g.fillStyle = CRAYON_HEX[color]
  g.fillRect(0, 0, px, px)
  const r = rng(0x5eed)
  // White crayon on white paper: the grain must darken a little instead, or the stroke is invisible.
  const hole = color === 'hvid' ? 'rgba(170,160,150,0.55)' : 'rgba(0,0,0,1)'
  g.globalCompositeOperation = color === 'hvid' ? 'source-over' : 'destination-out'
  for (let i = 0; i < px * 5; i++) {
    g.globalAlpha = 0.12 + r() * 0.5
    g.fillStyle = hole
    g.fillRect(Math.floor(r() * px), Math.floor(r() * px), 1 + Math.floor(r() * 2), 1)
  }
  g.globalAlpha = 0.18
  for (let i = 0; i < 6; i++) {
    const y = r() * px
    g.fillRect(0, y, px, 1)
  }
  return c
}
