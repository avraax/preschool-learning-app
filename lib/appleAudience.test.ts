import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// APPLE'S ID TOKEN IS VERIFIED AGAINST AN AUDIENCE WE CHOOSE, AND THE WRONG CHOICE IS SILENT.
//
// Sign in with Apple never once worked on staging (no `account` row with `providerId: 'apple'` has ever
// existed), and the cause was one spread: `appBundleIdentifier: optionalEnv('APPLE_BUNDLE_ID')`, with
// that variable set on the staging Vercel project. better-auth does not ADD the bundle id to the
// expected audience — it substitutes it for the Services ID. Our web token's `aud` is the Services ID,
// so `jwtVerify` threw, `verifyIdToken` returned false, and `signInSocial` raised UNAUTHORIZED. Nothing
// in the app could say so, because `asResponse: true` had already swallowed the APIError (see
// lib/oauth-failure-report.test.ts).
//
// Two guards, because one alone is not enough: the first pins OUR config, the second pins the
// better-auth PRECEDENCE RULE our config depends on — a bump that reorders it must fail here rather
// than on the owner's iPad, where the only symptom is a Danish failure page.

const src = readFileSync('lib/auth.ts', 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((line) => line.replace(/(^|\s)\/\/.*$/, '')) // the rationale is in comments; it must not satisfy the guard
  .join('\n')

/** The Apple provider config object, so a match elsewhere in the file cannot stand in for one inside it. */
const appleProvider = src.slice(src.indexOf('const appleProvider'), src.indexOf('export const auth'))

test('the Apple provider states its audience explicitly', () => {
  assert.ok(appleProvider.length > 0, 'the Apple provider block moved — re-anchor this guard')
  assert.match(
    appleProvider,
    /audience:\s*\[/,
    'the Apple provider must set an explicit `audience` array — it is the only entry that wins better-auth’s precedence chain outright',
  )
  // The Services ID is what a `response_mode=form_post` web token actually carries in `aud`. Dropping it
  // from the array is the exact regression this whole file exists for.
  assert.match(appleProvider, /audience:\s*\[\s*cfg\.clientId/, 'the Services ID must be the first audience')
})

test('APPLE_BUNDLE_ID is never the sole source of the expected audience', () => {
  // `appBundleIdentifier` REPLACES `clientId`. There is no correct use of it here while the sheet is a
  // web sheet, and adding it back alongside `audience` would be dead config at best.
  assert.doesNotMatch(
    appleProvider,
    /appBundleIdentifier/,
    'appBundleIdentifier replaces the Services ID rather than joining it — put the bundle id in the `audience` array instead',
  )
  // It may still be READ, so a future native sheet verifies too — but only from inside the `audience`
  // array literal. Anywhere else and it is back to displacing the Services ID under another name.
  const open = appleProvider.indexOf('audience: [')
  const close = appleProvider.indexOf(']', open)
  const audienceLiteral = appleProvider.slice(open, close)
  for (const m of appleProvider.matchAll(/optionalEnv\('APPLE_BUNDLE_ID'\)/g)) {
    assert.ok(
      m.index! > open && m.index! < close,
      'APPLE_BUNDLE_ID may only be read into the `audience` array',
    )
  }
  assert.match(audienceLiteral, /APPLE_BUNDLE_ID/, 'a future native sheet still needs the bundle id listed')
})

test("better-auth still resolves the audience the way lib/auth.ts assumes", () => {
  // Copied by READING, not by hand: the expression is lifted out of the installed package and evaluated,
  // so a bump that changes the precedence — or drops `options.audience` entirely — fails here.
  const apple = readFileSync('node_modules/@better-auth/core/dist/social-providers/apple.mjs', 'utf8')
  const verify = apple.slice(apple.indexOf('async verifyIdToken'))
  const match = verify.match(/audience:\s*(.+?),\n/)
  assert.ok(match, 'the audience expression is gone from apple.mjs — better-auth changed shape, re-read verifyIdToken')

  const resolve = new Function('options', `return (${match[1]})`) as (o: unknown) => unknown

  const SERVICES_ID = 'dk.boernelaering.web'
  const BUNDLE_ID = 'com.vraa.earlylearning'

  // THE BUG, reproduced: a bundle id with no explicit audience silently displaces the Services ID.
  assert.equal(
    resolve({ clientId: SERVICES_ID, appBundleIdentifier: BUNDLE_ID }),
    BUNDLE_ID,
    'this is the RC1 failure — if it no longer holds, the fix below may be unnecessary, but check before removing it',
  )

  // THE FIX: an explicit array wins, and it carries the Services ID our web token is actually signed for.
  const resolved = resolve({
    clientId: SERVICES_ID,
    appBundleIdentifier: BUNDLE_ID,
    audience: [SERVICES_ID, BUNDLE_ID],
  })
  assert.deepEqual(resolved, [SERVICES_ID, BUNDLE_ID], '`audience` must win over `appBundleIdentifier`')

  // And it must still work with APPLE_BUNDLE_ID unset, which is what `.filter(Boolean)` leaves behind.
  assert.deepEqual(resolve({ clientId: SERVICES_ID, audience: [SERVICES_ID] }), [SERVICES_ID])
})
