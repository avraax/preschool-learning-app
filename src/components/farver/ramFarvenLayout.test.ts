import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Ram Farven's bench sits on ONE centre line: goal disc → arrow → pot → (landscape) the tray.
//
// Owner feedback A4VPB (2026-11-04, iPad Pro 12.9 landscape): "the right pointing arrow is not aligned
// vertically centered to the two boxes on its left and right". Each disc column is disc + label chip +
// Tøm slot, and the row centres COLUMNS, so the arrow and the tray centred on the whole stack — measured
// 42 px below the discs at 1366×1024. The fix defines that below-disc stack once (`--rf-below`) and
// reserves it under the arrow and the landscape tray; this guard holds the wiring (a rect check needs a
// browser — see the ui-screenshot skill; rung 1 + 2 measured 0 px after the fix at ten viewports).

const code = readFileSync(new URL('./RamFarvenGame.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

const block = (marker: string, len = 600) => {
  const i = code.indexOf(marker)
  assert.ok(i >= 0, `${marker} is gone from RamFarvenGame — re-point this guard`)
  return code.slice(i, i + len)
}

test('the below-disc stack is defined from the same gap and chip height the columns use', () => {
  assert.match(code, /'--rf-below':\s*`calc\(\$\{RF_GAP_PX\}px \+ var\(--rf-chip\) \+ \$\{RF_GAP_PX\}px \+ 44px\)`/)
  // Both disc columns space disc → chip → Tøm by that gap, and both chips are the fixed-height box.
  assert.equal((code.match(/gap: `\$\{RF_GAP_PX\}px`/g) ?? []).length, 2, 'a disc column no longer uses RF_GAP_PX')
  assert.equal((code.match(/\.\.\.rfChipBoxSx/g) ?? []).length, 2, 'a label chip is no longer the fixed-height box')
  assert.match(code, /height: 'var\(--rf-chip\)'/)
  // The Tøm slot is the 44 px the stack counts (goal's mirror reserve + the pot's real slot).
  assert.equal((code.match(/<Box sx=\{\{ height: 44\b/g) ?? []).length, 2, 'the 44 px Tøm reserve changed on one column')
})

test('the arrow reserves that stack beneath itself, so it centres on the discs', () => {
  assert.match(block('data-rf-arrow=""', 200), /mb: 'var\(--rf-below\)'/)
})

test('the landscape tray reserves it too, so the droplets sit on the disc line', () => {
  const tray = block('data-rf-tray=""', 2400)
  const landscape = tray.slice(tray.indexOf("'@media (orientation: landscape)'"))
  assert.match(landscape.slice(0, 600), /pb: 'var\(--rf-below\)'/)
})
