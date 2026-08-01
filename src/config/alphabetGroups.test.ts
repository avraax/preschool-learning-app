import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALPHABET_GROUPS,
  DANISH_ALPHABET,
  LETTER_STEP_MS,
  GROUP_PAUSE_MS,
  LONGEST_LETTER_SPEECH_MS,
  letterStepFits,
} from './alphabetGroups.ts'
import { PLAYBACK_START_BUDGET_MS } from './autoplayPace.ts'
import { getDanishLetterName } from './danish-phrases.ts'
import { PREBAKED_TTS } from './prebakedTts.ts'
import { TTS_CONFIG } from './tts-config.ts'
import { ttsCacheKey } from '../../shared-tts-key.js'

// Guards "Hør alfabetet" (Lær Alfabetet's A→Å autoplay). Two things can break it silently:
//   1. the grouping drifting from the alphabet (a dropped letter, two groups swapped) — invisible
//      without listening to the whole 38s run,
//   2. a letter name that isn't prebaked — the run would stop mid-sequence to round-trip Azure.
//
// The expected sequence is written out HERE as its own literal rather than imported, so the check
// still bites if ALPHABET_GROUPS and DANISH_ALPHABET are ever edited together (the project's
// "two sides that move together pass vacuously" trap).
const EXPECTED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('')

test('ALPHABET_GROUPS covers the Danish alphabet exactly once', () => {
  const flat = ALPHABET_GROUPS.flat()

  for (const letter of EXPECTED) {
    const seen = flat.filter((l) => l === letter).length
    assert.equal(seen, 1, `letter ${letter} appears ${seen}× in ALPHABET_GROUPS (expected exactly once)`)
  }
  for (const letter of flat) {
    assert.ok(EXPECTED.includes(letter), `ALPHABET_GROUPS contains an unknown letter: ${letter}`)
  }
  assert.equal(flat.length, 29, `ALPHABET_GROUPS has ${flat.length} letters, expected 29`)
})

test('ALPHABET_GROUPS is in alphabetical order and matches DANISH_ALPHABET', () => {
  const flat = ALPHABET_GROUPS.flat()

  const wrong = flat.findIndex((letter, i) => letter !== EXPECTED[i])
  assert.equal(
    wrong,
    -1,
    `ALPHABET_GROUPS is out of order at position ${wrong}: got ${flat[wrong]}, expected ${EXPECTED[wrong]}`,
  )

  const drifted = DANISH_ALPHABET.findIndex((letter, i) => letter !== EXPECTED[i])
  assert.equal(
    drifted,
    -1,
    `DANISH_ALPHABET is wrong at position ${drifted}: got ${DANISH_ALPHABET[drifted]}, expected ${EXPECTED[drifted]}`,
  )
  assert.deepEqual(flat, DANISH_ALPHABET)
})

test('the recited grouping is 7 + 7 + 7 + 5 + 3', () => {
  // The phrasing itself, pinned: five groups, the shape the alphabet is chanted in. A regrouping is
  // a deliberate content change, not a refactor.
  assert.deepEqual(ALPHABET_GROUPS.map((g) => g.length), [7, 7, 7, 5, 3])
})

test('every letter in the run has a prebaked spoken name', () => {
  // The run plays `audio.speakLetter(letter)` → getDanishLetterName → the prebaked mp3. If a name is
  // missing from the manifest the sequence pauses mid-alphabet on a live Azure round-trip (and the
  // clip was never auditioned), which is exactly what this catches.
  const { name, lang } = TTS_CONFIG.voices.primary
  const rate = TTS_CONFIG.speakingRate

  for (const letter of ALPHABET_GROUPS.flat()) {
    const spoken = getDanishLetterName(letter)
    assert.ok(spoken.trim().length > 0, `letter ${letter} has no spoken name`)
    const key = ttsCacheKey({ name, lang, rate, useLexicon: true, text: spoken })
    assert.ok(PREBAKED_TTS[key], `letter ${letter} ("${spoken}") is not prebaked — key: ${key}`)
  }
})

test('the pace never cuts a letter name off mid-word', () => {
  // The sequencer starts the next letter on LETTER_STEP_MS instead of awaiting the padded clip, so
  // the step is also a hard cap on how long a name may take to say. Chasing "more pace" below the
  // longest measured spoken name (W, 1.04s) would clip letters — audible, but nothing else catches it.
  const needed = LONGEST_LETTER_SPEECH_MS + PLAYBACK_START_BUDGET_MS
  assert.ok(letterStepFits(), 'letterStepFits() disagrees with the step/longest-name pair')
  assert.ok(
    LETTER_STEP_MS >= needed,
    `LETTER_STEP_MS (${LETTER_STEP_MS}) is below the longest spoken letter name + playback startup (${needed}ms) — the step would cut W ("dobbelt-ve") off mid-word`,
  )
})

test('there is an audible breath between the groups', () => {
  // Without this the run is 29 evenly spaced letters and the recited phrasing disappears.
  assert.ok(GROUP_PAUSE_MS > 0, 'GROUP_PAUSE_MS must be positive')
  // A group breath longer than a letter's whole step would read as "the run stopped".
  assert.ok(GROUP_PAUSE_MS < LETTER_STEP_MS, `GROUP_PAUSE_MS (${GROUP_PAUSE_MS}) should stay under one letter step (${LETTER_STEP_MS})`)
})
