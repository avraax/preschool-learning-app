import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { showsKrea, KREA_ROUTES } from './kreaGate.ts'
import { sectionForGameId } from '../services/progressStore.ts'
import { SECTION_IDS } from './progressSchema.ts'

const strip = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const src = (rel: string): string => strip(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'))

test('Krea is hidden on a production build and shown on staging, dev and the harness', () => {
  assert.equal(showsKrea('production', false, false), false)
  assert.equal(showsKrea('staging', false, false), true)
  assert.equal(showsKrea('production', true, false), true)
  assert.equal(showsKrea('production', false, true), true)
})

// The truth table proves nothing if nobody asks it. Three doors: the home object, the menu route and
// every game route — a deep link must not reach a studio production cannot otherwise see.
test('the gate guards the home object AND every Krea route', () => {
  const app = src('App.tsx')
  for (const route of KREA_ROUTES) {
    assert.match(app, new RegExp(String.raw`path="${route}"[^>]*element=\{\s*kreaShown\(\)`), `${route} is not gated`)
  }
  const routesInApp = [...app.matchAll(/path="(\/krea[^"]*)"/g)].map((m) => m[1])
  assert.deepEqual(routesInApp.sort(), [...KREA_ROUTES].sort(), 'a Krea route exists that the gate list does not name')
  const home = src('components/home/HomePage.tsx')
  assert.match(home, /c\.id !== 'krea' \|\| SHOW_KREA/, 'the home card list does not filter Krea through the gate')
  // The arc follows the four-door gate, which RIDES the Krea gate (Category restructure PRD-01 D8):
  // one gate to delete at release, so the four doors can never appear without Krea or vice versa.
  assert.match(home, /homeAnchorsFor\(theme\.scene, FOUR_DOORS\)/, 'the home arc does not follow the gate')
  assert.match(home, /const FOUR_DOORS = fourDoorsShown\(\)/)
  assert.match(src('utils/fourDoors.ts'), /export const fourDoorsShown = \(\): boolean => kreaShown\(\)/, 'four doors no longer ride the Krea gate')
  assert.match(home, /const SHOW_KREA = kreaShown\(\)/)
  assert.match(src('utils/kreaShown.ts'), /showsKrea\(BL_TIER, DEV, false\)/, 'the binding does not ask the pure gate')
})

// `sectionForGameId` FALLS BACK TO 'alphabet' for an unknown head, silently: until `krea` is a
// section, every Krea XP would bloom Alphabet's world with no error anywhere (§4.1).
test('krea.* XP lands in the krea section, not the silent alphabet fallback', () => {
  assert.ok(SECTION_IDS.includes('krea'))
  for (const id of ['krea.draw', 'krea.guide', 'krea.color', 'krea.beads']) {
    assert.equal(sectionForGameId(id), 'krea', id)
  }
})
