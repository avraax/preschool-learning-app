import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const strip = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const src = (rel: string): string => strip(readFileSync(new URL(rel, import.meta.url), 'utf8'))

// Owner, 2026-10-17: the back arrow on an open piece must go to the game's picture grid, not straight
// out to the menu — the grid is part of the way back. Each of these games renders two GameShells: the
// grid (back → the menu) and the open piece (back → the grid, through the same `toPicker` as its button).
for (const file of ['./TegnMedMigGame.tsx', './FarvelaegGame.tsx', './PerlepladeGame.tsx']) {
  test(`${file}: an open piece's back arrow steps back to the picture grid`, () => {
    const shells = [...src(file).matchAll(/<GameShell\b[^>]*>/g)].map((m) => m[0])
    assert.equal(shells.length, 2, 'expected the grid shell and the piece shell')
    assert.equal(shells.filter((s) => /onBackWithin=\{toPicker\}/.test(s)).length, 1, 'the piece shell does not step back to the grid')
    assert.ok(!/onBackWithin/.test(shells[0]), 'the grid shell must leave for the menu')
  })
}

test('GameShell hands onBackWithin to the back arrow, which prefers it over the menu route', () => {
  assert.match(src('../common/GameShell.tsx'), /<BackButton to=\{backRoute\} variant="game" onBack=\{onBackWithin\} \/>/)
  assert.match(src('../common/BackButton.tsx'), /onClick=\{\(\) => \(onBack \? onBack\(\) : goBack\(to\)\)\}/)
})
