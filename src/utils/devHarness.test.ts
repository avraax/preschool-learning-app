import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The dev harness params, guarded as SOURCE for the one property that is not about screenshots.
//
// WHY THIS FILE EXISTS: `?rewards=<n>` destroyed a real child's book (`Sejer`, 2026-09-05). It calls
// `progressStore.resetAll()` before seeding, and `resetAll()` bumps `sync.epoch` — which
// `api/progress.ts` treats as a DECLARED RESET that wins wholesale over the server mirror, so the
// deletion propagates to every device and nothing can restore it. The row was found at `epoch: 1`,
// `grantedSlots: 0`; a fresh document starts at `epoch: 0`, which is what makes the epoch a fingerprint
// rather than a guess.
//
// The param was never meant to reach a real child — every `ui-screenshot` recipe and `sweep.mjs` pass
// `?nogate=1`, which attaches the stand-in `dev-local`. But nothing enforced that, and DEV includes the
// owner's own browser playing with real data. A query string is pasteable, bookmarkable and survives a
// reload; the app's other route to `resetAll()` costs a PIN and typing `NULSTIL`.
//
// Read as TEXT rather than imported: this module reads `import.meta.env` and `window.location`, and the
// property being asserted is which GUARD sits in front of the call, which is a source fact.
import { DEV } from './devHarness.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const code = readFileSync(path.join(HERE, 'devHarness.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

/** `installDevRewards`, from its declaration to the end of the function. */
const seeder = (): string => {
  const start = code.indexOf('export const installDevRewards')
  assert.ok(start > 0, 'installDevRewards is gone — re-point this guard')
  // To the NEXT top-level declaration, not to the first `\n}` — the fence's early return closes a block
  // before the function does, and slicing there cut the assertion's own subject out of the string.
  const rest = code.slice(start)
  const next = rest.slice(1).search(/\nexport (?:const|function|type|interface) /)
  return next < 0 ? rest : rest.slice(0, next + 1)
}

test('?rewards= can only ever seed the DEV stand-in child', () => {
  // THE assertion. The bypass is the right fence because it decides WHO IS ATTACHED: `?nogate=1` /
  // `?noauth=1` attach `dev-local` from `profileStore`'s bypass roster, so a seed can only land in a
  // throwaway book. Without it, `whenAttached()` resolves on whatever real child is signed in.
  const fn = seeder()
  const bypassAt = fn.indexOf('devNoAuth()')
  // `resetAll('dev-harness')` — the reason is the store-side half of the same fence, so match the call
  // rather than a bare `resetAll()` that no longer exists.
  const resetAt = fn.indexOf("resetAll('dev-harness')")
  assert.ok(bypassAt > 0, '?rewards= no longer checks the DEV auth bypass — it can wipe a real child')
  assert.ok(resetAt > 0, 'the seeder no longer resets — re-point this guard')
  assert.ok(
    bypassAt < resetAt,
    'the bypass check moved AFTER resetAll() — the wipe happens before the fence',
  )
  // …and it must RETURN on the un-bypassed path, not merely warn and carry on.
  assert.match(
    fn.slice(bypassAt, resetAt),
    /return\s/,
    '?rewards= warns about the wipe and then does it anyway',
  )
})

test('the whole harness is DEV-only, so none of this ships', () => {
  // `DEV` is `import.meta.env.DEV || __HARNESS__`, both build-time. Outside Vite (this runner) it is
  // false, which is also the production value — so importing the module here proves the constant folds
  // the way `harnessBuild.test.ts` pins for the bundle.
  assert.equal(DEV, false, 'the dev harness believes it is enabled outside Vite')
  assert.match(seeder(), /if \(!DEV\) return/, 'installDevRewards lost its DEV guard')
})

// ─── `?kidname=` — it renames the STAND-IN, and it must not be able to do anything else ────────────
//
// Added when Corner identity PRD-01 gave the corner a place to print the name. Shots 1-5 of both App
// Store slots are captured under `?nogate=1` (seeding a book needs it — `?rewards=` refuses outside
// it), so without an override every one of them would ship a store page showing a child called "Dev".

test('?kidname= is DEV-only and sanitised before it reaches the DOM', () => {
  const start = code.indexOf('export const devKidName')
  assert.ok(start > 0, 'devKidName is gone — re-point this guard')
  const fn = code.slice(start, start + 400)

  assert.match(fn, /if \(!DEV\) return null/, 'devKidName lost its DEV guard — it would ship')
  // It lands in the DOM, so it is filtered to letters/space/hyphen/apostrophe rather than trusted.
  assert.match(fn, /replace\(/, 'devKidName no longer sanitises — a URL now writes raw text into the UI')
  assert.match(fn, /slice\(0, *\d+\)/, 'devKidName lost its length cap')
})

test('?kidname= cannot widen the resetAll fence, because that fence keys on the ID', () => {
  // The fence in progressStore matches `dev-local(-\d+)?` on `profileId`. If the stand-in's ID ever
  // became derived from the name, a crafted `?kidname=` would be a way back to wiping a real child.
  const store = readFileSync(path.join(HERE, '..', 'services', 'profileStore.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const start = store.indexOf('const devProfile')
  assert.ok(start > 0, 'devProfile is gone — re-point this guard')
  const fn = store.slice(start, start + 300)

  assert.match(fn, /id: 'dev-local'/, "the stand-in's id is no longer the literal 'dev-local'")
  assert.ok(
    !/id:\s*`/.test(fn),
    'the stand-in id became a template literal — it must never be derived from the name',
  )
})
