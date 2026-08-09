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
  assert.match(code, /CAP_PER_WINDOW\s*=\s*\d+/)
  assert.match(code, /sent\.some\(\(e\) => e\.sig === signature\)/)
  assert.match(code, /MIN_INTERVAL_MS/)
  // And when sessionStorage is unavailable we must NOT report (no way to bound a loop) — same choice
  // crash reporting makes.
  assert.match(code, /catch\s*{\s*return null\s*}/)
})

test('the cap is a ROLLING WINDOW, because the shell page never reloads', () => {
  // A per-SESSION cap is a per-page-load cap, and in the native shell there is exactly one page load per
  // app launch. Three reports then had to cover an entire evening of failed attempts, silently, with
  // nothing to say anything had been dropped (sign-in reliability PRD RC6). On the web the OAuth round
  // trip unloads the page, which is why this was invisible everywhere it was tested.
  const code = src('src/services/authDiagnostics.ts')
  assert.match(code, /CAP_WINDOW_MS\s*=\s*10 \* 60 \* 1000/, 'the window must be a real duration')
  // Entries must carry a TIMESTAMP and be filtered by it — a length check over an ever-growing array is
  // the same permanent cap wearing a different name.
  assert.match(code, /now - e\.at < CAP_WINDOW_MS/, 'expired entries are never dropped, so it cannot roll')
  assert.match(code, /sent\.push\(\{ sig: signature, at: now \}\)/)
  // The pre-W6 storage shape was a bare array of strings. It must not be read as "already sent, just
  // now" — a device mid-upgrade would then start muted for ten minutes.
  assert.match(code, /typeof e === 'string'\) return null/, 'the legacy shape is not handled')
})

test('a report says WHERE it came from — provider, runtime, tier and backend', () => {
  // The four things nobody could answer about report 8AE9T. It was attributed to the native shell only
  // because its captured network URLs happened to be absolute, which is an accident of `apiUrl()`, not
  // a recorded fact; and no report named its provider at all, so a Google fault and an Apple fault were
  // indistinguishable in the listing.
  const code = src('src/services/authDiagnostics.ts')
  for (const field of ['provider', 'runtimeTarget', 'tier', 'apiOrigin']) {
    assert.match(
      code,
      new RegExp(`${field}:\\s*\\S`),
      `the auth report carries no ${field} — the next failure is as unattributable as the last`,
    )
  }
  // The backend is READ, never derived from the tier flag: a build whose flag and host disagree is
  // precisely the one worth catching, and it is the same argument the backend badge is built on.
  assert.match(code, /apiOrigin:\s*effectiveBackend\(\)/)
  assert.doesNotMatch(code, /apiOrigin:\s*BL_TIER/)
})

test('every sign-in report from the client names its provider', () => {
  // The `google-*` STAGE names are historical and stay: they are stable enum values in every stored
  // report and in the `stage|reason` dedupe keys, and both providers ride the same code path. So the
  // stage can never answer "which provider", and the field has to be passed at each call site.
  const code = src('src/services/googleSignIn.ts')
  const calls = [...code.matchAll(/report(AuthFailure|OauthFailure)\(/g)]
  assert.ok(calls.length >= 7, `only found ${calls.length} report call sites — this guard went vacuous`)
  for (const m of calls) {
    // A window to the call's own closing paren, so a neighbouring call cannot satisfy this one.
    const window = code.slice(m.index!, code.indexOf(')', m.index!) + 1)
    assert.match(window, /\bprovider\b/, `a client report carries no provider: ${window}`)
  }
  // And the provider must survive the page unload — on the web the claim runs in a lifetime that never
  // saw the start, so a module variable would be `undefined` for every claim-side report.
  assert.match(
    code,
    /const provider = readPendingFlow\(\)\?\.provider/,
    'the claim reads the provider from somewhere that does not survive a reload',
  )
  assert.match(
    src('src/services/authSignIn.ts'),
    /provider\?:\s*SignInProvider/,
    'the pending flow record cannot carry a provider',
  )
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
