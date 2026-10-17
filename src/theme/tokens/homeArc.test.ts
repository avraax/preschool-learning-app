import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themes } from '../themes.ts'
import { homeAnchorsFor } from './helpers.ts'
import { DOORS } from '../../config/doors.ts'

// Production shows the FIVE section objects until v1.3; with four doors on (Category restructure
// PRD-01, riding the Krea gate) home seats the FOUR doors. The two arcs are separate lists so the five
// cannot move. Both are the same arc SHAPE (scene-and-world.md): outer pair lowest, the middle highest,
// so the labels read as one band — and the four sit in door order, keyed by each door's primary.
const smile = (ys: number[], id: string) => {
  const mid = Math.floor((ys.length - 1) / 2)
  for (let i = 1; i <= mid; i++) assert.ok(ys[i] <= ys[i - 1], `${id}: left half must climb`)
  for (let i = ys.length - mid; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1], `${id}: right half must fall`)
}

test('every registered skin seats the 5 sections without four doors, and the 4 doors with them', () => {
  for (const t of themes) {
    const five = homeAnchorsFor(t.scene ?? {}, false)
    const four = homeAnchorsFor(t.scene ?? {}, true)
    assert.equal(five.length, 5, `${t.id}: 5-object arc`)
    assert.ok(!five.some((a) => a.section === 'krea'), `${t.id}: Krea leaked into the production arc`)
    assert.equal(four.length, 4, `${t.id}: 4-door arc`)
    const byX = <T extends { xPct: number }>(l: T[]) => [...l].sort((a, b) => a.xPct - b.xPct)
    assert.deepEqual(byX(four).map((a) => a.section), DOORS.map((d) => d.primary), `${t.id}: doors out of order`)
    smile(byX(five).map((a) => a.yPct), `${t.id} five`)
    smile(byX(four).map((a) => a.yPct), `${t.id} four`)
    if (t.scene?.homeAnchors?.length) assert.ok(t.scene.homeAnchorsDoors?.length === 4, `${t.id}: authored a 5-arc but no 4-door arc`)
  }
})

// D11: same object size as the five — the freed space is air, not bigger, more toy-like objects.
test('the four doors are no bigger than the five sections were', () => {
  for (const t of themes) {
    const maxFive = Math.max(...homeAnchorsFor(t.scene ?? {}, false).map((a) => a.scale))
    for (const a of homeAnchorsFor(t.scene ?? {}, true)) assert.ok(a.scale <= maxFive, `${t.id}: ${a.section} grew`)
  }
})
