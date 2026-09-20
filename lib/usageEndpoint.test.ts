import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source guards for the anonymous usage counter.
//
// `api/**` is not in the `npm test` glob, so this lives in `lib/` — the same reason
// `lib/serverImports.test.ts` checks `api/` from here.
//
// WHAT THESE DEFEND. `docs/usage-analytics.md` claims the counter is anonymous BY CONSTRUCTION: no
// column holds a person, nothing identifying is transmitted, and the increment cannot be chosen by
// the caller. That claim is what keeps the feature outside GDPR (Recital 26) and inside Apple's Kids
// Category rules, and it is repeated in the shipped privacy policy. A future edit that adds a
// profile id "just for debugging" would silently falsify all three. These tests are the mechanical
// version of that promise.

const endpoint = readFileSync(new URL('../api/usage.ts', import.meta.url), 'utf8')
const service = readFileSync(new URL('../src/services/usagePing.ts', import.meta.url), 'utf8')

/**
 * COMMENTS MUST GO FIRST. Both files discuss IP addresses and identifiers at length, precisely
 * because they must not store them — so a naive grep matches the prose that explains the rule and
 * passes forever regardless of the code. A guard that greps source is worthless until it strips
 * what it is not judging.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const endpointCode = code(endpoint)
const serviceCode = code(service)

test('comment stripping actually works — BOTH forms', () => {
  // If either stripper regressed to a no-op, every assertion below would be vacuous for the comment
  // form it no longer handles. Caught by the re-break pass: the first version of this test used a
  // fixture that lives in a `//` comment to prove `/* */` stripping, so disabling the block-comment
  // regex left the suite green. One fixture per form, and each must come from the form it tests.
  const LINE_FIXTURE = 'WHAT IS HONESTLY NOT SOLVED' // in a `//` header comment
  const BLOCK_FIXTURE = 'DDL on demand rather than a migration script' // in a `/** */` block

  assert.ok(endpoint.includes(LINE_FIXTURE), 'line-comment fixture vanished from api/usage.ts')
  assert.ok(endpoint.includes(BLOCK_FIXTURE), 'block-comment fixture vanished from api/usage.ts')
  assert.ok(!endpointCode.includes(LINE_FIXTURE), 'line comments were not stripped')
  assert.ok(!endpointCode.includes(BLOCK_FIXTURE), 'block comments were not stripped')
  assert.ok(!serviceCode.includes('FIRE AND FORGET, ALWAYS'), 'line comments were not stripped')
})

test('the endpoint never touches an identifier', () => {
  // `clientIp` is the sharp one: `rateLimit` uses it INTERNALLY for its in-memory bucket, which is
  // fine, but this file calling it would mean an IP is in scope here and one line from being stored.
  for (const forbidden of [
    'clientIp',
    'x-forwarded-for',
    'profileId',
    'userId',
    'deviceId',
    'sessionId',
    'ipAddress',
    'userAgent',
    'user-agent',
  ]) {
    const re = new RegExp(`\\b${forbidden.replace(/[-]/g, '[-]')}\\b`)
    assert.ok(!re.test(endpointCode), `api/usage.ts references ${forbidden}`)
  }
})

test('the client sends only the events and the version', () => {
  const body = /JSON\.stringify\(\{([^}]*)\}\)/.exec(serviceCode)
  assert.ok(body, 'could not find the request body in usagePing.ts')
  const keys = body![1]
    .split(',')
    .map((k) => k.split(':')[0].trim())
    .filter(Boolean)
  assert.deepEqual(keys.sort(), ['appVersion', 'events'], `body carries unexpected keys: ${keys}`)
})

test('the client never persists the batch — it would re-trigger ePrivacy 5(3)', () => {
  // The buffer is the one part of this feature that COULD legally have been written to the device,
  // and doing so would be "storing information on terminal equipment" for a non-essential purpose:
  // consent required, and the consent-free basis in docs/usage-analytics.md gone. Losing a buffer on
  // a hard kill is the accepted price, which is also why `app_open` is not in it.
  for (const store of ['localStorage', 'sessionStorage', 'indexedDB', 'document\\.cookie']) {
    assert.ok(
      !new RegExp(store).test(serviceCode),
      `usagePing.ts persists the batch via ${store.replace('\\', '')}`,
    )
  }
})

test('the client never inspects the response', () => {
  // Owner requirement, 2026-09-18: nothing about a usage ping may reach the UI. Because every path in
  // `usagePing.ts` is caught, reading the response cannot produce an OBSERVABLE failure — a behavioural
  // test for this is vacuous, which the re-break pass demonstrated. So the invariant is pinned here, on
  // the source, where it is real: the module fires and forgets, and never branches on what came back.
  for (const forbidden of ['\\.ok\\b', '\\.json\\(', '\\.status\\b', '\\.text\\(', '\\.headers\\b']) {
    assert.ok(
      !new RegExp(forbidden).test(serviceCode),
      `usagePing.ts inspects the response (${forbidden})`,
    )
  }
})

test('the client addresses the API through apiUrl()', () => {
  // A bare '/api/usage' is answered by the app BUNDLE inside the native shell — 200, index.html, no
  // error, and the ping silently never reaches a server. See src/config/apiBase.ts.
  assert.match(serviceCode, /fetch\(\s*apiUrl\(/, 'usagePing must fetch through apiUrl()')
  assert.ok(!/fetch\(\s*['"`]\//.test(serviceCode), 'usagePing fetches a bare absolute path')
})

test('the increment is counted by the SERVER, never taken from the request', () => {
  // Batching made this the sharpest guard in the file. The request carries event NAMES; the server
  // tallies them. A `{event, count}` shape would hand the caller the increment directly, so a single
  // poisoned request could add 999999 instead of at most MAX_EVENTS_PER_REQUEST.
  assert.match(endpointCode, /DO UPDATE SET n = usage_counter\.n \+ EXCLUDED\.n/)
  // The counts passed to the query must come from our own Map, not from the body.
  assert.match(endpointCode, /counts\.set\([^)]*\(counts\.get\([^)]*\)\s*\?\?\s*0\)\s*\+\s*1\)/,
    'the endpoint does not tally the events itself')
  assert.match(endpointCode, /\[\.\.\.counts\.values\(\)\]/, 'the query does not use the server tally')
  // And nothing anywhere reads a count off the request.
  assert.ok(!/body\.(count|n)\b/.test(endpointCode), 'the endpoint reads a count from the body')
})

test('the batch is bounded by the shared cap', () => {
  // The third dimension of a poisoned request: the allow-list caps WHICH rows exist, the rate limit
  // caps how many requests arrive, and this caps how much one request can add.
  assert.match(endpointCode, /slice\(0,\s*MAX_EVENTS_PER_REQUEST\)/, 'the event array is unbounded')
  const shared = readFileSync(new URL('../src/config/usageEvents.ts', import.meta.url), 'utf8')
  assert.match(shared, /export const MAX_EVENTS_PER_REQUEST\s*=\s*\d+/, 'the cap is not shared')
})

test('the INSERT is parameterised', () => {
  const insert = /INSERT INTO usage_counter[\s\S]*?`/.exec(endpointCode)
  assert.ok(insert, 'could not find the INSERT')
  assert.ok(insert![0].includes('$1') && insert![0].includes('$2'), 'INSERT is not parameterised')
  assert.ok(!/\$\{/.test(insert![0]), 'INSERT interpolates a template expression')
})

test('the table has no column that could hold a person', () => {
  const ddl = /CREATE TABLE IF NOT EXISTS usage_counter\s*\(([\s\S]*?)\)\s*`/.exec(endpointCode)
  assert.ok(ddl, 'could not find the CREATE TABLE')
  const columns = ddl![1]
    .split('\n')
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((c) => c && c !== 'PRIMARY')
  assert.deepEqual(columns.sort(), ['app_version', 'day', 'event', 'n'])
})

test('the endpoint applies the shared trust-boundary helpers', () => {
  for (const helper of ['applyCors', 'isAllowedOrigin', 'rateLimit']) {
    assert.ok(endpointCode.includes(helper), `api/usage.ts does not call ${helper}`)
  }
  assert.match(endpointCode, /req\.method !== 'POST'[\s\S]{0,80}405/, 'non-POST is not refused')
})

test('the dev server mirrors the endpoint', () => {
  // An endpoint that only exists on Vercel cannot be tested before it is deployed.
  const dev = readFileSync(new URL('../dev-server.js', import.meta.url), 'utf8')
  assert.match(dev, /app\.post\('\/api\/usage'/, 'dev-server.js has no /api/usage mirror')
  assert.match(dev, /ON CONFLICT \(day, event, app_version\)/, 'the dev mirror does not increment')
})
