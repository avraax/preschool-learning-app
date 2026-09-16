// The origin has to survive the round trip through a folder name, and legacy paths have to keep
// resolving — a report stored before 2026-09-16 is still the record of a real fault.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  folderHasId,
  originForType,
  parseReportFolder,
  reportFolder,
  UNKNOWN_ORIGIN,
} from './report-paths.ts'

test('a manual report is filed as FEEDBACK, because that is what the door is called', () => {
  assert.equal(originForType('manual'), 'feedback')
  assert.equal(reportFolder('manual', 'M4QP2'), 'feedback-M4QP2')
})

test('the two automatic origins keep their own words', () => {
  assert.equal(reportFolder('crash', 'R7K3F'), 'crash-R7K3F')
  assert.equal(reportFolder('auth', 'T8W1K'), 'auth-T8W1K')
})

test('an unrecognised type is recorded as unknown, never guessed into a real origin', () => {
  for (const bad of [undefined, null, '', 'feedback', 'Manual', 42, {}]) {
    assert.equal(originForType(bad), UNKNOWN_ORIGIN, `${String(bad)} was not treated as unknown`)
  }
  // 'feedback' is the OUTPUT vocabulary, not the input one — a payload claiming it is not a known type.
  assert.equal(reportFolder('feedback', 'ABCDE'), 'ukendt-ABCDE')
})

test('the id is upper-cased, or a lookup would find it only by luck', () => {
  assert.equal(reportFolder('manual', 'm4qp2'), 'feedback-M4QP2')
})

test('a new folder round-trips', () => {
  for (const [type, origin] of [
    ['manual', 'feedback'],
    ['crash', 'crash'],
    ['auth', 'auth'],
  ] as const) {
    const parsed = parseReportFolder(reportFolder(type, 'M4QP2'))
    assert.deepEqual(parsed, { origin, id: 'M4QP2' })
  }
})

test('a LEGACY bare-id folder still resolves, and reports origin as ABSENT not unknown', () => {
  // null ≠ 'ukendt'. The first means the path does not say (open the JSON and read `type`); the
  // second is a recorded verdict. Collapsing them would invent an answer for every old report.
  assert.deepEqual(parseReportFolder('M4QP2'), { origin: null, id: 'M4QP2' })
  assert.notEqual(parseReportFolder('M4QP2').origin, UNKNOWN_ORIGIN)
})

test('a dash that is not an origin is part of the id, not a prefix', () => {
  // The id alphabet has no dash, so this cannot occur today — but a folder named `foo-M4QP2` must not
  // be silently reinterpreted as origin `foo`.
  assert.deepEqual(parseReportFolder('foo-M4QP2'), { origin: null, id: 'foo-M4QP2' })
  assert.deepEqual(parseReportFolder('-M4QP2'), { origin: null, id: '-M4QP2' })
})

test('the id lookup matches BOTH shapes, case-insensitively', () => {
  assert.ok(folderHasId('feedback-M4QP2', 'M4QP2'))
  assert.ok(folderHasId('M4QP2', 'M4QP2'), 'a legacy report became unfindable')
  assert.ok(folderHasId('crash-M4QP2', 'm4qp2'))
  assert.ok(!folderHasId('feedback-M4QP2', 'R7K3F'))
  // The prefix must never be mistakable for the id.
  assert.ok(!folderHasId('feedback-M4QP2', 'feedback'))
})

test('both writers use the helper — the dev mirror cannot drift from production', () => {
  // `dev-server.js` mirrors `api/bug-report.ts`, and the two silently disagreeing is the standing
  // hazard with this endpoint (`.claude/rules/api-endpoints.md`). A path scheme is exactly the kind
  // of thing that gets changed in one and not the other.
  const root = path.join(import.meta.dirname, '..')
  for (const rel of ['api/bug-report.ts', 'dev-server.js']) {
    const src = readFileSync(path.join(root, rel), 'utf8')
    assert.match(src, /reportFolder\(/, `${rel} builds its own report path instead of using reportFolder()`)
    assert.match(src, /parseReportFolder\(|folderHasId\(/, `${rel} parses paths by hand`)
  }

  // AND NO WRITE MAY USE THE BARE ID AS THE FOLDER. Merely importing the helper is not using it:
  // `/re-break` reverted the `report.json` path to `${date}/${id}/` and the assertions above stayed
  // green, because `reportFolder(` was still present on the screenshot path and in a log line. Every
  // report would have been filed under an un-prefixed folder while the screenshot beside it got a
  // prefixed one — the two would not even have been in the same directory.
  const prod = readFileSync(path.join(root, 'api/bug-report.ts'), 'utf8')
  assert.doesNotMatch(
    prod,
    /\$\{date\}\/\$\{id\}\//,
    'api/bug-report.ts writes a bare-id folder somewhere — the origin would be missing from that path',
  )
  const dev = readFileSync(path.join(root, 'dev-server.js'), 'utf8')
  assert.doesNotMatch(
    dev,
    /path\.join\(BUG_DIR,\s*date,\s*id\)/,
    'dev-server.js writes a bare-id folder — the dev mirror has drifted from production',
  )
})
