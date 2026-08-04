// Bearer-session resolution for the two endpoints that are NOT part of the better-auth surface:
// /api/profiles and /api/progress.
//
// They live outside /api/auth on purpose (accounts PRD §4.3's route table): they carry no credentials
// in the URL, so `isSensitiveUrl()` leaves their paths diagnosable in the bug-report network ring,
// whereas everything under /api/auth has its whole query and fragment stripped.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.js'

export interface SessionInfo {
  userId: string
  sessionId: string
}

/**
 * Returns the session, or `null` after having ALREADY written the 401 — so the caller just `return`s.
 * Uses better-auth's own resolution (via the bearer plugin), so these endpoints can never disagree
 * with /api/auth about what a valid session is.
 */
export async function requireSession(
  req: VercelRequest,
  res: VercelResponse,
): Promise<SessionInfo | null> {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (result?.user?.id && result.session?.id) {
      return { userId: result.user.id, sessionId: result.session.id }
    }
  } catch (e) {
    console.error('[session] getSession failed', e)
  }
  res.setHeader('WWW-Authenticate', 'Bearer')
  res.status(401).json({ error: 'Unauthorized' })
  return null
}

/** The better-auth DB adapter, so our tables are read/written through one schema-aware layer. */
export async function adapter() {
  const ctx = await auth.$context
  return ctx.adapter
}
