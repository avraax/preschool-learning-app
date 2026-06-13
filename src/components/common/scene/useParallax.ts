import { useEffect } from 'react'

// Gentle parallax driver (Theme Worlds PRD §5.3).
//
// Writes CSS variables `--parallax-x` / `--parallax-y` (in px) onto the given element every
// frame; ParallaxLayer reads them and multiplies by its own `depth`. Driving the effect
// through CSS vars means NO React re-renders during animation. The offset blends a slow
// autonomous drift (sine over time) with a clamped, smoothed pointer/touch response — no
// gyroscope, no motion permission. When `disabled` (reduced motion), vars are pinned to 0.

interface ParallaxOptions {
  disabled?: boolean
  strength?: number // max offset in px the nearest layer (depth 1) would travel
}

export function useParallax(
  ref: React.RefObject<HTMLElement | null>,
  { disabled = false, strength = 40 }: ParallaxOptions = {}
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (disabled) {
      el.style.setProperty('--parallax-x', '0px')
      el.style.setProperty('--parallax-y', '0px')
      return
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
      const driftX = Math.sin(t * 0.0004) * 0.6
      const driftY = Math.cos(t * 0.00032) * 0.42
      const targetX = driftX + ptrX * 0.5
      const targetY = driftY + ptrY * 0.4
      // Critically-damped-ish smoothing.
      curX += (targetX - curX) * 0.04
      curY += (targetY - curY) * 0.04
      el.style.setProperty('--parallax-x', `${(curX * strength).toFixed(2)}px`)
      el.style.setProperty('--parallax-y', `${(curY * strength).toFixed(2)}px`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [ref, disabled, strength])
}

export default useParallax
