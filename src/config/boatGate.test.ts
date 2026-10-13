import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { showsBoatGame, BOAT_ROUTE, BOAT_TILE_ID } from './boatGate.ts'

const strip = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const src = (rel: string): string => strip(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'))

test('Fyld Båden is hidden on a production build and shown on staging, dev and the harness', () => {
  assert.equal(showsBoatGame('production', false, false), false)
  assert.equal(showsBoatGame('staging', false, false), true)
  assert.equal(showsBoatGame('production', true, false), true)
  assert.equal(showsBoatGame('production', false, true), true)
})

// The truth table proves nothing if nobody asks it. Both doors are gated: a tile alone would leave the
// deep link open on production, and a route alone would show a tile that leads nowhere.
test('the gate guards BOTH the menu tile and the route', () => {
  const app = src('App.tsx')
  assert.match(app, new RegExp(`path="${BOAT_ROUTE}"[^>]*element=\\{\\s*boatGameShown\\(\\)`), 'the /math/boat route is not gated')
  const menu = src('components/common/GameSelectionLayout.tsx')
  assert.match(menu, /\.id !== BOAT_TILE_ID \|\| boatGameShown\(\)/, 'the menu does not filter the boat tile through the gate')
  assert.match(src('utils/boatGame.ts'), /showsBoatGame\(BL_TIER, DEV, false\)/, 'the binding does not ask the pure gate')
  assert.equal(BOAT_TILE_ID, 'boat')
})
