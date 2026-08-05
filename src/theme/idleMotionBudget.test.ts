// The performance win from Performance PRD-01, guarded as SOURCE (W8.1–W8.3).
//
// All three failure modes here are something QUIETLY COMING BACK, in a diff that reads as a harmless
// addition: a new `repeat: Infinity` on an idle animation, a `will-change` sprinkled onto an element
// that already promotes itself, or `content-visibility` — which is Safari 18 and therefore invisible on
// the ONE device that matters until the owner reports the app broken. Nothing type-checks any of them,
// and a screenshot cannot show the absence of a JS animation loop.
//
// The files are read as TEXT (they are .tsx and pull in MUI/Vite, so `node --test` cannot import them),
// and **comments are stripped first**. That is load-bearing, not tidiness: a prose mention of the
// forbidden thing in the "why" comment above a fix once satisfied a plain `includes()` and kept a guard
// green after the fix itself had been deleted. Every file below carries exactly such a comment.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AMBIENT_PROMOTED_MAX, PROMOTE_MIN_TRAVEL_PX, shouldPromoteLayer } from '../config/parallax.ts'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const codeOf = (rel: string): string => stripComments(readFileSync(path.join(SRC, rel), 'utf8'))

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// W8.1 — no new infinite JS animation loop.
//
// A `repeat: Infinity` is a JavaScript animation: framer's frameloop ticks it every rAF, writes an
// inline style, and the browser recalculates style once per frame. Twenty-five of them were what made
// the app spend ~40% of every second recalculating style while sitting still (PRD-01 F1/F4). The
// replacement vocabulary is `src/theme/idleMotion.ts` — CSS keyframes, compositor-driven.
//
// The allowlist is EXHAUSTIVE and every entry carries its reason. These all share one shape: the loop
// runs only while the child is actively interacting (a never-fail hint that has tripped after 2 wrong
// answers, or a drag hovering a target), so it costs nothing at rest, it is not stateless, and moving it
// would mean restructuring raw `motion.div` trees in the drag games — where `sx`-not-raw-`style` is a
// documented trap (`.claude/rules/drag-and-drop.md`).
//
// **Adding an entry is a decision, not a formality.** If the loop is idle ambience, convert it instead.
const INFINITE_LOOP_ALLOWLIST: Record<string, { count: number; why: string }> = {
  'components/farver/FarvejagtGame.tsx': {
    count: 2,
    why: 'never-fail hint pulse on a board item + the well breathe while a drag hovers it — both interaction-gated',
  },
  'components/farver/FarveQuizGame.tsx': {
    count: 2,
    why: 'never-fail hint pulse on the correct swatch + the swatch breathe under a hovering drag',
  },
  'components/farver/NuancerGame.tsx': {
    count: 2,
    why: 'never-fail hint pulse on the correct shade + the slot breathe under a hovering drag',
  },
  'components/farver/RamFarvenGame.tsx': {
    count: 2,
    why: 'never-fail hint pulse on the 2 correct droplets + the pot breathe under a hovering drag',
  },
}

test('W8.1 — no infinite JS animation loop outside the allowlist', () => {
  const offenders: string[] = []
  for (const file of walk(path.join(SRC, 'components'))) {
    const rel = path.relative(SRC, file).replace(/\\/g, '/')
    const count = (stripComments(readFileSync(file, 'utf8')).match(/repeat:\s*Infinity/g) ?? []).length
    if (count === 0) continue
    const allowed = INFINITE_LOOP_ALLOWLIST[rel]
    if (!allowed) {
      offenders.push(`${rel}: ${count} infinite JS loop(s) — use src/theme/idleMotion.ts, or allowlist it WITH A REASON`)
    } else if (count > allowed.count) {
      offenders.push(`${rel}: ${count} infinite JS loop(s), allowlist permits ${allowed.count} (${allowed.why})`)
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'))
})

test('W8.1 — every allowlist entry is real, and carries a reason', () => {
  for (const [rel, entry] of Object.entries(INFINITE_LOOP_ALLOWLIST)) {
    const count = (codeOf(rel).match(/repeat:\s*Infinity/g) ?? []).length
    // A STALE entry is the quiet failure: once a game's loops are converted, its budget must go with
    // them, or it silently licenses new ones.
    assert.equal(count, entry.count, `${rel} has ${count} infinite loops but the allowlist says ${entry.count} — update it`)
    assert.ok(entry.why.length > 30, `${rel}'s allowlist entry needs a real reason, not "${entry.why}"`)
  }
})

test('W8.1 — the ONE remaining JS loop is the legacy branch, and it is gated on perfProfile', () => {
  // `theme/motion.ts` must stay clean: its `idleFloat` moved out, and the vocabulary must not fork back.
  assert.ok(
    !/repeat:\s*Infinity/.test(codeOf('theme/motion.ts')),
    'theme/motion.ts declares an infinite JS loop again — continuous stateless motion is CSS now',
  )
  // `idleMotion.ts` legitimately declares EXACTLY ONE, because "Flydende grafik" off has to reconstruct
  // the old framer loops (W6). One, not two: a second would mean some helper grew its own legacy branch
  // instead of going through `bundle()`, which is the single-branch-point rule this PRD is built on.
  const idle = codeOf('theme/idleMotion.ts')
  const loops = (idle.match(/repeat:\s*Infinity/g) ?? []).length
  assert.equal(loops, 1, `idleMotion.ts has ${loops} infinite JS loops; exactly one (bundle()'s legacy branch) is right`)
  assert.match(
    idle,
    /if \(!perfProfile\(\)\.useCssIdleMotion\)/,
    "idleMotion.ts's JS loop is not gated on perfProfile — the FAST path would be running framer loops",
  )
  // And the CSS vocabulary is actually there to be used (a guard that only forbids is half a guard).
  for (const helper of ['idleFloat', 'idlePulse', 'idleGlow', 'equalizerBar', 'idleWobble']) {
    assert.match(idle, new RegExp(`export const ${helper}\\b`), `idleMotion.ts is missing ${helper}`)
  }
})

test('W8.1 — the wipe overlay runs no JS animation loop during a route mount', () => {
  // Its own work item (W5): three loops used to run while a route mounted and lazy chunks resolved.
  const code = codeOf('components/common/transition/TransitionOverlay.tsx')
  assert.ok(!/repeat:\s*Infinity/.test(code), 'TransitionOverlay is animating on the main thread again')
  assert.match(code, /wipeSparkle|wipeLeaf|wipeRocket/, 'the wipe motifs lost their CSS animations entirely')
})

// ---------------------------------------------------------------------------------------------
// W8.2 — the `will-change` budget.
//
// An element already running a `transform`/`opacity` keyframe animation is promoted BY that animation:
// adding `will-change` buys nothing and costs a compositing texture. `AmbientField` had it on every
// sprite AND every shooting star — up to AMBIENT_PROMOTED_MAX promoted layers at dpr 2, on a GPU that
// shares system memory with a 2048x2732 backing store.
test('W8.2 — AmbientField promotes nothing by hand', () => {
  const code = codeOf('components/common/scene/AmbientField.tsx')
  assert.ok(
    !/willChange/.test(code),
    'AmbientField is sprinkling will-change again — its own transform/opacity keyframes already promote it',
  )
})

test('W8.2 — ParallaxLayer promotes ONLY the layer it actually animates', () => {
  const code = codeOf('components/common/scene/ParallaxLayer.tsx')
  const hits = (code.match(/willChange/g) ?? []).length
  assert.equal(hits, 1, `ParallaxLayer has ${hits} will-change sites; exactly one (the promoted branch) is right`)
  // It must be INSIDE the promote branch, not unconditional — that is the whole point of W2.2.
  assert.match(code, /promote\s*\n?\s*\?\s*\{\s*willChange/, "ParallaxLayer's will-change is not gated on shouldPromoteLayer")
})

test('W8.2 — the promotion threshold still de-promotes the far layers and keeps the mid ones', () => {
  // Derived from the shipped depths, not hand-copied: far 0.12-0.14, mid 0.42-0.44, ground 0.80-0.82.
  assert.equal(shouldPromoteLayer(0.12), false, 'the space far layer is being promoted to travel ~5px')
  assert.equal(shouldPromoteLayer(0.14), false, 'the far layer is being promoted to travel ~6px')
  assert.equal(shouldPromoteLayer(0.42), true, 'the mid layer must stay promoted — it travels ~18px')
  assert.equal(shouldPromoteLayer(0.82), true, 'the ground layer must stay promoted')
  // Pin the value itself, not just the agreement: a threshold and a depth table that move TOGETHER
  // would satisfy the four assertions above while promoting everything again.
  assert.equal(PROMOTE_MIN_TRAVEL_PX, 8)
})

test('W8.2 — the promoted-ambient ceiling is pinned and the skins stay under it', () => {
  assert.equal(AMBIENT_PROMOTED_MAX, 28)
  // `count + bloomExtra`, where bloomExtra tops out at ~12 (stage*2 + fill*4 in PersistentWorld).
  const BLOOM_EXTRA_MAX = 12
  const counts: number[] = []
  for (const f of readdirSync(path.join(SRC, 'theme', 'tokens'))) {
    if (!f.endsWith('.tokens.ts')) continue
    const m = stripComments(readFileSync(path.join(SRC, 'theme', 'tokens', f), 'utf8')).match(/count:\s*(\d+)/)
    if (m) counts.push(Number(m[1]))
  }
  assert.ok(counts.length >= 4, `expected an ambient count per skin, found ${counts.length}`)
  for (const c of counts) {
    assert.ok(
      c + BLOOM_EXTRA_MAX <= AMBIENT_PROMOTED_MAX,
      `a skin's ambient count (${c}) plus full bloom (${BLOOM_EXTRA_MAX}) exceeds AMBIENT_PROMOTED_MAX (${AMBIENT_PROMOTED_MAX})`,
    )
  }
  // And the bloom curve itself hasn't been widened out from under the ceiling.
  const world = codeOf('components/common/scene/PersistentWorld.tsx')
  assert.match(world, /Math\.round\(stage \* 2 \+ fill \* 4\)/, 'the bloom curve changed — re-derive BLOOM_EXTRA_MAX above')
})

// ---------------------------------------------------------------------------------------------
// W8.3 — the Safari 17 API floor.
//
// `content-visibility` is Safari 18+. The child's iPad is an iPad Pro 2nd gen on iPadOS 17.7.11 and
// that is its TERMINAL OS, so this is not "wait for adoption" — it is permanently unavailable. It is
// also the single most tempting wrong answer to the compositing problem (PRD-01 F5/F9), and it fails
// SILENTLY: the property is simply ignored, so the app looks fine everywhere except on the one device
// that matters. Exactly the shape of the Ogg audio that silenced the app twice.
//
// `contain` and `contain-intrinsic-size` DID ship in Safari 17.0 and are deliberately not forbidden.
test('W8.3 — content-visibility appears nowhere in src (Safari 18; the floor is 17.7)', () => {
  const offenders: string[] = []
  for (const file of walk(SRC)) {
    const code = stripComments(readFileSync(file, 'utf8'))
    if (/content-visibility|contentVisibility/.test(code)) offenders.push(path.relative(SRC, file).replace(/\\/g, '/'))
  }
  assert.deepEqual(
    offenders,
    [],
    `content-visibility is Safari 18+ and the compatibility floor is iPadOS 17.7: ${offenders.join(', ')}`,
  )
})

test('W8.3 — the scene root uses the Safari-17-safe containment it was given', () => {
  const code = codeOf('components/common/scene/ThemeScene.tsx')
  assert.match(code, /contain:\s*'layout paint'/, 'the scene root lost its containment (W2.3)')
})
