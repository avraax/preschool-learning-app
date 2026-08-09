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
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

// ─── Endless play: the round is not a child-facing thing (Endless Play PRD-01) ────────────────────
//
// The guard that used to live here asserted `RoundResultScreen` had no second door to Min Bog. The
// screen is DELETED, so the guard becomes the stronger one: it must not come back. Same shape as the
// `ScoreChip` existence check above.

test('RoundResultScreen is deleted and stays deleted (D1)', () => {
  assert.ok(
    !existsSync(path.join(SRC, 'components/common/RoundResultScreen.tsx')),
    'RoundResultScreen.tsx is back — there is no round-end surface, in any form, including a "small card"',
  )
})

// The guard that stops a "small celebration screen" growing back by another name. Stars and "Ny
// rekord!" are the two things a round-end surface is made of, and both read as harmless additions.
//
// The two star GLYPHS are built with `fromCharCode` rather than written out: this file is itself swept
// by `noEmoji.test.ts`, so a literal ⭐ here would fail that guard from inside this one. (Same reason
// `promptBag.ts` builds its NUL separator that way.)
const BANNED_SCORE_MARKS = [
  'uiArt.star',
  'uiArt.trophy',
  'Ny rekord',
  String.fromCharCode(0x2605), // BLACK STAR
  String.fromCharCode(0x2b50), // WHITE MEDIUM STAR (the emoji)
]

test('no component renders stars or a record (D2)', () => {
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx')) {
        const code = codeOf(path.relative(SRC, full))
        for (const banned of BANNED_SCORE_MARKS) {
          if (code.includes(banned)) offenders.push(`${path.relative(SRC, full)}: ${banned}`)
        }
      }
    }
  }
  walk(path.join(SRC, 'components'))
  assert.deepEqual(offenders, [], `a star / record readout is back:\n${offenders.join('\n')}`)
})

// Cardinality, not presence. TWO primary triggers would mean one play path fires the ceremony twice
// (or, worse, that a game's seam quietly stopped being the one that does).
test('the ceremony has exactly one primary trigger, plus the watcher (§W7.3)', () => {
  const emitters: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        const rel = path.relative(SRC, full).replace(/\\/g, '/')
        // The bus's own definition is not a caller.
        if (rel === 'services/rewardBus.ts') continue
        if (codeOf(rel).includes('rewardBus.emit(')) emitters.push(rel)
      }
    }
  }
  walk(SRC)
  assert.deepEqual(
    emitters.sort(),
    ['components/common/RewardWatcher.tsx', 'hooks/useRewardCeremony.ts'],
    'the ceremony is fired from somewhere new — it has ONE in-play trigger (the hook) and ONE safety net',
  )
})

// §4.2. `grant.global.leveledUp` misses a crossing produced by a cross-tab write or a CRDT merge, and
// it is not the value `owedRewards()` and `RewardWatcher` agree on. Both triggers must read the cursor.
test('the ceremony trigger reads the STORE CURSOR, not leveledUp (§4.2)', () => {
  for (const rel of ['hooks/useRewardCeremony.ts', 'components/common/RewardWatcher.tsx']) {
    const code = codeOf(rel)
    assert.match(
      code,
      /progressStore\.globalLevel\(\)[\s\S]{0,200}lastCelebratedLevel/,
      `${rel} no longer keys the ceremony on globalLevel() > lastCelebratedLevel`,
    )
    assert.ok(!code.includes('leveledUp'), `${rel} triggers the ceremony off leveledUp — see §4.2`)
  }
})

// The single most important wiring guard in the change: EVERY game must route its continuation through
// the seam, EXACTLY ONCE. Two continuation sites means one path skips the ceremony; zero means the
// game deals its next question straight over the overlay.
const SEAM_GAMES = [
  'components/common/UnifiedQuizGame.tsx',
  'components/math/MathOperationGame.tsx',
  'components/math/ComparisonGame.tsx',
  'components/ordleg/SpellingGame.tsx',
  'components/ordleg/SpeakWordGame.tsx',
  'components/farver/FarvejagtGame.tsx',
  'components/farver/RamFarvenGame.tsx',
  'components/farver/NuancerGame.tsx',
  'components/farver/FarveQuizGame.tsx',
  'components/common/UnifiedMemoryGame.tsx',
]

test('every game continues through the ceremony seam, exactly once (§W7.5)', () => {
  for (const rel of SEAM_GAMES) {
    const code = codeOf(rel)
    const seams = code.match(/(?:run\.thenContinue|ceremony\.celebrateIfOwed)\(/g) ?? []
    // Memory has two: the mid-board crossing and the board turnover. Everything else has one.
    const expected = rel.endsWith('UnifiedMemoryGame.tsx') ? 2 : 1
    assert.equal(
      seams.length,
      expected,
      `${rel} has ${seams.length} continuation site(s), expected ${expected} — a second one skips the ceremony`,
    )
    // …and nothing from the round survives.
    assert.ok(!/\br\.done\b/.test(code), `${rel} still branches on r.done`)
    assert.ok(!code.includes('finishRound('), `${rel} still calls finishRound`)
    assert.ok(!code.includes('RoundResultScreen'), `${rel} still references RoundResultScreen`)
  }
})

// §4.3, and the single largest new risk in the change: the ceremony now opens ~1.1-2.0s after a
// correct tap, IN GAME, exactly where the finger is. Without the arm an excited tap-burst dismisses
// the sticker before it has finished appearing.
test('the ceremony tap is ARMED before it can dismiss (§4.3)', () => {
  const code = codeOf('components/common/RewardOverlay.tsx')
  assert.match(code, /TAP_ARM_MS\s*=\s*\d+/, 'the ceremony lost its arm delay — see §4.3')
  assert.match(
    code,
    /onClick=\{armed \? dismiss : undefined\}/,
    'the ceremony dismisses on an unarmed tap again',
  )
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

test('the game header holds NOTHING THAT MEASURES PERFORMANCE', () => {
  const shell = codeOf('components/common/GameShell.tsx')
  // This test was "the reward ring and NOTHING else" until 2026-08-09, when the owner added the static
  // `ProfileBadge` beside the ring (who is playing, on every screen). The rule was NARROWED rather than
  // dropped, deliberately and in the open: its real subject is a second PROGRESS METER, and a portrait
  // measures nothing. The narrower half is enforced in `profileBadge.test.ts` — the badge may not import
  // `useProgress`/`progressStore`/`xpBus`, may not be tappable, and must appear on every ring surface.
  // Don't widen this back to "nothing else" without deleting the badge, and don't drop it: what it
  // forbids below is the actual regression.
  //
  // The per-question pip row (`ScoreChip`) and the `score` slot it hung in are deleted (owner,
  // 2026-08-02). It was a SECOND progress meter inches from the ring, with nothing on screen to say
  // one counts this round and the other counts the whole book — and 8 identical pips is past the
  // subitizing limit (4-5), the same argument that turned the ceremony's 9-dot strip into a 3x3 grid.
  assert.ok(!/\bscore\?: React\.ReactNode/.test(shell), 'GameShell grew a score slot again')
  assert.ok(!/\{score\}/.test(shell), 'GameShell renders a score node again')
  assert.ok(!existsSync(path.join(SRC, 'components/common/ScoreChip.tsx')), 'ScoreChip.tsx is back')
})

test('the ring renders ONE text node: the count badge', () => {
  const code = codeOf('components/common/RewardRing.tsx')
  // The one intended text node. Anything else — a label, a "n af 72", a "til næste" — is a distance
  // or a word a pre-reader cannot read, in the one corner that must stay a picture plus a number.
  assert.ok(code.includes('{count}'), 'the count badge is gone')
  assert.ok(!code.includes('REWARD_SLOTS'), 'the ring shows the total, i.e. a distance')
  assert.ok(!/\bxpToNextLevel\b/.test(code), 'the ring shows "XP to next", i.e. a distance')
  // The "+N" flyer is DELETED (Reward Pacing D5): at ~4% of the arc per answer the numeral means
  // nothing to a pre-reader, and it was a SECOND number on a 46px control. This replaces the old
  // assertion that the flyer must EXIST — deleting that one without putting anything in its place
  // would have left the file silently unguarded on the thing D5 actually decided.
  assert.ok(!/\+\{[^}]*amount\}/.test(code), 'the +N flyer is back')
  assert.ok(!/\bflyers?\b/i.test(code), 'the +N flyer state is back')
  // Deliberately plain: no soft-3D depth on a symbolic progress element.
  assert.ok(!code.includes('softShadow'), 'the badge has depth — it must be a flat disc')
  assert.ok(!code.includes('contactShadow'), 'the badge has depth — it must be a flat disc')
})

// The ceremony's element list is a DECISION, not an accident (Reward Pacing D6), and every deleted
// element reads as a harmless addition if someone puts it back — "show them where it went on the
// page", "say Nyt klistermærke! so they can read along". That is exactly the shape this file exists
// to guard: the owner's screenshot was eight stacked elements, each individually defensible.
test('the ceremony is one picture — the dots and the banner stay deleted', () => {
  const overlay = codeOf('components/common/RewardOverlay.tsx')
  const reveal = codeOf('components/common/StickerReveal.tsx')

  // The 3x3 chapter dot grid. It answered "which of 9 is this?" — a 6-8-year-old competence — and
  // Min Bog answers it properly, with the pictures.
  assert.ok(!overlay.includes('CHAPTER_SIZE'), 'the chapter dot grid is back in the ceremony')
  assert.ok(!/gridTemplateColumns/.test(overlay), 'the ceremony grew a grid again')

  // The banner. Two texts around one picture IS the clutter, and the spoken line says these words.
  assert.ok(!reveal.includes('Nyt klistermærke!'), 'the reveal banner is back')

  // But the NUMBER is only MOVED, never removed: the grant happens at the start of the beats effect,
  // so without it the count would change while nobody is looking (Reward Horizon D6's failure mode).
  assert.ok(overlay.includes('data-reward-count'), 'the ceremony lost its count entirely')
  // `\sbadge=` — the leading whitespace matters. Without it the assertion matches ANY prop whose name
  // ends in "badge", which is how the re-break's own `data-not-a-badge={` swap kept this green.
  assert.match(overlay, /<StickerReveal[\s\S]{0,400}\sbadge=\{/, 'the count is no longer on the frame')

  // Chapter completion is a SECOND BEAT, not more rows in the same column.
  assert.match(overlay, /beat === 'sticker'/, 'the ceremony lost its sticker beat')
  assert.match(overlay, /beat === 'chapter'/, 'the chapter close is back in the sticker column')

  // The scrim must be near-solid. The old 0.86/0.92 stops left the menu readable through it — the
  // light skins especially, cream on cream.
  // Match the GRADIENTS themselves, both of them. Two narrower attempts were vacuous and /re-break
  // caught it: a bare rgba() sweep of the file picks up text-shadows (there is a 0.6 among them) and
  // fails on a passing file, while anchoring on `background: dark …100%)'` captured only the FIRST
  // gradient — the dark one — leaving the LIGHT scrim unguarded. The light scrim is the one the PRD
  // names as the actual failure (cream-on-cream, the menu readable straight through it).
  const grads = [...overlay.matchAll(/radial-gradient\([^']*\)/g)].map((m) => m[0])
  assert.equal(grads.length, 2, 'expected a light AND a dark scrim gradient — re-point this guard')
  const alphas = grads.flatMap((g) =>
    [...g.matchAll(/rgba\([\d\s,]+?([\d.]+)\)/g)].map((m) => Number(m[1])).filter((a) => a < 1),
  )
  assert.ok(alphas.length > 0, 'could not find the scrim stops — re-point this guard')
  for (const a of alphas) {
    assert.ok(a >= 0.99, `the ceremony scrim is see-through again (alpha ${a})`)
  }
})

test('the ring is a GAUGE and its geometry is derived, never tuned (Reward Pacing D4)', () => {
  const code = codeOf('components/common/RewardRing.tsx')
  // Every geometric quantity comes from the pure, unit-tested module. A literal reappearing here is
  // the regression: the badge occluded fill 29%..46% precisely because its position was a tuned
  // `-round(size * 0.06)` offset on a CLOSED ring, where no offset can be correct.
  for (const derived of [
    'ringStroke(size)',
    'ringRadius(size)',
    'sweepFrac(size, compact)',
    'gaugeRotationDeg(size, compact)',
    'badgeBottomOffset(size, compact)',
    'badgeSizeFor(size, compact)',
  ]) {
    assert.ok(code.includes(derived), `the ring stopped deriving its geometry: ${derived}`)
  }
  // A gap exists — i.e. the fill is scaled by the swept fraction, not the whole circumference.
  assert.match(code, /const arc = c \* sweepFrac\(/, 'the arc is no longer the swept fraction')
  assert.match(code, /const dash = arc \* \(1 - fill\)/, 'the fill offset is not measured off the arc')
  // …and the badge is at bottom CENTRE, not back in the corner it was occluding from.
  assert.ok(!/right: -/.test(code), 'the count badge is back in the bottom-right corner')
  assert.match(code, /left: '50%'[\s\S]{0,200}bottom: badgeBottomOffset/, 'the badge is not bottom-centre')
})

test('no call site RESIZES the ring with `sx` — `size` is its one dimension', () => {
  // The bug this exists for (owner report 323FF, iPhone 844x390): HomePage passed
  // `sx={{ [PHONE_LANDSCAPE]: { width: 36, height: 36 } }}` while `size` stayed 48/52. `sx` reaches
  // ONLY the outer Box; the svg, the centre art (`size * 0.52`) and every badge quantity are derived
  // from `size`. So the outer box became 36px, the inner motion.div was flex-SHRUNK to 36 wide but
  // stayed 52 tall, and the absolutely-positioned svg kept its own 52px width from the left edge —
  // putting the ring's circle centre at +26 and the silhouette's at +18. Measured: the sticker sat
  // 7.5px LEFT of the ring it is supposed to be centred in, ~21% of the ring's diameter.
  //
  // Nothing type-checks this and no unit test sees it: `sx` is a valid prop and both numbers are
  // individually sane. It also can't be caught downstream, because a size reached this way never
  // appears in SHIPPED_RING_SIZES. Branch on the viewport and pass `size`/`compact`, as GameShell does.
  const callers = ['components/home/HomePage.tsx', 'components/common/GameShell.tsx', 'components/common/GameSelectionLayout.tsx']
  for (const rel of callers) {
    const code = codeOf(rel)
    // The element, from `<RewardRing` to its self-closing `/>`. Comments are already stripped, so the
    // prose above the fix cannot satisfy this the way it did for authOverlayZ.
    for (const [, props] of code.matchAll(/<RewardRing\b([\s\S]*?)\/>/g)) {
      assert.ok(
        !/\bsx=/.test(props) || !/\b(width|height|minWidth|minHeight|maxWidth|maxHeight)\s*:/.test(props),
        `${rel} sizes RewardRing through sx — pass \`size\` (and \`compact\`) instead:\n<RewardRing${props}/>`,
      )
    }
  }
})

test('a phone-landscape ring passes `compact` with its smaller size, not one without the other', () => {
  // `compact` is not decoration: it lowers the badge's px floor to 16, and 20px on a ~35px ring is
  // 59% of the diameter — the tight fit that D4 fixed. A small `size` without `compact` reinstates it,
  // and a `compact` at full size opens the gauge's gap wider than the badge needs.
  for (const rel of ['components/home/HomePage.tsx', 'components/common/GameShell.tsx']) {
    const code = codeOf(rel)
    const el = code.match(/<RewardRing\b[\s\S]*?\/>/)
    assert.ok(el, `${rel} no longer renders a RewardRing — re-point this guard`)
    assert.match(el[0], /compact=\{phoneLandscape\}/, `${rel} does not pass compact on phone landscape`)
    assert.match(el[0], /size=\{phoneLandscape \?/, `${rel} does not branch size on phone landscape`)
  }
})
