import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Coverage for the chrome's baked symbols (Corner identity PRD-01 §4.7), the last manifest that had
// none. `gameIcons.test.ts` / `themes.test.ts` / `avatars.test.ts` / `rewardArtCoverage.test.ts` each
// guard their own set; this map was small enough to look self-evident and was therefore skipped.
//
// It stopped being self-evident when `uiArt.book` became the CENTRE OF THE CORNER RING on home, every
// section menu and every game (the next-prize silhouette is deleted — §2.2). An unresolved import here
// is a blank disc on every screen in the app at once, and no existing test can see it: the ring renders
// `<img src={art}>` unconditionally, so a broken specifier is a 0×0 image, not an exception.
//
// `index.ts` imports `.webp` files, so `node --test` cannot evaluate it — it is read as TEXT and its
// import specifiers are resolved against the filesystem, which is the same technique the manifests
// above use for the same reason. Reading the specifiers (rather than listing the directory) is what
// makes this catch a RE-POINTED import as well as a deleted file.

const HERE = path.dirname(fileURLToPath(import.meta.url))
const INDEX = path.join(HERE, 'index.ts')
const source = readFileSync(INDEX, 'utf8')

/** `import book from './book.webp'` → { book: './book.webp' } */
const imports = new Map<string, string>(
  [...source.matchAll(/^import\s+(\w+)\s+from\s+'([^']+)'/gm)].map((m) => [m[1], m[2]]),
)

/** The keys of `uiArt`, which is the set every call site can reach. */
const record = source.match(/export const uiArt: Record<UiSymbol, string> = \{([^}]*)\}/)
assert.ok(record, 'could not find the uiArt record — re-point this guard')
const keys = record[1]
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

test('every exported symbol resolves to a file that exists', () => {
  const missing = keys.filter((k) => {
    const spec = imports.get(k)
    return !spec || !existsSync(path.resolve(HERE, spec))
  })
  assert.deepEqual(missing, [], 'a uiArt symbol points at art that is not there — the corner goes blank')
})

test('the symbols live in THIS directory, not inside a game set', () => {
  // `book` used to be imported from `assets/games/english/`. Renaming or re-keying that game asset
  // would have blanked the reward ring on every screen, with nothing to fail. The chrome owns its art.
  const strays = keys.filter((k) => !/^\.\/[^/]+\.webp$/.test(imports.get(k) ?? ''))
  assert.deepEqual(strays, [], "a chrome symbol borrows a game's file — copy it into src/assets/ui/")
})

test('the UiSymbol union and the record agree', () => {
  // A key with no place in the union does not type-check; a union member with no key is `undefined` at
  // runtime and renders as a blank box, which is exactly the failure this file exists for.
  const union = source.match(/export type UiSymbol = ([^\n]+)/)
  assert.ok(union, 'could not find the UiSymbol union — re-point this guard')
  const named = [...union[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  assert.deepEqual([...named].sort(), [...keys].sort(), 'UiSymbol and uiArt name different symbols')
})

test('the book stays small enough to ride first paint', () => {
  // These are statically bundled (see index.ts), so they are in the first chunk rather than lazy. The
  // reward art budget is ~20 KB apiece and the book is drawn at 34px in the ring; same ceiling.
  const heavy = keys
    .map((k) => ({ k, kb: Math.round(statSync(path.resolve(HERE, imports.get(k)!)).size / 1024) }))
    .filter((s) => s.kb > 20)
    .map((s) => `${s.k} is ${s.kb} KB`)
  assert.deepEqual(heavy, [], 'lower the WebP quality or simplify the render')
})
