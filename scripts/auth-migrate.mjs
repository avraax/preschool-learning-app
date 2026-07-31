// Apply the better-auth schema (core tables + the passkey plugin + our own `family` plugin tables)
// to Neon.
//
// This is the programmatic equivalent of `npx @better-auth/cli migrate`, kept in-repo so the schema
// is reproducible from `npm run auth:migrate` and so our plugin-declared tables (child_profile,
// profile_progress, family_pin, pin_attempt, oauth_flow) come along in the SAME migration — they are
// declared in lib/auth-family-plugin.ts's `schema`, which is what makes that work.
//
// Usage:
//   npm run auth:migrate            → print the SQL that WOULD run (safe, read-only)
//   npm run auth:migrate -- --apply → actually run it
//
// Idempotent: better-auth diffs the live schema and only creates what's missing.

import { getMigrations } from 'better-auth/db/migration'
import { auth } from '../lib/auth.ts'

const apply = process.argv.includes('--apply')

const { toBeCreated, toBeAdded, runMigrations, compileMigrations } = await getMigrations(auth.options)

const describe = (list) =>
  list.map((t) => `  ${t.table} (${Object.keys(t.fields).join(', ')})`).join('\n') || '  (none)'

console.log('Tables to create:\n' + describe(toBeCreated))
console.log('Columns to add:\n' + describe(toBeAdded))

if (!toBeCreated.length && !toBeAdded.length) {
  console.log('\nSchema is already up to date.')
  process.exit(0)
}

if (!apply) {
  console.log('\n--- SQL (dry run; pass --apply to execute) ---\n')
  console.log(await compileMigrations())
  process.exit(0)
}

await runMigrations()
console.log('\nMigration applied.')
process.exit(0)
