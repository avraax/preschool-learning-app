import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { sectionForGameId } from '../services/progressStore.ts'
import { SECTION_IDS } from './progressSchema.ts'

const strip = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const src = (rel: string): string => strip(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'))

const KREA_ROUTES = ['/krea', '/krea/tegn', '/krea/tegnmedmig', '/krea/farvelaeg', '/krea/perler', '/krea/klodser']
// PENDING-RELEASE EXCEPTION slot: a Krea game still behind a staging gate is listed here (at most one)
// and must render as `xShown() ? <Game/> : <Navigate…>`. Empty since Byggeklodser shipped in 1.3.1.
const PENDING_RELEASE: string[] = []

// Krea shipped in 1.3 (the staging gate `kreaGate.ts` was deleted). A route that still redirects home, or
// a gate that comes back, would hide a released section on production with no error anywhere.
test('every Krea route renders its page, with no gate in front of it', () => {
  const app = src('App.tsx')
  for (const route of KREA_ROUTES) {
    const m = app.match(new RegExp(String.raw`path="${route}"\s+element=\{([^}]*)\}`))
    assert.ok(m, `${route} is missing`)
    assert.doesNotMatch(m[1], /Navigate|\?/, `${route} is still gated`)
  }
  assert.ok(PENDING_RELEASE.length <= 1, 'one pending-release exception at a time')
  for (const route of PENDING_RELEASE) {
    assert.match(app, new RegExp(String.raw`path="${route}"\s+element=\{\w+Shown\(\) \?`), `${route} is listed as pending but is not gated — release it properly`)
  }
  const routesInApp = [...app.matchAll(/path="(\/krea[^"]*)"/g)].map((r) => r[1])
  assert.deepEqual(routesInApp.sort(), [...KREA_ROUTES, ...PENDING_RELEASE].sort())
  assert.equal(existsSync(new URL('./kreaGate.ts', import.meta.url)), false, 'the Krea gate is back')
  assert.equal(existsSync(new URL('../utils/kreaShown.ts', import.meta.url)), false, 'the Krea gate binding is back')
  assert.equal(existsSync(new URL('./blocksGate.ts', import.meta.url)), false, 'the Byggeklodser gate is back')
  assert.equal(existsSync(new URL('../utils/blocksShown.ts', import.meta.url)), false, 'the Byggeklodser gate binding is back')
  assert.doesNotMatch(src('components/common/GameSelectionLayout.tsx'), /blocksShown|gameShown/)
  assert.doesNotMatch(src('components/home/HomePage.tsx'), /SHOW_KREA|kreaShown/)
})

// `sectionForGameId` FALLS BACK TO 'alphabet' for an unknown head, silently: until `krea` is a
// section, every Krea XP would bloom Alphabet's world with no error anywhere (§4.1).
test('krea.* XP lands in the krea section, not the silent alphabet fallback', () => {
  assert.ok(SECTION_IDS.includes('krea'))
  for (const id of ['krea.draw', 'krea.guide', 'krea.color', 'krea.beads', 'krea.blocks']) {
    assert.equal(sectionForGameId(id), 'krea', id)
  }
})
