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
/**
 * Exit transition for an `AnimatePresence mode="wait"` swap (the `?`→answer flip). MUST be a short
 * TWEEN, never one of the springs above: `mode="wait"` holds the incoming element until the outgoing
 * one's animation completes, and a spring on `opacity: 0` takes ~1s to settle — which delayed the
 * measured answer reveal by 1043ms even though the state flipped on the tap. The reveal's ENTER keeps
 * its bouncy POP; only the leaving element gets out of the way fast.
 */
export const EXIT_FAST: Transition = { duration: 0.12, ease: 'easeOut' }

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
//
// A dwell is a FIXED window measured from the tap, and the narration is fire-and-forget alongside it —
// never `await`ed (2026-08-02). Awaiting made the wait `synth + clip`, and since Azure pads every clip
// with ~0.22s of lead-in and ~0.68s of TRAILING silence, most of the tail was inaudible dead time; on
// the math games, whose fact lines weren't prebaked, a 1.09s live synth sat in front of it too. Worse,
// the score/celebration/answer-reveal ran AFTER that await, so the child got a green tile, ~4s of
// nothing, then confetti and an instant board change. Same rule as the autoplay browses — see
// `.claude/rules/audio-system.md`, "Never await a prebaked clip to pace a timed sequence."
//
// The values below are the measured speech end (ffmpeg silencedetect over the prebaked mp3s) plus the
// shared <audio> element's ~0.25s startup, so the spoken part always completes inside the dwell and
// only trailing silence is cancelled by the next prompt:
//   single word ("syv", "rød", a letter)      speech ends ~0.86s in-file → ~1.1s from the tap
//   sentence fact ("Elefant starter med E")   speech ends ~1.78s in-file → ~2.0s from the tap
/** Celebration window for a correct answer whose narration is a single word (echo of the tap). */
export const DWELL_CORRECT = (): number => (isIOS() ? 1100 : 1400)
/**
 * Celebration window for a correct answer that speaks a completed FACT sentence ("tre plus fire er
 * syv", "Elefant starter med E"). Longer than DWELL_CORRECT so the sentence is never cut mid-word —
 * that reinforcement line IS the teaching moment (PRD-05 P2). Not iOS-branched: clip length is the
 * constraint here, not platform feel.
 */
export const DWELL_FACT = 2000
/** Wrong answers NEVER auto-advance (retry-until-right feel). */
export const DWELL_WRONG = 0
