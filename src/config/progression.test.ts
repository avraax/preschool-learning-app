// Unit tests for the progression curves (Liveliness PRD-01). Runs on the Node built-in test runner
// with type-stripping: `npm test` → `node --test src/config/progression.test.ts` (Node ≥22.18).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  xpToNext,
  levelFromXp,
  BLOOM_STAGE_XP,
  BLOOM_MAX_XP,
  bloomStage,
  bloomFill,
  roundXp,
} from './progression.ts'

test('xpToNext: floor of 20, monotonic ramp, hard cap of 260', () => {
  assert.equal(xpToNext(1), 20) // level 1 → 2 costs the base 20
  assert.equal(xpToNext(0), 20) // guarded floor (never below 20)
  assert.equal(xpToNext(2), 35) // 20 + 15·1^1.25
  assert.equal(xpToNext(10), 254) // last pre-cap step
  assert.equal(xpToNext(11), 260) // clamps at the 260 cap
  assert.equal(xpToNext(50), 260) // stays capped forever after
  // Strictly non-decreasing across the interesting range.
  for (let l = 1; l < 60; l++) assert.ok(xpToNext(l + 1) >= xpToNext(l))
})

test('levelFromXp: thresholds and remainder bookkeeping', () => {
  // Level 1 needs 20 XP to advance.
  assert.equal(levelFromXp(0).level, 1)
  assert.equal(levelFromXp(19).level, 1)
  assert.equal(levelFromXp(20).level, 2)
  // Cumulative: 20 (→L2) + 35 (→L3) = 55.
  assert.equal(levelFromXp(54).level, 2)
  assert.equal(levelFromXp(55).level, 3)
  // Remainder fields are consistent with the curve.
  const info = levelFromXp(25) // 5 XP into level 2
  assert.equal(info.level, 2)
  assert.equal(info.xpIntoLevel, 5)
  assert.equal(info.xpForThisLevel, xpToNext(2))
  assert.equal(info.xpToNextLevel, xpToNext(2) - 5)
  assert.equal(info.xpIntoLevel + info.xpToNextLevel, info.xpForThisLevel)
  // Negative / fractional XP is floored to a valid level-1 state.
  assert.equal(levelFromXp(-100).level, 1)
  assert.equal(levelFromXp(19.9).level, 1)
})

test('bloomStage: correct step at each threshold boundary', () => {
  assert.deepEqual([...BLOOM_STAGE_XP], [0, 40, 120, 260, 480])
  assert.equal(bloomStage(0), 0)
  assert.equal(bloomStage(39), 0)
  assert.equal(bloomStage(40), 1)
  assert.equal(bloomStage(119), 1)
  assert.equal(bloomStage(120), 2)
  assert.equal(bloomStage(259), 2)
  assert.equal(bloomStage(260), 3)
  assert.equal(bloomStage(479), 3)
  assert.equal(bloomStage(480), 4)
  assert.equal(bloomStage(10000), 4) // never exceeds the top stage
})

test('bloomFill: 0..1 clamped', () => {
  assert.equal(bloomFill(0), 0)
  assert.equal(bloomFill(BLOOM_MAX_XP / 2), 0.5)
  assert.equal(bloomFill(BLOOM_MAX_XP), 1)
  assert.equal(bloomFill(BLOOM_MAX_XP * 3), 1) // clamped high
  assert.equal(bloomFill(-50), 0) // clamped low
})

test('roundXp: structure-only formula', () => {
  // Perfect 8/8, one round sticker, no new best, no page complete: 8 + 16 + 6 + 3 = 33.
  assert.equal(
    roundXp({ correct: 8, total: 8, mistakes: 0, anyNewBest: false, stickerCount: 1, pageCompleted: false }),
    33,
  )
  // Perfect + new best + bonus sticker + page complete: 8 + 16 + 6 + 8 + 6 + 15 = 59.
  assert.equal(
    roundXp({ correct: 8, total: 8, mistakes: 0, anyNewBest: true, stickerCount: 2, pageCompleted: true }),
    59,
  )
  // A weak round still yields clearly-positive, visible movement (no failure state).
  const weak = roundXp({ correct: 3, total: 8, mistakes: 5, anyNewBest: false, stickerCount: 1, pageCompleted: false })
  assert.equal(weak, 17)
  assert.ok(weak >= 12)
  // Negative inputs can't produce negative XP.
  assert.ok(
    roundXp({ correct: -5, total: 0, mistakes: 0, anyNewBest: false, stickerCount: -3, pageCompleted: false }) >= 8,
  )
})
