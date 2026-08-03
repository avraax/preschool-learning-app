import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DRAG_ACTIVATION_DISTANCE } from './dragActivation.ts'

// Every game that can answer by drag must ALSO answer by tap, and vice versa (owner, 2026-08-03: the
// Farver games accepted a drag and ignored a tap, and a 5-year-old taps). These are source-read guards
// because the invariant is wiring, not a value — a data test cannot see whether a component uses the
// primitive (game-development.md, "the wiring needs its own guard"). Comments are stripped first: every
// rule below is also explained in a comment beside the code, so a plain `includes()` would be satisfied
// by the prose and stay green after the fix was deleted.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\/[^\n]*\n/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1')

const codeOf = (rel: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))

test('the drag threshold is ONE constant, shared by the sensor and the tap test', () => {
  const sensor = codeOf('./useDragOnlySensors.ts')
  assert.ok(
    sensor.includes('DRAG_ACTIVATION_DISTANCE'),
    'the sensor no longer reads the shared threshold',
  )
  // A second, independent number is the bug this sharing prevents: a gesture between the two values is
  // BOTH a drag and a tap, and answers twice.
  assert.ok(
    !/activationConstraint:\s*\{\s*distance:\s*\d/.test(sensor),
    'the sensor has a hardcoded distance again — it can now drift from useTapActivate',
  )
  assert.equal(typeof DRAG_ACTIVATION_DISTANCE, 'number')
  assert.ok(DRAG_ACTIVATION_DISTANCE > 0)
})

test('useTapActivate measures the SAME threshold, and guards the trailing click of a drag', () => {
  const src = codeOf('./dragActivation.ts')
  assert.ok(src.includes('DRAG_ACTIVATION_DISTANCE'), 'the tap test no longer uses the shared threshold')
  // The capture-phase guard is what stops a drag's trailing click reaching a child that owns the tap
  // (AnswerTile / TactileTile buttons). See the doc comment on it for what desktop Chrome covers already.
  assert.ok(src.includes('onClickCapture'), 'the trailing-click guard is gone')
  assert.ok(/stopPropagation/.test(src), 'the trailing-click guard no longer blocks anything')
})

test('DraggableItem composes dnd-kit\'s pointerdown instead of replacing it', () => {
  const src = codeOf('./DraggableItem.tsx')
  // Spreading `listeners` and THEN setting onPointerDown drops dnd-kit's own listener and silently kills
  // dragging — the tap would work and the drag would not, with nothing failing.
  assert.ok(
    /listeners as any\)?\?\.\.?onPointerDown|listeners\)?\?\.onPointerDown/.test(src),
    'DraggableItem no longer calls dnd-kit\'s onPointerDown — dragging is dead',
  )
  assert.ok(src.includes('onClickCapture'), 'DraggableItem no longer installs the trailing-click guard')
})

// Per game: the OTHER gesture's wiring. Each entry names what would be missing if someone removed the
// second gesture from that game. The drag games answer on the primitive's `onActivate`; the tap games
// answer through their own DndContext + drop zone.
const WIRING: Array<{ file: string; needs: string[] }> = [
  { file: '../../farver/FarvejagtGame.tsx', needs: ['onActivate={() => resolveItem(', 'resolveItem('] },
  { file: '../../farver/RamFarvenGame.tsx', needs: ['onActivate={() => resolveDroplet(', 'resolveDroplet('] },
  { file: '../../farver/FarveQuizGame.tsx', needs: ['onActivate={() => resolveColor(', 'resolveColor('] },
  { file: '../../farver/NuancerGame.tsx', needs: ['onActivate={() => tapShade(', 'resolveShade('] },
  { file: '../../ordleg/SpellingGame.tsx', needs: ['DndContext', 'DroppableZone', 'DraggableItem', 'handleTileClick(tile, true)'] },
  { file: '../../math/MathOperationGame.tsx', needs: ['DndContext', 'DroppableZone', 'DraggableItem', "over.id !== 'answer-slot'"] },
  { file: '../../math/HvadManglerGame.tsx', needs: ['dragToPromptSlot: true', 'QUIZ_PROMPT_SLOT_ID'] },
]

for (const { file, needs } of WIRING) {
  const name = file.split('/').pop()
  test(`${name} wires BOTH gestures`, () => {
    const src = codeOf(file)
    for (const needle of needs) {
      assert.ok(src.includes(needle), `${name} is missing \`${needle}\` — one of its two gestures is gone`)
    }
  })
}

test('a drop and a tap share ONE resolution path per game (no second scoring route)', () => {
  // Each game's drag-end must delegate to the same function the tap calls, rather than re-implementing
  // score/first-try/advance-lock. Cardinality matters, and these are arrow-function declarations
  // (`const resolveX = (…) =>`, which does not match the `resolveX(` needle) so the count is CALL sites
  // only: exactly two — the drop and the tap. Three would mean a third, unreviewed way to answer.
  const cases: Array<[string, string, number]> = [
    ['../../farver/FarvejagtGame.tsx', 'resolveItem(', 2],
    ['../../farver/RamFarvenGame.tsx', 'resolveDroplet(', 2],
    ['../../farver/FarveQuizGame.tsx', 'resolveColor(', 2],
    ['../../farver/NuancerGame.tsx', 'resolveShade(', 2],
  ]
  for (const [file, fn, expected] of cases) {
    const src = codeOf(file)
    const hits = src.split(fn).length - 1
    assert.equal(
      hits,
      expected,
      `${file.split('/').pop()}: expected ${expected} \`${fn}\` call sites (the drop and the tap), found ${hits}`,
    )
  }
})

test('the shared quiz engine mounts NO drag machinery unless a config opts in', () => {
  const src = codeOf('../UnifiedQuizGame.tsx')
  // The four tap-only quizzes must not gain a DndContext, so the opt-in has to gate the wrapper.
  assert.ok(
    /if \(!config\.dragToPromptSlot\) return board/.test(src),
    'the engine now wraps every quiz in a DndContext — the tap-only quizzes are no longer inert',
  )
  assert.ok(
    /enabled=\{config\.dragToPromptSlot === true\}/.test(src),
    'answer tiles are no longer conditionally draggable',
  )
})
