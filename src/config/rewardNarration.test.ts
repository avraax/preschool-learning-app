// The Reward Book's spoken lines (Reward Horizon PRD-01 §7.7).
//
// Two independent guards, because either alone passes vacuously (CLAUDE.md's standing trap): the app
// and the prebake enumerator call the SAME builders, so "the two sides agree" stays green while every
// committed clip quietly becomes an orphan. So the exact strings are pinned as literals AND the
// enumeration is checked for coverage.
//
// Also guards a DELETION: `goldRewardLine` is gone with the gold pass, and its 45 baked mp3s with it.
// A lingering enumeration entry would keep re-baking a line nothing can ever speak.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rewardLine,
  collectedCountLine,
  COUNT_LINE_MAX,
  CHAPTER_DONE_LINE,
  BOOK_DONE_LINE,
} from './danish-phrases.ts'
import { REWARD_PATH } from './stickers.ts'
import { collectNarrationClips } from '../../shared-narration-clips.js'

const SPOKEN = new Set(collectNarrationClips().map((c) => c.text))

test('the reward lines are exactly these strings', () => {
  // One literal from the NEW chapters, one from the frozen prefix.
  assert.equal(rewardLine('Nøgle'), 'Nyt klistermærke! Nøgle')
  assert.equal(rewardLine('Hund'), 'Nyt klistermærke! Hund')
  assert.equal(CHAPTER_DONE_LINE, 'Sådan! Hele siden er samlet!')
  assert.equal(BOOK_DONE_LINE, 'Wow! Hele bogen er samlet!')
  // "ét", the counting form, not the article "en" — and it only applies at 1.
  assert.equal(collectedCountLine(1), 'Du har ét klistermærke!')
  assert.equal(collectedCountLine(23), 'Du har treogtyve klistermærker!')
  assert.equal(collectedCountLine(72), 'Du har tooghalvfjerds klistermærker!')
})

test('every reward on the path has BOTH its lines enumerated', () => {
  const missing: string[] = []
  for (const r of REWARD_PATH) {
    if (!SPOKEN.has(rewardLine(r.label))) missing.push(`rewardLine(${r.label})`)
    if (!SPOKEN.has(r.label)) missing.push(`label ${r.label}`) // spoken on a Min Bog slot tap
  }
  assert.deepEqual(missing, [], 'un-enumerated lines fall through to live, unauditioned Azure')
})

test('the spoken count is baked to COUNT_LINE_MAX, not to the current book size', () => {
  // Tying the loop to REWARD_SLOTS would silently drop the top of the range to live Azure the day a
  // new chapter shipped — which is exactly the class of bug the derived totals otherwise remove.
  assert.equal(COUNT_LINE_MAX, 100)
  const missing: number[] = []
  for (let n = 1; n <= COUNT_LINE_MAX; n++) {
    if (!SPOKEN.has(collectedCountLine(n))) missing.push(n)
  }
  assert.deepEqual(missing, [])
  assert.ok(SPOKEN.has(CHAPTER_DONE_LINE))
  assert.ok(SPOKEN.has(BOOK_DONE_LINE))
})

test('the gold line is GONE — from the module and from the baked set', async () => {
  const phrases = await import('./danish-phrases.ts')
  assert.equal('goldRewardLine' in phrases, false, 'the gold pass is deleted; so is its line')
  const shiny = [...SPOKEN].filter((t) => t.toLowerCase().includes('skinnende'))
  assert.deepEqual(shiny, [], 'a "Skinnende" clip is still enumerated and will be re-baked forever')
})
