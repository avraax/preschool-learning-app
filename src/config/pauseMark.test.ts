// A `|` in a narration line is a short spoken pause (owner 2026-11-07: "Hvad starter | raket | med").
// Azure gets an SSML <break>; Web Speech can't take SSML and hears a comma instead.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSsml, stripPauses, PAUSE_MS } from '../../shared-azure-tts.js'

const ssml = (text: string) => buildSsml({ text, voiceName: 'da-DK-ChristelNeural', lang: 'da-DK', speed: 1, pitch: null, lexiconUri: null, ipa: null })

test('a pause mark becomes a short SSML break, and the mark itself is never spoken', () => {
  const s = ssml('Hvad starter | Raket | med?')
  assert.match(s, new RegExp(`Hvad starter<break time="${PAUSE_MS}ms"/>Raket<break time="${PAUSE_MS}ms"/>med\\?`))
  assert.doesNotMatch(s, /\|/, 'Azure would read the bar aloud')
  assert.ok(PAUSE_MS >= 50 && PAUSE_MS <= 200, 'heard gap = ~0.33 s + this; the owner asked for short pauses, not a stall')
})

test('a line without marks is unchanged, and escaping still holds', () => {
  assert.match(ssml('rød & blå'), /<prosody [^>]*>rød &amp; blå<\/prosody>/)
})

test('Web Speech hears commas, not bars', () => {
  assert.equal(stripPauses('Hvad starter | Raket | med?'), 'Hvad starter, Raket, med?')
})
