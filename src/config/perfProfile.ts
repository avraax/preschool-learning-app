// "Flydende grafik" — the ONE branch point for the app's rendering performance profile
// (Performance PRD-01 W6). Pure: no React, no DOM, no imports from the component tree.
//
// WHY IT EXISTS, AND WHY IT IS PERMANENT. The child plays in a STANDALONE PWA from the home screen on
// an iPad Pro 2nd gen (A10X, 2017) running iPadOS 17.7.11 — its terminal OS. You cannot type a query
// parameter into a standalone PWA, there is no Mac and therefore no Safari Web Inspector for that
// device, and a deploy is the only other way to change how it renders. So without a persisted switch
// there is no way to A/B old-vs-new ON the device that has the problem, and no way to back out of a
// regression without shipping. The owner asked for this twice (2026-08-05) and it is PERMANENT: an
// earlier draft had it sunsetting once the iPad confirmed the fast path, and that was rejected in
// favour of a standing escape hatch. **Do not re-litigate it, and do not quietly delete the legacy
// path in a later tidy-up.**
//
// THE DEFAULT IS THE FAST PATH. The toggle exists to fall BACK, never to opt in. `perfProfileGuard`
// pins that, because a flipped default is a way to ship the slow app to everyone.
//
// WHAT IT MAY SWITCH, AND WHAT IT MAY NOT. The legacy branch is a switch on the animation MECHANISM —
// how a thing animates, or whether an element is promoted to a compositing layer. It may NEVER change
// a size, a position, a count or whether something exists. That bound is what keeps a PERMANENT second
// path affordable to verify: because the other path cannot move a box, the screenshot sweep (4 skins x
// reduced-motion x 4 viewports) is owed on the DEFAULT path alone. `perfProfile.test.ts` enforces it by
// reading source — no `perfProfile` read may appear inside a layout-affecting `sx` key.
//
// Reduced motion OVERRIDES BOTH paths and stays the single calmest branch, so this is one extra state
// rather than two: every `idleMotion` helper takes `reduce` first and returns nothing when it is set.
//
// It changes RENDERING ONLY. It must not touch XP, difficulty, narration or any game logic.

/** The rendering profile the app is currently drawing with. */
export interface PerfProfile {
  /**
   * Continuous idle motion is a CSS keyframe animation (fast) or a Framer `repeat: Infinity` loop
   * (legacy). Consumed ONLY by `src/theme/idleMotion.ts` — see its `IdleMotionBundle`.
   */
  useCssIdleMotion: boolean
  /**
   * Honour `shouldPromoteLayer()` and leave a barely-moving scene layer un-promoted (fast), or promote
   * and translate every layer as before (legacy). Compositing only: the overscan, and therefore the
   * layer's box and the framing, are identical either way.
   */
  promoteOnlyMovingLayers: boolean
  /**
   * Let the compositor keep the in-game blur result via `will-change: filter` (fast), or re-filter the
   * surface as before (legacy). Same blur, same radius, same picture.
   */
  cacheInGameBlur: boolean
}

/** The fast path. What everyone gets unless an adult turns "Flydende grafik" off. */
export const FAST_PROFILE: PerfProfile = {
  useCssIdleMotion: true,
  promoteOnlyMovingLayers: true,
  cacheInGameBlur: true,
}

/** The escape hatch: how the app drew before Performance PRD-01. */
export const LEGACY_PROFILE: PerfProfile = {
  useCssIdleMotion: false,
  promoteOnlyMovingLayers: false,
  cacheInGameBlur: false,
}

/**
 * The Danish label + hint as the adult reads them, in "Indstillinger" → Udseende. The switch is ON for
 * the fast path, so it reads as a feature the adult can turn OFF rather than a workaround to enable.
 */
export const SMOOTH_GRAPHICS_LABEL = 'Flydende grafik'
export const SMOOTH_GRAPHICS_HINT =
  'Tegner baggrunden og animationerne på den mest skånsomme måde. Slå den fra, hvis noget ser forkert ud.'

/** Resolve the profile from the persisted setting. `undefined` (never set) means the FAST path. */
export const perfProfileFor = (smoothGraphics: boolean | undefined): PerfProfile =>
  smoothGraphics === false ? LEGACY_PROFILE : FAST_PROFILE

// --- the live profile ---------------------------------------------------------------------------
//
// A module-level value rather than a hook, because `idleMotion`'s helpers are plain functions called
// from render bodies all over the tree and threading a context through 20 call sites is exactly the
// "second branch point" this module exists to prevent. `progressStore` publishes the setting here when
// it attaches a child and whenever the adult flips the switch; until then the fast path stands.
let active: PerfProfile = FAST_PROFILE

/** The profile the app is drawing with right now. */
export const perfProfile = (): PerfProfile => active

/**
 * Publish the persisted setting. Called by `progressStore` on attach and on change — NOT from a
 * component. Returns whether the profile actually changed, so the caller can force a re-render only
 * when it has to.
 */
export const setPerfProfileFromSetting = (smoothGraphics: boolean | undefined): boolean => {
  const next = perfProfileFor(smoothGraphics)
  if (next === active) return false
  active = next
  return true
}

/** Test-only reset, so one test's profile can never leak into the next. */
export const resetPerfProfile = (): void => {
  active = FAST_PROFILE
}
