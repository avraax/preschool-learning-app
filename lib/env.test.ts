// Environment resolution, and the one assertion the PRD calls out explicitly: the dev bypass must be
// IMPOSSIBLE once VERCEL is set (accounts PRD §4.9).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  allowedEmails,
  assertTierMatchesBaseURL,
  baseURL,
  devBypassEnabled,
  fakeProviderEnabled,
  isEmailAllowed,
  runtime,
  tier,
  tierMatchesBaseURL,
  webauthn,
} from './env.ts'

const KEYS = [
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'BETTER_AUTH_URL',
  'AUTH_DEV_BYPASS',
  'AUTH_FAKE_PROVIDER',
  'AUTH_ALLOWED_EMAILS',
  'WEBAUTHN_RP_ID',
  'WEBAUTHN_RP_NAME',
  'BL_TIER',
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

// ---- Staging PRD W4: the tier, and the cross-check that throws ------------------------------------

test('the tier DEFAULTS to production, and an unrecognised value defaults there too', () => {
  assert.equal(tier(), 'production', 'an unset BL_TIER must not be staging')
  process.env.BL_TIER = 'staging'
  assert.equal(tier(), 'staging')
  process.env.BL_TIER = ' staging '
  assert.equal(tier(), 'staging', 'the value is trimmed, as every other env read here is')
  for (const v of ['Staging', 'STAGING', 'stage', 'prod', 'true', '1', '']) {
    process.env.BL_TIER = v
    assert.equal(tier(), 'production', `BL_TIER=${JSON.stringify(v)} must fall back to production`)
  }
})

test('each tier accepts ONLY its own origins', () => {
  // Production's real host, and the .vercel.app fallback that installed shells still call.
  assert.equal(tierMatchesBaseURL('production', 'https://boernelaering.dk', 'production'), true)
  assert.equal(
    tierMatchesBaseURL('production', 'https://preschool-learning-app.vercel.app', 'production'),
    true,
  )
  assert.equal(tierMatchesBaseURL('staging', 'https://staging.boernelaering.dk', 'production'), true)

  // THE TWO THAT MUST THROW — a half-applied tier, in both directions.
  assert.equal(
    tierMatchesBaseURL('production', 'https://staging.boernelaering.dk', 'production'),
    false,
    'a production tier serving on the staging host would write children to the wrong database',
  )
  assert.equal(
    tierMatchesBaseURL('staging', 'https://boernelaering.dk', 'production'),
    false,
    'a staging tier serving on the PRODUCTION host is the worst case of all',
  )
  // Staging has no .vercel.app fallback by design (PRD §9.5).
  assert.equal(
    tierMatchesBaseURL('staging', 'https://preschool-learning-app.vercel.app', 'production'),
    false,
  )
  // Near-misses on the production host, in the same spirit as the client-side check.
  for (const near of ['https://www.boernelaering.dk', 'http://boernelaering.dk', 'https://boernelaering.dk.evil.test']) {
    assert.equal(tierMatchesBaseURL('production', near, 'production'), false, `${near} was accepted`)
  }
})

test('localhost is production-legal only in DEV, and staging-legal anywhere', () => {
  // Local development IS the staging tier (PRD §4.1), served by Vite on 5173.
  for (const local of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
    assert.equal(tierMatchesBaseURL('staging', local, 'dev'), true)
    assert.equal(tierMatchesBaseURL('production', local, 'dev'), true, 'a plain local run is fine')
  }
  // On a real DEPLOYMENT a localhost baseURL is a misconfiguration, not a local run.
  assert.equal(
    tierMatchesBaseURL('production', 'http://localhost:5173', 'production'),
    false,
    'a deployed production function must never resolve its own base to localhost',
  )
})

test('PREVIEW deployments are exempt, and that exemption is deliberate', () => {
  // A preview's baseURL is a per-deployment *.vercel.app host no fixed tuple can name, so the check
  // could only produce false failures — and it buys nothing, because a preview inherits its OWN
  // project's DATABASE_URL and BL_TIER together and therefore cannot cross the tiers.
  assert.equal(tierMatchesBaseURL('staging', 'https://app-git-x-team.vercel.app', 'preview'), true)
  assert.equal(tierMatchesBaseURL('production', 'https://app-git-x-team.vercel.app', 'preview'), true)
})

test('the assertion actually THROWS on a mismatch, and names both halves', () => {
  // The pure predicate above is only useful if something calls it. This is the module-init guard.
  process.env.VERCEL = '1'
  process.env.VERCEL_ENV = 'production'
  process.env.BETTER_AUTH_URL = 'https://boernelaering.dk'

  process.env.BL_TIER = 'production'
  assert.doesNotThrow(() => assertTierMatchesBaseURL(), 'the REAL production pairing must not throw')

  process.env.BL_TIER = 'staging'
  assert.throws(
    () => assertTierMatchesBaseURL(),
    (e: Error) =>
      /BL_TIER="staging"/.test(e.message) &&
      /boernelaering\.dk/.test(e.message) &&
      /REDEPLOY/.test(e.message),
    'the message must name the tier, the origin, and that a redeploy is required',
  )

  process.env.BETTER_AUTH_URL = 'https://staging.boernelaering.dk'
  assert.doesNotThrow(() => assertTierMatchesBaseURL(), 'the real staging pairing must not throw')
  process.env.BL_TIER = 'production'
  assert.throws(() => assertTierMatchesBaseURL(), /does not match baseURL/)
})

test('lib/env.ts CALLS the assertion at module init, not merely exports it', () => {
  // A pure predicate nothing invokes is decoration. Asserted on source because the call already ran
  // when this file imported the module — there is no way to observe it from here afterwards.
  const src = readFileSync(new URL('./env.ts', import.meta.url), 'utf8')
    .replace(/^\s*\/\*\*[\s\S]*?\*\//gm, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  assert.match(src, /^assertTierMatchesBaseURL\(\)$/m, 'the module-init call is gone')
})

test('THE DEV BYPASS IS IMPOSSIBLE ONCE VERCEL IS SET', () => {
  process.env.AUTH_DEV_BYPASS = '1'
  assert.equal(devBypassEnabled(), true, 'it should work locally')

  process.env.VERCEL = '1'
  assert.equal(devBypassEnabled(), false, 'a preview deployment must never honour it')
  process.env.VERCEL_ENV = 'production'
  assert.equal(devBypassEnabled(), false, 'and production certainly must not')
})

test('THE FAKE PROVIDER IS IMPOSSIBLE ON PRODUCTION, BY THREE SEPARATE ROUTES', () => {
  // What this switch bypasses is the identity check itself — with it on, a request chooses which address
  // it signs in as. So it is not enough that it is off by default; it must be UNREACHABLE wherever it
  // would matter, and by more than one condition, so that getting any single environment variable wrong
  // still fails closed. Same shape of proof as the dev bypass above.
  process.env.AUTH_FAKE_PROVIDER = '1'
  process.env.BL_TIER = 'staging'
  assert.equal(fakeProviderEnabled(), true, 'it should work in local development')

  // 1. The DEPLOYMENT. Note this also shuts it on the staging Vercel project, which deploys with
  //    `--prod` and therefore reports runtime() === 'production' too — deliberate, and why this is a
  //    local-only tool in practice.
  process.env.VERCEL = '1'
  process.env.VERCEL_ENV = 'production'
  assert.equal(fakeProviderEnabled(), false, 'a production deployment must never honour it')

  // 2. The TIER, independently — even on a non-production deployment.
  process.env.VERCEL_ENV = 'preview'
  process.env.BL_TIER = 'production'
  assert.equal(fakeProviderEnabled(), false, 'the production tier must never honour it')

  // 3. The FLAG, and it must be exactly '1' — the same trap the dev bypass guards against.
  process.env.BL_TIER = 'staging'
  delete process.env.VERCEL
  delete process.env.VERCEL_ENV
  for (const v of ['0', 'true', 'yes', '']) {
    process.env.AUTH_FAKE_PROVIDER = v
    assert.equal(fakeProviderEnabled(), false, `AUTH_FAKE_PROVIDER=${JSON.stringify(v)}`)
  }

  // And unset BL_TIER defaults to production (lib/env.ts's tier()), so an unconfigured process — a
  // one-off script, a misconfigured deployment — cannot turn it on by omission.
  process.env.AUTH_FAKE_PROVIDER = '1'
  delete process.env.BL_TIER
  assert.equal(fakeProviderEnabled(), false, 'an unconfigured process must fail closed')
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
