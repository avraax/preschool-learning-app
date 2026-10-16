import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const code = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

// Fast taps on Undo were LOST: `click` fires for only some taps closer together than the double-tap
// window (real touch input: 20 fast taps undid ONE stroke). Every studio control acts on the press.
test('studio controls act on the press, and the blocking confirm acts on the click', () => {
  const c = code('./StudioControls.tsx')
  assert.match(c, /onPointerDown: \(e: React\.PointerEvent\) => \{[\s\S]*?fn\(\)/, 'pressHandlers no longer fires on pointerdown')
  assert.match(c, /activateOn === 'press' \? pressHandlers\(onPress\)/, 'StudioButton does not use the press path')
  assert.match(c, /\{\.\.\.pressHandlers\(\(\) => onPick\(c\)\)\}/, 'the crayons do not use the press path')
  assert.doesNotMatch(c, /onClick=\{onPress\}\s*\n/, 'a bare onClick is back on a studio button')
  // …but a button inside a BLOCKING overlay must close on the click, or the tap lands underneath.
  const confirm = code('./NewPaperConfirm.tsx')
  assert.equal((confirm.match(/activateOn="click"/g) ?? []).length, 2)
})

// The glitter bottle was a tap-and-hold brush unlike everything else (owner, 2026-10-16); stars are a
// stamp. The brush stays in brushes.ts only so an old session's glitter still renders.
test('the glitter brush is not a tool any more, and a star is a stamp', () => {
  assert.doesNotMatch(code('./StudioControls.tsx'), /id: 'glitter'/)
  assert.match(code('./stamps.ts'), /\{ id: 'stjerne'/)
})
