// The staging-tier guards that are not about a single function's return value (staging PRD W8).
//
// `lib/env.test.ts` covers `tier()` and the cross-check that throws. THIS file guards the SHAPE of the
// destructive scripts, because their correctness is an ORDERING property that no unit test of any one
// function can see: `assertStagingDatabase` only protects anything if it runs before the script starts
// issuing statements. A script that queries first and checks second has already had its chance to be
// pointed at the wrong database.
//
// Without these: local work, a seed or a wipe writes the child's REAL Reward Book, and nobody finds out
// until he opens Min Bog.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SCRIPTS = path.join(ROOT, 'scripts')

// Comments stripped FIRST. Every one of these files explains its own guard in prose directly above the
// guard, naming the very identifiers asserted below — so a bare `indexOf` would happily match the
// comment and pass against a file whose code had lost the call. That failure mode has shipped here
// before (`authOverlayZ.test.ts`).
const codeOf = (...rel: string[]): string =>
  readFileSync(path.join(...rel), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/^\s*\/\*\*[\s\S]*?\*\//gm, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const DESTRUCTIVE = ['staging-seed.mjs', 'staging-wipe.mjs']

test('every destructive script GATES before it queries', () => {
  // THE load-bearing assertion in this file.
  for (const file of DESTRUCTIVE) {
    const code = codeOf(SCRIPTS, file)
    const gate = code.indexOf('await assertStagingDatabase(')
    assert.ok(gate > 0, `${file} never calls assertStagingDatabase`)

    const firstQuery = code.indexOf('pool.query(')
    assert.ok(firstQuery > 0, `${file} issues no query at all — is this still the right guard?`)
    assert.ok(
      gate < firstQuery,
      `${file} issues a query at ${firstQuery} BEFORE its gate at ${gate} — the gate protects nothing`,
    )
  }
})

test('the marker is a POSITIVE check, and production is never named', () => {
  // A negative guard ("this DATABASE_URL is not production's") needs production's Neon host committed
  // to the repo, and stops protecting anything the day the marketplace integration rotates the
  // endpoint. The marker inverts it: absence FAILS CLOSED and production is never connected to at all.
  const helper = codeOf(SCRIPTS, 'lib', 'db-tier.mjs')
  assert.match(helper, /export const EXPECTED_TIER = 'staging'/)
  assert.match(helper, /marker === EXPECTED_TIER/, 'the check is not an equality against the marker')
  // 42P01 (undefined_table) is the ONLY error that may be read as "no marker". Swallowing others would
  // turn a permissions failure into a confident verdict.
  assert.match(helper, /e\.code === '42P01'/, 'the missing-table case is not narrowed to 42P01')

  for (const file of [...DESTRUCTIVE, 'staging-init.mjs', 'lib/db-tier.mjs']) {
    const code = codeOf(SCRIPTS, ...file.split('/'))
    assert.ok(
      !/boernelaering\.dk|neon\.tech/.test(code),
      `${file} names a real host — the guard must not depend on knowing production's address`,
    )
  }
})

test('staging:init is the ONLY script that may meet an unmarked database, and it is doubly gated', () => {
  const init = codeOf(SCRIPTS, 'staging-init.mjs')
  // (1) the environment must say staging, and (2) an existing `user` table must be empty. Either alone
  // is too weak: BL_TIER is a local file a session can edit, and an empty database could be anything.
  assert.match(init, /assertStagingEnv\(\)/, 'init does not require BL_TIER=staging')
  assert.match(init, /from "user"/, 'init does not check whether the database is already populated')
  assert.match(init, /count\[0\]\.n > 0 && !marker/, 'the populated-and-unmarked refusal is gone')
  // The marker is written LAST, so a half-applied migration cannot leave a database claiming to be a
  // usable staging one.
  assert.ok(
    init.indexOf('runMigrations()') < init.indexOf('insert into'),
    'the marker is written before the migration runs',
  )
})

test('the wipe keeps the schema and the marker — it empties, it does not reset', () => {
  const wipe = codeOf(SCRIPTS, 'staging-wipe.mjs')
  assert.ok(!/drop table/i.test(wipe), 'the wipe drops tables — it must only delete rows')
  const tables = wipe.match(/const TABLES = \[([\s\S]*?)\]/)?.[1] ?? ''
  assert.ok(tables.length > 0, 'no TABLES list found')
  assert.ok(!/blTier/.test(tables), 'the marker table is in the delete list — the wipe would disarm itself')
  // The GUARD, not the word. A bare `/--yes/` was satisfied by the script's own "Re-run with --yes to
  // proceed." message, so it stayed green with the confirmation removed — found by re-breaking.
  assert.match(
    wipe,
    /if \(!process\.argv\.includes\('--yes'\)\)/,
    'the wipe proceeds without an explicit confirmation',
  )
})

test('the scripts own their own pool — never the serverless singleton', () => {
  // `lib/db.ts` is a module-level pool built for Fluid Compute, which reuses instances. A script that
  // may exit non-zero must own and close its connection, and pulling lib/db.ts in would also drag the
  // deployed runtime's assumptions into a local tool.
  for (const file of [...DESTRUCTIVE, 'staging-init.mjs', 'lib/db-tier.mjs']) {
    const code = codeOf(SCRIPTS, ...file.split('/'))
    assert.ok(!/from '\.\.\/lib\/db\./.test(code), `${file} imports lib/db — use scriptPool()`)
  }
})

test('dev:staging refuses a non-staging .env.local, and never kills what it did not start', () => {
  const dev = codeOf(SCRIPTS, 'dev-staging.mjs')
  assert.match(dev, /env\.get\('BL_TIER'\) !== 'staging'/, 'the tier gate is gone')
  // A Vite already on 5173 is a SIBLING SESSION's, and it already serves this working tree. Killing it
  // has broken a sibling before (.claude/rules/working-in-this-tree.md).
  //
  // ASSERT THE SHAPE, NOT THE WORD. A first version of this forbade the string `taskkill` anywhere and
  // went red on the script's own warning message — "Never taskkill node" — i.e. it failed on the text
  // telling the reader not to do the thing. The real invariant is that every kill targets a child THIS
  // script spawned, and that nothing shells out to a process-killer.
  assert.ok(
    !/(spawn|exec|execSync|execFile)\s*\([^)]*(taskkill|pkill|killall)/.test(dev),
    'dev:staging shells out to a process killer',
  )
  assert.ok(!/process\.kill\(/.test(dev), 'dev:staging kills by raw PID rather than by child handle')
  const killLines = dev.split('\n').filter((l) => /\.kill\(/.test(l))
  assert.ok(killLines.length > 0, 'nothing is ever killed — Ctrl-C would orphan both servers')
  for (const l of killLines) {
    assert.match(
      l,
      /for \(const c of children\)[\s\S]*c\.kill\(/,
      `a kill is not scoped to this script's own children: ${l.trim()}`,
    )
  }
  assert.match(dev, /portBusy/, 'the port check is gone — it would fight a sibling for 5173')
  // The Neon HOST is printed, never the connection string: this output lands in scrollback and in
  // pasted bug reports.
  assert.match(dev, /new URL\(url\)\.host/, 'the database line no longer prints host-only')
  assert.ok(!/DATABASE_URL\}/.test(dev), 'the raw DATABASE_URL is interpolated into output')
})

test('the seed REUSES the progress model rather than hand-building a document', () => {
  // A hand-built document tests the seeder, not the app. `xpForSlots` is the same function the
  // `?rewards=n` dev harness uses, so a seeded profile is indistinguishable from a played one — and it
  // was hand-copied into four places once already, which silently corrupted the screenshot baseline.
  const seed = codeOf(SCRIPTS, 'staging-seed.mjs')
  assert.match(seed, /defaultPersisted\(/, 'the seed builds its own document shape')
  assert.match(seed, /xpForSlots\(/, 'the seed computes XP itself instead of using the real curve')
  assert.match(seed, /normalizeAvatarId\(/, 'the seed does not validate the avatar id')
  // The column is called avatarEmoji and holds an ID. Writing a glyph back is the documented trap.
  assert.ok(!/avatarEmoji.*emoji/i.test(seed), 'the seed may be writing a glyph into avatarEmoji')
  // …and the result is checked with the REAL invariant checker before it is written, AND acted on.
  // Position alone is not enough: `const violations = []` leaves the identifier sitting in the file at
  // the right offset while validating nothing, which is exactly what a re-break produced.
  assert.match(
    seed,
    /const violations = progressInvariantViolations\(doc\)/,
    'the seeded document is never validated',
  )
  assert.match(seed, /if \(violations\.length\)/, 'the validation result is computed and ignored')
  assert.ok(
    seed.indexOf('progressInvariantViolations(doc)') < seed.indexOf('insert into "profileProgress"'),
    'the document is written before it is validated',
  )
})
