import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themes } from '../themes.ts'
import { homeAnchorsFor } from './helpers.ts'

// Krea PRD-01 §4.1: production shows FIVE home objects until Krea is released, staging SIX. The
// 6-object arc is a separate list so the 5-object one cannot move — and it must be the same arc shape
// (scene-and-world.md): the five keep their left-to-right order, Krea seats LAST on the right, outer
// pair lowest, the middle highest, so the labels still read as one band.
test('every registered skin seats 5 objects without Krea and 6 with it, Krea last, same order and shape', () => {
  for (const t of themes) {
    const five = homeAnchorsFor(t.scene ?? {}, false)
    const six = homeAnchorsFor(t.scene ?? {}, true)
    assert.equal(five.length, 5, `${t.id}: 5-object arc`)
    assert.ok(!five.some((a) => a.section === 'krea'), `${t.id}: Krea leaked into the production arc`)
    assert.equal(six.length, 6, `${t.id}: 6-object arc`)
    const byX = (l: typeof six) => [...l].sort((a, b) => a.xPct - b.xPct).map((a) => a.section)
    assert.deepEqual(byX(six), [...byX(five), 'krea'], `${t.id}: the five must keep their order with Krea last`)
    const ys = [...six].sort((a, b) => a.xPct - b.xPct).map((a) => a.yPct)
    // A smile: y falls toward the middle and rises again (screen y grows downward), never re-ordered.
    for (let i = 1; i < 3; i++) assert.ok(ys[i] <= ys[i - 1], `${t.id}: left half must climb`)
    for (let i = 4; i < 6; i++) assert.ok(ys[i] >= ys[i - 1], `${t.id}: right half must fall`)
    if (t.scene?.homeAnchors?.length) assert.ok(t.scene.homeAnchorsKrea?.length === 6, `${t.id}: authored a 5-arc but no 6-arc`)
  }
})
