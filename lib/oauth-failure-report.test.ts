import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The OAuth callback is the ONE failure surface the client can never report from: it is a server-rendered
// page, so the SPA never boots and `authDiagnostics` cannot fire. That is exactly how two failed Google
// logins produced no data at all (owner, 2026-08-04) — the adult sees "Login mislykkedes. Prøv igen i
// appen" and there is nothing anywhere to say why.
//
// So every FAULT branch here has to store the reason and print a code. These guards hold that.

const code = readFileSync('lib/auth-family-plugin.ts', 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((line) => line.replace(/(^|\s)\/\/.*$/, '')) // the rationale is in comments; it must not satisfy the guard
  .join('\n')

// The callback body, so a match elsewhere in the file cannot stand in for one inside it.
const callback = code.slice(code.indexOf('oauth/callback'))

test('every FAULT branch of the OAuth callback reports and shows a code', () => {
  const reasons = [
    'token-exchange-rejected',
    'token-exchange-threw',
    'signin-with-id-token-failed',
    'no-session-token-after-signin',
  ]
  for (const reason of reasons) {
    assert.match(callback, new RegExp(`reportOauthFailure\\('${reason}'`), `no report for "${reason}"`)
  }
  // Each of those four must also RENDER its code — a stored report nobody can quote is no better than no
  // report, since the adult is the only channel back to us.
  //
  // Tied to the REASON, not counted across the file. Two weaker forms failed their own re-break: a regex
  // for `failureHtml(…, code)` missed the call that wraps across lines with a trailing comma (3 of 4), and
  // counting call sites whose next 260 chars mention `code` stayed GREEN when a page stopped passing it,
  // because the window spilled into neighbouring code that happens to use the same identifier.
  for (const reason of reasons) {
    const at = callback.indexOf(`reportOauthFailure('${reason}'`)
    const branch = callback.slice(at, at + 400)
    assert.match(branch, /failureHtml\(/, `"${reason}" reports but renders no page`)
    assert.match(
      branch,
      /failureHtml\([^;]*\bcode\b/,
      `"${reason}" stores a report but does not print its code — the adult cannot quote it`,
    )
  }
})

test('a forbidden account is NOT reported as a fault', () => {
  // The allowlist refusal is the system WORKING, and it already says exactly what is wrong. Reporting it
  // would bury real faults under the one message that needs no investigation.
  assert.match(callback, /forbidden\s*\n?\s*\?\s*null/, 'the forbidden branch should pass a null code')
})

test('Google error detail goes in the REPORT, never in the page', () => {
  // Google's error text can echo request material and this page is rendered to whoever holds the callback
  // URL, while report reads are fail-closed behind BUG_REPORT_READ_KEY. So the split has to hold: the
  // page renders a message plus a code, and nothing derived from Google's body.
  assert.match(callback, /googleError:\s*body\.error/, 'the google error is not carried into the report')
  const pageCalls = [...callback.matchAll(/failureHtml\(([^)]*)\)/g)].map((m) => m[1])
  for (const args of pageCalls) {
    assert.doesNotMatch(args, /body\.error|tokenRes|idToken|sessionToken/, `failureHtml renders detail: ${args}`)
  }
})

test('the failure page escapes what it interpolates and ships no script', () => {
  // Same rule as lib/server-html-csp.test.ts: vercel.json applies `script-src 'self'` to EVERY path, so a
  // scripted page is dead on arrival — and this one now interpolates a value.
  const fn = code.slice(code.indexOf('function failureHtml'), code.indexOf('const htmlResponse'))
  assert.doesNotMatch(fn, /<script/i)
  assert.match(fn, /escapeHtml\(code\)/)
  assert.match(fn, /escapeHtml\(message\)/)
})

test('storing a report can never break the response', () => {
  // A diagnostic that turns a handled error into a 500 is worse than no diagnostic.
  const fn = code.slice(code.indexOf('async function reportOauthFailure'), code.indexOf('export const familyPlugin'))
  assert.match(fn, /catch\s*{\s*return null\s*}/, 'reportOauthFailure must swallow its own failures')
  assert.match(fn, /if \(!res\.ok\) return null/)
})
