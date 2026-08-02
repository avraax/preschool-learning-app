// The reward path as DATA (Reward Horizon PRD-01 §7.1/§7.2).
//
// These are the guards that make "add a chapter" a content change instead of an engineering one, and
// the guard that makes it SAFE: the path is append-only, forever. `firstAt` is keyed by reward id and
// `rebuildCollected` walks slots through the path, so inserting or reordering anywhere in the first 45
// silently re-assigns every existing child's book — with no error and no visible symptom until a
// parent notices their kid's Hund became a Bil.
//
// Runs in plain Node (`npm test`) — hence the explicit `.ts` extensions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REWARD_CHAPTERS,
  REWARD_PATH,
  REWARD_SLOTS,
  CHAPTER_COUNT,
  rewardAt,
  chapterAt,
  slotOfReward,
} from './stickers.ts'
import { CHAPTER_SIZE, chapterOfSlot } from './progression.ts'

// The first 45 slots, in exact order, as a LITERAL. Deliberately not derived from anything: a test
// that reads the ids out of the same array it is checking passes vacuously. This is the frozen prefix
// every book already in the wild was built against — it may never change. New chapters go AFTER it.
const FROZEN_FIRST_45 = [
  'dyr-hund', 'dyr-kat', 'dyr-ko', 'dyr-hest', 'dyr-gris', 'dyr-faar', 'dyr-kanin', 'dyr-raev', 'dyr-bjoern',
  'kt-bil', 'kt-bus', 'kt-tog', 'kt-fly', 'kt-baad', 'kt-cykel', 'kt-lastbil', 'kt-helikopter', 'kt-raket',
  'mad-aeble', 'mad-banan', 'mad-jordbaer', 'mad-gulerod', 'mad-broed', 'mad-ost', 'mad-is', 'mad-kage', 'mad-pizza',
  'natur-trae', 'natur-blomst', 'natur-sol', 'natur-maane', 'natur-stjerne', 'natur-regnbue', 'natur-sky', 'natur-svamp', 'natur-blad',
  'hav-fisk', 'hav-haj', 'hav-hval', 'hav-delfin', 'hav-sael', 'hav-krabbe', 'hav-blaeksprutte', 'hav-skildpadde', 'hav-musling',
]

test('APPEND-ONLY: the first 45 slots are frozen, in exact order', () => {
  assert.deepEqual(REWARD_PATH.slice(0, 45).map((r) => r.id), FROZEN_FIRST_45)
  // And they are still the FIRST 45 — an insertion at the front would be caught above, but a chapter
  // inserted in the middle that happened to preserve the prefix must not exist either.
  for (let i = 0; i < FROZEN_FIRST_45.length; i++) {
    assert.equal(slotOfReward(FROZEN_FIRST_45[i]), i, `${FROZEN_FIRST_45[i]} moved off slot ${i}`)
  }
})

test('derived totals — and the literals they must currently equal', () => {
  // The derivation alone is vacuous (both sides move together when a chapter is appended), so the
  // CURRENT totals are pinned as literals too. Updating these two lines is the deliberate act of
  // saying "yes, I meant to grow the book" (PRD §10 step 3).
  assert.equal(REWARD_SLOTS, 72)
  assert.equal(CHAPTER_COUNT, 8)

  assert.equal(REWARD_SLOTS, CHAPTER_COUNT * CHAPTER_SIZE)
  assert.equal(REWARD_PATH.length, REWARD_SLOTS)
  assert.equal(REWARD_CHAPTERS.length, CHAPTER_COUNT)
  for (const c of REWARD_CHAPTERS) {
    assert.equal(c.rewards.length, CHAPTER_SIZE, `chapter ${c.id} is not ${CHAPTER_SIZE} long`)
    assert.ok(c.title, `chapter ${c.id} missing title`)
  }
})

test('ids and labels are unique across ALL chapters', () => {
  const ids = REWARD_PATH.map((r) => r.id)
  assert.equal(new Set(ids).size, REWARD_SLOTS, 'duplicate reward id on the path')
  const chapterIds = REWARD_CHAPTERS.map((c) => c.id)
  assert.equal(new Set(chapterIds).size, CHAPTER_COUNT, 'duplicate chapter id')
  // Labels are SPOKEN and shown; a duplicate would mean two slots that look and sound identical.
  const labels = REWARD_PATH.map((r) => r.label)
  assert.equal(new Set(labels).size, REWARD_SLOTS, 'duplicate reward label on the path')
  for (const r of REWARD_PATH) assert.ok(r.label.length > 0, `${r.id} has no label`)
})

test('the slot map is the documented one and lookups agree with it', () => {
  // 1-9 Dyr · 10-18 Køretøjer · 19-27 Mad · 28-36 Natur · 37-45 Havet ·
  // 46-54 Hjemmet · 55-63 Leg og musik · 64-72 Fugle og småkryb.
  assert.deepEqual(
    REWARD_CHAPTERS.map((c) => c.id),
    ['dyr', 'koeretoejer', 'mad', 'natur', 'havet', 'hjemmet', 'leg', 'smaakryb'],
  )
  assert.equal(rewardAt(0)?.id, 'dyr-hund') // the very first prize
  assert.equal(rewardAt(36)?.id, 'hav-fisk')
  assert.equal(rewardAt(44)?.id, 'hav-musling') // the last of the frozen prefix
  assert.equal(rewardAt(45)?.id, 'hj-seng') // chapter 6 starts exactly where the old book ended
  assert.equal(rewardAt(54)?.id, 'leg-bold')
  assert.equal(rewardAt(63)?.id, 'sk-ugle')
  assert.equal(rewardAt(REWARD_SLOTS - 1)?.id, 'sk-mariehoene') // the last prize in the book

  for (let slot = 0; slot < REWARD_SLOTS; slot++) {
    const r = rewardAt(slot)!
    assert.equal(slotOfReward(r.id), slot, `${r.id} disagrees about its slot`)
    assert.equal(chapterAt(slot)?.id, REWARD_CHAPTERS[chapterOfSlot(slot)].id)
    assert.ok(chapterAt(slot)!.rewards.includes(r), `${r.id} is not in the chapter at its slot`)
  }
  assert.equal(slotOfReward('not-a-reward'), -1)
})

test('THE BOOK ENDS — the path does not wrap', () => {
  // The gold pass is deleted (§3.5). Past the last slot there is nothing, and that is the point: the
  // answer to a full book is a new chapter, not a recycled prize. `owedRewards` clamps so nothing ever
  // asks for a slot out here (pinned in progressStore.test.ts / progressSchema.test.ts).
  assert.equal(rewardAt(REWARD_SLOTS), null)
  assert.equal(rewardAt(REWARD_SLOTS + 1), null)
  assert.equal(rewardAt(-1), null)
})
