// "Flydende grafik" guarded (Performance PRD-01 W8.4).
//
// Three things this switch must never become, none of them type-checkable:
//   1. a way to ship the SLOW app — the default has to be the fast path, for a child whose profile has
//      never touched the setting and for a fresh document alike;
//   2. a second LAYOUT — it may switch only how a thing animates or whether an element is promoted. That
//      bound is what makes a PERMANENT dual path affordable to verify: because the legacy branch cannot
//      move a box, the screenshot sweep (4 skins x reduced-motion x 4 viewports) is owed on the default
//      path alone. Guarded by reading source, comments stripped;
//   3. a game-logic switch — it must not touch XP, difficulty, narration or round outcomes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FAST_PROFILE,
  LEGACY_PROFILE,
  perfProfile,
  perfProfileFor,
  resetPerfProfile,
  setPerfProfileFromSetting,
} from './perfProfile.ts'
import { defaultSettings } from './progressSchema.ts'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

test('W8.4 — the DEFAULT is the fast path, from every direction', () => {
  // Never set (the case for every existing child — this is an optional field with no migration).
  assert.equal(perfProfileFor(undefined), FAST_PROFILE)
  // Explicitly on.
  assert.equal(perfProfileFor(true), FAST_PROFILE)
  // Only an explicit `false` falls back.
  assert.equal(perfProfileFor(false), LEGACY_PROFILE)
  // A fresh document does not opt out either.
  assert.notEqual(defaultSettings().smoothGraphics, false)
  // And the live profile starts fast, before anything has attached.
  resetPerfProfile()
  assert.equal(perfProfile(), FAST_PROFILE)
})

test('W8.4 — every flag in the fast profile is ON, and the legacy profile is its exact inverse', () => {
  // Pin the VALUES, not just the agreement: two objects that moved together would satisfy a
  // "they differ" assertion while both describing the slow path.
  for (const [flag, value] of Object.entries(FAST_PROFILE)) {
    assert.equal(value, true, `FAST_PROFILE.${flag} is not the fast setting`)
  }
  for (const [flag, value] of Object.entries(LEGACY_PROFILE)) {
    assert.equal(value, false, `LEGACY_PROFILE.${flag} is not the legacy setting`)
  }
  assert.deepEqual(Object.keys(FAST_PROFILE), Object.keys(LEGACY_PROFILE))
})

test('W8.4 — publishing the setting reports whether it actually changed', () => {
  // The report is what stops a re-render on every progressStore notify (which fires constantly).
  resetPerfProfile()
  assert.equal(setPerfProfileFromSetting(undefined), false, 'no change when already fast')
  assert.equal(setPerfProfileFromSetting(true), false, 'no change when already fast')
  assert.equal(setPerfProfileFromSetting(false), true, 'falling back must report a change')
  assert.equal(perfProfile(), LEGACY_PROFILE)
  assert.equal(setPerfProfileFromSetting(false), false, 'no change when already legacy')
  assert.equal(setPerfProfileFromSetting(true), true, 'returning to fast must report a change')
  resetPerfProfile()
})

// ---------------------------------------------------------------------------------------------
// The MECHANISM-ONLY bound.
//
// A `perfProfile()` read inside a layout-affecting `sx` key would make the legacy branch a second
// LAYOUT, and the whole verification argument collapses with it. These are the only files allowed to
// read the profile at all, and each read is checked against the keys below.
const LAYOUT_KEYS = [
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'top', 'right', 'bottom', 'left', 'inset',
  'gap', 'rowGap', 'columnGap',
  'padding', 'margin', 'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr',
  'position', 'display', 'flex', 'flexDirection', 'gridTemplateColumns', 'gridTemplateRows',
  'fontSize', 'lineHeight',
]

const PROFILE_READERS = [
  'theme/idleMotion.ts',
  'components/common/scene/ParallaxLayer.tsx',
  'components/common/scene/PersistentWorld.tsx',
  // Reads the LABEL only, not the branch.
  'components/adult/panes/UdseendePane.tsx',
  'theme/ThemeProvider.tsx',
]

test('W8.4 — no perfProfile read sits inside a layout-affecting sx key', () => {
  for (const rel of PROFILE_READERS) {
    const code = codeOf(rel)
    for (const line of code.split('\n')) {
      if (!/perfProfile\(\)/.test(line)) continue
      for (const key of LAYOUT_KEYS) {
        assert.ok(
          !new RegExp(`\\b${key}\\s*:`).test(line),
          `${rel}: a perfProfile read decides a LAYOUT key (${key}) — the legacy path may switch the ` +
            `animation MECHANISM or a compositing promotion, never a size, position, count or existence:\n  ${line.trim()}`,
        )
      }
    }
  }
})

test('W8.4 — only the declared files read the profile at all', () => {
  // A new reader is not forbidden, but it must be ADDED here so the layout check above covers it —
  // otherwise the bound quietly stops being enforced where it matters most.
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
    }
    return out
  }
  const readers: string[] = []
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).replace(/\\/g, '/')
    if (rel === 'config/perfProfile.ts') continue
    if (/perfProfile|PerfProfile|SMOOTH_GRAPHICS/.test(codeOf(rel))) readers.push(rel)
  }
  assert.deepEqual(
    readers.sort(),
    [...PROFILE_READERS].sort(),
    'a new file reads perfProfile — add it to PROFILE_READERS so the layout-key check covers it',
  )
})

test('W8.4 — the profile is RENDERING only: it never reaches XP, difficulty, narration or a round', () => {
  // The forbidden direction, checked at the source of each: a game-logic module must not know this
  // setting exists. A toggle that changed a round outcome would make the two paths two DIFFERENT GAMES.
  for (const rel of [
    'config/progression.ts',
    'config/difficulty.ts',
    'hooks/useRound.ts',
    'services/ttsClient.ts',
    'services/progressStore.ts',
  ]) {
    const code = codeOf(rel)
    assert.ok(
      !/perfProfile|smoothGraphics/.test(code),
      `${rel} reads the rendering profile — it must not: this switch changes how things are DRAWN only`,
    )
  }
  // And the reverse: the profile module imports nothing from the game/progress layer, so it cannot.
  const profile = codeOf('config/perfProfile.ts')
  assert.ok(!/^import/m.test(profile), 'perfProfile.ts must stay pure — it imports something now')
})
