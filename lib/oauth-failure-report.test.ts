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
  ]
  for (const reason of reasons) {
    assert.match(callback, new RegExp(`reportOauthFailure\\('${reason}'`), `no report for "${reason}"`)
  }
  // The refused-sign-in branch reports under a reason CHOSEN at runtime (`no-session-token-after-signin`
  // for a header-less 200, `signin-rejected` for everything else — see oauthSigninOutcome.test.ts), so it
  // is matched by its variable rather than by a literal.
  assert.match(callback, /reportOauthFailure\(reason,/, 'the refused-sign-in branch stopped reporting')
  // Each of those four must also RENDER its code — a stored report nobody can quote is no better than no
  // report, since the adult is the only channel back to us.
  //
  // Tied to the REASON, not counted across the file. Two weaker forms failed their own re-break: a regex
  // for `failureHtml(…, code)` missed the call that wraps across lines with a trailing comma (3 of 4), and
  // counting call sites whose next 260 chars mention `code` stayed GREEN when a page stopped passing it,
  // because the window spilled into neighbouring code that happens to use the same identifier.
  for (const reason of [...reasons, 'reason']) {
    const at = callback.indexOf(
      reason === 'reason' ? 'reportOauthFailure(reason,' : `reportOauthFailure('${reason}'`,
    )
    const branch = callback.slice(at, at + 400)
    // `failFlow` since W3 — it stamps the row AND renders the page, so the polling app and the browser
    // both learn the outcome. `failureHtml` is still accepted for a branch with no row to stamp.
    assert.match(branch, /fail(Flow|ureHtml)\(/, `"${reason}" reports but renders no page`)
    assert.match(
      branch,
      /fail(Flow|ureHtml)\([^;]*\bcode\b/,
      `"${reason}" stores a report but does not print its code — the adult cannot quote it`,
    )
  }
})

test('a failed callback STAMPS the flow row, or the app polls a corpse', () => {
  // RC3, and the two orphan rows in staging that proved it: `completeOauthCallback` returned a page
  // without touching the row, so `state` stayed `used:…` and `sessionToken` stayed NULL — byte-for-byte
  // what a flow still sitting on the consent screen looks like. `/oauth/claim` therefore answered
  // `{status:'pending'}` for 220 seconds until the client's own timer gave up (report 8AE9T).
  const fn = code.slice(code.indexOf('async function failFlow'), code.indexOf('export const familyPlugin'))
  assert.match(fn, /failureCode:/, 'failFlow must record the code')
  assert.match(fn, /failedAt:/, 'failFlow must record WHEN — it is what the claim endpoint reads')
  assert.match(fn, /failureMessage:/, 'the Danish sentence is stored so page and app say the same thing')

  // And the claim must READ it. `{status:'pending'}` for a dead flow is the whole bug.
  const claim = code.slice(code.indexOf('familyOauthClaim'), code.indexOf('async function completeOauthCallback'))
  const gone = claim.indexOf('row.failedAt')
  assert.ok(gone > 0, 'the claim endpoint no longer checks failedAt')
  assert.ok(
    gone < claim.indexOf('!row.sessionToken'),
    'the failed-flow check must come BEFORE the pending answer, or a dead flow still reads as pending',
  )
  assert.match(claim.slice(gone, gone + 320), /GONE/, 'a failed flow must answer 410, which the client already treats as decisive')
  assert.match(claim.slice(gone, gone + 320), /row\.failureCode/, 'the 410 must carry the Fejlkode')
})

test('the shell never gets a link that navigates the SHEET', () => {
  // `<a href="/">` is root-relative, so in SFSafariViewController it loads the whole web app INSIDE the
  // sheet instead of returning to the native app — the owner tapped "Tilbage til Børnelæring" and got
  // Børnelæring, in the sheet, still signed out. Same for the success 302, which boots the app in a
  // context holding no flowId and renders "Du er allerede logget ind".
  const fn = code.slice(code.indexOf('function failureHtml'), code.indexOf('function emailDomainOf'))
  // BOTH shell values. A `shell-scheme` binary gets the custom-scheme redirect on success but still
  // renders this page on failure, so a `=== 'shell'` test here would hand it the link again.
  assert.match(fn, /isShell\(client\)/, 'the failure page must branch on the flow row’s client')
  const shellBranch = fn.slice(fn.indexOf('isShell(client)'))
  const shellCopy = shellBranch.slice(0, shellBranch.indexOf(':'))
  assert.doesNotMatch(shellCopy, /<a\s/i, 'the shell branch must not render a link')
  assert.match(shellCopy, /Luk dette vindue/, 'say the true thing instead: close the window')

  const success = code.slice(code.indexOf('const returnToApp'), code.indexOf('const pageShell'))
  assert.match(success, /client === 'shell'/, 'a shell flow must not be 302’d into the web app')
  // The WEB redirect is the last resort, after both shell branches. Anchored on the web redirect's own
  // target rather than on `status: 302`, which the scheme branch legitimately uses too.
  assert.ok(
    success.indexOf("client === 'shell'") < success.indexOf('location: RETURN_URL'),
    'the shell branch must return BEFORE the web redirect',
  )
  // And a scheme redirect may only ever go to the SERVER's table, never to anything off the request.
  assert.match(success, /returnSchemeUrl\(tier\(\)\)/, 'the scheme must come from the tier-keyed table')
  assert.doesNotMatch(success, /row\.|input\./, 'the redirect target must not be read off the request')
})

test('a forbidden account is NOT reported as a fault', () => {
  // The allowlist refusal is the system WORKING, and it already says exactly what is wrong. Reporting it
  // would bury real faults under the one message that needs no investigation.
  assert.match(callback, /forbidden\s*\n?\s*\?\s*null/, 'the forbidden branch should pass a null code')
  // And the branch that is now actually REACHABLE (W2 — it used to be a dead `catch` for an APIError
  // that `asResponse` never threw) must reach `failFlow` with no `code:` key at all.
  const at = callback.indexOf("verdict.kind === 'forbidden'")
  assert.ok(at > 0, 'the forbidden verdict branch moved — re-anchor this guard')
  // SLICE TO THE BRANCH'S REAL CLOSING BRACE, not to the first `})`. The `console.warn` above the return
  // ends `${domain ?? 'unknown'})`, so a `indexOf('})')` window stopped there and this guard passed
  // against a branch that DID file a report — found by re-breaking it.
  const end = callback.indexOf('\n    }', at)
  assert.ok(end > at, 'could not find the end of the forbidden branch — re-anchor this guard')
  const branch = callback.slice(at, end)
  assert.match(branch, /failFlow\(/, 'a forbidden refusal must still stamp the flow, or the app polls on')
  assert.doesNotMatch(branch, /\bcode:/, 'a working refusal needs no Fejlkode')
  assert.doesNotMatch(branch, /reportOauthFailure/, 'and no report')
})

test('the refusal names the address’s DOMAIN, never the address', () => {
  // The one question a refused Apple sign-in leaves open is `gmail.com` vs `privaterelay.appleid.com` —
  // wrong account vs Hide My Email — and nothing in the database can answer it, because no Apple account
  // row has ever been created. A domain is not the address; the charset test and escapeHtml are what
  // keep it that way.
  const fn = code.slice(code.indexOf('function emailDomainOf'), code.indexOf('const forbiddenMessage'))
  assert.match(fn, /lastIndexOf\('@'\)/, 'take everything after the LAST @, or a quoted local part fools it')
  assert.match(fn, /slice\(at \+ 1\)/, 'the local part must never survive')
  assert.doesNotMatch(fn, /console\.(log|warn|error)\(\s*email/, 'the address itself may not be logged')
})

test('provider error detail goes in the REPORT, never in the page', () => {
  // The provider's error text can echo request material and this page is rendered to whoever holds the
  // callback URL, while report reads are fail-closed behind BUG_REPORT_READ_KEY. So the split has to
  // hold: the page renders a message plus a code, and nothing derived from the provider's body.
  assert.match(callback, /providerError:\s*body\.error/, 'the provider error is not carried into the report')
  const pageCalls = [
    ...callback.matchAll(/failureHtml\(([^)]*)\)/g),
    ...callback.matchAll(/failFlow\(adapter, row, \{([^}]*)\}/g),
  ].map((m) => m[1])
  assert.ok(pageCalls.length >= 6, `only found ${pageCalls.length} page calls — this guard went vacuous`)
  for (const args of pageCalls) {
    assert.doesNotMatch(
      args,
      /body\.error|tokenRes|outcome\.message|sessionToken/,
      `a page renders provider detail: ${args}`,
    )
  }
})

test('every report names its provider', () => {
  // Three staging reports said `no-session-token-after-signin` and not one of them said whether it was
  // Google or Apple — the single most useful bit, and the reason the two failures looked like one.
  // A window rather than brace-matching: the arguments contain template literals whose `${…}` closes a
  // naive `[^}]*` in the wrong place, and that made an earlier form of this guard fail on its own code.
  const calls = [...code.matchAll(/reportOauthFailure\((?:'[a-z-]+'|reason),/g)]
  assert.ok(calls.length >= 4, `only found ${calls.length} report call sites — this guard went vacuous`)
  for (const m of calls) {
    const window = code.slice(m.index!, m.index! + 120)
    assert.match(window, /^[^)]*\bprovider,/s, `a reportOauthFailure call carries no provider: ${window}`)
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

test('the Apple callback accepts the form POST Apple actually sends', () => {
  // better-auth configures its router with `allowedMediaTypes: ["application/json"]`, and better-call
  // enforces that in the ROUTER, before the endpoint's own body schema is consulted. Apple's
  // `response_mode=form_post` is `application/x-www-form-urlencoded`, so without a per-endpoint
  // override Apple sign-in is a raw 415 JSON blob in the browser — measured on production and staging,
  // 2026-08-08. Read from the STRIPPED source, so the rationale comment cannot satisfy this.
  const apple = code.slice(code.indexOf('familyOauthCallbackApple'))
  const options = apple.slice(0, apple.indexOf('async (ctx)'))
  assert.match(
    options,
    /allowedMediaTypes:\s*\[[^\]]*'application\/x-www-form-urlencoded'/,
    'the Apple callback must declare metadata.allowedMediaTypes, or the router 415s the form POST',
  )
})

test('storing a report can never break the response', () => {
  // A diagnostic that turns a handled error into a 500 is worse than no diagnostic.
  const fn = code.slice(code.indexOf('async function reportOauthFailure'), code.indexOf('export const familyPlugin'))
  assert.match(fn, /catch\s*{\s*return null\s*}/, 'reportOauthFailure must swallow its own failures')
  assert.match(fn, /if \(!res\.ok\) return null/)
})
