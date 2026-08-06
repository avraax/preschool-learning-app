// The auth-gate truth table (accounts PRD §7.1). Each case here is a rule that would otherwise live
// inside a React effect where it cannot be tested.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  authGateDecision,
  gateBlocks,
  isPublicPath,
  DEFAULT_GRACE_MS,
  PUBLIC_PATHS,
  type AuthGateInputs,
} from './authGatePolicy.ts'

const NOW = 1_800_000_000_000

const inputs = (over: Partial<AuthGateInputs> = {}): AuthGateInputs => ({
  hasStoredToken: true,
  serverVerdict: 'unknown',
  lastVerifiedAt: NOW - 1000,
  now: NOW,
  graceMs: DEFAULT_GRACE_MS,
  lockedByAdult: false,
  idleSinceMs: 0,
  devBypass: false,
  guestMode: false,
  ...over,
})

test('first run: no token ⇒ signedOut, nothing plays', () => {
  const d = authGateDecision(inputs({ hasStoredToken: false }))
  assert.equal(d.phase, 'signedOut')
  assert.equal(d.canPlay, false)
  assert.equal(d.canCallPaidApis, false)
  assert.equal(gateBlocks(d.phase), true)
})

test('unknown + a stored token ⇒ optimistically authed (never a boot spinner)', () => {
  const d = authGateDecision(inputs({ serverVerdict: 'unknown' }))
  assert.equal(d.phase, 'authed')
  assert.equal(d.canPlay, true)
  assert.equal(gateBlocks(d.phase), false)
})

test('valid ⇒ authed with paid access', () => {
  const d = authGateDecision(inputs({ serverVerdict: 'valid' }))
  assert.equal(d.phase, 'authed')
  assert.equal(d.canCallPaidApis, true)
})

test('invalid ⇒ signedOut IMMEDIATELY, ignoring grace (the revocation path)', () => {
  // Verified one second ago, i.e. deep inside the grace window — it must not help.
  const d = authGateDecision(inputs({ serverVerdict: 'invalid', lastVerifiedAt: NOW - 1000 }))
  assert.equal(d.phase, 'signedOut')
  assert.equal(d.canPlay, false)
})

test('invalid beats an adult lock too (a revoked session must not sit at a PIN pad)', () => {
  const d = authGateDecision(inputs({ serverVerdict: 'invalid', lockedByAdult: true }))
  assert.equal(d.phase, 'signedOut')
})

test('unreachable INSIDE grace ⇒ offlineGrace: full play, no paid calls', () => {
  const d = authGateDecision(
    inputs({ serverVerdict: 'unreachable', lastVerifiedAt: NOW - DEFAULT_GRACE_MS + 1 }),
  )
  assert.equal(d.phase, 'offlineGrace')
  assert.equal(d.canPlay, true)
  assert.equal(d.canCallPaidApis, false)
  assert.equal(gateBlocks(d.phase), false)
})

test('unreachable at exactly the grace boundary is still inside it', () => {
  const d = authGateDecision(
    inputs({ serverVerdict: 'unreachable', lastVerifiedAt: NOW - DEFAULT_GRACE_MS }),
  )
  assert.equal(d.phase, 'offlineGrace')
})

test('unreachable OUTSIDE grace ⇒ offlineExpired, blocking', () => {
  const d = authGateDecision(
    inputs({ serverVerdict: 'unreachable', lastVerifiedAt: NOW - DEFAULT_GRACE_MS - 1 }),
  )
  assert.equal(d.phase, 'offlineExpired')
  assert.equal(d.canPlay, false)
  assert.equal(gateBlocks(d.phase), true)
})

test('unreachable with a token that was NEVER verified does not earn 30 days of grace', () => {
  const d = authGateDecision(inputs({ serverVerdict: 'unreachable', lastVerifiedAt: null }))
  assert.equal(d.phase, 'offlineExpired')
})

test('lockedByAdult ⇒ locked: valid session, but nothing plays until it is proven', () => {
  const d = authGateDecision(inputs({ serverVerdict: 'valid', lockedByAdult: true }))
  assert.equal(d.phase, 'locked')
  assert.equal(d.canPlay, false)
  assert.equal(d.canCallPaidApis, false)
  assert.equal(gateBlocks(d.phase), true)
})

test('devBypass ⇒ authed regardless of everything else (?nogate=1 keeps every recipe working)', () => {
  const d = authGateDecision(
    inputs({ devBypass: true, hasStoredToken: false, serverVerdict: 'invalid' }),
  )
  assert.equal(d.phase, 'authed')
  assert.equal(d.canPlay, true)
  assert.equal(d.canCallPaidApis, true)
})

// ---- GUEST / local play (App Store PRD §3.2, Phase A1) -------------------------------------------
//
// Guideline 5.1.1(v): "If your app doesn't include significant account-based features, let people use it
// without a login." The app used to block entirely behind Google sign-in.

test('guest with no token ⇒ full play, and the gate does NOT block', () => {
  const d = authGateDecision(inputs({ guestMode: true, hasStoredToken: false }))
  assert.equal(d.phase, 'guest')
  assert.equal(d.canPlay, true)
  assert.equal(gateBlocks(d.phase), false)
})

test('a guest may NOT call the paid endpoints', () => {
  // Not conservatism — the same control as AUTH_ALLOWED_EMAILS. /api/tts-azure bills per character and
  // /api/stt per second, and both need a server-minted access JWT an account-less client cannot get. If
  // this ever returns true, an open guest path becomes an open invitation to spend the owner's credit.
  const d = authGateDecision(inputs({ guestMode: true, hasStoredToken: false }))
  assert.equal(d.canCallPaidApis, false)
})

test('guest requires NO stored token: a real session always wins', () => {
  // The flag could be left set on disk while a session exists (sign-in writes both, in either order).
  // A token holder must resolve to their real phase, never to a guest with an empty local book.
  const d = authGateDecision(inputs({ guestMode: true, hasStoredToken: true, serverVerdict: 'valid' }))
  assert.equal(d.phase, 'authed')
  assert.equal(d.canCallPaidApis, true)
})

test('guest beats a STALE invalid verdict, because that is exactly the moment it is chosen', () => {
  // "Spil uden konto" is tapped FROM the signedOut lock screen, which is reached by a revocation — so
  // `verdict: 'invalid'` is still in memory when the token has already gone. If invalid outranked guest,
  // the adult would tap the button and be bounced straight back to the screen they just left.
  const d = authGateDecision(
    inputs({ guestMode: true, hasStoredToken: false, serverVerdict: 'invalid' }),
  )
  assert.equal(d.phase, 'guest')
  assert.equal(d.canPlay, true)
})

test('a revoked LIVE session is still signed out, guest flag or not', () => {
  // The other direction of the rule above: guest must never mask a revocation while a token is held.
  const d = authGateDecision(
    inputs({ guestMode: true, hasStoredToken: true, serverVerdict: 'invalid' }),
  )
  assert.equal(d.phase, 'signedOut')
  assert.equal(d.canPlay, false)
})

test('no guest flag ⇒ still signedOut (the flag is the ONLY thing that opens local play)', () => {
  const d = authGateDecision(inputs({ guestMode: false, hasStoredToken: false }))
  assert.equal(d.phase, 'signedOut')
})

// ---- The two public URLs (App Store PRD §3.5, listing §3.1) --------------------------------------

test('exactly two paths are public, and they are the two App Store Connect demands', () => {
  // Pinned as an exact list, not a length: App Store Connect requires a Privacy Policy URL and a
  // Support URL that Apple fetches with no account. A third entry here means some other screen has been
  // put outside the auth gate, which is a decision, not a detail.
  assert.deepEqual([...PUBLIC_PATHS], ['/privatliv', '/support'])
})

test('a public path is recognised with or without a trailing slash', () => {
  assert.equal(isPublicPath('/privatliv'), true)
  assert.equal(isPublicPath('/privatliv/'), true)
  assert.equal(isPublicPath('/support'), true)
})

test('nothing else is public — least of all the app itself', () => {
  for (const p of ['/', '/alphabet', '/ordleg/mic', '/album', '/privatlivspolitik', '/support/x']) {
    assert.equal(isPublicPath(p), false, `${p} must not bypass the auth gate`)
  }
})
