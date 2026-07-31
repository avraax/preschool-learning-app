import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateNewPin,
  isPinShape,
  registerFailure,
  clearAttempts,
  isLockedOut,
  attemptsLeft,
  lockoutMessage,
  DENYLISTED_PINS,
  FREE_ATTEMPTS,
  RECOVERY_AT_FAILURES,
} from './pinPolicy.ts'

const NOW = 1_800_000_000_000
const MIN = 60_000

test('validateNewPin accepts an ordinary non-trivial code', () => {
  for (const pin of ['3719', '5083', '9042', '2749']) {
    assert.equal(validateNewPin(pin).ok, true, pin)
  }
})

test('validateNewPin rejects anything that is not exactly 4 digits', () => {
  for (const bad of ['', '1', '123', '12345', '12a4', ' 123', '12 4', '1.23']) {
    const v = validateNewPin(bad)
    assert.equal(v.ok, false, bad)
    assert.equal(v.reason, 'not-four-digits')
    assert.ok(v.message)
  }
  // Non-strings must not throw.
  assert.equal(validateNewPin(undefined as unknown as string).ok, false)
  assert.equal(validateNewPin(1234 as unknown as string).ok, false)
})

test('validateNewPin rejects all-repeated digits', () => {
  for (const d of '0123456789') {
    const v = validateNewPin(d.repeat(4))
    assert.equal(v.ok, false, d)
    // 0000/1111/etc are also denylisted; either reason is a rejection, but all-same is checked first.
    assert.equal(v.reason, 'all-same')
  }
})

test('validateNewPin rejects runs, including the wraparound ones', () => {
  for (const run of ['1234', '4321', '0123', '9876', '0987', '3456', '7890', '1098']) {
    const v = validateNewPin(run)
    assert.equal(v.ok, false, run)
    assert.ok(v.reason === 'sequence' || v.reason === 'too-common', `${run} → ${v.reason}`)
  }
  // A near-run that is NOT consecutive must pass.
  assert.equal(validateNewPin('1235').ok, true)
})

test('every denylisted PIN is refused', () => {
  for (const pin of DENYLISTED_PINS) assert.equal(validateNewPin(pin).ok, false, pin)
})

test('isPinShape is shape-only — a denylisted PIN must remain VERIFIABLE', () => {
  assert.equal(isPinShape('1234'), true)
  assert.equal(isPinShape('12345'), false)
  assert.equal(isPinShape(1234), false)
  assert.equal(isPinShape(null), false)
})

test('the first four failures are free, then the lock escalates 1/5/15/60 min', () => {
  let s = clearAttempts()
  assert.equal(attemptsLeft(s), FREE_ATTEMPTS)

  for (let i = 1; i <= FREE_ATTEMPTS; i++) {
    s = registerFailure(s, NOW)
    assert.equal(s.failedCount, i)
    assert.equal(isLockedOut(s, NOW), false, `attempt ${i} must not lock`)
  }
  assert.equal(attemptsLeft(s), 0)

  const expected = [1 * MIN, 5 * MIN, 15 * MIN, 60 * MIN]
  for (const [i, ms] of expected.entries()) {
    s = registerFailure(s, NOW)
    assert.equal(s.failedCount, FREE_ATTEMPTS + i + 1)
    assert.equal(isLockedOut(s, NOW), true)
    assert.equal(s.lockedUntil, NOW + ms)
    assert.equal(s.requiresRecovery, false)
    // The window genuinely expires.
    assert.equal(isLockedOut(s, NOW + ms), false)
  }
})

test('the 9th failure closes the PIN path (requiresRecovery + 24h)', () => {
  let s = clearAttempts()
  for (let i = 0; i < RECOVERY_AT_FAILURES; i++) s = registerFailure(s, NOW)
  assert.equal(s.failedCount, RECOVERY_AT_FAILURES)
  assert.equal(s.requiresRecovery, true)
  assert.equal(s.lockedUntil, NOW + 24 * 60 * MIN)
  assert.match(lockoutMessage(s, NOW), /Google eller Face ID/)
})

test('a successful verify clears the counter completely', () => {
  let s = clearAttempts()
  for (let i = 0; i < 6; i++) s = registerFailure(s, NOW)
  assert.equal(isLockedOut(s, NOW), true)
  s = clearAttempts()
  assert.equal(s.failedCount, 0)
  assert.equal(isLockedOut(s, NOW), false)
  assert.equal(attemptsLeft(s), FREE_ATTEMPTS)
})

test('the counter does NOT decay on its own — the lock window expiring is not forgiveness', () => {
  let s = clearAttempts()
  for (let i = 0; i < 5; i++) s = registerFailure(s, NOW)
  const afterWindow = NOW + 2 * MIN
  assert.equal(isLockedOut(s, afterWindow), false) // free to try again…
  s = registerFailure(s, afterWindow) // …but the next failure is the 6th, not the 1st
  assert.equal(s.failedCount, 6)
  assert.equal(s.lockedUntil, afterWindow + 5 * MIN)
})

test('lockoutMessage: seconds under a minute, whole minutes above', () => {
  const s = { failedCount: 5, lockedUntil: NOW + 30_000, requiresRecovery: false }
  assert.match(lockoutMessage(s, NOW), /30 sekunder/)
  assert.match(lockoutMessage({ ...s, lockedUntil: NOW + 60_000 }, NOW), /^Prøv igen om 1 minut\.$/)
  assert.match(lockoutMessage({ ...s, lockedUntil: NOW + 5 * MIN }, NOW), /5 minutter/)
  assert.equal(lockoutMessage(clearAttempts(), NOW), '')
})
