import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themes } from '../themes.ts'
import { REFERENCE_VIEWPORTS } from '../../config/sceneFurniture.ts'
import { overscanPx, parallaxTravelX, parallaxTravelY } from '../../config/parallax.ts'

// THE BLUE LINE. A parallax layer that drifts further than it over-hangs the viewport slides off its
// own edge and shows whatever is behind it — on the home screen that was the far sky, appearing and
// disappearing along the bottom as the drift reversed. The old overscan was a constant `scale(1.12)`,
// i.e. 6% of the viewport: 52px on a 872px-tall iPad (vs 27px of drift) but only 23px on a phone in
// landscape, and 22px horizontally on a phone in portrait (vs 36px). It was already fully consumed on
// the iPad too, by Regnbue's -6% lift on the near layer.

// A layer may only carry an `offsetY` bigger than its overscan if BOTH of its horizontal edges are
// transparent — then "uncovered" simply means the backdrop shows, which is the intent. One entry per
// exemption, with the reason, so a new nudge on an edge-covering layer fails instead of joining a
// silent allowlist.
const OFFSET_EXEMPT: Record<string, string> = {
  'ocean[1]': 'floating reef: transparent above and below, nudged down onto the sandbar',
}

test('every scene layer over-hangs at least as far as it can drift, on every reference viewport', () => {
  const bad: string[] = []
  for (const theme of themes) {
    const scene = theme.scene
    if (!scene) continue // flat skin: no authored world
    scene.layers.forEach((layer, i) => {
      const anchor = layer.anchor ?? 'center'
      for (const vp of REFERENCE_VIEWPORTS) {
        const travelX = parallaxTravelX(layer.depth)
        if (overscanPx(travelX, vp.w) < travelX) {
          bad.push(`${theme.id} layer[${i}] x-overscan < drift on ${vp.name}`)
        }
        if (anchor !== 'center') continue // anchored strips don't drift vertically
        const travelY = parallaxTravelY(layer.depth)
        // `offsetY` is a static art nudge in % of the layer, and it eats the overscan on the side it
        // pushes toward — that is what left Regnbue's cloud bank with zero margin below.
        const exempt = OFFSET_EXEMPT[`${theme.id}[${i}]`]
        const nudge = exempt ? 0 : (Math.abs(layer.offsetY ?? 0) / 100) * vp.h
        if (overscanPx(travelY, vp.h) < travelY + nudge) {
          bad.push(
            `${theme.id} layer[${i}] y-overscan < drift+offsetY on ${vp.name} — an EDGE-COVERING layer must be anchored, not nudged`
          )
        }
      }
    })
  }
  assert.deepEqual(bad, [], 'size the overscan from the layer depth, never from a fixed %')
})

test('the ground layer of every world is bottom-anchored and un-nudged', () => {
  for (const theme of themes) {
    const layers = theme.scene?.layers
    if (!layers?.length) continue
    const ground = layers[layers.length - 1]
    assert.equal(
      ground.anchor,
      'bottom',
      `${theme.id}: the nearest layer is the GROUND — it must be pinned to the bottom edge or it drifts off it`
    )
    assert.ok(!ground.offsetY, `${theme.id}: a lift on the ground layer re-opens the gap it exists to cover`)
  }
})

test('the far layer is the opaque full-bleed backdrop', () => {
  for (const theme of themes) {
    const far = theme.scene?.layers[0]
    if (!far) continue
    assert.equal(far.anchor ?? 'center', 'center', `${theme.id}: the backdrop must cover, not hug an edge`)
    assert.ok(!far.offsetY, `${theme.id}: nudging the backdrop uncovers an edge`)
  }
})
