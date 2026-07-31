// The access JWT round trip and every rejection path (accounts PRD §12).
//
// Env is set here rather than through --env-file so the suite is hermetic and the clock-skew cases
// can pin the issuer. `npm test` includes lib/**/*.test.ts for exactly this file and pin-hash's.
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-do-not-use-in-production-0123456789'
process.env.BETTER_AUTH_URL = 'https://test.example'
delete process.env.VERCEL
delete process.env.VERCEL_ENV

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SignJWT } from 'jose'
import {
  signAccessToken,
  verifyAccessToken,
  bearerToken,
  ACCESS_TOKEN_TTL_SECONDS,
} from './access-token.ts'

const KEY = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET as string)
const header = (t: string) => `Bearer ${t}`

/** Mint a token with deliberately wrong claims / timing, to test each rejection in isolation. */
async function forge(over: {
  sub?: string
  sid?: string
  aud?: string
  iss?: string
  expOffsetSeconds?: number
  iatOffsetSeconds?: number
  key?: Uint8Array
}): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000)
  return new SignJWT({ sid: over.sid ?? 'session_1' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(over.sub ?? 'user_1')
    .setAudience(over.aud ?? 'bl-paid')
    .setIssuer(over.iss ?? 'https://test.example')
    .setIssuedAt(nowSec + (over.iatOffsetSeconds ?? 0))
    .setExpirationTime(nowSec + (over.expOffsetSeconds ?? ACCESS_TOKEN_TTL_SECONDS))
    .sign(over.key ?? KEY)
}

test('sign → verify round trip carries sub and sid', async () => {
  const { token, expiresIn } = await signAccessToken('user_abc', 'session_xyz')
  assert.equal(expiresIn, ACCESS_TOKEN_TTL_SECONDS)
  const claims = await verifyAccessToken(header(token))
  assert.ok(claims)
  assert.equal(claims.sub, 'user_abc')
  assert.equal(claims.sid, 'session_xyz')
  assert.ok(claims.exp > Math.floor(Date.now() / 1000))
})

test('expiresIn is RELATIVE seconds, so the client never compares clocks', async () => {
  const { expiresIn } = await signAccessToken('u', 's')
  assert.equal(typeof expiresIn, 'number')
  assert.equal(expiresIn, 900)
})

test('bearerToken parses the header and rejects everything else', () => {
  assert.equal(bearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
  assert.equal(bearerToken('bearer abc'), 'abc') // case-insensitive scheme
  assert.equal(bearerToken('  Bearer   abc  '), 'abc')
  assert.equal(bearerToken('Basic abc'), null)
  assert.equal(bearerToken('abc'), null)
  assert.equal(bearerToken(''), null)
  assert.equal(bearerToken(undefined), null)
  assert.equal(bearerToken(null), null)
})

test('a missing or malformed header verifies to null, never a throw', async () => {
  assert.equal(await verifyAccessToken(undefined), null)
  assert.equal(await verifyAccessToken(''), null)
  assert.equal(await verifyAccessToken('Bearer not-a-jwt'), null)
  assert.equal(await verifyAccessToken('Bearer a.b.c'), null)
})

test('an EXPIRED token is refused (beyond the clock tolerance)', async () => {
  const token = await forge({ expOffsetSeconds: -300 })
  assert.equal(await verifyAccessToken(header(token)), null)
})

test('the wrong AUDIENCE is refused (a session-scoped token cannot buy Azure)', async () => {
  const token = await forge({ aud: 'bl-session' })
  assert.equal(await verifyAccessToken(header(token)), null)
})

test('the wrong ISSUER is refused', async () => {
  const token = await forge({ iss: 'https://evil.example' })
  assert.equal(await verifyAccessToken(header(token)), null)
})

test('a token signed with a DIFFERENT key is refused (key separation holds)', async () => {
  const otherKey = new TextEncoder().encode('a-completely-different-secret-value-abcdef')
  const token = await forge({ key: otherKey })
  assert.equal(await verifyAccessToken(header(token)), null)
})

test('a tampered signature is refused', async () => {
  const { token } = await signAccessToken('u', 's')
  const [h, p, s] = token.split('.')
  const flipped = s.slice(0, -2) + (s.endsWith('AA') ? 'BB' : 'AA')
  assert.equal(await verifyAccessToken(header(`${h}.${p}.${flipped}`)), null)
})

test('a token missing `sid` is refused (the revocation handle must be present)', async () => {
  const nowSec = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('user_1')
    .setAudience('bl-paid')
    .setIssuer('https://test.example')
    .setExpirationTime(nowSec + 900)
    .sign(KEY)
  assert.equal(await verifyAccessToken(header(token)), null)
})

test('clock skew: ±90s passes, ±300s fails (the 17.7 iPad must not be locked out by its clock)', async () => {
  // A token that expired 90 seconds ago is inside the 120s tolerance.
  const nearlyExpired = await forge({ expOffsetSeconds: -90 })
  assert.ok(await verifyAccessToken(header(nearlyExpired)), '−90s should pass')

  const longExpired = await forge({ expOffsetSeconds: -300 })
  assert.equal(await verifyAccessToken(header(longExpired)), null, '−300s should fail')

  // An iPad running FAST issues a token stamped in the future. `iat` is never validated and there is
  // no `nbf`, so this must simply work — at any offset.
  const future = await forge({ iatOffsetSeconds: 3600, expOffsetSeconds: 3600 + 900 })
  assert.ok(await verifyAccessToken(header(future)), 'a future iat must not matter')
})
