// The app's IDLE motion vocabulary, as CSS keyframe animations (Performance PRD-01 W1).
//
// WHY THIS EXISTS. Measured 2026-08-05 with `.claude/skills/ui-screenshot/perf.mjs` on the harness
// build at 6x CPU throttle: home sat at 92% main-thread busy and ~40% of every second was spent
// recalculating style while NOTHING was happening. Under `prefers-reduced-motion` the same screen
// dropped to 7.7% busy with ZERO recalculations. The cost was 25 infinite Framer Motion loops: each
// one ticks framer's frameloop every rAF, writes an inline style on its element, and the browser
// recalculates style once per frame — 60 recalcs a second for an app sitting still. Killing all 19 of
// the app's CSS keyframe animations, by contrast, changed nothing measurable: they are
// compositor-driven, declared once and then animated off the main thread.
//
// So: **a continuous, stateless animation is a CSS keyframe animation, never a JS loop.** Framer keeps
// what it is good at — one-shot event feedback (pop, shake, charge-in), gestures, `AnimatePresence`,
// layout animations. This module is the CSS side of that split, and the values below are COPIED from
// the framer loops they replace (same amplitude, same duration, same easing), never re-derived:
// framer's built-in `easeInOut` is `cubic-bezier(0.42, 0, 0.58, 1)`, which is exactly CSS
// `ease-in-out`, and framer distributes a keyframe array evenly over the duration the same way a
// percentage keyframe list does.
//
// THE NESTED-LAYER RULE. A CSS `animation` and a framer transform on the SAME element both write
// `transform` and the last writer wins, silently. `useLivingCard` already solves this by composing the
// CSS breathe and the framer tap-squash on separate nested elements; every consumer here does the
// same — the idle layer is its own `<Box>`, the framer feedback layer is its child.
//
// THE BUNDLE SHAPE. Each helper returns `{ props, sx }` so a call site never branches on which
// mechanism is in play:
//
//   const idle = idleFloat(reduce)
//   <Box {...idle.props} sx={[{ /* layout */ }, idle.sx]}>…</Box>
//
// `props` is empty on the CSS path (a plain `<Box>`) and carries `component={motion.div}` + framer's
// `animate`/`transition` on the legacy path. That is the ONE branch point for the "Flydende grafik"
// adult toggle (W6) — it lives in this module and nowhere else, so no call site grows an inline `if`.
//
// REDUCED MOTION STILL WINS. Every helper takes the `reduce` flag first and returns nothing at all
// when it is set, exactly as the framer loops did.

import { motion } from 'framer-motion'
import type { Theme } from '@mui/material/styles'
import type { SystemStyleObject } from '@mui/system'
import { perfProfile } from '../config/perfProfile'

export interface IdleMotionBundle {
  /** Spread onto the idle layer. Empty on the CSS path. */
  props: Record<string, unknown>
  /**
   * Merge into the idle layer's `sx` **as one entry of the array form** — `sx={[base, idle.sx]}`.
   * Deliberately a plain `SystemStyleObject`, not an `SxProps`: an `SxProps` may itself be an array
   * or a function, and nesting one inside an `sx` array does not type-check (and can silently drop
   * styles — see `.claude/rules/responsive-design.md`).
   */
  sx: SystemStyleObject<Theme>
  /** Which element the idle layer is. Consumed only by the legacy path (see `IdleAs`). */
  as: IdleAs
}

/**
 * The element the idle layer renders as. It matters only on the legacy framer path (W6), which has to
 * pick `motion.img` / `motion.span` rather than `motion.div` — spreading a `component: motion.div`
 * onto a site that renders an `<img>` would silently replace the image with an empty div. Declaring it
 * here keeps that decision inside this module instead of at 20 call sites.
 */
export type IdleAs = 'div' | 'span' | 'img' | 'button'

/** No idle motion at all (reduced motion). */
export const IDLE_NONE: IdleMotionBundle = { props: {}, sx: {}, as: 'div' }

// `@keyframes` names are GLOBAL, so any helper whose keyframes depend on a parameter must encode that
// parameter in the name — otherwise two callers with different amplitudes silently share one
// animation. (Duration/delay are properties, not keyframes, so they need no suffix; that is why
// `useLivingCard` can phase 8 cards off one `livingCardBreathe`.)
const tag = (n: number): string => String(n).replace('-', 'n').replace('.', '_')

// THE ONE BRANCH POINT for "Flydende grafik" (W6). Every helper below goes through here, so no call
// site knows or cares which mechanism is running — and there is no second `if` anywhere in the tree.
//
// The legacy branch reconstructs the exact framer loop each helper replaced. `framer` is passed as the
// keyframes + duration/delay the ORIGINAL loop used, so the two forms can never drift: they are written
// side by side, from the same numbers, in one place.
const bundle = (
  name: string,
  keyframes: Record<string, unknown>,
  animation: string,
  framer: { animate: Record<string, unknown>; durationS: number; delayS?: number },
  as: IdleAs = 'div',
): IdleMotionBundle => {
  if (!perfProfile().useCssIdleMotion) {
    return {
      props: {
        component: motion[as],
        animate: framer.animate,
        transition: {
          duration: framer.durationS,
          delay: framer.delayS ?? 0,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
      },
      sx: {},
      as,
    }
  }
  return {
    props: {},
    sx: { [`@keyframes ${name}`]: keyframes, animation } as SystemStyleObject<Theme>,
    as,
  }
}

// --- float ------------------------------------------------------------------------------------
/**
 * Gentle vertical float — the framer `{ y: [0, -distance, 0] }` idle loop.
 * `distance` is px and POSITIVE MEANS UP, matching the framer sign convention it replaces.
 *
 * Callers and the loops they came from: `PromptFocus` (4px / 3.2s — every game board paid this
 * TWICE, on two nested `motion.div`s), `GameSelectionLayout`'s section landmark (10px / 5.5s),
 * `FarveQuizGame`'s prompt object (6px / 1.6s), `RamFarvenGame`'s "drop here" arrow (−4px / 1.4s).
 */
export const idleFloat = (
  reduce: boolean,
  {
    distance = 4,
    durationS = 3.2,
    delayS = 0,
    as = 'div',
  }: { distance?: number; durationS?: number; delayS?: number; as?: IdleAs } = {},
): IdleMotionBundle => {
  if (reduce) return IDLE_NONE
  const name = `blIdleFloat_${tag(distance)}`
  return bundle(
    name,
    { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: `translateY(${-distance}px)` } },
    `${name} ${durationS}s ease-in-out ${delayS}s infinite`,
    { animate: { y: [0, -distance, 0] }, durationS, delayS },
    as,
  )
}

// --- pulse ------------------------------------------------------------------------------------
/**
 * Scale pulse — the framer `{ scale: [1, peak, 1] }` idle loop. The app's single most-repeated one:
 * `TactileTile`'s never-fail hint runs it PER TILE (a 6-answer board ran six framer loops), and the
 * colour games use it for slot hints and drag-over affordances.
 */
export const idlePulse = (
  reduce: boolean,
  {
    peak = 1.05,
    durationS = 1.1,
    delayS = 0,
    as = 'div',
  }: { peak?: number; durationS?: number; delayS?: number; as?: IdleAs } = {},
): IdleMotionBundle => {
  if (reduce) return IDLE_NONE
  const name = `blIdlePulse_${tag(peak)}`
  return bundle(
    name,
    { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: `scale(${peak})` } },
    `${name} ${durationS}s ease-in-out ${delayS}s infinite`,
    { animate: { scale: [1, peak, 1] }, durationS, delayS },
    as,
  )
}

/**
 * `TactileTile`'s never-fail hint pulse, at the exact amplitude/duration it has always used
 * (1.05 / 1.1s). Named so the tile doesn't restate the numbers.
 */
export const hintPulse = (reduce: boolean): IdleMotionBundle => idlePulse(reduce, { peak: 1.05, durationS: 1.1 })

// --- opacity glow -----------------------------------------------------------------------------
/**
 * Opacity breathe — the framer `{ opacity: [from, to, from] }` loop. `FarvejagtGame`'s collection-well
 * halo (0.35 → 0.6, 2.6s). Opacity-only, so this one was already compositor-friendly *except* for the
 * per-frame main-thread write that produced it.
 */
export const idleGlow = (
  reduce: boolean,
  { from, to, durationS }: { from: number; to: number; durationS: number },
): IdleMotionBundle => {
  if (reduce) return IDLE_NONE
  const name = `blIdleGlow_${tag(from)}_${tag(to)}`
  return bundle(
    name,
    { '0%, 100%': { opacity: from }, '50%': { opacity: to } },
    `${name} ${durationS}s ease-in-out infinite`,
    { animate: { opacity: [from, to, from] }, durationS },
  )
}

// --- equalizer --------------------------------------------------------------------------------
/**
 * `ListenHero`'s equalizer bar — framer's `{ scaleY: [0.4, 1, 0.5, 0.9, 0.4] }`, 0.9s, staggered
 * `delay: i * 0.1`. Only runs while audio is actually playing (the hero's own rule: the speaker
 * pulses when idle, the bars dance when speaking, never both).
 */
export const equalizerBar = (reduce: boolean, index: number): IdleMotionBundle => {
  if (reduce) return IDLE_NONE
  const name = 'blEqualizerBar'
  return bundle(
    name,
    {
      '0%, 100%': { transform: 'scaleY(0.4)' },
      '25%': { transform: 'scaleY(1)' },
      '50%': { transform: 'scaleY(0.5)' },
      '75%': { transform: 'scaleY(0.9)' },
    },
    `${name} 0.9s ease-in-out ${index * 0.1}s infinite`,
    { animate: { scaleY: [0.4, 1, 0.5, 0.9, 0.4] }, durationS: 0.9, delayS: index * 0.1 },
  )
}

// --- wobble -----------------------------------------------------------------------------------
/**
 * The audio-permission modal's icon wobble — framer's `{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }`
 * at 2s. ONLY the animation moves here: the modal's dismiss path is a tap-through rule
 * (`.claude/rules/audio-system.md`) and must not be touched.
 */
export const idleWobble = (reduce: boolean): IdleMotionBundle => {
  if (reduce) return IDLE_NONE
  const name = 'blIdleWobble'
  return bundle(
    name,
    {
      '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
      '33%': { transform: 'scale(1.1) rotate(-5deg)' },
      '66%': { transform: 'scale(1.05) rotate(5deg)' },
    },
    `${name} 2s ease-in-out infinite`,
    { animate: { scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }, durationS: 2 },
  )
}

// --- transition-wipe motifs (W5) ---------------------------------------------------------------
// The wipe's own decoration used to run three infinite framer loops DURING the wipe — i.e. during the
// single most timing-sensitive moment in the app, while a route is mounting and lazy chunks are
// resolving. Same conversion, same values. The wipe's other discipline is unchanged and
// non-negotiable (`.claude/rules/scene-and-world.md`): opaque paint, transform/clip-path only, no
// `backdrop-filter`, `will-change` cleared at idle, `absolute` not `fixed`.

/** Rummet's rocket motif: `{ y: [0, -10, 0], rotate: [0, -4, 4, 0] }`, 1.2s. */
export const wipeRocket = (reduce: boolean): IdleMotionBundle => {
  if (reduce) return IDLE_NONE
  const name = 'blWipeRocket'
  return bundle(
    name,
    {
      '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
      '33%': { transform: 'translateY(-10px) rotate(-4deg)' },
      '66%': { transform: 'translateY(-5px) rotate(4deg)' },
    },
    `${name} 1.2s ease-in-out infinite`,
    { animate: { y: [0, -10, 0], rotate: [0, -4, 4, 0] }, durationS: 1.2 },
  )
}

/** Dinosaurer's leaf motif: `{ rotate: [0, 18, -12, 0], y: [0, 8, 0] }`, `1.1 + i * 0.15`s. */
export const wipeLeaf = (reduce: boolean, index: number): IdleMotionBundle => {
  if (reduce) return IDLE_NONE
  const name = 'blWipeLeaf'
  return bundle(
    name,
    {
      '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
      '33%': { transform: 'translateY(8px) rotate(18deg)' },
      '66%': { transform: 'translateY(4px) rotate(-12deg)' },
    },
    `${name} ${1.1 + index * 0.15}s ease-in-out infinite`,
    { animate: { rotate: [0, 18, -12, 0], y: [0, 8, 0] }, durationS: 1.1 + index * 0.15 },
    'img',
  )
}

/** Regnbue's mote motif: `{ scale: [0.6, 1, 0.6], opacity: [0.5, 1, 0.5] }`, per-mote duration. */
export const wipeSparkle = (reduce: boolean, durationS: number): IdleMotionBundle => {
  if (reduce) return IDLE_NONE
  const name = 'blWipeSparkle'
  return bundle(
    name,
    {
      '0%, 100%': { transform: 'scale(0.6)', opacity: 0.5 },
      '50%': { transform: 'scale(1)', opacity: 1 },
    },
    `${name} ${durationS}s ease-in-out infinite`,
    { animate: { scale: [0.6, 1, 0.6], opacity: [0.5, 1, 0.5] }, durationS },
    'img',
  )
}

export default {
  idleFloat,
  idlePulse,
  hintPulse,
  idleGlow,
  equalizerBar,
  idleWobble,
  wipeRocket,
  wipeLeaf,
  wipeSparkle,
}
