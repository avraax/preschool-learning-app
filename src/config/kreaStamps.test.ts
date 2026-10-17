import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { KREA_STAMP_IDS, KREA_STAMP_NAME } from './kreaStamps.ts'
import { allKreaLines } from './kreaPhrases.ts'

// Every picture in the tray is named, the name is enumerated for prebake, and the tray's ids are exactly
// these — a picture added to the tray without a name would be picked in silence.
test('every Fri Tegning picture has a spoken name, baked, and the tray uses exactly these ids', () => {
  const lines = new Set(allKreaLines())
  for (const id of KREA_STAMP_IDS) assert.ok(lines.has(KREA_STAMP_NAME[id]), `${id} is not enumerated`)
  const tray = readFileSync(new URL('../components/krea/studio/stamps.ts', import.meta.url), 'utf8')
  const ids = [...tray.matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(ids.sort(), [...KREA_STAMP_IDS].sort())
  const game = readFileSync(new URL('../components/krea/FriTegningGame.tsx', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')
  assert.match(game, /audio\.speak\(name\)/, 'picking a picture no longer says its name')
})
