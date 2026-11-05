// The corner mascot stands the SAME distance from the left as from the bottom, on every skin, pose and
// surface (owner 2026-11-05, feedback YJB9U: the ocean octopus jammed against the left edge of a section
// menu while sitting high off the bottom; kid/space sat ~20px further right than dino).
//
// The cause was the art, not a viewport: the sprites carry different transparent padding, so a box
// pinned 4–6px from the corner put the INK anywhere. The fix places the ink from a measured table, so
// the guards are: the table is the truth about the files, every surface places by it, and the room the
// home doors leave is the ink's real reach.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MASCOT_INK } from './mascotInk.ts'
import { inkPlacementSx, MASCOT_INK_INSET } from '../components/common/mascotCorner.ts'

const src = (rel: string) =>
  readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

test('MASCOT_INK is the truth about the art files (re-run node scripts/mascot-ink.mjs after re-keying)', async () => {
  const { measureAll } = await import('../../scripts/mascot-ink.mjs')
  const actual = await measureAll()
  assert.deepEqual(MASCOT_INK, actual)
})

test('every sprite lands its ink at the same inset from the left and the bottom of its box', () => {
  for (const [theme, sprites] of Object.entries(MASCOT_INK)) {
    for (const [sprite, ink] of Object.entries(sprites)) {
      const sx = inkPlacementSx(ink)
      const fw = Math.min(1, ink.w / ink.h)
      const fh = Math.min(1, ink.h / ink.w)
      const inkLeft = parseFloat(sx.left) / 100 + ink.left * fw
      const inkBottom = parseFloat(sx.bottom) / 100 + ink.bottom * fh
      assert.ok(Math.abs(inkLeft - MASCOT_INK_INSET) < 0.001, `${theme}/${sprite}: ink left ${inkLeft}`)
      assert.ok(Math.abs(inkBottom - MASCOT_INK_INSET) < 0.001, `${theme}/${sprite}: ink bottom ${inkBottom}`)
      // Anchored left-bottom, or the % shift above is measured from the wrong origin.
      assert.equal(sx.objectPosition, 'left bottom')
    }
  }
})

test('every corner mascot surface places by the ink box, with its box in the corner', () => {
  for (const rel of ['components/common/ThemeMascot.tsx', 'components/common/Mascot.tsx']) {
    assert.match(src(rel), /inkPlacementSx\(ink\)/, `${rel} no longer places the sprite by its ink box`)
    assert.match(src(rel), /MASCOT_INK\[themeId\]/, `${rel} no longer reads the measured table`)
  }
  // A px nudge on a caller's box would put the ink back off the shared inset on one surface only.
  for (const rel of ['components/home/HomePage.tsx', 'components/common/GameSelectionLayout.tsx', 'components/common/Mascot.tsx']) {
    const code = src(rel)
    assert.doesNotMatch(code, /(left|bottom): 'calc\(env\(safe-area-inset-(left|bottom)\) \+ \d+px\)'/, `${rel}: the mascot box got a px inset again`)
  }
})

test('home reserves the ink’s real reach, not the box', () => {
  // The widest sprite's ink reaches inset + its own width share of the box past the corner.
  let reach = 0
  for (const sprites of Object.values(MASCOT_INK)) {
    for (const ink of Object.values(sprites)) {
      const fw = Math.min(1, ink.w / ink.h)
      reach = Math.max(reach, MASCOT_INK_INSET + (1 - ink.left - ink.right) * fw)
    }
  }
  assert.match(src('components/home/HomePage.tsx'), /px \* \(1 \+ MASCOT_INK_INSET\)/, 'home’s door field no longer starts past the mascot’s reach')
  assert.ok(reach <= 1 + MASCOT_INK_INSET + 1e-9, `a sprite reaches ${reach} of its box — widen the home reserve`)
})
