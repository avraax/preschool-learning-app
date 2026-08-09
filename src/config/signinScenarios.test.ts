import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// NO ROW OF THE SCENARIO MATRIX MAY GO QUIETLY UNCOVERED (sign-in reliability PRD W8).
//
// The matrix in `docs/auth/signin-scenarios.md` is only worth writing if it cannot drift: a row that
// stops being covered, or a row that is deleted because nothing covers it, must fail here rather than
// disappear. Both directions matter — a silently absent row reads exactly like a passing one.
//
// This also carries B6's own assertion, which has no better home: it is a property of the client's
// storage shape rather than of any one module's behaviour.

const MATRIX = 'docs/auth/signin-scenarios.md'
const doc = readFileSync(MATRIX, 'utf8').replace(/\r\n/g, '\n')

/** Every row id in PRD §6, restated here so a row removed from the doc fails instead of vanishing. */
const ROWS = [
  ...['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  ...['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
  ...['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12'],
  ...['D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
  ...['E1', 'E2', 'E3', 'E4', 'E5'],
]

/** The rows of the markdown tables, as `[id, scenario, evidence, rung]`. */
const tableRows = doc
  .split('\n')
  .filter((line) => /^\| [A-E]\d/.test(line))
  .map((line) =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim()),
  )

test('the matrix parses at all', () => {
  // A parse that silently finds nothing would make every assertion below vacuous.
  assert.equal(tableRows.length, ROWS.length, `parsed ${tableRows.length} rows, expected ${ROWS.length}`)
  for (const cells of tableRows) assert.equal(cells.length, 4, `malformed row: ${cells.join(' | ')}`)
})

test('every scenario in PRD §6 has a row', () => {
  const present = tableRows.map((c) => c[0])
  for (const id of ROWS) {
    assert.ok(present.includes(id), `scenario ${id} has no row in ${MATRIX} — it may not be silently absent`)
  }
  // And no invented ones: a row for a scenario the PRD does not define means the two have drifted.
  for (const id of present) assert.ok(ROWS.includes(id), `${MATRIX} has a row ${id} that PRD §6 does not define`)
  assert.equal(new Set(present).size, present.length, 'a scenario id appears twice')
})

test('every row states EVIDENCE and the RUNG it came from', () => {
  for (const [id, , evidence, rung] of tableRows) {
    assert.ok(evidence.length > 12, `${id}: evidence is empty or a placeholder — ${JSON.stringify(evidence)}`)
    // A rung, or an explicit UNKNOWN. "Unverified is not broken; say UNKNOWN" (CLAUDE.md) — what is
    // forbidden is a row that implies coverage without naming where it came from.
    assert.match(
      rung,
      /\b[123]\b|UNKNOWN/,
      `${id}: no rung and no UNKNOWN — a claim must name the rung it came from`,
    )
    // A bare "3" would mean "the owner checked it", which nothing in this session can assert.
    assert.doesNotMatch(rung, /^3$/, `${id}: claims rung 3, which only the owner can supply`)
  }
})

test('an UNKNOWN row gives its reason', () => {
  const unknowns = tableRows.filter(([, , , rung]) => /UNKNOWN/.test(rung))
  assert.ok(unknowns.length > 0, 'no row is UNKNOWN — suspicious, since the iPad is out of reach here')
  for (const [id, , evidence, rung] of unknowns) {
    // The reason may sit in either cell — a partially-covered row usually states what IS covered in the
    // evidence column and what is not in the rung column.
    assert.match(
      `${evidence} ${rung}`,
      /needs|not covered|not driven|real |whether/i,
      `${id}: marked UNKNOWN without saying why`,
    )
  }
})

test('B6: exactly one pending flow can exist on a device', () => {
  // Two sign-ins started back-to-back must not leave the FIRST claimable into a half-state. It cannot:
  // the client keeps one flow under one key, so the second start overwrites the first and the first
  // flowId is simply gone from this device — unclaimable rather than partly claimable. The server row
  // survives until it expires and the next `/oauth/start` sweeps it, which is harmless because a claim
  // requires the flowId nobody holds any more.
  const src = readFileSync('src/services/authSignIn.ts', 'utf8')
  assert.match(src, /export const OAUTH_FLOW_KEY = 'bl-oauth-flow'/)
  const writes = readFileSync('src/services/googleSignIn.ts', 'utf8').match(/localStorage\.setItem\(/g) ?? []
  assert.equal(writes.length, 1, 'more than one thing writes the pending flow — the single-slot argument breaks')
  // And the key must not be parameterised by provider or attempt, which would allow two live flows.
  assert.doesNotMatch(src, /OAUTH_FLOW_KEY = `/, 'the flow key became a template — two flows could coexist')
})
