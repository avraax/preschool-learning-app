import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { themes, themeOptions, defaultThemeId } from './themes.ts'
import { hasSceneAssets } from './sceneAssets.ts'

// De-emoji PRD-01 W4: the theme picker used to fall back to a `selectorEmoji` glyph when a skin had
// no world art. That field is deleted (D5 — a missing render must never leave an emoji behind), so
// the picker now shows the baked `selectorThumb` or nothing at all. This test is the thing that
// keeps "or nothing at all" unreachable: a skin may only be REGISTERED if it ships that thumbnail.
//
// Unregistered token files (jungle/candy) are deliberately exempt — they are not in `themes`, so
// they never reach the picker.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const themeAsset = (id: string, file: string): string =>
  path.join(ROOT, 'src', 'assets', 'themes', id, file)

test('every registered skin ships the selector thumbnail the picker renders', () => {
  const missing = themes
    .filter((t) => !hasSceneAssets(t.id) || !existsSync(themeAsset(t.id, 'thumb.webp')))
    .map((t) => `${t.id} (${t.name}) — needs src/assets/themes/${t.id}/thumb.webp + a sceneAssets loader`)
  assert.deepEqual(missing, [], 'register a skin only once its world art exists; never fall back to a glyph')
})

test('the selector metadata carries no glyph field', () => {
  for (const option of themeOptions) {
    assert.deepEqual(Object.keys(option).sort(), ['id', 'name'])
  }
})

test('theme ids are unique and the default is registered', () => {
  const ids = themes.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.includes(defaultThemeId))
})
