import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { categoryThemes, getCategoryIds } from './categoryThemes.ts'

// De-emoji PRD-01 W4, D5 made enforceable: `Game.emoji` and `GameTileIcon`'s `fallbackEmoji` are
// GONE, so the per-game soft-3D registry is now the only source of a game tile's picture. If a key
// stops resolving, the tile renders a hole — this test is what turns that hole into a red build.
//
// The registry itself (`src/assets/themes/icons/games/index.ts`) imports `.webp`, which Node can't
// evaluate, so we read it as TEXT and check both halves: the `<section>.<id>` key is mapped, and
// the file it maps to actually exists on disk.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GAMES_DIR = path.join(ROOT, 'src', 'assets', 'themes', 'icons', 'games')
const SECTIONS_DIR = path.join(ROOT, 'src', 'assets', 'themes', 'icons')

const registry = readFileSync(path.join(GAMES_DIR, 'index.ts'), 'utf-8')

// `import alphabetLearn from './alphabet.learn.webp'` → local name → filename.
const importedFiles = new Map(
  [...registry.matchAll(/^import\s+(\w+)\s+from\s+'\.\/([\w.-]+\.webp)'/gm)].map((m) => [m[1], m[2]])
)

// `'alphabet.learn': alphabetLearn,` → registry key → local name.
const mapping = new Map(
  [...registry.matchAll(/^\s*'([\w.-]+)':\s*(\w+),/gm)].map((m) => [m[1], m[2]])
)

test('every game in categoryThemes resolves a soft-3D icon (no emoji fallback exists)', () => {
  const missing: string[] = []
  for (const section of getCategoryIds()) {
    for (const game of categoryThemes[section].games) {
      const key = `${section}.${game.id}`
      const local = mapping.get(key)
      if (!local) {
        missing.push(`${key} — no entry in assets/themes/icons/games/index.ts`)
        continue
      }
      const file = importedFiles.get(local)
      if (!file) missing.push(`${key} → ${local}, which is not imported`)
      else if (!existsSync(path.join(GAMES_DIR, file))) missing.push(`${key} → ${file} is missing`)
    }
  }
  assert.deepEqual(missing, [], 'add the baked WebP + its registry entry, never an emoji fallback')
})

test('every section resolves a soft-3D icon', () => {
  const missing = getCategoryIds().filter((id) => !existsSync(path.join(SECTIONS_DIR, `${id}.webp`)))
  assert.deepEqual(missing, [])
})

test('the icon registry has no entries for games that no longer exist', () => {
  const live = new Set(
    getCategoryIds().flatMap((s) => categoryThemes[s].games.map((g) => `${s}.${g.id}`))
  )
  const dead = [...mapping.keys()].filter((k) => !live.has(k))
  assert.deepEqual(dead, [], 'drop the registry entry (and its WebP) when a game is removed')
})
