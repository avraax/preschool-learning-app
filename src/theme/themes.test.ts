import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

// ---- The skin is PER CHILD, and absence means the default ---------------------------------------
//
// Found by QA of the boot picker (Børn picker PRD-01): switching to a child who never chose a skin
// left the PREVIOUS child's skin on screen, and since `bornelaering-theme` is also the first-paint
// hint, the leak survived a cold boot. Measured: child 2 on "space", child 1 with no themeId, and the
// app stayed rgb(7,11,26). A sibling was playing in another sibling's world.
//
// Read as SOURCE — `ThemeProvider.tsx` pulls MUI and cannot be imported from plain Node. Comments are
// stripped first: the "why" comment above the fix names the exact shapes forbidden below.

test('an unthemed child gets the DEFAULT skin, never the previous child’s', () => {
  const code = readFileSync(path.join(ROOT, 'src', 'theme', 'ThemeProvider.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  // Absence is a VALUE. `if (stored && …)` is the bug: it treats "no skin chosen" as "change nothing".
  assert.match(
    code,
    /const stored = progressStore\.get\(\)\.settings\.themeId \?\? defaultThemeId/,
    'the profile skin no longer falls back to the default — an unthemed child inherits the last one',
  )
  assert.doesNotMatch(code, /if \(stored &&/, 'the truthiness check is back; absence is a value')

  // …and the OTHER half: an inert store has no opinion. Without this the same effect would stamp the
  // default over the synchronous first-paint hint before any child is attached, which is the white
  // flash on the dark skins that the hint exists to prevent.
  assert.match(
    code,
    /if \(!progressStore\.isAttached\(\)\) return/,
    'the theme sync reads the store while it is INERT — that repaints over the first-paint hint',
  )
  const guardAt = code.indexOf('progressStore.isAttached()')
  const readAt = code.indexOf('settings.themeId')
  assert.ok(guardAt > 0 && guardAt < readAt, 'the inert guard runs after the themeId read')

  // The device-level hint must be rewritten for the FALLBACK too, or the next cold boot first-paints
  // in the previous child's skin and then snaps — the same flash, one launch later.
  assert.match(code, /localStorage\.setItem\(STORAGE_KEY, stored\)/)
})
