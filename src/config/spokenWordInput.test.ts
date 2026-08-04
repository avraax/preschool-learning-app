import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSpokenWord, spokenWordArtId } from './spokenWordInput.ts'

test('a plain transcript yields its first word, lowercased', () => {
  // STT capitalises the leading word; lowercase is what the prebaked clip keys and the (lowercase,
  // case-SENSITIVE) PLS lexicon entries match.
  assert.equal(normalizeSpokenWord('Kat'), 'kat')
  assert.equal(normalizeSpokenWord('  hund  '), 'hund')
  assert.equal(normalizeSpokenWord('kat og hund'), 'kat')
  assert.equal(normalizeSpokenWord('Æble.'), 'æble')
  assert.equal(normalizeSpokenWord('is-bjørn'), 'is-bjørn')
  // Real Danish two-letter words must survive — they are in the game's own word pool.
  assert.equal(normalizeSpokenWord('is'), 'is')
  assert.equal(normalizeSpokenWord('ko'), 'ko')
  assert.equal(normalizeSpokenWord('bi'), 'bi')
  assert.equal(normalizeSpokenWord('ål'), 'ål')
})

test('a leading one-letter filler token is dropped', () => {
  // MEASURED: the recognizer returned "i is" for "is" on all four child-like variants; taking token[0]
  // spelled "I" back to the child.
  assert.equal(normalizeSpokenWord('i is'), 'is')
  assert.equal(normalizeSpokenWord('e hund'), 'hund')
  // …but only while a real token remains.
  assert.equal(normalizeSpokenWord('k'), '')
  assert.equal(normalizeSpokenWord('B'), '')
  assert.equal(normalizeSpokenWord('i i'), '')
})

test('a foreign spelling of a Danish homophone is repaired', () => {
  // MEASURED: "kat" came back as English "cat" on every distorted variant, "bær" as German "Bär".
  assert.equal(normalizeSpokenWord('cat'), 'kat')
  assert.equal(normalizeSpokenWord('Cat'), 'kat')
  assert.equal(normalizeSpokenWord('Bär'), 'bær')
  // A Danish word that merely looks foreign must NOT be rewritten.
  assert.equal(normalizeSpokenWord('bil'), 'bil')
})

test('masked or blocked profanity is treated as nothing recognized', () => {
  // The recognizer masks with `*` when it honours the filter; the blocklist covers the case where it
  // doesn't. This word gets SPELLED ALOUD, so neither path may leak.
  assert.equal(normalizeSpokenWord('f****'), '')
  assert.equal(normalizeSpokenWord('f*** dig'), '')
  assert.equal(normalizeSpokenWord('lort'), '')
  assert.equal(normalizeSpokenWord('Fuck'), '')
  assert.equal(normalizeSpokenWord('pik'), '')
})

test('a digits-only transcript becomes a Danish number WORD', () => {
  // The old letter-only filter stripped "5" to '' — a child saying "fem" hit the retry line for no
  // reason. This was the game's most confusing dead end.
  assert.equal(normalizeSpokenWord('5'), 'fem')
  assert.equal(normalizeSpokenWord('10.'), 'ti')
  assert.equal(normalizeSpokenWord('37'), 'syvogtredive')
  assert.equal(normalizeSpokenWord('100'), 'et hundrede')
  // Past the app's number ceiling there is no word to spell — retry instead of spelling digits.
  assert.equal(normalizeSpokenWord('1234'), '')
  // A one-character number word would be rejected by the length rule, so check the boundary: "0" is
  // "nul" (3 chars) and survives; nothing maps to a single letter.
  assert.equal(normalizeSpokenWord('0'), 'nul')
})

test('nothing usable yields the empty string', () => {
  assert.equal(normalizeSpokenWord(''), '')
  assert.equal(normalizeSpokenWord('   '), '')
  assert.equal(normalizeSpokenWord('...'), '')
})

test('art ids fold the Danish glyphs to the baked filename aliases', () => {
  assert.equal(spokenWordArtId('æg'), 'aeg')
  assert.equal(spokenWordArtId('ræv'), 'raev')
  assert.equal(spokenWordArtId('løg'), 'loeg')
  assert.equal(spokenWordArtId('ål'), 'aal')
  assert.equal(spokenWordArtId('kat'), 'kat')
})
