import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DOORS,
  SECTION_MENU_ROUTE,
  allDoorNameLines,
  doorAtRoute,
  doorOf,
  menuRouteFor,
  paletteAliasFor,
  primarySectionFor,
  sectionOfGame,
  tileIdOfGame,
} from './doors.ts'
import { existsSync, readFileSync } from 'node:fs'
import { categoryThemes, doorTiles, getCategoryTheme, setCategoryPaletteAlias } from './categoryThemes.ts'
import { SECTION_IDS } from './progressSchema.ts'

// Every shipped game, from the menu content — the set a door may neither drop nor duplicate.
const shippedGameIds = (): string[] =>
  SECTION_IDS.flatMap((s) => categoryThemes[s].games.map((g) => `${s}.${g.id}`))

test('every shipped game stands behind exactly one door, and no door lists a game that does not exist', () => {
  const listed = DOORS.flatMap((d) => d.games)
  assert.deepEqual([...listed].sort(), shippedGameIds().sort())
  assert.equal(new Set(listed).size, listed.length, 'a gameId is listed twice')
  for (const d of DOORS) {
    for (const id of d.games) assert.ok(d.members.includes(sectionOfGame(id)), `${id} sits in ${d.id} but its section is not a member`)
  }
})

test('every section belongs to exactly one door', () => {
  for (const s of SECTION_IDS) {
    assert.equal(DOORS.filter((d) => d.members.includes(s)).length, 1, s)
    assert.ok(doorOf(s).members.includes(s))
  }
})

// The owner's decisions, pinned literally (PRD §2 D1, D3) — order IS the clustering in a plain grid.
test('the four doors, their labels and their order are the owner\'s', () => {
  assert.deepEqual(
    DOORS.map((d) => [d.id, d.label, d.route]),
    [
      ['letters', 'Bogstaver og Ord', '/alphabet'],
      ['math', 'Tal', '/math'],
      ['english', 'Engelsk', '/english'],
      ['colors', 'Farver og Krea', '/farver'],
    ],
  )
  assert.deepEqual(doorOf('alphabet').games, ['alphabet.learn', 'alphabet.quiz', 'alphabet.memory', 'ordleg.read', 'ordleg.spelling'])
  assert.deepEqual(doorOf('krea').games, [
    'colors.laer', 'colors.farvequiz', 'colors.farvejagt', 'colors.nuancer', 'colors.ram-farven',
    'krea.draw', 'krea.guide', 'krea.color', 'krea.beads',
  ])
})

test('a merged door wears its primary section, and its menu is the primary\'s old route', () => {
  for (const d of DOORS) {
    assert.ok(d.members.includes(d.primary))
    assert.equal(d.route, SECTION_MENU_ROUTE[d.primary])
    assert.equal(doorAtRoute(d.route), d)
  }
  assert.equal(primarySectionFor('ordleg', true), 'alphabet')
  assert.equal(primarySectionFor('krea', true), 'colors')
})

// With the gate off (production until v1.3), nothing may move: each section is its own place.
test('with four doors OFF every section keeps its own menu and colours', () => {
  for (const s of SECTION_IDS) {
    assert.equal(menuRouteFor(s, false), SECTION_MENU_ROUTE[s])
    assert.equal(primarySectionFor(s, false), s)
  }
  assert.equal(menuRouteFor('ordleg', false), '/ordleg')
  assert.equal(menuRouteFor('krea', false), '/krea')
})

test('with four doors ON a game\'s back arrow lands on its door, never on a retired menu', () => {
  assert.equal(menuRouteFor('ordleg', true), '/alphabet')
  assert.equal(menuRouteFor('krea', true), '/farver')
  const routes = new Set(DOORS.map((d) => d.route))
  for (const s of SECTION_IDS) assert.ok(routes.has(menuRouteFor(s, true)), s)
  assert.ok(!routes.has('/ordleg') && !routes.has('/krea'))
})

// A3: with four doors Ordleg/Krea wear their door's colours, but keep their own names and games.
test('the palette alias swaps COLOURS only, and is empty with four doors off', () => {
  assert.deepEqual(paletteAliasFor(false), {})
  assert.deepEqual(paletteAliasFor(true), { ordleg: 'alphabet', krea: 'colors' })
  try {
    setCategoryPaletteAlias(paletteAliasFor(true))
    const ordleg = getCategoryTheme('ordleg')
    const alphabet = getCategoryTheme('alphabet')
    assert.equal(ordleg.accentColor, alphabet.accentColor)
    assert.equal(ordleg.gradient, alphabet.gradient)
    assert.equal(ordleg.name, 'Ordleg')
    assert.deepEqual(ordleg.games, categoryThemes.ordleg.games)
    assert.equal(getCategoryTheme('krea').accentColor, getCategoryTheme('colors').accentColor)
  } finally {
    setCategoryPaletteAlias({})
  }
  assert.notEqual(getCategoryTheme('ordleg').accentColor, getCategoryTheme('alphabet').accentColor)
})

// T2/T3: a door's tiles resolve to the right section's game, and each has its own baked icon — keyed
// by the full gameId, since `alphabet.memory` and `math.memory` share a bare id.
test('every door tile resolves to its own section\'s game and its own icon art', () => {
  const iconDir = new URL('../assets/themes/icons/games/', import.meta.url)
  for (const d of DOORS) {
    const tiles = doorTiles(d.games)
    assert.deepEqual(tiles.map((t) => t.gameId), [...d.games])
    for (const t of tiles) {
      assert.equal(t.section, sectionOfGame(t.gameId))
      assert.equal(`${t.section}.${t.game.id}`, t.gameId)
      assert.ok(existsSync(new URL(`${t.gameId}.webp`, iconDir)), `no icon for ${t.gameId}`)
    }
  }
  assert.throws(() => doorTiles(['alphabet.read']), /no such game/)
})

// D7: every door has its own baked picture, and Bogstaver og Ord shows the books+letters render — not
// the plain book stack it borrowed while the render was owed. Read as TEXT: the manifest imports WebP.
test('every door has door art, and Bogstaver og Ord has its own render', () => {
  const manifest = readFileSync(new URL('../assets/themes/icons/index.ts', import.meta.url), 'utf8')
  const block = manifest.slice(manifest.indexOf('export const doorIconImages'))
  const body = block.slice(0, block.indexOf('}'))
  for (const d of DOORS) assert.match(body, new RegExp(`\\b${d.id}\\b`), `door "${d.id}" has no art entry`)
  assert.match(body, /^\s*letters,\s*$/m, 'Bogstaver og Ord is not wired to its own render')
  assert.match(manifest, /^import letters from '\.\/letters\.webp'$/m)
  assert.ok(existsSync(new URL('../assets/themes/icons/letters.webp', import.meta.url)), 'letters.webp missing')
})

test('gameId helpers split on the FIRST dot only', () => {
  assert.equal(sectionOfGame('colors.ram-farven'), 'colors')
  assert.equal(tileIdOfGame('colors.ram-farven'), 'ram-farven')
  assert.equal(tileIdOfGame('ordleg.read'), 'read')
})

test('the spoken door names are the labels, one per door', () => {
  assert.deepEqual(allDoorNameLines(), ['Bogstaver og Ord', 'Tal', 'Engelsk', 'Farver og Krea'])
})

// audio-system.md protocol steps 3–5: the enumerator bakes exactly these strings, and each one ships
// as a prebaked clip — a door name that reached live Azure would be SILENT for a guest.
test('every door name is enumerated for prebake and present in the prebaked manifest', async () => {
  const { collectNarrationClips } = await import('../../shared-narration-clips.js')
  const clips = collectNarrationClips() as Array<{ text: string; key: string }>
  const manifest = readFileSync(new URL('./prebakedTts.ts', import.meta.url), 'utf8')
  for (const line of allDoorNameLines()) {
    const clip = clips.find((c) => c.text === line)
    assert.ok(clip, `"${line}" is not enumerated`)
    assert.ok(manifest.includes(clip.key), `"${line}" (${clip.key}) is not prebaked — run npm run tts:prebake`)
  }
})
