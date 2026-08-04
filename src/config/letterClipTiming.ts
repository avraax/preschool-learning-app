// How long each Danish letter NAME actually takes to say, so a spell-out can pace itself instead of
// awaiting padded clips.
//
// Why this exists: `speakLetter()` resolves when the AUDIO FILE ends, and Azure pads every clip with
// ~0.22s of silence before the name and 0.4–0.7s after it. Awaiting each letter therefore waits out
// half a second of silence per letter — Sig et Ord's spell-out ran ~1.5–1.9s per letter when the longest
// name is 1.04s and the median is 0.75s (owner, 2026-08-04: "could be a little bit faster"). The rule is
// in `.claude/rules/audio-system.md`: never await a prebaked clip to pace a sequence; step on a fixed
// onset-to-onset interval and let the next clip cancel the previous dead tail.
//
// MEASURED 2026-08-04 with `ffmpeg silencedetect=noise=-45dB:d=0.04` over all 29 committed clips at the
// DEFAULT voice + rate — the same method behind `alphabetGroups.ts`. Values are ms from clip start to the
// end of the spoken name. Re-measure (don't estimate) if the voice, the rate or `DANISH_LETTER_NAMES`
// changes; `letterClipTiming.test.ts` fails if a letter is missing or the table disagrees with the
// alphabet browse's own measured ceiling.
import { PLAYBACK_START_BUDGET_MS } from './autoplayPace.ts'

export const LETTER_SPEECH_MS: Record<string, number> = {
  A: 422, B: 771, C: 896, D: 789, E: 736, F: 651, G: 795, H: 866, I: 581, J: 823,
  K: 815, L: 671, M: 748, N: 701, O: 502, P: 790, Q: 808, R: 712, S: 641, T: 819,
  U: 747, V: 843, W: 1044, X: 687, Y: 718, Z: 854, Æ: 733, Ø: 493, Å: 770,
}

/** The slowest letter to say (W = "dobbelt-ve"), which sizes any fixed-step alternative. */
export const LONGEST_MEASURED_LETTER_MS = 1044

/**
 * The onset-to-onset step for spelling ONE letter aloud: its own measured speech plus the time the
 * shared `<audio>` element needs to start producing sound. Per-letter rather than one fixed step,
 * because a word's letters are usually short ones — "KAT" spends 815+422+819 instead of 3×1044, so the
 * spell-out is brisk without ever clipping a name mid-word.
 *
 * An unknown glyph (a digit, a hyphen) falls back to the slowest letter: better a beat too long than a
 * name cut in half.
 */
export const letterStepMs = (letter: string): number =>
  (LETTER_SPEECH_MS[letter.toUpperCase()] ?? LONGEST_MEASURED_LETTER_MS) + PLAYBACK_START_BUDGET_MS
