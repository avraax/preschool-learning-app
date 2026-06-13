import { useEffect, useState } from 'react'

// Reusable `prefers-reduced-motion: reduce` hook (Theme Worlds PRD §7).
// Generalizes the inline check already used in CelebrationEffect so the scene/parallax/
// ambient/mascot layers can disable motion consistently and react if the OS setting flips.
//
// Returns `true` when the user has asked the OS to reduce motion. Callers should then skip
// parallax, drift, and ambient animation (render a static scene; reduce mascot idle to none).

const QUERY = '(prefers-reduced-motion: reduce)'

const readInitial = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.(QUERY)?.matches

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(readInitial)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(QUERY)
    const onChange = () => setReduced(mql.matches)
    // Keep in sync if the user toggles the OS setting mid-session.
    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
  }, [])

  return reduced
}

export default useReducedMotion
