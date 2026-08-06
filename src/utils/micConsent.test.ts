// The microphone consent gate (App Store PRD §3.6 / A3) — the plan's largest irreducible review risk.
//
// Guideline 1.3 is unqualified: "Kids Category apps may not send personally identifiable information or
// device information to third parties." The only qualifier in Apple's material is "unless the parent
// explicitly consents". So two things have to be mechanically true, and neither is visible in a
// screenshot: the default is OFF, and OFF means the game is UNREACHABLE — including by URL, because
// every route in this app is deep-linkable by design.
//
// The behaviour tests run without a DOM (there is no jsdom here), which is itself the point: `localStorage`
// is undefined, the reads throw, and the answer must still be "no consent". The wiring tests read source.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { grantMicConsent, micConsentGiven, revokeMicConsent } from './micConsent.ts'

const SRC = path.join(import.meta.dirname, '..')

const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    // Comments stripped FIRST. A guard that greps source is otherwise satisfied by the prose comment
    // explaining the fix, and stays green after the fix itself is deleted (this repo has shipped that
    // exact failure — see `.claude/rules/auth.md` on authOverlayZ).
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

test('with no storage at all, consent is NOT given', () => {
  // The one flag in this app where the failure direction is not a preference but a child's voice
  // reaching a third party on no evidence. Private mode, quota errors and a non-browser context must
  // all read as "not consented".
  assert.equal(typeof globalThis.localStorage, 'undefined', 'this test is only meaningful without a DOM')
  assert.equal(micConsentGiven(), false)
})

test('grant and revoke never throw, even with no storage', () => {
  // They are called from a tap handler in the adult pane. A throw there would leave the switch in a
  // half-flipped state with an unexplained crash on the adult surface.
  assert.doesNotThrow(() => grantMicConsent())
  assert.doesNotThrow(() => revokeMicConsent())
  // …and a failed WRITE must not be reported as consent.
  assert.equal(micConsentGiven(), false)
})

test('the Ordleg menu hides Sig et Ord until consent is given', () => {
  const code = codeOf('components/ordleg/OrdlegSelection.tsx')
  assert.match(code, /micConsentGiven\(\)/, 'the menu does not consult the consent flag')
  // NB `[^)]*` cannot span the arrow function's own `)` — match the comparison itself.
  assert.match(code, /\.filter\(.*!==\s*'mic'/s, 'the mic tile is not filtered out when consent is absent')
})

test("the ROUTE refuses too — hiding a tile is not a gate", () => {
  const code = codeOf('App.tsx')
  // The guard must wrap the route element, NOT live inside SpeakWordGame: that component warms the
  // microphone in a mount effect, so a check inside it opens the mic before deciding it may not.
  assert.match(code, /micConsentGiven\(\)\s*\?\s*<SpeakWordGame\s*\/>\s*:\s*<Navigate/)
  assert.match(code, /path="\/ordleg\/mic" element=\{<MicGameRoute \/>\}/)
  // And SpeakWordGame must NOT be reachable from any other route registration.
  const direct = code.match(/element=\{<SpeakWordGame\s*\/>\}/g) ?? []
  assert.equal(direct.length, 0, 'SpeakWordGame is still mounted by an unguarded route')
})

test('the consent screen names Google, says the audio is not stored, and is reversible', () => {
  // 5.1.2(i) requires disclosure "including with third-party AI" and explicit permission. A switch alone
  // is a preference, not consent — the naming is what makes it consent.
  const code = codeOf('components/adult/panes/MicConsentDialog.tsx')
  assert.match(code, /Google Cloud\s*\n?\s*Speech-to-Text|Google Cloud Speech-to-Text/)
  assert.match(code, /gemmes ikke/)
  assert.match(code, /slå den fra igen|slå det fra igen/)
})

test('turning the microphone OFF goes through no dialog at all', () => {
  // Withdrawal must never be harder than consent — the privacy policy promises it is one tap here. So
  // the ON branch opens the dialog and the OFF branch revokes immediately.
  const code = codeOf('components/adult/panes/PrivatlivPane.tsx')
  assert.match(code, /if \(next\) \{\s*setAsking\(true\)/, 'the ON direction does not ask for consent')
  assert.match(code, /revokeMicConsent\(\)/, 'the OFF direction does not revoke')
  // Revoking while the child is inside the game has to leave the route: MicGameRoute only re-decides on
  // navigation, so without this the mic stays live behind an adult who just switched it off.
  assert.match(code, /pathname === '\/ordleg\/mic'/)
})

test('a guest is not offered the switch, because the game cannot work without an account', () => {
  // /api/stt needs a server-minted access JWT no account-less client can obtain. Consenting there would
  // buy a game that dead-ends forever — the opposite of 5.1.1(iv)'s "provide alternative solutions".
  const code = codeOf('components/adult/panes/PrivatlivPane.tsx')
  assert.match(code, /phase === 'guest'/)
  assert.match(code, /guest \?/, 'the guest case is not branched before the toggle is rendered')
})
