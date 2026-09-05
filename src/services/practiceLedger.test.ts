// The practice ledger's persistence, its cap, and — the two that matter — that a reset and a deleted
// child really take it with them (Practice Loop PRD-01 W2 §4.2).
//
// The same localStorage shim as `progressStoreProfiles.test.ts`, installed BEFORE the imports: the
// ledger's storage access is try/catch-guarded, so under plain Node it would silently run in-memory only
// and every key/erasure assertion here would be vacuous.

interface Store {
  [k: string]: string
}
const disk: Store = {}
const shim = {
  getItem: (k: string) => (k in disk ? disk[k] : null),
  setItem: (k: string, v: string) => {
    disk[k] = String(v)
  },
  removeItem: (k: string) => {
    delete disk[k]
  },
  clear: () => {
    for (const k of Object.keys(disk)) delete disk[k]
  },
  key: (i: number) => Object.keys(disk)[i] ?? null,
  get length() {
    return Object.keys(disk).length
  },
}
;(globalThis as unknown as { localStorage: typeof shim }).localStorage = shim

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_ENTRIES, practiceLedger } from './practiceLedger.ts'
import { progressStore } from './progressStore.ts'
import { practiceKeyFor } from '../config/practiceSchema.ts'

const KID = 'kid-1'

// DETACH BEFORE CLEARING: detach flushes, so clearing first lets the previous test's entries land back
// on "disk" and be read straight back by the attach below. (That ordering silently carried state between
// three of these tests before it was fixed.)
beforeEach(() => {
  practiceLedger.detach()
  shim.clear()
  practiceLedger.attach(KID)
})

test('it is INERT until attached — no key, no writes', () => {
  practiceLedger.detach()
  practiceLedger.recordAttempt('alphabet.quiz', 'Æ', false)
  assert.equal(practiceLedger.missesFor('alphabet.quiz', 'Æ'), 0)
  assert.equal(Object.keys(disk).length, 0)
})

test('a wrong tap is a miss, a first-try tap is a seen', () => {
  practiceLedger.recordAttempt('alphabet.quiz', 'Æ', false)
  practiceLedger.recordAttempt('alphabet.quiz', 'Æ', false)
  practiceLedger.recordAttempt('alphabet.quiz', 'B', true)
  assert.equal(practiceLedger.missesFor('alphabet.quiz', 'Æ'), 2)
  assert.equal(practiceLedger.entryFor('alphabet.quiz', 'Æ')?.seen, 0)
  assert.equal(practiceLedger.missesFor('alphabet.quiz', 'B'), 0)
  assert.equal(practiceLedger.entryFor('alphabet.quiz', 'B')?.seen, 1)
  // Keyed per GAME: the same item in another game is a separate record (Æ in Bogstav Quiz says nothing
  // about Æ in Hukommelse).
  assert.equal(practiceLedger.missesFor('ordleg.read', 'Æ'), 0)
})

test('a game whose prompts are not pool-drawn records nothing', () => {
  // The ledger's only consumer is a prompt bag. Recording the math generators — a parameter SPACE, not a
  // content list — would push the entries a bag CAN use out through the cap.
  practiceLedger.recordAttempt('math.addition', '7', false)
  practiceLedger.recordAttempt('math.counting', '42', false)
  assert.equal(practiceLedger.size(), 0)
  // …while a pool-drawn game does record.
  practiceLedger.recordAttempt('colors.quiz', 'rød-æble', false)
  assert.equal(practiceLedger.size(), 1)
})

test('it persists under its OWN per-child key, and re-attaching reads it back', () => {
  practiceLedger.recordAttempt('alphabet.quiz', 'Æ', false)
  practiceLedger.flush()
  assert.ok(practiceKeyFor(KID) in disk, `nothing written to ${practiceKeyFor(KID)}`)
  // NOT in the synced progress document (PRD D2) — a scheduling hint must never acquire merge semantics.
  assert.ok(!(`bornelaering-progress:${KID}` in disk), 'the ledger leaked into the progress key')

  practiceLedger.detach()
  practiceLedger.attach(KID)
  assert.equal(practiceLedger.missesFor('alphabet.quiz', 'Æ'), 1)

  // Another child's ledger is a different key and starts empty.
  practiceLedger.attach('kid-2')
  assert.equal(practiceLedger.missesFor('alphabet.quiz', 'Æ'), 0)
})

test('the cap evicts the OLDEST-SEEN entries, not the most-missed', () => {
  // Ordering matters: evicting by insertion order would drop exactly the items still being practised.
  const pool = 'alphabet.quiz'
  for (let i = 0; i < MAX_ENTRIES + 25; i++) {
    practiceLedger.recordAttempt(pool, `item-${i}`, false)
  }
  assert.equal(practiceLedger.size(), MAX_ENTRIES)
  // The first 25 are gone (oldest `lastSeenAt`), the newest survive.
  assert.equal(practiceLedger.missesFor(pool, 'item-0'), 0)
  assert.equal(practiceLedger.missesFor(pool, `item-${MAX_ENTRIES + 24}`), 1)
})

test('resetAll takes the ledger with it', () => {
  // "Nulstil fremgang for {navn}" must not leave the app re-asking the letters the wiped run got wrong.
  progressStore.attach(KID)
  practiceLedger.recordAttempt('alphabet.quiz', 'Æ', false)
  practiceLedger.flush()
  assert.equal(practiceLedger.missesFor('alphabet.quiz', 'Æ'), 1)

  progressStore.resetAll('adult-confirmed')

  assert.equal(practiceLedger.missesFor('alphabet.quiz', 'Æ'), 0)
  assert.ok(!(practiceKeyFor(KID) in disk), 'the ledger key survived resetAll')
})

test('clear(id) erases a child who is not the attached one (profile deletion)', () => {
  // `profileStore.deleteProfile()` runs while a DIFFERENT child may be attached, so `clear` has to take
  // the id rather than assume the active one.
  practiceLedger.attach('kid-2')
  practiceLedger.recordAttempt('alphabet.quiz', 'B', false)
  practiceLedger.flush()
  practiceLedger.attach(KID)
  practiceLedger.recordAttempt('alphabet.quiz', 'Æ', false)
  practiceLedger.flush()

  practiceLedger.clear('kid-2')

  assert.ok(!(practiceKeyFor('kid-2') in disk), "the deleted child's ledger survived")
  assert.ok(practiceKeyFor(KID) in disk, "the ACTIVE child's ledger was erased too")
  assert.equal(practiceLedger.missesFor('alphabet.quiz', 'Æ'), 1)
})

test('a malformed blob starts empty instead of throwing', () => {
  disk[practiceKeyFor('kid-3')] = '{not json'
  practiceLedger.attach('kid-3')
  assert.equal(practiceLedger.size(), 0)
  disk[practiceKeyFor('kid-4')] = JSON.stringify({ 'alphabet.quiz:Æ': { misses: 'lots' } })
  practiceLedger.attach('kid-4')
  assert.equal(practiceLedger.size(), 0)
})
