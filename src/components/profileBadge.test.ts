// The Who-Is-Playing badge, guarded as SOURCE — the replacement for the rule it narrows.
//
// `rewardSurfaces.test.ts` used to say "the game header holds the reward ring and NOTHING else". That
// rule was written when the per-question `ScoreChip` pip row was deleted, and its real subject is a
// SECOND PROGRESS METER inches from the first. The profile badge is allowed into that corner (owner,
// 2026-08-09) because it measures nothing — but "nothing else" was doing real work, and dropping it in
// favour of good intentions would leave the corner unguarded. So the rule is narrowed to "nothing that
// measures performance", and THIS file is what makes the narrower version enforceable.
//
// Same technique and the same reasons as `rewardSurfaces.test.ts`: the files are .tsx (unimportable
// from `node --test`, they pull in MUI/Vite) so they are read as TEXT, with comments stripped FIRST —
// ProfileBadge's own header names every forbidden identifier while explaining why they are forbidden,
// which is precisely the prose that satisfied a plain `includes()` in authOverlayZ.test.ts and kept
// that guard green after the fix had been removed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BADGE = 'components/common/ProfileBadge.tsx'

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

// The surfaces that must carry the badge. Not "wherever it happens to be": the owner's decision was
// EVERY child-facing screen, including in-game, and a missing one is invisible — you only notice on
// the screen where you needed to know whose book was filling.
const SURFACES = [
  'components/home/HomePage.tsx',
  'components/common/GameSelectionLayout.tsx',
  'components/common/GameShell.tsx',
  'components/hub/StickerAlbum.tsx',
]

test('the badge is NOT a meter — it cannot read progress at all', () => {
  // The load-bearing assertion in this file. A profile badge that starts reading the store is exactly
  // the ScoreChip regression wearing a different hat: a second thing in the corner that changes as you
  // play, with nothing on screen to say what it counts. It has no legitimate reason to touch any of
  // these, so the guard is total rather than a judgement call at review time.
  const code = codeOf(BADGE)
  for (const forbidden of [
    'useProgress',
    'progressStore',
    'rewardNumber',
    'globalLevel',
    'xpBus',
    'xpProgress',
    'nextReward',
    'rewardArt',
  ]) {
    assert.ok(!code.includes(forbidden), `ProfileBadge reads progress (${forbidden}) — it is not a meter`)
  }
})

test('the badge is THE door to "Til de voksne", and the gear is gone', () => {
  // Owner reversed the original "pure indicator, never tappable" decision (2026-08-09): the avatar IS
  // the adult entry now and the floating gear is deleted. This replaces the guard that forbade a tap —
  // deleting that one without putting anything in its place would leave the door unguarded on the two
  // properties that actually matter.
  const code = codeOf(BADGE)
  // Anchored on the CLICK, not on the identifier: a bare `includes('adultSurfaceBus.open()')` was
  // satisfied by the keyboard handler alone, so deleting the tap — the only way a finger opens this —
  // kept the guard green. (Found by /re-break; it reported VACUOUS.)
  assert.match(
    code,
    /onClick=\{[^}]*adultSurfaceBus\.open\(\)[^}]*\}/,
    'a TAP no longer opens the adult surface',
  )
  assert.match(code, /onKeyDown=/, 'the badge lost its keyboard path — it is a div playing a button')
  // THE selector. Every ui-screenshot recipe and sweep.mjs clicks `[aria-label="Til de voksne"]`; it
  // moved here from the gear, and a reworded label breaks the whole verification harness silently.
  assert.match(code, /aria-label="Til de voksne"/, 'the badge lost the adult-surface selector')
  // The snapdom warm moved with the door — without it the capture lands on the dialog's enter
  // transition instead of ahead of it (see gateLayout.test.ts for the regression it belongs to).
  assert.match(code, /onPointerDown=\{warmScreenshot\}/, 'the snapdom chunk is no longer warmed on press')
  // The gear must stay deleted — two doors to the adult area is exactly what this change removed.
  assert.ok(
    !existsSync(path.join(SRC, 'components/adult/AdultCorner.tsx')),
    'AdultCorner.tsx is back — the adult surface has no trigger of its own; the badge is the door',
  )
})

test('the badge is NOT a second door to Min Bog', () => {
  // Separate from the test above on purpose. The badge is now interactive, so the risk inverted: two
  // adjacent same-size discs, and the one that must NOT lead to the book is the one you can tap.
  // `rewardSurfaces.test.ts` asserts exactly ONE route to /album per surface (the ring's own tap), so
  // a badge that navigated there would fail that guard from three files at once with a message
  // pointing at the wrong thing.
  const code = codeOf(BADGE)
  for (const forbidden of ["'/album'", 'useTransitionNav', 'navigateWithTransition']) {
    assert.ok(!code.includes(forbidden), `the badge routes to Min Bog (${forbidden}) — that is the ring's job`)
  }
})

test('the portrait renders unconditionally — no glyph fallback, ever', () => {
  // De-emoji PRD-01 D5, and the same rule ProfilePicker/BarnPane already follow: `normalizeAvatarId`
  // coerces an unknown id to the default and `avatars.test.ts` fails the build if any id lacks its
  // baked WebP, so a fallback here could only ever be dead code that re-opens the emoji question.
  const code = codeOf(BADGE)
  assert.match(code, /avatarArt\(/, 'the badge no longer renders baked avatar art — re-point this guard')
  const line = code.split('\n').find((l) => l.includes('avatarArt('))
  assert.ok(line)
  assert.ok(!/(\?\?|\|\|)/.test(line), `a fallback appeared beside avatarArt: ${line.trim()}`)
})

test('the badge is STATIC — no animation of its own', () => {
  // A continuously animating element in the same corner as a gauge that fills would compete with it,
  // and CLAUDE.md forbids framer `repeat: Infinity` loops outright. The home call site shares the
  // ring's ONE entrance animation instead; the component itself owns no motion.
  const code = codeOf(BADGE)
  for (const forbidden of ['framer-motion', 'idleMotion', 'idleFloat', 'keyframes', 'animation:']) {
    assert.ok(!code.includes(forbidden), `ProfileBadge grew its own motion (${forbidden})`)
  }
})

test('the badge shows a PICTURE and a letter, never the name as text', () => {
  // Owner, 2026-08-09: picture only. A name is text a pre-reader cannot read, it wraps or truncates at
  // phone-landscape, and it makes the chip's width depend on the name. The name survives only inside
  // the aria-label, which is why this asserts on the RENDERED node rather than on the identifier.
  const code = codeOf(BADGE)
  // `(?<!\$)` is not fussiness: the aria-label interpolates the name, so `${profile.name}` contains a
  // literal `{profile.name}` and a naive pattern fails on a CORRECT file. Only a JSX child counts.
  assert.ok(!/(?<!\$)\{\s*profile\.name\s*\}/.test(code), 'the child’s name is rendered as text on the badge')
  assert.match(code, /profileInitial\(/, 'the badge lost its first-letter cue')
  assert.match(code, /aria-label=/, 'the badge must still say who is playing to a screen reader')
})

test('the portrait sits on the world — NO plate behind it', () => {
  // Owner, 2026-08-09: "a very dim grey circle background". It shipped with the ProfilePicker's tile
  // backing (`alpha(primary.main, 0.08)` + a 20% hairline), which is right in a LIST on a paper
  // surface and wrong on the painted world — over the pale sky the purple desaturates to grey, while
  // the reward ring 12px away has no backing at all. The avatars are green-screened cutouts, so they
  // belong on the scene like the mascot and the section objects.
  //
  // Counted rather than name-matched: the ONE legitimate fill is the letter badge's white disc, and a
  // re-added plate is by definition a SECOND one. A `!includes('alpha(')` guard would instead go red
  // on the letter's own border and force whoever hits it to weaken the assertion.
  const code = codeOf(BADGE)
  const fills = code.match(/\b(?:bgcolor|background|backgroundColor)\s*:/g) ?? []
  assert.equal(
    fills.length, 1,
    `expected exactly one fill (the letter badge's white disc); found ${fills.length} — a plate is back behind the portrait`,
  )
  assert.match(code, /bgcolor:\s*'#FFFFFF'/, 'the one fill is no longer the letter badge — re-point this guard')
})

test('every surface carries exactly ONE badge', () => {
  for (const rel of SURFACES) {
    const code = codeOf(rel)
    const n = (code.match(/<ProfileBadge\b/g) ?? []).length
    assert.equal(n, 1, `${rel} renders ${n} profile badges — one per screen, on every screen`)
  }
})

test('anything that shows the reward ring shows the badge beside it', () => {
  // The forward-looking half: a NEW surface that renders a ring (a future menu, a browse hub) would
  // otherwise be the one screen that silently drops the indicator. Sweeping for the ring rather than
  // maintaining a second list is what makes that impossible to forget.
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx')) {
        const rel = path.relative(SRC, full).replace(/\\/g, '/')
        const code = codeOf(rel)
        if (/<RewardRing\b/.test(code) && !/<ProfileBadge\b/.test(code)) offenders.push(rel)
      }
    }
  }
  walk(path.join(SRC, 'components'))
  assert.deepEqual(offenders, [], 'a surface shows the ring but not who is playing')
})
