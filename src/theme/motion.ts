// Motion language (UI/UX Overhaul PRD §5.1) — the ONE timing/feel vocabulary for the app.
//
// Named Framer-Motion transition presets + canonical dwell timings, so every game shares the
// same springs and auto-advance rhythm instead of the old 1.5/2/2.5s drift. These are plain TS
// constants (NOT MUI theme values) so they can be imported anywhere (components, hooks, handlers)
// without a `useTheme()`.
//
// Reduced-motion parity: pass the OS `prefers-reduced-motion` result to `motionOr(preset, reduce)`
// (or use `INSTANT`) so an animation collapses to an instant state change while colour/SFX/mascot
// still communicate the result.

import type { Transition } from 'framer-motion'
import { isIOS } from '../utils/deviceDetection'

// --- Spring / tween presets ------------------------------------------------------------------
/** Bouncy answer-reveal / `?`→answer flip. Lively overshoot. */
export const POP: Transition = { type: 'spring', stiffness: 420, damping: 17 }
/** Crisp settle for drops snapping into place / pressed tiles. Fast, minimal overshoot. */
export const SNAP: Transition = { type: 'spring', stiffness: 600, damping: 26 }
/** Big, loose celebratory bounce (krokodille chomp, arms-up). */
export const BOUNCE: Transition = { type: 'spring', stiffness: 300, damping: 14 }
/** Anticipation charge-in for prompts/tiles arriving. Short easeOut tween. */
export const CHARGE: Transition = { duration: 0.25, ease: 'easeOut' }

/** Collapse any animation to an instant state change (reduced motion). */
export const INSTANT: Transition = { duration: 0 }

/** Return `preset` normally, or `INSTANT` under reduced motion. */
export const motionOr = (preset: Transition, reduce: boolean): Transition => (reduce ? INSTANT : preset)

// --- Charge-in keyframes ---------------------------------------------------------------------
/** Scale keyframes for a charge-in reveal (slight overshoot then settle). Pair with `CHARGE`. */
export const CHARGE_IN_SCALE = [0.8, 1.04, 1] as const
/** Opacity keyframes to fade a charge-in reveal. */
export const CHARGE_IN_OPACITY = [0, 1, 1] as const

/** Gentle idle float for a focal subject (PromptStage hero). 3.2s loop, reduced-motion → none. */
export const idleFloat = (reduce: boolean) =>
  reduce
    ? { animate: {}, transition: undefined as Transition | undefined }
    : {
        animate: { y: [0, -4, 0] },
        transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
      }

// --- Canonical dwell timings (ms) ------------------------------------------------------------
// One source of truth for auto-advance, replacing the ad-hoc 1500/2000/2500 values.
/** How long a correct answer's celebration holds before auto-advancing. Shorter on iOS. */
export const DWELL_CORRECT = (): number => (isIOS() ? 1100 : 1400)
/** Wrong answers NEVER auto-advance (retry-until-right feel). */
export const DWELL_WRONG = 0
