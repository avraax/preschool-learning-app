import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

// Byggeklodser's art coverage (scene-assets.md: art replaces a stand-in → a guard, never a fallback). The
// manifest imports .webp, which Node can't evaluate, so the guard reads it as TEXT and checks the files.
const DIR = new URL('../assets/games/krea/blocks/', import.meta.url)
const manifest = readFileSync(new URL('index.ts', DIR), 'utf8')

test('the window and door faces exist, and nothing else ships (one plain plate, no theme renders)', () => {
  const need = ['face-window', 'face-door']
  for (const name of need) {
    assert.ok(existsSync(new URL(`${name}.webp`, DIR)), `${name}.webp is missing`)
    assert.match(manifest, new RegExp(String.raw`from '\./${name}\.webp'`), `${name} is not imported by the manifest`)
  }
  // …and no orphan render (the theme plates left the set, owner J8PYR).
  const shipped = readdirSync(DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
  assert.deepEqual(shipped.sort(), [...need].sort(), 'a render ships that no face uses')
})

// The code-drawn stand-ins are gone: a canvas-drawn window or door must not quietly come back.
test('the window and door faces are the renders, not code-drawn stand-ins', () => {
  const tex = readFileSync(new URL('../components/krea/blocks/engine/textures.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(tex, /export function (windowFace|doorFace)/)
})
