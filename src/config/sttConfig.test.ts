import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The recognizer config is the whole quality of Sig et Ord, and it lives in TWO files that must agree
// (api/stt.ts ships; dev-server.js is the local mirror — see `.claude/rules/api-endpoints.md`). Nothing
// type-checks either one against the other, and a drift is invisible: the game just starts mishearing.
//
// Owner question, 2026-08-04: "I want to be sure the word recognized is against danish." These are the
// assertions that make that answerable without reading two files by hand.

// Strip comments first: the rationale for every value below is written in a comment right beside it, so
// a naive `includes` would be satisfied by the prose explaining the setting rather than the setting.
// LINE comments only, deliberately. A `/* … */` strip looks safer and is not: `dev-server.js` contains
// route globs like `'/api/*splat'`, so a non-greedy block match starts at that `/*` and runs to the next
// real `*/` — it silently deleted the whole STT handler and every assertion below reported "found 0",
// which reads as the config being wrong rather than the guard being broken.
const codeOf = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n')

const SERVER = 'api/stt.ts'
const MIRROR = 'dev-server.js'

test('recognition is pinned to Danish in both the function and the dev mirror', () => {
  for (const file of [SERVER, MIRROR]) {
    const code = codeOf(file)
    const matches = [...code.matchAll(/languageCodes:\s*\[([^\]]*)\]/g)]
    assert.equal(matches.length, 1, `${file}: expected exactly one languageCodes, found ${matches.length}`)
    assert.equal(matches[0][1].replace(/['"\s]/g, ''), 'da-DK', `${file}: languageCodes is not exactly da-DK`)
  }
})

test('both use the same recognizer model, and it is the one that can hear a single word', () => {
  // `short` returns ZERO results for an isolated Danish word (measured: 0-1 of 16 words, while a full
  // sentence from the same voice transcribed at 0.94). `chirp_3` hears them. If someone reverts this to
  // `short`, the game silently goes back to "det hørte jeg ikke helt" on every attempt.
  for (const file of [SERVER, MIRROR]) {
    const code = codeOf(file)
    assert.match(code, /STT_MODEL\s*=\s*'chirp_3'/, `${file}: primary model is not chirp_3`)
    assert.match(code, /STT_MODEL_FALLBACK\s*=\s*'short'/, `${file}: no fallback model`)
    // The fallback must only be reachable from a MODEL-availability error, never as a silent default.
    assert.match(code, /recognizeWith\(STT_MODEL\)/, `${file}: does not call the primary model`)
  }
})

test('the region keeps recognition inside the EU', () => {
  // chirp_3 exists in the `eu` multi-region; chirp/chirp_2 do not (they need europe-west4). Child audio
  // must not leave the EU, so the location and the endpoint have to stay in step.
  for (const file of [SERVER, MIRROR]) {
    const code = codeOf(file)
    assert.match(code, /STT_LOCATION\s*=\s*'eu'/, `${file}: recognizer location is not eu`)
    assert.match(code, /STT_API_ENDPOINT\s*=\s*'eu-speech\.googleapis\.com'/, `${file}: endpoint is not the EU one`)
  }
})

test('the child-safety filter is requested in both', () => {
  // MEASURED 2026-08-04: chirp_3 masks English profanity ("fuck" → "f***") but NOT Danish ("lort",
  // "idiot" came back in the clear). The flag is still requested; the real protection is the blocklist in
  // `normalizeSpokenWord`, guarded by spokenWordInput.test.ts. Both halves must exist.
  for (const file of [SERVER, MIRROR]) {
    assert.match(codeOf(file), /profanityFilter:\s*true/, `${file}: profanity filter not requested`)
  }
})
