import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  APP_OPEN_EVENT,
  ROUTE_EVENTS,
  USAGE_EVENTS,
  eventForPath,
  isAppVersion,
  isUsageEvent,
} from './usageEvents.ts'

// The allow-list is the ONLY thing bounding the size of `usage_counter`, because `/api/usage` is
// unauthenticated (it has to be — a gated endpoint would count signed-in adults and miss every guest).
// If an unknown string can reach the table, cardinality is chosen by whoever is posting. Every test
// here defends that one property, plus the mapping that feeds it.

test('the allow-list is populated and has no duplicates', () => {
  // A list that silently emptied would make `isUsageEvent` reject everything and the counter would
  // look "working" while writing nothing at all.
  assert.ok(USAGE_EVENTS.length > 20, `only ${USAGE_EVENTS.length} events`)
  assert.equal(new Set(USAGE_EVENTS).size, USAGE_EVENTS.length, 'duplicate event key')
})

test('the allow-list is CLOSED', () => {
  for (const known of USAGE_EVENTS) assert.ok(isUsageEvent(known), `rejected known event ${known}`)
  for (const unknown of [
    'route:does_not_exist',
    'app_open ',
    'APP_OPEN',
    '',
    "'; DROP TABLE usage_counter; --",
    '../../etc/passwd',
    'route:' + 'x'.repeat(5000),
  ]) {
    assert.equal(isUsageEvent(unknown), false, `accepted unknown event ${JSON.stringify(unknown)}`)
  }
  for (const notAString of [null, undefined, 42, {}, [], true]) {
    assert.equal(isUsageEvent(notAString), false, `accepted non-string ${String(notAString)}`)
  }
})

test('every production route in App.tsx maps to an event', () => {
  const src = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
  const paths: string[] = []
  for (const line of src.split('\n')) {
    // DEV-only routes are stripped from a production build and must NOT be counted — matching them
    // here would demand event keys for screens no child can reach.
    if (line.includes('import.meta.env.DEV')) continue
    const m = /<Route\s+path="([^"]+)"/.exec(line)
    if (m) paths.push(m[1])
  }

  assert.ok(paths.length > 25, `route scrape found only ${paths.length} — the regex has drifted`)

  for (const p of paths) {
    // `*` is the 404 and has no screen identity worth counting.
    if (p === '*') continue
    // The memory routes are parameterised; they are covered by their own test below.
    if (p.includes(':')) continue
    assert.ok(
      eventForPath(p),
      `route ${p} exists in App.tsx but has no entry in ROUTE_EVENTS — add one or exclude it deliberately`,
    )
  }
})

test('the memory routes map by TYPE and ignore the size segment', () => {
  assert.equal(eventForPath('/learning/memory/letters'), 'route:memory_letters')
  assert.equal(eventForPath('/learning/memory/numbers'), 'route:memory_numbers')
  // `:size` is ignored by the game too (Difficulty PRD-01 W5).
  assert.equal(eventForPath('/learning/memory/letters/12'), 'route:memory_letters')
  assert.equal(eventForPath('/learning/memory/numbers/6'), 'route:memory_numbers')
})

test('an unknown or attacker-shaped path reports NOTHING', () => {
  // The whole point: a path segment is user-controlled, so it must never become a row.
  for (const p of [
    '/learning/memory/<script>',
    "/learning/memory/'; DROP TABLE usage_counter; --",
    '/learning/memory/letters/12/extra',
    '/dev/scene',
    '/audit',
    '/nope',
    '/alphabet/quiz/../../admin',
    '',
  ]) {
    assert.equal(eventForPath(p), null, `path ${JSON.stringify(p)} produced an event`)
  }
})

test('a trailing slash is the same screen, and "/" survives', () => {
  assert.equal(eventForPath('/math/'), eventForPath('/math'))
  assert.equal(eventForPath('/'), 'route:home')
})

test('app_open is in the list and is not a route', () => {
  assert.ok(isUsageEvent(APP_OPEN_EVENT))
  assert.ok(!Object.values(ROUTE_EVENTS).includes(APP_OPEN_EVENT))
})

test('app_version is the second cardinality channel and is pinned shut', () => {
  // The real one must pass, or the endpoint drops every write on the floor.
  const { BUILD_INFO } = JSON.parse(
    JSON.stringify({ BUILD_INFO: { version: readVersion() } }),
  ) as { BUILD_INFO: { version: string } }
  assert.ok(isAppVersion(BUILD_INFO.version), `the shipped version ${BUILD_INFO.version} is rejected`)

  for (const bad of [
    '1.0',
    '1.0.45-beta',
    'v1.0.45',
    '1.0.45 ',
    "1.0.45'; DROP TABLE usage_counter; --",
    '11111.0.0',
    '1.0.' + '9'.repeat(40),
    '',
  ]) {
    assert.equal(isAppVersion(bad), false, `accepted bad version ${JSON.stringify(bad)}`)
  }
  for (const notAString of [null, undefined, 1.045, {}, []]) {
    assert.equal(isAppVersion(notAString), false, `accepted non-string ${String(notAString)}`)
  }
})

function readVersion(): string {
  const src = readFileSync(new URL('./version.ts', import.meta.url), 'utf8')
  const m = /version:\s*'([^']+)'/.exec(src)
  assert.ok(m, 'could not read the version out of src/config/version.ts')
  return m![1]
}
