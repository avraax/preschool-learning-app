// The guard that stops a stranger with the URL from spending real money.
//
// /api/tts-azure bills per character synthesized (Azure AI Speech) and /api/stt bills per second of
// audio (Google Cloud STT). Before this, both were reachable by anyone, guarded only by a per-IP rate
// limiter that resets on every cold start. THIS is the requirement with money attached.
//
// Deliberately tiny: one local HS256 verification, no database round-trip, no JWKS fetch. See
// lib/access-token.ts for why.
//
// Note most narration is served from immutable static files under /sounds/tts/, which stay public and
// ungated — only the live Azure fallback and STT are gated.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAccessToken, type AccessClaims } from './access-token.js'
import { devBypassEnabled } from './env.js'

/** The subject a paid call is billed to. `dev-bypass` only ever appears on a local machine. */
export const DEV_BYPASS_SUBJECT = 'dev-bypass'

/**
 * Returns the claims on success. On failure it has ALREADY written the 401, so the caller just
 * `return`s.
 *
 * The distinct `code: 'need_access_token'` is load-bearing: it tells the client to mint-and-retry
 * ONCE rather than to log the adult out. A generic 401 would make a merely-expired token look like
 * a revoked session.
 */
export async function requirePaidAccess(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AccessClaims | null> {
  if (devBypassEnabled()) {
    return { sub: DEV_BYPASS_SUBJECT, sid: DEV_BYPASS_SUBJECT, exp: 0 }
  }

  const header = req.headers.authorization
  const claims = await verifyAccessToken(Array.isArray(header) ? header[0] : header)
  if (claims) return claims

  res.setHeader('WWW-Authenticate', 'Bearer')
  res.status(401).json({ error: 'Unauthorized', code: 'need_access_token' })
  return null
}
