import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COLORS_QUIZ_ROUND,
  DANISH_OBJECTS,
  HUE_ORDER,
  MIN_SHADE_STEP,
  SHADES,
  SHADE_RAMPS,
  TARGETS_PER_BOARD,
  nuancerCombos,
  oklabL,
  quizObjectPool,
} from './colorContent.ts'
import { COLORS_NUANCER, COLORS_QUIZ, LEVELS } from './difficulty.ts'
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
  assert.equal(everything.length, 34)
  assert.equal(all.length, 19)
  assert.equal(obvious.length, 13)

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
  assert.deepEqual(neverAskable.sort(), [
    'ballon', 'bil', 'bil', 'blomst', 'fisk', 'fisk', 'fugl', 'hjerte', 'kop', 'krystal', 'lastbil',
    'rose', 'skjorte', 'sko', 'stjerne',
  ])

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
  assert.deepEqual(perHue(all), { rød: 2, blå: 2, grøn: 4, gul: 5, lilla: 2, orange: 4 })
  assert.deepEqual(perHue(obvious), { rød: 2, blå: 1, grøn: 2, gul: 4, lilla: 1, orange: 3 })
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
  assert.equal(colorQuizPromptPool('let').length, 13)
  assert.equal(colorQuizPromptPool('normal').length, 19)
  assert.equal(colorQuizPromptPool('svaer').length, 19)

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

// ---- Game Depth PRD-01 §3.1 -------------------------------------------------------------------------

test('every object art id exists as a WebP on disk — data must never outrun the art', () => {
  // colorContent.ts is Node-pure and cannot see Vite's glob, so an entry whose file hasn't landed would
  // render an EMPTY object on the board while its fact line still bakes (PRD §4 trap 9).
  const dir = path.join(SRC, 'assets/games/farver')
  for (const [hue, objects] of Object.entries(DANISH_OBJECTS)) {
    for (const o of objects) {
      assert.ok(existsSync(path.join(dir, `${o.art}.webp`)), `${hue}/${o.objectName}: ${o.art}.webp missing`)
    }
  }
  const arts = Object.values(DANISH_OBJECTS).flat().map((o) => o.art)
  assert.equal(new Set(arts).size, arts.length, 'art ids must be unique — the Farvejagt bag keys on them')
})

test('Lær Farver keeps its first four examples per hue (the arrays are APPEND-only)', () => {
  // FarverLearning shows DANISH_OBJECTS[hue].slice(0, 4), so inserting before them silently changes
  // the browse. Pinned by art id.
  const firstFour = Object.fromEntries(
    HUE_ORDER.map((h) => [h, DANISH_OBJECTS[h].slice(0, 4).map((o) => o.art).join(',')]),
  )
  assert.deepEqual(firstFour, {
    rød: 'apple,car,rose,strawberry',
    blå: 'whale,blueberry,truck,shirt',
    grøn: 'cucumber,turtle,clover,tree',
    gul: 'sun,banana,corn,chick',
    lilla: 'grapes,eggplant,crystal,heart',
    orange: 'orange_fruit,pumpkin,fox,carrot',
  })
  assert.match(codeOf('components/farver/FarverLearning.tsx'), /DANISH_OBJECTS\[currentHue\][^\n]*slice\(0, 4\)/)
})

test('Farvejagt deals a FIXED count of targets from a per-hue bag keyed by art', () => {
  assert.equal(TARGETS_PER_BOARD, 4)
  for (const hue of HUE_ORDER) {
    assert.ok(DANISH_OBJECTS[hue].length >= TARGETS_PER_BOARD, `${hue} cannot fill a board`)
  }
  const code = codeOf('components/farver/FarvejagtGame.tsx')
  assert.match(code, /makePromptBag\(targetObjects, \{ key: \(o\) => o\.art/)
  assert.match(code, /Math\.min\(TARGETS_PER_BOARD, targetObjects\.length\)/)
  // The old "take the whole hue" deal must be gone.
  assert.doesNotMatch(code, /shuffle\(targetObjects\)/)
  // EVERY phone (portrait too) runs the compact well: on a 375 px portrait board the iPad well's
  // keep-out covered the whole reachable x-band and Svær piled 14 objects onto it (2026-10-04).
  assert.match(code, /const metrics = phone \? PHONE_WELL : DESK_WELL/)
  assert.match(code, /useMediaQuery\(PHONE_ANY/)
  // …and a crowded board falls back to the best OFF-well candidate, never the last random try.
  assert.match(code, /if \(onWell\(p\) \|\| inMascotCorner\(p\)\) continue/)
})

// ---- Game Depth PRD-01 §3.2 — Nuancer's 5-step ramps --------------------------------------------------

test('each ramp keeps the three NAMED shades byte-identical at 0/2/4, midpoints unnamed', () => {
  for (const hue of HUE_ORDER) {
    const ramp = SHADE_RAMPS[hue]
    assert.equal(ramp.length, 5, `${hue} ramp`)
    assert.deepEqual(
      [ramp[0], ramp[2], ramp[4]].map((s) => [s.name, s.hex]),
      SHADES[hue].map((s) => [s.name, s.hex]),
      `${hue}: the named steps drifted from SHADES`,
    )
    assert.equal(ramp[1].name, undefined)
    assert.equal(ramp[3].name, undefined)
    assert.equal(new Set(ramp.map((s) => s.id)).size, 5, `${hue}: ids must be unique`)
  }
  // The pinned literal for one hue, so the midpoint maths can't be silently recomputed differently.
  assert.deepEqual(SHADE_RAMPS.rød.map((s) => s.hex), ['#FCA5A5', '#F77976', '#EF4444', '#C3302F', '#991B1B'])
})

test('every ramp gets strictly darker, and nothing dealt is too close to read apart', () => {
  for (const hue of HUE_ORDER) {
    const L = SHADE_RAMPS[hue].map((s) => oklabL(s.hex))
    for (let i = 1; i < L.length; i++) assert.ok(L[i] < L[i - 1], `${hue}: step ${i} is not darker`)
    for (const level of LEVELS) {
      const { slots, minSpan } = COLORS_NUANCER[level]
      for (const combo of nuancerCombos(hue, slots, minSpan)) {
        for (let i = 1; i < combo.length; i++) {
          assert.ok(L[combo[i - 1]] - L[combo[i]] >= MIN_SHADE_STEP, `${hue} ${level} ${combo}: too close`)
        }
      }
    }
  }
  // The yellow midpoint sits 0.02 from both lysegul and gul — it must never be dealt beside them.
  assert.ok(!nuancerCombos('gul', 3, 2).some((c) => c.join('').includes('01') || c.join('').includes('12')))
})

test('Nuancer deals real variety at every level, and the levels stay distinct', () => {
  const count = (level: (typeof LEVELS)[number]) =>
    Object.fromEntries(
      HUE_ORDER.map((h) => [h, nuancerCombos(h, COLORS_NUANCER[level].slots, COLORS_NUANCER[level].minSpan).length]),
    )
  assert.deepEqual(count('let'), { rød: 3, blå: 3, grøn: 3, gul: 3, lilla: 3, orange: 3 })
  assert.deepEqual(count('normal'), { rød: 7, blå: 7, grøn: 7, gul: 4, lilla: 7, orange: 7 })
  assert.deepEqual(count('svaer'), { rød: 10, blå: 10, grøn: 10, gul: 5, lilla: 10, orange: 10 })
  // Let is spread far apart — never a span under 3.
  for (const h of HUE_ORDER) for (const c of nuancerCombos(h, 2, 3)) assert.ok(c[1] - c[0] >= 3)
  // Svær stays at 3 slots (phone portrait) — no level gains an element.
  assert.equal(COLORS_NUANCER.svaer.slots, 3)
})

test('Nuancer is keyed by shade id and speaks only a NAMED shade', () => {
  const code = codeOf('components/farver/NuancerGame.tsx')
  assert.match(code, /nuancerCombos\(hue, slotCount, minSpan\)/)
  assert.match(code, /shadeId === order\[i\]\.id/)
  assert.match(code, /if \(placedName\) audio\.speak\(placedName\)/)
  assert.doesNotMatch(code, /audio\.speak\(shadeId\)/)
  assert.doesNotMatch(code, /\bSHADES\b/)
})
