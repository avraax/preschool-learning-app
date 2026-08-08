// "Is this database allowed to be destroyed?" — the one gate the seed and wipe scripts share.
//
// THE DATABASE DECLARES ITS OWN TIER. A one-row `blTier` table holds the literal `staging`, written by
// `staging:init` and by nothing else, and every destructive script reads it before opening its mouth.
//
// WHY A MARKER AND NOT A URL COMPARISON. The obvious guard is negative — "this DATABASE_URL is not
// production's" — and it is wrong twice over: it requires production's Neon host to be committed to the
// repo, where it does not belong, and it silently stops protecting anything the day Neon rotates the
// endpoint (which the marketplace integration can do without telling us). A marker inverts it. The
// database itself says what it is, the check fails CLOSED on absence, and **production is never touched
// at all** — no marker to add, no migration to run, no connection to open. Same shape as
// `isEmailAllowed()`: an empty list means nobody, not everybody.
//
// scripts/ rather than lib/, deliberately, so no Vercel function can ever reach this module — nothing
// here should exist in the deployed runtime.

import pg from 'pg'

export const TIER_TABLE = 'blTier'
export const EXPECTED_TIER = 'staging'

/**
 * A pool for whatever `DATABASE_URL` names. Deliberately NOT `lib/db.ts`: that module is a singleton
 * built for the serverless runtime, and a script that may exit non-zero should own its own connection
 * and close it.
 */
export function scriptPool() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('[db-tier] DATABASE_URL is not set — run through `node --env-file=.env.local`')
  }
  return new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 10_000 })
}

/** Host only, for logging. A connection string carries the password. */
export function dbHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host
  } catch {
    return '(unparseable DATABASE_URL)'
  }
}

/**
 * Read the marker. Returns the tier string, or `null` when the table does not exist or is empty.
 *
 * A missing table is NOT an error here — it is the normal state of a database this tooling has never
 * touched, i.e. production. It becomes an error in `assertStagingDatabase`.
 */
export async function readTierMarker(pool) {
  const { rows } = await pool.query(`select "tier" from "${TIER_TABLE}" limit 1`).catch((e) => {
    // 42P01 = undefined_table, and ONLY that. Anything else — a permissions error, a dead connection —
    // is a real failure and must not be swallowed into "absent": that would turn an unknown into a
    // confident verdict, which is the three-outcome rule this repo keeps relearning.
    if (e && e.code === '42P01') return { rows: [] }
    throw e
  })
  return rows.length ? String(rows[0].tier) : null
}

/**
 * The gate. Refuses unless the database says, in its own tables, that it is staging.
 *
 * Every destructive script calls this BEFORE it opens a pool for its real work — `lib/tier.test.ts`
 * greps for that ordering, because a script that connects first and checks second has already had the
 * chance to be pointed at the wrong place.
 */
export async function assertStagingDatabase(pool) {
  const marker = await readTierMarker(pool)
  if (marker === EXPECTED_TIER) return

  const why =
    marker === null
      ? `it carries no "${TIER_TABLE}" marker at all`
      : `its marker says ${JSON.stringify(marker)}, not ${JSON.stringify(EXPECTED_TIER)}`
  throw new Error(
    `[db-tier] REFUSING to touch ${dbHost()}: ${why}.\n` +
      `  A database with no marker is production, or something worse. Only \`npm run staging:init\`\n` +
      `  may write the marker, and only against a database that is empty and declares BL_TIER=staging.`,
  )
}

/** `BL_TIER=staging` in the process environment — a second, independent condition for `staging:init`. */
export function assertStagingEnv() {
  if (process.env.BL_TIER?.trim() !== 'staging') {
    throw new Error(
      `[db-tier] BL_TIER is ${JSON.stringify(process.env.BL_TIER ?? null)}, not "staging".\n` +
        `  Run through \`node --env-file=.env.local\` with .env.local pointed at staging (§8 step 5).`,
    )
  }
}
