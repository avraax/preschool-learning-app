// The canonical per-profile progress document (accounts PRD §6.4).
//
// LOCAL-FIRST (D6): localStorage stays the gameplay source of truth and the app is fully playable
// without this endpoint ever answering. The server holds a MERGED MIRROR so a book can follow a child to
// another device.
//
// It imports src/config/progressMerge.ts and progressSchema.ts DIRECTLY — the same files the client
// runs — so there is exactly ONE merge implementation and exactly one schema. That is the whole reason
// those modules are kept free of `window`, `Date.now()` and `crypto`.
//
// CONFLICT PROTOCOL: optimistic concurrency on the server's own `rev`. A PUT whose `baseRev` doesn't
// match gets 409 WITH the current blob, the client merges (a proper CRDT join, so it provably
// converges) and re-PUTs.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors, isAllowedOrigin, logServerError, rateLimit } from '../lib/server-utils.js'
import { adapter, requireSession } from '../lib/session.js'
import {
  normalizePersisted,
  progressInvariantViolations,
  type PersistedProgress,
} from '../src/config/progressSchema.js'
import { mergeProgress } from '../src/config/progressMerge.js'

interface ProgressRow {
  id: string
  profileId: string
  doc: PersistedProgress
  rev: number
  epoch: number
  updatedAt: Date
}

interface ProfileRow {
  id: string
  userId: string
  deletedAt: Date | null
}

/**
 * ANTI-ROLLBACK: every ledger entry is monotonic by construction (a device only ever increments its
 * own), so an incoming document whose entry went BACKWARDS is either a stale replay or a tamper.
 * Rejecting it is the anti-tamper floor at family scale — cheap, and it can't punish honest play.
 */
function wentBackwards(prev: PersistedProgress, next: PersistedProgress): string | null {
  // A HIGHER epoch is a declared reset and is allowed to drop everything (§6.2c).
  if (next.sync.epoch > prev.sync.epoch) return null
  if (next.sync.epoch < prev.sync.epoch) return 'epoch went backwards'
  for (const [device, before] of Object.entries(prev.ledger)) {
    const after = next.ledger[device]
    if (!after) return `ledger entry ${device} disappeared`
    if (after.xp < before.xp) return `ledger[${device}].xp went backwards`
    if (after.slots < before.slots) return `ledger[${device}].slots went backwards`
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' })

  const session = await requireSession(req, res)
  if (!session) return
  // Generous: a busy household syncs on every round plus a 5-minute poll per device.
  if (!rateLimit(req, res, { scope: 'progress', limit: 240, windowMs: 60_000, subject: session.userId })) {
    return
  }

  try {
    const db = await adapter()

    const profileId =
      req.method === 'GET'
        ? (req.query.profileId as string | undefined)
        : ((req.body ?? {}) as { profileId?: unknown }).profileId

    if (typeof profileId !== 'string' || !profileId) {
      return res.status(400).json({ error: 'profileId is required' })
    }

    // Ownership: a profile id is not a capability. A soft-deleted child is treated as gone.
    const profile = await db.findOne<ProfileRow>({
      model: 'childProfile',
      where: [{ field: 'id', value: profileId }],
    })
    if (!profile || profile.userId !== session.userId || profile.deletedAt) {
      return res.status(404).json({ error: 'Ukendt profil' })
    }

    const existing = await db.findOne<ProgressRow>({
      model: 'profileProgress',
      where: [{ field: 'profileId', value: profileId }],
    })

    if (req.method === 'GET') {
      // 404 = never synced. The client then just pushes its local state as the first version.
      if (!existing) return res.status(404).json({ error: 'Ingen fremgang gemt endnu' })
      return res.status(200).json({
        rev: Number(existing.rev),
        epoch: existing.epoch,
        updatedAt: new Date(existing.updatedAt).getTime(),
        blob: existing.doc,
      })
    }

    if (req.method === 'PUT') {
      const body = (req.body ?? {}) as { baseRev?: unknown; blob?: unknown }
      const incoming = normalizePersisted(body.blob)
      if (!incoming) return res.status(400).json({ error: 'blob is not a valid v4 document' })
      const violations = progressInvariantViolations(incoming)
      if (violations.length) {
        console.warn('[progress] refused a blob violating its invariants', violations.slice(0, 3))
        return res.status(422).json({ error: 'blob failed validation', violations })
      }
      const baseRev = Number(body.baseRev) || 0

      if (!existing) {
        const created = await db.create<Record<string, unknown>, ProgressRow>({
          model: 'profileProgress',
          data: {
            profileId,
            doc: incoming,
            rev: 1,
            epoch: incoming.sync.epoch,
            updatedAt: new Date(),
          },
        })
        return res.status(200).json({ rev: Number(created.rev) })
      }

      const serverRev = Number(existing.rev)
      if (baseRev !== serverRev) {
        // The client is behind. Hand back the current document so it can merge and retry — bounded to
        // 3 attempts client-side, and the join guarantees convergence.
        return res.status(409).json({ rev: serverRev, blob: existing.doc })
      }

      const stored = normalizePersisted(existing.doc)
      if (stored) {
        const regression = wentBackwards(stored, incoming)
        if (regression) {
          console.warn('[progress] refused a regressing blob:', regression)
          return res.status(409).json({ rev: serverRev, blob: existing.doc, reason: regression })
        }
        // Merge server-side too, not just trust the client: this endpoint is the only place that sees
        // every device, so a merge here is the cheapest guarantee that nothing is ever dropped.
        const { merged } = mergeProgress(stored, incoming, {
          now: Date.now(),
          deviceId: 'server',
        })
        const nextRev = serverRev + 1
        await db.update({
          model: 'profileProgress',
          where: [{ field: 'profileId', value: profileId }],
          update: { doc: merged, rev: nextRev, epoch: merged.sync.epoch, updatedAt: new Date() },
        })
        return res.status(200).json({ rev: nextRev })
      }

      const nextRev = serverRev + 1
      await db.update({
        model: 'profileProgress',
        where: [{ field: 'profileId', value: profileId }],
        update: { doc: incoming, rev: nextRev, epoch: incoming.sync.epoch, updatedAt: new Date() },
      })
      return res.status(200).json({ rev: nextRev })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    await logServerError(req, 'Progress', error)
    return res.status(500).json({ error: 'Synkronisering mislykkedes' })
  }
}
