import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LETTER_WORDS, WORD_LETTERS, letterPhrase, startsWithPhrase } from './letterWords.ts'
import { collectNarrationClips } from '../../shared-narration-clips.js'

// Guards the ONE thing that silently breaks these pronunciation fixes: the prebake enumerator
// building different text than the components speak. Both sides must go through letterPhrase() /
// startsWithPhrase(), which carry the per-letter fixes (Z respelled 'zet', I comma-isolated). If the
// enumerator stops using them, prebake bakes keys the app never asks for, the fixed line falls back to
// live Azure, and it never surfaces in /audit — the exact trap in .claude/rules/audio-system.md.

const texts = () => new Set(collectNarrationClips().map((c: { text: string }) => c.text))

test('every "{bogstav} som {ord}" line is enumerated exactly as the components build it', () => {
  const enumerated = texts()
  for (const letter of Object.keys(LETTER_WORDS)) {
    const expected = letterPhrase(letter, LETTER_WORDS[letter].word)
    assert.ok(enumerated.has(expected), `missing prebake clip: "${expected}"`)
  }
})

test('every "{ord} starter med {bogstav}" line is enumerated exactly as the components build it', () => {
  const enumerated = texts()
  for (const letter of WORD_LETTERS) {
    const expected = startsWithPhrase(letter, LETTER_WORDS[letter].word)
    assert.ok(enumerated.has(expected), `missing prebake clip: "${expected}"`)
  }
})

test('a fixed letter never leaks its raw-glyph line into the baked set', () => {
  const enumerated = texts()
  for (const letter of Object.keys(LETTER_WORDS)) {
    const word = LETTER_WORDS[letter].word
    const raw = `${letter} som ${word}`
    if (letterPhrase(letter, word) === raw) continue // no override → the raw line IS correct
    assert.ok(!enumerated.has(raw), `stale raw-glyph clip still enumerated for ${letter}`)
  }
})

// The two owner-verified fixes, pinned. These are ear-established facts about Azure da-DK that a
// refactor must not quietly undo (a comma looks like a typo; 'zet' looks like a misspelling).
test('the owner-verified pronunciation fixes are still in force', () => {
  // I needs BOTH halves: the comma (letter reads as a name, not the pronoun) AND the article +
  // lowercase (word reads as a noun, not the initialism I-S). Dropping either regresses it.
  assert.equal(letterPhrase('I', 'Is'), 'I, som en is')
  assert.equal(letterPhrase('Z', 'Zebra'), 'zet som Zebra') // Danish letter name, not the glyph
  assert.equal(letterPhrase('A', 'Abe'), 'A som Abe') // unfixed letters stay byte-identical
  // The quiz's correct-answer fact: I speaks the browse line (no sentence-final phrasing read right),
  // which also means it reuses that clip rather than needing its own.
  assert.equal(startsWithPhrase('I', 'Is'), 'I, som en is')
  assert.equal(startsWithPhrase('I', 'Is'), letterPhrase('I', 'Is'))
  assert.equal(startsWithPhrase('Z', 'Zebra'), 'Zebra starter med zet')
  assert.equal(startsWithPhrase('A', 'Abe'), 'Abe starter med A') // frame intact for the other 27
})

test('a whole-line override follows the manifest word instead of hardcoding it', () => {
  // Guards the stale-line trap: if LETTER_WORDS.I ever changes, the override must move with it.
  assert.equal(letterPhrase('I', 'Isbjørn'), 'I, som en isbjørn')
})
