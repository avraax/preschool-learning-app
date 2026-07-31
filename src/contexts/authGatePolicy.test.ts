// The auth-gate truth table (accounts PRD §7.1). Each case here is a rule that would otherwise live
// inside a React effect where it cannot be tested.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  authGateDecision,
  gateBlocks,
  DEFAULT_GRACE_MS,
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
