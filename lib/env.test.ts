// Environment resolution, and the one assertion the PRD calls out explicitly: the dev bypass must be
// IMPOSSIBLE once VERCEL is set (accounts PRD §4.9).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { allowedEmails, baseURL, devBypassEnabled, isEmailAllowed, runtime, webauthn } from './env.ts'

const KEYS = [
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'BETTER_AUTH_URL',
  'AUTH_DEV_BYPASS',
  'AUTH_ALLOWED_EMAILS',
  'WEBAUTHN_RP_ID',
  'WEBAUTHN_RP_NAME',
]

beforeEach(() => {
  for (const k of KEYS) delete process.env[k]
})

test('runtime: no VERCEL ⇒ dev; VERCEL_ENV production ⇒ production; anything else ⇒ preview', () => {
  assert.equal(runtime(), 'dev')
  process.env.VERCEL = '1'
  process.env.VERCEL_ENV = 'production'
  assert.equal(runtime(), 'production')
  process.env.VERCEL_ENV = 'preview'
  assert.equal(runtime(), 'preview')
  delete process.env.VERCEL_ENV
  assert.equal(runtime(), 'preview', 'a Vercel deployment with no VERCEL_ENV is not production')
})

test('baseURL resolution order, and the dev value is the VITE port not the API port', () => {
  assert.equal(baseURL(), 'http://localhost:5173')

  process.env.VERCEL_URL = 'app-git-branch-team.vercel.app'
  assert.equal(baseURL(), 'https://app-git-branch-team.vercel.app')

  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'preschool-learning-app.vercel.app'
  assert.equal(baseURL(), 'https://preschool-learning-app.vercel.app')

  process.env.BETTER_AUTH_URL = 'https://explicit.example/'
  assert.equal(baseURL(), 'https://explicit.example', 'an explicit value wins, trailing slash trimmed')
})

test('THE DEV BYPASS IS IMPOSSIBLE ONCE VERCEL IS SET', () => {
  process.env.AUTH_DEV_BYPASS = '1'
  assert.equal(devBypassEnabled(), true, 'it should work locally')

  process.env.VERCEL = '1'
  assert.equal(devBypassEnabled(), false, 'a preview deployment must never honour it')
  process.env.VERCEL_ENV = 'production'
  assert.equal(devBypassEnabled(), false, 'and production certainly must not')
})

test('the dev bypass needs the exact flag value, not just any truthy string', () => {
  for (const v of ['0', 'true', 'yes', '']) {
    process.env.AUTH_DEV_BYPASS = v
    assert.equal(devBypassEnabled(), false, `AUTH_DEV_BYPASS=${JSON.stringify(v)}`)
  }
  process.env.AUTH_DEV_BYPASS = '1'
  assert.equal(devBypassEnabled(), true)
})

test('the allowlist FAILS CLOSED when unset — better nobody can sign up than everybody', () => {
  assert.deepEqual(allowedEmails(), [])
  assert.equal(isEmailAllowed('anyone@example.com'), false)
  assert.equal(isEmailAllowed(''), false)
  assert.equal(isEmailAllowed(null), false)
})

test('the allowlist is case- and whitespace-insensitive and comma-separated', () => {
  process.env.AUTH_ALLOWED_EMAILS = ' Allanvraa@Gmail.com , second@example.com '
  assert.deepEqual(allowedEmails(), ['allanvraa@gmail.com', 'second@example.com'])
  assert.equal(isEmailAllowed('allanvraa@gmail.com'), true)
  assert.equal(isEmailAllowed('ALLANVRAA@GMAIL.COM'), true)
  assert.equal(isEmailAllowed(' second@example.com'), true)
  assert.equal(isEmailAllowed('stranger@example.com'), false)
})

test('passkeys are DISABLED on preview: vercel.app is on the Public Suffix List (§9)', () => {
  process.env.WEBAUTHN_RP_ID = 'preschool-learning-app.vercel.app'
  process.env.VERCEL = '1'
  process.env.VERCEL_ENV = 'preview'
  process.env.VERCEL_URL = 'app-git-branch-team.vercel.app'
  assert.equal(webauthn().enabled, false)

  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'preschool-learning-app.vercel.app'
  const prod = webauthn()
  assert.equal(prod.enabled, true)
  assert.equal(prod.rpID, 'preschool-learning-app.vercel.app')
  // `origins` stays an ARRAY so a custom domain later is a config change, not a code change.
  assert.ok(Array.isArray(prod.origins))
  assert.deepEqual(prod.origins, ['https://preschool-learning-app.vercel.app'])
})

test('webauthn in dev defaults to localhost and accepts the Vite origin', () => {
  const dev = webauthn()
  assert.equal(dev.enabled, true)
  assert.equal(dev.rpID, 'localhost')
  assert.ok(dev.origins.includes('http://localhost:5173'))
  assert.equal(dev.rpName, 'Børnelæring')
})

test('webauthn is disabled when no RP ID can be resolved on a deployment', () => {
  process.env.VERCEL = '1'
  process.env.VERCEL_ENV = 'production'
  assert.equal(webauthn().enabled, false)
})
