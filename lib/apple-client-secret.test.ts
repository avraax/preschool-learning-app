// Apple's client secret is a JWT WE sign, and every way of getting it wrong returns the same
// `invalid_client` from Apple — which reads exactly like a wrong key ID. So the shape is pinned here
// rather than discovered against a live endpoint.
//
// The load-bearing detail is the SIGNATURE ENCODING: `crypto.sign` defaults to DER, JOSE requires the
// fixed-width r‖s form, and only `dsaEncoding: 'ieee-p1363'` produces it. A DER signature is a
// perfectly valid ECDSA signature — it just is not a valid JWS — so nothing throws locally and the
// failure appears only as a rejected token exchange in production.

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync, createPublicKey, verify as cryptoVerify } from 'node:crypto'

// An ES256 key pair stands in for the owner's .p8 — same curve, same algorithm, no real credential.
const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const ENV = {
  APPLE_CLIENT_ID: 'dk.boernelaering.web',
  APPLE_TEAM_ID: 'TEAM123456',
  APPLE_KEY_ID: 'KEY7654321',
  APPLE_PRIVATE_KEY: privateKey,
}

beforeEach(async () => {
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v
  const { resetAppleClientSecretCache } = await import('./apple-client-secret.ts')
  resetAppleClientSecretCache()
})

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))

test('the header names ES256 and carries the KEY ID', async () => {
  const { appleClientSecret } = await import('./apple-client-secret.ts')
  const [h] = appleClientSecret(1_700_000_000_000).split('.')
  const header = decode(h)
  assert.equal(header.alg, 'ES256')
  assert.equal(header.typ, 'JWT')
  // `kid` is the KEY id, not the team id and not the client id — Apple looks the public key up by it.
  assert.equal(header.kid, ENV.APPLE_KEY_ID)
})

test('iss is the TEAM id and sub is the SERVICES id — the classic mix-up', async () => {
  const { appleClientSecret } = await import('./apple-client-secret.ts')
  const now = 1_700_000_000_000
  const [, p] = appleClientSecret(now).split('.')
  const payload = decode(p)
  assert.equal(payload.iss, ENV.APPLE_TEAM_ID)
  assert.equal(payload.sub, ENV.APPLE_CLIENT_ID)
  assert.notEqual(payload.sub, payload.iss, 'sub must be the Services ID, never the Team ID')
  assert.equal(payload.aud, 'https://appleid.apple.com')
  assert.equal(payload.iat, Math.floor(now / 1000))
  assert.ok(payload.exp > payload.iat, 'the secret must expire in the future')
  // Apple caps the lifetime at 6 months and rejects anything longer outright.
  assert.ok(payload.exp - payload.iat <= 15_777_000, 'lifetime exceeds Apple’s 6-month cap')
})

test('the signature is JOSE r||s, not DER — the failure that only shows in production', async () => {
  const { appleClientSecret } = await import('./apple-client-secret.ts')
  const token = appleClientSecret(1_700_000_000_000)
  const [h, p, s] = token.split('.')
  const sig = Buffer.from(s, 'base64url')

  // P-256: r and s are 32 bytes each, so a JOSE signature is EXACTLY 64 bytes. A DER one is ~70-72
  // and starts with 0x30 (SEQUENCE) — the single cheapest way to tell them apart.
  assert.equal(sig.length, 64, 'not a 64-byte P-256 JOSE signature (DER leaks in at ~70 bytes)')
  assert.notEqual(sig[0], 0x30, 'signature is DER-encoded; Apple will answer invalid_client')

  // And it must actually verify under the same encoding.
  const ok = cryptoVerify(
    'sha256',
    Buffer.from(`${h}.${p}`),
    { key: createPublicKey(publicKey), dsaEncoding: 'ieee-p1363' },
    sig,
  )
  assert.equal(ok, true, 'the signature does not verify over header.payload')
})

test('a DER signature is a real ECDSA signature — which is why this must be asserted, not assumed', () => {
  // The control. Without it, "the signature verifies" proves nothing about the ENCODING: this DER one
  // is cryptographically valid and would still be rejected by Apple as a malformed JWS.
  const signer = createSign('sha256')
  signer.update('anything')
  const der = signer.sign(privateKey)
  assert.equal(der[0], 0x30, 'expected a DER SEQUENCE — the fake would not prove the point otherwise')
  assert.notEqual(der.length, 64)
})

test('the secret is cached, then re-minted once it approaches expiry', async () => {
  const { appleClientSecret } = await import('./apple-client-secret.ts')
  const t0 = 1_700_000_000_000
  const first = appleClientSecret(t0)
  assert.equal(appleClientSecret(t0 + 1_000), first, 'a fresh secret was minted needlessly')
  // Past the TTL minus the refresh margin, it must be a NEW token — a stale one fails mid-flight.
  const later = appleClientSecret(t0 + 30 * 60 * 1000)
  assert.notEqual(later, first)
})

test('an unconfigured Apple throws instead of minting a garbage secret', async () => {
  const { appleClientSecret, resetAppleClientSecretCache } = await import('./apple-client-secret.ts')
  resetAppleClientSecretCache()
  const saved = process.env.APPLE_KEY_ID
  delete process.env.APPLE_KEY_ID
  try {
    assert.throws(() => appleClientSecret(1_700_000_000_000), /not configured/)
  } finally {
    process.env.APPLE_KEY_ID = saved
  }
})

test('an escaped-newline private key is accepted, because a .env line cannot hold real newlines', async () => {
  const { apple } = await import('./env.ts')
  const saved = process.env.APPLE_PRIVATE_KEY
  process.env.APPLE_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
  try {
    assert.equal(apple().privateKey, privateKey)
    assert.equal(apple().enabled, true)
  } finally {
    process.env.APPLE_PRIVATE_KEY = saved
  }
})

test('apple() is all-or-nothing — a half-configured provider must not enable the button', async () => {
  const { apple } = await import('./env.ts')
  for (const missing of ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY']) {
    const saved = process.env[missing]
    delete process.env[missing]
    try {
      assert.equal(apple().enabled, false, `${missing} missing but apple() still reported enabled`)
    } finally {
      process.env[missing] = saved
    }
  }
})
