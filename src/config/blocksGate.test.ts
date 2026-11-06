import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { showsBlocks, gameShown, BLOCKS_GAME_ID, BLOCKS_ROUTE } from './blocksGate.ts'
import { DOORS } from './doors.ts'
import { ROUTE_EVENTS } from './usageEvents.ts'

const strip = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const src = (rel: string): string => strip(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'))

test('Byggeklodser is hidden on a production build and shown on staging, dev and the harness', () => {
  assert.equal(showsBlocks('production', false, false), false)
  assert.equal(showsBlocks('staging', false, false), true)
  assert.equal(showsBlocks('production', true, false), true)
  assert.equal(showsBlocks('production', false, true), true)
})

test('the menu filter drops only Byggeklodser, and only while the gate is shut', () => {
  assert.equal(gameShown(BLOCKS_GAME_ID, false), false)
  assert.equal(gameShown(BLOCKS_GAME_ID, true), true)
  for (const d of DOORS) for (const id of d.games) if (id !== BLOCKS_GAME_ID) assert.equal(gameShown(id, false), true, id)
})

// The truth table proves nothing if nobody asks it. Every surface (PRD-03 §4.10): the route, the menu
// tile, the usage event. The picker deep link (`?motiv=`) lives on the gated route, so it inherits it.
test('the gate guards the route, the menu tile and the usage event', () => {
  const app = src('App.tsx')
  assert.match(app, new RegExp(String.raw`path="${BLOCKS_ROUTE}"\s+element=\{blocksShown\(\) \? <ByggeklodserGame />`), 'the route is not gated')
  assert.match(app, /=== BLOCKS_ROUTE && !blocksShown\(\)\) return\s+reportRoute\(/, 'the usage event is not gated')
  const menu = src('components/common/GameSelectionLayout.tsx')
  assert.match(menu, /\.filter\(\(t\) => gameShown\(t\.gameId, showBlocks\)\)/, 'the menu does not filter its tiles')
  assert.match(menu, /const showBlocks = blocksShown\(\)/)
  assert.match(src('utils/blocksShown.ts'), /showsBlocks\(BL_TIER, DEV, false\)/, 'the binding does not ask the pure gate')
  assert.equal(ROUTE_EVENTS[BLOCKS_ROUTE], 'route:krea_blocks')
})
