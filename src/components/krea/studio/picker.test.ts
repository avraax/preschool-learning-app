import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The picker scrolls (36/36/39 pictures). Owner 2026-11-04: "can't scroll while hovering a drawing" —
// each card's `overflow: hidden` made it a scroll container of its own, and the mouse wheel latched onto
// the card under the pointer and scrolled nothing. Nothing INSIDE the scroller may be `hidden`/`auto`/
// `scroll`; `clip` clips without being a scroller. Comments stripped so the explanation can name it.
const src = readFileSync(new URL('./KreaPicker.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')

test('no card in the scrolling picker is a scroll container of its own', () => {
  const start = src.indexOf('<ButtonBase')
  const end = src.indexOf('</ButtonBase>', start)
  assert.ok(start > 0 && end > start, 'the card render moved — re-point this guard')
  const cards = src.slice(start, end)
  assert.doesNotMatch(cards, /overflow[XY]?:\s*'(hidden|auto|scroll)'/, 'a card is a scroll container again — use overflow: clip')
  assert.match(cards, /overflow:\s*'clip'/)
})

test('cards open on the CLICK, never on the press — a scrolling finger must not open one', () => {
  const start = src.indexOf('<ButtonBase')
  const cards = src.slice(start, src.indexOf('</ButtonBase>', start))
  assert.doesNotMatch(cards, /pressHandlers|onPointerDown/)
  assert.match(cards, /onClick=/)
})
