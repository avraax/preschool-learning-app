// The short-lived access JWT that gates the PAID endpoints (/api/tts-azure, /api/stt).
//
// This is the ONLY auth code those two functions import, and that is deliberate: verifying a token
// must be a local constant-time check with no database round-trip and no JWKS fetch in the hot path.
// (Which is also why we don't use better-auth's `jwt` plugin — it issues asymmetric tokens verified
// against a JWKS endpoint, i.e. a network hop or a cache inside `tts-azure`.)
//
// Signed with ACCESS_TOKEN_SECRET, deliberately SEPARATE from BETTER_AUTH_SECRET: key separation
// means a leaked signing key can't forge sessions, and a leaked session secret can't mint spend.
//
// CLOCK DISCIPLINE (accounts PRD §4.6 / §9): the owner's oldest iPad is an iPadOS 17.7 device whose
// clock can be minutes off. So: no `nbf`, `iat` is NEVER validated, and verification allows a
// 120-second tolerance. The client is told `expiresIn` as a RELATIVE number of seconds so it never
// compares server absolute time against its own.

import { SignJWT, jwtVerify } from 'jose'
import { baseURL, requireEnv } from './env.ts'

export const ACCESS_TOKEN_TTL_SECONDS = 900
const AUDIENCE = 'bl-paid'
const CLOCK_TOLERANCE_SECONDS = 120

export interface AccessClaims {
  sub: string
  sid: string
  exp: number
}

let cachedKey: Uint8Array | null = null
function secretKey(): Uint8Array {
  if (!cachedKey) cachedKey = new TextEncoder().encode(requireEnv('ACCESS_TOKEN_SECRET'))
  return cachedKey
}

export async function signAccessToken(
  userId: string,
  sessionId: string,
): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setIssuer(baseURL())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey())
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS }
}

/** Pull the token out of an `Authorization: Bearer …` header. */
export function bearerToken(authorizationHeader: string | undefined | null): string | null {
  if (!authorizationHeader) return null
  const m = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  return m ? m[1].trim() : null
}

/**
 * Returns the claims, or `null` on EVERY failure (missing / malformed / expired / wrong audience /
 * wrong issuer / bad signature). Never throws into the hot path — a crash here would turn a
 * 401 into a 500 and hide the real cause.
 */
export async function verifyAccessToken(
  authorizationHeader: string | undefined | null,
): Promise<AccessClaims | null> {
  const token = bearerToken(authorizationHeader)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      audience: AUDIENCE,
      issuer: baseURL(),
      algorithms: ['HS256'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    })
    const sub = typeof payload.sub === 'string' ? payload.sub : null
    const sid = typeof payload.sid === 'string' ? payload.sid : null
    const exp = typeof payload.exp === 'number' ? payload.exp : null
    if (!sub || !sid || exp == null) return null
    return { sub, sid, exp }
  } catch {
    return null
  }
}
