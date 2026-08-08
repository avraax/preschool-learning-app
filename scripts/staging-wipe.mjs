// `npm run staging:wipe -- --yes` — empty the staging database, keeping the schema and the marker.
//
// Prints the row counts it is about to delete and refuses to proceed without `--yes`, because the
// blast radius of pointing this at the wrong place is the child's whole Reward Book. The marker check
// runs FIRST and is what actually makes that impossible; `--yes` only stops an absent-minded run
// against the right database.

import { assertStagingDatabase, dbHost, scriptPool, TIER_TABLE } from './lib/db-tier.mjs'

const pool = scriptPool()

// THE GATE, before any other statement.
await assertStagingDatabase(pool)

// Children before parents: every family table cascades from `user`, but deleting explicitly (and in
// dependency order) means the printed counts are the truth rather than an implication, and it keeps
// working if a cascade is ever relaxed.
const TABLES = [
  'profileProgress',
  'childProfile',
  'familyPin',
  'pinAttempt',
  'oauthFlow',
  'passkey',
  'session',
  'account',
  'verification',
  'rateLimit',
  'user',
]

console.log(`[staging:wipe] database ${dbHost()}`)

try {
  let total = 0
  const counts = []
  for (const t of TABLES) {
    // A table that does not exist yet is not a failure — `staging:init` may simply not have created it
    // on this database. Report it, don't crash.
    const { rows: reg } = await pool.query(`select to_regclass($1) as t`, [`public."${t}"`])
    if (!reg[0].t) {
      counts.push([t, null])
      continue
    }
    const { rows } = await pool.query(`select count(*)::int as n from "${t}"`)
    counts.push([t, rows[0].n])
    total += rows[0].n
  }

  for (const [t, n] of counts) {
    console.log(`  ${t.padEnd(16)} ${n === null ? '(no such table)' : n}`)
  }
  console.log(`  ${'TOTAL'.padEnd(16)} ${total}`)

  if (!process.argv.includes('--yes')) {
    console.log(`\n[staging:wipe] nothing deleted. Re-run with --yes to proceed.`)
    process.exit(0)
  }
  if (total === 0) {
    console.log('\n[staging:wipe] already empty — nothing to do.')
    process.exit(0)
  }

  for (const [t, n] of counts) {
    if (n === null || n === 0) continue
    await pool.query(`delete from "${t}"`)
  }
  // The marker is NOT in that list and must survive: a wipe leaves a usable staging database, not an
  // unmarked one that every later script would then refuse to touch.
  const { rows: marker } = await pool.query(`select "tier" from "${TIER_TABLE}" limit 1`)
  if (!marker.length) throw new Error(`[staging:wipe] the "${TIER_TABLE}" marker was lost — re-run staging:init`)

  console.log(`\n[staging:wipe] deleted ${total} row(s); schema and marker (${marker[0].tier}) intact.`)
} finally {
  await pool.end()
}
