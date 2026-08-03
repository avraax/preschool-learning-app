// The child-facing reward surfaces, guarded as SOURCE (Reward Horizon PRD-01 §7.9/§7.10).
//
// These are structural rules a type-checker cannot express and a screenshot cannot prove absent — the
// failure mode in both cases is something QUIETLY COMING BACK: a denominator on the book's header, or
// a second door to Min Bog on the home screen. Both read as harmless additions in review; both undo
// the model the PRD is built on ("the number is never a distance"; "the ring is the only door").
//
// The files are read as TEXT because they are .tsx and pull in MUI/Vite — unimportable from
// `node --test`. Same technique as authOverlayZ.test.ts, including stripping comments first: a prose
// mention of the forbidden thing in the "why" comment above the fix satisfied a plain `includes()`
// there and kept the guard green after the fix itself had been removed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

test("Min Bog's header shows the NUMBER, never a distance", () => {
  const code = codeOf('components/hub/StickerAlbum.tsx')
  // The header pill. A denominator here ("{n} / 72", "{n} af 72") is the exact thing D1 removed: a
  // 5-year-old reads neither the fraction nor the ratio, and only the ring's fill signals nearness.
  // Capture between the BACKTICKS, not up to the first `}` — a template literal's own `${…}` closes
  // the naive `[^}]*` capture, so `{`${n} / ${REWARD_SLOTS}`}` matched as just "`${n" and the guard
  // was vacuously green against the exact denominator it exists to forbid. (Found by /re-break.)
  const pill = code.match(/<StatPill[^>]*label=\{`([^`]*)`\}/)
  assert.ok(pill, 'could not find the header StatPill — did it move? re-point this guard')
  const label = pill[1]
  assert.ok(!label.includes('/'), `the book header shows a distance: ${label}`)
  assert.ok(!/\baf\b/.test(label), `the book header shows a distance: ${label}`)
  assert.ok(!label.includes('REWARD_SLOTS'), `the book header shows the total: ${label}`)
  // And it is THE number, not a re-derivation.
  assert.ok(code.includes('rewardNumber()'), 'the header must read progressStore.rewardNumber()')
})

test('the ring is THE ONLY door to Min Bog on home', () => {
  const code = codeOf('components/home/HomePage.tsx')
  const doors = code.match(/'\/album'/g) ?? []
  assert.equal(doors.length, 1, `home has ${doors.length} routes to /album — the ring is the only door`)
  // …and that one is the ring's own onTap, not a card/pill/shelf that happens to navigate.
  assert.match(
    code,
    /<RewardRing[\s\S]*?onTap=\{\(\) => navigateWithTransition\('\/album'\)\}/,
    'the /album navigation on home is not the RewardRing tap',
  )
  // The deleted shelf, by its own fingerprints. Each of these coming back means the shelf came back.
  for (const gone of ['minBogShimmer', 'albumFill', 'ProgressionCompanion']) {
    assert.ok(!code.includes(gone), `the Min Bog shelf is back on home (${gone})`)
  }
})

// The ring opens Min Bog from EVERY surface that renders one — home, the five section menus, and
// (since 2026-08-03, owner) in-game too. The in-game ring was deliberately inert, so that a stray tap
// during play couldn't leave the game; the owner overruled it, and the reasoning didn't hold anyway —
// the shared back button is ~40px away in the same header and already leaves on a stray tap. Do not
// re-mute it. What must NOT come back is a SECOND door on one screen (the deleted Min Bog shelf) —
// that is what the per-surface "only one door" assertions above and below cover.
test('every surface that shows the ring opens the book from it', () => {
  for (const file of ['components/common/GameSelectionLayout.tsx', 'components/common/GameShell.tsx']) {
    const code = codeOf(file)
    assert.ok(code.includes('<RewardRing'), `${file} no longer renders the ring — re-point this guard`)
    assert.match(
      code,
      /<RewardRing[\s\S]*?onTap=\{\(\) => navigateWithTransition\('\/album'\)\}/,
      `${file}'s ring is not a door to Min Bog`,
    )
    // Exactly one route to the book per surface — the ring's own tap, never a second entrance.
    const doors = code.match(/'\/album'/g) ?? []
    assert.equal(doors.length, 1, `${file} has ${doors.length} routes to /album — the ring is the only door`)
  }
})

test('the adult pane shows the DISTANCE but never the level', () => {
  const code = codeOf('components/adult/panes/BarnPane.tsx')
  // The distance belongs here and only here — the parent is the literate party.
  assert.ok(code.includes('af ${REWARD_SLOTS}'), 'the adult pane lost its honest "n af 72"')
  assert.ok(code.includes('rewardNumber()'), 'the adult count must be rewards HANDED OVER')
  // But NOT the level. Level 1 is an empty book, so `globalLevel()` is always stickers + 1 and can
  // never agree with the number next to it or with the ring in the corner. It shipped for one review
  // cycle and the owner read it as a bug on sight ("the ring says 6, the pane says Niveau 7").
  assert.ok(!code.includes('globalLevel()'), 'the level is back in the adult pane — it is stickers + 1')
  assert.ok(!code.includes('Niveau'), 'the level is back in the adult pane — it is stickers + 1')
  // Diagnostics that a parent cannot read are out too (no scale to judge them against).
  assert.ok(!code.includes('globalXp'), 'raw XP is back in the adult pane')
  // `bloomFor()` itself stays — "Har spillet" uses it as a HAS-PLAYED test. What must not come back
  // is displaying the stage NUMBER (five values on an unlabelled 0-4 scale).
  assert.ok(!code.includes('Verden vokser'), 'the 0-4 bloom row is back in the adult pane')
  assert.ok(!/bloomFor\([^)]*\)\.stage/.test(code), 'a bloom STAGE number is back in the adult pane')
})

test('the game header holds the reward ring and NOTHING else', () => {
  const shell = codeOf('components/common/GameShell.tsx')
  // The per-question pip row (`ScoreChip`) and the `score` slot it hung in are deleted (owner,
  // 2026-08-02). It was a SECOND progress meter inches from the ring, with nothing on screen to say
  // one counts this round and the other counts the whole book — and 8 identical pips is past the
  // subitizing limit (4-5), the same argument that turned the ceremony's 9-dot strip into a 3x3 grid.
  assert.ok(!/\bscore\?: React\.ReactNode/.test(shell), 'GameShell grew a score slot again')
  assert.ok(!/\{score\}/.test(shell), 'GameShell renders a score node again')
  assert.ok(!existsSync(path.join(SRC, 'components/common/ScoreChip.tsx')), 'ScoreChip.tsx is back')
})

test('the ring renders no text but the badge and the +N flyer', () => {
  const code = codeOf('components/common/RewardRing.tsx')
  // The two intended text nodes. Anything else — a label, a "n af 72", a "til næste" — is a distance
  // or a word a pre-reader cannot read, in the one corner that must stay a picture plus a number.
  assert.ok(code.includes('{count}'), 'the count badge is gone')
  assert.ok(code.includes('+{f.amount}'), 'the +N flyer is gone')
  assert.ok(!code.includes('REWARD_SLOTS'), 'the ring shows the total, i.e. a distance')
  assert.ok(!/\bxpToNextLevel\b/.test(code), 'the ring shows "XP to next", i.e. a distance')
  // Deliberately plain: no soft-3D depth on a symbolic progress element.
  assert.ok(!code.includes('softShadow'), 'the badge has depth — it must be a flat disc')
  assert.ok(!code.includes('contactShadow'), 'the badge has depth — it must be a flat disc')
})
