// The merge algebra (accounts PRD §6.2 / §12).
//
// The first three tests — idempotence, commutativity, associativity — are the LICENCE for calling
// `applyRemote()` at any instant with no lock and no queue. If any of them regresses, that guarantee
// is gone and mid-ceremony sync becomes unsafe, so they are not decoration.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeProgress, contentFingerprint } from './progressMerge.ts'
import {
  defaultPersisted,
  derive,
  normalizePersisted,
  owedRewards,
  progressInvariantViolations,
  totalSlots,
  totalXp,
  bloomXpFor,
  type PersistedProgress,
} from './progressSchema.ts'
import { REWARD_PATH, REWARD_SLOTS } from './stickers.ts'
import { REWARD_XP, collectedFromLevel, levelFromXp, xpForSlots } from './progression.ts'

const NOW = 1_800_000_000_000
const CTX = { now: NOW, deviceId: 'device-A' }

/** A well-formed doc: `slots` handed over by `device`, with exactly enough XP to justify them. */
function doc(
  slots: number,
  device = 'device-A',
  over: Partial<{ epoch: number; stars: number; seen: number; extraXp: number }> = {},
): PersistedProgress {
  const p = defaultPersisted('kid-1', device, NOW)
  const xp = xpForSlots(slots) + (over.extraXp ?? 0)
  p.ledger[device] = { xp, slots, bloom: { alphabet: xp } }
  p.stickers.grantedSlots = slots
  p.stickers.seenThroughSlot = over.seen ?? Math.min(REWARD_SLOTS, slots)
  for (let i = 0; i < Math.min(REWARD_SLOTS, slots); i++) {
    p.stickers.firstAt[REWARD_PATH[i].id] = NOW - (slots - i) * 1000
  }
  p.totals.totalStars = over.stars ?? slots * 3
  p.progression.lastCelebratedLevel = levelFromXp(xp).level
  p.sync.epoch = over.epoch ?? 0
  p.sync.rev = 5
  // Round-trip through the normaliser so every fixture satisfies the same post-conditions a blob
  // read from disk does (that is what makes merge(a, a) ≡ a exact).
  return normalizePersisted(JSON.parse(JSON.stringify(p)))!
}

/** Four states spanning the interesting regions of the path.
 *
 * There is no past-the-end sample any more: the gold pass is deleted (Reward Horizon PRD-01 §3.5), so
 * a cursor beyond REWARD_SLOTS is now a CORRUPT state the merge repairs rather than a legal one it has
 * to preserve — see 'a cursor past the end of the book is CLAMPED' below. */
const SAMPLES = () => ({
  fresh: doc(0),
  midBook: doc(7),
  nearlyFull: doc(REWARD_SLOTS - 1),
  fullBook: doc(REWARD_SLOTS),
})

// ----- the three laws ----------------------------------------------------------------------------

test('LAW 1 — idempotent: merge(a, a) ≡ a', () => {
  for (const [name, a] of Object.entries(SAMPLES())) {
    const { merged, report } = mergeProgress(a, a, CTX)
    assert.equal(report.changed, false, `${name}: merging with itself reported a change`)
    assert.equal(contentFingerprint(merged), contentFingerprint(a), name)
    // rev must NOT advance, or the profile is permanently dirty and push-loops.
    assert.equal(merged.sync.rev, a.sync.rev, `${name}: rev advanced on a no-op merge`)
    assert.deepEqual(progressInvariantViolations(merged), [], name)
  }
})

test('LAW 2 — commutative: merge(a, b) and merge(b, a) agree on content', () => {
  const s = SAMPLES()
  const pairs: Array<[PersistedProgress, PersistedProgress, string]> = [
    [s.fresh, s.midBook, 'fresh/mid'],
    [s.midBook, s.nearlyFull, 'mid/nearly'],
    [s.nearlyFull, s.fullBook, 'nearly/full'],
    [doc(4, 'device-A'), doc(9, 'device-B'), 'two devices'],
  ]
  for (const [a, b, name] of pairs) {
    const ab = mergeProgress(a, b, CTX).merged
    const ba = mergeProgress(b, a, { ...CTX, deviceId: 'device-B' }).merged
    assert.equal(contentFingerprint(ab), contentFingerprint(ba), name)
  }
})

test('LAW 3 — associative: merge(merge(a,b),c) ≡ merge(a,merge(b,c))', () => {
  const a = doc(4, 'device-A')
  const b = doc(9, 'device-B')
  const c = doc(2, 'device-C')
  const left = mergeProgress(mergeProgress(a, b, CTX).merged, c, CTX).merged
  const right = mergeProgress(a, mergeProgress(b, c, CTX).merged, CTX).merged
  assert.equal(contentFingerprint(left), contentFingerprint(right))
})

test('repeated application is STABLE over five merges (what makes a 409 retry converge)', () => {
  const a = doc(4, 'device-A')
  const b = doc(9, 'device-B')
  let merged = mergeProgress(a, b, CTX).merged
  const first = contentFingerprint(merged)
  for (let i = 0; i < 5; i++) {
    const step = mergeProgress(merged, b, CTX)
    merged = step.merged
    assert.equal(contentFingerprint(merged), first, `merge ${i + 2} drifted`)
    if (i > 0) assert.equal(step.report.changed, false, `merge ${i + 2} reported a spurious change`)
  }
})

test('the merged result always satisfies the invariants, across every region × direction', () => {
  const s = SAMPLES()
  const states = Object.values(s)
  for (const a of states) {
    for (const b of states) {
      const { merged } = mergeProgress(a, b, CTX)
      assert.deepEqual(
        progressInvariantViolations(merged),
        [],
        `${totalSlots(a)} ⊕ ${totalSlots(b)}`,
      )
    }
  }
})

// ----- the reward-loss cases the ledger exists for ----------------------------------------------

test('NEVER loses a reward: totalSlots(merged) ≥ max(totalSlots(a), totalSlots(b))', () => {
  const s = SAMPLES()
  const states = [...Object.values(s), doc(4, 'device-A'), doc(9, 'device-B')]
  for (const a of states) {
    for (const b of states) {
      const { merged } = mergeProgress(a, b, CTX)
      assert.ok(
        totalSlots(merged) >= Math.max(totalSlots(a), totalSlots(b)),
        `${totalSlots(a)} ⊕ ${totalSlots(b)} → ${totalSlots(merged)}`,
      )
    }
  }
})

test('TWO IPADS OFFLINE: 160 + 160 XP → 320 XP and 8 slots, exactly (the §6.2b case)', () => {
  // Each device earned 160 XP and its child physically celebrated 4 rewards. Both sides stay INSIDE
  // the fast tier, where the curve is linear and the sums therefore compose exactly — see the
  // convexity test below for what happens when they straddle the boundary.
  const a = defaultPersisted('kid-1', 'iPad-A', NOW)
  a.ledger['iPad-A'] = { xp: 160, slots: 4, bloom: { alphabet: 160 } }
  a.stickers.grantedSlots = 4
  const b = defaultPersisted('kid-1', 'iPad-B', NOW)
  b.ledger['iPad-B'] = { xp: 160, slots: 4, bloom: { math: 160 } }
  b.stickers.grantedSlots = 4

  const { merged, report } = mergeProgress(a, b, CTX)
  assert.equal(totalXp(merged), 320, 'a naive max() would have said 160')
  assert.equal(totalSlots(merged), 8, 'and would have erased 4 celebrated rewards')
  assert.equal(merged.stickers.grantedSlots, 8)
  assert.equal(report.clampedSlots, false, 'valid input must never trip the repair clamp')
  assert.equal(owedRewards(merged), 0, '320 XP owes exactly 8 fast-tier slots')
  assert.deepEqual(progressInvariantViolations(merged), [])
  // Both sections' bloom survives.
  assert.equal(bloomXpFor(merged, 'alphabet'), 160)
  assert.equal(bloomXpFor(merged, 'math'), 160)
})

// The level half of the merge clamp is documented in progressMerge.ts as "repair-only, provably inert
// on valid input". That proof is stated over `max_i slots_i`, but the cursor is `Σ slots_i` — and for
// any CONVEX cost curve Σ xpForSlots(n_i) < xpForSlots(Σ n_i), so two VALID offline devices can sum to
// more slots than their summed XP justifies and the clamp fires on good data.
//
// This is NOT new in Reward Pacing PRD-01 and the merge is deliberately untouched by it: the old
// 18/×2 curve did exactly the same at 15 + 15 slots (1200 XP summed against the 1680 that 30 slots
// cost). Making the fast tier shorter only moves the threshold down, from ~15 slots each to ~5. Pinned
// here so the behaviour is a known, deliberate property rather than a surprise in a bug report — the
// clamp is what keeps `grantedSlots ≤ collectedFromLevel(globalLevel())` true, and that inequality is
// the invariant the whole read model rests on.
test('CONVEXITY: two offline devices straddling the tier boundary get clamped, by design', () => {
  const a = defaultPersisted('kid-1', 'iPad-A', NOW)
  a.ledger['iPad-A'] = { xp: xpForSlots(5), slots: 5, bloom: { alphabet: xpForSlots(5) } }
  a.stickers.grantedSlots = 5
  const b = defaultPersisted('kid-1', 'iPad-B', NOW)
  b.ledger['iPad-B'] = { xp: xpForSlots(5), slots: 5, bloom: { math: xpForSlots(5) } }
  b.stickers.grantedSlots = 5

  // 5 slots cost 200 each, but 10 slots cost 480 — so 400 XP justifies only 9.
  assert.equal(xpForSlots(5) * 2, 400)
  assert.equal(xpForSlots(10), 480)

  const { merged, report } = mergeProgress(a, b, CTX)
  assert.equal(totalXp(merged), 400, 'XP still sums — the G-Counter is never the thing that loses')
  assert.equal(report.clampedSlots, true)
  assert.equal(merged.stickers.grantedSlots, 9, 'clamped to what the summed XP actually justifies')
  // The point of the clamp: whatever it costs, the invariant holds and nothing owes twice.
  assert.deepEqual(progressInvariantViolations(merged), [])
  assert.equal(owedRewards(merged), 0)
  // The ledger is trimmed to match, so `grantedSlots === Σ ledger.slots` stays true.
  assert.equal(totalSlots(merged), 9)
})

test('a device only ever increments ITS OWN entry, so a stale remote copy cannot roll us back', () => {
  const current = doc(6, 'device-A')
  const stale = JSON.parse(JSON.stringify(current)) as PersistedProgress
  stale.ledger['device-A'] = { xp: xpForSlots(2), slots: 2, bloom: { alphabet: xpForSlots(2) } }
  stale.stickers.grantedSlots = 2
  const { merged, report } = mergeProgress(current, stale, CTX)
  assert.equal(totalSlots(merged), 6)
  assert.equal(report.changed, false)
})

test('a cursor past the end of the book is CLAMPED, not preserved', () => {
  // Reachable for real: the ledger is a G-Counter, so two devices that each filled the book offline
  // sum to 2×REWARD_SLOTS. The gold pass used to absorb that by wrapping into duplicates; with it gone
  // the cursor has to be capped here, or `rewardNumber()` out-runs the pictures that exist.
  const a = doc(REWARD_SLOTS, 'device-A')
  const b = doc(REWARD_SLOTS, 'device-B')
  const { merged } = mergeProgress(a, b, CTX)
  assert.equal(merged.stickers.grantedSlots, REWARD_SLOTS)
  assert.equal(totalSlots(merged), REWARD_SLOTS, 'the ledger is trimmed too, or the invariant breaks')
  assert.equal(owedRewards(merged), 0, 'a full book owes nothing however much XP is behind it')
  assert.deepEqual(progressInvariantViolations(merged), [])

  // The book reads exactly the path, once each — no duplicate anywhere.
  const s = derive(merged, NOW)
  assert.equal(s.totals.totalStickers, REWARD_SLOTS)
  assert.equal(s.stickers.collected[REWARD_PATH[5].id].count, 1)
  assert.equal(s.stickers.collected[REWARD_PATH[REWARD_SLOTS - 1].id].count, 1)
})

test('membership is re-derived from SLOTS, not the level — a pending ceremony survives a merge', () => {
  const a = doc(3, 'device-A', { extraXp: REWARD_XP }) // level says 4 owed, 3 handed over
  assert.equal(owedRewards(a), 1)
  const b = doc(3, 'device-A')
  const { merged } = mergeProgress(a, b, CTX)
  assert.equal(
    owedRewards(merged),
    1,
    'deriving from the level would pre-grant it and the child would never see the ceremony',
  )
  assert.equal(merged.stickers.grantedSlots, 3)
})

test('the repair clamp fires only on corrupt input, and repairs the ledger to match', () => {
  const corrupt = doc(5, 'device-A')
  corrupt.ledger['device-A'].slots = 40 // more slots than the XP can justify
  corrupt.stickers.grantedSlots = 40
  const { merged, report } = mergeProgress(corrupt, doc(5, 'device-A'), CTX)
  assert.equal(report.clampedSlots, true)
  assert.equal(merged.stickers.grantedSlots, collectedFromLevel(levelFromXp(totalXp(merged)).level))
  assert.equal(totalSlots(merged), merged.stickers.grantedSlots, 'the ledger must be trimmed too')
  assert.deepEqual(progressInvariantViolations(merged), [])
})

// ----- reset / epoch ----------------------------------------------------------------------------

test('RESET WINS: an epoch-1 empty doc beats an epoch-0 fat one, wholesale', () => {
  const fat = doc(REWARD_SLOTS, 'device-A')
  const reset = defaultPersisted('kid-1', 'device-B', NOW)
  reset.sync.epoch = 1

  const pulled = mergeProgress(reset, fat, CTX) // the reset device pulls old data
  assert.equal(pulled.report.epochWinner, 'local')
  assert.equal(totalSlots(pulled.merged), 0, 'the next pull must not resurrect the stickers')
  assert.equal(pulled.report.changed, false)

  const sibling = mergeProgress(fat, reset, CTX) // the OTHER device pulls the reset
  assert.equal(sibling.report.epochWinner, 'remote')
  assert.equal(totalSlots(sibling.merged), 0)
  assert.equal(sibling.report.changed, true)
  assert.equal(sibling.merged.sync.epoch, 1)
  assert.equal(sibling.merged.profileId, 'kid-1')
  assert.deepEqual(progressInvariantViolations(sibling.merged), [])
})

test('once epochs match again the join resumes normally', () => {
  const a = doc(3, 'device-A', { epoch: 2 })
  const b = doc(6, 'device-B', { epoch: 2 })
  const { merged, report } = mergeProgress(a, b, CTX)
  assert.equal(report.epochWinner, 'equal')
  assert.equal(totalSlots(merged), 9)
  assert.equal(merged.sync.epoch, 2)
})

// ----- newIds / seen cursor ---------------------------------------------------------------------

test('newIds NEVER resurrects: a dismissed badge stays dismissed after a merge', () => {
  const seen = doc(5, 'device-A', { seen: 5 }) // book opened, badges cleared
  const unseen = doc(5, 'device-A', { seen: 0 }) // a sibling device that never opened it
  const { merged } = mergeProgress(seen, unseen, CTX)
  assert.equal(merged.stickers.seenThroughSlot, 5)
  assert.deepEqual(derive(merged, NOW).stickers.newIds, [])
})

test('a genuinely NEW reward from another device still shows as new', () => {
  // Both sides inside the fast tier so the summed XP justifies the summed slots exactly — this test
  // is about the `seen` cursor, and a clamp firing here would make it measure the wrong thing.
  const local = doc(3, 'device-A', { seen: 3 })
  const remote = doc(5, 'device-B', { seen: 3 })
  const { merged } = mergeProgress(local, remote, CTX)
  // Σ slots = 8, and the seen cursor stays at 3 → slots 3..7 are new.
  assert.equal(merged.stickers.grantedSlots, 8)
  assert.equal(merged.stickers.seenThroughSlot, 3)
  assert.equal(derive(merged, NOW).stickers.newIds.length, 5)
})

test('a seen cursor ahead of the granted prefix is clamped, not trusted', () => {
  const a = doc(2, 'device-A', { seen: 2 })
  const b = doc(2, 'device-A', { seen: 2 })
  b.stickers.seenThroughSlot = 40 // corrupt
  const { merged } = mergeProgress(a, b, CTX)
  assert.equal(merged.stickers.seenThroughSlot, 2)
})

// ----- firstAt, bests, explored ------------------------------------------------------------------

test('firstAt is a MIN-register over positive values (the book shows the earliest date)', () => {
  const a = doc(2, 'device-A')
  const b = doc(2, 'device-A')
  a.stickers.firstAt[REWARD_PATH[0].id] = 5000
  b.stickers.firstAt[REWARD_PATH[0].id] = 2000
  b.stickers.firstAt[REWARD_PATH[1].id] = 0 // a zero must be ignored, not min'd to 1970
  const { merged } = mergeProgress(a, b, CTX)
  assert.equal(merged.stickers.firstAt[REWARD_PATH[0].id], 2000)
  assert.ok(merged.stickers.firstAt[REWARD_PATH[1].id] > 0)
})

test('per-game BESTS take the max; the two counters take max, never sum', () => {
  const a = doc(1, 'device-A')
  const b = doc(1, 'device-A')
  a.perGame['alphabet.quiz'] = {
    bestStreak: 8,
    bestStars: 3,
    bestCount: 8,
    roundsCompleted: 10,
    lifetimeCorrect: 60,
  }
  b.perGame['alphabet.quiz'] = {
    bestStreak: 5,
    bestStars: 2,
    bestCount: 4,
    roundsCompleted: 14,
    lifetimeCorrect: 90,
  }
  b.perGame['math.plusminus'] = {
    bestStreak: 3,
    bestStars: 1,
    bestCount: 3,
    roundsCompleted: 2,
    lifetimeCorrect: 8,
  }
  const { merged } = mergeProgress(a, b, CTX)
  const q = merged.perGame['alphabet.quiz']
  assert.equal(q.bestStreak, 8)
  assert.equal(q.bestStars, 3)
  assert.equal(q.bestCount, 8)
  // SUMMING would be non-idempotent — the merge runs on every sync and the numbers would explode.
  assert.equal(q.roundsCompleted, 14)
  assert.equal(q.lifetimeCorrect, 90)
  assert.ok(merged.perGame['math.plusminus'], 'a game only the remote knows must be adopted')
})

test('explored is a grow-only set: union, de-duped, order-insensitive', () => {
  const a = doc(1, 'device-A')
  const b = doc(1, 'device-A')
  a.progression.explored.alphabet = ['A', 'B']
  b.progression.explored.alphabet = ['B', 'C']
  b.progression.explored.math = ['1']
  const { merged } = mergeProgress(a, b, CTX)
  assert.deepEqual(merged.progression.explored.alphabet, ['A', 'B', 'C'])
  assert.deepEqual(merged.progression.explored.math, ['1'])
  // Reversing the arguments gives the same set (markBrowsed never removes).
  const flipped = mergeProgress(b, a, CTX).merged
  assert.deepEqual(flipped.progression.explored.alphabet, ['A', 'B', 'C'])
})

test('totalStars takes the max (a cosmetic Phase-A under-count, never a sum)', () => {
  const a = doc(3, 'device-A', { stars: 30 })
  const b = doc(3, 'device-A', { stars: 21 })
  assert.equal(mergeProgress(a, b, CTX).merged.totals.totalStars, 30)
})

// ----- settings LWW -----------------------------------------------------------------------------

const stamped = (
  p: PersistedProgress,
  path: string,
  at: number,
  by: string,
): PersistedProgress => {
  p.settingsMeta[path] = { at, by }
  return p
}

test('settings: the NEWER stamp wins per field', () => {
  const a = stamped(doc(1, 'device-A'), 'sfxEnabled', 1000, 'device-A')
  a.settings.sfxEnabled = true
  const b = stamped(doc(1, 'device-B'), 'sfxEnabled', 2000, 'device-B')
  b.settings.sfxEnabled = false
  const { merged, report } = mergeProgress(a, b, CTX)
  assert.equal(merged.settings.sfxEnabled, false)
  assert.ok(report.changedSettings.includes('sfxEnabled'))
  assert.equal(merged.settingsMeta['sfxEnabled'].at, 2000)
})

test('settings: an OLDER remote stamp does not win', () => {
  const a = stamped(doc(1, 'device-A'), 'difficulty.global', 5000, 'device-A')
  a.settings.difficulty.global = 'svaer'
  const b = stamped(doc(1, 'device-B'), 'difficulty.global', 1000, 'device-B')
  b.settings.difficulty.global = 'let'
  assert.equal(mergeProgress(a, b, CTX).merged.settings.difficulty.global, 'svaer')
})

test('settings: an exact stamp TIE resolves by the larger deviceId, identically in both directions', () => {
  const mk = (device: string, level: 'let' | 'svaer') => {
    const p = stamped(doc(1, device), 'difficulty.global', 7000, device)
    p.settings.difficulty.global = level
    return p
  }
  const a = mk('device-A', 'let')
  const b = mk('device-B', 'svaer')
  assert.equal(mergeProgress(a, b, CTX).merged.settings.difficulty.global, 'svaer')
  assert.equal(mergeProgress(b, a, CTX).merged.settings.difficulty.global, 'svaer')
})

test('difficulty is LWW PER SECTION, and clearing an override propagates (absence is a value)', () => {
  const a = stamped(doc(1, 'device-A'), 'difficulty.perSection.math', 1000, 'device-A')
  a.settings.difficulty.perSection = { math: 'let', colors: 'svaer' }
  stamped(a, 'difficulty.perSection.colors', 1000, 'device-A')

  const b = stamped(doc(1, 'device-B'), 'difficulty.perSection.math', 9000, 'device-B')
  b.settings.difficulty.perSection = undefined // math override cleared on the newer device

  const { merged } = mergeProgress(a, b, CTX)
  assert.equal(merged.settings.difficulty.perSection?.math, undefined, 'the clear must propagate')
  assert.equal(merged.settings.difficulty.perSection?.colors, 'svaer', 'other sections untouched')
})

test('themeId syncs the skin across devices', () => {
  const a = stamped(doc(1, 'device-A'), 'themeId', 1000, 'device-A')
  a.settings.themeId = 'kid'
  const b = stamped(doc(1, 'device-B'), 'themeId', 4000, 'device-B')
  b.settings.themeId = 'space'
  assert.equal(mergeProgress(a, b, CTX).merged.settings.themeId, 'space')
})

test('musicDefaultOn is an OR — a MARKER, not a preference (an old false must not re-flip music on)', () => {
  const withMarker = doc(1, 'device-A')
  withMarker.settings.musicDefaultOn = true
  withMarker.settings.musicEnabled = false // the adult deliberately muted music
  stamped(withMarker, 'musicEnabled', 9000, 'device-A')

  const old = doc(1, 'device-B')
  old.settings.musicDefaultOn = false
  old.settings.musicEnabled = true
  stamped(old, 'musicEnabled', 1000, 'device-B')

  const { merged } = mergeProgress(withMarker, old, CTX)
  assert.equal(merged.settings.musicDefaultOn, true, 'the marker is sticky')
  assert.equal(merged.settings.musicEnabled, false, 'and the explicit mute survives')
})

test('an ADOPTED legacy setting beats an untouched fresh profile (stamped > 0 vs 0)', () => {
  const fresh = doc(0, 'device-A') // no stamps at all
  const legacy = doc(0, 'device-A')
  legacy.settings.sfxEnabled = false
  legacy.settingsMeta['sfxEnabled'] = { at: 1, by: 'legacy' }
  assert.equal(mergeProgress(fresh, legacy, CTX).merged.settings.sfxEnabled, false)
})

// ----- the empty-ceremony guard -----------------------------------------------------------------

test('EMPTY-CEREMONY GUARD: a merge that jumps the level with no debt advances the cursor', () => {
  // Local has celebrated up to level 4; remote brings enough slots+XP that nothing is owed.
  const local = doc(3, 'device-A')
  local.progression.lastCelebratedLevel = 2
  const remote = doc(3, 'device-B')
  const { merged } = mergeProgress(local, remote, CTX)
  const level = levelFromXp(totalXp(merged)).level
  assert.equal(owedRewards(merged), 0)
  assert.equal(
    merged.progression.lastCelebratedLevel,
    level,
    'confetti about nothing is exactly what this prevents',
  )
})

test('the guard does NOT suppress a real pending ceremony (debt keeps the cursor behind)', () => {
  const local = doc(3, 'device-A', { extraXp: REWARD_XP })
  local.progression.lastCelebratedLevel = levelFromXp(xpForSlots(3)).level
  const before = local.progression.lastCelebratedLevel
  const { merged } = mergeProgress(local, doc(3, 'device-A'), CTX)
  assert.equal(owedRewards(merged), 1)
  assert.equal(merged.progression.lastCelebratedLevel, before, 'the ceremony must still fire')
  assert.ok(levelFromXp(totalXp(merged)).level > merged.progression.lastCelebratedLevel)
})

// ----- report / rev bookkeeping -----------------------------------------------------------------

test('rev advances only when something changed, and the report describes the delta', () => {
  // Fast tier both sides (see the CONVEXITY case) — this test is about `rev` and the delta report,
  // not about the clamp.
  const a = doc(3, 'device-A')
  const b = doc(5, 'device-B')
  const { merged, report } = mergeProgress(a, b, CTX)
  assert.equal(report.changed, true)
  assert.equal(merged.sync.rev, Math.max(a.sync.rev, b.sync.rev) + 1)
  assert.equal(report.xpBefore, totalXp(a))
  assert.equal(report.xpAfter, totalXp(merged))
  assert.equal(report.slotsBefore, 3)
  assert.equal(report.slotsAfter, 8)
  // syncedRev is OUR numbering and must not be touched by a merge.
  assert.equal(merged.sync.syncedRev, a.sync.syncedRev)
  assert.equal(merged.sync.originDevice, a.sync.originDevice)
})
