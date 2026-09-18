// The anonymous usage counter (`docs/usage-analytics.md` §6B). Write-only, unauthenticated by
// necessity, and deliberately incapable of storing a person.
//
// WHY THERE IS NO AUTH. `/api/auth/family/access-token` sits behind `sessionMiddleware`, so only a
// signed-in adult can mint one. Gating this on it would count signed-in adults and miss every guest —
// and guests are the entire population this exists to see, since signed-in users are already visible
// in the database. So the endpoint is open, and every control below exists because of that.
//
// WHY IT CANNOT STORE A PERSON. The table has four columns — day, event, version, count — and no
// column an identifier could go in. The write is an increment, never an insert of a record. That is
// what makes the data anonymous under GDPR Recital 26 by CONSTRUCTION rather than by promise, and it
// is why adding any per-user or per-session column here would quietly move the whole feature into a
// different legal regime (see §6C of the doc before anyone tries).
//
// WHAT IS HONESTLY NOT SOLVED: an open counter is poisonable. Anyone who reads the shipped bundle can
// post valid events and inflate a number. The controls here BOUND that — cardinality is capped by the
// allow-list, rate is capped per caller, the increment is always exactly one, and with no read
// endpoint there is no feedback loop — but they do not prevent it. A secret baked into a distributed
// binary would be obfuscation, not security, so there isn't one.

import type { VercelRequest, VercelResponse } from '@vercel/node'
// `.js`, NOT `.ts` — Vercel compiles each file to a sibling `.js` and rewrites no specifiers, so a
// `.ts` specifier here is a production-only ERR_MODULE_NOT_FOUND. Pinned by `lib/serverImports.test.ts`.
import { applyCors, isAllowedOrigin, rateLimit } from '../lib/server-utils.js'
import { query } from '../lib/db.js'
import { isAppVersion, isUsageEvent } from '../src/config/usageEvents.js'

/**
 * Generous enough that a long sitting never hits it (a child entering a new screen every 30 seconds
 * for an hour sends ~120), tight enough to bound a flood. A whole family behind one address shares
 * the bucket, which is acceptable: losing counts is the designed failure mode.
 */
const RATE = { scope: 'usage', limit: 120, windowMs: 60 * 60 * 1000 } as const

/** Two keys, exactly. Anything else and the body is discarded unread. */
const ALLOWED_KEYS = ['event', 'appVersion']

/**
 * DDL on demand rather than a migration script, guarded so it costs one statement per cold start.
 *
 * This is a deliberate departure from `npm run auth:migrate`, and the reason is the 2026-09-05 outage:
 * sign-in was dead in production for a day because a migration had only ever been run against
 * staging, and nothing connected the deploy to the migration. better-auth's migrator only diffs its
 * own declared models (which always carry an `id`, fighting a composite-key counter), so this table
 * would have needed a second script — exactly the kind nobody runs. Creating it here makes drift
 * between the two tiers structurally impossible.
 */
let ensured = false

async function ensureTable(): Promise<void> {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS usage_counter (
      day         date   NOT NULL,
      event       text   NOT NULL,
      app_version text   NOT NULL,
      n           bigint NOT NULL DEFAULT 0,
      PRIMARY KEY (day, event, app_version)
    )
  `)
  ensured = true
}

/** Vercel hands back a parsed object; `dev-server.js` (express.json) does too, but be defensive. */
function readBody(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    // A body this large is not one of ours — two short fields never approach it.
    if (raw.length > 1024) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(req, res)
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return void res.status(204).end()
  if (req.method !== 'POST') return void res.status(405).json({ error: 'Method not allowed' })
  if (!isAllowedOrigin(req)) return void res.status(403).json({ error: 'Forbidden origin' })
  // Writes the 429 itself on refusal.
  if (!rateLimit(req, res, RATE)) return

  // FROM HERE THE ANSWER IS ALWAYS 204, whatever the body was and whatever the database did. A
  // counter must not tell a prober which of its inputs was the invalid one, and it must not report a
  // database fault to a child's device. Every rejection below is silent on purpose.
  try {
    const body = readBody(req.body)
    if (body && Object.keys(body).every((k) => ALLOWED_KEYS.includes(k))) {
      const { event, appVersion } = body
      // The two gates that cap cardinality. Both are shared with the client so the two agree on
      // exactly one definition of a valid event.
      if (isUsageEvent(event) && isAppVersion(appVersion)) {
        await ensureTable()
        // Parameterised, and the increment is a server-side literal — the caller can never supply a
        // number, only cause a +1. `CURRENT_DATE` means the row is dated by us, to the day.
        await query(
          `INSERT INTO usage_counter (day, event, app_version, n)
           VALUES (CURRENT_DATE, $1, $2, 1)
           ON CONFLICT (day, event, app_version)
           DO UPDATE SET n = usage_counter.n + 1`,
          [event, appVersion],
        )
      }
    }
  } catch {
    // Swallowed, and NOT routed through `logServerError`: a transient database blip on a counter is
    // not worth a log entry per request, and the error text carries the connection host.
    ensured = false
  }

  res.status(204).end()
}
