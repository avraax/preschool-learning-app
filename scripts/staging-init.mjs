// `npm run staging:init` — create the schema on a fresh staging database and MARK it as staging.
//
// The only script permitted to run against a database with no marker, so it carries two extra
// conditions that the others do not need:
//
//   1. `BL_TIER=staging` in the environment, and
//   2. the `user` table must be absent or EMPTY.
//
// (2) is the load-bearing one. An existing, populated database with no marker is production or
// something worse, and the whole design rests on never touching it. Idempotent: safe to re-run.

import { assertStagingEnv, dbHost, readTierMarker, scriptPool, TIER_TABLE, EXPECTED_TIER } from './lib/db-tier.mjs'

assertStagingEnv()

const pool = scriptPool()
console.log(`[staging:init] database ${dbHost()}`)

try {
  const marker = await readTierMarker(pool)
  if (marker && marker !== EXPECTED_TIER) {
    throw new Error(`refusing: the marker already says ${JSON.stringify(marker)}`)
  }

  // THE EMPTINESS CHECK, before anything is written. `to_regclass` returns null for a missing table
  // rather than throwing, so absent and empty take the same branch.
  const { rows: reg } = await pool.query(`select to_regclass('public."user"') as t`)
  if (reg[0].t) {
    const { rows: count } = await pool.query(`select count(*)::int as n from "user"`)
    if (count[0].n > 0 && !marker) {
      throw new Error(
        `refusing: "user" already holds ${count[0].n} row(s) and there is no "${TIER_TABLE}" marker.\n` +
          `  A populated database with no marker is production, or something worse. If this really is\n` +
          `  a staging database that predates the marker, add it by hand — deliberately, once.`,
      )
    }
  }

  // 1. The better-auth schema: core tables, the passkey table, the rateLimit model and the five family
  //    tables declared in lib/auth-family-plugin.ts. Reuses the SAME path `npm run auth:migrate` takes,
  //    rather than a second copy of the DDL that could drift from the plugin's own declaration.
  const { getMigrations } = await import('better-auth/db/migration')
  const { auth } = await import('../lib/auth.ts')
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options)
  if (toBeCreated.length || toBeAdded.length) {
    console.log(
      `[staging:init] creating ${toBeCreated.length} table(s), adding ${toBeAdded.length} column set(s)`,
    )
    await runMigrations()
  } else {
    console.log('[staging:init] schema already up to date')
  }

  // 2. The marker. Written LAST, so a half-applied migration never leaves a database claiming to be a
  //    usable staging one.
  await pool.query(`create table if not exists "${TIER_TABLE}" ("tier" text primary key)`)
  await pool.query(
    `insert into "${TIER_TABLE}" ("tier") values ($1) on conflict do nothing`,
    [EXPECTED_TIER],
  )
  console.log(`[staging:init] marker "${TIER_TABLE}" = ${EXPECTED_TIER}`)
  console.log('[staging:init] done — seed with: npm run staging:seed -- --children "Emil:fox:12"')
} finally {
  await pool.end()
}
