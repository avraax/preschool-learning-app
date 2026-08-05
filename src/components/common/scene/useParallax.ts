import { useEffect } from 'react'
import {
  PARALLAX_DRIFT_X,
  PARALLAX_DRIFT_Y,
  PARALLAX_POINTER_X,
  PARALLAX_POINTER_Y,
  PARALLAX_STRENGTH,
} from '../../../config/parallax'
import { writeParallaxFrame } from './parallaxTargets'

// Gentle parallax driver (Theme Worlds PRD §5.3).
//
// Every frame it computes ONE offset — a slow autonomous drift (sine over time) blended with a
// clamped, smoothed pointer/touch response, no gyroscope and no motion permission — and writes the
// resulting `transform` DIRECTLY onto each registered scene layer (`parallaxTargets.ts`). Still no
// React re-renders during the animation. When `disabled` (reduced motion, or a game route where the
// world is frozen) it writes the resting transform once and stops.
//
// It used to write `--parallax-x/y` as CSS custom properties on the root instead, and the layers read
// them through `calc()`. That cost ~24 percentage points of main-thread busy on home at 6x throttle
// once W1 stopped masking it — a var-driven transform is not hardware accelerated, and the write
// invalidated style for every animating sprite in the subtree. The full measurement and the
// superseded PRD finding are recorded in `parallaxTargets.ts`.
//
// `ref` is no longer the write target (the layers register themselves), but it is still the driver's
// SCOPE and the pointer listener's owner, and keeping it means PersistentWorld's freeze logic is
// unchanged.

interface ParallaxOptions {
  disabled?: boolean
}

// The amplitudes live in `src/config/parallax.ts` (pure) because the overscan `ParallaxLayer`
// reserves and the promotion threshold are both DERIVED from them — a change here that isn't visible
// to those is how a layer starts sliding off its own edge.
export function useParallax(
  ref: React.RefObject<HTMLElement | null>,
  { disabled = false }: ParallaxOptions = {}
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (disabled) {
      // Rest at zero. Written on a short retry as well as immediately, because the layers mount
      // asynchronously (lazy art) and a frozen scene has no loop to catch up later — without this a
      // game route entered from a drifted menu would leave the layers wherever they stopped.
      writeParallaxFrame(0, 0)
      const settle = setTimeout(() => writeParallaxFrame(0, 0), 600)
      return () => clearTimeout(settle)
    }

    let raf = 0
    let start = 0
    let curX = 0
    let curY = 0
    let ptrX = 0 // pointer target, normalized -1..1
    let ptrY = 0

    const onPointer = (e: PointerEvent) => {
      ptrX = (e.clientX / window.innerWidth) * 2 - 1
      ptrY = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    const tick = (ts: number) => {
      if (!start) start = ts
      const t = ts - start
      // Moderate autonomous drift (~16s cycles) — a gentle, perceptible glide that sits
      // between "barely breathing" and the earlier sloshy wave. Touch/pointer adds on top.
      const driftX = Math.sin(t * 0.0004) * PARALLAX_DRIFT_X
      const driftY = Math.cos(t * 0.00032) * PARALLAX_DRIFT_Y
      const targetX = driftX + ptrX * PARALLAX_POINTER_X
      const targetY = driftY + ptrY * PARALLAX_POINTER_Y
      // Critically-damped-ish smoothing.
      curX += (targetX - curX) * 0.04
      curY += (targetY - curY) * 0.04
      writeParallaxFrame(curX * PARALLAX_STRENGTH, curY * PARALLAX_STRENGTH)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [ref, disabled])
}

export default useParallax
