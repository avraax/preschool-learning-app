// `progressStore.adoptDocument()` — the guest→first-child book copy (adult-login-visibility PRD §7/W6).
//
// SEPARATE FILE from progressStore.test.ts on purpose: this one installs a fake `localStorage` on
// globalThis, and that store's other tests deliberately run WITHOUT storage (their writes are swallowed
// by the same try/catch a private-mode iPad hits). node:test runs each file in its own process, so the
// global here cannot leak into theirs.
//
// The thing these tests exist to catch is a copy that LOOKS successful while silently dropping the
// per-device G-Counter ledger. `grantedSlots` and the derived reward number are both re-read from that
// ledger, so a test seeded with the wrong document SHAPE stays green while adoption loses every reward.

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// The fake must exist BEFORE progressStore is imported: the module installs lifecycle hooks and
// `getDeviceId()` reads storage on first call.
class FakeStorage {
  private map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v))
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  clear(): void {
    this.map.clear()
  }
}
const storage = new FakeStorage()
;(globalThis as unknown as { localStorage: FakeStorage }).localStorage = storage

const { progressStore } = await import('./progressStore.ts')
const { defaultPersisted, progressKeyFor, normalizePersisted, totalSlots, totalXp } = await import(
  '../config/progressSchema.ts'
)
const { getDeviceId } = await import('./deviceId.ts')
const { rewardNumber } = await import('../config/progression.ts')

const GUEST = 'local-guest'
const CHILD = 'child-1'

/**
 * A guest book with real play in it, keyed under THIS device — the case that matters, because the
 * child's own book on the same iPad would key the identical ledger entry.
 */
const seedGuestBook = (xp = 240, slots = 3): void => {
  const doc = defaultPersisted(GUEST, getDeviceId(), 1_700_000_000_000)
  doc.ledger[getDeviceId()] = { xp, slots, bloom: { alphabet: xp } }
  doc.stickers.grantedSlots = slots
  doc.stickers.firstAt = { 'dyr-hund': 1_700_000_000_001, 'dyr-kat': 1_700_000_000_002, 'dyr-hest': 1_700_000_000_003 }
  doc.stickers.seenThroughSlot = 1
  doc.sync = { ...doc.sync, rev: 12, syncedRev: 12, serverRev: 9, epoch: 2 }
  storage.setItem(progressKeyFor(GUEST), JSON.stringify(doc))
}

const readDoc = (profileId: string) => {
  const raw = storage.getItem(progressKeyFor(profileId))
  return raw ? normalizePersisted(JSON.parse(raw)) : null
}

beforeEach(() => {
  storage.removeItem(progressKeyFor(GUEST))
  storage.removeItem(progressKeyFor(CHILD))
})

test('the happy path: the whole document moves, and the LEDGER moves intact', () => {
  seedGuestBook()
  const before = readDoc(GUEST)!

  assert.equal(progressStore.adoptDocument(GUEST, CHILD), true)

  const after = readDoc(CHILD)!
  // Σ ledger.xp and Σ ledger.slots are what every reward surface is derived from. A copy that dropped
  // the ledger would still produce a valid-looking document with an empty book.
  assert.equal(totalXp(after), totalXp(before))
  assert.equal(totalSlots(after), totalSlots(before))
  assert.equal(totalXp(after), 240)
  assert.equal(totalSlots(after), 3)
  assert.deepEqual(after.ledger, before.ledger)
  // grantedSlots === Σ ledger.slots holds BY CONSTRUCTION, because nothing was granted by hand.
  assert.equal(after.stickers.grantedSlots, totalSlots(after))
  assert.equal(rewardNumber(totalSlots(after)), rewardNumber(totalSlots(before)))
  // The book's identity: which pictures, and when each was first seen.
  assert.deepEqual(after.stickers.firstAt, before.stickers.firstAt)
  assert.equal(after.stickers.seenThroughSlot, before.stickers.seenThroughSlot)
  // (`totals`/`perGame` left the document with the round — Endless Play PRD-01 W3. The book, the
  // ledger and the explored set are the whole of a child's progress now.)
})

test('the copy is re-stamped for the new owner', () => {
  seedGuestBook()
  assert.equal(progressStore.adoptDocument(GUEST, CHILD), true)
  assert.equal(readDoc(CHILD)!.profileId, CHILD)
})

test('the copy is never-synced-and-DIRTY, so it actually pushes', () => {
  seedGuestBook()
  assert.equal(progressStore.adoptDocument(GUEST, CHILD), true)
  const after = readDoc(CHILD)!
  assert.equal(after.sync.serverRev, 0)
  assert.equal(after.sync.syncedRev, 0)
  // `rev` is KEPT: with syncedRev >= rev the document reads CLEAN and is never pushed at all — the
  // failure mode is silent, so it is pinned here as an inequality, not just as two zeroes.
  assert.ok(after.sync.rev > after.sync.syncedRev, 'the adopted book reads clean and will never push')
  assert.equal(after.sync.originDevice, getDeviceId())
})

test('sync.epoch is carried AS-IS, never normalised to 0', () => {
  // If the guest ever used "Nulstil fremgang", that epoch is load-bearing: a higher epoch wins
  // wholesale, and resetting it lets a stale state resurrect.
  seedGuestBook()
  assert.equal(progressStore.adoptDocument(GUEST, CHILD), true)
  assert.equal(readDoc(CHILD)!.sync.epoch, 2)
})

test('the SOURCE key is left byte-identical', () => {
  seedGuestBook()
  const before = storage.getItem(progressKeyFor(GUEST))
  assert.equal(progressStore.adoptDocument(GUEST, CHILD), true)
  assert.equal(storage.getItem(progressKeyFor(GUEST)), before)
})

test('refuses when the target already has a book, and writes nothing', () => {
  seedGuestBook()
  const existing = defaultPersisted(CHILD, getDeviceId(), 1_700_000_100_000)
  existing.stickers.grantedSlots = 0
  storage.setItem(progressKeyFor(CHILD), JSON.stringify(existing))
  const snapshot = storage.getItem(progressKeyFor(CHILD))

  assert.equal(progressStore.adoptDocument(GUEST, CHILD), false)
  assert.equal(storage.getItem(progressKeyFor(CHILD)), snapshot)
})

test('refuses when there is no source book at all', () => {
  assert.equal(progressStore.adoptDocument(GUEST, CHILD), false)
  assert.equal(storage.getItem(progressKeyFor(CHILD)), null)
})

test('refuses a document that violates the progress invariants, rather than stranding the child', () => {
  // A 422 from `progressInvariantViolations` is the ONE server error progressSync deliberately does
  // not retry: the child would stop syncing, with no visible symptom at all.
  //
  // The violation has to be one `normalizePersisted` does NOT repair, or this test passes vacuously.
  // It repairs the display cursor (`grantedSlots` ← Σ ledger.slots) and clamps `seenThroughSlot`, but
  // it never cross-checks slots against XP — so 5 slots handed over on 10 XP survives normalisation
  // and breaks `slots ≤ collectedFromLevel(levelFromXp(xp))`.
  seedGuestBook()
  const doc = JSON.parse(storage.getItem(progressKeyFor(GUEST))!) as {
    ledger: Record<string, { xp: number; slots: number; bloom: Record<string, number> }>
  }
  doc.ledger[getDeviceId()] = { xp: 10, slots: 5, bloom: { alphabet: 10 } }
  storage.setItem(progressKeyFor(GUEST), JSON.stringify(doc))

  assert.equal(progressStore.adoptDocument(GUEST, CHILD), false)
  assert.equal(storage.getItem(progressKeyFor(CHILD)), null)
})

test('refuses a non-v4 blob (clean sheet: it normalises to null)', () => {
  storage.setItem(progressKeyFor(GUEST), JSON.stringify({ version: 3, stickers: { collected: {} } }))
  assert.equal(progressStore.adoptDocument(GUEST, CHILD), false)
  assert.equal(storage.getItem(progressKeyFor(CHILD)), null)
})

test('refuses a same-profile or empty-id copy', () => {
  seedGuestBook()
  assert.equal(progressStore.adoptDocument(GUEST, GUEST), false)
  assert.equal(progressStore.adoptDocument('', CHILD), false)
  assert.equal(progressStore.adoptDocument(GUEST, ''), false)
})
