process.env.PIN_PEPPER = 'test-pepper-value-do-not-use-in-production-abcdef'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPin, verifyPin, needsRehash, SCRYPT_N, SCRYPT_R, SCRYPT_P } from './pin-hash.ts'

test('round trip: the correct PIN verifies, a wrong one does not', async () => {
  const stored = await hashPin('3719')
  assert.equal(await verifyPin('3719', stored), true)
  assert.equal(await verifyPin('3718', stored), false)
  assert.equal(await verifyPin('', stored), false)
})

test('the stored record is the documented format and leaks nothing', async () => {
  const stored = await hashPin('5083')
  assert.match(stored, /^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/)
  assert.ok(!stored.includes('5083'))
  // A distinct random salt per record → the same PIN never stores the same hash twice.
  assert.notEqual(stored, await hashPin('5083'))
})

test('changing PIN_PEPPER invalidates an existing hash (a DB dump alone is useless)', async () => {
  const stored = await hashPin('4270')
  const original = process.env.PIN_PEPPER
  process.env.PIN_PEPPER = 'a-totally-different-pepper-value-0123456789'
  try {
    assert.equal(await verifyPin('4270', stored), false)
  } finally {
    process.env.PIN_PEPPER = original
  }
  assert.equal(await verifyPin('4270', stored), true)
})

test('a malformed / tampered stored record reads as "wrong PIN", never as a crash', async () => {
  for (const bad of [
    '',
    'garbage',
    'scrypt$16384$8$1$onlyfive',
    'pbkdf2$16384$8$1$c2FsdA$aGFzaA',
    'scrypt$notanumber$8$1$c2FsdA$aGFzaA',
    'scrypt$16384$8$1$$aGFzaA',
    'scrypt$16384$8$1$c2FsdA$',
  ]) {
    assert.equal(await verifyPin('1234', bad), false, bad)
  }
})

test('absurd KDF parameters in a tampered row are refused rather than allocated for', async () => {
  // N = 2^30 would try to allocate ~1 TiB; it must return false immediately.
  const started = Date.now()
  assert.equal(await verifyPin('1234', `scrypt$${1 << 30}$8$1$c2FsdA$aGFzaA`), false)
  assert.ok(Date.now() - started < 2000, 'refusal must be immediate')
})

test('scrypt at N=16384 stays under Node’s default 32 MiB maxmem', async () => {
  // 128 * N * r bytes is scrypt's working set: 128 * 16384 * 8 = 16 MiB — half the default ceiling.
  // (N=32768 would need exactly 32 MiB and is borderline, which is why we do not use it.)
  assert.equal(128 * SCRYPT_N * SCRYPT_R, 16 * 1024 * 1024)
  assert.equal(SCRYPT_P, 1)
  // And it demonstrably runs without a maxmem error.
  const stored = await hashPin('9042')
  assert.equal(await verifyPin('9042', stored), true)
})

test('needsRehash flags records written with other parameters', async () => {
  assert.equal(needsRehash(await hashPin('2749')), false)
  assert.equal(needsRehash('scrypt$32768$8$1$c2FsdA$aGFzaA'), true)
  assert.equal(needsRehash('pbkdf2$16384$8$1$c2FsdA$aGFzaA'), true)
  assert.equal(needsRehash('garbage'), true)
})
