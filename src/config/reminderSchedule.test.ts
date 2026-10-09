// Re-engagement PRD-01 §2 / §4: the schedule and the copy, as pure functions.
//
// The DST cases are the reason this pins a timezone: a millisecond-offset implementation is correct in
// every week but two a year, and only a zone that HAS a switch can see it. Node honours a runtime
// `process.env.TZ` change for Date's local-time methods.
process.env.TZ = 'Europe/Copenhagen'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REMINDER_BODIES,
  REMINDER_IDS,
  REMINDER_PROMPT,
  TEST_REMINDER_ID,
  buildReminders,
  isNear,
  reminderBody,
  reminderTimes,
  sendTimeAfter,
  type ReminderContext,
} from './reminderSchedule.ts'

const local = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

test('a Friday open → three reminders on the next three Fridays at 16:30', () => {
  const fri = new Date(2026, 9, 2, 19, 45) // Fri 2 Oct 2026, evening play
  assert.deepEqual(reminderTimes(fri).map(local), ['2026-10-9 16:30', '2026-10-16 16:30', '2026-10-23 16:30'])
})

test('a weekend day gets the 10:00 send time', () => {
  const sat = new Date(2026, 9, 3, 8, 0) // Sat 3 Oct
  assert.deepEqual(reminderTimes(sat).map(local), ['2026-10-10 10:00', '2026-10-17 10:00', '2026-10-24 10:00'])
  const sun = new Date(2026, 9, 4, 20, 0)
  assert.equal(local(sendTimeAfter(sun, 7)), '2026-10-11 10:00')
})

test('the late-October DST switch does not move the send time', () => {
  // Wed 21 Oct 2026; Europe leaves summer time on Sun 25 Oct. Day 7 is Wed 28 Oct — after the switch.
  const before = new Date(2026, 9, 21, 12, 0)
  const at = sendTimeAfter(before, 7)
  assert.equal(local(at), '2026-10-28 16:30')
  // The tell of a millisecond offset is an hour's drift, so pin the wall-clock hour explicitly.
  assert.equal(at.getHours(), 16)
})

test('the late-March DST switch does not move the send time', () => {
  // Wed 25 Mar 2026; summer time begins Sun 29 Mar.
  const at = sendTimeAfter(new Date(2026, 2, 25, 9, 0), 7)
  assert.equal(local(at), '2026-4-1 16:30')
})

test('reminders always land in the future, a week apart at most-by-a-day', () => {
  const now = new Date(2026, 9, 9, 23, 59)
  const times = reminderTimes(now)
  assert.ok(times[0].getTime() > now.getTime())
  for (let i = 1; i < times.length; i++) {
    const gapDays = Math.round((times[i].getTime() - times[i - 1].getTime()) / 86_400_000)
    assert.equal(gapDays, 7)
  }
})

test('isNear: half the ring or more, unless the book is full', () => {
  assert.equal(isNear(0.49, 3, 90), false)
  assert.equal(isNear(0.5, 3, 90), true)
  assert.equal(isNear(0.9, 3, 90), true)
  assert.equal(isNear(0.9, 90, 90), false)
  assert.equal(isNear(Number.NaN, 0, 90), false)
})

const ctx = (over: Partial<ReminderContext> = {}): ReminderContext => ({
  name: 'Emil',
  isGuest: false,
  near: false,
  ...over,
})

test('reminder #1 names a named child only when near', () => {
  assert.equal(reminderBody(0, ctx({ near: true })), REMINDER_BODIES.nearNamed('Emil'))
  assert.ok(reminderBody(0, ctx({ near: true })).startsWith('Emil '))
  assert.equal(reminderBody(0, ctx({ near: false })), REMINDER_BODIES.generalA)
})

test('a guest is never called "Gæst" — the guest profile name is literally that', () => {
  for (const near of [true, false]) {
    for (let i = 0; i < 3; i++) {
      const body = reminderBody(i, ctx({ name: 'Gæst', isGuest: true, near }))
      assert.ok(!body.includes('Gæst'), `#${i} near=${near}: ${body}`)
    }
  }
  assert.equal(reminderBody(0, ctx({ name: 'Gæst', isGuest: true, near: true })), REMINDER_BODIES.nearGuest)
  // A blank name on a non-guest is the neutral line too, never "  er tæt på".
  assert.equal(reminderBody(0, ctx({ name: '  ', near: true })), REMINDER_BODIES.nearGuest)
  assert.equal(reminderBody(0, ctx({ name: null, near: true })), REMINDER_BODIES.nearGuest)
})

test('reminders #2 and #3 never repeat the progress line', () => {
  for (const i of [1, 2]) {
    const body = reminderBody(i, ctx({ near: true }))
    assert.ok(!body.includes('klistermærke'), `#${i + 1}: ${body}`)
    assert.ok(!body.includes('Emil'), `#${i + 1}: ${body}`)
  }
  assert.notEqual(reminderBody(1, ctx()), reminderBody(2, ctx()))
})

test('no copy carries a digit — never a distance or a count', () => {
  const all = [
    REMINDER_BODIES.nearNamed('Emil'),
    REMINDER_BODIES.nearGuest,
    REMINDER_BODIES.generalA,
    REMINDER_BODIES.generalB,
    REMINDER_BODIES.generalC,
    ...[0, 1, 2].flatMap((i) => [reminderBody(i, ctx({ near: true })), reminderBody(i, ctx())]),
  ]
  for (const s of all) assert.ok(!/\d/.test(s), `digit in: ${s}`)
})

test('the pre-prompt addresses the adult and promises what the schedule does', () => {
  assert.equal(REMINDER_PROMPT.overline, 'Til den voksne')
  assert.match(REMINDER_PROMPT.body, /højst én om ugen/)
  assert.match(REMINDER_PROMPT.body, /tre i træk/)
  assert.match(REMINDER_PROMPT.body, /Indstillinger/) // 4.5.4: say where to opt out
  assert.equal(REMINDER_PROMPT.yes, 'Ja tak')
  assert.equal(REMINDER_PROMPT.no, 'Ikke nu')
})

test('buildReminders uses the three fixed ids, in order, and never the test id', () => {
  const reqs = buildReminders(new Date(2026, 9, 9, 12, 0), ctx({ near: true }))
  assert.deepEqual(reqs.map((r) => r.id), [...REMINDER_IDS])
  assert.ok(!reqs.some((r) => r.id === TEST_REMINDER_ID))
  assert.equal(new Set(reqs.map((r) => r.at.getTime())).size, 3)
  assert.ok(reqs.every((r) => r.title === 'Børnelæring'))
})
