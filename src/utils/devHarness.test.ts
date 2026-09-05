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
