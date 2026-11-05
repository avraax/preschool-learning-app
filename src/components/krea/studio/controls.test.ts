import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const code = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

// Fast taps on Undo were LOST: `click` fires for only some taps closer together than the double-tap
// window (real touch input: 20 fast taps undid ONE stroke). Every studio control acts on the press.
test('studio controls act on the press, and the blocking confirm acts on the click', () => {
  const c = code('./StudioControls.tsx')
  assert.match(c, /onPointerDown: \(e: React\.PointerEvent\) => \{[\s\S]*?fn\(\)/, 'pressHandlers no longer fires on pointerdown')
  assert.match(c, /activateOn === 'press' \? pressHandlers\(onPress\)/, 'StudioButton does not use the press path')
  assert.match(c, /\{\.\.\.pressHandlers\(it\.pick\)\}/, 'the crayons do not use the press path')
  assert.doesNotMatch(c, /onClick=\{onPress\}\s*\n/, 'a bare onClick is back on a studio button')
  // …but a button inside a BLOCKING overlay must close on the click, or the tap lands underneath.
  const confirm = code('./NewPaperConfirm.tsx')
  assert.equal((confirm.match(/activateOn="click"/g) ?? []).length, 2)
})

// The glitter bottle was a tap-and-hold brush unlike everything else (owner, 2026-10-16); stars are a
// stamp. The brush stays in brushes.ts only so an old session's glitter still renders.
test('the glitter brush is not a tool any more, and a star is a stamp', () => {
  assert.doesNotMatch(code('./StudioControls.tsx'), /id: 'glitter'/)
  assert.match(code('./stamps.ts'), /\{ id: 'stjerne'/)
})

// The rainbow crayon is a VARIANT, lying last among the crayons — not a tool on the left (owner,
// 2026-10-16). The crayon tool shows it when it is in hand.
test('the rainbow crayon is in the crayon row, not in the tool row', () => {
  const c = code('./StudioControls.tsx')
  const toolRow = c.slice(c.indexOf('export const ToolRow'), c.indexOf('export interface CrayonPaletteProps'))
  const palette = c.slice(c.indexOf('export const CrayonPalette'), c.indexOf('export interface StampTrayProps'))
  assert.doesNotMatch(toolRow, /id: 'rainbow'/, 'rainbow is a tool again')
  assert.match(palette, /id: 'rainbow' as const/, 'rainbow is missing from the crayon row')
  assert.match(toolRow, /tool === 'rainbow' \? KREA_ART\.crayonRainbow/, 'the crayon tool does not show the rainbow in hand')
})

// Owner, 2026-11-04 (iPad Pro 12.9"): the rainbow crayon wrapped alone onto a second line, the crayon row
// sat 15–22 px right of the paper's centre, and the "Nyt papir" + hung off the screen edge. The row is a
// fixed-column GRID sized from its own width (a wrapping flow cannot be made orphan-free), and all three
// studios share ONE column geometry — definite side columns in landscape and a row padded by their
// difference — so the paper and the row share a centre. The px proof is the browser sweep (rung 1+2).
test('the crayon row is a fixed-column grid, and every studio centres it on the paper the same way', () => {
  const c = code('./StudioControls.tsx')
  const palette = c.slice(c.indexOf('export const CrayonPalette'), c.indexOf('export interface StampTrayProps'))
  assert.match(palette, /display: 'grid'/, 'the crayon row is no longer a grid')
  assert.match(palette, /gridTemplateColumns: `repeat\(\$\{n\}/, 'the crayon row lost its one-row column count')
  assert.doesNotMatch(palette, /flexWrap: 'wrap'/, 'the crayon row wraps again — the rainbow will orphan')
  assert.doesNotMatch(palette, /100vw/, 'the crayon row is sized from the viewport, not from its own row')
  assert.match(c, /containerType: 'inline-size'/, 'the pal box is no longer the crayon row’s size container')
  assert.match(c, /gridTemplateColumns: 'minmax\(0, 1fr\)'/, 'the pal box’s track can grow to the stamp tray again')
  for (const f of ['../FriTegningGame.tsx', './PieceStudio.tsx']) {
    const g = code(f)
    assert.match(g, /sx=\{studioPalSx\(COLS, 14\)\}/, `${f}: the crayon row is not centred on the paper`)
    assert.match(g, /gridTemplateColumns: `\$\{COLS\.tools\} minmax\(0, 1fr\) \$\{COLS\.side\}`/, `${f}: a landscape side column is not definite`)
    assert.match(g, /pr: COLS\.inset/, `${f}: the side lane is not set in to the name pill’s edge`)
  }
})
