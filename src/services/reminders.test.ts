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
