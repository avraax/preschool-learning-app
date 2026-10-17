import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { newSeen, newSeenKeyFor } from './newSeen.ts'

// A tiny in-memory localStorage — Node has none.
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

beforeEach(() => {
  newSeen.detach()
  mem.clear()
})

test('inert until a child is attached: nothing opened, writes dropped', () => {
  newSeen.markOpened('krea.draw')
  assert.equal(newSeen.opened().size, 0)
  assert.equal(mem.size, 0)
})

test('opening a game is remembered per child and survives a re-attach', () => {
  newSeen.attach('kid-a')
  newSeen.markOpened('krea.draw')
  assert.ok(newSeen.opened().has('krea.draw'))
  newSeen.attach('kid-b')
  assert.equal(newSeen.opened().size, 0, 'a sibling still sees the stars')
  newSeen.attach('kid-a')
  assert.ok(newSeen.opened().has('krea.draw'), 'persisted for the first child')
  assert.deepEqual(JSON.parse(mem.get(newSeenKeyFor('kid-a'))!), ['krea.draw'])
})

test('clear (reset / child deleted) brings the stars back for that child only', () => {
  newSeen.attach('kid-b')
  newSeen.markOpened('math.boat')
  newSeen.attach('kid-a')
  newSeen.markOpened('krea.beads')
  newSeen.clear('kid-a')
  assert.equal(newSeen.opened().size, 0)
  assert.ok(mem.has(newSeenKeyFor('kid-b')))
  assert.ok(!mem.has(newSeenKeyFor('kid-a')))
})

test('malformed storage starts empty instead of throwing', () => {
  mem.set(newSeenKeyFor('kid-c'), '{not json')
  newSeen.attach('kid-c')
  assert.equal(newSeen.opened().size, 0)
})
