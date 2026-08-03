import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COLORS_QUIZ_ROUND,
  DANISH_OBJECTS,
  HUE_ORDER,
  quizObjectPool,
} from './colorContent.ts'
import { COLORS_QUIZ, LEVELS } from './difficulty.ts'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

// Hvilken Farve?'s content guard. The game's grey levels ask "hvilken farve er ræven?" with the
// object DESATURATED, so the answer no longer sits on the board — which turns the object pool into a
// correctness surface it never was before: a greyed car, shirt or crystal has no right answer at all,
// and this `hjerte` is authored lilla while any child would say rød. `canonical:false` marks those,
// and the whole point of the axis dies quietly if that filter is bypassed or the pool is whittled
// down below one round.

test('the grey pool holds every canonical object and nothing else', () => {
  const colour = quizObjectPool('colour')
  const grey = quizObjectPool('grey')

  // Pinned as literals, not as "colour.length - 6": the arithmetic moves with the content and would
  // pass just as happily against an empty pool.
  assert.equal(colour.length, 24)
  assert.equal(grey.length, 18)

  // Grey is a strict subset — it may only ever REMOVE risk, never introduce an object colour mode
  // would refuse.
  const colourKeys = new Set(colour.map((o) => `${o.color}-${o.objectName}`))
  for (const o of grey) assert.ok(colourKeys.has(`${o.color}-${o.objectName}`), `${o.objectName} is grey-only`)

  // The six by name, so flipping one back on is a deliberate, visible edit.
  const greyNames = new Set(grey.map((o) => o.objectName))
  const dropped = colour.map((o) => o.objectName).filter((n) => !greyNames.has(n))
  assert.deepEqual(dropped.sort(), ['bil', 'hjerte', 'krystal', 'lastbil', 'rose', 'skjorte'])
})

test('every hue stays askable in grey mode, at or above one full round', () => {
  const grey = quizObjectPool('grey')

  // Guarded against the REAL round constant (which the game reads too), never a magic floor — the
  // guard that was meant to protect Læs Ordet asked for `>= 4` and passed the exact 5-word bug it
  // existed to catch.
  assert.ok(
    grey.length >= COLORS_QUIZ_ROUND,
    `grey pool ${grey.length} < round length ${COLORS_QUIZ_ROUND}`,
  )

  // A hue with no canonical object silently stops being an ANSWER while still appearing as a
  // distractor. Counts pinned: rød/blå/lilla sit at the floor of 2, so any further trim is a bug and
  // new canonical art for them is the fix.
  const perHue = Object.fromEntries(
    HUE_ORDER.map((hue) => [hue, grey.filter((o) => o.color === hue).length]),
  )
  assert.deepEqual(perHue, { rød: 2, blå: 2, grøn: 4, gul: 4, lilla: 2, orange: 4 })
})

test('only the easiest level may show the object in its true colour', () => {
  // 'colour' puts the answer on the board: the fox is orange, and so is one of the swatches. That is
  // a pixel match, not a colour question, and it is deliberately confined to Let.
  assert.equal(COLORS_QUIZ.let.reveal, 'colour')
  for (const level of LEVELS.filter((l) => l !== 'let')) {
    assert.equal(COLORS_QUIZ[level].reveal, 'grey', `${level} must grey the object out`)
  }
})

test('the game actually greys the object it asks about — and only that one', () => {
  // Read as SOURCE (comments stripped): every test above proves the DATA and the TABLE are right,
  // which is exactly the audit CLAUDE.md calls the cheap one. Tal Quiz passed every plumbing check
  // while 60% of its Let questions were broken. Delete the one `desaturate` prop and this whole
  // feature silently reverts to the pixel match with all three tables still perfect.
  const code = codeOf('components/farver/FarveQuizGame.tsx')

  // The pool must be derived from the level's reveal mode, not a module-level all-objects array.
  assert.match(code, /quizObjectPool\(reveal\)/)
  assert.match(code, /reveal\s*}\s*=\s*COLORS_QUIZ\[/)

  // EXACTLY ONE desaturate site. Zero = the wiring is gone; two = the copy that lands in the swatch
  // is greyed too, which kills the colour-returns reveal that carries the lesson.
  assert.equal((code.match(/desaturate=/g) ?? []).length, 1)
  assert.match(code, /desaturate=\{greyObject\}/)
})

test('a canonical flag only ever narrows a quiz-safe object', () => {
  // `quizSafe:false` (the picture contradicts its own colour) and `canonical:false` (the colour is a
  // property of this picture, not of the world) are independent axes; nothing may be flagged
  // canonical-true-by-omission while being quiz-unsafe and thus unreachable in either mode.
  for (const [hue, objects] of Object.entries(DANISH_OBJECTS)) {
    assert.ok(objects.length > 0, `${hue} has no objects`)
    for (const o of objects) {
      assert.ok(o.art.length > 0, `${o.objectName} has no art id`)
      assert.ok(
        o.quizSafe !== false || o.canonical === undefined,
        `${o.objectName}: quizSafe:false already excludes it — the canonical flag is dead weight`,
      )
    }
  }
})
