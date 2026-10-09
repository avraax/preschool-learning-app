// Re-engagement PRD-01 §4 — the service against an in-memory plugin. No iOS here: what these pin is the
// POLICY (when the card shows, when anything is scheduled, what a reschedule leaves pending) and the
// one plugin behaviour that would bite silently — `schedule()` raising the iOS dialog by itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PREFS_KEY,
  ReminderService,
  createFakePlugin,
  parsePrefs,
  reconcilePrefs,
  shouldOffer,
  shouldSchedule,
  type KeyValueStorage,
  type PermState,
  type ReminderEnv,
} from './reminders.ts'
import { REMINDER_IDS, TEST_REMINDER_ID } from '../config/reminderSchedule.ts'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

function harness(mode: 'prompt' | 'prompt-deny' | 'granted' | 'denied', stored?: object) {
  const fake = createFakePlugin(mode)
  const storage = memoryStorage(stored ? { [PREFS_KEY]: JSON.stringify(stored) } : {})
  const reports: string[] = []
  const env: ReminderEnv = {
    available: () => true,
    loadPlugin: async () => ({ plugin: fake.plugin }),
    loadLauncher: async () => ({ plugin: fake.launcher }),
    storage: () => storage,
    now: () => new Date(2026, 9, 9, 12, 0),
    context: () => ({ name: 'Emil', isGuest: false, near: true }),
    report: (s) => reports.push(s),
  }
  return { svc: new ReminderService(env), fake, storage, reports }
}

const pendingIds = (log: { pending: { id: number }[] }) => log.pending.map((p) => p.id).sort()

// ---- pure policy ---------------------------------------------------------------------------------

test('shouldOffer: only unasked by us AND unasked by iOS', () => {
  const perms: (PermState | null)[] = ['prompt', 'prompt-with-rationale', 'granted', 'denied', null]
  for (const prompt of ['unasked', 'yes', 'not_now'] as const) {
    for (const perm of perms) {
      const expected = prompt === 'unasked' && (perm === 'prompt' || perm === 'prompt-with-rationale')
      assert.equal(shouldOffer({ prompt, enabled: false }, perm), expected, `${prompt}/${perm}`)
    }
  }
})

test('shouldSchedule: the adult said yes AND iOS granted — nothing else', () => {
  assert.equal(shouldSchedule({ prompt: 'yes', enabled: true }, 'granted'), true)
  assert.equal(shouldSchedule({ prompt: 'yes', enabled: true }, 'prompt'), false)
  assert.equal(shouldSchedule({ prompt: 'yes', enabled: true }, 'denied'), false)
  assert.equal(shouldSchedule({ prompt: 'yes', enabled: true }, null), false)
  assert.equal(shouldSchedule({ prompt: 'yes', enabled: false }, 'granted'), false)
})

test('parsePrefs tolerates garbage as "never asked"', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{"prompt":"maybe","enabled":"yes"}']) {
    assert.deepEqual(parsePrefs(raw), { prompt: 'unasked', enabled: false }, String(raw))
  }
  assert.deepEqual(parsePrefs('{"prompt":"not_now","enabled":false}'), { prompt: 'not_now', enabled: false })
})

test('reconcilePrefs adopts an existing iOS grant, never overrides an answer', () => {
  assert.deepEqual(reconcilePrefs({ prompt: 'unasked', enabled: false }, 'granted'), { prompt: 'yes', enabled: true })
  const declined = { prompt: 'not_now' as const, enabled: false }
  assert.equal(reconcilePrefs(declined, 'granted'), declined)
  const unasked = { prompt: 'unasked' as const, enabled: false }
  assert.equal(reconcilePrefs(unasked, 'denied'), unasked)
})

// ---- the service ---------------------------------------------------------------------------------

test('a fresh iPad: the card is on offer, and boot schedules NOTHING and asks iOS NOTHING', async () => {
  const h = harness('prompt')
  await h.svc.start()
  assert.equal(h.svc.canOffer(), true)
  assert.equal(h.fake.log.requests, 0, 'boot raised the iOS dialog — schedule() was called on an unasked device')
  assert.deepEqual(h.fake.log.pending, [])
})

test('"Ja tak" → iOS dialog → granted → exactly our three are pending', async () => {
  const h = harness('prompt')
  await h.svc.start()
  const perm = await h.svc.acceptFromPrompt()
  assert.equal(perm, 'granted')
  assert.equal(h.fake.log.requests, 1)
  assert.deepEqual(pendingIds(h.fake.log), [...REMINDER_IDS])
  assert.deepEqual(h.reports, ['yes', 'granted'])
  assert.equal(h.svc.canOffer(), false)
  assert.deepEqual(JSON.parse(h.storage.data[PREFS_KEY]), { prompt: 'yes', enabled: true })
})

test('"Ja tak" → iOS denied → nothing pending, and the card never returns', async () => {
  const h = harness('prompt-deny')
  await h.svc.start()
  assert.equal(await h.svc.acceptFromPrompt(), 'denied')
  assert.deepEqual(h.fake.log.pending, [])
  assert.deepEqual(h.reports, ['yes', 'denied'])
  assert.equal(h.svc.canOffer(), false)
})

test('"Ikke nu" is final: never offered again, even after a restart', async () => {
  const h = harness('prompt')
  await h.svc.start()
  h.svc.declineFromPrompt()
  assert.equal(h.svc.canOffer(), false)
  assert.equal(h.fake.log.requests, 0, '"Ikke nu" must not burn the one-shot iOS dialog')
  // A new app start reads the same storage.
  const again = harness('prompt', JSON.parse(h.storage.data[PREFS_KEY]))
  await again.svc.start()
  assert.equal(again.svc.canOffer(), false)
  assert.deepEqual(again.fake.log.pending, [])
})

test('iOS already denied: no card, nothing scheduled', async () => {
  const h = harness('denied')
  await h.svc.start()
  assert.equal(h.svc.canOffer(), false)
  assert.deepEqual(h.fake.log.pending, [])
})

test('iOS already granted on a never-asked iPad: adopted as yes and scheduled', async () => {
  const h = harness('granted')
  await h.svc.start()
  assert.equal(h.svc.canOffer(), false)
  assert.deepEqual(pendingIds(h.fake.log), [...REMINDER_IDS])
})

test('every reschedule REPLACES ours — never accumulates — and keeps the test reminder', async () => {
  const h = harness('granted', { prompt: 'yes', enabled: true })
  await h.svc.start()
  assert.equal(await h.svc.scheduleTest(), true)
  for (let i = 0; i < 4; i++) await h.svc.reschedule()
  assert.deepEqual(pendingIds(h.fake.log), [...REMINDER_IDS, TEST_REMINDER_ID].sort())
})

// ---- time travel: the "7 days after the LAST open", "three, then nothing" rules over weeks ----------

/** A family's iPad over several weeks: one storage, one iOS (the fake), a clock we move by hand. */
function timeline(start: Date) {
  const fake = createFakePlugin('granted')
  const storage = memoryStorage({ [PREFS_KEY]: JSON.stringify({ prompt: 'yes', enabled: true }) })
  let now = start
  /** iOS delivering what is due: a delivered request is no longer pending. */
  const advanceTo = (d: Date) => {
    now = d
    const delivered = fake.log.pending.filter((p) => p.at.getTime() <= now.getTime())
    fake.log.pending = fake.log.pending.filter((p) => p.at.getTime() > now.getTime())
    return delivered
  }
  /** A cold start of the app at the current moment — a fresh service, the same iPad. */
  const open = async () => {
    const svc = new ReminderService({
      available: () => true,
      loadPlugin: async () => ({ plugin: fake.plugin }),
      loadLauncher: async () => null,
      storage: () => storage,
      now: () => now,
      context: () => ({ name: 'Emil', isGuest: false, near: false }),
      report: () => {},
    })
    await svc.start()
    return svc
  }
  const pendingAt = () => fake.log.pending.map((p) => `${p.id} ${local(p.at)}`).sort()
  return { fake, advanceTo, open, pendingAt }
}

const local = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

test('time travel: ignored → exactly three reminders a week apart, then NOTHING, until the app is opened', async () => {
  const t = timeline(new Date(2026, 9, 9, 12, 0)) // Fri 9 Oct, played at noon
  await t.open()
  assert.deepEqual(t.pendingAt(), ['7101 2026-10-16 16:30', '7102 2026-10-23 16:30', '7103 2026-10-30 16:30'])

  // Nobody opens the app. Each week iOS delivers one — and nothing new is ever added.
  assert.deepEqual(t.advanceTo(new Date(2026, 9, 17, 9, 0)).map((p) => p.id), [7101])
  assert.deepEqual(t.advanceTo(new Date(2026, 9, 24, 9, 0)).map((p) => p.id), [7102])
  assert.deepEqual(t.advanceTo(new Date(2026, 9, 31, 9, 0)).map((p) => p.id), [7103])

  // Months of silence: nothing left to fire, ever, until someone opens the app.
  assert.deepEqual(t.advanceTo(new Date(2027, 2, 1, 9, 0)), [])
  assert.deepEqual(t.pendingAt(), [])

  // The family comes back on Mon 1 Mar 2027 → the cycle restarts from THAT day.
  await t.open()
  assert.deepEqual(t.pendingAt(), ['7101 2027-3-8 16:30', '7102 2027-3-15 16:30', '7103 2027-3-22 16:30'])
})

test('time travel: opening the app after reminder #1 fired re-anchors all three from the new open', async () => {
  const t = timeline(new Date(2026, 9, 9, 12, 0))
  await t.open()
  // Reminder #1 fires Fri 16 Oct; the family opens the app on Mon 19 Oct.
  assert.deepEqual(t.advanceTo(new Date(2026, 9, 19, 17, 0)).map((p) => p.id), [7101])
  await t.open()
  // #2 and #3 from the OLD cycle are gone — no 23 Oct, no 30 Oct — and three new ones follow Monday.
  assert.deepEqual(t.pendingAt(), ['7101 2026-10-26 16:30', '7102 2026-11-2 16:30', '7103 2026-11-9 16:30'])
})

test('time travel: a family that plays every few days NEVER receives a reminder', async () => {
  const t = timeline(new Date(2026, 9, 9, 12, 0))
  await t.open()
  const delivered: number[] = []
  // Plays every 5 days for ten weeks; each open pushes day 7 further out before it is ever reached.
  for (let day = 5; day <= 70; day += 5) {
    delivered.push(...t.advanceTo(new Date(2026, 9, 9 + day, 12, 0)).map((p) => p.id))
    await t.open()
  }
  assert.deepEqual(delivered, [], 'an active family was sent a reminder')
  assert.equal(t.fake.log.pending.length, 3, 'reopening accumulated reminders instead of replacing them')
})

test('switch off → nothing of ours pending; switch on again → three', async () => {
  const h = harness('granted', { prompt: 'yes', enabled: true })
  await h.svc.start()
  await h.svc.setEnabled(false)
  assert.deepEqual(h.fake.log.pending, [])
  await h.svc.setEnabled(true)
  assert.deepEqual(pendingIds(h.fake.log), [...REMINDER_IDS])
  assert.deepEqual(h.reports, ['toggleOff', 'toggleOn'])
})

test('switch on after "Ikke nu" asks iOS (still unasked) and schedules on grant', async () => {
  const h = harness('prompt', { prompt: 'not_now', enabled: false })
  await h.svc.start()
  assert.equal(await h.svc.setEnabled(true), 'granted')
  assert.equal(h.fake.log.requests, 1)
  assert.deepEqual(pendingIds(h.fake.log), [...REMINDER_IDS])
  assert.equal(h.svc.getSnapshot().prefs.prompt, 'not_now', 'the switch must not rewrite the card answer')
})

test('switch on while iOS denies: returns denied, schedules nothing', async () => {
  const h = harness('denied', { prompt: 'not_now', enabled: false })
  await h.svc.start()
  assert.equal(await h.svc.setEnabled(true), 'denied')
  assert.deepEqual(h.fake.log.pending, [])
})

test('the test reminder needs a grant', async () => {
  const h = harness('prompt')
  await h.svc.start()
  assert.equal(await h.svc.scheduleTest(), false)
  assert.deepEqual(h.fake.log.pending, [])
})

test('a plugin that never answers cannot hang the service', async () => {
  const fake = createFakePlugin('granted')
  const never = new Promise<never>(() => {})
  const env: ReminderEnv = {
    available: () => true,
    loadPlugin: async () => ({ plugin: { ...fake.plugin, checkPermissions: () => never, cancel: () => never } }),
    loadLauncher: async () => null,
    storage: () => memoryStorage(),
    now: () => new Date(),
    context: () => ({ name: null, isGuest: true, near: false }),
    report: () => {},
  }
  // Shrink the bound for the test by racing against our own timer: start() must settle at all.
  const svc = new ReminderService(env)
  const settled = await Promise.race([
    svc.start().then(() => 'settled'),
    new Promise((r) => setTimeout(() => r('hung'), 15_000)),
  ])
  assert.equal(settled, 'settled')
  assert.equal(svc.getSnapshot().perm, null, 'an unanswered check must read as UNKNOWN, not as a verdict')
  assert.equal(svc.canOffer(), false, 'UNKNOWN permission must never show the card')
})

test('unavailable (web build): nothing runs at all', async () => {
  const fake = createFakePlugin('prompt')
  let loads = 0
  const svc = new ReminderService({
    available: () => false,
    loadPlugin: async () => {
      loads++
      return { plugin: fake.plugin }
    },
    loadLauncher: async () => null,
    storage: () => memoryStorage(),
    now: () => new Date(),
    context: () => ({ name: null, isGuest: true, near: false }),
    report: () => {},
  })
  await svc.start()
  assert.equal(await svc.reschedule(), 0)
  assert.equal(svc.canOffer(), false)
  assert.equal(loads, 0)
})

test('openSystemSettings opens the app’s own Settings page', async () => {
  const h = harness('denied')
  assert.equal(await h.svc.openSystemSettings(), true)
  assert.deepEqual(h.fake.log.openedUrls, ['app-settings:'])
})
