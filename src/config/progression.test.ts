// Unit tests for the progression curves (Reward Book PRD-01 §8 W1). Runs on the Node built-in test
// runner with type-stripping: `npm test` → `node --test src/config/progression.test.ts` (Node ≥22.18).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REWARD_XP,
  FAST_SLOTS,
  CHAPTER_SIZE,
  COMPANION_STAGES,
  BROWSE_TASK_XP,
  xpToNext,
  xpForSlots,
  levelFromXp,
  BLOOM_STAGE_XP,
  BLOOM_MAX_XP,
  bloomStage,
  bloomFill,
  taskXp,
  collectedFromLevel,
  chapterOfSlot,
  companionStageForCollected,
  rewardNumber,
} from './progression.ts'
import { REWARD_SLOTS } from './stickers.ts'

test('economy constants hang together', async () => {
  assert.equal(FAST_SLOTS, CHAPTER_SIZE * 1) // chapter 1 — and ONLY chapter 1 — is the fast tier
  assert.equal(REWARD_XP, 40)
  // REWARD_SLOTS / CHAPTER_COUNT are DERIVED and live in stickers.ts now — pinned in stickers.test.ts.
  // What must hold HERE is that progression.ts does not re-export them, or "add a chapter" grows a
  // second definition that can drift from the data.
  const mod = await import('./progression.ts')
  assert.equal('REWARD_SLOTS' in mod, false)
  assert.equal('CHAPTER_COUNT' in mod, false)
})

test('xpToNext: exactly two tiers — one round per slot, then THREE', () => {
  assert.equal(xpToNext(1), REWARD_XP) // first reward costs one round
  assert.equal(xpToNext(0), REWARD_XP) // guarded floor
  assert.equal(xpToNext(FAST_SLOTS), REWARD_XP) // level 9 still fast (awards slot 9, closing ch. 1)
  assert.equal(xpToNext(FAST_SLOTS + 1), REWARD_XP * 3) // level 10 → the slow tier, ~3 rounds
  assert.equal(xpToNext(45), REWARD_XP * 3)
  // Stays at three rounds per reward FOREVER. There is deliberately no third, slower tier: that is
  // exactly the grind the extra chapters exist to avoid (Reward Pacing PRD-01 D3 / §9).
  assert.equal(xpToNext(60), REWARD_XP * 3)
  assert.equal(xpToNext(200), REWARD_XP * 3)
  // TWO distinct values across the whole curve — a third tier would show up here as a third value.
  const tiers = new Set(Array.from({ length: 400 }, (_, i) => xpToNext(i + 1)))
  assert.deepEqual([...tiers].sort((a, b) => a - b), [40, 120])
  // Strictly non-decreasing across the interesting range.
  for (let l = 1; l < 60; l++) assert.ok(xpToNext(l + 1) >= xpToNext(l))
})

test('xpForSlots: the ONE definition of "XP to have been awarded n slots" (D9)', () => {
  // It walks the real curve, so it can never carry a stale hand-copied multiplier (it was copied
  // verbatim in four files, one of them the shipping ?rewards=n dev seed).
  assert.equal(xpForSlots(0), 0)
  assert.equal(xpForSlots(1), xpToNext(1))
  assert.equal(xpForSlots(FAST_SLOTS), FAST_SLOTS * REWARD_XP)
  assert.equal(xpForSlots(FAST_SLOTS + 1), FAST_SLOTS * REWARD_XP + xpToNext(FAST_SLOTS + 1))
  assert.equal(xpForSlots(-3), 0) // guarded
  assert.equal(xpForSlots(2.9), xpForSlots(2)) // floored

  // THE property that makes it usable as a seed: spending exactly xpForSlots(n) owes exactly n.
  for (let n = 0; n <= REWARD_SLOTS; n++) {
    assert.equal(
      collectedFromLevel(levelFromXp(xpForSlots(n)).level),
      n,
      `xpForSlots(${n}) does not land exactly on slot ${n}`,
    )
    if (n > 0) {
      assert.equal(
        collectedFromLevel(levelFromXp(xpForSlots(n) - 1).level),
        n - 1,
        `xpForSlots(${n}) overshoots — one XP less should still owe ${n - 1}`,
      )
    }
  }
})

test('levelFromXp: thresholds, remainder bookkeeping, monotonic across the tier change', () => {
  assert.equal(levelFromXp(0).level, 1)
  assert.equal(levelFromXp(39).level, 1)
  assert.equal(levelFromXp(40).level, 2) // first reward — still one round (level 1 costs REWARD_XP)
  assert.equal(levelFromXp(79).level, 2)
  assert.equal(levelFromXp(80).level, 3) // …and so is the second, inside chapter 1

  // 9 fast levels cost 9 × 40 = 360 XP and land on level 10 (chapter 1 full, 9 rewards collected).
  assert.equal(xpForSlots(FAST_SLOTS), 360)
  assert.equal(levelFromXp(360).level, 10)
  assert.equal(collectedFromLevel(levelFromXp(360).level), FAST_SLOTS)
  // From there each reward costs 120 (three rounds): level 11 at 480, not 400.
  assert.equal(levelFromXp(479).level, 10)
  assert.equal(levelFromXp(480).level, 11)

  // Filling the whole book = 9×40 + 81×120 = 360 + 9720 = 10080 XP → level 91, 90 collected.
  const full = xpForSlots(REWARD_SLOTS)
  assert.equal(full, 10080)
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

// THE CROSSING PIN, rewritten for endless play (Endless Play PRD-01 D3 / §W7). `roundXp` and
// `MAX_ROUND_XP` are DELETED, so the biggest single XP event is now ONE TASK — and that changes a
// load-bearing property: a task can no longer cross two slots at any XP, in either tier.
//
// Which is exactly why this pin has to stay. `RewardOverlay` trails EXTRA owed stickers in behind the
// headline, and with no play path that can reach a double it now looks like dead code. It is not: a
// cross-device CRDT merge can still owe two (the XP ledger is a G-Counter, two devices that each
// played offline sum). This test is what records "merge-only, not dead" so nobody deletes it.
test('no single task can cross two slots — the overlay trail is MERGE-ONLY, not dead', () => {
  // The smallest `tasksInRound` any shipped game passes is 5 (Farvejagt, whose task is a whole board);
  // everything else is 6-15. So the biggest real task is 9 XP against a 40 XP slot.
  const biggestRealTask = taskXp(5, true)
  assert.equal(biggestRealTask, 9)
  assert.ok(biggestRealTask < REWARD_XP)

  // Hold it for the whole plausible domain, not just the shipped values: at NO starting XP, in either
  // tier, can one task from a 2+-task round gain more than one slot. (`tasksInRound: 1` would be 41 XP
  // and CAN double inside the fast tier — which is why no game has a one-task round; the normaliser
  // means a game whose "round" is a single task is claiming a whole reward for it.)
  for (let n = 2; n <= 40; n++) {
    const amount = taskXp(n, true)
    for (let xp = 0; xp <= 2000; xp++) {
      const gained =
        collectedFromLevel(levelFromXp(xp + amount).level) - collectedFromLevel(levelFromXp(xp).level)
      assert.ok(gained <= 1, `a task worth ${amount} gained ${gained} slots from ${xp} XP`)
    }
  }
})

test('collectedFromLevel: THE mapping (level 1 = empty book)', () => {
  assert.equal(collectedFromLevel(1), 0)
  assert.equal(collectedFromLevel(2), 1) // reaching level 2 awards slot 1
  assert.equal(collectedFromLevel(10), 9) // end of the fast tier — chapter 1 full
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

// THE PACING PIN (Reward Pacing PRD-01 §8.2). These are LITERALS on purpose: they are the owner's
// actual complaint turned into numbers, and every one of them moves if `xpToNext`'s multiplier or
// `FAST_SLOTS` is touched. Deriving them from the curve would make this file agree with itself while
// the product regressed — the same vacuous shape CLAUDE.md warns about for the prebake enumerator.
test('the pacing: a sticker costs ~3 rounds and the book ~172 (Reward Pacing D1/D2)', () => {
  // Walk whole rounds until the book is full, at both ends of a round's real XP range.
  const roundsToFillAt = (perRound: number) => {
    let xp = 0
    let rounds = 0
    while (collectedFromLevel(levelFromXp(xp).level) < REWARD_SLOTS && rounds < 5000) {
      xp += perRound
      rounds++
    }
    assert.equal(collectedFromLevel(levelFromXp(xp).level), REWARD_SLOTS, 'never filled the book')
    return rounds
  }

  // The whole book, as XP. 9 × 40 + 81 × 120, across TEN chapters — the full path D8 specified, built.
  assert.equal(xpForSlots(REWARD_SLOTS), 10080)

  // TWO pins now, not three. The round-END bonus is DELETED (Endless Play D3), so the old
  // `roundsToFillAt(MAX_ROUND_XP) = 163` row has no referent — 62 XP is no longer reachable from a
  // notional round. The remaining range is the real one:
  //   • a flat-40 round (nothing first-try) → 252,
  //   • an ORDINARY round (8 tasks all first-try = 48) → 210.
  // **THE OWNER ACCEPTED THE ~20% SLOWER PACE THIS BUYS** (D3): the best case used to be 163 rounds
  // and is now 210. Do NOT re-tune `xpToNext` / `REWARD_XP` / `FAST_SLOTS` to compensate, and never
  // reintroduce a round bonus.
  assert.equal(roundsToFillAt(REWARD_XP), 252)
  assert.equal(roundsToFillAt(8 * taskXp(8, true)), 210)

  // A sticker costs ~3 ordinary rounds past chapter 1 — the headline promise. 120 / 46ish.
  assert.equal(xpToNext(FAST_SLOTS + 1) / REWARD_XP, 3)

  // The ring therefore moves about a THIRD per round instead of past-full. §1.1's table, as a range:
  // one flat round over one slow slot.
  const arcPerRound = REWARD_XP / xpToNext(FAST_SLOTS + 1)
  assert.ok(arcPerRound > 0.3 && arcPerRound < 0.4, `the ring moves ${arcPerRound} per round`)
  // …and one ANSWER moves it ~4-5%, not 12-15% (D5's reason for deleting the "+N" flyer: at this
  // rate the numeral is meaningless).
  const arcPerAnswer = taskXp(8, true) / xpToNext(FAST_SLOTS + 1)
  assert.ok(arcPerAnswer > 0.04 && arcPerAnswer < 0.051, `one answer moves ${arcPerAnswer}`)

  // And chapter 1 — ONLY chapter 1 — really is one-per-round.
  for (let r = 1; r <= FAST_SLOTS; r++) {
    assert.equal(collectedFromLevel(levelFromXp(r * REWARD_XP).level), r)
  }
  assert.equal(collectedFromLevel(levelFromXp((FAST_SLOTS + 1) * REWARD_XP).level), FAST_SLOTS)
  assert.equal(collectedFromLevel(levelFromXp((FAST_SLOTS + 2) * REWARD_XP).level), FAST_SLOTS)
  assert.equal(collectedFromLevel(levelFromXp((FAST_SLOTS + 3) * REWARD_XP).level), FAST_SLOTS + 1)
})
