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
import { colorQuizPromptPool } from './promptPools.ts'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

// Hvilken Farve?'s content guard. The game asks "hvilken farve er ræven?" with the object DESATURATED
// at EVERY level (Difficulty PRD-02 — the old `reveal` axis is deleted, not narrowed), so the answer
// never sits on the board — which makes the object pool a correctness surface: a greyed car, shirt or
// crystal has no right answer at all, and this `hjerte` is authored lilla while any child would say
// rød. `canonical:false` marks those and they are askable nowhere. `obvious:false` is the second,
// independent flag — a real colour that is merely not unambiguous at 5 (a cob reads yellow-and-green)
// — and it is one of the four axes Let is now eased on. Both die quietly if a filter is bypassed or a
// pool is whittled below one round.

test('the two pools hold exactly the objects they should', () => {
  const all = quizObjectPool('all')
  const obvious = quizObjectPool('obvious')
  const everything = Object.values(DANISH_OBJECTS).flat()

  // Pinned as literals, not as "everything.length - 6": the arithmetic moves with the content and
  // would pass just as happily against an empty pool.
  assert.equal(everything.length, 24)
  assert.equal(all.length, 18)
  assert.equal(obvious.length, 12)

  // Let's pool is a strict subset — it may only ever REMOVE risk, never introduce an object the
  // higher levels refuse.
  const allKeys = new Set(all.map((o) => `${o.color}-${o.objectName}`))
  for (const o of obvious) {
    assert.ok(allKeys.has(`${o.color}-${o.objectName}`), `${o.objectName} is Let-only`)
  }

  // The six non-canonical ones by name — askable at NO level now, so flipping one back on is a
  // deliberate, visible edit.
  const askableNames = new Set(all.map((o) => o.objectName))
  const neverAskable = everything.map((o) => o.objectName).filter((n) => !askableNames.has(n))
  assert.deepEqual(neverAskable.sort(), ['bil', 'hjerte', 'krystal', 'lastbil', 'rose', 'skjorte'])

  // …and the six held back from Let by name, for the same reason. This list is the owner-approved
  // judgement call about a Danish 5-year-old (PRD-02 §W2) and the first lever to adjust after a
  // play-test — which is exactly why it may not move silently.
  const obviousNames = new Set(obvious.map((o) => o.objectName))
  const heldBackFromLet = all.map((o) => o.objectName).filter((n) => !obviousNames.has(n))
  assert.deepEqual(heldBackFromLet.sort(), [
    'aubergine', 'græskar', 'hval', 'kløver', 'majs', 'skildpadde',
  ])
})

test('every hue stays askable in BOTH pools, at or above one full round', () => {
  const all = quizObjectPool('all')
  const obvious = quizObjectPool('obvious')

  // Guarded against the REAL round constant (which the game reads too), never a magic floor — the
  // guard that was meant to protect Læs Ordet asked for `>= 4` and passed the exact 5-word bug it
  // existed to catch. BOTH pools, because Let asks from the smaller one now.
  for (const [name, pool] of [['all', all], ['obvious', obvious]] as const) {
    assert.ok(
      pool.length >= COLORS_QUIZ_ROUND,
      `${name} pool ${pool.length} < round length ${COLORS_QUIZ_ROUND}`,
    )
  }

  // A hue with no object in a pool silently stops being an ANSWER at that level while still appearing
  // as a distractor. Counts pinned per pool: rød/blå/lilla sit at the floor of 2 in `all`, and blå/lilla
  // at a floor of 1 in `obvious` — any further trim there is a bug, and new canonical art is the fix.
  const perHue = (pool: typeof all) =>
    Object.fromEntries(HUE_ORDER.map((hue) => [hue, pool.filter((o) => o.color === hue).length]))
  assert.deepEqual(perHue(all), { rød: 2, blå: 2, grøn: 4, gul: 4, lilla: 2, orange: 4 })
  assert.deepEqual(perHue(obvious), { rød: 2, blå: 1, grøn: 2, gul: 3, lilla: 1, orange: 3 })
})

test('NO level may show the object in its true colour', () => {
  // The inverse of the test this replaces. Showing the object in colour puts the answer on the board:
  // the fox is orange, and so is one of the swatches — a pixel match, not a colour question. PRD-01
  // confined that to Let; the owner deleted the axis outright (2026-08-05), so re-adding it in any
  // form has to FAIL here rather than pass silently.
  for (const level of LEVELS) {
    assert.ok(!('reveal' in COLORS_QUIZ[level]), `${level} carries a reveal axis again`)
    const values: unknown[] = Object.values(COLORS_QUIZ[level])
    assert.ok(!values.includes('colour'), `${level} has a colour-reveal tuning value`)
  }
})

test('the game actually greys the object it asks about — and only that one', () => {
  // Read as SOURCE (comments stripped): every test above proves the DATA and the TABLE are right,
  // which is exactly the audit CLAUDE.md calls the cheap one. Tal Quiz passed every plumbing check
  // while 60% of its Let questions were broken. Delete the one `desaturate` prop and this whole
  // feature silently reverts to the pixel match with all three tables still perfect.
  const code = codeOf('components/farver/FarveQuizGame.tsx')

  // The pool must be derived from the level's POOL field, not a module-level all-objects array. Since
  // Practice Loop PRD-01 W1 the game reads it through `colorQuizPromptPool(level)` (so the prompt-bag
  // simulation can sample the same pool), so BOTH links of that chain are asserted — the component
  // calling it, and it still following `COLORS_QUIZ[level].pool`.
  assert.match(code, /colorQuizPromptPool\(level\)/)
  for (const level of LEVELS) {
    assert.deepEqual(
      colorQuizPromptPool(level),
      quizObjectPool(COLORS_QUIZ[level].pool),
      `colorQuizPromptPool(${level}) no longer follows the level's pool`,
    )
  }
  // …and the sizes pinned outright, so the two sides can't agree their way past a change (both call
  // the same function, so agreement alone is vacuous — CLAUDE.md's "pin the value itself").
  assert.equal(colorQuizPromptPool('let').length, 12)
  assert.equal(colorQuizPromptPool('normal').length, 18)
  assert.equal(colorQuizPromptPool('svaer').length, 18)

  // EXACTLY ONE desaturate site. Zero = the wiring is gone; two = the copy that lands in the swatch
  // is greyed too, which kills the colour-returns reveal that carries the lesson. And it must be the
  // BARE prop: an `=` means someone made it conditional on a level again, which is the exact defect
  // PRD-02 removed.
  assert.equal((code.match(/desaturate/g) ?? []).length, 1)
  assert.doesNotMatch(code, /desaturate\s*=/)

  // The hint threshold is per-level now (Let names the colour after ONE wrong drop), and the old
  // module constant must be gone rather than shadowing it.
  assert.match(code, /useNeverFailHint<string>\(\s*COLORS_QUIZ\[difficultyLevel\]\.hintAfter\s*\)/)
  assert.doesNotMatch(code, /WRONG_BEFORE_HINT/)
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
