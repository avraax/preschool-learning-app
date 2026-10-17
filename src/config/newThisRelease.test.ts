import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NEW_GAME_IDS, NEW_RELEASE, isNewDoor, isNewGame } from './newThisRelease.ts'
import { DOORS } from './doors.ts'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }

// The whole point of this module: the glow is for ONE release. When package.json moves to 1.4.0 this
// goes red — empty NEW_GAME_IDS (or retarget NEW_RELEASE at what 1.4 adds) before shipping.
test('the "new" glow belongs to the release being built — remove it when the version moves on', () => {
  const [major, minor] = pkg.version.split('.')
  assert.equal(
    `${major}.${minor}`,
    NEW_RELEASE,
    `package.json is ${pkg.version} but the glow is still marking ${NEW_RELEASE}'s games — empty NEW_GAME_IDS in newThisRelease.ts`,
  )
})

test('1.3 marks the four Krea games and Fyld Båden, and they all exist behind a door', () => {
  assert.deepEqual([...NEW_GAME_IDS].sort(), ['krea.beads', 'krea.color', 'krea.draw', 'krea.guide', 'math.boat'])
  const all = new Set(DOORS.flatMap((d) => d.games))
  for (const id of NEW_GAME_IDS) assert.ok(all.has(id), `${id} is not behind any door`)
  assert.equal(isNewGame('krea.draw'), true)
  assert.equal(isNewGame('alphabet.quiz'), false)
})

test('exactly the doors holding a new game glow: Tal and Farver og Krea', () => {
  assert.deepEqual(DOORS.filter((d) => isNewDoor(d.id)).map((d) => d.id), ['math', 'colors'])
})
