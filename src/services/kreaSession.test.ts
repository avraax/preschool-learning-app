import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { kreaSession, kreaKey, type KeyValueStore } from './kreaSession.ts'

class MemStore implements KeyValueStore {
  m = new Map<string, string>()
  quota = Infinity
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) {
    if (v.length > this.quota) throw new Error('QuotaExceededError')
    this.m.set(k, v)
  }
  removeItem(k: string) { this.m.delete(k) }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  get length() { return this.m.size }
}

let store: MemStore
beforeEach(() => {
  kreaSession.detach()
  store = new MemStore()
  kreaSession.useStore(store)
})

test('saves and resumes per child × game × item', () => {
  kreaSession.attach('kid-a')
  assert.ok(kreaSession.save('krea.draw', 'paper', 'A1'))
  assert.equal(kreaSession.load('krea.draw', 'paper'), 'A1')
  assert.equal(kreaSession.load('krea.guide', 'kat'), null)
  assert.ok(store.m.has(kreaKey('kid-a', 'krea.draw', 'paper')))
})

test("a profile switch clears the previous child's drawings — a sibling never opens them", () => {
  kreaSession.attach('kid-a')
  kreaSession.save('krea.draw', 'paper', 'A1')
  kreaSession.save('krea.color', 'hund', 'A2')
  kreaSession.detach()
  assert.equal(store.length, 0)
  kreaSession.attach('kid-b')
  assert.equal(kreaSession.load('krea.draw', 'paper'), null)
  // …and straight from one child to another with no detach in between.
  kreaSession.save('krea.draw', 'paper', 'B1')
  kreaSession.attach('kid-c')
  assert.equal(store.length, 0)
})

test('detached, nothing is read or written', () => {
  assert.equal(kreaSession.save('krea.draw', 'paper', 'x'), false)
  assert.equal(kreaSession.load('krea.draw', 'paper'), null)
  assert.equal(store.length, 0)
})

test('a quota failure or a throwing store degrades to "no resume", never a throw', () => {
  kreaSession.attach('kid-a')
  kreaSession.save('krea.draw', 'paper', 'old')
  store.quota = 3
  assert.equal(kreaSession.save('krea.draw', 'paper', 'way too long'), false)
  assert.equal(kreaSession.load('krea.draw', 'paper'), null, 'a stale copy must not resume an older picture')
  const fail = () => { throw new Error('SecurityError') }
  const boom: KeyValueStore = { getItem: fail, setItem: fail, removeItem: fail, key: fail, get length(): number { return fail() } }
  kreaSession.useStore(boom)
  assert.doesNotThrow(() => {
    kreaSession.save('a', 'b', 'c')
    kreaSession.load('a', 'b')
    kreaSession.clear()
    kreaSession.clearItem('a', 'b')
  })
})

test('profileStore and resetAll drive the lifecycle (detach on switch/sign-out, clear on delete/reset)', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const profile = strip(readFileSync(new URL('./profileStore.ts', import.meta.url), 'utf8'))
  assert.equal((profile.match(/kreaSession\.attach\(id\)/g) ?? []).length, 1)
  assert.equal((profile.match(/kreaSession\.detach\(\)/g) ?? []).length, 2, 'clearSelection + signOut')
  assert.match(profile, /kreaSession\.clear\(id\)/)
  assert.match(strip(readFileSync(new URL('./progressStore.ts', import.meta.url), 'utf8')), /kreaSession\.clear\(prev\.profileId\)/)
  // Session-only means session-only: no durable storage anywhere in Krea's store.
  assert.doesNotMatch(strip(readFileSync(new URL('./kreaSession.ts', import.meta.url), 'utf8')), /localStorage|indexedDB/)
})
