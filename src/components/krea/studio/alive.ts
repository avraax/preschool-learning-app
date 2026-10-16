// "The picture comes alive" (Krea PRD-01 §4.5) — the reward for finishing. A ONE-SHOT of a few cycles,
// then rest: never continuous, never a framer `repeat: Infinity`. Run with WAAPI on the paper element
// itself, transform/opacity only, full transform strings, cubic-bezier, no springs, and the last
// keyframe is an explicit identity transform, never `'none'` (memory: GPU animations; Safari 17 runs
// WAAPI transform/opacity on the compositor).
//
// W3 ships `sway` (Fri Tegning). W4/W5 add the per-subject presets (hop, swim, fly-up, flap, drive,
// glow) to this same table.

export type AlivePreset = 'sway' | 'glow'

const EASE = 'cubic-bezier(0.37, 0, 0.63, 1)'
const REST = 'translateY(0px) rotate(0deg) scale(1)'

const KEYFRAMES: Record<AlivePreset, Keyframe[]> = {
  // A happy little dance: tilt-and-lift left, right, left, settle.
  sway: [
    { transform: REST },
    { transform: 'translateY(-10px) rotate(-3deg) scale(1.02)' },
    { transform: 'translateY(0px) rotate(2.5deg) scale(1.02)' },
    { transform: 'translateY(-8px) rotate(-2deg) scale(1.02)' },
    { transform: 'translateY(0px) rotate(1.5deg) scale(1.01)' },
    { transform: 'translateY(-4px) rotate(-0.8deg) scale(1.01)' },
    { transform: REST },
  ],
  // Reduced motion: no movement at all, just a soft brightening pulse of the glow layer's opacity.
  glow: [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }, { opacity: 0 }],
}

export const ALIVE_MS: Record<AlivePreset, number> = { sway: 2400, glow: 2000 }

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
  const out: Keyframe[] = reduce
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ transform: REST, opacity: 1 }, { transform: 'translateX(-60vw) translateY(0px) rotate(-8deg) scale(1)', opacity: 0 }]
  const into: Keyframe[] = reduce
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ transform: 'translateX(60vw) translateY(0px) rotate(6deg) scale(1)', opacity: 0 }, { transform: REST, opacity: 1 }]
  await el.animate(out, { duration: reduce ? 120 : 260, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished.catch(() => undefined)
  clear()
  await el.animate(into, { duration: reduce ? 160 : 320, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', fill: 'none' }).finished.catch(() => undefined)
  for (const a of el.getAnimations()) a.cancel()
}

/** Play a preset once. Resolves when it has finished (or immediately if WAAPI is missing). */
export function playAlive(el: HTMLElement | null, preset: AlivePreset): Promise<void> {
  if (!el || typeof el.animate !== 'function') return Promise.resolve()
  const anim = el.animate(KEYFRAMES[preset], { duration: ALIVE_MS[preset], easing: EASE, fill: 'none' })
  return anim.finished.then(
    () => undefined,
    () => undefined,
  )
}
