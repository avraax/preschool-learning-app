// Legacy adoption (accounts PRD §5.5 / §12) — "the gate that matters most".
//
// This is the test the PRD says to run against a real copy of the owner's blob before anything ships:
// the son's 45-reward book, level, gold-pass position, difficulty overrides and explored set must
// survive byte-for-byte, adopting twice must be a provable no-op, and the legacy key must be UNMODIFIED
// afterwards.

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
import {
  adoptLegacyInto,
  adoptionMarker,
  legacyPreview,
} from './legacyAdoption.ts'
import { progressStore } from './progressStore.ts'
import { getDeviceId } from './deviceId.ts'
import {
  DEVICE_ID_KEY,
  LEGACY_ADOPTION_KEY,
  LEGACY_DEVICE_ID,
  LEGACY_STORAGE_KEY,
  THEME_HINT_KEY,
  totalSlots,
  totalXp,
} from '../config/progressSchema.ts'
import { REWARD_PATH } from '../config/stickers.ts'
import { FAST_SLOTS, REWARD_SLOTS, REWARD_XP, levelFromXp } from '../config/progression.ts'

const NOW = 1_800_000_000_000
const xpForSlots = (n: number) =>
  Math.min(n, FAST_SLOTS) * REWARD_XP + Math.max(0, n - FAST_SLOTS) * REWARD_XP * 2

/** The owner's shape: a full book, the gold pass 4 deep, a difficulty override, sound off. */
function ownersV3Blob() {
  const collected: Record<string, { count: number; firstAt: number }> = {}
  REWARD_PATH.forEach((r, i) => {
    collected[r.id] = { count: 1, firstAt: NOW - (200 - i) * 86_400_000 }
  })
  for (let i = 0; i < 4; i++) collected[REWARD_PATH[i].id].count = 2
  const cursor = REWARD_SLOTS + 4
  return {
    version: 3,
    stickers: { collected, newIds: [] },
    perGame: {
      'alphabet.quiz': { bestStreak: 8, bestStars: 3, bestCount: 8, roundsCompleted: 63, lifetimeCorrect: 470 },
      'math.plusminus': { bestStreak: 6, bestStars: 3, bestCount: 7, roundsCompleted: 22, lifetimeCorrect: 140 },
      'ordleg.mic': { bestStreak: 4, bestStars: 2, bestCount: 5, roundsCompleted: 9, lifetimeCorrect: 40 },
    },
    totals: { totalStars: 201, totalStickers: REWARD_SLOTS },
    progression: {
      globalXp: xpForSlots(cursor),
      lastCelebratedLevel: levelFromXp(xpForSlots(cursor)).level,
      bloom: {
        alphabet: { xp: 1400, updatedAt: NOW - 1000 },
        math: { xp: 620, updatedAt: NOW - 2000 },
        colors: { xp: 300, updatedAt: NOW - 3000 },
        english: { xp: 120, updatedAt: NOW - 4000 },
        ordleg: { xp: 240, updatedAt: NOW - 5000 },
      },
      explored: {
        alphabet: ['A', 'B', 'C', 'D', 'E'],
        math: ['1', '2', '3'],
        colors: ['roed'],
        english: [],
        ordleg: [],
      },
      updatedAt: NOW - 500,
    },
    settings: {
      sfxEnabled: false,
      musicEnabled: true,
      musicDefaultOn: true,
      difficulty: { global: 'normal', perSection: { math: 'let', ordleg: 'let' } },
    },
  }
}

const seedLegacy = () => {
  disk[LEGACY_STORAGE_KEY] = JSON.stringify(ownersV3Blob())
  disk[THEME_HINT_KEY] = 'ocean'
}

beforeEach(() => {
  progressStore.detach()
  const deviceId = disk[DEVICE_ID_KEY]
  shim.clear()
  if (deviceId) disk[DEVICE_ID_KEY] = deviceId
})

test('legacyPreview describes what the adult is about to move ("45 klistermærker, niveau …")', () => {
  assert.equal(legacyPreview().present, false, 'nothing on disk → nothing to offer')
  seedLegacy()
  const p = legacyPreview()
  assert.equal(p.present, true)
  assert.equal(p.collectedCount, REWARD_SLOTS)
  assert.equal(p.level, levelFromXp(xpForSlots(REWARD_SLOTS + 4)).level)
  assert.equal(p.totalStars, 201)
  assert.ok(p.fingerprint.length > 0)
  // The preview must be a pure READ.
  assert.equal(disk[LEGACY_STORAGE_KEY], JSON.stringify(ownersV3Blob()))
  assert.equal(adoptionMarker(), null)
})

test('THE GATE: the whole book, level, gold-pass cursor, bests, difficulty and explored set survive', () => {
  seedLegacy()
  const result = adoptLegacyInto('kid-1')
  assert.equal(result.status, 'adopted')

  const doc = progressStore.exportPersisted()!
  const cursor = REWARD_SLOTS + 4
  assert.equal(totalSlots(doc), cursor, 'the gold-pass cursor is not flattened to 45')
  assert.equal(totalXp(doc), xpForSlots(cursor))
  assert.equal(progressStore.collectedCount(), REWARD_SLOTS)
  assert.equal(progressStore.globalLevel(), levelFromXp(xpForSlots(cursor)).level)
  assert.deepEqual(progressStore.grantPendingRewards(), [], 'and no phantom fistful of golds')

  // Per-game bests, stars, difficulty overrides, explored keys, sound.
  const s = progressStore.get()
  assert.equal(s.totals.totalStars, 201)
  assert.equal(s.perGame['alphabet.quiz'].roundsCompleted, 63)
  assert.equal(s.perGame['ordleg.mic'].bestStars, 2)
  assert.equal(progressStore.difficultyFor('math'), 'let')
  assert.equal(progressStore.difficultyFor('ordleg'), 'let')
  assert.equal(progressStore.difficultyFor('alphabet'), 'normal')
  assert.deepEqual(s.progression.explored.alphabet, ['A', 'B', 'C', 'D', 'E'])
  assert.equal(s.settings.sfxEnabled, false)
  assert.equal(s.settings.themeId, 'ocean', 'the device theme hint becomes the profile’s skin')
  // Bloom per section.
  assert.equal(progressStore.bloomFor('alphabet').xp, 1400)
  assert.equal(progressStore.bloomFor('english').xp, 120)
  // The four duplicates are still duplicates, on the right rewards.
  for (let i = 0; i < 4; i++) assert.equal(s.stickers.collected[REWARD_PATH[i].id].count, 2)
  assert.equal(s.stickers.collected[REWARD_PATH[4].id].count, 1)
})

test('the legacy key is NEVER written to and NEVER deleted (even a botched adoption is recoverable)', () => {
  seedLegacy()
  const before = disk[LEGACY_STORAGE_KEY]
  adoptLegacyInto('kid-1')
  assert.equal(disk[LEGACY_STORAGE_KEY], before, 'byte-for-byte unmodified')
})

test('GUARD 2 (structural): legacy XP lands in the `legacy-v3` ledger entry, not this device’s', () => {
  seedLegacy()
  adoptLegacyInto('kid-1')
  const doc = progressStore.exportPersisted()!
  assert.ok(doc.ledger[LEGACY_DEVICE_ID], 'the legacy entry exists')
  assert.equal(doc.ledger[getDeviceId()], undefined, 'and this device has NOT been credited')
})

test('GUARD 1 (marker): adopting twice is refused', () => {
  seedLegacy()
  adoptLegacyInto('kid-1')
  const marker = adoptionMarker()
  assert.ok(marker)
  assert.equal(marker.adoptedInto, 'kid-1')

  const again = adoptLegacyInto('kid-1')
  assert.equal(again.status, 'already-adopted')
})

test('GUARD 2 makes a FORCED re-adoption a provable no-op even without the marker', () => {
  seedLegacy()
  adoptLegacyInto('kid-1')
  const slots = totalSlots(progressStore.exportPersisted()!)
  const xp = totalXp(progressStore.exportPersisted()!)

  // Simulate the marker write having failed, then re-adopt.
  delete disk[LEGACY_ADOPTION_KEY]
  const again = adoptLegacyInto('kid-1')
  assert.equal(again.status, 'adopted')
  assert.equal(again.report.changed, false, 'nothing changed — a per-device max onto itself')
  assert.equal(totalSlots(progressStore.exportPersisted()!), slots)
  assert.equal(totalXp(progressStore.exportPersisted()!), xp)
  assert.equal(progressStore.collectedCount(), REWARD_SLOTS)
})

test('a re-adoption cannot clobber play that happened AFTER the adoption', () => {
  seedLegacy()
  adoptLegacyInto('kid-1')
  // The child plays two more rounds on THIS device.
  progressStore.grantXp('alphabet', REWARD_XP * 4)
  const xpAfterPlay = totalXp(progressStore.exportPersisted()!)

  delete disk[LEGACY_ADOPTION_KEY]
  adoptLegacyInto('kid-1', true)
  assert.equal(
    totalXp(progressStore.exportPersisted()!),
    xpAfterPlay,
    'this device’s own ledger entry is untouched by a legacy re-merge',
  )
})

test('adopting the SAME blob into a second profile is allowed when done deliberately', () => {
  seedLegacy()
  adoptLegacyInto('kid-1')
  // `force` is what the dialog passes when two kids really did share the iPad.
  const second = adoptLegacyInto('kid-2', true)
  assert.equal(second.status, 'adopted')
  assert.equal(progressStore.activeProfileId(), 'kid-2')
  assert.equal(progressStore.collectedCount(), REWARD_SLOTS)
  // …and kid-1 still has their own copy.
  progressStore.attach('kid-1')
  assert.equal(progressStore.collectedCount(), REWARD_SLOTS)
})

test('nothing to adopt / unreadable are reported, not crashed on', () => {
  assert.equal(adoptLegacyInto('kid-1').status, 'nothing-to-adopt')
  disk[LEGACY_STORAGE_KEY] = '{not json'
  assert.equal(adoptLegacyInto('kid-1').status, 'unreadable')
  // A v2 blob is present but unmappable — "nothing to adopt", never a partial import.
  disk[LEGACY_STORAGE_KEY] = JSON.stringify({ version: 2, stickers: { collected: {} } })
  assert.equal(adoptLegacyInto('kid-1').status, 'nothing-to-adopt')
})
