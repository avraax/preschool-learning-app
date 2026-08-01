import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AVATAR_IDS,
  AVATAR_LABELS,
  DEFAULT_AVATAR_ID,
  LEGACY_AVATAR_GLYPHS,
  isAvatarId,
  normalizeAvatarId,
} from './avatars.ts'

// De-emoji PRD-01, D5 made enforceable for the last child-facing emoji surface. The avatar tiles have
// NO glyph fallback any more, so a missing render would draw an empty box in the picker — this test is
// what turns that into a red build. Same pattern as `gameIcons.test.ts` / `themes.test.ts`.
//
// `src/assets/avatars/index.ts` globs `./*.webp` and is Vite-only, so the coverage check reads the
// DIRECTORY rather than importing the manifest.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ART_DIR = path.join(ROOT, 'src', 'assets', 'avatars')

test('every avatar id has a baked portrait', () => {
  const missing = AVATAR_IDS.filter((id) => !existsSync(path.join(ART_DIR, `${id}.webp`)))
  assert.deepEqual(missing, [], 'key the render into src/assets/avatars/ — never fall back to a glyph')
})

test('no orphan avatar art', () => {
  const known = new Set<string>(AVATAR_IDS)
  const orphans = readdirSync(ART_DIR)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.replace(/\.webp$/, ''))
    .filter((id) => !known.has(id))
  assert.deepEqual(orphans, [], 'add the id to AVATAR_IDS or delete the file')
})

test('the set is the owner-locked 12, in grid order', () => {
  // 6 columns × 2 rows. Changing the COUNT changes the dialog layout, so it is asserted, not implied.
  assert.equal(AVATAR_IDS.length, 12)
  assert.equal(new Set(AVATAR_IDS).size, 12, 'ids must be unique')
  assert.ok(isAvatarId(DEFAULT_AVATAR_ID))
})

test('every id has a Danish label', () => {
  const missing = AVATAR_IDS.filter((id) => !AVATAR_LABELS[id]?.trim())
  assert.deepEqual(missing, [])
})

test('every legacy glyph maps onto a live id, 1:1', () => {
  // The owner kept the same 12 subjects so no existing profile changes meaning. If that ever stops
  // being true, this is the test that says so.
  assert.equal(LEGACY_AVATAR_GLYPHS.size, AVATAR_IDS.length)
  const mapped = [...LEGACY_AVATAR_GLYPHS].map((g) => normalizeAvatarId(g))
  assert.deepEqual([...mapped].sort(), [...AVATAR_IDS].sort(), 'legacy glyphs must cover the set exactly')
  assert.equal(new Set(mapped).size, mapped.length, 'two glyphs must not collapse onto one id')
})

test('normalizeAvatarId passes ids through and defaults anything unknown', () => {
  for (const id of AVATAR_IDS) assert.equal(normalizeAvatarId(id), id)
  for (const junk of ['', '  ', 'wolf', '<img>', null, undefined, 42, {}]) {
    assert.equal(normalizeAvatarId(junk), DEFAULT_AVATAR_ID)
  }
})

test('isAvatarId rejects everything outside the set', () => {
  // This is the server's allow-list (api/profiles.ts `cleanAvatar`), so it has to be strict about the
  // shapes an attacker would actually try.
  for (const junk of ['fox ', 'FOX', 'wolf', '<script>', '../../etc', '', null, undefined, 0]) {
    assert.equal(isAvatarId(junk), false, `${String(junk)} must not pass`)
  }
})
