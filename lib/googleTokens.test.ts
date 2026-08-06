import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// NO GOOGLE CREDENTIAL IS PERSISTED SERVER-SIDE (App Store PRD §3.2 / Phase A7).
//
// Guideline 5.1.1(v), verbatim: "An app may not store credentials or tokens to social networks off of
// the device and may only use such credentials or tokens to directly connect to the social network from
// the app itself while the app is in use." Whether Apple reads "social networks" as covering
// Google-as-identity-provider is UNKNOWN (PRD §6 #18) — which is exactly why the design sidesteps the
// question instead of arguing it.
//
// This is guarded rather than merely fixed because the failure is INVISIBLE. Re-adding
// `accessToken` to the `signInSocial` body is a plausible-looking one-word change; better-auth writes it
// straight into `account.accessToken` in Neon; nothing breaks, no test fails, and a live Google
// credential is at rest off-device from then on. There is no local symptom at all.
//
// Reading source is the only available oracle: the alternative is querying the owner's REAL Neon
// database, which `.claude/rules/auth.md` forbids for good reason.

const ROOT = path.join(import.meta.dirname, '..')

const codeOf = (rel: string): string =>
  readFileSync(path.join(ROOT, rel), 'utf8')
    // Comments stripped FIRST — this file's own explanatory comments name `accessToken` and
    // `access_type=offline` repeatedly, and a naive `includes()` would be satisfied by the prose that
    // explains the fix and stay green after the fix itself was reverted.
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

test('the Google authorization request asks for access_type=online, so no refresh token is ever issued', () => {
  // Google only returns a refresh token for `access_type=offline`. Online means there is nothing to
  // store, which is a stronger position than storing-and-deleting.
  const code = codeOf('lib/auth-family-plugin.ts')
  assert.match(code, /searchParams\.set\('access_type', 'online'\)/)
  assert.ok(
    !/access_type['"]?\s*,\s*['"]offline/.test(code),
    'the OAuth flow requests offline access — Google will then issue a refresh token',
  )
  assert.ok(!/prompt['"]?\s*,\s*['"]consent/.test(code), 'prompt=consent is the other way to be handed one')
})

test('nothing in the server graph ever names a refresh token', () => {
  for (const file of ['lib/auth-family-plugin.ts', 'lib/auth.ts']) {
    const code = codeOf(file)
    assert.ok(!/refreshToken|refresh_token/.test(code), `${file} handles a refresh token`)
  }
})

test('signInSocial is handed the ID TOKEN ONLY — no accessToken alongside it', () => {
  // THE load-bearing assertion. better-auth's idToken sign-in path passes `idToken.accessToken` into
  // `handleOAuthUserInfo` as `account.accessToken` and persists it. Google's own `getUserInfo` decodes
  // the ID token and never reads the access token, so passing it bought nothing.
  const code = codeOf('lib/auth-family-plugin.ts')
  const call = code.match(/signInSocial\(\{[\s\S]*?\}\)/)
  assert.ok(call, 'could not find the signInSocial call — did it move? re-point this guard')
  assert.match(call[0], /idToken:\s*\{\s*token:\s*idToken\s*\}/, 'the idToken body has grown a field')
  assert.ok(!/accessToken/.test(call[0]), 'a Google access token is being handed to better-auth to store')
})

test('the token-exchange response is not destructured for an access token', () => {
  // The upstream half: if `access_token` is captured from Google's response it will find its way back
  // into the call above sooner or later. Not capturing it is the durable form.
  const code = codeOf('lib/auth-family-plugin.ts')
  assert.ok(
    !/access_token\??:/.test(code),
    'the Google token-exchange response type still declares access_token',
  )
  assert.ok(!/body\.access_token/.test(code), 'the Google access token is being read out of the response')
})
