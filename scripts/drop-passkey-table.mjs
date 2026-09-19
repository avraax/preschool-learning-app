// `npm run db:drop-passkey -- --yes` — drop the orphaned `passkey` table.
//
// ONE-SHOT, and deliberately not part of any automatic path. Face ID / Touch ID was removed from the
// app on 2026-09-19 (owner: too early to carry it), which took the `@better-auth/passkey` plugin with
// it. better-auth's migration only ever CREATES, so the table it made is left behind, holding
// credentials nothing can use any more. This drops it.
//
// WHY IT IS NOT GATED ON THE STAGING MARKER, unlike `staging:wipe`. Production needs this too, and
// `assertStagingDatabase()` exists precisely to make production unreachable. So the guard here is a
// different shape: it PRINTS which host and which tier it is about to touch, refuses without `--yes`,
// and is a no-op when the table is already gone. Read the two lines it prints before typing --yes.
//
// Run it once per tier, each with that tier's DATABASE_URL in `.env.local`:
//   npm run db:drop-passkey              → report only
//   npm run db:drop-passkey -- --yes     → drop it
//
// Losing this table loses nothing an adult can still use: every account signs in with Google (or
// Apple), and the four-digit code is unaffected.

import { dbHost, readTierMarker, scriptPool } from './lib/db-tier.mjs'

const pool = scriptPool()

try {
  const tier = await readTierMarker(pool)
  console.log(`[drop-passkey] database ${dbHost()}`)
  console.log(`[drop-passkey] tier marker: ${tier ?? '(none — this is production, or a fresh database)'}`)

  const { rows: reg } = await pool.query(`select to_regclass($1) as t`, ['public."passkey"'])
  if (!reg[0].t) {
    console.log('[drop-passkey] no "passkey" table here — nothing to do.')
    process.exit(0)
  }

  const { rows } = await pool.query('select count(*)::int as n from "passkey"')
  console.log(`[drop-passkey] "passkey" exists and holds ${rows[0].n} credential(s).`)

  if (!process.argv.includes('--yes')) {
    console.log('\n[drop-passkey] nothing dropped. Re-run with --yes to proceed.')
    process.exit(0)
  }

  await pool.query('drop table "passkey"')
  console.log('\n[drop-passkey] dropped.')
} finally {
  await pool.end()
}
