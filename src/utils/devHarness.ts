// Dev-only screenshot harness (UI/UX Overhaul PRD §8.0.3).
//
// A set of guarded query params so feedback/hint/reward/mascot states can be captured
// deterministically without solving a quiz. EVERYTHING here is behind `import.meta.env.DEV`, so
// none of it ships behavior to production.
//
//   ?fx=correct|wrong|hint|streak   force one tile/board/mix into that state
//   ?theme=<id>                      set the theme without click-chaining the selector
//   ?seed=<n>                        deterministic questions (seeds Math.random)
//   ?nogate=1                        skip the audio welcome/permission gate
//   ?reduce=1                        force reduced-motion (test the parity path headlessly)

export const DEV = import.meta.env.DEV

const readParams = (): URLSearchParams =>
  new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')

export type FxState = 'correct' | 'wrong' | 'hint' | 'streak'

/** Forced feedback state for screenshots, or null when not in DEV / not requested. */
export const devFx = (): FxState | null => {
  if (!DEV) return null
  const v = readParams().get('fx')
  return v === 'correct' || v === 'wrong' || v === 'hint' || v === 'streak' ? v : null
}

/** Theme id forced via `?theme=`, or null. */
export const devThemeId = (): string | null => (DEV ? readParams().get('theme') : null)

/** Whether to skip the audio welcome/permission gate. */
export const devNoGate = (): boolean => DEV && readParams().has('nogate')

/** Whether to force the reduced-motion path (so its parity can be captured headlessly). */
export const devReduceMotion = (): boolean => DEV && readParams().get('reduce') === '1'

/** Whether to force a sample "new sticker" (nyt! badge) in the album for screenshots. */
export const devNyt = (): boolean => DEV && readParams().get('nyt') === '1'

/** Whether to force music on (default is off) so the music system can be verified headlessly. */
export const devMusicOn = (): boolean => DEV && readParams().get('music') === '1'

// Seedable RNG (mulberry32). When `?seed=<n>` is present in DEV, replace Math.random so every
// generator that relies on it yields a deterministic sequence — no per-game plumbing required.
export const installDevSeed = (): void => {
  if (!DEV) return
  const raw = readParams().get('seed')
  if (raw == null) return
  let a = (Number(raw) || 1) >>> 0
  Math.random = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
