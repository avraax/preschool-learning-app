// "Hør alfabetet" — the recited grouping + tempo for Lær Alfabetet's A→Å autoplay.
//
// Kept out of the component so the grouping is testable (Node-importable, no side effects): the one
// thing that can silently break is a letter dropped from a group or two groups swapped, which is
// invisible in the UI until you listen to all 38 seconds. `alphabetGroups.test.ts` pins both.
//
// The tempo constants here are the tuning levers; the shared pacing facts (playback startup, the
// first-item allowance) live in `autoplayPace.ts` because they belong to the audio channel, not to the
// alphabet — Lær Tal's `numberAutoplay.ts` reads the same ones.

import { PLAYBACK_START_BUDGET_MS } from './autoplayPace.ts'

/**
 * The Danish alphabet, in order. The canonical list for the browse screen (grid, bloom, autoplay).
 * Deliberately a literal, NOT derived from ALPHABET_GROUPS — the test compares the two, so if one is
 * computed from the other the coverage check passes vacuously.
 */
export const DANISH_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å',
]

/**
 * How the alphabet is actually recited: A–G · H–N · O–U · V–Z · Æ Ø Å (7 + 7 + 7 + 5 + 3 = 29).
 * A longer breath falls between the groups so the child can hear the phrasing, not just 29 letters.
 */
export const ALPHABET_GROUPS: readonly string[][] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z'],
  ['Æ', 'Ø', 'Å'],
]

/**
 * Onset-to-onset pace: how long each letter OWNS the run before the next one starts — not a gap
 * appended to the clip.
 *
 * Why it works this way: the prebaked letter clips are 1.25–1.73 s long but the spoken name is only
 * 0.2–0.83 s of that, sitting on ~0.22 s of leading silence with 0.4–0.7 s of trailing silence
 * (measured with `ffmpeg silencedetect` over all 29 clips, 2026-08-01). Waiting for a clip to END
 * therefore waits out Azure's padding: it made the full run 74 s at a plodding ~2.4 s per letter.
 * The sequencer instead starts the next letter on this step and lets it cancel the previous clip's
 * trailing silence (the controller has no queue — new audio cancels current), which is what turns
 * the run into an actual recitation (~35 s).
 */
export const LETTER_STEP_MS = 1300

/**
 * The longest measured distance from a clip's start to the END of its spoken name — W, which Azure
 * reads "dobbelt-ve" (all other letters finish by 900ms). The step must cover this plus the channel's
 * startup budget (see `autoplayPace.ts`), or it cuts W off mid-word. Guarded by the test.
 */
export const LONGEST_LETTER_SPEECH_MS = 1040

/** Extra breath AFTER a group, on top of that letter's step — the audible phrasing. */
export const GROUP_PAUSE_MS = 600

/** Sanity: the step must cover the longest spoken letter name plus the channel's startup. */
export const letterStepFits = (): boolean =>
  LETTER_STEP_MS >= LONGEST_LETTER_SPEECH_MS + PLAYBACK_START_BUDGET_MS
