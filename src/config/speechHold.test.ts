// Owner 2026-11-07: "Hvad mangler" read the finished sequence and the next round started over it. The
// fixed dwells (DWELL_FACT 2 s) are measured for typical lines; a long one outran them. Now every game's
// advance, when its dwell runs out, holds once for whatever the line still has to SAY — from the speech
// end the prebake measured for that clip (prebakedSpeechEnd.ts), never by awaiting the audio.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { speechHoldMs, SPEECH_HOLD_CAP_MS } from './speechHold.ts'
import { PREBAKED_TTS } from './prebakedTts.ts'
import { PREBAKED_SPEECH_END_MS } from './prebakedSpeechEnd.ts'
import { sequenceFactText, sequenceNumbers, sequenceStarts } from './gamePhrases.ts'
import { ttsCacheKey } from '../../shared-tts-key.js'
import { TTS_CONFIG } from '../../shared-tts-config.js'

const code = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('the hold: nothing left → advance now; words left → wait them out (+ a little air), capped', () => {
  assert.equal(speechHoldMs({ speechRemainingMs: () => 0 }), 0)
  const h = speechHoldMs({ speechRemainingMs: () => 900 })
  assert.ok(h > 900 && h < 1200, `${h}`)
  assert.equal(speechHoldMs({ speechRemainingMs: () => 60_000 }), SPEECH_HOLD_CAP_MS)
})

test('every prebaked clip has a measured speech end, and only real clips do', () => {
  const files = new Set(Object.values(PREBAKED_TTS).map((f) => f.replace(/\.mp3$/, '')))
  const measured = new Set(Object.keys(PREBAKED_SPEECH_END_MS))
  const missing = [...files].filter((f) => !measured.has(f))
  assert.deepEqual(missing, [], 'a clip without a speech end can be cut off — run npm run tts:prebake')
  assert.deepEqual([...measured].filter((f) => !files.has(f)), [], 'stale entries')
})

test('the bug is real: a long Hvad Mangler read-back outlasts DWELL_FACT (so the hold is load-bearing)', () => {
  const v = TTS_CONFIG.voices.primary
  const DWELL_FACT = +(/export const DWELL_FACT = (\d+)/.exec(readFileSync(new URL('../theme/motion.ts', import.meta.url), 'utf-8'))?.[1] ?? NaN)
  let longest = 0
  for (const spec of sequenceStarts) {
    const key = ttsCacheKey({ name: v.name, lang: v.lang, rate: TTS_CONFIG.speakingRate, useLexicon: true, text: sequenceFactText(sequenceNumbers(spec)) })
    const file = PREBAKED_TTS[key]
    assert.ok(file, 'a sequence line is not baked')
    longest = Math.max(longest, PREBAKED_SPEECH_END_MS[file.replace(/\.mp3$/, '')])
  }
  assert.ok(longest + 250 > DWELL_FACT, `longest read-back ends at ${longest} ms — the dwell alone would not cut it`)
})

// Each game that speaks on a correct answer and then advances on a timer must ask the hold.
for (const f of [
  '../components/common/UnifiedQuizGame.tsx',
  '../components/math/MathOperationGame.tsx',
  '../components/math/ComparisonGame.tsx',
  '../components/math/FyldBaadenGame.tsx',
  '../components/farver/FarveQuizGame.tsx',
  '../components/farver/RamFarvenGame.tsx',
  '../components/farver/FarvejagtGame.tsx',
]) {
  test(`${f.split('/').pop()}: the advance holds for unfinished speech`, () => {
    assert.match(code(f), /const hold = held \? 0 : speechHoldMs\(audio\)/, 'the next round can start over the spoken line')
  })
}

test('ttsClient sets the speech end when a prebaked clip starts, and clears it on stop', () => {
  const c = code('../services/ttsClient.ts')
  assert.match(c, /this\.speechEndsAt = end \? performance\.now\(\) \+ PLAY_STARTUP_MS \+ end : 0/)
  assert.match(c, /stopCurrentAudio\(\): void \{[^}]*this\.speechEndsAt = 0/)
})
