// The store SURGERY itself (accounts PRD §5.4 / §5.7 / §10) — separate from the economy suite in
// progressStore.test.ts, which must keep passing unmodified in substance.
//
// A tiny localStorage shim: the real singleton's storage access is try/catch-guarded, so under plain
// Node it silently runs in-memory only — which would make the key-safety and cross-tab tests vacuous.
// Installing a shim BEFORE importing the store is what lets us assert what actually landed on "disk".

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
import { progressStore } from './progressStore.ts'
import { getDeviceId } from './deviceId.ts'
import {
  DEVICE_ID_KEY,
  SCHEMA_VERSION,
  defaultPersisted,
  progressKeyFor,
  totalSlots,
  totalXp,
  type PersistedProgress,
} from '../config/progressSchema.ts'
import { REWARD_XP } from '../config/progression.ts'

const readKey = (profileId: string): PersistedProgress | null => {
  const raw = disk[progressKeyFor(profileId)]
  return raw ? (JSON.parse(raw) as PersistedProgress) : null
}

beforeEach(() => {
  progressStore.detach()
  const deviceId = disk[DEVICE_ID_KEY]
  shim.clear()
  // Keep the device id: resetAll() must never clear it, and neither should a test.
  if (deviceId) disk[DEVICE_ID_KEY] = deviceId
})

test('INERT by default: every mutator is a no-op and nothing is written', () => {
  assert.equal(progressStore.isAttached(), false)
  assert.equal(progressStore.activeProfileId(), null)

  // A write while detached must be DROPPED, not applied to a phantom profile.
  progressStore.grantXp('alphabet', 500)
  progressStore.grantTaskXp('alphabet.quiz', { firstTry: true })
  progressStore.setSetting('sfxEnabled', false)
  progressStore.setDifficulty({ global: 'svaer' })
  progressStore.markLevelCelebrated(9)
  progressStore.markStickersSeen()
  progressStore.resetAll()
  assert.deepEqual(progressStore.grantPendingRewards(), [])
  assert.equal(progressStore.markBrowsed('alphabet', 'A'), false)

  assert.equal(progressStore.get().progression.globalXp, 0)
  assert.equal(progressStore.get().profileId, null)
  assert.equal(Object.keys(disk).filter((k) => k.startsWith('bornelaering-progress:')).length, 0)
})

test('getSnapshot returns a STABLE reference while detached (or useSyncExternalStore loops forever)', () => {
  const a = progressStore.get()
  const b = progressStore.get()
  assert.equal(a, b, 'the inert state must be the same object identity every call')
  progressStore.attach('kid-1')
  progressStore.detach()
  assert.equal(progressStore.get(), a, 'and the SAME object again after a detach')
})

test('recordRoundResult while detached returns a zero-effect result of the same SHAPE', () => {
  const out = progressStore.recordRoundResult('alphabet.quiz', {
    correct: 8,
    total: 8,
    longestStreak: 8,
  })
  // A caller mid-teardown must not crash on a missing field.
  assert.equal(out.stars, 3)
  assert.equal(out.anyNewBest, false)
  assert.equal(out.totals.totalStars, 0)
  assert.equal(out.xp.granted, 0)
  assert.equal(out.xp.global.levelAfter, 1)
})

test('attach is a PURE READ — no write, no reset', () => {
  progressStore.attach('kid-1')
  assert.equal(progressStore.isAttached(), true)
  assert.equal(progressStore.activeProfileId(), 'kid-1')
  assert.equal(progressStore.get().profileId, 'kid-1')
  assert.equal(readKey('kid-1'), null, 'attaching must not create the key')
})

test('attach is IDEMPOTENT (StrictMode double-invokes effects)', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP)
  const xp = progressStore.get().progression.globalXp
  assert.equal(xp, REWARD_XP)
  // A second attach with the SAME id must not re-hydrate and discard what was just committed.
  progressStore.attach('kid-1')
  assert.equal(progressStore.get().progression.globalXp, xp)
})

test('two profiles keep entirely separate books', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP * 3)
  progressStore.grantPendingRewards()
  progressStore.flush()
  assert.equal(progressStore.collectedCount(), 3)

  progressStore.attach('kid-2')
  assert.equal(progressStore.collectedCount(), 0, 'a fresh sibling starts empty')
  progressStore.grantXp('math', REWARD_XP)
  progressStore.grantPendingRewards()
  progressStore.flush()
  assert.equal(progressStore.collectedCount(), 1)

  progressStore.attach('kid-1')
  assert.equal(progressStore.collectedCount(), 3, 'the first child is untouched')

  assert.equal(totalSlots(readKey('kid-1')!), 3)
  assert.equal(totalSlots(readKey('kid-2')!), 1)
})

test('KEY SAFETY: a debounced write CANNOT land under the next profile’s key', () => {
  progressStore.attach('kid-1')
  // Commit WITHOUT flushing, so a 250ms timer is pending with kid-1's payload.
  progressStore.grantXp('alphabet', REWARD_XP * 5)
  assert.equal(readKey('kid-1'), null, 'still only in the pending buffer')

  // Switch child. attach() flushes first, and the payload was bound to its key at schedule time — so
  // even a timer that fired late could not write kid-1's book under kid-2's key.
  progressStore.attach('kid-2')
  progressStore.grantXp('math', REWARD_XP)
  progressStore.flush()

  assert.equal(totalXp(readKey('kid-1')!), REWARD_XP * 5, 'kid-1’s XP landed under kid-1')
  assert.equal(totalXp(readKey('kid-2')!), REWARD_XP, 'and kid-2 has only its own')
})

test('detach flushes, so a pending write is never lost on sign-out', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP * 2)
  progressStore.detach()
  assert.equal(totalXp(readKey('kid-1')!), REWARD_XP * 2)
})

test('the ledger is keyed by DEVICE, and this device only ever increments its own entry', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP)
  const doc = progressStore.exportPersisted()!
  assert.deepEqual(Object.keys(doc.ledger), [getDeviceId()])
  assert.equal(doc.ledger[getDeviceId()].xp, REWARD_XP)
  assert.equal(doc.ledger[getDeviceId()].bloom.alphabet, REWARD_XP)
})

test('grantedSlots is derived from the LEDGER, so off-path pruning cannot manufacture debt (§10.11)', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP * 4)
  progressStore.grantPendingRewards()
  progressStore.flush()

  // Simulate a later data edit renaming a reward: inject a stale firstAt stamp and re-attach.
  const raw = JSON.parse(disk[progressKeyFor('kid-1')]) as PersistedProgress
  raw.stickers.firstAt['a-reward-that-no-longer-exists'] = 12345
  disk[progressKeyFor('kid-1')] = JSON.stringify(raw)
  progressStore.detach()
  progressStore.attach('kid-1')

  assert.equal(progressStore.collectedCount(), 4)
  // The old implementation summed collected[*].count, which the pruning decremented → phantom debt.
  assert.deepEqual(progressStore.grantPendingRewards(), [])
})

test('resetAll: per-child, bumps sync.epoch, preserves settings AND settingsMeta, keeps the device id', () => {
  progressStore.attach('kid-1')
  progressStore.setSetting('sfxEnabled', false)
  progressStore.setDifficulty({ global: 'svaer', section: 'math', level: 'let' })
  progressStore.grantXp('alphabet', REWARD_XP * 3)
  progressStore.grantPendingRewards()
  const before = progressStore.exportPersisted()!
  const deviceId = getDeviceId()

  progressStore.resetAll()
  const after = progressStore.exportPersisted()!

  assert.equal(progressStore.collectedCount(), 0)
  assert.equal(progressStore.globalLevel(), 1)
  assert.equal(after.progression.lastCelebratedLevel, 1, 'never 0 — that would re-celebrate')
  assert.deepEqual(after.ledger, {})
  // Without the epoch bump the next pull would resurrect everything (§6.2c).
  assert.equal(after.sync.epoch, before.sync.epoch + 1)
  // Preferences survive, and so do their STAMPS — resetting those backwards would let a stale remote
  // setting win the next merge.
  assert.equal(after.settings.sfxEnabled, false)
  assert.equal(progressStore.difficultyFor('math'), 'let')
  assert.equal(progressStore.difficultyFor('alphabet'), 'svaer')
  assert.deepEqual(after.settingsMeta, before.settingsMeta)
  assert.equal(getDeviceId(), deviceId, 'the device id is NOT progress')
  assert.equal(disk[DEVICE_ID_KEY], deviceId)
})

test('settings changes are LWW-stamped, per-section for difficulty overrides', () => {
  progressStore.attach('kid-1')
  progressStore.setSetting('musicEnabled', false)
  progressStore.setDifficulty({ section: 'colors', level: 'svaer' })
  const doc = progressStore.exportPersisted()!
  assert.ok(doc.settingsMeta['musicEnabled'].at > 0)
  assert.equal(doc.settingsMeta['musicEnabled'].by, getDeviceId())
  assert.ok(doc.settingsMeta['difficulty.perSection.colors'].at > 0)
  assert.equal(doc.settingsMeta['difficulty.global'], undefined, 'untouched fields stay unstamped')
})

test('markStickersSeen stores a CURSOR, not an emptied array', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP * 2)
  progressStore.grantPendingRewards()
  assert.equal(progressStore.get().stickers.newIds.length, 2)
  progressStore.markStickersSeen()
  assert.deepEqual(progressStore.get().stickers.newIds, [])
  assert.equal(progressStore.exportPersisted()!.stickers.seenThroughSlot, 2)
  // Idempotent.
  const rev = progressStore.syncMeta()!.rev
  progressStore.markStickersSeen()
  assert.equal(progressStore.syncMeta()!.rev, rev)
})

test('applyRemote merges a sibling device in, and NEVER loses a reward', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP * 2)
  progressStore.grantPendingRewards()
  assert.equal(progressStore.collectedCount(), 2)

  // Another device that played 3 rounds and handed over 3 rewards of its own.
  const remote = defaultPersisted('kid-1', 'other-iPad', 1)
  remote.ledger['other-iPad'] = {
    xp: REWARD_XP * 3,
    slots: 3,
    bloom: { math: REWARD_XP * 3 },
  }
  remote.stickers.grantedSlots = 3

  const report = progressStore.applyRemote(remote)
  assert.ok(report)
  assert.equal(report.changed, true)
  assert.equal(report.slotsAfter, 5, 'a naive max() would have said 3 and erased two rewards')
  assert.equal(progressStore.collectedCount(), 5)
  assert.equal(progressStore.get().progression.globalXp, REWARD_XP * 5)
  assert.equal(progressStore.bloomFor('math').xp, REWARD_XP * 3)
  // Applying the same remote again changes nothing (idempotent join → safe to retry).
  assert.equal(progressStore.applyRemote(remote)!.changed, false)
})

test('applyRemote is safe MID-CEREMONY: a pending reward survives and is still handed over', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP * 2) // 2 owed, ceremony not yet run
  const remote = defaultPersisted('kid-1', 'other-iPad', 1)
  progressStore.applyRemote(remote)
  const grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 2)
  assert.equal(grants[0].slot, 0)
})

test('markSynced advances syncedRev WITHOUT bumping rev (or the profile push-loops forever)', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', 10)
  const meta = progressStore.syncMeta()!
  progressStore.markSynced(7, meta.rev)
  const after = progressStore.syncMeta()!
  assert.equal(after.rev, meta.rev, 'rev must NOT move')
  assert.equal(after.syncedRev, meta.rev)
  assert.equal(after.serverRev, 7)
  // …and it never moves backwards.
  progressStore.markSynced(3, 1)
  assert.equal(progressStore.syncMeta()!.serverRev, 7)
  assert.equal(progressStore.syncMeta()!.syncedRev, meta.rev)
})

test('onCommit fires with the sync meta on every persisted commit (drives the debounced push)', () => {
  progressStore.attach('kid-1')
  const seen: number[] = []
  const off = progressStore.onCommit((m) => seen.push(m.rev))
  progressStore.grantXp('alphabet', 5)
  progressStore.grantXp('alphabet', 5)
  off()
  progressStore.grantXp('alphabet', 5)
  assert.equal(seen.length, 2, 'and unsubscribing works')
  assert.ok(seen[1] > seen[0], 'rev is monotonic')
})

test('whenAttached resolves for a waiter registered BEFORE the attach (§10.7 devHarness)', async () => {
  const waiting = progressStore.whenAttached()
  progressStore.attach('kid-9')
  assert.equal(await waiting, 'kid-9')
  // And resolves immediately once already attached.
  assert.equal(await progressStore.whenAttached(), 'kid-9')
})

test('the persisted document is v4 and round-trips through disk unchanged', () => {
  progressStore.attach('kid-1')
  progressStore.grantXp('alphabet', REWARD_XP)
  progressStore.grantPendingRewards()
  progressStore.flush()
  const onDisk = readKey('kid-1')!
  assert.equal(onDisk.version, SCHEMA_VERSION)
  assert.equal(onDisk.profileId, 'kid-1')
  // The wire form carries the CURSOR, not the multiset — and no derived totalStickers.
  assert.equal(typeof onDisk.stickers.grantedSlots, 'number')
  assert.equal('collected' in onDisk.stickers, false)
  assert.equal('totalStickers' in onDisk.totals, false)

  const before = progressStore.get()
  progressStore.detach()
  progressStore.attach('kid-1')
  assert.deepEqual(progressStore.get().stickers, before.stickers)
  assert.equal(progressStore.get().progression.globalXp, before.progression.globalXp)
})
