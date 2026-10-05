import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { draggableStyle } from './draggableStyle.ts'

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
  const s = draggableStyle({ ...base, transform: { x: 37, y: -112 }, isDragging: true, lift: { scale: 1.2, rotate: 8 } })
  assert.equal(s.translate, '37px -112px')
  // The finger-follow must be on a property with NO transition — an eased translate is the lag itself.
  const transition = String(s.transition)
  assert.ok(!/\btranslate\b/.test(transition), `the drag offset transitions while dragging: ${transition}`)
  assert.ok(!/\btransform\b|\ball\b/.test(transition), `a transform/all transition can reach the drag: ${transition}`)
  // And the drag is not on `transform` at all: index.css transitions `transform` on every [role=button],
  // which is what dnd-kit makes each draggable.
  assert.equal(s.transform, undefined)
})

test('the lift lives on the dragged element (scale/rotate), composed AFTER the translate', () => {
  const s = draggableStyle({ ...base, transform: { x: 10, y: 10 }, isDragging: true, lift: { scale: 1.2, rotate: 8 } })
  assert.equal(s.scale, '1.2')
  assert.equal(s.rotate, '8deg')
  const resting = draggableStyle({ ...base, transform: null, isDragging: false, lift: { scale: 1.2, rotate: 8 } })
  assert.equal(resting.scale, '1')
  assert.equal(resting.rotate, '0deg')
  assert.equal(resting.translate, '0px 0px')
})

test('reduced motion: no lift and no eased spring-back', () => {
  const s = draggableStyle({ ...base, transform: { x: 5, y: 5 }, isDragging: true, lift: { scale: 1.2 }, reduce: true })
  assert.equal(s.scale, '1')
  assert.equal(s.transition, 'none')
})

test('DraggableItem takes its style from draggableStyle and sets no transform of its own', () => {
  const src = codeOf('./DraggableItem.tsx')
  assert.ok(/draggableStyle\(\{[^}]*\blift\b/.test(src), 'DraggableItem no longer routes its style (with lift) through draggableStyle')
  assert.ok(!/\btransform\s*:/.test(src), 'DraggableItem sets a `transform` again — the global [role=button] transition eases it')
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
