import { test } from 'node:test'
import assert from 'node:assert/strict'
import { difficultyRows, playedLabels, rowLevel } from './adultSectionLabels.ts'

// Category restructure PRD-01 D10: the adult's rows follow what the child sees.
test('four doors → four difficulty rows named like the doors, each writing all its members', () => {
  const rows = difficultyRows(true, true)
  assert.deepEqual(rows.map((r) => r.label), ['Bogstaver og Ord', 'Tal', 'Engelsk', 'Farver og Krea'])
  assert.deepEqual(rows.find((r) => r.key === 'letters')!.members, ['alphabet', 'ordleg'])
  assert.deepEqual(rows.find((r) => r.key === 'colors')!.members, ['colors', 'krea'])
  assert.deepEqual([...rows.flatMap((r) => r.members)].sort(), ['alphabet', 'colors', 'english', 'krea', 'math', 'ordleg'])
})

test('without four doors the rows stay one per section, Krea only when shown', () => {
  assert.deepEqual(difficultyRows(false, false).map((r) => r.key), ['alphabet', 'math', 'colors', 'english', 'ordleg'])
  assert.deepEqual(difficultyRows(false, true).map((r) => r.key), ['alphabet', 'math', 'colors', 'english', 'ordleg', 'krea'])
  for (const r of difficultyRows(false, true)) assert.deepEqual(r.members, [r.key])
})

test('a door row shows the shared override, the primary\'s on a mismatch, and null when unset', () => {
  const letters = difficultyRows(true, true)[0]
  assert.equal(rowLevel(letters, {}), null)
  assert.equal(rowLevel(letters, { alphabet: 'svaer', ordleg: 'svaer' }), 'svaer')
  assert.equal(rowLevel(letters, { alphabet: 'let', ordleg: 'svaer' }), 'let')
  assert.equal(rowLevel(letters, { ordleg: 'normal' }), 'normal')
})

test('"har spillet" names doors with four doors on, deduped and in door order', () => {
  assert.deepEqual(playedLabels(['krea', 'ordleg', 'alphabet', 'colors'], true), ['Bogstaver og Ord', 'Farver og Krea'])
  assert.deepEqual(playedLabels(['krea', 'ordleg'], false), ['Krea', 'Ordleg'])
  assert.deepEqual(playedLabels([], true), [])
})
