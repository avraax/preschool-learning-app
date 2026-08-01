import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NUMBER_BROWSE_RATE,
  NUMBER_STEP_MS,
  LONGEST_NUMBER_SPEECH_MS,
  numberStepFits,
} from './numberAutoplay.ts'
import { PLAYBACK_START_BUDGET_MS } from './autoplayPace.ts'
import { getDanishNumberText } from './danish-phrases.ts'
import { PREBAKED_TTS } from './prebakedTts.ts'
import { TTS_CONFIG } from './tts-config.ts'
import { ttsCacheKey } from '../../shared-tts-key.js'
import { NUMBER_BROWSE_RATE as ENUMERATED_RATE } from '../../shared-narration-clips.js'

// Guards "Hør tallene" (Lær Tal's 1→N autoplay). What can break it silently:
//   1. a number whose clip isn't prebaked AT THE BROWSE RATE — the run would stall mid-count on a live
//      Azure round-trip, and that clip was never auditioned,
//   2. the browse rate drifting from the rate the prebake enumerator bakes (a rate is part of the cache
//      key, so a mismatch silently un-prebakes all 101 number clips),
//   3. the step dropping below the longest spoken number, which cuts names off mid-word.

// The full grid range. 100 is what Normal/Svær show; Let stops at 60, a prefix of the same list.
const MAX = 100

test('every number in the run is prebaked at the browse rate', () => {
  const { name, lang } = TTS_CONFIG.voices.primary
  for (let n = 1; n <= MAX; n++) {
    const text = getDanishNumberText(n)
    assert.ok(text && text !== String(n), `number ${n} has no Danish word (got "${text}")`)
    const key = ttsCacheKey({ name, lang, rate: NUMBER_BROWSE_RATE, useLexicon: true, text })
    assert.ok(PREBAKED_TTS[key], `number ${n} ("${text}") is not prebaked at rate ${NUMBER_BROWSE_RATE} — key: ${key}`)
  }
})

test('the prebake enumerator bakes numbers at exactly the rate the screen asks for', () => {
  // Both sides must read the SAME constant — the enumerator re-exports this one. Pin the value too, so
  // the check can't pass vacuously by both sides moving together (project convention).
  assert.equal(ENUMERATED_RATE, NUMBER_BROWSE_RATE)
  assert.equal(NUMBER_BROWSE_RATE, 1.2)
})

test('the pace never cuts a number off mid-word', () => {
  const needed = LONGEST_NUMBER_SPEECH_MS + PLAYBACK_START_BUDGET_MS
  assert.ok(numberStepFits(), 'numberStepFits() disagrees with the step/longest-name pair')
  assert.ok(
    NUMBER_STEP_MS >= needed,
    `NUMBER_STEP_MS (${NUMBER_STEP_MS}) is below the longest spoken number + playback startup (${needed}ms) — the step would cut "syvogtredive" off mid-word`,
  )
})

test('numbers are paced wider than letters, because their names are longer', () => {
  // Not arbitrary: the measured longest spoken number (1.14s) exceeds the longest letter name (1.04s),
  // so reusing the alphabet's step here would clip the thirties and the -halvfjerds family.
  assert.ok(
    LONGEST_NUMBER_SPEECH_MS > 1040,
    'if numbers became shorter than letter names, re-measure and retune the step',
  )
})
