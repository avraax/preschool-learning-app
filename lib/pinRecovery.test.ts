import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// THE FORGOTTEN-PIN RECOVERY DOOR, guarded where it actually lives.
//
// `pinPolicy.test.ts` pins the pure predicate and the copy. Neither can see the thing that was
// broken for the whole life of the feature: `/family/pin/set` demanded the current PIN whenever a
// row existed, so the lockout's "log ind … for at lave en ny kode" was a promise nothing kept, and
// an adult who forgot the code was locked out of "Indstillinger" permanently (found on staging,
// 2026-09-19). A pure test cannot reach that branch, and there is no jsdom or test database here —
// so the wiring is read from source, the same shape as `shellAuth.test.ts`.

/** Comments stripped: every assertion below would otherwise pass on the prose explaining the fix. */
const codeOf = (rel: string): string =>
  readFileSync(new URL(`./${rel}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PLUGIN = codeOf('auth-family-plugin.ts')

test('pin/set consults the shared predicate rather than re-deriving freshness', () => {
  // Re-deriving it here (a hand-rolled `Date.now() - created < 900000`) is how the server and the
  // client would drift into offering a button that then fails. One predicate, imported.
  assert.match(
    PLUGIN,
    /import\s*\{[\s\S]*?sessionAllowsPinReset[\s\S]*?\}\s*from\s*'\.\.\/src\/config\/pinPolicy\.js'/,
    'the plugin no longer imports sessionAllowsPinReset from the pure policy',
  )
  assert.match(
    PLUGIN,
    /const\s+recovering\s*=\s*existing\s*!=\s*null\s*&&\s*sessionAllowsPinReset\(/,
    'pin/set no longer decides recovery with sessionAllowsPinReset',
  )
})

test('the recovery branch is reachable when a PIN exists — the whole point', () => {
  // `if (existing)` alone is what locked the adult out: with a row present there was no path to
  // pin/set that did not demand the old code. The guard is the `&& !recovering`.
  assert.match(
    PLUGIN,
    /if\s*\(existing\s*&&\s*!recovering\)\s*\{/,
    'pin/set gates the current-PIN check on `existing` alone again — recovery is unreachable',
  )
  assert.ok(
    !/if\s*\(existing\)\s*\{[\s\S]{0,400}?currentPin/.test(PLUGIN),
    'a bare `if (existing)` branch demands the current PIN again',
  )
})

test('recovery is decided BEFORE the lockout, or it cannot rescue a locked-out adult', () => {
  // Ordering is the whole substance. An adult who forgot the code has, by definition, already failed
  // enough times to be inside a lock window — often the 24h one. Checking the lockout first would
  // make the recovery door open only for people who did not need it.
  const setAt = PLUGIN.indexOf("'/family/pin/set'")
  assert.ok(setAt > 0, 'the pin/set endpoint has gone missing')
  const body = PLUGIN.slice(setAt, PLUGIN.indexOf("'/family/pin/verify'"))
  const recoveringAt = body.indexOf('const recovering')
  const lockedAt = body.indexOf('isLockedOut(')
  assert.ok(recoveringAt > 0, 'pin/set never computes `recovering`')
  assert.ok(lockedAt > 0, 'pin/set no longer checks the lockout at all')
  assert.ok(
    recoveringAt < lockedAt,
    'the lockout is checked before recovery — a locked-out adult can never reach the door',
  )
})

test('/family/status reports pinResettable, so the client offers only what the server will allow', () => {
  assert.match(
    PLUGIN,
    /const\s+pinResettable\s*=[\s\S]{0,200}?sessionAllowsPinReset\(/,
    '/family/status no longer derives pinResettable from the shared predicate',
  )
  assert.match(PLUGIN, /pinResettable,/, '/family/status does not return pinResettable')
})

test('the VERIFY path still refuses to be a recovery door', () => {
  // Recovery belongs to pin/set, which replaces the secret. If pin/verify ever learned to pass on a
  // fresh session, the adult gate would open without any code at all for 15 minutes after sign-in.
  const verifyAt = PLUGIN.indexOf("'/family/pin/verify'")
  assert.ok(verifyAt > 0, 'the pin/verify endpoint has gone missing')
  const body = PLUGIN.slice(verifyAt, verifyAt + 2500)
  assert.ok(
    !/sessionAllowsPinReset/.test(body),
    'pin/verify consults the recovery predicate — the gate would open with no code at all',
  )
})
