import type { TargetAndTransition, Transition } from 'framer-motion'

// Per-theme mascot tap/click reactions (UI/UX Overhaul). Tapping the corner mascot — in menus AND
// in games — cycles through that world's set so repeated taps stay surprising, and each world's
// set has its own personality (an octopus floats, an astronaut drifts weightlessly, a dino stomps).
// Shared by <Mascot/> (in-game) and <ThemeMascot/> (menus/home) so the feel is identical everywhere.
// Subtle, fast, kid-friendly; reduced-motion callers skip them (state/feedback still communicate).

export interface TapAnim {
  animate: TargetAndTransition
  transition: Transition
}

// 🌈 Regnbue (default) — bright & playful, all-purpose bounce.
const REGNBUE: TapAnim[] = [
  { animate: { rotate: [0, -9, 9, -7, 7, 0], scaleX: [1, 1.06, 0.96, 1.04, 1] }, transition: { duration: 0.6, ease: 'easeInOut' } }, // happy shimmy
  { animate: { y: [0, -26, 0, -9, 0], scaleY: [1, 1.08, 0.9, 1.03, 1] }, transition: { duration: 0.7, ease: 'easeOut' } }, // boing hop
  { animate: { rotate: [0, 360], scale: [1, 0.85, 1] }, transition: { duration: 0.7, ease: 'easeInOut' } }, // twirl
  { animate: { scaleY: [1, 0.75, 1.2, 0.92, 1.03, 1], scaleX: [1, 1.2, 0.85, 1.05, 0.98, 1] }, transition: { duration: 0.65, ease: 'easeOut' } }, // jelly squish
  { animate: { rotate: [0, 14, -4, 10, 0], y: [0, -6, 0] }, transition: { duration: 0.7, ease: 'easeInOut' } }, // curious peek
]

// 🌊 Havet — floaty & aquatic: gentle drifts, sways, a jellyfish squish.
const HAVET: TapAnim[] = [
  { animate: { y: [0, -10, 0, -6, 0], rotate: [0, -5, 5, -3, 0] }, transition: { duration: 1.0, ease: 'easeInOut' } }, // swim-bob
  { animate: { scaleX: [1, 1.08, 0.95, 1.04, 1], rotate: [0, 4, -4, 2, 0] }, transition: { duration: 0.75, ease: 'easeInOut' } }, // bubble wobble
  { animate: { rotate: [0, 360], scale: [1, 0.92, 1] }, transition: { duration: 0.95, ease: 'easeInOut' } }, // slow swirl
  { animate: { scaleY: [1, 0.8, 1.15, 0.95, 1], scaleX: [1, 1.12, 0.9, 1.03, 1] }, transition: { duration: 0.75, ease: 'easeOut' } }, // jellyfish squish
  { animate: { rotate: [0, 10, -8, 6, 0], x: [0, 4, -4, 0] }, transition: { duration: 0.9, ease: 'easeInOut' } }, // wave sway
]

// 🚀 Rummet — weightless: slow high floats, lazy tumbles, low-gravity hops.
const RUMMET: TapAnim[] = [
  { animate: { y: [0, -18, -14, -20, 0], rotate: [0, 6, -4, 3, 0] }, transition: { duration: 1.4, ease: 'easeInOut' } }, // zero-g float
  { animate: { rotate: [0, -360], y: [0, -8, 0] }, transition: { duration: 1.0, ease: 'easeInOut' } }, // weightless tumble
  { animate: { y: [0, -34, 0, -12, 0] }, transition: { duration: 1.0, ease: 'easeOut' } }, // moon hop
  { animate: { y: [0, -10, 0], scale: [1, 1.05, 1] }, transition: { duration: 1.2, ease: 'easeInOut' } }, // slow bob
  { animate: { rotate: [0, 16, -10, 8, 0], x: [0, 6, -6, 0] }, transition: { duration: 1.1, ease: 'easeInOut' } }, // tilt drift
]

// 🦕 Dinosaurer — chunky & stompy: heavy squashes, chomp-nods, a tail wiggle.
const DINO: TapAnim[] = [
  { animate: { y: [0, -14, 0], scaleY: [1, 1.1, 0.82, 1.06, 1] }, transition: { duration: 0.6, ease: 'easeOut' } }, // stomp
  { animate: { rotate: [0, 9, -2, 6, 0], y: [0, 4, 0] }, transition: { duration: 0.6, ease: 'easeInOut' } }, // chomp-nod
  { animate: { rotate: [0, -11, 11, -6, 6, 0], scaleX: [1, 1.05, 0.97, 1] }, transition: { duration: 0.7, ease: 'easeInOut' } }, // tail wiggle
  { animate: { rotate: [0, -12, 4, -8, 0], y: [0, -6, 2, 0] }, transition: { duration: 0.8, ease: 'easeInOut' } }, // rear-back roar
  { animate: { y: [0, -22, 0, -8, 0], scaleY: [1, 1.06, 0.9, 1.03, 1] }, transition: { duration: 0.7, ease: 'easeOut' } }, // big hop
]

const BY_THEME: Record<string, TapAnim[]> = {
  kid: REGNBUE,
  ocean: HAVET,
  space: RUMMET,
  dino: DINO,
}

// A safe upper bound on how long any tap animation runs (ms) — callers use it to clear the
// transient tap state. Keep ≥ the longest transition above (zero-g float, 1.4s).
export const TAP_ANIM_MAX_MS = 1500

/** The tap-animation set for a theme (falls back to the playful default). */
export const getTapAnims = (themeId: string): TapAnim[] => BY_THEME[themeId] ?? REGNBUE
