import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LETTER_SPEECH_MS, LONGEST_MEASURED_LETTER_MS, letterStepMs } from './letterClipTiming.ts'
import { LONGEST_LETTER_SPEECH_MS } from './alphabetGroups.ts'
import { PLAYBACK_START_BUDGET_MS } from './autoplayPace.ts'
import { DANISH_LETTER_NAMES } from './danish-phrases.ts'

test('every Danish letter has a measured speech length', () => {
  // A missing letter would silently fall back to the slowest one — the spell-out would just feel slow,
  // with nothing failing. This is the guard that makes the table's coverage load-bearing.
  for (const glyph of Object.keys(DANISH_LETTER_NAMES)) {
    assert.ok(LETTER_SPEECH_MS[glyph] > 0, `no measured speech length for "${glyph}"`)
  }
  assert.equal(Object.keys(LETTER_SPEECH_MS).length, Object.keys(DANISH_LETTER_NAMES).length)
})

test('the table agrees with the alphabet browse own measured ceiling', () => {
  // Two independent measurements of the SAME clips (this table, 2026-08-04; alphabetGroups, 2026-08-01).
  // If they drift apart, one of them was estimated rather than measured.
  const max = Math.max(...Object.values(LETTER_SPEECH_MS))
  assert.equal(max, LONGEST_MEASURED_LETTER_MS)
  assert.ok(
    Math.abs(max - LONGEST_LETTER_SPEECH_MS) <= 10,
    `this table's longest letter (${max}ms) disagrees with alphabetGroups' ${LONGEST_LETTER_SPEECH_MS}ms`,
  )
})

test('a step always covers the letter plus playback startup', () => {
  // Below this a name is cut off mid-word, which is the failure the fixed-step rule exists to prevent.
  for (const [glyph, speech] of Object.entries(LETTER_SPEECH_MS)) {
    assert.equal(letterStepMs(glyph), speech + PLAYBACK_START_BUDGET_MS)
    assert.ok(letterStepMs(glyph) >= speech + PLAYBACK_START_BUDGET_MS, glyph)
  }
  // Lowercase input must resolve to the same step (the game upper-cases for display, not for audio).
  assert.equal(letterStepMs('k'), letterStepMs('K'))
  // An unknown glyph gets the slowest letter's budget, never a short one.
  assert.equal(letterStepMs('7'), LONGEST_MEASURED_LETTER_MS + PLAYBACK_START_BUDGET_MS)
})

test('spelling is measurably faster than awaiting the padded clips', () => {
  // The old shape awaited each full clip (speech + 0.4-0.7s of trailing silence) plus a 180ms gap:
  // ~1.5s at the median. Pin the improvement so a future change can't quietly undo it.
  const median = Object.values(LETTER_SPEECH_MS).sort((a, b) => a - b)[Math.floor(29 / 2)]
  assert.ok(median + PLAYBACK_START_BUDGET_MS < 1100, `median step ${median + PLAYBACK_START_BUDGET_MS}ms is no longer brisk`)
  // "KAT" — the canonical case. 2806ms measured (935ms a letter) against ~4.5-5.7s for the awaited
  // shape. The remaining cost is Azure's ~225ms of LEADING silence inside each clip plus ~250ms of
  // player startup, i.e. ~475ms of dead air before each name; going faster than this needs the baked
  // clips trimmed (or a seek past the lead-in), not a smaller step — a step below speech+startup cuts
  // the name off, which is the failure this whole table exists to prevent.
  const kat = ['K', 'A', 'T'].reduce((sum, l) => sum + letterStepMs(l), 0)
  assert.ok(kat < 3000, `spelling KAT takes ${kat}ms`)
  assert.ok(kat > 1500, `spelling KAT takes only ${kat}ms — a step this short would clip the names`)
})
