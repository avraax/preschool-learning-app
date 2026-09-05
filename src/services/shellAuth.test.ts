// The two auth changes the native shell forces (App Store PRD §3.3 — Phase B5, B6).
//
// Both are CERTAIN, not speculative, and both are invisible from the web deployment: the code that
// breaks is code that works perfectly at the production origin (`https://boernelaering.dk`) and fails at
// `capacitor://localhost`. Nothing in a build, a lint or a browser harness on Windows can see either,
// which is why they are pinned by reading source.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isNativeShell, runtimeTargetFor } from '../config/runtimeTarget.ts'

// `passkeyClient.ts` is NOT imported here. Its transitive graph (authDiagnostics → redact → …) is
// extensionless, i.e. browser-only, and converting a chain of unrelated files to make one predicate
// importable would be churn for no coverage: the predicate is `!isNativeShell()`, and `isNativeShell`
// is already exercised directly in `runtimeTarget.test.ts`. What actually breaks here is the WIRING —
// which branch is reached first, and whether the button is still rendered — and that is read from source.
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

// ---- B6: passkeys are gone inside the shell -------------------------------------------------------

test('the passkey gate is the shell check itself, not a copy of it', () => {
  // One predicate over `isNativeShell()`, so the shell is defined in exactly one place. A hand-rolled
  // second sniff (a UA test, a `window.Capacitor` probe) is what would drift out of step with
  // `capacitor.config.ts`'s `iosScheme` — which is why this asserts the composition, not the value.
  const code = codeOf('services/passkeyClient.ts')
  assert.match(
    code,
    /export function passkeysSupportedInThisBuild\(\)[\s\S]{0,120}return\s+!isNativeShell\(\)/,
    'passkeysSupportedInThisBuild does not derive from isNativeShell',
  )
  assert.ok(!/navigator\.userAgent/.test(code), 'passkeyClient sniffs the user agent for the shell')
  // The one place the shell is defined still answers as expected on both sides.
  assert.equal(runtimeTargetFor('capacitor:'), 'shell')
  assert.equal(isNativeShell(), false)
})

test('passkeysUsableHere() consults the BUILD before probing the device', () => {
  // A WKWebView on an iPad reports a platform authenticator as available — the hardware is right there
  // — so the capability probe alone answers "yes" for a build whose origin can never validate. The
  // ordering is the whole guard: ask which build first, then ask the device.
  const code = codeOf('services/passkeyClient.ts')
  const buildAt = code.indexOf('passkeysSupportedInThisBuild()', code.indexOf('passkeysUsableHere'))
  const probeAt = code.indexOf('window.PublicKeyCredential')
  assert.ok(buildAt > 0, 'passkeysUsableHere never asks which build it is in')
  assert.ok(buildAt < probeAt, 'the device probe runs before the build check')
})

test('the lock screen cannot offer Face ID inside the shell', () => {
  // `capacitor://localhost` matches neither the production rpID nor its origins list, so the sheet
  // would open and fail with a SecurityError that `danishError` renders as "Tjek at iPad'en har en
  // kode" — blaming the adult's device for our decision. The button must be ABSENT, not broken.
  const code = codeOf('components/auth/LockScreen.tsx')
  assert.match(
    code,
    /canOfferPasskey\s*=\s*[\s\S]{0,80}passkeysSupportedInThisBuild\(\)/,
    'canOfferPasskey does not consult the build',
  )
})

test('the adult surface blames the BUILD, not the iPad', () => {
  // The same iPad does Face ID in Safari. "Denne enhed understøtter ikke Face ID" is therefore false in
  // the shell, and false in a way that produces an unreproducible bug report.
  // The flat `KontoPane` became `konto/SikkerhedSection.tsx` when Barn + Konto merged into one pane
  // (Familie IA PRD, 2026-09-05). The Face ID block moved with it, branch order unchanged.
  const code = codeOf('components/adult/panes/konto/SikkerhedSection.tsx')
  assert.match(code, /!passkeysSupportedInThisBuild\(\)/, 'the Sikkerhed section has no shell branch')
  assert.match(code, /app-udgaven/, 'the shell message does not name the app edition')
  const shellBranchAt = code.indexOf('!passkeysSupportedInThisBuild()')
  const deviceBranchAt = code.indexOf('Denne enhed understøtter ikke Face ID')
  assert.ok(
    shellBranchAt > 0 && shellBranchAt < deviceBranchAt,
    'the device-unsupported message is reached before the shell branch',
  )
})

test('the WEB deployment keeps passkeys — this is a shell gate, not a removal', () => {
  // A tidy-up that reads "passkeys are dropped for v1" and deletes the client is the failure this
  // guards. They work unchanged in Safari, and the machinery has to stay for that.
  const code = codeOf('services/passkeyClient.ts')
  assert.match(code, /startAuthentication\(/, 'the passkey unlock implementation is gone')
  assert.match(code, /startRegistration\(/, 'the passkey registration implementation is gone')
  // …and it is still CALLED: the lock screen unlocks with it and the Sikkerhed section registers
  // with it. Anchored on the call, not the bare name — an `import` line alone satisfied
  // `/registerPasskey/` and `/startPasskeyUnlock/`, so both survived deleting the only invocation
  // (found by /re-break, 2026-09-05, while repointing these two at the merged Konto pane).
  assert.match(
    codeOf('components/auth/LockScreen.tsx'),
    /startPasskeyUnlock\(passkeyOptions/,
    'LockScreen imports startPasskeyUnlock but never calls it',
  )
  assert.match(
    codeOf('components/adult/panes/konto/SikkerhedSection.tsx'),
    /registerPasskey\(registerOptions/,
    'the Sikkerhed section imports registerPasskey but never calls it',
  )
})

test('the whole passkey probe stays inside its try/catch', () => {
  // `passkeysUsableHere` is awaited in a mount effect, so a throw there takes out the account pane.
  // The build check was inserted at the top of that function and must be INSIDE the existing guard.
  const code = codeOf('services/passkeyClient.ts')
  const fn = code.slice(code.indexOf('export async function passkeysUsableHere'))
  const tryAt = fn.indexOf('try {')
  const buildAt = fn.indexOf('passkeysSupportedInThisBuild()')
  assert.ok(tryAt > 0 && tryAt < buildAt, 'the build check sits outside the try/catch')
})
