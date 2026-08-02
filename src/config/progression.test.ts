// Unit tests for the progression curves (Reward Book PRD-01 §8 W1). Runs on the Node built-in test
// runner with type-stripping: `npm test` → `node --test src/config/progression.test.ts` (Node ≥22.18).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REWARD_XP,
  FAST_SLOTS,
  CHAPTER_SIZE,
  COMPANION_STAGES,
  MAX_ROUND_XP,
  BROWSE_TASK_XP,
  xpToNext,
  levelFromXp,
  BLOOM_STAGE_XP,
  BLOOM_MAX_XP,
  bloomStage,
  bloomFill,
  roundXp,
  taskXp,
  collectedFromLevel,
  chapterOfSlot,
  companionStageForCollected,
  rewardNumber,
} from './progression.ts'
import { REWARD_SLOTS } from './stickers.ts'

test('economy constants hang together', async () => {
  assert.equal(FAST_SLOTS, CHAPTER_SIZE * 2) // chapters 1-2 are the fast tier
  assert.equal(REWARD_XP, 40)
  // REWARD_SLOTS / CHAPTER_COUNT are DERIVED and live in stickers.ts now — pinned in stickers.test.ts.
  // What must hold HERE is that progression.ts does not re-export them, or "add a chapter" grows a
  // second definition that can drift from the data.
  const mod = await import('./progression.ts')
  assert.equal('REWARD_SLOTS' in mod, false)
  assert.equal('CHAPTER_COUNT' in mod, false)
})

test('xpToNext: exactly two tiers — one round per slot, then two', () => {
  assert.equal(xpToNext(1), REWARD_XP) // first reward costs one round
  assert.equal(xpToNext(0), REWARD_XP) // guarded floor
  assert.equal(xpToNext(FAST_SLOTS), REWARD_XP) // level 18 still fast (awards slot 18)
  assert.equal(xpToNext(FAST_SLOTS + 1), REWARD_XP * 2) // level 19 → the slow tier
  assert.equal(xpToNext(45), REWARD_XP * 2)
  // Stays at two rounds per reward FOREVER. There is deliberately no third, slower tier: that is
  // exactly the grind the extra chapters exist to avoid (Reward Horizon PRD-01 §3.4).
  assert.equal(xpToNext(60), REWARD_XP * 2)
  assert.equal(xpToNext(200), REWARD_XP * 2)
  // Strictly non-decreasing across the interesting range.
  for (let l = 1; l < 60; l++) assert.ok(xpToNext(l + 1) >= xpToNext(l))
})

test('levelFromXp: thresholds, remainder bookkeeping, monotonic across the tier change', () => {
  assert.equal(levelFromXp(0).level, 1)
  assert.equal(levelFromXp(39).level, 1)
  assert.equal(levelFromXp(40).level, 2) // first reward
  assert.equal(levelFromXp(79).level, 2)
  assert.equal(levelFromXp(80).level, 3)

  // 18 fast levels cost 18 × 40 = 720 XP and land on level 19 (18 rewards collected).
  assert.equal(levelFromXp(720).level, 19)
  assert.equal(collectedFromLevel(levelFromXp(720).level), FAST_SLOTS)
  // From there each reward costs 80: level 20 at 800.
  assert.equal(levelFromXp(799).level, 19)
  assert.equal(levelFromXp(800).level, 20)

  // Filling the whole book = 18×40 + 54×80 = 720 + 4320 = 5040 XP → level 73, 72 collected.
  const full = FAST_SLOTS * REWARD_XP + (REWARD_SLOTS - FAST_SLOTS) * REWARD_XP * 2
  assert.equal(full, 5040)
  assert.equal(levelFromXp(full).level, REWARD_SLOTS + 1)
  assert.equal(collectedFromLevel(levelFromXp(full).level), REWARD_SLOTS)

  // Remainder fields stay consistent with the curve on both sides of the tier change.
  for (const xp of [5, 45, 719, 725, 2000]) {
    const info = levelFromXp(xp)
    assert.equal(info.xpForThisLevel, xpToNext(info.level))
    assert.equal(info.xpIntoLevel + info.xpToNextLevel, info.xpForThisLevel)
    assert.ok(info.xpIntoLevel >= 0 && info.xpIntoLevel < info.xpForThisLevel)
  }

  // Monotonic in XP (no dip at the tier boundary).
  let prev = 0
  for (let xp = 0; xp <= 3200; xp += 7) {
    const lvl = levelFromXp(xp).level
    assert.ok(lvl >= prev, `level dipped at ${xp}`)
    prev = lvl
  }

  // Negative / fractional XP floors to a valid level-1 state.
  assert.equal(levelFromXp(-100).level, 1)
  assert.equal(levelFromXp(39.9).level, 1)
})

test('taskXp: normalised so ANY full round is worth about one reward', () => {
  // The table in PRD §5: 5 / 8 / 10 / 20-task rounds all land at ≈ REWARD_XP.
  const round = (tasks: number, firstTry: boolean) => tasks * taskXp(tasks, firstTry)
  assert.equal(taskXp(8, false), 5) // ceil(40/8)
  assert.equal(taskXp(8, true), 6) // + first-try bonus
  assert.equal(round(8, false), 40)
  assert.equal(round(8, true), 48)

  assert.equal(taskXp(5, false), 8) // colors.farvejagt — 5 boards
  assert.equal(taskXp(5, true), 9)
  assert.equal(round(5, false), 40)
  assert.equal(round(5, true), 45)

  assert.equal(taskXp(10, false), 4) // memory.*.10 — 10 pairs
  assert.equal(round(10, false), 40)

  assert.equal(taskXp(20, false), 2) // memory.*.20 — 20 pairs
  assert.equal(round(20, false), 40)

  // EVERY round length from 1..30 clears one reward's worth in the fast tier — the pacing promise
  // ("chapters 1-2: a reward per completed round, mistakes or not") must hold for all of them.
  for (let tasks = 1; tasks <= 30; tasks++) {
    assert.ok(
      round(tasks, false) >= REWARD_XP,
      `a ${tasks}-task round with no first-tries only earns ${round(tasks, false)}`,
    )
  }

  // Degenerate inputs are floored, never zero or negative (a 0-XP task would stall the ring).
  assert.equal(taskXp(0, false), 40)
  assert.equal(taskXp(-3, false), 40)
  assert.ok(taskXp(1000, false) >= 1)
  // Difficulty is not a parameter here at all — that's the fairness guardrail, enforced by signature.
  assert.equal(taskXp.length, 2)
  assert.equal(BROWSE_TASK_XP, 2)
})

test('roundXp: bonuses ONLY — they carry into the next reward, never grant one', () => {
  assert.equal(roundXp({ mistakes: 0, anyNewBest: false }), 6) // perfect
  assert.equal(roundXp({ mistakes: 0, anyNewBest: true }), 14) // perfect + new best
  assert.equal(roundXp({ mistakes: 2, anyNewBest: true }), 8) // new best only
  assert.equal(roundXp({ mistakes: 5, anyNewBest: false }), 0) // a weak round adds nothing extra
  // A bonus alone can never be worth a reward.
  assert.ok(roundXp({ mistakes: 0, anyNewBest: true }) < REWARD_XP)
})

test('one round can never skip a slot in the SLOW tier (and the fast-tier case is handled)', () => {
  // Biggest single round: 8 first-try tasks (48) + perfect (6) + new best (8) = 62.
  assert.equal(8 * taskXp(8, true) + roundXp({ mistakes: 0, anyNewBest: true }), MAX_ROUND_XP)
  assert.equal(MAX_ROUND_XP, 62)

  // Slow tier (80/slot): even starting 1 XP short of a slot, a max round crosses at most ONE.
  const slowStart = 18 * REWARD_XP + REWARD_XP * 2 - 1 // 1 XP shy of slot 20
  const slowBefore = collectedFromLevel(levelFromXp(slowStart).level)
  const slowAfter = collectedFromLevel(levelFromXp(slowStart + MAX_ROUND_XP).level)
  assert.equal(slowAfter - slowBefore, 1)

  // Fast tier (40/slot): 62 XP CAN cross two — the PRD's "max round = 54" understated it by treating
  // perfect and new-best as alternatives. grantPendingRewards() awards every owed slot in one commit
  // precisely so this is correct rather than a lost reward; asserted here so the property is pinned.
  const fastStart = REWARD_XP - 1 // 1 XP shy of slot 1
  const fastBefore = collectedFromLevel(levelFromXp(fastStart).level)
  const fastAfter = collectedFromLevel(levelFromXp(fastStart + MAX_ROUND_XP).level)
  assert.equal(fastAfter - fastBefore, 2)
  // But never THREE, at any starting point in either tier.
  for (let xp = 0; xp <= 3000; xp++) {
    const gained =
      collectedFromLevel(levelFromXp(xp + MAX_ROUND_XP).level) -
      collectedFromLevel(levelFromXp(xp).level)
    assert.ok(gained <= 2, `a max round gained ${gained} slots from ${xp} XP`)
  }
})

test('collectedFromLevel: THE mapping (level 1 = empty book)', () => {
  assert.equal(collectedFromLevel(1), 0)
  assert.equal(collectedFromLevel(2), 1) // reaching level 2 awards slot 1
  assert.equal(collectedFromLevel(19), 18) // end of the fast tier
  assert.equal(collectedFromLevel(73), 72) // book full
  // The LEVEL curve keeps climbing past the end of the book — it is the debt CEILING, not the book.
  // `owedRewards` is what clamps, so the extra levels simply owe nothing (see progressStore.test.ts).
  assert.equal(collectedFromLevel(74), 73)
  assert.equal(collectedFromLevel(0), 0) // guarded
  assert.equal(collectedFromLevel(-5), 0)
})

test('rewardNumber: the child-facing number is grantedSlots, floored and non-negative', () => {
  assert.equal(rewardNumber(0), 0)
  assert.equal(rewardNumber(23), 23)
  assert.equal(rewardNumber(REWARD_SLOTS), REWARD_SLOTS)
  assert.equal(rewardNumber(-4), 0) // guarded
  assert.equal(rewardNumber(7.9), 7)
  // It is NOT the level. `collectedFromLevel(level)` runs one ahead during a pending ceremony, and
  // the store test pins the inequality across a seeded run; this pins the shape.
  assert.equal(rewardNumber.length, 1)
})

test('chapterOfSlot: 9-slot chapters, boundaries exact', () => {
  assert.equal(chapterOfSlot(0), 0)
  assert.equal(chapterOfSlot(8), 0)
  assert.equal(chapterOfSlot(9), 1)
  assert.equal(chapterOfSlot(17), 1)
  assert.equal(chapterOfSlot(18), 2)
  assert.equal(chapterOfSlot(26), 2)
  assert.equal(chapterOfSlot(27), 3)
  assert.equal(chapterOfSlot(35), 3)
  assert.equal(chapterOfSlot(36), 4)
  assert.equal(chapterOfSlot(44), 4)
  assert.equal(chapterOfSlot(45), 5) // chapter 6 — the book grows, this function does not cap
  assert.equal(chapterOfSlot(63), 7)
  assert.equal(chapterOfSlot(-1), 0) // guarded
})

test('companionStageForCollected: clamped at the BAKED stages, never the chapter count', () => {
  assert.equal(COMPANION_STAGES, 5) // 5 baked stages per world; the book has more chapters than this
  assert.equal(companionStageForCollected(0), 0)
  assert.equal(companionStageForCollected(8), 0)
  assert.equal(companionStageForCollected(9), 1) // chapter 1 complete → stage up
  assert.equal(companionStageForCollected(18), 2)
  assert.equal(companionStageForCollected(27), 3)
  assert.equal(companionStageForCollected(36), 4) // fully grown at chapter 5
  // THE regression this replaces: clamping on CHAPTER_COUNT - 1 (now 7) would index past the 5th
  // baked stage the moment chapter 6 shipped, i.e. an empty companion in the middle of a ceremony.
  assert.equal(companionStageForCollected(45), COMPANION_STAGES - 1)
  assert.equal(companionStageForCollected(72), COMPANION_STAGES - 1)
  assert.equal(companionStageForCollected(1000), COMPANION_STAGES - 1)
  assert.equal(companionStageForCollected(-3), 0)

  // Never past its art, and MONOTONE NON-DECREASING — the companion grows and stays grown; a
  // regression ("it shrank") is the one thing a growth display must never do.
  let prev = 0
  for (let n = 0; n <= 200; n++) {
    const s = companionStageForCollected(n)
    assert.ok(s <= COMPANION_STAGES - 1, `stage ${s} at ${n} collected is past the baked art`)
    assert.ok(s >= prev, `companion regressed from ${prev} to ${s} at ${n} collected`)
    prev = s
  }
})

test('bloomStage / bloomFill: UNCHANGED by the reward-book bump (D7 — the world is out of scope)', () => {
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
  assert.equal(bloomStage(10000), 4)
  assert.equal(bloomFill(0), 0)
  assert.equal(bloomFill(BLOOM_MAX_XP / 2), 0.5)
  assert.equal(bloomFill(BLOOM_MAX_XP), 1)
  assert.equal(bloomFill(BLOOM_MAX_XP * 3), 1)
  assert.equal(bloomFill(-50), 0)
})

test('the journey is ≈126 rounds — same curve, longer path (Reward Horizon §3.4)', () => {
  // A completed round with no bonuses is REWARD_XP; walk rounds until the book is full.
  let xp = 0
  let rounds = 0
  while (collectedFromLevel(levelFromXp(xp).level) < REWARD_SLOTS && rounds < 1000) {
    xp += REWARD_XP
    rounds++
  }
  assert.equal(collectedFromLevel(levelFromXp(xp).level), REWARD_SLOTS)
  assert.equal(rounds, 126) // 18 fast + 108 slow (54 slots × 2 rounds)
  assert.equal(xp, 5040)
  // And chapters 1-2 really are one-per-round.
  for (let r = 1; r <= FAST_SLOTS; r++) {
    assert.equal(collectedFromLevel(levelFromXp(r * REWARD_XP).level), r)
  }
})
