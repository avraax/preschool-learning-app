// Child-profile CRUD (accounts PRD §4.3).
//
// A child profile is a PLAYABLE IDENTITY, never a credential: it has an emoji avatar, an optional FIRST
// name and nothing else. It is selected, not logged into, and it never authenticates. That is the whole
// data-minimisation story (D9) — no surname, no birthdate, no photo.
//
// DELETE is a SOFT delete. A device that still points at the profile then resolves it to "gone" rather
// than silently falling through to a sibling's book, and the child's progress row survives long enough
// for an accidental deletion to be recoverable.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors, isAllowedOrigin, logServerError, rateLimit } from '../lib/server-utils.js'
import { adapter, requireSession } from '../lib/session.ts'

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
  avatarEmoji: r.avatarEmoji,
  createdAt: new Date(r.createdAt).getTime(),
})

/** A single emoji (possibly with modifiers), and nothing else — never arbitrary markup. */
function cleanAvatar(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s.length > 12) return null
  // Reject anything with ASCII letters/digits/markup; an avatar is a pictograph.
  if (/[a-zA-Z0-9<>&"'/\\]/.test(s)) return null
  return s
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
      const body = (req.body ?? {}) as { name?: unknown; avatarEmoji?: unknown }
      const avatarEmoji = cleanAvatar(body.avatarEmoji)
      if (!avatarEmoji) return res.status(400).json({ error: 'avatarEmoji (one emoji) is required' })

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
      const body = (req.body ?? {}) as { id?: unknown; name?: unknown; avatarEmoji?: unknown }
      if (typeof body.id !== 'string') return res.status(400).json({ error: 'id is required' })
      const row = await owned(body.id)
      if (!row) return res.status(404).json({ error: 'Ukendt profil' })

      const update: Record<string, unknown> = {}
      const name = cleanName(body.name)
      if (name !== undefined) update.name = name
      if (body.avatarEmoji !== undefined) {
        const avatarEmoji = cleanAvatar(body.avatarEmoji)
        if (!avatarEmoji) return res.status(400).json({ error: 'avatarEmoji (one emoji) is required' })
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
