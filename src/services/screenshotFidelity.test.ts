import test from 'node:test'
import assert from 'node:assert/strict'
import { needsMarginPin, isFalseEllipsis } from './screenshotFidelity.ts'

// These pin the two rules that decide what `stabilizeForCapture` re-states on the live DOM before
// a bug-report capture. Both exist because snapdom clones COMPUTED styles: anything
// `getComputedStyle` doesn't round-trip is lost, and the report then shows an app the child never
// saw. The DOM walk around them is verified with the A/B harness in the `ui-screenshot` skill
// (snapdom capture vs a real CDP screenshot of the same frame).

test('needsMarginPin: the real bug — `mx: auto` reported as 0px', () => {
  // Min Bog's shelf: 520px wide in a 1187px content box, centred by `mx: 'auto'`, which Chrome
  // and WebKit both resolve to `margin-left: 0px`. Unpinned, the clone put it 333px left, under
  // the mascot, and the report looked like a layout bug that does not exist.
  assert.equal(needsMarginPin(333.5, 333.5, 0, 0), true)
})

test('needsMarginPin: real margins the clone already receives are left alone', () => {
  // Same geometry, but the gaps ARE the computed margins — snapdom will reproduce them.
  assert.equal(needsMarginPin(333.5, 333.5, 333.5, 333.5), false)
  assert.equal(needsMarginPin(24, 24, 24, 24), false)
})

test('needsMarginPin: one-sided gaps are somebody else`s mechanism', () => {
  // `justify-content: flex-end` (and friends) leave an unexplained gap on ONE side. That property
  // IS copied to the clone, so pinning a margin here would double the offset.
  assert.equal(needsMarginPin(500, 0, 0, 0), false)
  assert.equal(needsMarginPin(0, 500, 0, 0), false)
  assert.equal(needsMarginPin(120, 20, 0, 0), false)
})

test('needsMarginPin: sub-pixel and negative gaps are never pinned', () => {
  assert.equal(needsMarginPin(0.4, 0.4, 0, 0), false) // rounding noise, not centring
  // A negative gap means the element overflows its parent (a scroller, a negative margin).
  // Re-stating that as a margin would move real content.
  assert.equal(needsMarginPin(-40, -40, 0, 0), false)
  assert.equal(needsMarginPin(NaN, 10, 0, 0), false)
})

test('isFalseEllipsis: a label that fits live must not come back truncated', () => {
  // "Tal og Regning": 128.5px of text in a 200px max-width, but snapdom pins the box's computed
  // WIDTH and the clone rasterises a fraction wider → "Tal og Regn…". Not overflowing live.
  assert.equal(isFalseEllipsis(129, 129), true)
  assert.equal(isFalseEllipsis(129, 200), true)
  assert.equal(isFalseEllipsis(130, 129), true) // 1px tolerance for scrollWidth rounding
})

test('isFalseEllipsis: a genuine truncation stays in the report', () => {
  // The child really did see "Meget langt navn…" — un-clipping it would hide the bug.
  assert.equal(isFalseEllipsis(340, 200), false)
  assert.equal(isFalseEllipsis(131, 129), false)
  assert.equal(isFalseEllipsis(100, 0), false) // detached / display:none
})
