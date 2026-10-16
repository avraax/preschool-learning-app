// Perleplade's two one-shot motions (Krea PRD-02 §2.4, §2.6, §4.3) — WAAPI, transform/opacity only,
// full transform strings, cubic-bezier, an explicit identity last frame (memory: GPU animations).
//
//   - `popOff`: a finished pattern lifts off its pegs and wobbles, then settles — "comes alive" for beads.
//     It animates the BEADS LAYER as one element, never 100 beads one by one (§4.3).
//   - `flyHome`: a bead the board didn't take rolls back to its bowl. It is the whole of the wrong-colour
//     answer: no buzzer, no red, no "forkert" (§5) — the bead just goes home.

import { playAlive } from '../studio/alive'
import { beadBackground } from './Bead'
import type { BeadColor } from './beadBoard'

const EASE = 'cubic-bezier(0.37, 0, 0.63, 1)'
const REST = 'translate(0%, 0%) rotate(0deg) scale(1)'
const done = (a: Animation) => a.finished.then(() => undefined, () => undefined)

export const POP_OFF_MS = 1700

export function popOff(el: HTMLElement | null, reduce: boolean): Promise<void> {
  if (!el?.animate) return Promise.resolve()
  // Reduced motion: the shared warm glow, no movement.
  if (reduce) return playAlive(el, 'hop', true)
  const T = (y: number, r: number, s: number) => `translate(0%, ${y}%) rotate(${r}deg) scale(${s})`
  return done(
    el.animate(
      [
        { transform: REST },
        { transform: T(-5, 0, 1.05), offset: 0.14 },
        { transform: T(-6, -4, 1.05), offset: 0.28 },
        { transform: T(-6, 4, 1.05), offset: 0.42 },
        { transform: T(-6, -3, 1.05), offset: 0.56 },
        { transform: T(-5, 2, 1.04), offset: 0.7 },
        { transform: T(0.6, 0, 0.99), offset: 0.88 },
        { transform: REST },
      ],
      { duration: POP_OFF_MS, easing: EASE },
    ),
  )
}

/** A bead rolling from a point (client px) back into its bowl; a no-op under reduced motion. */
export function flyHome(colour: BeadColor, from: { x: number; y: number }, sizePx: number, reduce: boolean): void {
  if (reduce || typeof document === 'undefined') return
  const bowl = document.querySelector<HTMLElement>(`[data-krea-bowl="${colour}"]`)
  if (!bowl) return
  const r = bowl.getBoundingClientRect()
  const to = { x: r.left + r.width / 2, y: r.top + r.height * 0.3 }
  const b = document.createElement('div')
  b.setAttribute('aria-hidden', 'true')
  b.dataset.kreaFlyHome = colour
  Object.assign(b.style, {
    position: 'fixed',
    left: `${from.x - sizePx / 2}px`,
    top: `${from.y - sizePx / 2}px`,
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    borderRadius: '50%',
    background: beadBackground(colour),
    boxShadow: '0 4px 6px rgba(60,40,20,0.35)',
    pointerEvents: 'none',
    zIndex: '31',
  })
  document.body.appendChild(b)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const a = b.animate(
    [
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(0.85)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.6 },
    ],
    { duration: 380, easing: 'cubic-bezier(0.3,0.7,0.4,1)' },
  )
  void done(a).then(() => b.remove())
}
