import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { draggableStyle, liftStyle } from './draggableStyle.ts'

// Owner, 2026-10-05: drag "falls behind the finger". Two causes, both pinned here — see draggableStyle.ts
// for the measurements. Source reads strip comments first, because every rule below is also explained in
// a comment beside the code (same helper as dragActivation.test.ts).
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\/[^\n]*\n/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1')
const codeOf = (rel: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))

const base = {
  disabled: false,
  inline: true,
  fill: false,
  position: { x: 0, y: 0 },
}

test('while dragging, the item sits exactly on the pointer delta and that motion never transitions', () => {
  const s = draggableStyle({ ...base, transform: { x: 37, y: -112 }, isDragging: true })
  assert.equal(s.translate, '37px -112px')
  // The finger-follow must have NO transition at all — an eased translate is the lag itself.
  assert.equal(s.transition, 'none')
  // And the drag is not on `transform`: index.css transitions `transform` on every [role=button], which
  // is what dnd-kit makes each draggable.
  assert.equal(s.transform, undefined)
  // Released, it eases home.
  assert.match(String(draggableStyle({ ...base, transform: null, isDragging: false }).transition), /translate/)
})

test('the tracked node never changes size: no scale/rotate on it, the lift is the inner wrapper', () => {
  // WebKit: a lift on the node dnd-kit measures drifted its translate by half the bounding-box growth.
  const s = draggableStyle({ ...base, transform: { x: 10, y: 10 }, isDragging: true })
  assert.equal(s.scale, undefined)
  assert.equal(s.rotate, undefined)
  const held = liftStyle({ lift: { scale: 1.2, rotate: 8 }, isDragging: true, fill: false })
  assert.equal(held.scale, '1.2')
  assert.equal(held.rotate, '8deg')
  const resting = liftStyle({ lift: { scale: 1.2, rotate: 8 }, isDragging: false, fill: false })
  assert.equal(resting.scale, '1')
  assert.equal(resting.rotate, '0deg')
})

test('reduced motion: no lift and no eased spring-back', () => {
  assert.equal(liftStyle({ lift: { scale: 1.2 }, isDragging: true, fill: false, reduce: true }).scale, '1')
  assert.equal(draggableStyle({ ...base, transform: null, isDragging: false, reduce: true }).transition, 'none')
})

test('DraggableItem takes its style from draggableStyle, wraps children in liftStyle, sets no transform', () => {
  const src = codeOf('./DraggableItem.tsx')
  assert.ok(/style=\{style\}/.test(src) && /const style = draggableStyle\(/.test(src), 'the tracked node no longer uses draggableStyle')
  assert.ok(/<div style=\{liftStyle\(\{ lift,/.test(src), 'the lift is no longer an inner wrapper')
  assert.ok(
    !/\btransform\s*:|\.transform\s*=|CSS\.(Translate|Transform)\b/.test(src),
    'DraggableItem sets a `transform` again — the global [role=button] transition eases it',
  )
})

// The games whose lift used to be a framer scale on an ANCESTOR of the DraggableItem. An ancestor's scale
// multiplies the drag offset, so the lift must be passed as `lift` instead (Farvejagt lifts a CHILD of its
// DraggableItem, which is harmless, and is not listed).
const LIFTED_BY_PROP = [
  '../../farver/RamFarvenGame.tsx',
  '../../farver/FarveQuizGame.tsx',
  '../../farver/NuancerGame.tsx',
  '../../math/MathOperationGame.tsx',
  '../../ordleg/SpellingGame.tsx',
  '../UnifiedQuizGame.tsx',
]

test('every game that lifts a grabbed item does it through DraggableItem `lift`', () => {
  for (const rel of LIFTED_BY_PROP) {
    const src = codeOf(rel)
    const items = src.match(/<DraggableItem\b[^>]*>/g) ?? []
    assert.ok(items.length > 0, `${rel}: no DraggableItem found`)
    for (const tag of items) assert.ok(/\blift=\{/.test(tag), `${rel}: a DraggableItem without \`lift\`: ${tag.slice(0, 80)}`)
  }
})

test('no ancestor of a draggable scales on the grab or on a held press', () => {
  // The exact shapes that ran the item off the finger: a `scale` chosen by the lifted id on the wrapper,
  // and Ram Farven's `whileTap`, which stays active for the whole held drag.
  for (const rel of LIFTED_BY_PROP) {
    const src = codeOf(rel)
    assert.ok(!/isLifted\s*\?\s*1\.\d/.test(src), `${rel}: a wrapper scale keyed on the lifted item`)
    assert.ok(!/isLifted\w*[^?]*\?\s*\{[^}]*\bscale:\s*1\.\d/.test(src), `${rel}: a wrapper scale keyed on the lifted item`)
    assert.ok(!/activeId\s*===[^?]*\?\s*\{[^}]*scale:\s*1\.\d/.test(src), `${rel}: a wrapper scale keyed on activeId`)
    assert.ok(!/activeId\s*===[^?]*\?\s*1\.\d/.test(src), `${rel}: a wrapper scale keyed on activeId`)
  }
  assert.ok(!/whileTap/.test(codeOf('../../farver/RamFarvenGame.tsx')), 'Ram Farven: whileTap is back on a droplet wrapper')
})

test('Ram Farven: the recipe reveal has no board-sized wash behind its card', () => {
  // Owner, 2026-10-05: the big white dimmed rectangle behind "Flot!" looked misplaced.
  const src = codeOf('../../farver/RamFarvenGame.tsx')
  const start = src.indexOf('key="recipe"')
  assert.ok(start > 0, 'recipe reveal not found')
  const overlay = src.slice(start, src.indexOf('<motion.div', start))
  assert.ok(!/\bbackground(Color)?\s*:/.test(overlay), 'the recipe overlay paints a background again')
})
