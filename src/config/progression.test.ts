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
  taskXp,
} from './progression.ts'

test('xpToNext: steady linear climb, low floor, soft cap of 160', () => {
  assert.equal(xpToNext(1), 50) // level 1 → 2 costs the base 50
  assert.equal(xpToNext(0), 50) // guarded floor (level-1 cost, never below)
  assert.equal(xpToNext(2), 60) // 50 + 10·1
  assert.equal(xpToNext(3), 70) // 50 + 10·2
  assert.equal(xpToNext(12), 160) // 50 + 10·11 → hits the cap
  assert.equal(xpToNext(20), 160) // clamped at the 160 cap
  assert.equal(xpToNext(50), 160) // stays capped forever after
  // Strictly non-decreasing across the interesting range.
  for (let l = 1; l < 60; l++) assert.ok(xpToNext(l + 1) >= xpToNext(l))
})

test('levelFromXp: thresholds and remainder bookkeeping', () => {
  // Level 1 needs 50 XP to advance.
  assert.equal(levelFromXp(0).level, 1)
  assert.equal(levelFromXp(49).level, 1)
  assert.equal(levelFromXp(50).level, 2)
  // Cumulative: 50 (→L2) + 60 (→L3) = 110.
  assert.equal(levelFromXp(109).level, 2)
  assert.equal(levelFromXp(110).level, 3)
  // Remainder fields are consistent with the curve.
  const info = levelFromXp(55) // 5 XP into level 2
  assert.equal(info.level, 2)
  assert.equal(info.xpIntoLevel, 5)
  assert.equal(info.xpForThisLevel, xpToNext(2))
  assert.equal(info.xpToNextLevel, xpToNext(2) - 5)
  assert.equal(info.xpIntoLevel + info.xpToNextLevel, info.xpForThisLevel)
  // Negative / fractional XP is floored to a valid level-1 state.
  assert.equal(levelFromXp(-100).level, 1)
  assert.equal(levelFromXp(49.9).level, 1)
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

test('roundXp: bonuses ONLY (no base / per-correct / per-sticker — those are live per-task now)', () => {
  // Perfect, no new best, no page complete → just the perfect-round bonus (6). Per-correct and
  // per-sticker terms are gone (double-counting the live per-task grants).
  assert.equal(
    roundXp({ correct: 8, total: 8, mistakes: 0, anyNewBest: false, stickerCount: 1, pageCompleted: false }),
    6,
  )
  // Perfect + new best + page complete: 6 + 8 + 15 = 29. stickerCount no longer contributes.
  assert.equal(
    roundXp({ correct: 8, total: 8, mistakes: 0, anyNewBest: true, stickerCount: 2, pageCompleted: true }),
    29,
  )
  // A weak round (mistakes, no best, no page) now yields NO round-end bonus — the per-task XP was
  // already granted live during play, so a bonuses-only round can legitimately be 0.
  assert.equal(
    roundXp({ correct: 3, total: 8, mistakes: 5, anyNewBest: false, stickerCount: 1, pageCompleted: false }),
    0,
  )
  // Only the new-best bonus, no perfect (had mistakes): 8.
  assert.equal(
    roundXp({ correct: 6, total: 8, mistakes: 2, anyNewBest: true, stickerCount: 0, pageCompleted: false }),
    8,
  )
})

test('taskXp: per-game base + first-try bonus, difficulty-independent', () => {
  assert.equal(taskXp('memory', false), 2) // per matched pair, no first-try notion
  assert.equal(taskXp('memory', true), 2) // memory firstTry bonus is 0
  assert.equal(taskXp('colors.farvejagt', true), 8) // 6 + 2
  assert.equal(taskXp('colors.farvejagt', false), 6)
  assert.equal(taskXp('math.counting', true), 4) // falls back to default (3 + 1)
  assert.equal(taskXp('math.counting', false), 3)
  assert.equal(taskXp('ordleg.spelling', true), 6) // 4 + 2
  assert.equal(taskXp('browse', false), 1) // per new item explored
  assert.equal(taskXp('unknown.game', true), 4) // unknown → default
})
