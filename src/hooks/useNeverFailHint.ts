import { useCallback, useRef, useState } from 'react'

// Never-fail hint (PRD-05 / PRD-10 §P1). Every task game gives the child a scaffold once they've
// struggled: after `threshold` wrong attempts on the CURRENT question the correct thing pulses
// (reduced-motion → static glow), so they're never stuck. The two wrongs already broke first-try,
// so the hint costs a star with no extra bookkeeping.
//
// This hook owns ONLY the shared mechanism — the wrong counter + threshold trip + the "what to
// pulse" state. It deliberately does NOT decide:
//   • WHEN the counter resets — each game defines its own question boundary (per slot / per board /
//     per target / per question) and calls `reset()` there. This is intentional per-game behaviour,
//     not drift — do not "unify" the reset points.
//   • WHETHER to nudge the mascot — some games emit `mascotBus.emit('hint')` on activation, one
//     (Stav Ordet) does not. `registerWrong` returns whether it JUST activated so the caller decides.
//
// `T` is whatever identifies the thing to pulse: a tile id / colour name / boolean. `hint` holds it
// (or null when inactive); the component compares each rendered element against it.
export function useNeverFailHint<T = boolean>(threshold = 2) {
  const wrongRef = useRef(0)
  const [hint, setHint] = useState<T | null>(null)

  // Count one wrong attempt. Once the counter reaches `threshold`, `resolve()` computes WHAT to
  // pulse (lazily — some games have to search their current state, and may find nothing → return
  // null to leave the hint inactive). Defaults to a plain boolean hint. Returns true iff the hint
  // is (re-)activated by THIS call, so the caller can fire its mascot nudge to match.
  const registerWrong = useCallback((resolve: () => T | null = (() => true as unknown as T)): boolean => {
    wrongRef.current += 1
    if (wrongRef.current < threshold) return false
    const target = resolve()
    if (target == null) return false
    setHint(target)
    return true
  }, [threshold])

  // Fresh question boundary: clear the counter and hide the hint. Called at each game's own reset
  // point(s). Stable identity so callers can safely list it in effect/callback deps.
  const reset = useCallback(() => {
    wrongRef.current = 0
    setHint(null)
  }, [])

  return { hint, setHint, registerWrong, reset }
}
