// "The picture comes alive" (Krea PRD-01 §4.5) — the reward for finishing a guided or colour-in piece.
// A ONE-SHOT of a few cycles, then rest: never continuous, never a framer `repeat: Infinity`. Run with
// WAAPI on the PICTURE layer (the ink canvas, or the fill canvas + line art), never by redrawing a
// canvas per frame; transform/opacity only, full transform strings, cubic-bezier, no springs, and the
// last keyframe is an explicit identity transform, never `'none'` (memory: GPU animations; Safari 17
// runs WAAPI transform/opacity on the compositor).
//
// Fri Tegning has no finish (owner, 2026-10-16), so it only uses `swapPaper`. The presets are named by
// each subject and page in config (`kreaSubjects.ts`, `kreaPages.ts`).

import type { AlivePreset } from '../../../config/kreaSubjects'

export type { AlivePreset }

const EASE = 'cubic-bezier(0.37, 0, 0.63, 1)'
const REST = 'translate(0%, 0%) rotate(0deg) scale(1, 1)'
const T = (x: number, y: number, rot = 0, sx = 1, sy = 1) => `translate(${x}%, ${y}%) rotate(${rot}deg) scale(${sx}, ${sy})`

const KEYFRAMES: Record<Exclude<AlivePreset, 'flap' | 'glow'>, Keyframe[]> = {
  // Three hops with a squash on each landing.
  hop: [
    { transform: REST },
    { transform: T(0, 1.5, 0, 1.06, 0.92), offset: 0.08 },
    { transform: T(0, -12, 0, 0.97, 1.04), offset: 0.2 },
    { transform: T(0, 1.5, 0, 1.06, 0.92), offset: 0.33 },
    { transform: T(0, -10, 0, 0.97, 1.04), offset: 0.46 },
    { transform: T(0, 1.5, 0, 1.05, 0.94), offset: 0.6 },
    { transform: T(0, -7, 0, 0.98, 1.03), offset: 0.73 },
    { transform: T(0, 1, 0, 1.03, 0.96), offset: 0.86 },
    { transform: REST },
  ],
  // Glide right with a wobble, then glide home.
  swim: [
    { transform: REST },
    { transform: T(4, -1.5, 3), offset: 0.15 },
    { transform: T(8, 1.5, -3), offset: 0.3 },
    { transform: T(12, -1.5, 3), offset: 0.45 },
    { transform: T(8, 1.5, -3), offset: 0.62 },
    { transform: T(4, -1.5, 2), offset: 0.8 },
    { transform: REST },
  ],
  // Up and away, a little wiggle at the top, back down to rest.
  'fly-up': [
    { transform: REST },
    { transform: T(0, 2, 0, 1.02, 0.97), offset: 0.1 },
    { transform: T(-1, -18, -3), offset: 0.38 },
    { transform: T(1, -22, 3), offset: 0.52 },
    { transform: T(-1, -18, -2), offset: 0.64 },
    { transform: T(0, 1.5, 0, 1.02, 0.97), offset: 0.9 },
    { transform: REST },
  ],
  // A happy little dance: tilt-and-lift left, right, left, settle.
  sway: [
    { transform: REST },
    { transform: T(0, -1.5, -3, 1.02, 1.02) },
    { transform: T(0, 0, 2.5, 1.02, 1.02) },
    { transform: T(0, -1.2, -2, 1.02, 1.02) },
    { transform: T(0, 0, 1.5, 1.01, 1.01) },
    { transform: T(0, -0.6, -0.8, 1.01, 1.01) },
    { transform: REST },
  ],
  // Rev, roll forward with a bounce, roll back.
  drive: [
    { transform: REST },
    { transform: T(-1, 0, 0) , offset: 0.08 },
    { transform: T(0, -0.8, 0), offset: 0.14 },
    { transform: T(6, 0, 0), offset: 0.3 },
    { transform: T(12, -0.8, 0), offset: 0.46 },
    { transform: T(12, 0, 0), offset: 0.55 },
    { transform: T(6, -0.8, 0), offset: 0.72 },
    { transform: REST },
  ],
}

export const ALIVE_MS: Record<AlivePreset, number> = {
  hop: 2200,
  swim: 2600,
  'fly-up': 2400,
  flap: 2200,
  sway: 2400,
  drive: 2400,
  glow: 2000,
}

/**
 * A fresh sheet, SHOWN: the old paper slides off to the left, the drawing is cleared under cover, and a
 * clean sheet slides in from the right — so "Nyt papir" and "next" visibly do what they say. Reduced
 * motion: a quick fade instead. Transform/opacity only, explicit identity end state.
 */
export async function swapPaper(el: HTMLElement | null, reduce: boolean, clear: () => void): Promise<void> {
  if (!el || typeof el.animate !== 'function') {
    clear()
    return
  }
  const rest = 'translateX(0vw) translateY(0px) rotate(0deg) scale(1)'
  const out: Keyframe[] = reduce
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ transform: rest, opacity: 1 }, { transform: 'translateX(-60vw) translateY(0px) rotate(-8deg) scale(1)', opacity: 0 }]
  const into: Keyframe[] = reduce
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ transform: 'translateX(60vw) translateY(0px) rotate(6deg) scale(1)', opacity: 0 }, { transform: rest, opacity: 1 }]
  await el.animate(out, { duration: reduce ? 120 : 260, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished.catch(() => undefined)
  clear()
  await el.animate(into, { duration: reduce ? 160 : 320, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', fill: 'none' }).finished.catch(() => undefined)
  for (const a of el.getAnimations()) a.cancel()
}

const done = (a: Animation): Promise<void> => a.finished.then(() => undefined, () => undefined)

/**
 * A warm light that swells over the picture and fades — the reduced-motion preset, and the "the sun
 * shines" one. Opacity only, on a temporary overlay in the paper.
 */
function glow(el: HTMLElement): Promise<void> {
  const host = el.parentElement ?? el
  const o = document.createElement('div')
  o.setAttribute('aria-hidden', 'true')
  o.dataset.kreaAliveGlow = ''
  Object.assign(o.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    background: 'radial-gradient(circle at 50% 45%, rgba(255,236,150,0.75) 0%, rgba(255,214,90,0.35) 45%, rgba(255,214,90,0) 75%)',
    mixBlendMode: 'screen',
    opacity: '0',
  })
  host.appendChild(o)
  const a = o.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }, { opacity: 0 }], { duration: ALIVE_MS.glow, easing: EASE })
  return done(a).then(() => o.remove())
}

/**
 * Wings: the picture is copied into a left and a right half that fold in toward the centre line and
 * back, twice — so a butterfly (or an owl) flaps. The layers inside `el` all fill it (canvases and the
 * line art at inset 0), so drawing each into one bitmap in DOM order reproduces the picture.
 */
async function flap(el: HTMLElement): Promise<void> {
  const host = el.parentElement
  const r = el.getBoundingClientRect()
  if (!host || !r.width || !r.height) return glow(el)
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.round(r.width * dpr)
  const h = Math.round(r.height * dpr)
  const flat = document.createElement('canvas')
  flat.width = w
  flat.height = h
  const g = flat.getContext('2d')
  if (!g) return glow(el)
  for (const layer of Array.from(el.querySelectorAll('canvas, img')) as Array<HTMLCanvasElement | HTMLImageElement>) {
    if (layer instanceof HTMLImageElement && !(layer.complete && layer.naturalWidth)) continue
    if (layer instanceof HTMLCanvasElement && !layer.width) continue
    g.drawImage(layer, 0, 0, w, h)
  }
  const halves = [0, 1].map((side) => {
    const c = document.createElement('canvas')
    c.width = Math.ceil(w / 2)
    c.height = h
    c.getContext('2d')!.drawImage(flat, side ? -Math.floor(w / 2) : 0, 0)
    Object.assign(c.style, {
      position: 'absolute',
      top: '0',
      left: side ? '50%' : '0',
      width: '50%',
      height: '100%',
      pointerEvents: 'none',
      transformOrigin: side ? '0% 50%' : '100% 50%',
    })
    host.appendChild(c)
    return c
  })
  flat.width = 0
  flat.height = 0
  const prev = el.style.visibility
  el.style.visibility = 'hidden'
  const fold = [
    { transform: 'scale(1, 1)' },
    { transform: 'scale(0.45, 1)', offset: 0.22 },
    { transform: 'scale(1, 1)', offset: 0.42 },
    { transform: 'scale(0.5, 1)', offset: 0.64 },
    { transform: 'scale(1, 1)', offset: 0.84 },
    { transform: 'scale(1, 1)' },
  ]
  await Promise.all(halves.map((c) => done(c.animate(fold, { duration: ALIVE_MS.flap, easing: EASE }))))
  el.style.visibility = prev
  for (const c of halves) {
    c.width = 0
    c.height = 0
    c.remove()
  }
}

/**
 * Play a preset once on the picture layer. Resolves when it has finished (or at once if WAAPI is
 * missing). Reduced motion: the soft glow only, whatever the preset.
 */
export function playAlive(el: HTMLElement | null, preset: AlivePreset, reduce = false): Promise<void> {
  if (!el || typeof el.animate !== 'function') return Promise.resolve()
  if (reduce || preset === 'glow') return glow(el)
  if (preset === 'flap') return flap(el)
  return done(el.animate(KEYFRAMES[preset], { duration: ALIVE_MS[preset], easing: EASE, fill: 'none' }))
}
