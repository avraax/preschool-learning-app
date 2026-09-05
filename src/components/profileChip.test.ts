// The corner, guarded as SOURCE — Corner identity PRD-01 §6.2.
//
// This file was `profileBadge.test.ts`, which guarded a 46px avatar disc that sat 8-12px from the
// reward ring and was ALSO the door to the adult surface. That corner did three unrelated jobs with two
// identical discs; the badge's own header called the collision "the accepted cost". It is no longer
// accepted, so the badge is deleted, identity is a pill in the title row, and the adult door is a
// labelled row inside "Hvem spiller?".
//
// Every assertion below is re-pointed rather than dropped. Two of them are REVERSED, deliberately and
// in the open, so nobody re-derives the old design from its own justification:
//   • "a PICTURE and a letter, NEVER the name as text" → the name IS text now. That guard existed
//     because a 46px disc had no room for a word and a name would have made its width depend on the
//     name. A pill has room and is allowed to.
//   • "the badge is THE door to Indstillinger" → the CHIP is not a door to anything but the sheet.
//     The selector moved with the door, and this file follows it there.
//
// Same technique and the same reasons as `rewardSurfaces.test.ts`: the files are .tsx (unimportable
// from `node --test` — they pull in MUI/Vite) so they are read as TEXT, with comments stripped FIRST.
// These files' own headers name every forbidden identifier while explaining why it is forbidden, which
// is precisely the prose that satisfied a plain `includes()` in authOverlayZ.test.ts and kept that
// guard green after the fix had been removed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHIP = 'components/common/ProfileChip.tsx'
const SHEET = 'components/auth/WhoIsPlayingSheet.tsx'
const RING = 'components/common/RewardRing.tsx'
const SHELL = 'components/common/GameShell.tsx'

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Every .tsx under src/components, as repo-relative paths. */
const allComponents = (): string[] => {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx')) out.push(path.relative(SRC, full).replace(/\\/g, '/'))
    }
  }
  walk(path.join(SRC, 'components'))
  return out
}

// The surfaces that carry identity. NOT "every surface that shows the ring" — that was the old rule and
// it is reversed by §2.5: the in-game header shows the ring and NOTHING else, on purpose.
const IDENTITY_SURFACES = [
  'components/home/HomePage.tsx',
  'components/common/GameSelectionLayout.tsx',
  'components/hub/StickerAlbum.tsx',
]

// ─── §6.2 #1 — the two chrome controls are never THE SAME THING ───────────────────────────────────
//
// **THIS GUARD CHANGED SUBJECT, deliberately and on the owner's instruction (2026-09-05), and the
// change is recorded here rather than in a commit message because the old subject reads as the more
// careful one.**
//
// It began as "the ring and the chip are never adjacent", from the PRD's reading of the original
// report — *"it looks weird having these two upper right icons next to each other, different
// dimensions"* — which put the blame on ADJACENCY and moved identity to the opposite corner. Shown
// that build, the owner asked for identity back beside the ring, outermost. So adjacency was not the
// defect after all; it was only ever the amplifier.
//
// The defect was TWO IDENTICAL DISCS at the same size going to two different places. The PRD names
// the real invariant in §2.4 and calls it "the anti-confusion invariant": *"a PILL, never a circle —
// the book is the only circle in the chrome, so shape alone carries 'these are different kinds of
// thing' for a child who cannot read either label."* A 44×81 pill wearing a portrait and a NAME beside
// a 52px circular gauge is not two identical discs, at any distance.
//
// So the guard now asserts the property that survived contact with the owner's eye, and it is
// STRONGER than the one it replaces: distance can be re-tuned by anyone, whereas re-rounding the chip
// or squaring the ring goes red here. Do not "restore" the separation rule on top of it.

test('the chip and the ring can never read as the same object (§6.2 #1)', () => {
  const chip = codeOf(CHIP)
  const ring = codeOf(RING)

  // The ring is the circle: an SVG gauge, sized by its ONE `size` dimension on both axes.
  assert.match(ring, /<circle/, 'the reward ring is no longer a circle — the shapes stopped differing')
  assert.match(ring, /width=\{size\}[\s\S]{0,80}height=\{size\}/, 'the ring is no longer square-boxed')

  // The chip is the pill: a 999px radius on a content-sized box, and never a circle.
  assert.ok(!/borderRadius:\s*'50%'/.test(chip), 'the chip is a circle again — it must be a pill')
  assert.match(chip, /borderRadius: '999px'/, 'the chip lost its pill radius')

  // …and the name is what makes the pill wide. A portrait-only chip at a 999px radius IS a disc.
  // `(?<!\$)` is not fussiness: the chip's aria-label interpolates the name, so `${name}` CONTAINS the
  // literal `{name}` and a naive pattern is satisfied by the label alone. Found by /re-break — deleting
  // the rendered name left this green. `profileBadge.test.ts` carried the same lookbehind for the same
  // reason; the shape survived the rewrite even though the rule it guards was reversed.
  assert.match(chip, /(?<!\$)\{name\}/, 'the chip renders no name — a portrait on a 999px radius is a disc')
})

test('the badge that used to share the corner stays deleted (§6.2 #1)', () => {
  assert.ok(
    !existsSync(path.join(SRC, 'components/common/ProfileBadge.tsx')),
    'ProfileBadge.tsx is back — identity is a pill in the title row, not a second disc in the corner',
  )
  const strays = allComponents().filter((rel) => /<ProfileBadge\b/.test(codeOf(rel)))
  assert.deepEqual(strays, [], 'a surface still renders the deleted corner badge')
})

// ─── §6.2 #2 — no identity element in game ────────────────────────────────────────────────────────

test('GameShell renders NO identity element (§6.2 #2)', () => {
  // §2.5. Nobody needs telling who they are mid-round, this is the surface where real estate matters
  // most, and it gives the far corner back to Min Bog — GameShell's own header recorded the cost of
  // losing it: "a child aiming at the far corner for Min Bog hits a dead disc".
  const code = codeOf(SHELL)
  for (const forbidden of ['ProfileChip', 'ProfileBadge', 'avatarArt', 'useProfiles', 'profileStore']) {
    assert.ok(!code.includes(forbidden), `the game header grew an identity element back (${forbidden})`)
  }
  assert.ok(code.includes('<RewardRing'), 'GameShell no longer renders the ring — re-point this guard')
})

// ─── §6.2 #3 — the chip is not a meter ────────────────────────────────────────────────────────────

test('the chip cannot read progress AT ALL (§6.2 #3)', () => {
  // Carried over from `profileBadge.test.ts` unchanged, because the risk is unchanged: an identity
  // element that starts reading the store is the `ScoreChip` regression wearing a different hat — a
  // second thing in the chrome that changes as you play, with nothing on screen to say what it counts.
  // It has no legitimate reason to touch any of these, so the guard is total rather than a judgement
  // call at review time.
  const code = codeOf(CHIP)
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
    assert.ok(!code.includes(forbidden), `ProfileChip reads progress (${forbidden}) — it is not a meter`)
  }
})

test('the chip is STATIC — no animation of its own', () => {
  // A continuously animating element competing with a gauge that fills, and CLAUDE.md forbids framer
  // `repeat: Infinity` outright. The home call site shares the brand lockup's ONE entrance animation
  // instead; the component owns no motion.
  const code = codeOf(CHIP)
  for (const forbidden of ['framer-motion', 'idleMotion', 'idleFloat', 'keyframes', 'animation:']) {
    assert.ok(!code.includes(forbidden), `ProfileChip grew its own motion (${forbidden})`)
  }
})

// ─── §6.2 #4 — the chip is not a second door to Min Bog ───────────────────────────────────────────

test('the chip is NOT a door to /album (§6.2 #4)', () => {
  // `rewardSurfaces.test.ts` asserts exactly ONE route to /album per surface (the ring's own tap), so a
  // chip that navigated there would fail that guard from three files at once with a message pointing at
  // the wrong thing. Carried over rather than dropped because "the chip obviously doesn't do that" is
  // exactly what was true of the badge on the day before it became tappable.
  const code = codeOf(CHIP)
  for (const forbidden of ["'/album'", 'useTransitionNav', 'navigateWithTransition']) {
    assert.ok(!code.includes(forbidden), `the chip routes to Min Bog (${forbidden}) — that is the ring's job`)
  }
})

// ─── §2.4 — a PILL, never a circle ────────────────────────────────────────────────────────────────

test('the chip is a PILL — the ring is the only circle in the chrome', () => {
  // The anti-confusion invariant. A child who can read neither label still reads SHAPE, so the two
  // chrome elements must not be the same one. A round chip would re-create the corner's confusion at a
  // distance instead of at 12px, which is worse: it would look deliberate.
  const code = codeOf(CHIP)
  assert.ok(!/borderRadius:\s*'50%'/.test(code), 'the chip is a circle again — it must be a pill')
  assert.match(code, /borderRadius: '999px'/, 'the chip lost its pill radius')
  // A pill is content-sized. A fixed width on the root is a disc waiting to happen, and it would also
  // make a long name clip rather than ellipsise.
  const root = code.slice(code.indexOf('data-profile-chip'), code.indexOf('component="img"'))
  assert.ok(!/\bwidth:\s*\d/.test(root), 'the chip root has a fixed width — a pill is sized by its content')
  assert.match(root, /minHeight: 44/, 'the chip dropped below the 44px minimum touch target')
})

test('the chip shows the NAME AS TEXT (reversing the badge rule)', () => {
  // `profileBadge.test.ts` forbade exactly this. The reversal is §2.4 and it is deliberate: the badge
  // was a 46px disc with no room for a word, and a name would have made its width depend on the name.
  // A pill has room. The `profileInitial` letter-in-a-disc is deleted with the badge that needed it.
  const code = codeOf(CHIP)
  // See the lookbehind note above: `${name}` in the aria-label contains `{name}`.
  assert.match(code, /(?<!\$)\{name\}/, 'the chip no longer renders the child’s name')
  assert.ok(!code.includes('profileInitial'), 'the letter-in-a-disc is back — the pill shows the name')
  assert.ok(
    !existsSync(path.join(SRC, 'config/profileInitial.ts')),
    'profileInitial.ts is back with no consumer — an unused fallback is the thing de-emoji removed',
  )
  // …and a whitespace-only name still renders portrait-only. `.trim()`, not a bare truthiness check: a
  // whitespace-only name is truthy and would render a blank word and announce as "    spiller".
  assert.match(code, /profile\.name\?\.trim\(\)/, 'the chip stopped trimming — a blank name renders blank')
})

test('the portrait renders unconditionally — no glyph fallback, ever (§4.6)', () => {
  // De-emoji PRD-01 D5, and the same rule ProfilePicker/BoernSection follow: `normalizeAvatarId`
  // coerces an unknown id to the default and `avatars.test.ts` fails the build if any id lacks its
  // baked WebP, so a fallback here could only ever MASK a missing asset instead of failing the build.
  for (const rel of [CHIP, SHEET]) {
    const code = codeOf(rel)
    assert.match(code, /avatarArt\(/, `${rel} no longer renders baked avatar art — re-point this guard`)
    const line = code.split('\n').find((l) => l.includes('avatarArt('))
    assert.ok(line)
    assert.ok(!/(\?\?|\|\|)/.test(line), `a fallback appeared beside avatarArt: ${line.trim()}`)
  }
})

test('nothing attached ⇒ the chip renders NOTHING (§4.5)', () => {
  // No placeholder and no skeleton: the gate is blocking play in that state anyway, and a grey pill
  // that resolves into a name one frame later is a flicker in the corner of every cold launch.
  assert.match(codeOf(CHIP), /if \(!profile\) return null/, 'the chip renders something with no child attached')
})

test('every identity surface carries exactly ONE chip', () => {
  for (const rel of IDENTITY_SURFACES) {
    const n = (codeOf(rel).match(/<ProfileChip\b/g) ?? []).length
    assert.equal(n, 1, `${rel} renders ${n} profile chips — one per screen, on every screen that has one`)
  }
})

// ─── §6.2 #7 — the adult door has ONE address ─────────────────────────────────────────────────────

test('aria-label="Indstillinger" appears exactly once, on the sheet\'s row (§6.2 #7)', () => {
  // THE selector: every `ui-screenshot` recipe and `sweep.mjs` clicks `[aria-label="Indstillinger"]`.
  // It moved from the avatar to the row, because the accessible name of a control is its ACTION. A
  // second one would make the harness click whichever came first in the DOM — silently, on every
  // recipe at once — and would also mean two doors to the adult area, which is what the gear's deletion
  // removed.
  // `ariaLabel="…"` as well as `aria-label="…"`: the sheet passes it to its row component, which is
  // where it becomes the DOM attribute. The second assertion below is what proves that hop still lands.
  // The row's VISIBLE label IS its accessible name (`aria-label={label}` in `AdultRow`), so the
  // literal to count is `label="Indstillinger"`. The last assertion here proves that hop still lands.
  const SELECTOR = /\b(?:aria-)?label="Indstillinger"/g
  // The two surfaces that are LABELLED with it rather than triggers for it: the settings dialog itself
  // and the guest gate in front of it. Neither can be on screen at the same time as the sheet, and a
  // dialog's own accessible name is not a control.
  const LABELLED_SURFACES = new Set([
    'components/adult/AdultSettings.tsx',
    'components/auth/GuestAdultGate.tsx',
  ])
  const triggers = allComponents()
    .filter((rel) => !LABELLED_SURFACES.has(rel))
    .flatMap((rel) => (codeOf(rel).match(SELECTOR) ?? []).map(() => rel))
  assert.deepEqual(triggers, [SHEET], 'the adult door has moved, multiplied or vanished')
  // …and the prop actually reaches the DOM as the attribute the harness queries. Without this the
  // assertion above would stay green against a row that accepted `ariaLabel` and dropped it.
  assert.match(
    codeOf(SHEET),
    /aria-label=\{label\}/,
    'the row no longer renders its label as the accessible name — the selector would match nothing',
  )
})

// ─── §6.2 #8 — the sheet never switches a child itself ────────────────────────────────────────────

test('the sheet never switches a child itself (§6.2 #8)', () => {
  // Børn picker PRD-01 §2.7 put mid-session switching behind the parental gate, in the adult surface's
  // roster rows, and that stands. "Skift barn" is a DEEP LINK into that, not a second implementation of
  // it — and sibling TILES are deliberately absent from the sheet, because tiles that look tappable but
  // raise a keypad would teach a child that their sibling's face is a locked door.
  const code = codeOf(SHEET)
  for (const forbidden of ['selectProfile', 'profileStore', 'createProfile']) {
    assert.ok(!code.includes(forbidden), `the sheet switches or creates a child itself (${forbidden})`)
  }
  // It RAISES `ProfilePicker` — the same component the boot gate raises, which owns `selectProfile` —
  // and only after the gate. The owner reversed the PRD here (2026-09-05, see the sheet's header): the
  // PRD wanted a deep link into the adult roster rows, and the objection it was avoiding ("tiles that
  // look tappable but raise a keypad") does not apply, because the keypad comes FIRST.
  const pinAt = code.indexOf("requirePin('switchProfile'")
  const pickAt = code.indexOf('<ProfilePicker')
  assert.ok(pinAt > 0, 'the sheet raises the picker without the parental gate')
  // …and it must ASK EVERY TIME. `requirePin` short-circuits inside the ~5-minute adult unlock window,
  // which is correct in the settings surface and wrong one tap from the child's own name pill: for
  // five minutes after any adult action the child could switch to a sibling's book unchallenged.
  // Reported by the owner as "not gated" (2026-09-05) — the call was there, the challenge was not.
  assert.match(
    code,
    /requirePin\('switchProfile', \{ force: true \}\)/,
    'the switch honours the 5-minute unlock window again — from a child-facing surface that is no gate',
  )
  assert.ok(pickAt > 0, 'the sheet no longer raises the picker — re-point this guard')
  assert.match(code, /setPicking\(true\)/, 'the picker is no longer gated behind a resolved requirePin')
  assert.ok(
    code.slice(pinAt, code.indexOf('setPicking(true)', pinAt)).includes('if (!ok) return'),
    'a cancelled PIN still opens the picker',
  )
  assert.match(code, /adultSurfaceBus\.open\(/, 'the sheet no longer routes through the adult gate')
})

test('the sheet takes the blocking-overlay flags, and closes on CLICK only (§4.4)', () => {
  const code = codeOf(SHEET)
  // Or the audio-permission cue paints over it and the music bed keeps playing under a modal.
  assert.match(code, /setAuthUiOpen\(true\)/, 'the sheet does not claim authUiOpen — the audio cue can paint over it')
  assert.match(code, /musicClient\.setGateBlocking\('sheet',/, 'the music bed plays under the sheet')
  // The "Start lyd nu" tap-through incident (0ec1df3): a `pointerdown` close fires before the overlay
  // is gone, so the same gesture presses whatever is behind it. `onPointerDown` here may only WARM.
  const pointerDowns = code.match(/onPointerDown=\{([^}]*)\}/g) ?? []
  for (const h of pointerDowns) {
    assert.match(h, /warmScreenshot/, `a pointerdown handler here does more than warm: ${h}`)
  }
  // The snapdom warm moved with the door — without it the capture lands on the dialog's enter
  // transition instead of ahead of it (see gateLayout.test.ts for the regression it belongs to).
  assert.match(code, /onPointerDown=\{warmScreenshot\}/, 'the snapdom chunk is no longer warmed on press')
})

// ─── §6.2 #5 + #6 — what the corner itself now shows ──────────────────────────────────────────────

test('the count renders AT ZERO (§6.2 #5)', () => {
  // §2.3, reversing RewardRing's own "an empty badge on a fresh profile teaches nothing". That was true
  // of a bare numeral beside a 30%-opacity smudge; with a recognisable book behind it the 0 has a
  // referent, and a fresh corner reads "my book · nothing in it yet · this ring is filling".
  const code = codeOf(RING)
  assert.ok(!/count > 0/.test(code), 'the count badge is hidden at zero again — a fresh corner says nothing')
  assert.match(code, /\{showCount && \(/, 'the count badge is no longer gated on showCount alone')
})

test('NO silhouette treatment survives in the corner (§6.2 #6)', () => {
  // §2.2. The next-prize silhouette is DELETED — the last survivor of the promise/payoff two-beat that
  // Endless Play PRD-01 D4 already removed everywhere else, and illegible besides (25px of art at 30%
  // opacity under `brightness(0)`). **Its absence is the change; do not restore it as a missing beat.**
  const code = codeOf(RING)
  for (const gone of ['brightness(0)', 'centreStyle', 'silhouette', 'rewardArt', 'bookFull', 'nextReward']) {
    assert.ok(!code.includes(gone), `the next-prize silhouette is back in the ring (${gone})`)
  }
  assert.ok(!/opacity:\s*0\.3\b/.test(code), 'the ring centre is dimmed again — the book is the child’s')
  // …and what it shows instead is the book, sized off `size` like everything else in this control.
  assert.match(code, /src=\{uiArt\.book\}/, 'the ring centre is no longer the child’s book')
  assert.match(
    code,
    /src=\{uiArt\.book\}[\s\S]{0,400}width: centreArtSize\(size\)/,
    'the book acquired a dimension of its own — `size` is the ring’s ONE dimension (§4.1)',
  )
})
