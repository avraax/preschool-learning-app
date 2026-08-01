// Child-profile CRUD (accounts PRD §4.3).
//
// A child profile is a PLAYABLE IDENTITY, never a credential: it has an avatar, an optional FIRST
// name and nothing else. It is selected, not logged into, and it never authenticates. That is the whole
// data-minimisation story (D9) — no surname, no birthdate, no photo.
//
// The avatar is an ID from the closed `AVATAR_IDS` set (de-emoji PRD-01) — `'fox'`, not `'🦊'` — and the
// baked portrait is resolved client-side. The DB COLUMN is still named `avatarEmoji` because renaming
// it would mean a migration against the owner's live Neon database for zero behavioural gain; the
// mapping to the `avatarId` wire field happens here, at the only boundary that touches the row shape.
//
// DELETE is a SOFT delete. A device that still points at the profile then resolves it to "gone" rather
// than silently falling through to a sibling's book, and the child's progress row survives long enough
// for an accidental deletion to be recoverable.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors, isAllowedOrigin, logServerError, rateLimit } from '../lib/server-utils.js'
import { adapter, requireSession } from '../lib/session.ts'
import {
  AVATAR_IDS,
  LEGACY_AVATAR_GLYPHS as LEGACY_GLYPHS,
  isAvatarId,
  normalizeAvatarId,
} from '../src/config/avatars.ts'

const MAX_PROFILES = 8
const MAX_NAME_LENGTH = 24

interface ChildProfileRow {
  id: string
  userId: string
  name: string | null
  avatarEmoji: string
  createdAt: Date
  deletedAt: Date | null
}

const publicShape = (r: ChildProfileRow) => ({
  id: r.id,
  name: r.name ?? undefined,
  // Rows written before the baked avatars hold the glyph; normalise so a client only ever sees an id.
  avatarId: normalizeAvatarId(r.avatarEmoji),
  createdAt: new Date(r.createdAt).getTime(),
})

const AVATAR_ERROR = `avatarId must be one of: ${AVATAR_IDS.join(', ')}`

/**
 * An id from the closed set, and nothing else.
 *
 * An ALLOW-LIST, not a pattern (the old rule was "reject ASCII, an avatar is a pictograph" — exactly
 * backwards now that avatars ARE ascii ids). The set is small, fixed and shared with the client via
 * `src/config/avatars.ts`, so nothing outside it has any reason to reach the column. A legacy glyph is
 * still accepted on the way in and stored as its id, so a client running older JS mid-deploy is not
 * rejected — but an unrecognised glyph is refused rather than silently defaulting to a fox.
 */
function cleanAvatar(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s.length > 24) return null
  if (isAvatarId(s)) return s
  return LEGACY_GLYPHS.has(s) ? normalizeAvatarId(s) : null
}

/** Optional FIRST name only. Empty → stored as absent. */
function cleanName(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string') return undefined
  const s = v.trim().replace(/\s+/g, ' ')
  if (!s) return null
  return s.slice(0, MAX_NAME_LENGTH)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden origin' })

  const session = await requireSession(req, res)
  if (!session) return
  // Keyed on the ACCOUNT, so one household's activity can't rate-limit another behind the same NAT.
  if (!rateLimit(req, res, { scope: 'profiles', limit: 60, windowMs: 60_000, subject: session.userId })) {
    return
  }

  try {
    const db = await adapter()
    const owned = async (id: string): Promise<ChildProfileRow | null> => {
      const row = await db.findOne<ChildProfileRow>({
        model: 'childProfile',
        where: [{ field: 'id', value: id }],
      })
      // Ownership check on every mutation: an id is not a capability.
      return row && row.userId === session.userId && !row.deletedAt ? row : null
    }

    if (req.method === 'GET') {
      const rows = await db.findMany<ChildProfileRow>({
        model: 'childProfile',
        where: [{ field: 'userId', value: session.userId }],
        sortBy: { field: 'createdAt', direction: 'asc' },
      })
      return res.status(200).json({ profiles: rows.filter((r) => !r.deletedAt).map(publicShape) })
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as { name?: unknown; avatarId?: unknown }
      const avatarEmoji = cleanAvatar(body.avatarId)
      if (!avatarEmoji) return res.status(400).json({ error: AVATAR_ERROR })

      const existing = await db.findMany<ChildProfileRow>({
        model: 'childProfile',
        where: [{ field: 'userId', value: session.userId }],
      })
      if (existing.filter((r) => !r.deletedAt).length >= MAX_PROFILES) {
        return res.status(409).json({ error: 'For mange profiler' })
      }

      const name = cleanName(body.name)
      const created = await db.create<Record<string, unknown>, ChildProfileRow>({
        model: 'childProfile',
        data: {
          userId: session.userId,
          name: name ?? null,
          avatarEmoji,
          createdAt: new Date(),
          deletedAt: null,
        },
      })
      return res.status(200).json({ profile: publicShape(created) })
    }

    if (req.method === 'PATCH') {
      const body = (req.body ?? {}) as { id?: unknown; name?: unknown; avatarId?: unknown }
      if (typeof body.id !== 'string') return res.status(400).json({ error: 'id is required' })
      const row = await owned(body.id)
      if (!row) return res.status(404).json({ error: 'Ukendt profil' })

      const update: Record<string, unknown> = {}
      const name = cleanName(body.name)
      if (name !== undefined) update.name = name
      if (body.avatarId !== undefined) {
        const avatarEmoji = cleanAvatar(body.avatarId)
        if (!avatarEmoji) return res.status(400).json({ error: AVATAR_ERROR })
        update.avatarEmoji = avatarEmoji
      }
      if (!Object.keys(update).length) return res.status(200).json({ profile: publicShape(row) })

      const updated = await db.update<ChildProfileRow>({
        model: 'childProfile',
        where: [{ field: 'id', value: row.id }],
        update,
      })
      return res.status(200).json({ profile: publicShape(updated ?? { ...row, ...update }) })
    }

    if (req.method === 'DELETE') {
      const body = (req.body ?? {}) as { id?: unknown }
      const id = typeof body.id === 'string' ? body.id : (req.query.id as string | undefined)
      if (typeof id !== 'string') return res.status(400).json({ error: 'id is required' })
      const row = await owned(id)
      if (!row) return res.status(404).json({ error: 'Ukendt profil' })
      await db.update({
        model: 'childProfile',
        where: [{ field: 'id', value: row.id }],
        update: { deletedAt: new Date() },
      })
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    await logServerError(req, 'Profiles', error)
    return res.status(500).json({ error: 'Profil-handlingen mislykkedes' })
  }
}
