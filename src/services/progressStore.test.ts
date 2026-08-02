// Unit tests for the reward economy inside progressStore (Reward Book PRD-01 §8 W1).
//
// Runs on the Node built-in test runner with type-stripping: `npm test` (Node ≥22.18). The store is
// importable outside a browser on purpose — its localStorage access is try/catch-guarded and its
// lifecycle hooks are `typeof window` gated — so these tests exercise the REAL singleton, not a mock
// of it. `resetAll()` between tests gives each case a clean book while preserving settings.
import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { progressStore } from './progressStore.ts'
import { REWARD_PATH, REWARD_CHAPTERS, REWARD_SLOTS } from '../config/stickers.ts'
import {
  REWARD_XP,
  FAST_SLOTS,
  CHAPTER_SIZE,
  collectedFromLevel,
  levelFromXp,
} from '../config/progression.ts'

// Seed lifetime XP directly, the way the DEV ?rewards= harness does. `grantXp` feeds the same
// applyXp path normal play uses, so the level cursor moves exactly as it would after N rounds.
const seedRounds = (rounds: number) => {
  for (let i = 0; i < rounds; i++) progressStore.grantXp('alphabet', REWARD_XP)
}
// XP needed to have `n` rewards owed (n rounds in the fast tier, then 2 rounds each).
const xpForSlots = (n: number) =>
  Math.min(n, FAST_SLOTS) * REWARD_XP + Math.max(0, n - FAST_SLOTS) * REWARD_XP * 2

// The core invariants, checked after every case — the surfaces can never disagree.
//
//  • The number the child sees IS grantedSlots (Reward Horizon §3.1 / D6), and with the gold pass gone
//    there are no duplicates, so it also equals the count of distinct pictures in the book.
//  • It is ≤ the level's debt CEILING, never equal to it by definition: the gap IS a pending ceremony.
//    Pointing `rewardNumber()` at `globalLevel()` (the off-by-one this PRD is most at risk of
//    reintroducing) breaks the first assertion, not this one.
const assertInvariant = () => {
  assert.equal(
    progressStore.rewardNumber(),
    progressStore.grantedSlots(),
    'rewardNumber() is not grantedSlots — it must never be derived from the level',
  )
  assert.equal(
    progressStore.rewardNumber(),
    progressStore.collectedCount(),
    'rewardNumber() drifted from the distinct pictures in the book (a duplicate exists?)',
  )
  assert.ok(
    progressStore.rewardNumber() <= collectedFromLevel(progressStore.globalLevel()),
    'the book holds more rewards than the level ever owed',
  )
  assert.equal(
    progressStore.collectedCount(),
    Math.min(REWARD_SLOTS, collectedFromLevel(progressStore.globalLevel())),
    'collectedCount() drifted from collectedFromLevel(globalLevel())',
  )
}

// The store is INERT until a profile is attached (accounts PRD §5.4) — attaching is what a real
// session does through profileStore. Without this every mutator below would correctly no-op.
before(() => {
  progressStore.attach('test-child')
})

beforeEach(() => {
  progressStore.resetAll()
})

test('a fresh book: nothing collected, the first prize is previewed', () => {
  assert.equal(progressStore.collectedCount(), 0)
  assert.equal(progressStore.globalLevel(), 1) // level 1 == empty book
  assert.equal(progressStore.companionStage(), 0)
  const next = progressStore.nextReward()
  assert.equal(next?.slot, 0)
  assert.equal(next?.reward.id, 'dyr-hund')
  assert.equal(next?.chapter.id, 'dyr')
  // Nothing is owed yet, so a ceremony would grant nothing.
  assert.deepEqual(progressStore.grantPendingRewards(), [])
  assertInvariant()
})

test('one completed round grants exactly ONE slot, and it is REWARD_PATH[0] (deterministic)', () => {
  // A full 8-question round with 2 wrong taps: 6 first-try (6 XP) + 2 not (5 XP) = 46, no bonuses.
  for (let q = 0; q < 8; q++) {
    progressStore.grantTaskXp('alphabet.quiz', { firstTry: q >= 2, tasksInRound: 8 })
  }
  const outcome = progressStore.recordRoundResult('alphabet.quiz', {
    correct: 6,
    total: 8,
    longestStreak: 6,
  })
  assert.equal(outcome.mistakes, 2)
  assert.ok(outcome.xp.global.xpAfter >= REWARD_XP, 'a completed round must clear one reward')

  const grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 1)
  assert.equal(grants[0].reward.id, REWARD_PATH[0].id)
  assert.equal(grants[0].slot, 0)
  assert.equal(grants[0].isNew, true)
  assert.equal(grants[0].chapterCompleted, false)
  assert.equal(grants[0].chapterIndex, 0)
  assert.equal(grants[0].slotInChapter, 0)
  assert.equal(progressStore.collectedCount(), 1)
  // The ring now previews slot 2.
  assert.equal(progressStore.nextReward()?.reward.id, REWARD_PATH[1].id)
  // A second ceremony grants nothing more (idempotent — nothing owed).
  assert.deepEqual(progressStore.grantPendingRewards(), [])
  assertInvariant()
})

test('a reward lands even on a mistake-heavy round (rewards are never a fail state)', () => {
  // Worst case: every answer needed retries, so no first-try bonus anywhere and no round bonuses.
  for (let q = 0; q < 8; q++) {
    progressStore.grantTaskXp('math.counting', { firstTry: false, tasksInRound: 8 })
  }
  progressStore.recordRoundResult('math.counting', { correct: 0, total: 8, longestStreak: 0 })
  assert.equal(progressStore.grantPendingRewards().length, 1)
  assertInvariant()
})

test('a perfect round: still ONE slot, with the bonuses carried into the next one', () => {
  for (let q = 0; q < 8; q++) {
    progressStore.grantTaskXp('alphabet.quiz', { firstTry: true, tasksInRound: 8 })
  }
  const outcome = progressStore.recordRoundResult('alphabet.quiz', {
    correct: 8,
    total: 8,
    longestStreak: 8,
  })
  assert.equal(outcome.stars, 3)
  assert.equal(outcome.anyNewBest, true)
  // 8×6 = 48, + perfect 6 + new best 8 = 62.
  assert.equal(outcome.xp.global.xpAfter, 62)

  const grants = progressStore.grantPendingRewards()
  // 62 XP from zero crosses ONE fast slot (40) with 22 left over — the carryover.
  assert.equal(grants.length, 1)
  assert.equal(grants[0].slot, 0)
  assert.ok(levelFromXp(62).xpIntoLevel > 0, 'carryover must survive into the next slot')
  assert.equal(levelFromXp(62).xpIntoLevel, 22)
  assertInvariant()
})

test('owed-two: a single commit hands over BOTH slots, in path order', () => {
  // Land 1 XP short of slot 1, then a max round (62) crosses slot 1 AND slot 2.
  progressStore.grantXp('alphabet', REWARD_XP - 1)
  assert.equal(progressStore.grantPendingRewards().length, 0)
  progressStore.grantXp('alphabet', 62)

  const grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 2)
  assert.deepEqual(
    grants.map((g) => g.slot),
    [0, 1],
  )
  assert.deepEqual(
    grants.map((g) => g.reward.id),
    [REWARD_PATH[0].id, REWARD_PATH[1].id],
  )
  assert.equal(progressStore.collectedCount(), 2)
  assertInvariant()
})

test('chapter completion fires on slot 9 and 18 — and only there', () => {
  // Fill slots 1..8; no chapter completion yet.
  seedRounds(8)
  let grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 8)
  assert.ok(!grants.some((g) => g.chapterCompleted), 'chapter completed early')
  assert.equal(progressStore.companionStage(), 0)

  // Slot 9 closes chapter 1 (Dyr) and steps the companion to stage 1.
  seedRounds(1)
  grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 1)
  assert.equal(grants[0].slot, CHAPTER_SIZE - 1)
  assert.equal(grants[0].chapterCompleted, true)
  assert.equal(grants[0].chapter.id, 'dyr')
  assert.equal(grants[0].slotInChapter, CHAPTER_SIZE - 1)
  assert.equal(grants[0].bookCompleted, false)
  assert.equal(progressStore.companionStage(), 1)
  // The book's next preview crosses into chapter 2.
  assert.equal(progressStore.nextReward()?.chapter.id, 'koeretoejer')

  // Slots 10..18 (9 more rounds): only the last of them, slot 18, closes chapter 2.
  seedRounds(CHAPTER_SIZE)
  grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, CHAPTER_SIZE)
  assert.equal(grants.filter((g) => g.chapterCompleted).length, 1)
  const closer = grants.find((g) => g.chapterCompleted)!
  assert.equal(closer.slot, 2 * CHAPTER_SIZE - 1)
  assert.equal(closer.chapter.id, 'koeretoejer')
  assert.equal(progressStore.collectedCount(), FAST_SLOTS)
  assert.equal(progressStore.companionStage(), 2)
  assertInvariant()
})

test('chapters 3-5 cost two rounds per reward (the slow tier), still one slot at a time', () => {
  seedRounds(FAST_SLOTS) // through slot 18
  progressStore.grantPendingRewards()
  assert.equal(progressStore.collectedCount(), FAST_SLOTS)

  // ONE more round is not enough now.
  seedRounds(1)
  assert.deepEqual(progressStore.grantPendingRewards(), [])
  assert.equal(progressStore.collectedCount(), FAST_SLOTS)

  // The second round lands slot 19 — the first of chapter 3 (Mad).
  seedRounds(1)
  const grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 1)
  assert.equal(grants[0].slot, FAST_SLOTS)
  assert.equal(grants[0].reward.id, 'mad-aeble')
  assert.equal(grants[0].chapter.id, 'mad')
  assertInvariant()
})

test('book completion fires exactly once, on the LAST slot of the last chapter', () => {
  progressStore.grantXp('alphabet', xpForSlots(REWARD_SLOTS - 1))
  let grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, REWARD_SLOTS - 1)
  assert.ok(!grants.some((g) => g.bookCompleted))
  assert.equal(progressStore.rewardNumber(), REWARD_SLOTS - 1)
  assert.equal(progressStore.companionStage(), 4) // fully grown long before the end now
  assert.equal(progressStore.nextReward()?.reward.id, REWARD_PATH[REWARD_SLOTS - 1].id)

  progressStore.grantXp('alphabet', REWARD_XP * 2)
  grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 1)
  assert.equal(grants[0].slot, REWARD_SLOTS - 1)
  assert.equal(grants[0].bookCompleted, true)
  assert.equal(grants[0].chapterCompleted, true) // the last slot also closes the last chapter
  assert.equal(progressStore.rewardNumber(), REWARD_SLOTS)
  // Book full → no silhouette to preview (the ring shows its full-book sparkle instead).
  assert.equal(progressStore.nextReward(), null)
  assertInvariant()
})

test('THE NUMBER is grantedSlots, and the gap to the level ceiling IS the pending ceremony', () => {
  // Walk a realistic run and check the relationship at EVERY point, not just after a ceremony.
  for (let round = 1; round <= 40; round++) {
    for (let q = 0; q < 8; q++) {
      progressStore.grantTaskXp('alphabet.quiz', { firstTry: true, tasksInRound: 8 })
      // MID-ROUND, mid-crossing: the number must not move. The ring flashes the won prize here; the
      // sticker is handed over in the ceremony, and that is where the number ticks (§3.1).
      assert.equal(progressStore.rewardNumber(), progressStore.grantedSlots())
      assert.ok(progressStore.rewardNumber() <= collectedFromLevel(progressStore.globalLevel()))
    }
    const owedBefore = collectedFromLevel(progressStore.globalLevel()) - progressStore.rewardNumber()
    const before = progressStore.rewardNumber()
    const granted = progressStore.grantPendingRewards()
    // The ceremony closes exactly the gap that was open.
    assert.equal(granted.length, owedBefore, `round ${round}: ceremony did not clear the debt`)
    assert.equal(progressStore.rewardNumber(), before + granted.length)
    assertInvariant()
  }
  // A pointer at globalLevel() would have read one HIGH here for the whole of every pending window.
  assert.ok(progressStore.rewardNumber() > 0)
  assert.notEqual(progressStore.rewardNumber(), progressStore.globalLevel())
})

test('THE BOOK ENDS: past the last slot nothing is granted, ever again', () => {
  // This is the whole of "the gold pass is deleted" (Reward Horizon §3.5), stated as behaviour. The
  // old build wrapped `(slot - 45) % 45` and handed back shiny duplicates forever.
  progressStore.grantXp('alphabet', xpForSlots(REWARD_SLOTS)) // fill the book
  assert.equal(progressStore.grantPendingRewards().length, REWARD_SLOTS)
  assert.equal(progressStore.rewardNumber(), REWARD_SLOTS)

  // The XP ledger is a G-Counter and keeps climbing forever. Play a LOT more: nothing is owed, nothing
  // is handed over, the number rests, and no duplicate appears anywhere.
  for (let i = 0; i < 10; i++) {
    progressStore.grantXp('alphabet', REWARD_XP * 4)
    assert.deepEqual(progressStore.grantPendingRewards(), [], `ceremony ${i + 1} handed something over`)
    assert.equal(progressStore.rewardNumber(), REWARD_SLOTS)
    assert.equal(progressStore.nextReward(), null)
    assertInvariant() // includes rewardNumber() === collectedCount(), i.e. no duplicates
  }
  // Every id exactly once — `rewardAt()` was never called past the end.
  const collected = progressStore.get().stickers.collected
  assert.equal(Object.keys(collected).length, REWARD_SLOTS)
  for (const r of REWARD_PATH) assert.equal(collected[r.id].count, 1, `${r.id} is a duplicate`)
})

test('every reward on the path is reachable, in order, exactly once — ever', () => {
  progressStore.grantXp('alphabet', xpForSlots(REWARD_SLOTS))
  const grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, REWARD_SLOTS)
  assert.deepEqual(
    grants.map((g) => g.reward.id),
    REWARD_PATH.map((r) => r.id),
  )
  assert.ok(grants.every((g) => g.isNew), 'a reward can only be handed over once now')
  // Exactly one chapter completion per chapter, in chapter order.
  const closers = grants.filter((g) => g.chapterCompleted)
  assert.equal(closers.length, REWARD_CHAPTERS.length)
  assert.deepEqual(
    closers.map((g) => g.chapter.id),
    REWARD_CHAPTERS.map((c) => c.id),
  )
  assert.equal(grants.filter((g) => g.bookCompleted).length, 1)
  assertInvariant()
})

test('new rewards are flagged "nyt" until the book is opened', () => {
  seedRounds(2)
  const grants = progressStore.grantPendingRewards()
  assert.deepEqual(
    progressStore.get().stickers.newIds,
    grants.map((g) => g.reward.id),
  )
  progressStore.markStickersSeen()
  assert.deepEqual(progressStore.get().stickers.newIds, [])
})

test('markBrowsed: a browse item pays out ONCE EVER, per section', () => {
  assert.equal(progressStore.markBrowsed('alphabet', 'A'), true)
  assert.equal(progressStore.markBrowsed('alphabet', 'A'), false) // same visit
  assert.equal(progressStore.markBrowsed('alphabet', 'A'), false) // and after a re-entry
  assert.equal(progressStore.markBrowsed('alphabet', 'B'), true)
  // Sections are independent namespaces (letter "A" vs. number "1" can share a key safely).
  assert.equal(progressStore.markBrowsed('math', 'A'), true)
  assert.deepEqual(progressStore.get().progression.explored.alphabet, ['A', 'B'])
  assert.deepEqual(progressStore.get().progression.explored.math, ['A'])
  // resetAll clears it, so a reset child re-earns the browse XP.
  progressStore.resetAll()
  assert.equal(progressStore.markBrowsed('alphabet', 'A'), true)
})

test('browse XP is flat and section-attributed, never the round-normalised amount', () => {
  const grant = progressStore.grantTaskXp('browse', { firstTry: false, section: 'colors' })
  assert.equal(grant.granted, 2) // BROWSE_TASK_XP
  assert.equal(grant.section, 'colors')
  // 29 letters of a browse screen ≈ 58 XP → more than one reward, as the PRD table says.
  assert.equal(29 * 2, 58)
})

test('grantTaskXp: tasksInRound defaults to 8 and never depends on difficulty', () => {
  progressStore.setDifficulty({ global: 'svaer' })
  const hard = progressStore.grantTaskXp('alphabet.quiz', { firstTry: true }).granted
  progressStore.resetAll() // preserves settings
  progressStore.setDifficulty({ global: 'let' })
  const easy = progressStore.grantTaskXp('alphabet.quiz', { firstTry: true }).granted
  assert.equal(hard, easy)
  assert.equal(hard, 6) // ceil(40/8) + 1
  progressStore.setDifficulty({ global: 'normal' })
})

test('XP feeds the section bloom as well as the global level (one play, both layers)', () => {
  const grant = progressStore.grantTaskXp('colors.quiz', { firstTry: true, tasksInRound: 8 })
  assert.equal(grant.section, 'colors')
  assert.equal(progressStore.bloomFor('colors').xp, grant.granted)
  assert.equal(progressStore.bloomFor('alphabet').xp, 0) // untouched
  // Memory boards fold into their content section.
  progressStore.grantTaskXp('memory.numbers.10', { firstTry: false, tasksInRound: 10 })
  assert.equal(progressStore.bloomFor('math').xp, 4)
})

test('markLevelCelebrated: forward-only and idempotent (the ceremony fires once)', () => {
  assert.equal(progressStore.get().progression.lastCelebratedLevel, 1) // never celebrate level 1
  seedRounds(1)
  assert.equal(progressStore.globalLevel(), 2)
  assert.ok(progressStore.globalLevel() > progressStore.get().progression.lastCelebratedLevel)
  progressStore.markLevelCelebrated(2)
  assert.equal(progressStore.get().progression.lastCelebratedLevel, 2)
  progressStore.markLevelCelebrated(2) // idempotent
  progressStore.markLevelCelebrated(1) // never moves backward
  assert.equal(progressStore.get().progression.lastCelebratedLevel, 2)
  assert.ok(!(progressStore.globalLevel() > progressStore.get().progression.lastCelebratedLevel))
})

test('resetAll: clears the book and the level, preserves settings (PRD D8)', () => {
  progressStore.setSetting('sfxEnabled', false)
  progressStore.setDifficulty({ global: 'svaer', section: 'math', level: 'let' })
  seedRounds(3)
  progressStore.grantPendingRewards()
  assert.ok(progressStore.collectedCount() > 0)

  progressStore.resetAll()
  assert.equal(progressStore.collectedCount(), 0)
  assert.equal(progressStore.globalLevel(), 1)
  assert.equal(progressStore.get().totals.totalStars, 0)
  assert.equal(progressStore.get().progression.lastCelebratedLevel, 1)
  assert.equal(progressStore.nextReward()?.reward.id, 'dyr-hund')
  // Device preferences survive.
  assert.equal(progressStore.get().settings.sfxEnabled, false)
  assert.equal(progressStore.difficultyFor('math'), 'let')
  assert.equal(progressStore.difficultyFor('alphabet'), 'svaer')
  // Put the harness back to defaults for any later test.
  progressStore.setSetting('sfxEnabled', true)
  progressStore.setDifficulty({ global: 'normal', section: 'math', level: null })
})

test('recordRoundResult: bests, stars and the round-END bonus only — it grants NO reward', () => {
  const first = progressStore.recordRoundResult('ordleg.read', {
    correct: 8,
    total: 8,
    longestStreak: 8,
  })
  assert.equal(first.stars, 3)
  assert.deepEqual(first.newBests, { streak: true, stars: true, count: true })
  assert.equal(first.xp.granted, 14) // perfect 6 + new best 8
  // Beating nothing the second time: same stars, no new best.
  const second = progressStore.recordRoundResult('ordleg.read', {
    correct: 8,
    total: 8,
    longestStreak: 8,
  })
  assert.equal(second.anyNewBest, false)
  assert.equal(second.xp.granted, 6)
  assert.equal(progressStore.getGame('ordleg.read').roundsCompleted, 2)
  assert.equal(progressStore.get().totals.totalStars, 6)
  // Two rounds' worth of BONUS XP alone (20) is not a reward.
  assert.equal(progressStore.collectedCount(), 0)
  assertInvariant()
})
