import { useEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion'

// Gentle idle / attract loop (Liveliness PRD-02 §6). After ~8s of no interaction on a menu, invite
// a hesitant child to tap: the caller's `onAttract` nudges the mascot + wiggles one card. The timer
// resets on ANY interaction (pointer / key / throttled move), pauses when the tab is hidden, and
// re-arms with a slightly longer, jittered gap while still idle. Disabled entirely under reduced
// motion. The caller owns WHAT happens on attract (mascot pose, which card) — this owns the timing.

interface UseIdleAttractArgs {
  enabled?: boolean
  idleMs?: number
  onAttract: () => void
}

export function useIdleAttract({ enabled = true, idleMs = 8000, onAttract }: UseIdleAttractArgs): void {
  const reduce = useReducedMotion()
  const active = enabled && !reduce

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cycles = useRef(0)
  const lastMove = useRef(0)
  // Keep the latest callback without re-arming the whole effect each render.
  const onAttractRef = useRef(onAttract)
  onAttractRef.current = onAttract

  useEffect(() => {
    if (!active) return

    const clear = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }

    const arm = () => {
      clear()
      // Each successive idle cycle waits a bit longer, with a little jitter, so it never nags.
      const gap = idleMs + cycles.current * 2500 + Math.floor(Math.random() * 1500)
      timer.current = setTimeout(() => {
        if (document.visibilityState === 'hidden') {
          arm()
          return
        }
        cycles.current += 1
        onAttractRef.current()
        arm() // keep gently attracting while still idle
      }, gap)
    }

    const reset = () => {
      cycles.current = 0
      arm()
    }

    const onMove = (e: Event) => {
      // Throttle pointermove so a resting finger doesn't thrash the timer.
      const now = (e.timeStamp as number) || performance.now()
      if (now - lastMove.current < 400) return
      lastMove.current = now
      reset()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clear()
      else reset()
    }

    window.addEventListener('pointerdown', reset, { passive: true })
    window.addEventListener('keydown', reset)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    arm()

    return () => {
      clear()
      window.removeEventListener('pointerdown', reset)
      window.removeEventListener('keydown', reset)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active, idleMs])
}

export default useIdleAttract
