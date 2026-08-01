// "Hør tallene" — Lær Tal's 1→N autoplay. The number sibling of `alphabetGroups.ts`, and deliberately
// SIMPLER: numbers are one steady flow with no grouping and no tempo change (owner decision — the
// alphabet's A–G · H–N · … phrasing is a property of how the alphabet is recited; counting has none).
//
// Pacing model + why the run must not await its clips: see `autoplayPace.ts`.

import { PLAYBACK_START_BUDGET_MS } from './autoplayPace.ts'

/**
 * The speaking rate Lær Tal uses for numbers — a bit quicker than the app default, which is why the
 * prebake enumerator bakes every number at BOTH rates.
 *
 * SINGLE SOURCE: the browse tap, the autoplay and `shared-narration-clips.js` all read this. A rate is
 * part of the prebake cache key, so a number spoken at an un-enumerated rate silently falls back to
 * live Azure (slow, and never auditioned) — the test pins every number to the manifest at this rate.
 */
export const NUMBER_BROWSE_RATE = 1.2

/**
 * The longest measured distance from a clip's start to the END of its spoken name at
 * `NUMBER_BROWSE_RATE`: 37 "syvogtredive" / 76 "seksoghalvfjerds" (measured with `ffmpeg silencedetect`
 * over all 100 clips, 2026-08-01; mean 0.93s). Danish compounds the ones before the tens, so the
 * mid-thirties and the -halvfjerds/-halvfems families are the long ones, NOT the biggest numbers.
 */
export const LONGEST_NUMBER_SPEECH_MS = 1140

/**
 * Onset-to-onset pace: how long each number owns the run before the next one starts. Sized so the
 * longest name above always finishes (see `PLAYBACK_START_BUDGET_MS`) — 1.4s is the floor for
 * "never cuts a number off mid-word", which the test guards.
 *
 * Cost of the full range: ~1.4s × 100 ≈ 2m20s (≈1m25s at the Let difficulty's 60). That is what
 * counting to 100 out loud actually takes; the child can stop it at any time.
 */
export const NUMBER_STEP_MS = 1400

/** Sanity: the step must cover the longest spoken number plus the channel's startup. */
export const numberStepFits = (): boolean =>
  NUMBER_STEP_MS >= LONGEST_NUMBER_SPEECH_MS + PLAYBACK_START_BUDGET_MS
