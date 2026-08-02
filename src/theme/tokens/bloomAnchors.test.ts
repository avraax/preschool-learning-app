import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themes } from '../themes.ts'
import {
  REFERENCE_VIEWPORTS,
  bloomAnchorConflicts,
  bloomSpriteSize,
} from '../../config/sceneFurniture.ts'

// Bloom scenery lives INSIDE the world layer, behind every page — so an anchor that lands under the
// mascot / Min Bog shelf / corner button doesn't overlap that furniture, it disappears behind it and
// reads as a bug (Regnbue shipped a flower growing out of the bear's side). The furniture is sized
// in PX, so its share of the screen swings between an iPad and a phone: an anchor that is clear at
// 1254×872 can be buried at 390×844. Hence: every anchor, every reference viewport.

test('no bloom anchor is seated behind the menu furniture, on any reference viewport', () => {
  const bad: string[] = []
  for (const theme of themes) {
    const scenery = theme.scene?.bloomScenery ?? []
    scenery.forEach((sprite, i) => {
      for (const vp of REFERENCE_VIEWPORTS) {
        const hits = bloomAnchorConflicts(sprite, vp)
        if (hits.length) {
          bad.push(
            `${theme.id} bloomScenery[${i}] (${sprite.xPct}%,${sprite.yPct}%) hides behind ${hits.join('+')} on ${vp.name}`
          )
        }
      }
    })
  }
  assert.deepEqual(bad, [], 'move the anchor, or shrink the furniture rect if the layout really changed')
})

test('bloom sprites stay a sensible size on a phone', () => {
  const phone = REFERENCE_VIEWPORTS.find((v) => v.name.startsWith('phone portrait'))!
  const tablet = REFERENCE_VIEWPORTS.find((v) => v.name.startsWith('iPad portrait'))!
  for (const theme of themes) {
    for (const sprite of theme.scene?.bloomScenery ?? []) {
      // The px cap is the authored size and must still be what a tablet gets…
      assert.equal(bloomSpriteSize(sprite.scale, tablet), 64 * sprite.scale, `${theme.id} tablet size`)
      // …while a phone gets a smaller sprite, or a single flower covers a fifth of the screen.
      assert.ok(
        bloomSpriteSize(sprite.scale, phone) < 64 * sprite.scale,
        `${theme.id} sprite is not scaled down on a phone`
      )
    }
  }
})
