import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Two independent guards, because either alone is worthless here:
//
//   1. NOTHING SECRET MAY BE RECORDABLE. The bug-report blob is public-by-URL, the PIN travels in a POST
//      body, the flowId is a live credential and the session token IS the account. The protection is
//      structural — the recorded fields are enums/status codes/error names, with no parameter that can
//      carry a body, a URL or an email — so the guard asserts the SHAPE, not a filter.
//   2. THE FAILURE PATHS MUST ACTUALLY CALL IT. A perfect reporter that nothing invokes is exactly the
//      hole we started with: every sign-in failure was already "handled", which is why none of them was
//      ever visible.

const src = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '')) // comments explain the rules; they must not satisfy them
    .join('\n')

test('the recorded detail shape cannot carry a secret', () => {
  const code = src('src/services/authDiagnostics.ts')
  // The only free-text field is `note`, and it is length-capped and pushed through redactText.
  assert.match(code, /note\?:\s*string/)
  assert.match(code, /redactText\(String\(detail\.note\)\)\.slice\(0,\s*\d+\)/)
  // No field may exist for the things that would leak an account: a body, a URL, an email, a token.
  for (const forbidden of ['body', 'url', 'email', 'token', 'pin', 'flowId', 'headers']) {
    assert.doesNotMatch(
      code,
      new RegExp(`\\n\\s*${forbidden}\\??:\\s`, 'i'),
      `authDiagnostics declares a "${forbidden}" field — that is a channel for a secret`,
    )
  }
})

test('uploads are capped, deduped and throttled', () => {
  const code = src('src/services/authDiagnostics.ts')
  // `google-claim` runs inside a 3s poll, so an un-throttled reporter would upload dozens of reports per
  // login attempt. All three brakes must be present.
  assert.match(code, /CAP_PER_SESSION\s*=\s*\d+/)
  assert.match(code, /sent\.includes\(signature\)/)
  assert.match(code, /MIN_INTERVAL_MS/)
  // And when sessionStorage is unavailable we must NOT report (no way to bound a loop) — same choice
  // crash reporting makes.
  assert.match(code, /catch\s*{\s*return null\s*}/)
})

test('every decisive sign-in failure reports', () => {
  // One entry per path that ends an attempt. A path missing from here is a login that fails in silence.
  const expectations: Array<[string, string[]]> = [
    ['src/services/googleSignIn.ts', [
      'localstorage-unavailable',
      'start-http-error',
      'no-authorize-url',
      'start-network-error',
      'flow-expired-or-claimed',
      'claim-http-error',
      'claim-ok-but-no-token',
    ]],
    ['src/components/auth/OAuthReturnHandler.tsx', [
      'returned-without-pending-flow',
      'poll-window-exhausted', // the 3-minute give-up that used to be entirely silent
    ]],
    ['src/services/passkeyClient.ts', [
      'options-not-prefetched',
      'verify-http-error',
      'verified-but-no-session-token',
      'webauthn-error',
    ]],
  ]
  for (const [file, reasons] of expectations) {
    const code = src(file)
    for (const reason of reasons) {
      assert.match(
        code,
        new RegExp(`reportAuthFailure\\([^)]*'${reason}'`),
        `${file} does not report "${reason}"`,
      )
    }
  }
})

test('a successful sign-in clears the trail', () => {
  // Otherwise the next failure's report carries the previous attempt's steps and reads as a longer,
  // stranger failure than it was.
  for (const file of ['src/services/googleSignIn.ts', 'src/services/passkeyClient.ts']) {
    assert.match(src(file), /resetAuthTrail\(\)/, `${file} never resets the trail on success`)
  }
})

test('the lock screen can surface the code', () => {
  // The gate is the one screen with no other way to report, so the code has to be visible right there.
  const code = src('src/components/auth/LockScreen.tsx')
  assert.match(code, /subscribeAuthReportCode/)
  assert.match(code, /authReportCode/)
  assert.match(code, /Kode:/)
})
