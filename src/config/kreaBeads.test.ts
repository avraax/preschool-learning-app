import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BEAD_BOARDS,
  BEAD_LAYOUT,
  BEAD_LEGEND,
  BEAD_PATTERNS,
  beadPalette,
  boardMask,
  boardPitch,
  boardSize,
  legendCounts,
  patternCells,
  type BeadLevel,
} from './kreaBeads.ts'
import { KREA_BEADS, LEVELS } from './difficulty.ts'

// Krea PRD-02 §4.4 + §4.2 — every guard on the hand-authored bead content. A typo in one row of a grid
// is the expected failure, so each test names the pattern, the level and the row it found.

test('v1 content: 8 patterns and 5 free boards, as decided (§2.9)', () => {
  assert.deepEqual(BEAD_PATTERNS.map((p) => p.id), ['hjerte', 'sommerfugl', 'fisk', 'blomst', 'stjerne', 'hus', 'kat', 'regnbue'])
  assert.deepEqual(BEAD_BOARDS.map((b) => b.id), ['firkant', 'cirkel', 'hjerte', 'stjerne', 'fisk'])
})

test('every grid and mask is exactly its level’s board, and every char is known', () => {
  for (const level of LEVELS) {
    const n = boardSize(level)
    for (const p of BEAD_PATTERNS) {
      const g = p.grids[level]
      assert.equal(g.length, n, `${p.id}/${level}: ${g.length} rows, board is ${n}`)
      g.forEach((row, r) => {
        assert.equal(row.length, n, `${p.id}/${level} row ${r}: "${row}" is ${row.length} wide`)
        for (const ch of row) assert.ok(ch === '.' || ch in BEAD_LEGEND, `${p.id}/${level} row ${r}: unknown "${ch}"`)
      })
    }
    for (const b of BEAD_BOARDS) {
      const m = b.masks[level]
      assert.equal(m.length, n, `${b.id}/${level}: ${m.length} rows`)
      m.forEach((row, r) => assert.match(row, new RegExp(`^[#.]{${n}}$`), `${b.id}/${level} row ${r}: "${row}"`))
      // A free board is a real place to play, not a sliver: at least 45% of its square has pegs (a star is the sparsest, ~49%).
      assert.ok(boardMask(b, level).filter(Boolean).length >= n * n * 0.45, `${b.id}/${level}: too few pegs`)
    }
  }
})

// Patterns sit on the square board, so "inside the mask" is "inside the board" — the shaped masks belong
// to the free boards. Pinned anyway against the board a pattern is played on, so a shaped pattern board
// later can't silently put a pattern bead on a peg that isn't there.
test('every pattern fits inside its level’s board mask', () => {
  const square = BEAD_BOARDS.find((b) => b.id === 'firkant')!
  for (const level of LEVELS) {
    const mask = boardMask(square, level)
    for (const p of BEAD_PATTERNS) {
      patternCells(p, level).forEach((c, i) => {
        if (c) assert.ok(mask[i], `${p.id}/${level}: bead at peg ${i} has no peg under it`)
      })
    }
  }
})

test('every pattern uses only its level’s palette', () => {
  for (const level of LEVELS) {
    const pal = new Set(beadPalette(level))
    for (const p of BEAD_PATTERNS) {
      for (const c of patternCells(p, level)) if (c) assert.ok(pal.has(c), `${p.id}/${level}: "${c}" is not on the ${pal.size}-crayon table`)
    }
  }
})

test('every legend count is between 1 and 100 — the prebaked bare-number range', () => {
  for (const level of LEVELS) {
    for (const p of BEAD_PATTERNS) {
      const counts = legendCounts(patternCells(p, level))
      assert.ok(counts.length >= 1, `${p.id}/${level}: empty pattern`)
      for (const [c, n] of counts) assert.ok(n >= 1 && n <= 100, `${p.id}/${level}: ${c} × ${n}`)
    }
  }
})

test('each pattern says exactly its describing line, and every line is enumerated for prebake', async () => {
  assert.deepEqual(BEAD_PATTERNS.map((p) => p.doneLine), [
    'Se, hjertet hopper!', 'Se, sommerfuglen flagrer!', 'Se, fisken svømmer!', 'Se, blomsten danser!',
    'Se, stjernen funkler!', 'Se, huset vipper!', 'Se, katten hopper!', 'Se, regnbuen skinner!',
  ])
  for (const p of BEAD_PATTERNS) assert.doesNotMatch(p.doneLine.toLowerCase(), /flot|smuk|dygtig/)
  const { allKreaLines } = await import('./kreaPhrases.ts')
  const all = new Set(allKreaLines())
  for (const p of BEAD_PATTERNS) assert.ok(all.has(p.doneLine), p.doneLine)
})

test('legend counts are derived from the grid, in palette order', () => {
  const heart = BEAD_PATTERNS.find((p) => p.id === 'hjerte')!
  assert.deepEqual(legendCounts(patternCells(heart, 'let')), [['roed', 50], ['lyseroed', 16]])
  assert.deepEqual(legendCounts(patternCells(heart, 'svaer')), [['roed', 68], ['lyseroed', 80], ['hvid', 8]])
})

const mirrorRow = (row: string) => [...row].reverse().join('')

test('the symmetric patterns are mirror-symmetric, colours included', () => {
  const symmetric = BEAD_PATTERNS.filter((p) => p.symmetric).map((p) => p.id)
  for (const id of ['hjerte', 'sommerfugl', 'stjerne']) assert.ok(symmetric.includes(id), `${id} must be flagged symmetric`)
  for (const p of BEAD_PATTERNS.filter((x) => x.symmetric)) {
    for (const level of LEVELS) {
      p.grids[level].forEach((row, r) => assert.equal(mirrorRow(row), row, `${p.id}/${level} row ${r}: "${row}" is not symmetric`))
    }
  }
  for (const b of BEAD_BOARDS.filter((x) => ['cirkel', 'hjerte', 'stjerne', 'firkant'].includes(x.id))) {
    for (const level of LEVELS) b.masks[level].forEach((row, r) => assert.equal(mirrorRow(row), row, `${b.id}/${level} row ${r}`))
  }
})

// "Not just Let's grid scaled up" (§4.4): resize Let to Svær's board by nearest neighbour and require the
// real Svær grid to differ in a good share of its beads, with at least Let's colours — finer detail.
const resize = (g: readonly string[], n: number): string[] =>
  Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => g[Math.floor((r * g.length) / n)][Math.floor((c * g.length) / n)]).join(''))

test('each harder level is its own design, not the level below resized', () => {
  for (const [lo, hi] of [['let', 'svaer'], ['normal', 'svaer'], ['let', 'normal']] as const) {
  const n = boardSize(hi)
  for (const p of BEAD_PATTERNS) {
    const up = resize(p.grids[lo], n)
    const real = p.grids[hi]
    let beads = 0
    let differ = 0
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (real[r][c] === '.' && up[r][c] === '.') continue
        beads++
        if (real[r][c] !== up[r][c]) differ++
      }
    assert.ok(differ / beads >= 0.15, `${p.id}: ${hi} differs from ${lo}-resized in only ${differ}/${beads}`)
    const colours = (lvl: BeadLevel) => legendCounts(patternCells(p, lvl)).length
    assert.ok(colours(hi) >= colours(lo), `${p.id}: ${hi} has fewer colours than ${lo}`)
  }
  }
})

// §4.2: the minimum peg pitch is 40 CSS px on the iPad. If a level's board doesn't fit, the TABLE is
// wrong — fix `KREA_BEADS`, never the pitch. Both orientations of the floor device. The one owner-accepted
// exception is Svær's 16×16 at ~35 px (2026-10-16), with its own floor so it can't slide further.
test('every level’s board keeps its minimum peg pitch on the iPad, both orientations', () => {
  for (const level of LEVELS) {
    for (const o of ['landscape', 'portrait'] as const) {
      const pitch = boardPitch(KREA_BEADS[level].board, BEAD_LAYOUT.ipadStage[o], o)
      const floor = level === 'svaer' ? BEAD_LAYOUT.svaerMinPitchPx : BEAD_LAYOUT.minPitchPx
      assert.ok(pitch >= floor, `${level} ${o}: ${pitch.toFixed(1)} px, floor ${floor}`)
    }
  }
})

test('board size and bead size step with the level; XP does not live here', () => {
  assert.ok(KREA_BEADS.let.board < KREA_BEADS.normal.board && KREA_BEADS.normal.board < KREA_BEADS.svaer.board)
  assert.ok(KREA_BEADS.let.bead > KREA_BEADS.normal.bead, 'Let has the biggest beads')
  assert.equal(KREA_BEADS.svaer.board, 16, 'the owner chose 16×16 at Svær (2026-10-16)')
  // The on-board guide fades with the level (owner, 2026-10-17): colour → where only → nothing.
  assert.deepEqual([KREA_BEADS.let.guide, KREA_BEADS.normal.guide, KREA_BEADS.svaer.guide], ['colour', 'shape', 'none'])
})
