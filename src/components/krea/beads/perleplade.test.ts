import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Krea PRD-02 §7 — the wiring guards a pure test can't see. They read source, so comments are stripped
// first (the "why" comment beside each rule names the very thing it forbids).

const code = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const game = code('../PerlepladeGame.tsx')

/** The body of `const name = (...) => { … }`, by brace matching — a regex can't see block structure. */
function body(src: string, name: string): string {
  const at = src.indexOf(`const ${name} = `)
  assert.ok(at >= 0, `could not find ${name} — re-point this guard`)
  const open = src.indexOf('{', src.indexOf('=>', at))
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
  }
  throw new Error(`unbalanced ${name}`)
}

test('placeBead is the single resolver: one call, and both gestures reach it through resolve()', () => {
  assert.equal((game.match(/\bplaceBead\(/g) ?? []).length, 1, 'placeBead is called exactly once in the game')
  assert.match(body(game, 'resolve'), /placeBead\(base, colour, peg\)/)
  // The tap path and the drag path both land a bead through resolve(), never on their own.
  assert.match(body(game, 'tapAt'), /resolve\(b, held, peg\)/)
  assert.match(body(game, 'onDragEnd'), /resolve\(b, g\.colour, peg\)/)
  assert.match(body(game, 'onDragEnd'), /resolve\(lifted, g\.colour, peg\)/)
  // …and nothing in the component writes a bead onto the board by hand.
  assert.doesNotMatch(game, /beads\s*:/, 'a board built in the component bypasses the resolver')
  assert.doesNotMatch(game, /\.beads\[[^\]]+\]\s*=(?!=)/, 'a bead written straight onto the board')
  assert.doesNotMatch(game, /\.beads\.slice\(/, 'a copy of the beads edited in the component')
})

// A finished PATTERN earns one task; the FREE BOARD earns nothing and has no finish (owner, 2026-10-16;
// Lepper 1973). One completeTask, inside onDone, behind the pattern-only gate — so no free-board path can
// reach it — and the done button only renders for the 'finished' stage, which a free board never reaches.
test('only a finished pattern earns, once; the free board earns nothing and has no finish', () => {
  assert.match(game, /useTaskRun\(\{ tasksInRound: KREA_TASKS_IN_ROUND, gameId: GAME_ID \}\)/)
  assert.equal((game.match(/completeTask\(/g) ?? []).length, 1, 'one task per finished piece')
  const done = body(game, 'onDone')
  assert.match(done, /if \(item\?\.kind !== 'pattern' \|\| stage !== 'finished'\) return/)
  assert.match(done, /run\.completeTask\(true\)/)
  assert.doesNotMatch(game, /grantTaskXp|useBrowseXp/)
  // A free board can never be `finished`: isComplete is false for it by construction (beadBoard.test).
  assert.match(game, /const stage: Stage = !complete \? 'building'/)
})

test('the drag games’ shared primitives: kidCollision, drag-only sensors, one droppable board', () => {
  assert.match(game, /collisionDetection=\{kidCollision\}/)
  assert.match(game, /sensors=\{sensors\}/)
  assert.doesNotMatch(game, /closestCenter/)
  const board = code('./Pegboard.tsx')
  assert.equal((board.match(/useDroppable\(/g) ?? []).length, 1, 'ONE droppable for the whole board (§4.1)')
  assert.doesNotMatch(board, /\.map\([^)]*\)[\s\S]{0,200}useDroppable/, 'a droppable per peg')
})

// WebKit-only defect, measured 2026-10-16: an identity transform on the bowl cell (an ANCESTOR of its
// DraggableItem) made dnd-kit's drag offset drift from the finger, so a dragged bead never landed.
test('nothing that transforms is an ancestor of a bowl’s draggable', () => {
  const bowls = code('./BeadBowls.tsx')
  const cell = bowls.slice(bowls.indexOf('data-krea-bowl={c}'), bowls.indexOf('data-krea-bowl-look'))
  assert.ok(cell.length > 0, 'could not find the bowl cell — re-point this guard')
  assert.doesNotMatch(cell, /transform|filter|scale/)
})
