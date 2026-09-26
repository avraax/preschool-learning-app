// Neon Postgres (eu-central-1 / Frankfurt) connection pool.
//
// One module-level pool: Fluid Compute reuses function instances, so a per-request pool would pay a
// TLS handshake every time. `vercel.json` sets regions: ["fra1"] so this connection is a
// same-region hop rather than a transatlantic one.

import pg from 'pg'
import { requireEnv } from './env.js'

/**
 * node-postgres currently treats `sslmode=require` (what Vercel's injected Neon URL uses) as
 * `verify-full`, but warns it will adopt the weaker libpq semantics in pg v9. Pin the intent
 * explicitly so a future dependency bump can't silently downgrade our TLS verification
 * (accounts PRD §0 gotcha for W1).
 */
function connectionString(raw: string): string {
  const url = new URL(raw)
  const mode = url.searchParams.get('sslmode')
  if (!mode || mode === 'require') url.searchParams.set('sslmode', 'verify-full')
  return url.toString()
}

/** A pool for any Neon URL, with the same TLS pinning and idle-error guard as the main one. */
export function createPool(rawUrl: string): pg.Pool {
  const p = new pg.Pool({
    connectionString: connectionString(rawUrl),
    // Small: we're behind Neon's own pooler (`-pooler` host) and a family-scale app never needs
    // more than a couple of concurrent statements per instance.
    max: 4,
    // Longer than the usage counter's 30 s client flush, so a warm instance REUSES its connection.
    // Measured against staging Neon, one write every 30 s: 10 s idle → 262 ms median (a fresh TLS
    // handshake every time), 120 s → 32 ms. Kept well under Neon's 5-minute suspend so an idle
    // connection cannot meaningfully extend how long the compute stays awake.
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
  })
  // An idle-client error must never take the process down (Neon closes idle connections).
  p.on('error', (err) => console.error('[db] idle client error', err.message))
  return p
}

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) pool = createPool(requireEnv('DATABASE_URL'))
  return pool
}

/** Typed one-shot query helper for OUR tables (better-auth talks to the pool itself). */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[])
  return res.rows
}

/** Single row or null — the shape almost every call site here wants. */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}
