import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  APP_OPEN_EVENT,
  PRE_DOOR_ROUTE_EVENTS,
  ROUTE_EVENTS,
  USAGE_EVENTS,
  eventForPath,
  isAppVersion,
  isUsageEvent,
} from './usageEvents.ts'
import { DOORS } from './doors.ts'
import { ADULT_IA } from './adultSettingsIa.ts'
import { SETTINGS_PANE_EVENTS } from './usageEvents.ts'

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

// ---- the 1.3 door rename -------------------------------------------------------------------------
//
// Four doors replaced six home cards and a merged door lives at its primary section's OLD menu route,
// so `/alphabet` and `/farver` changed what they mean and the other two changed their denominator.
// Nothing in a row shows that, so the names carry it. These tests exist so a later tidy-up cannot
// quietly re-merge the two eras.

test('with the doors up, every door menu reports a door event', () => {
  for (const door of DOORS) {
    const event = eventForPath(door.route, true)
    assert.ok(event, `door ${door.id} at ${door.route} reports nothing`)
    assert.ok(
      event!.startsWith('route:door_'),
      `the ${door.id} door still reports ${event} — a pre-door name on a post-door screen`,
    )
  }
  // All four, and distinct: a door that shared a key with another would be worse than the old names.
  const doorEvents = DOORS.map((d) => eventForPath(d.route, true))
  assert.equal(new Set(doorEvents).size, DOORS.length, 'two doors report the same event')
})

test('with the doors still gated, the SAME paths report the six-card names', () => {
  // This is the half that matters before release: `master` deploys the web on every push, so this
  // build serves a six-card home for days. A door name from that page would contaminate the split.
  for (const [path, event] of Object.entries(PRE_DOOR_ROUTE_EVENTS)) {
    assert.equal(eventForPath(path, false), event, `${path} reports the wrong era`)
    // And the default is the gated world, so a caller that forgets the flag errs the harmless way.
    assert.equal(eventForPath(path), event, `${path} defaults to the post-door name`)
  }
  assert.equal(Object.keys(PRE_DOOR_ROUTE_EVENTS).length, 4, 'four menus were renamed, no more, no less')
  // Every door route must be in both maps, or one era reports a screen the other does not.
  for (const door of DOORS) {
    assert.ok(PRE_DOOR_ROUTE_EVENTS[door.route], `${door.route} has no pre-door name`)
  }
})

test('both eras are ACCEPTED by the endpoint, and no name serves two of them', () => {
  // A 1.0–1.2 iPad that never takes the update goes on posting the old names for years; dropping one
  // would discard that family's counts while the endpoint kept answering 204.
  for (const event of Object.values(PRE_DOOR_ROUTE_EVENTS)) {
    assert.ok(isUsageEvent(event), `the endpoint would now DROP ${event} from an older build`)
  }
  // Disjoint by construction — the whole point. A shared name and a row could no longer say which
  // front page it came from.
  const post = new Set(DOORS.map((d) => eventForPath(d.route, true)))
  for (const event of Object.values(PRE_DOOR_ROUTE_EVENTS)) {
    assert.ok(!post.has(event), `${event} is emitted by BOTH eras`)
  }
  // The non-door routes are era-independent: a game is the same game behind either front page.
  assert.equal(eventForPath('/alphabet/quiz', true), eventForPath('/alphabet/quiz', false))
  assert.equal(eventForPath('/album', true), ROUTE_EVENTS['/album'])
})

// ---- the settings panes --------------------------------------------------------------------------

test('there is exactly one key per settings group, plus feedback — and it cannot drift from the IA', () => {
  // The keys are spelled out in `usageEvents.ts` because that module must stay import-free for
  // `api/usage.ts`. This is the join that keeps the hand-written copy honest: add a rail group and
  // this fails until it gets a key; delete one and it fails until the key goes.
  const groups = ADULT_IA.map((g) => g.id).sort()
  const keys = Object.keys(SETTINGS_PANE_EVENTS).filter((k) => k !== 'feedback').sort()
  assert.deepEqual(keys, groups, 'SETTINGS_PANE_EVENTS no longer mirrors the settings IA')
  // `feedback` is the rail FOOTER, deliberately not an AdultGroupId — so it must be present here and
  // absent there, or one of the two has quietly changed shape.
  assert.ok(SETTINGS_PANE_EVENTS.feedback, 'the feedback door is no longer counted')
  assert.ok(!groups.includes('feedback' as never), 'feedback became a settings GROUP — check the IA guard')
})

test('the settings counter is ONE PER PANE, never one per control', () => {
  for (const event of Object.values(SETTINGS_PANE_EVENTS)) {
    assert.ok(isUsageEvent(event), `${event} would be dropped by the endpoint`)
    assert.match(event, /^settings:[a-z]+$/, `${event} is not a bare pane key`)
  }
  // No key may name an ITEM. The danger blocks in particular stay uncounted by construction: at
  // single-digit volumes "someone pressed Slet kontoen helt" plus a date is the most identifying
  // thing this table could hold. `.` is how every item id in the IA is spelled (`barn.delete`).
  const items = ADULT_IA.flatMap((g) => g.items.map((i) => i.id))
  for (const id of items) {
    assert.ok(
      !isUsageEvent(`settings:${id}`),
      `the item ${id} has its own event — this counter counts panes, not controls`,
    )
  }
  assert.equal(Object.keys(SETTINGS_PANE_EVENTS).length, 7, 'the pane set changed size')
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
