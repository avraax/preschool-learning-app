// Unit tests for the progression curves (Reward Book PRD-01 §8 W1). Runs on the Node built-in test
// runner with type-stripping: `npm test` → `node --test src/config/progression.test.ts` (Node ≥22.18).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REWARD_XP,
  FAST_SLOTS,
  CHAPTER_SIZE,
  CHAPTER_COUNT,
  REWARD_SLOTS,
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
} from './progression.ts'
import { REWARD_CHAPTERS, REWARD_PATH, rewardAt, chapterAt, slotOfReward } from './stickers.ts'

test('economy constants hang together', () => {
  assert.equal(REWARD_SLOTS, CHAPTER_SIZE * CHAPTER_COUNT)
  assert.equal(REWARD_SLOTS, 45)
  assert.equal(FAST_SLOTS, CHAPTER_SIZE * 2) // chapters 1-2 are the fast tier
  assert.equal(REWARD_XP, 40)
})

test('xpToNext: exactly two tiers — one round per slot, then two', () => {
  assert.equal(xpToNext(1), REWARD_XP) // first reward costs one round
  assert.equal(xpToNext(0), REWARD_XP) // guarded floor
  assert.equal(xpToNext(FAST_SLOTS), REWARD_XP) // level 18 still fast (awards slot 18)
  assert.equal(xpToNext(FAST_SLOTS + 1), REWARD_XP * 2) // level 19 → the slow tier
  assert.equal(xpToNext(45), REWARD_XP * 2)
  assert.equal(xpToNext(60), REWARD_XP * 2) // stays there forever (gold pass)
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

  // Filling the whole book = 18×40 + 27×80 = 720 + 2160 = 2880 XP → level 46, 45 collected.
  const full = 18 * REWARD_XP + 27 * REWARD_XP * 2
  assert.equal(full, 2880)
  assert.equal(levelFromXp(full).level, 46)
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
  assert.equal(collectedFromLevel(46), 45) // book full
  assert.equal(collectedFromLevel(47), 46) // gold pass keeps counting
  assert.equal(collectedFromLevel(0), 0) // guarded
  assert.equal(collectedFromLevel(-5), 0)
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
  assert.equal(chapterOfSlot(-1), 0) // guarded
})

test('companionStageForCollected: 5 chapters ⇔ 5 stages, clamped at the top', () => {
  assert.equal(companionStageForCollected(0), 0)
  assert.equal(companionStageForCollected(8), 0)
  assert.equal(companionStageForCollected(9), 1) // chapter 1 complete → stage up
  assert.equal(companionStageForCollected(18), 2)
  assert.equal(companionStageForCollected(27), 3)
  assert.equal(companionStageForCollected(36), 4)
  assert.equal(companionStageForCollected(45), CHAPTER_COUNT - 1) // clamped, not 5
  assert.equal(companionStageForCollected(1000), CHAPTER_COUNT - 1)
  assert.equal(companionStageForCollected(-3), 0)
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

// ----- the reward path itself (data shape the whole economy assumes) --------------------------

test('REWARD_PATH: 45 rewards, 5 chapters of 9, unique ids, all labelled', () => {
  assert.equal(REWARD_CHAPTERS.length, CHAPTER_COUNT)
  assert.equal(REWARD_PATH.length, REWARD_SLOTS)
  for (const c of REWARD_CHAPTERS) {
    assert.equal(c.rewards.length, CHAPTER_SIZE, `chapter ${c.id} is not ${CHAPTER_SIZE} long`)
    assert.ok(c.title, `chapter ${c.id} missing title`)
  }
  const ids = new Set(REWARD_PATH.map((r) => r.id))
  assert.equal(ids.size, REWARD_SLOTS, 'duplicate reward id on the path')
  for (const r of REWARD_PATH) {
    assert.ok(r.label.length > 0, `${r.id} has no label`)
  }
  // The dropped sets are really gone (PRD §6.1).
  assert.ok(!REWARD_CHAPTERS.some((c) => c.id === 'smaakryb' || c.id === 'legetoej'))
})

test('the slot map is the documented one and lookups agree with it', () => {
  // 1-9 Dyr · 10-18 Køretøjer · 19-27 Mad · 28-36 Natur · 37-45 Havet.
  assert.deepEqual(
    REWARD_CHAPTERS.map((c) => c.id),
    ['dyr', 'koeretoejer', 'mad', 'natur', 'havet'],
  )
  assert.equal(rewardAt(0)?.id, 'dyr-hund') // the very first prize
  assert.equal(rewardAt(9)?.id, 'kt-bil')
  assert.equal(rewardAt(18)?.id, 'mad-aeble')
  assert.equal(rewardAt(27)?.id, 'natur-trae')
  assert.equal(rewardAt(36)?.id, 'hav-fisk')
  assert.equal(rewardAt(44)?.id, 'hav-musling') // the last
  assert.equal(rewardAt(45), null) // past the end → the store's gold pass wraps
  assert.equal(rewardAt(-1), null)

  for (let slot = 0; slot < REWARD_SLOTS; slot++) {
    const r = rewardAt(slot)!
    assert.equal(slotOfReward(r.id), slot, `${r.id} disagrees about its slot`)
    assert.equal(chapterAt(slot)?.id, REWARD_CHAPTERS[chapterOfSlot(slot)].id)
    assert.ok(chapterAt(slot)!.rewards.includes(r), `${r.id} is not in the chapter at its slot`)
  }
  assert.equal(slotOfReward('not-a-reward'), -1)
})

test('gold pass: past 45 the wrap is deterministic, never random', () => {
  // The store computes `(slot - REWARD_SLOTS) % REWARD_SLOTS`; pin the arithmetic here so a change
  // to REWARD_SLOTS can't silently break "slot 46 is a gold slot 1".
  const wrap = (slot: number) => (slot - REWARD_SLOTS) % REWARD_SLOTS
  assert.equal(wrap(45), 0) // 46th reward → gold Hund
  assert.equal(wrap(46), 1) // → gold Kat
  assert.equal(wrap(89), 44) // → gold Musling
  assert.equal(wrap(90), 0) // → gold Hund again, forever
  assert.equal(rewardAt(wrap(45))?.id, 'dyr-hund')
})

test('the journey is ≈72 rounds (the pacing promise in PRD §5)', () => {
  // A completed round with no bonuses is REWARD_XP; walk rounds until the book is full.
  let xp = 0
  let rounds = 0
  while (collectedFromLevel(levelFromXp(xp).level) < REWARD_SLOTS && rounds < 500) {
    xp += REWARD_XP
    rounds++
  }
  assert.equal(collectedFromLevel(levelFromXp(xp).level), REWARD_SLOTS)
  assert.equal(rounds, 72) // 18 fast + 54 slow
  // And chapters 1-2 really are one-per-round.
  for (let r = 1; r <= FAST_SLOTS; r++) {
    assert.equal(collectedFromLevel(levelFromXp(r * REWARD_XP).level), r)
  }
})
