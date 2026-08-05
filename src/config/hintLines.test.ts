// The never-fail hint's spoken lines (Practice Loop PRD-01 W3 §5.3).
//
// Two things are guarded, and the second is the one that keeps the feature honest: every line the hint
// can EVER speak is already prebaked, so a hint can never reach live Azure — an unauditioned ~1.1s Azure
// round trip paid at the one moment the child is already stuck. The table is read from the module the
// games read, never re-declared here (`adultSettingsIa`'s lesson: a hardcoded duplicate lets the guard
// pass against a value nothing renders).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HINT_LINES, alphabetHintLine, hintSpecFor, spellingHintLine } from './hintLines.ts'
import { PREBAKED_TTS } from './prebakedTts.ts'
import { TTS_CONFIG } from './tts-config.ts'
import { WORD_LETTERS } from './letterWords.ts'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * File contents with block and line comments removed, so prose can never satisfy an assertion — and with
 * line endings NORMALISED, because every source file here is CRLF and a multi-line anchor written with
 * `\n` therefore never matches (the same trap that silently skipped 5 of 22 re-break mutations once).
 */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const SECTIONS = ['alphabet', 'math', 'farver', 'english', 'ordleg']
const sectionFiles = (): string[] =>
  SECTIONS.flatMap((dir) =>
    readdirSync(path.join(SRC, 'components', dir))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => `components/${dir}/${f}`),
  )

test('EVERY hint line is already prebaked — a hint never reaches live Azure', () => {
  // THE assertion of W3. Built from the same `TTS_CONFIG` the prebake script keys on (see
  // `shared-tts-key.js`), so a voice/rate change fails here instead of silently un-baking every hint.
  const keyFor = (text: string, voice: 'da' | 'en'): string => {
    const v = voice === 'en' ? TTS_CONFIG.voices.english : TTS_CONFIG.voices.primary
    const lex = voice === 'en' ? 0 : 1
    return `azure|${v.name}|${v.lang}|r${TTS_CONFIG.speakingRate}|lex${lex}|${text}`
  }

  let checked = 0
  for (const [gameId, spec] of Object.entries(HINT_LINES)) {
    const lines = spec.lines()
    if (spec.voice === null) {
      assert.equal(lines.length, 0, `${gameId} is silent but declares lines`)
      // A silent hint has to say WHY, or the next session reads it as an oversight and "fixes" it.
      assert.ok((spec.reason ?? '').length > 40, `${gameId} is silent with no real reason`)
      continue
    }
    assert.ok(lines.length > 0, `${gameId} speaks, but declares no lines to check`)
    for (const line of lines) {
      assert.ok(line.length > 0, `${gameId} would speak an empty line`)
      assert.ok(
        PREBAKED_TTS[keyFor(line, spec.voice)],
        `${gameId}'s hint line is NOT prebaked: ${JSON.stringify(line)} (${spec.voice})`,
      )
      checked++
    }
  }
  // Pinned as a literal so a table that silently stops enumerating (a `lines()` returning []) fails.
  // Hvilken Farve? went 24 → 18 with Difficulty PRD-02: its `reveal` axis is gone, so the six
  // non-canonical objects are askable at no level and can never be the answer a hint names.
  assert.equal(checked, 28 + 100 + 109 + 74 + 74 + 18 + 22, `checked ${checked} hint lines`)
})

test('the lines are the SAME builders the app speaks, not lookalikes', () => {
  // The value, spelled out. `alphabetHintLine` produces the identical sentence Bogstav Quiz's
  // correct-answer fact has always spoken — that reuse is the whole reason W3 costs no narration.
  assert.equal(alphabetHintLine('A'), 'Abe starter med A')
  assert.equal(alphabetHintLine('W'), 'Wienerbrød starter med W')
  // Stav Ordet says the letter NAME (see the builder's doc comment for why not "K som Kat").
  assert.equal(spellingHintLine('K'), 'k')
  assert.equal(spellingHintLine('X'), 'eks')
  // The alphabet table covers every askable letter, not a sample.
  assert.equal(HINT_LINES['alphabet.quiz'].lines().length, WORD_LETTERS.length)
})

test('every game with a never-fail hint has a decision in the table', () => {
  // Derived from the COMPONENTS, so a new game with a hint cannot quietly have no entry. Two markers:
  // the engine's `hintAfterNWrong` config field, and the shared `useNeverFailHint` hook in a hand-rolled
  // game.
  const missing: string[] = []
  for (const rel of sectionFiles()) {
    const code = codeOf(rel)
    if (!/hintAfterNWrong|useNeverFailHint/.test(code)) continue
    // Any `'<section>.<game>'` literal in the file, not just a `gameId:` property — MathOperationGame
    // serves TWO games and picks its id with a ternary (`isAddition ? 'math.addition' : …`), which a
    // property-shaped pattern misses entirely. (Found by /re-break: the file reported "no gameId".)
    const ids = [...code.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1]).filter((id) => hintSpecFor(id) || /^(alphabet|math|colors|english|ordleg|memory)\./.test(id))
    if (ids.length === 0) {
      missing.push(`${rel} (no gameId found)`)
      continue
    }
    if (!ids.some((id) => hintSpecFor(id) !== null)) missing.push(`${rel} → ${ids.join('/')}`)
  }
  assert.deepEqual(missing, [], `these games have a hint but no entry in HINT_LINES: ${missing.join(', ')}`)

  // …and nothing stale: every entry names a game that still has a hint.
  const allCode = sectionFiles().map(codeOf).join('\n')
  for (const gameId of Object.keys(HINT_LINES)) {
    assert.ok(allCode.includes(`'${gameId}'`), `HINT_LINES lists ${gameId}, which no component names`)
  }
})

test('the hint SPEAKS — the engine calls it, and each game supplies its line', () => {
  // The table being right is not the games USING it. Deleting one `speakHint` reverts that game to a
  // silent pointer with every data assertion above still green.
  const engine = codeOf('components/common/UnifiedQuizGame.tsx')
  assert.match(
    engine,
    /if \(registerHintWrong\(\)\) \{[\s\S]*?config\.speakHint\(currentItem, audio\)/,
    'the engine must speak the hint from the hint branch, with the CURRENT item',
  )
  // Never the tapped tile: the point is naming the ANSWER, to the child who just got it wrong.
  assert.doesNotMatch(engine, /speakHint\(selectedItem/, 'the engine speaks the TAPPED tile as the hint')
  // Fire-and-forget: awaiting narration in a tap handler is the measured 4s-dead-tile bug.
  assert.match(engine, /void config\.speakHint\(/, 'the hint narration must not be awaited')

  const SPEAKERS: Record<string, RegExp> = {
    'components/alphabet/AlphabetGame.tsx': /speakHint:[\s\S]{0,120}alphabetHintLine\(/,
    'components/math/MathGame.tsx': /speakHint:[\s\S]{0,120}numberHintLine\(/,
    // The identical function as its correct-answer fact — not a copy, so the two can never drift.
    'components/math/HvadManglerGame.tsx': /speakCorrectFact: sequenceFact,[\s\S]*?speakHint: sequenceFact,/,
    'components/english/EnglishListenGame.tsx': /speakHint:[\s\S]{0,160}speakEnglish\(englishHintLine\(/,
    'components/english/EnglishWordGame.tsx': /speakHint:[\s\S]{0,160}speakEnglish\(englishHintLine\(/,
  }
  for (const [rel, pattern] of Object.entries(SPEAKERS)) {
    assert.match(codeOf(rel), pattern, `${rel} no longer speaks its hint line`)
  }

  // The two hand-rolled games speak from INSIDE the branch where the hint trips — not on every wrong
  // drop, which would turn identification into nagging. Sliced by the branch's own closing brace rather
  // than matched with `[\s\S]*?`: found by /re-break, a lazy match happily crossed OUT of the branch and
  // the guard stayed green against a speak-on-every-wrong-drop mutation.
  const hintBranchOf = (rel: string, opener: string): string => {
    const code = codeOf(rel)
    const at = code.indexOf(opener)
    assert.ok(at > 0, `${rel}: could not find its hint branch (${opener}) — re-point this guard`)
    const end = code.indexOf('\n      }', at)
    assert.ok(end > at, `${rel}: could not find the end of its hint branch`)
    return code.slice(at, end)
  }
  assert.ok(
    hintBranchOf('components/farver/FarveQuizGame.tsx', 'registerHintWrong(() => current.color)) {')
      .includes('colorObjectFactText('),
    'Hvilken Farve must name the colour from inside the hint branch',
  )
  assert.ok(
    hintBranchOf('components/ordleg/SpellingGame.tsx', 'if (\n        registerHintWrong(')
      .includes('spellingHintLine('),
    'Stav Ordet must speak the letter from inside the hint branch',
  )

  // Læs Ordet stays SILENT, and that is a content fact — its prompt word must never be read aloud.
  const laes = codeOf('components/ordleg/LaesOrdetGame.tsx')
  assert.ok(!laes.includes('speakHint'), 'Læs Ordet must not speak a hint — silent decoding IS the exercise')
})
