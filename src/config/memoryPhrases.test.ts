import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MEMORY_LETTERS_INSTRUCTION, MEMORY_NUMBERS_INSTRUCTION } from './gamePhrases.ts'
import { PREBAKED_TTS } from './prebakedTts.ts'
import { TTS_CONFIG } from './tts-config.ts'
import { ttsCacheKey } from '../../shared-tts-key.js'
import { collectNarrationClips } from '../../shared-narration-clips.js'

// Guards Hukommelsesspil's two board instructions — spoken by "Hør igen" and by the game welcome.
//
// THE INCIDENT (2026-09-04, found by `docs/qa.md`'s audio sweep, not by any of the 732 unit tests):
// both lines were composed INLINE in `MemoryGame.tsx`, which `shared-narration-clips.js` cannot reach
// (it is plain Node — it imports `src/config/*.ts`, never a `.tsx`). So they were the only two spoken
// lines in the app with no prebaked clip: 0 of 1885 manifest keys matched. Every press reached live
// Azure — which the shipped app BLOCKS for a guest (`authGatePolicy`: `canCallPaidApis: false`) — and
// then fell through to Web Speech: a different voice, or silence offline. Nothing went red, because
// `audit:check` only signs off clips that are IN the closed set; a line missing from the set is
// invisible to it by construction.
//
// TWO guards, because either alone passes vacuously:
//   1. the lines are prebaked (what actually broke), and
//   2. the strings are not hardcoded in the component (the SHAPE that broke it, and the only one that
//      catches the next line someone composes inline).

const daKey = (text: string) => {
  const { name, lang } = TTS_CONFIG.voices.primary
  return ttsCacheKey({ name, lang, rate: TTS_CONFIG.speakingRate, useLexicon: true, text })
}

test('both memory board instructions are prebaked and enumerated', () => {
  // Pinned literally: the app and the enumerator call the same constant, so "they agree" is true even
  // when both are wrong and every committed clip has silently become an orphan.
  assert.equal(MEMORY_LETTERS_INSTRUCTION, 'Find ens bogstaver ved at klikke på kortene')
  assert.equal(MEMORY_NUMBERS_INSTRUCTION, 'Find ens tal ved at klikke på kortene')

  const enumerated = new Set(collectNarrationClips().map((c: { text: string }) => c.text))
  for (const line of [MEMORY_LETTERS_INSTRUCTION, MEMORY_NUMBERS_INSTRUCTION]) {
    assert.ok(enumerated.has(line), `"${line}" is not in the enumerated narration set — the prebake cannot see it`)
    const key = daKey(line)
    assert.ok(PREBAKED_TTS[key], `"${line}" is not prebaked — key: ${key}`)
  }
})

test('MemoryGame.tsx composes no spoken line inline', () => {
  const src = readFileSync(new URL('../components/learning/MemoryGame.tsx', import.meta.url), 'utf8')
  // Comments FIRST (CLAUDE.md): this file's own explanation of the incident quotes the Danish lines,
  // and a guard that greps raw source would match its own documentation and fail forever.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const inline = code.match(/instructions:\s*['"`]/g)
  assert.equal(
    inline,
    null,
    'MemoryGame.tsx assigns `instructions:` a string literal — spoken lines must come from ' +
      'src/config/gamePhrases.ts so shared-narration-clips.js can enumerate and prebake them',
  )
  // …and it does pass the constants, so the guard above is not passing because the field vanished.
  assert.match(code, /instructions:\s*MEMORY_LETTERS_INSTRUCTION/)
  assert.match(code, /instructions:\s*MEMORY_NUMBERS_INSTRUCTION/)
})
