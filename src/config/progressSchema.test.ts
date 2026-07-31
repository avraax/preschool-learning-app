// v4 schema: derivation, invariants and the v3 → v4 migration (accounts PRD §5.2 / §5.3 / §12).
//
// The migration is the single most dangerous change in the whole build — bumping SCHEMA_VERSION
// without it deletes a real 45-reward book — so the fixture below is deliberately a REALISTIC v3
// blob: full book, gold pass in progress, difficulty overrides, pending "nyt!" badges, explored keys.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCHEMA_VERSION,
  LEGACY_DEVICE_ID,
  defaultPersisted,
  derive,
  deriveNewIds,
  inertState,
  migrateToV4,
  normalizePersisted,
  owedRewards,
  pathIndexForSlot,
  progressInvariantViolations,
  progressKeyFor,
  rebuildCollected,
  readPersisted,
  totalSlots,
  totalXp,
  bloomXpFor,
  type PersistedProgress,
} from './progressSchema.ts'
import { REWARD_PATH } from './stickers.ts'
import { REWARD_SLOTS, FAST_SLOTS, REWARD_XP, collectedFromLevel, levelFromXp } from './progression.ts'

const NOW = 1_800_000_000_000
const DEV = 'device-A'

const xpForSlots = (n: number) =>
  Math.min(n, FAST_SLOTS) * REWARD_XP + Math.max(0, n - FAST_SLOTS) * REWARD_XP * 2

/** A v4 doc with `slots` handed over and exactly enough XP to justify them. */
function withSlots(slots: number, device = DEV): PersistedProgress {
  const p = defaultPersisted('kid-1', device, NOW)
  p.ledger[device] = { xp: xpForSlots(slots), slots, bloom: { alphabet: xpForSlots(slots) } }
  p.stickers.grantedSlots = slots
  p.stickers.seenThroughSlot = Math.min(REWARD_SLOTS, slots)
  for (let i = 0; i < Math.min(REWARD_SLOTS, slots); i++) {
    p.stickers.firstAt[REWARD_PATH[i].id] = NOW - (slots - i) * 1000
  }
  p.progression.lastCelebratedLevel = levelFromXp(xpForSlots(slots)).level
  return p
}

test('progressKeyFor namespaces per profile', () => {
  assert.equal(progressKeyFor('kid-1'), 'bornelaering-progress:kid-1')
  assert.notEqual(progressKeyFor('kid-1'), progressKeyFor('kid-2'))
})

test('LEGACY_DEVICE_ID cannot collide with a real crypto.randomUUID() device id', () => {
  assert.equal(LEGACY_DEVICE_ID, 'legacy-v3')
  assert.ok(!/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(LEGACY_DEVICE_ID))
})

test('a fresh doc derives an empty book at level 1 and owes nothing', () => {
  const p = defaultPersisted('kid-1', DEV, NOW)
  const s = derive(p, NOW)
  assert.equal(s.version, SCHEMA_VERSION)
  assert.equal(s.profileId, 'kid-1')
  assert.deepEqual(s.stickers.collected, {})
  assert.deepEqual(s.stickers.newIds, [])
  assert.equal(s.totals.totalStickers, 0)
  assert.equal(s.progression.globalXp, 0)
  assert.equal(s.progression.lastCelebratedLevel, 1) // NEVER 0
  assert.equal(owedRewards(p), 0)
  assert.deepEqual(progressInvariantViolations(p), [])
})

test('inertState is a valid, empty read model (what getSnapshot returns while detached)', () => {
  const s = inertState()
  assert.equal(s.profileId, null)
  assert.equal(s.progression.globalXp, 0)
  assert.equal(s.settings.difficulty.global, 'normal')
})

test('the ledger sums: three devices contribute XP, slots and bloom additively', () => {
  const p = defaultPersisted('kid-1', DEV, NOW)
  p.ledger = {
    A: { xp: 100, slots: 2, bloom: { alphabet: 60, math: 40 } },
    B: { xp: 200, slots: 5, bloom: { math: 200 } },
    'legacy-v3': { xp: 40, slots: 1, bloom: { colors: 40 } },
  }
  assert.equal(totalXp(p), 340)
  assert.equal(totalSlots(p), 8)
  assert.equal(bloomXpFor(p, 'math'), 240)
  assert.equal(bloomXpFor(p, 'alphabet'), 60)
  assert.equal(bloomXpFor(p, 'english'), 0)
})

test('rebuildCollected walks the path in order and wraps into the gold pass at 45', () => {
  const first = rebuildCollected(3, {}, NOW)
  assert.deepEqual(Object.keys(first), REWARD_PATH.slice(0, 3).map((r) => r.id))
  assert.equal(first[REWARD_PATH[0].id].count, 1)

  // Slot 46 (index 45) is a GOLD duplicate of slot 1 — deterministic, not a random dupe.
  assert.equal(pathIndexForSlot(REWARD_SLOTS), 0)
  assert.equal(pathIndexForSlot(REWARD_SLOTS + 1), 1)
  const gold = rebuildCollected(REWARD_SLOTS + 2, {}, NOW)
  assert.equal(Object.keys(gold).length, REWARD_SLOTS) // the count never inflates past 45
  assert.equal(gold[REWARD_PATH[0].id].count, 2)
  assert.equal(gold[REWARD_PATH[1].id].count, 2)
  assert.equal(gold[REWARD_PATH[2].id].count, 1)
})

test('rebuildCollected falls back to `now` for a missing stamp, never to 1970', () => {
  const out = rebuildCollected(2, { [REWARD_PATH[0].id]: 123456 }, NOW)
  assert.equal(out[REWARD_PATH[0].id].firstAt, 123456)
  assert.equal(out[REWARD_PATH[1].id].firstAt, NOW)
  // A zero/negative stamp is treated as missing (a plain Math.min would have shown 1970).
  assert.equal(rebuildCollected(1, { [REWARD_PATH[0].id]: 0 }, NOW)[REWARD_PATH[0].id].firstAt, NOW)
})

test('deriveNewIds is the contiguous suffix of the granted prefix', () => {
  assert.deepEqual(deriveNewIds(0, 0), [])
  assert.deepEqual(deriveNewIds(3, 3), [])
  assert.deepEqual(deriveNewIds(3, 1), [REWARD_PATH[1].id, REWARD_PATH[2].id])
  // Gold duplicates are never "new", so the suffix stops at 45.
  assert.deepEqual(deriveNewIds(REWARD_SLOTS + 5, REWARD_SLOTS), [])
  // A seen cursor ahead of the granted prefix clamps rather than producing nonsense.
  assert.deepEqual(deriveNewIds(2, 9), [])
})

test('invariants: grantedSlots must equal Σ ledger.slots and must not exceed the level ceiling', () => {
  const ok = withSlots(5)
  assert.deepEqual(progressInvariantViolations(ok), [])

  const drifted = withSlots(5)
  drifted.stickers.grantedSlots = 4
  assert.match(progressInvariantViolations(drifted).join(' '), /Σ ledger\.slots/)

  const overGranted = withSlots(5)
  overGranted.ledger[DEV].slots = 9
  overGranted.stickers.grantedSlots = 9
  assert.match(progressInvariantViolations(overGranted).join(' '), /the level only owes/)
})

test('the invariant is an INEQUALITY: a pending ceremony (debt) is legal, not a violation', () => {
  const p = withSlots(3)
  // One more round's XP, reward not yet handed over — this is exactly the pending-ceremony state.
  p.ledger[DEV].xp += REWARD_XP
  assert.equal(owedRewards(p), 1)
  assert.deepEqual(progressInvariantViolations(p), [], 'debt must not read as corruption')
})

test('normalizePersisted rejects anything that is not v4, and repairs a drifted cursor', () => {
  assert.equal(normalizePersisted(null), null)
  assert.equal(normalizePersisted({}), null)
  assert.equal(normalizePersisted({ version: 3 }), null)
  assert.equal(normalizePersisted('nonsense'), null)

  const raw = JSON.parse(JSON.stringify(withSlots(4)))
  raw.stickers.grantedSlots = 99 // corrupt display cursor
  const fixed = normalizePersisted(raw)
  assert.ok(fixed)
  assert.equal(fixed.stickers.grantedSlots, 4) // the ledger is the truth
  assert.deepEqual(progressInvariantViolations(fixed), [])
})

test('normalizePersisted prunes off-path firstAt stamps WITHOUT manufacturing debt (§10.11)', () => {
  const raw = JSON.parse(JSON.stringify(withSlots(6)))
  raw.stickers.firstAt['a-reward-that-no-longer-exists'] = NOW
  const fixed = normalizePersisted(raw)
  assert.ok(fixed)
  assert.equal('a-reward-that-no-longer-exists' in fixed.stickers.firstAt, false)
  // v3 pruning decremented Σ counts and therefore the cursor; a STORED cursor is immune.
  assert.equal(fixed.stickers.grantedSlots, 6)
  assert.equal(owedRewards(fixed), 0)
})

test('normalizePersisted clamps the celebrated cursor when nothing is owed (no empty ceremony)', () => {
  const raw = JSON.parse(JSON.stringify(withSlots(3)))
  raw.progression.lastCelebratedLevel = 1 // killed right after grantSlot, before markLevelCelebrated
  const fixed = normalizePersisted(raw)
  assert.ok(fixed)
  assert.equal(fixed.progression.lastCelebratedLevel, levelFromXp(xpForSlots(3)).level)
  assert.equal(owedRewards(fixed), 0)
})

test('normalizePersisted never lets lastCelebratedLevel fall below 1', () => {
  const raw = JSON.parse(JSON.stringify(defaultPersisted('k', DEV, NOW)))
  raw.progression.lastCelebratedLevel = 0
  assert.equal(normalizePersisted(raw)!.progression.lastCelebratedLevel, 1)
})

// ----- the v3 fixture ---------------------------------------------------------------------------

/**
 * A realistic v3 blob: the whole book collected, four GOLD duplicates on top (so the cursor is 49),
 * a difficulty override, sound off, explored browse keys, and one pending "nyt!" badge.
 */
function v3Fixture() {
  const collected: Record<string, { count: number; firstAt: number }> = {}
  REWARD_PATH.forEach((r, i) => {
    collected[r.id] = { count: 1, firstAt: NOW - (100 - i) * 86_400_000 }
  })
  // The gold pass has wrapped four times.
  for (let i = 0; i < 4; i++) collected[REWARD_PATH[i].id].count = 2
  const cursor = REWARD_SLOTS + 4
  return {
    version: 3,
    stickers: { collected, newIds: [REWARD_PATH[REWARD_SLOTS - 1].id] },
    perGame: {
      'alphabet.quiz': {
        bestStreak: 8,
        bestStars: 3,
        bestCount: 8,
        roundsCompleted: 41,
        lifetimeCorrect: 300,
      },
      'math.plusminus': {
        bestStreak: 5,
        bestStars: 2,
        bestCount: 6,
        roundsCompleted: 12,
        lifetimeCorrect: 70,
      },
    },
    totals: { totalStars: 137, totalStickers: REWARD_SLOTS },
    progression: {
      globalXp: xpForSlots(cursor),
      lastCelebratedLevel: levelFromXp(xpForSlots(cursor)).level,
      bloom: {
        alphabet: { xp: 900, updatedAt: NOW - 1000 },
        math: { xp: 420, updatedAt: NOW - 2000 },
        colors: { xp: 130, updatedAt: NOW - 3000 },
        english: { xp: 0, updatedAt: 0 },
        ordleg: { xp: 60, updatedAt: NOW - 4000 },
      },
      explored: { alphabet: ['A', 'B', 'C'], math: ['1', '2'], colors: [], english: [], ordleg: [] },
      updatedAt: NOW - 500,
    },
    settings: {
      sfxEnabled: false,
      musicEnabled: true,
      musicDefaultOn: true,
      difficulty: { global: 'normal', perSection: { math: 'let' } },
    },
  }
}

test('v3 → v4: the 45-reward book, the gold-pass cursor and the level all survive byte-for-byte', () => {
  const v3 = v3Fixture()
  const p = migrateToV4(v3, { deviceId: DEV, now: NOW })
  assert.ok(p)
  assert.equal(p.version, SCHEMA_VERSION)
  assert.deepEqual(progressInvariantViolations(p), [])

  const cursor = REWARD_SLOTS + 4
  assert.equal(totalSlots(p), cursor, 'the gold-pass cursor must not be flattened to 45')
  assert.equal(p.stickers.grantedSlots, cursor)
  assert.equal(totalXp(p), v3.progression.globalXp)
  assert.equal(levelFromXp(totalXp(p)).level, v3.progression.lastCelebratedLevel)
  assert.equal(owedRewards(p), 0, 'a migration must not manufacture a phantom fistful of golds')

  const s = derive(p, NOW)
  assert.equal(Object.keys(s.stickers.collected).length, REWARD_SLOTS)
  assert.equal(s.totals.totalStickers, REWARD_SLOTS)
  assert.equal(s.totals.totalStars, 137)
  // The four gold duplicates are still duplicates, on the right rewards.
  for (let i = 0; i < 4; i++) assert.equal(s.stickers.collected[REWARD_PATH[i].id].count, 2)
  assert.equal(s.stickers.collected[REWARD_PATH[4].id].count, 1)
  // firstAt is preserved exactly (the book shows "collected on" dates).
  assert.equal(
    s.stickers.collected[REWARD_PATH[0].id].firstAt,
    v3.stickers.collected[REWARD_PATH[0].id].firstAt,
  )
})

test('v3 → v4: the NEXT gold reward continues the wrap (a level-60 player is not reset to slot 1)', () => {
  const p = migrateToV4(v3Fixture(), { deviceId: DEV, now: NOW })!
  // The cursor sits at 49, so the next handed-over slot is 49 → path index 4.
  assert.equal(pathIndexForSlot(totalSlots(p)), 4)
  const after = rebuildCollected(totalSlots(p) + 1, p.stickers.firstAt, NOW)
  assert.equal(after[REWARD_PATH[4].id].count, 2)
})

test('v3 → v4: difficulty overrides, sound and explored keys carry, and are LWW-stamped', () => {
  const p = migrateToV4(v3Fixture(), { deviceId: DEV, now: NOW, themeIdHint: 'ocean' })!
  assert.equal(p.settings.sfxEnabled, false)
  assert.equal(p.settings.difficulty.global, 'normal')
  assert.equal(p.settings.difficulty.perSection?.math, 'let')
  assert.equal(p.settings.themeId, 'ocean')
  assert.deepEqual(p.progression.explored.alphabet, ['A', 'B', 'C'])
  assert.deepEqual(p.progression.explored.math, ['1', '2'])
  // Stamped ABOVE a fresh profile's zeroed defaults, so adopted settings win over untouched ones.
  assert.ok(p.settingsMeta['sfxEnabled'].at > 0)
  assert.equal(p.settingsMeta['sfxEnabled'].by, 'legacy')
  assert.ok(p.settingsMeta['difficulty.perSection.math'].at > 0)
  assert.ok(p.settingsMeta['themeId'].at > 0)
})

test('v3 → v4: per-section bloom lands in the ledger and derives back identically', () => {
  const p = migrateToV4(v3Fixture(), { deviceId: DEV, now: NOW })!
  const s = derive(p, NOW)
  assert.equal(s.progression.bloom.alphabet.xp, 900)
  assert.equal(s.progression.bloom.math.xp, 420)
  assert.equal(s.progression.bloom.english.xp, 0)
})

test('v3 → v4: a pending "nyt!" badge survives as the seen cursor', () => {
  const p = migrateToV4(v3Fixture(), { deviceId: DEV, now: NOW })!
  // The fixture flags the LAST path reward as unseen → seenThroughSlot is its slot index.
  assert.equal(p.stickers.seenThroughSlot, REWARD_SLOTS - 1)
  assert.deepEqual(derive(p, NOW).stickers.newIds, [REWARD_PATH[REWARD_SLOTS - 1].id])
})

test('v3 → v4: with nothing flagged new, everything already-collected counts as seen', () => {
  const v3 = v3Fixture()
  v3.stickers.newIds = []
  const p = migrateToV4(v3, { deviceId: DEV, now: NOW })!
  assert.equal(p.stickers.seenThroughSlot, REWARD_SLOTS)
  assert.deepEqual(derive(p, NOW).stickers.newIds, [])
})

test('v3 → v4: `ledgerKey` attributes legacy XP to legacy-v3, never to this device', () => {
  const p = migrateToV4(v3Fixture(), {
    deviceId: DEV,
    now: NOW,
    ledgerKey: LEGACY_DEVICE_ID,
  })!
  assert.deepEqual(Object.keys(p.ledger), [LEGACY_DEVICE_ID])
  assert.equal(p.ledger[DEV], undefined)
  assert.equal(p.sync.originDevice, DEV) // the ORIGIN is still this device
})

test('v3 → v4: the repair clamp trims counts that the stored XP cannot justify', () => {
  const v3 = v3Fixture()
  v3.progression.globalXp = xpForSlots(3) // way below the 49 collected counts
  const p = migrateToV4(v3, { deviceId: DEV, now: NOW })!
  assert.equal(totalSlots(p), 3)
  assert.deepEqual(progressInvariantViolations(p), [])
})

test('migrateToV4 refuses anything that is not v3 (so the chain can fall through)', () => {
  assert.equal(migrateToV4(null, { deviceId: DEV, now: NOW }), null)
  assert.equal(migrateToV4({ version: 2 }, { deviceId: DEV, now: NOW }), null)
  assert.equal(migrateToV4({ version: 4 }, { deviceId: DEV, now: NOW }), null)
  assert.equal(migrateToV4('x', { deviceId: DEV, now: NOW }), null)
})

test('readPersisted is the version-directed chain: v4 → validate, v3 → migrate, else null', () => {
  const ctx = { deviceId: DEV, now: NOW }
  const v4 = JSON.parse(JSON.stringify(withSlots(2)))
  assert.equal(readPersisted(v4, ctx)!.stickers.grantedSlots, 2)
  assert.equal(readPersisted(v3Fixture(), ctx)!.version, SCHEMA_VERSION)
  assert.equal(readPersisted({ version: 1 }, ctx), null)
  assert.equal(readPersisted(undefined, ctx), null)
})

test('a v3 blob whose collected ids were renamed does not crash or over-count', () => {
  const v3 = v3Fixture()
  v3.stickers.collected['ghost-reward'] = { count: 1, firstAt: NOW }
  const p = migrateToV4(v3, { deviceId: DEV, now: NOW })!
  // The ghost's count still moves the CURSOR (a slot really was handed over) but leaves no stamp.
  assert.equal('ghost-reward' in p.stickers.firstAt, false)
  assert.deepEqual(progressInvariantViolations(p), [])
})

test('derive keeps the exact v3 read-model shape (so no consumer has to change)', () => {
  const p = migrateToV4(v3Fixture(), { deviceId: DEV, now: NOW })!
  const s = derive(p, NOW)
  assert.deepEqual(Object.keys(s).sort(), [
    'perGame',
    'profileId',
    'progression',
    'settings',
    'stickers',
    'totals',
    'version',
  ])
  assert.deepEqual(Object.keys(s.stickers).sort(), ['collected', 'newIds'])
  assert.deepEqual(Object.keys(s.totals).sort(), ['totalStars', 'totalStickers'])
  assert.deepEqual(Object.keys(s.progression).sort(), [
    'bloom',
    'explored',
    'globalXp',
    'lastCelebratedLevel',
    'updatedAt',
  ])
  assert.equal(
    Object.keys(s.stickers.collected).length,
    Math.min(REWARD_SLOTS, collectedFromLevel(levelFromXp(s.progression.globalXp).level)),
  )
})
