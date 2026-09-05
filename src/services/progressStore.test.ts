// Unit tests for the reward economy inside progressStore (Reward Book PRD-01 §8 W1).
//
// Runs on the Node built-in test runner with type-stripping: `npm test` (Node ≥22.18). The store is
// importable outside a browser on purpose — its localStorage access is try/catch-guarded and its
// lifecycle hooks are `typeof window` gated — so these tests exercise the REAL singleton, not a mock
// of it. `resetAll('adult-confirmed')` between tests gives each case a clean book while preserving settings.
import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { progressStore } from './progressStore.ts'
import { REWARD_PATH, REWARD_CHAPTERS, REWARD_SLOTS } from '../config/stickers.ts'
import {
  REWARD_XP,
  FAST_SLOTS,
  CHAPTER_SIZE,
  collectedFromLevel,
  levelFromXp,
  xpForSlots,
} from '../config/progression.ts'

// Seed lifetime XP directly, the way the DEV ?rewards= harness does. `grantXp` feeds the same
// applyXp path normal play uses, so the level cursor moves exactly as it would after N rounds.
const seedRounds = (rounds: number) => {
  for (let i = 0; i < rounds; i++) progressStore.grantXp('alphabet', REWARD_XP)
}

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
  progressStore.resetAll('adult-confirmed')
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
  // A notional 8-task round with 2 wrong taps: 6 first-try (6 XP) + 2 not (5 XP) = 46. There is no
  // round END any more (Endless Play PRD-01 D3) — the per-task grants ARE the whole economy.
  let last = 0
  for (let q = 0; q < 8; q++) {
    last = progressStore.grantTaskXp('alphabet.quiz', { firstTry: q >= 2, tasksInRound: 8 })
      .global.xpAfter
  }
  assert.equal(last, 46)
  assert.ok(last >= REWARD_XP, 'a completed round must clear one reward')

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
  assert.equal(progressStore.grantPendingRewards().length, 1)
  assertInvariant()
})

test('a perfect round: still ONE slot, with the remainder carried into the next one', () => {
  let last = 0
  for (let q = 0; q < 8; q++) {
    last = progressStore.grantTaskXp('alphabet.quiz', { firstTry: true, tasksInRound: 8 })
      .global.xpAfter
  }
  // 8 × 6 = 48. The old +6 perfect / +8 new-best bonuses that made this 62 are DELETED (D3), and the
  // owner accepted the ~20% slower pace — do not reintroduce them.
  assert.equal(last, 48)

  const grants = progressStore.grantPendingRewards()
  // 48 XP from zero crosses ONE fast slot (40) with 8 left over — the carryover.
  assert.equal(grants.length, 1)
  assert.equal(grants[0].slot, 0)
  assert.ok(levelFromXp(48).xpIntoLevel > 0, 'carryover must survive into the next slot')
  assert.equal(levelFromXp(48).xpIntoLevel, 8)
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

  // Chapter 1 was the whole fast tier (Reward Pacing D2) — from here a slot costs THREE rounds.
  assert.equal(progressStore.collectedCount(), FAST_SLOTS)

  // Slots 10..18 now take 27 rounds, and only the last of them, slot 18, closes chapter 2.
  seedRounds(3 * CHAPTER_SIZE)
  grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, CHAPTER_SIZE)
  assert.equal(grants.filter((g) => g.chapterCompleted).length, 1)
  const closer = grants.find((g) => g.chapterCompleted)!
  assert.equal(closer.slot, 2 * CHAPTER_SIZE - 1)
  assert.equal(closer.chapter.id, 'koeretoejer')
  assert.equal(progressStore.collectedCount(), 2 * CHAPTER_SIZE)
  assert.equal(progressStore.companionStage(), 2)
  assertInvariant()
})

test('chapter 2 onward costs THREE rounds per reward (the slow tier), still one slot at a time', () => {
  seedRounds(FAST_SLOTS) // through slot 9 — chapter 1, the whole fast tier
  progressStore.grantPendingRewards()
  assert.equal(progressStore.collectedCount(), FAST_SLOTS)

  // ONE more round is not enough now. Nor are two — this is the pacing promise, at the store level.
  seedRounds(1)
  assert.deepEqual(progressStore.grantPendingRewards(), [])
  assert.equal(progressStore.collectedCount(), FAST_SLOTS)
  seedRounds(1)
  assert.deepEqual(progressStore.grantPendingRewards(), [])
  assert.equal(progressStore.collectedCount(), FAST_SLOTS)

  // The THIRD round lands slot 10 — the first of chapter 2 (Køretøjer).
  seedRounds(1)
  const grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 1)
  assert.equal(grants[0].slot, FAST_SLOTS)
  assert.equal(grants[0].reward.id, 'kt-bil')
  assert.equal(grants[0].chapter.id, 'koeretoejer')
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

  // The cost of the final slot, read off the curve rather than re-typed as a multiplier.
  progressStore.grantXp('alphabet', xpForSlots(REWARD_SLOTS) - xpForSlots(REWARD_SLOTS - 1))
  grants = progressStore.grantPendingRewards()
  assert.equal(grants.length, 1)
  assert.equal(grants[0].slot, REWARD_SLOTS - 1)
  assert.equal(grants[0].bookCompleted, true)
  assert.equal(grants[0].chapterCompleted, true) // the last slot also closes the last chapter
  assert.equal(progressStore.rewardNumber(), REWARD_SLOTS)
  // Book full → nothing left to preview. (The ring no longer reads this at all — its centre is the
  // child's own book at every point on the path, Corner identity PRD-01 §2.2 — but `nextReward()` is
  // still what Min Bog's single glowing `next` slot and `owedRewards()`'s clamp key off.)
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
  progressStore.resetAll('adult-confirmed')
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
  progressStore.resetAll('adult-confirmed') // preserves settings
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

  progressStore.resetAll('adult-confirmed')
  assert.equal(progressStore.collectedCount(), 0)
  assert.equal(progressStore.globalLevel(), 1)
  assert.equal(progressStore.get().totals.totalStickers, 0)
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

// THE GRANT-POINT CARDINALITY GUARD (Endless Play PRD-01 §W7). This replaces the old
// `recordRoundResult` test outright: the round-end path is gone, and what matters now is that nothing
// grew back to replace it. XP enters the store at exactly three named methods, and a REWARD at exactly
// one — the ceremony. A fourth XP door is how the pace silently changes; a second reward door is how a
// sticker gets handed over without a ceremony to show it.
test('the grant points are exactly these — no round-end economy grew back', async () => {
  const src = readFileSync(new URL('./progressStore.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const gone of ['recordRoundResult', 'roundXp', 'starThresholds', 'totalStars', 'perGame']) {
    assert.ok(!src.includes(gone), `progressStore still carries the round-end economy: ${gone}`)
  }
  // The three surviving XP doors, and nothing else calls applyXp.
  const applyCalls = (src.match(/this\.applyXp\(/g) ?? []).length
  assert.equal(applyCalls, 2, `applyXp has ${applyCalls} callers — expected grantXp + grantTaskXp`)
  const store = await import('./progressStore.ts')
  const api = store.progressStore as unknown as Record<string, unknown>
  for (const method of ['grantTaskXp', 'grantXp', 'grantPendingRewards']) {
    assert.equal(typeof api[method], 'function', `${method} is gone`)
  }
  assert.equal(api.recordRoundResult, undefined)
  assert.equal(api.getGame, undefined)
  // A reward is handed over in exactly ONE place.
  const grantSlotCalls = (src.match(/this\.grantSlot\(/g) ?? []).length
  assert.equal(grantSlotCalls, 1, 'a second reward grant point exists — the ceremony is the only one')
})
