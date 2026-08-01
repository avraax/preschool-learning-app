// Shared pacing facts for the "autoplay a sequence" browses (Lær Alfabetet's "Hør alfabetet",
// Lær Tal's "Hør tallene"). These describe the AUDIO CHANNEL, not the content, so both sequences read
// them from here — see `.claude/rules/audio-system.md` for the measurement behind them.
//
// The shape of the problem: prebaked clips are padded (Azure puts ~0.22s of silence before the spoken
// word and 0.4–0.7s after it), so a timed run must NOT await them — it paces on a fixed onset-to-onset
// step and lets the next clip cancel the previous dead tail. That makes the step a hard cap on how long
// an item may take to say, which is what the two constants below size.

/**
 * How long after a `speak*()` call the shared `<audio>` element actually starts producing sound
 * (load + decode + play scheduling; measured 170–350ms in dev with the files already warm). It is dead
 * air at the head of every item and it eats into the step, so every sequence's step must carry it:
 *
 *     step >= (longest spoken item) + PLAYBACK_START_BUDGET_MS
 *
 * Below that, the step cuts the longest names off mid-word. Each sequence's test guards this.
 */
export const PLAYBACK_START_BUDGET_MS = 250

/**
 * Extra room for the FIRST item of a run only. If the child presses before any narration has unlocked
 * the audio stack, that first clip takes ~800ms to start (vs ~250ms warm) and a normal step would cut
 * it short. Rhythmically free — the run hasn't established its beat yet, so it reads as the pickup.
 */
export const FIRST_ITEM_EXTRA_MS = 500
