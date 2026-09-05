import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { LEXICON_FILE } from '../../shared-tts-config.js'

// The lexicon filename is VERSIONED, and this is what stops the version drifting from the file.
//
// THE INCIDENT (2026-09-05). `vercel.json` serves the lexicon with `Cache-Control: max-age=86400`,
// and Azure fetches it by URL, caching per PATH and ignoring the query string — `?v=<now>` does not
// bust it, measured. So editing the file in place left Azure reading a day-stale copy, silently: the
// SSML was valid, synthesis succeeded, and the old pronunciation simply came back. It produced a
// half-applied prebake (16 of 125 clips took the new `fire` pronunciation, 109 kept the old — only
// the Azure nodes with no cached copy fetched the new file), which is worse than either end state.
//
// Five probe files carrying the IDENTICAL IPA, served from fresh paths, all applied instantly. That
// is what isolated the cache from the lexeme, and why the rule is now "change the file, change the
// name" — the same discipline as a content-hashed asset.

test('the versioned lexicon file named by LEXICON_FILE exists, and is the only .pls shipped', () => {
  assert.ok(existsSync(`public/${LEXICON_FILE}`), `public/${LEXICON_FILE} is missing`)
  // Exactly one, so an old copy left behind cannot keep serving a stale path that something still
  // points at — and so the probe files from the investigation cannot be shipped by accident.
  const pls = readdirSync('public').filter((f) => f.endsWith('.pls'))
  assert.deepEqual(pls, [LEXICON_FILE], `expected only ${LEXICON_FILE} in public/, found ${pls.join(', ')}`)
})

test('the filename carries a version, so it can be bumped', () => {
  // A bare `da-DK.pls` is the shape that caused the incident: a mutable URL behind a 24h max-age.
  assert.match(LEXICON_FILE, /-v\d+\.pls$/, 'LEXICON_FILE must end in -v<N>.pls so a change can rename it')
})

test('nothing hardcodes the lexicon filename any more', () => {
  // One constant, or the next bump updates five of six call sites and the sixth serves a stale file.
  const files = [
    'shared-azure-tts.js', 'prebake-tts.mjs', 'scripts/lexicon-check.mjs',
    'scripts/audition-fire.mjs', 'scripts/audition-homographs.mjs',
  ]
  for (const f of files) {
    const code = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    assert.equal(/['"`][^'"`]*da-DK[^'"`]*\.pls/.test(code), false,
      `${f} hardcodes a .pls filename — import LEXICON_FILE instead`)
  }
})

test('vercel.json caches the lexicon under its VERSIONED path', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'))
  const rule = (v.headers || []).find((h) => String(h.source).endsWith('.pls'))
  assert.ok(rule, 'no Cache-Control rule for the lexicon')
  assert.equal(rule.source, `/${LEXICON_FILE}`,
    'the cache header points at a different path than LEXICON_FILE — the long max-age would apply to nothing')
})
