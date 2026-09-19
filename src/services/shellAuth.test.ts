// The two auth changes the native shell forces (App Store PRD §3.3 — Phase B5, B6).
//
// Both are CERTAIN, not speculative, and both are invisible from the web deployment: the code that
// breaks is code that works perfectly at the production origin (`https://boernelaering.dk`) and fails at
// `capacitor://localhost`. Nothing in a build, a lint or a browser harness on Windows can see either,
// which is why they are pinned by reading source.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

// These are read from SOURCE rather than imported. The client graph is extensionless, i.e.
// browser-only, and converting a chain of unrelated files to make one predicate importable would be
// churn for no coverage. What actually breaks here is the WIRING — which branch is reached first, and
// whether a button is still rendered — and that is only visible in the source.
const SRC = path.join(import.meta.dirname, '..')

/** Comments stripped: every assertion below would otherwise pass on the prose explaining the fix. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

// ---- B5: Google OAuth never runs in the app's own webview ----------------------------------------

test('the shell opens the authorize URL in the SYSTEM browser, before any location.assign', () => {
  // Google's OAuth policy blocks embedded webviews and names WKWebView; the failure is a 403
  // (`disallowed_useragent`) with no client-side workaround. The web path keeps `location.assign` — so
  // what matters is that the shell branch RETURNS before reaching it. A guard that merely checks both
  // strings are present would pass with the branch below the navigation, i.e. with the bug intact.
  const code = codeOf('services/googleSignIn.ts')
  const shellAt = code.indexOf('isNativeShell()')
  const assignAt = code.indexOf('window.location.assign')
  assert.ok(shellAt > 0, 'googleSignIn.ts never asks whether it is in the shell')
  assert.ok(assignAt > 0, 'the web path lost its location.assign')
  assert.ok(shellAt < assignAt, 'the shell branch sits AFTER the webview navigation it must prevent')
  assert.match(code, /openExternalAuthUrl\(/, 'the shell branch does not use the system browser')
  // And it must not fall through into the webview navigation when the branch is taken.
  const between = code.slice(shellAt, assignAt)
  assert.match(between, /return\s*\{\s*ok:\s*true\s*\}/, 'the shell branch does not return')
})

test('a system browser that will not open fails LOUDLY, in Danish', () => {
  // The silent dead end is the shape this repo has been burned by twice (OAuthReturnHandler's poll
  // give-up). A shell build whose Browser plugin is missing must not leave the adult on a spinner.
  const code = codeOf('services/googleSignIn.ts')
  assert.match(code, /shell-browser-unavailable/, 'the open-failure is not reported')
  // Anchored to the BRANCH, not to a bare string. The message became provider-aware when Sign in with
  // Apple landed (`Kunne ikke åbne ${providerLabel}-login`), and a guard pinned to the old literal
  // `Kunne ikke åbne Google-login` failed on a change that kept every property it exists to protect.
  // Tying the Danish to `shell-browser-unavailable` is what actually proves this branch still speaks.
  assert.match(
    code,
    /shell-browser-unavailable[\s\S]{0,200}Kunne ikke åbne/,
    'no Danish message on the open-failure',
  )
  assert.match(code, /clearPendingFlow\(\)[\s\S]{0,200}shell-browser-unavailable/, 'the flow is not cleared')
})

test('the system browser is dismissed once the session is claimed', () => {
  // Left open, the adult stares at the return page, which — loaded in a context that never started the
  // flow — correctly shows "Vend tilbage til Børnelæring-appen" over an app that is already signed in.
  const code = codeOf('services/googleSignIn.ts')
  const closeAt = code.indexOf('closeExternalAuth()')
  const adoptAt = code.indexOf('authStore.adoptSession')
  assert.ok(closeAt > 0, 'nothing closes the system browser after a successful claim')
  assert.ok(closeAt < adoptAt, 'the browser is closed after the session is adopted, not before')
})

test('@capacitor/browser is imported DYNAMICALLY, so the web build and the tests stay clean', () => {
  // This suite is the proof: it imports the auth graph in plain Node. A static `import { Browser } from
  // '@capacitor/browser'` would make a native SDK load-bearing for the web build AND stop this file
  // loading at all. It is also why `shellBrowser.ts` answers `isNativeShell()` before importing.
  const code = codeOf('services/shellBrowser.ts')
  assert.ok(
    !/^\s*import\s+.*'@capacitor\/browser'/m.test(code),
    '@capacitor/browser is statically imported into the client auth graph',
  )
  assert.match(code, /await import\('@capacitor\/browser'\)/)
  const guardAt = code.indexOf('isNativeShell()')
  const importAt = code.indexOf("import('@capacitor/browser')")
  assert.ok(guardAt > 0 && guardAt < importAt, 'the native SDK is imported before the shell check')
})

// ---- Face ID / Touch ID is GONE, app-wide (2026-09-19) -------------------------------------------

test('no WebAuthn / passkey code survives anywhere in the client', () => {
  // The owner removed Face ID entirely on 2026-09-19 — "way too early to have this in the app" — so
  // the invariant INVERTED. The test this replaces asserted the opposite ("the WEB deployment keeps
  // passkeys \u2014 this is a shell gate, not a removal"), which is exactly why it is replaced rather than
  // deleted: a future tidy-up that re-adds a Face ID button would otherwise meet no resistance, and
  // the removal would quietly undo itself.
  //
  // Source-read, not import-read: the modules are gone, so there is nothing left to import. `git grep`
  // exits 1 on NO match, which is the passing case, so the throw is caught rather than fatal.
  let hits: string
  try {
    hits = execFileSync(
      'git',
      ['grep', '-lEi', 'passkey|webauthn|credentials\\.(create|get)', '--', 'src', 'lib', 'api', ':(exclude)*.test.ts'],
      { cwd: path.join(SRC, '..'), encoding: 'utf8' },
    ).trim()
  } catch {
    hits = ''
  }
  assert.equal(hits, '', `passkey/WebAuthn code is back in: ${hits}`)
})

test('the lock screen offers no Face ID button', () => {
  // The button is the visible half, and it could come back without the client modules \u2014 e.g. wired
  // straight to `navigator.credentials`. Assert on the SCREEN as well as on the tree above.
  const code = codeOf('components/auth/LockScreen.tsx')
  assert.ok(!/Face ID/i.test(code), 'the lock screen mentions Face ID again')
  assert.ok(!/Fingerprint/.test(code), 'the fingerprint icon is back on the lock screen')
  // \u2026and the code path it replaced still works: Google is the primary button.
  assert.match(code, /Forts\u00e6t med Google/, 'the lock screen no longer offers Google')
})

test('the adult Sikkerhed section is the code alone', () => {
  const code = codeOf('components/adult/panes/konto/SikkerhedSection.tsx')
  assert.ok(!/Face ID|Touch ID/i.test(code), 'Face ID is back in the Sikkerhed section')
  assert.match(code, /PinSetupDialog/, 'the Sikkerhed section no longer offers the code')
})
