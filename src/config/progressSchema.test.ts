// v4 schema: derivation and invariants (accounts PRD §5.2 / §12).
//
// There is deliberately NO v3 migration — the owner chose a clean sheet at the accounts release, so a
// non-v4 blob normalises to null and the child starts fresh (utils/storageReset.ts sweeps the old keys
// once per device).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCHEMA_VERSION,
  defaultPersisted,
  derive,
  deriveNewIds,
  inertState,
  normalizePersisted,
  owedRewards,
  progressInvariantViolations,
  progressKeyFor,
  rebuildCollected,
  totalSlots,
  totalXp,
  bloomXpFor,
  type PersistedProgress,
} from './progressSchema.ts'
import { REWARD_PATH, REWARD_SLOTS } from './stickers.ts'
import { REWARD_XP, levelFromXp, xpForSlots } from './progression.ts'

const NOW = 1_800_000_000_000
const DEV = 'device-A'

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
    C: { xp: 40, slots: 1, bloom: { colors: 40 } },
  }
  assert.equal(totalXp(p), 340)
  assert.equal(totalSlots(p), 8)
  assert.equal(bloomXpFor(p, 'math'), 240)
  assert.equal(bloomXpFor(p, 'alphabet'), 60)
  assert.equal(bloomXpFor(p, 'english'), 0)
})

test('rebuildCollected walks the path prefix and NEVER wraps (the gold pass is gone)', () => {
  const first = rebuildCollected(3, {}, NOW)
  assert.deepEqual(Object.keys(first), REWARD_PATH.slice(0, 3).map((r) => r.id))
  assert.equal(first[REWARD_PATH[0].id].count, 1)

  // A full book is exactly the path, each id ONCE. `pathIndexForSlot` used to wrap
  // `(slot - 45) % 45` here and `count` counted the duplicates; both are deleted (§3.5).
  const full = rebuildCollected(REWARD_SLOTS, {}, NOW)
  assert.equal(Object.keys(full).length, REWARD_SLOTS)
  for (const r of REWARD_PATH) assert.equal(full[r.id].count, 1, `${r.id} has a duplicate`)

  // A cursor past the end (only reachable via a cross-device G-Counter) stops at the last slot rather
  // than re-handing anything — no duplicate can exist, so `count` is permanently 1.
  const past = rebuildCollected(REWARD_SLOTS + 5, {}, NOW)
  assert.deepEqual(Object.keys(past), Object.keys(full))
  for (const r of REWARD_PATH) assert.equal(past[r.id].count, 1)
})

test('owedRewards CLAMPS at the end of the book (no gold wrap to absorb the debt)', () => {
  // The XP ledger keeps climbing forever across devices, so without this clamp a full book would
  // report growing debt and `grantSlot` would be handed a cursor with no reward on it.
  const p = withSlots(REWARD_SLOTS)
  assert.equal(owedRewards(p), 0)
  p.ledger[DEV].xp += REWARD_XP * 200 // a lot more play after the book is full
  assert.equal(owedRewards(p), 0, 'a finished book must owe nothing, forever')

  // One slot short: still exactly one owed, and no more.
  const nearly = withSlots(REWARD_SLOTS - 1)
  nearly.ledger[DEV].xp += REWARD_XP * 200
  assert.equal(owedRewards(nearly), 1)
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
  // The suffix stops at the end of the book — there is nothing past it to be "new".
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

  // …and the book's own end is an invariant now that nothing wraps past it.
  const pastTheEnd = withSlots(REWARD_SLOTS)
  pastTheEnd.ledger[DEV].slots = REWARD_SLOTS + 1
  pastTheEnd.stickers.grantedSlots = REWARD_SLOTS + 1
  pastTheEnd.ledger[DEV].xp = xpForSlots(REWARD_SLOTS + 1) // enough level to owe it, so only the cap bites
  assert.match(progressInvariantViolations(pastTheEnd).join(' '), /the book only has/)
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
