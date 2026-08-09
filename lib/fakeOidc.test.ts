import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  decodeFakeCode,
  encodeFakeCode,
  FAKE_PROVIDER_SLOT,
  fakeSocialProvider,
  signFakeIdToken,
  verifyFakeIdToken,
} from './fake-oidc.ts'

// THE FAKE PROVIDER BYPASSES THE IDENTITY CHECK, so the gate around it is the only thing that matters.
// Everything else here is convenience; this file is mostly about proving it cannot be reached.
//
// The gate itself (`fakeProviderEnabled`) is tested in lib/env.test.ts alongside `AUTH_DEV_BYPASS`,
// which is the same shape of switch and the same style of impossibility proof.

const stripped = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n')

test('every door to the fake provider is gated, not just the first', () => {
  // Three independent checks, because each protects a different way in: the start endpoint (which is
  // what writes `fake` onto a flow row at all), the fake authorize endpoint (reachable directly by URL),
  // and the callback's own token-exchange branch (which must not trust a row it merely read — an
  // environment can change under a row that already exists).
  const plugin = stripped('lib/auth-family-plugin.ts')
  const gates = [...plugin.matchAll(/fakeProviderEnabled\(\)/g)]
  assert.ok(gates.length >= 3, `only ${gates.length} gates in the plugin — every entry point needs one`)

  const start = plugin.slice(plugin.indexOf('familyOauthStart'), plugin.indexOf('familyOauthCallback'))
  assert.match(start, /provider === 'fake' && !fakeProviderEnabled\(\)/, '/oauth/start does not refuse fake')

  const authorize = plugin.slice(plugin.indexOf('familyOauthFakeAuthorize'))
  assert.match(
    authorize.slice(0, 900),
    /if \(!fakeProviderEnabled\(\)\) throw new APIError\('NOT_FOUND'\)/,
    'the fake authorize endpoint must 404 wherever the gate is shut',
  )

  // And registering the provider at all is gated, so `signInSocial` has nothing to resolve.
  assert.match(
    stripped('lib/auth.ts'),
    /fakeProviderEnabled\(\)\s*\?\s*\{\s*\[FAKE_PROVIDER_SLOT\]/,
    'the fake provider is registered unconditionally',
  )
})

test('the fake rides a REAL better-auth slot, because an invented key is dropped', () => {
  // `signInSocial` resolves its provider from better-auth's own registry
  // (`c.context.socialProviders[body.provider]`), so a key like `fake` never reaches the handler — the
  // request would 404 with PROVIDER_NOT_FOUND and none of our code would be under test.
  const registry = readFileSync(
    'node_modules/@better-auth/core/dist/social-providers/index.mjs',
    'utf8',
  )
  assert.match(
    registry,
    new RegExp(`^\\s+${FAKE_PROVIDER_SLOT},`, 'm'),
    `${FAKE_PROVIDER_SLOT} is no longer a better-auth provider — pick another slot`,
  )
  // And it must be a slot we never use for real. Nothing in the repo may configure it elsewhere.
  const auth = stripped('lib/auth.ts')
  const uses = [...auth.matchAll(new RegExp(FAKE_PROVIDER_SLOT, 'g'))]
  assert.equal(uses.length, 0, `${FAKE_PROVIDER_SLOT} appears literally in lib/auth.ts — use the constant`)
})

test('a token this process signed verifies; anything else does not', async () => {
  const token = await signFakeIdToken({ sub: 'fake-1', email: 'someone@example.test' })
  assert.deepEqual(await verifyFakeIdToken(token), {
    sub: 'fake-1',
    email: 'someone@example.test',
    name: 'Fake Adult',
  })
  // The RC1 shape — a token that will not verify — must be a clean `null`, never a throw and never a
  // partial success.
  assert.equal(await verifyFakeIdToken('not.a.valid.token'), null)
  assert.equal(await verifyFakeIdToken(''), null)
  // A token signed by a DIFFERENT key (i.e. another process) is refused, which is what makes the
  // in-memory keypair a real boundary rather than decoration.
  const foreign =
    'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4IiwiZW1haWwiOiJ4QHkueiJ9.' + 'A'.repeat(86)
  assert.equal(await verifyFakeIdToken(foreign), null)
})

test('the provider config only overrides the two functions better-auth calls', async () => {
  // Everything after `verifyIdToken` and `getUserInfo` must stay better-auth's own: the allowlist hook,
  // the session creation and the signed `set-auth-token` value the claim has to split. A stand-in that
  // shortcut those would prove nothing about the path that actually broke.
  const p = fakeSocialProvider()
  assert.deepEqual(Object.keys(p).sort(), ['clientId', 'clientSecret', 'getUserInfo', 'verifyIdToken'])

  const token = await signFakeIdToken({ sub: 'fake-2', email: 'adult@example.test' })
  assert.equal(await p.verifyIdToken(token), true)
  assert.equal(await p.verifyIdToken('not.a.valid.token'), false)
  const info = await p.getUserInfo({ idToken: token })
  assert.equal(info?.user.email, 'adult@example.test')
  assert.equal(info?.user.emailVerified, true)
  assert.equal(await p.getUserInfo({ idToken: 'not.a.valid.token' }), null)
})

test('the outcome code round-trips, and a malformed one is refused', () => {
  // The scenario is chosen at /oauth/start and travels in the authorization code, so a typo must fail
  // loudly rather than silently fall back to the happy path — which would make a broken test look green.
  for (const outcome of [
    { kind: 'ok' as const, email: 'a+b@example.test' },
    { kind: 'reject-exchange' as const },
    { kind: 'bad-token' as const },
  ]) {
    assert.deepEqual(decodeFakeCode(encodeFakeCode(outcome)), outcome)
  }
  assert.equal(decodeFakeCode('ok:someone@example.test'), null, 'a code without the prefix is not ours')
  assert.equal(decodeFakeCode('fake:'), null)
  assert.equal(decodeFakeCode('fake:ok:'), null, 'an empty address must not pass')
  assert.equal(decodeFakeCode('fake:nonsense'), null)
})

test('the allowlist refusal is recognised by the ONE field better-auth preserves', () => {
  // Measured 2026-08-09 by driving this very provider: `databaseHooks.user.create.before` throws
  // FORBIDDEN, and better-auth re-throws it as 401 `OAUTH_LINK_ERROR` with only the MESSAGE intact. So
  // both ends must use the shared constant — a hand-typed copy in either file silently un-reaches the
  // refusal copy again, which is exactly the bug W2 thought it had already fixed.
  const auth = stripped('lib/auth.ts')
  assert.match(auth, /message: ALLOWLIST_REFUSED_MESSAGE/, 'the hook must throw the shared constant')
  assert.doesNotMatch(
    auth,
    /message: 'Denne konto/,
    'the refusal message is hand-typed here — it must come from the shared constant',
  )
  const outcome = stripped('lib/oauth-signin-outcome.ts')
  assert.match(outcome, /outcome\.message === ALLOWLIST_REFUSED_MESSAGE/)
  // The callback must actually PASS the message through, or the check above can never fire.
  assert.match(
    stripped('lib/auth-family-plugin.ts'),
    /classifySignInFailure\(\{[\s\S]{0,200}message: outcome\.message/,
    'the callback drops the message, so the forbidden branch is dead again',
  )
})
