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

  // Owner, 2026-11-04/05 (F5VYR, ZVBE5): a second "back to the pictures" button in the open piece did
  // exactly what the back arrow does. The arrow is the one way back.
  test(`${file}: no second "back to the grid" button in the open piece`, () => {
    const code = src(file)
    assert.doesNotMatch(code, /PickerButton|dataId="to-picker"/, 'the redundant picker button is back')
    assert.doesNotMatch(code, /onPress=\{toPicker\}/, 'a control in the open piece steps back to the grid')
  })
}

// Owner, 2026-11-07 (HRJ4H): "Nyt papir?" has ONE picture button (yes, a fresh one) and a red close X that
// closes it and keeps the piece — no second "keep" picture, in every Krea game that asks.
test('the new-piece question is one picture button and a close X, no keep picture', () => {
  const dialog = src('./studio/NewPaperConfirm.tsx')
  assert.equal((dialog.match(/<StudioButton\b/g) ?? []).length, 1, 'a second picture button is back')
  assert.match(dialog, /data-krea-control="confirm-close"\s+onClick=\{onClose\}/, 'the close X does not close on click')
})
for (const file of ['./FriTegningGame.tsx', './TegnMedMigGame.tsx', './FarvelaegGame.tsx', './PerlepladeGame.tsx', './ByggeklodserGame.tsx']) {
  test(`${file}: the new-piece question closes with the close X and keeps the piece`, () => {
    const confirm = src(file).match(/<NewPaperConfirm\b[\s\S]*?\/>\r?\n/)
    assert.ok(confirm, 'no NewPaperConfirm')
    assert.match(confirm[0], /onClose=\{confirmKeep\}/, 'the close X is not wired to keep the piece')
  })
}

test('GameShell hands onBackWithin to the back arrow, which prefers it over the menu route', () => {
  assert.match(src('../common/GameShell.tsx'), /<BackButton to=\{backRoute\} variant="game" onBack=\{onBackWithin\} \/>/)
  assert.match(src('../common/BackButton.tsx'), /onClick=\{\(\) => \(onBack \? onBack\(\) : goBack\(to\)\)\}/)
})

// Owner 2026-11-07: kids can clear by accident. The fresh button must be HELD (a full ring only arms it;
// the click that ends the hold clears), and the clear is undoable in every game with Fortryd.
test('the new-piece question clears only after a hold', () => {
  const dialog = src('./studio/NewPaperConfirm.tsx')
  assert.match(dialog, /export const HOLD_CONFIRM_MS = 1500/)
  assert.match(dialog, /const commit = \(\) => \{\s+if \(hold !== 'armed'\) return/, 'a tap clears without the hold')
  assert.match(dialog, /onPress=\{commit\}/)
  assert.doesNotMatch(dialog, /onPress=\{onFresh\}/)
})
for (const [file, restore] of [
  ['./FriTegningGame.tsx', /setCleared\(drawing\)/],
  ['./TegnMedMigGame.tsx', /setCleared\(\{ id: subjectId, piece \}\)/],
  ['./FarvelaegGame.tsx', /setCleared\(\{ id: pageId, piece \}\)/],
  ['./ByggeklodserGame.tsx', /setWorld\(clearWorld\(worldRef\.current\)\)/],
] as const) {
  test(`${file}: "Ny" is undoable — Fortryd brings the piece back`, () => {
    const code = src(file)
    const fresh = code.slice(code.indexOf('const confirmFresh'), code.indexOf('const confirmKeep'))
    assert.match(fresh, restore, 'the clear keeps nothing to undo back to')
  })
}
