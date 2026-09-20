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
// THE CLIENT STILL CANNOT SUPPLY A NUMBER. Requests now carry a BATCH, but as a list of event NAMES,
// not as counts: the server counts occurrences itself. So the three dimensions of a poisoned request
// are each bounded — the allow-list caps WHICH rows can exist, `MAX_EVENTS_PER_REQUEST` caps how much
// one request can add, and the rate limit caps how many requests arrive. A `{event, count}` shape
// would have handed the middle one to the caller.
//
// WHAT IS HONESTLY NOT SOLVED: an open counter is poisonable. Anyone who reads the shipped bundle can
// post valid events and inflate a number. The controls here BOUND that but do not prevent it. A
// secret baked into a distributed binary would be obfuscation, not security, so there isn't one.

import type { VercelRequest, VercelResponse } from '@vercel/node'
// `.js`, NOT `.ts` — Vercel compiles each file to a sibling `.js` and rewrites no specifiers, so a
// `.ts` specifier here is a production-only ERR_MODULE_NOT_FOUND. Pinned by `lib/serverImports.test.ts`.
import { applyCors, isAllowedOrigin, rateLimit } from '../lib/server-utils.js'
import { query } from '../lib/db.js'
import { MAX_EVENTS_PER_REQUEST, isAppVersion, isUsageEvent } from '../src/config/usageEvents.js'

/**
 * Sized against the CLIENT'S FLUSH INTERVAL, not against a guess about screens.
 *
 * The first version was 120/hour, chosen as "a child entering a screen every 30 seconds for an hour" —
 * i.e. exactly the worst case, with zero headroom. Two children in one household share an address and
 * hit it in half an hour; CGNAT puts several families in one bucket; and dev's StrictMode doubles
 * every route event. It fired during ordinary local play.
 *
 * Batching does NOT fix that on its own: a 30-second flush sets a FLOOR of ~120 requests/hour per
 * actively-playing child, which is the old ceiling exactly. 600 gives four children continuous play
 * with room to spare, and still bounds a flood to 600 invocations/hour/IP, which costs nothing. The
 * allow-list already caps table growth, so this limiter is a cost guard, not a correctness one.
 */
const RATE = { scope: 'usage', limit: 600, windowMs: 60 * 60 * 1000 } as const

/**
 * `events` is the batch shape. `event` is the ORIGINAL single-event shape, still accepted because a
 * TestFlight build may already be in the field carrying it — the shell is bundled with no OTA path
 * (`capacitor.config.ts`), so a binary that shipped with the old shape can never be updated to the
 * new one and would otherwise just stop counting, silently.
 */
const ALLOWED_KEYS = ['event', 'events', 'appVersion']

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
    // A body this large is not one of ours — 50 short event names never approach it.
    if (raw.length > 4096) return null
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

/**
 * The validated events in a body, as name → count.
 *
 * Unknown names are DROPPED individually rather than rejecting the batch: one stale event key from an
 * older build must not throw away the twenty valid ones beside it.
 */
function tally(body: Record<string, unknown>): Map<string, number> {
  const counts = new Map<string, number>()
  const raw = Array.isArray(body.events)
    ? body.events.slice(0, MAX_EVENTS_PER_REQUEST)
    : [body.event]
  for (const e of raw) {
    if (!isUsageEvent(e)) continue
    counts.set(e, (counts.get(e) ?? 0) + 1)
  }
  return counts
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
    if (body && Object.keys(body).every((k) => ALLOWED_KEYS.includes(k)) && isAppVersion(body.appVersion)) {
      const counts = tally(body)
      if (counts.size) {
        await ensureTable()
        // One statement for the whole batch. `unnest` pairs the two arrays into rows; the counts come
        // from OUR tally of validated names, never from the request.
        await query(
          `INSERT INTO usage_counter (day, event, app_version, n)
           SELECT CURRENT_DATE, t.event, $1, t.n
           FROM unnest($2::text[], $3::bigint[]) AS t(event, n)
           ON CONFLICT (day, event, app_version)
           DO UPDATE SET n = usage_counter.n + EXCLUDED.n`,
          [body.appVersion, [...counts.keys()], [...counts.values()]],
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
