// The weekly reminder — the shell's one native FEATURE (Re-engagement PRD-01). Everything that touches
// iOS for it is in this file; WHEN and WHAT live in the pure `config/reminderSchedule.ts`.
//
// THE MODEL. One adult opt-in per iPad (`bl.reminders.v1` in localStorage — per device, not per child,
// because the consent is the adult's), plus iOS's own permission. Reminders are scheduled only when
// BOTH say yes. Every reschedule cancels our three fixed ids and re-adds days 7/14/21 from now, so the
// "7 days after the last open", "at most three" and "then silence" rules need no background execution.
//
// WHEN IT RESCHEDULES — and why not on pause. At boot, on every return to the foreground, on a profile
// change and (debounced) on every XP grant. NEVER rely on a background/pause event: whether a suspending
// WKWebView lets an async plugin call finish is unverified, and an await that never settles is this
// repo's signature bug (J62KA, BV9DJ). Every plugin call here is therefore BOUNDED.
//
// THREE TRAPS THAT ARE EASY TO REINTRODUCE:
//   * `LocalNotifications.schedule()` REQUESTS PERMISSION ITSELF when iOS has never asked (plugin
//     8.3+). A reschedule on an unasked device would fire the one-shot system dialog in front of a
//     five-year-old with no card before it. `reschedule` therefore schedules ONLY on `granted`.
//   * A Capacitor plugin proxy is a THENABLE — never return one from an async function. Boxed below.
//   * The import is DYNAMIC: this module is reached by plain-Node tests and by the web build, and a
//     static native import would make the SDK load-bearing for both.
//
// DEV / CHROME. `?fakenotify=prompt|prompt-deny|granted|denied` (DEV builds only) swaps in an in-memory
// plugin so the card, the Indstillinger pane and the schedule can be driven in a browser. What it
// "scheduled" is readable at `window.__blReminders`. A production web build never sees any of this:
// `remindersAvailable()` is false off the shell.

import { isNativeShell } from '../config/runtimeTarget.ts'
import {
  REMINDER_BODIES,
  REMINDER_IDS,
  REMINDER_TITLE,
  TEST_REMINDER_ID,
  buildReminders,
  isNear,
  type ReminderContext,
  type ReminderRequest,
} from '../config/reminderSchedule.ts'
import { REWARD_SLOTS } from '../config/stickers.ts'
import { reportNotifyStep } from './usagePing.ts'
import { xpBus } from './xpBus.ts'
import { progressStore } from './progressStore.ts'
import { GUEST_PROFILE_ID, profileStore } from './profileStore.ts'

// ---- the plugin surface we use -------------------------------------------------------------------

export type PermState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'

export interface NotificationsPlugin {
  checkPermissions(): Promise<{ display: PermState }>
  requestPermissions(): Promise<{ display: PermState }>
  schedule(options: {
    notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; sound?: string }>
  }): Promise<unknown>
  cancel(options: { notifications: Array<{ id: number }> }): Promise<void>
  removeAllDeliveredNotifications(): Promise<void>
  addListener(
    eventName: 'localNotificationActionPerformed',
    listenerFunc: (action: { notification?: { id?: number } }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

export interface LauncherPlugin {
  openUrl(options: { url: string }): Promise<{ completed: boolean }>
}

// ---- persisted adult choice ----------------------------------------------------------------------

export type PromptAnswer = 'unasked' | 'yes' | 'not_now'

export interface ReminderPrefs {
  prompt: PromptAnswer
  enabled: boolean
}

export const PREFS_KEY = 'bl.reminders.v1'
const DEFAULT_PREFS: ReminderPrefs = { prompt: 'unasked', enabled: false }

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Tolerant parse: anything unreadable is "never asked", which is the one safe reading. */
export function parsePrefs(raw: string | null): ReminderPrefs {
  if (!raw) return { ...DEFAULT_PREFS }
  try {
    const v = JSON.parse(raw) as Partial<ReminderPrefs>
    const prompt: PromptAnswer = v.prompt === 'yes' || v.prompt === 'not_now' ? v.prompt : 'unasked'
    return { prompt, enabled: v.enabled === true }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

// ---- pure policy (truth-tabled in reminders.test.ts) ---------------------------------------------

const isAskable = (perm: PermState | null): boolean => perm === 'prompt' || perm === 'prompt-with-rationale'

/** Show OUR card? Only to an iPad iOS has never asked AND whose adult we have never asked. */
export function shouldOffer(prefs: ReminderPrefs, perm: PermState | null): boolean {
  return prefs.prompt === 'unasked' && isAskable(perm)
}

/** Should reminders be pending right now? */
export function shouldSchedule(prefs: ReminderPrefs, perm: PermState | null): boolean {
  return prefs.enabled && perm === 'granted'
}

/**
 * Boot-time reconciliation with what iOS already says. Already `granted` on a device we never asked
 * (a restored backup can carry it) → treat it as a yes rather than showing a card asking for something
 * the adult already gave. Already `denied` → the card can never lead anywhere, so it is never shown.
 */
export function reconcilePrefs(prefs: ReminderPrefs, perm: PermState | null): ReminderPrefs {
  if (prefs.prompt === 'unasked' && perm === 'granted') return { prompt: 'yes', enabled: true }
  return prefs
}

// ---- environment (swappable for tests and the DEV fake) ------------------------------------------

export interface ReminderEnv {
  available: () => boolean
  loadPlugin: () => Promise<{ plugin: NotificationsPlugin } | null>
  loadLauncher: () => Promise<{ plugin: LauncherPlugin } | null>
  storage: () => KeyValueStorage | null
  now: () => Date
  context: () => ReminderContext
  report: (step: Parameters<typeof reportNotifyStep>[0]) => void
}

/** Every plugin call is bounded. `null` = it did not answer in time; callers treat that as UNKNOWN. */
export const PLUGIN_TIMEOUT_MS = 5000
/** The iOS dialog waits on a human, so it gets a long bound — but still a bound. */
export const PERMISSION_DIALOG_TIMEOUT_MS = 120_000

function bounded<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      () => {
        clearTimeout(t)
        resolve(null)
      },
    )
  })
}

function liveContext(): ReminderContext {
  const profile = profileStore.activeProfile()
  const progress = progressStore.xpProgressToNextLevel()
  return {
    name: profile?.name ?? null,
    isGuest: !profile || profile.id === GUEST_PROFILE_ID,
    near: isNear(progress.fill, progressStore.grantedSlots(), REWARD_SLOTS),
  }
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// ---- DEV fake (Chrome) ---------------------------------------------------------------------------

type FakeMode = 'prompt' | 'prompt-deny' | 'granted' | 'denied'

function devFakeMode(): FakeMode | null {
  try {
    if (!import.meta.env?.DEV || typeof window === 'undefined') return null
    const v = new URLSearchParams(window.location.search).get('fakenotify')
    return v === 'prompt' || v === 'prompt-deny' || v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

export interface FakeLog {
  perm: PermState
  pending: ReminderRequest[]
  requests: number
  cancels: number
  openedUrls: string[]
}

/** In-memory plugin: used by the DEV `?fakenotify=` seam and by the tests. */
export function createFakePlugin(mode: FakeMode): { plugin: NotificationsPlugin; launcher: LauncherPlugin; log: FakeLog } {
  const log: FakeLog = {
    perm: mode === 'granted' ? 'granted' : mode === 'denied' ? 'denied' : 'prompt',
    pending: [],
    requests: 0,
    cancels: 0,
    openedUrls: [],
  }
  const plugin: NotificationsPlugin = {
    checkPermissions: async () => ({ display: log.perm }),
    requestPermissions: async () => {
      log.requests++
      if (log.perm === 'prompt') log.perm = mode === 'prompt-deny' ? 'denied' : 'granted'
      return { display: log.perm }
    },
    schedule: async ({ notifications }) => {
      // Mirror the real plugin's 8.3 behaviour: scheduling on an unasked device asks for permission.
      if (log.perm === 'prompt') log.requests++
      for (const n of notifications) {
        log.pending = log.pending.filter((p) => p.id !== n.id)
        log.pending.push({ id: n.id, title: n.title, body: n.body, at: n.schedule.at })
      }
      return { notifications: notifications.map((n) => ({ id: n.id })) }
    },
    cancel: async ({ notifications }) => {
      log.cancels++
      const ids = new Set(notifications.map((n) => n.id))
      log.pending = log.pending.filter((p) => !ids.has(p.id))
    },
    removeAllDeliveredNotifications: async () => {},
    addListener: async () => ({ remove: async () => {} }),
  }
  const launcher: LauncherPlugin = {
    openUrl: async ({ url }) => {
      log.openedUrls.push(url)
      return { completed: true }
    },
  }
  return { plugin, launcher, log }
}

function defaultEnv(): ReminderEnv {
  const fake = devFakeMode()
  const fakeBundle = fake ? createFakePlugin(fake) : null
  if (fakeBundle && typeof window !== 'undefined') {
    ;(window as unknown as { __blReminders?: FakeLog }).__blReminders = fakeBundle.log
  }
  return {
    available: () => isNativeShell() || fakeBundle !== null,
    // BOXED — see the header. `{ plugin }` can never be assimilated as a thenable.
    loadPlugin: async () => {
      if (fakeBundle) return { plugin: fakeBundle.plugin }
      if (!isNativeShell()) return null
      try {
        const mod = (await import('@capacitor/local-notifications')) as unknown as {
          LocalNotifications?: NotificationsPlugin
        }
        return mod.LocalNotifications ? { plugin: mod.LocalNotifications } : null
      } catch {
        return null
      }
    },
    loadLauncher: async () => {
      if (fakeBundle) return { plugin: fakeBundle.launcher }
      if (!isNativeShell()) return null
      try {
        const mod = (await import('@capacitor/app-launcher')) as unknown as { AppLauncher?: LauncherPlugin }
        return mod.AppLauncher ? { plugin: mod.AppLauncher } : null
      } catch {
        return null
      }
    },
    storage: browserStorage,
    now: () => new Date(),
    context: liveContext,
    report: reportNotifyStep,
  }
}

// ---- the service ---------------------------------------------------------------------------------

export interface ReminderSnapshot {
  available: boolean
  prefs: ReminderPrefs
  /** Last answer iOS gave; null until the first check returns (or if it never does). */
  perm: PermState | null
}

type Listener = () => void

/** Coalescing window for XP-driven reschedules: a run of answers costs one schedule call. */
export const RESCHEDULE_DEBOUNCE_MS = 2000

export class ReminderService {
  private env: ReminderEnv
  private snapshot: ReminderSnapshot
  private listeners = new Set<Listener>()
  private chain: Promise<unknown> = Promise.resolve()
  private debounce: ReturnType<typeof setTimeout> | null = null
  private started = false

  constructor(env: ReminderEnv) {
    this.env = env
    this.snapshot = { available: env.available(), prefs: this.readPrefs(), perm: null }
  }

  // -- store plumbing --

  getSnapshot = (): ReminderSnapshot => this.snapshot

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  private set(patch: Partial<ReminderSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((l) => {
      try {
        l()
      } catch {
        /* a listener may never break the service */
      }
    })
  }

  private readPrefs(): ReminderPrefs {
    try {
      return parsePrefs(this.env.storage()?.getItem(PREFS_KEY) ?? null)
    } catch {
      return { ...DEFAULT_PREFS }
    }
  }

  private writePrefs(prefs: ReminderPrefs): void {
    try {
      this.env.storage()?.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* private mode / blocked storage: the choice holds for this session only */
    }
    this.set({ prefs })
  }

  /** Serialise every plugin conversation so a cancel can never interleave with a schedule. */
  private run<T>(job: () => Promise<T>): Promise<T> {
    const next = this.chain.then(job, job)
    this.chain = next.catch(() => {})
    return next
  }

  // -- permission --

  async refreshPermission(): Promise<PermState | null> {
    if (!this.snapshot.available) return null
    const box = await bounded(this.env.loadPlugin(), PLUGIN_TIMEOUT_MS)
    if (!box) return null
    const res = await bounded(box.plugin.checkPermissions(), PLUGIN_TIMEOUT_MS)
    const perm = res?.display ?? null
    if (perm) this.set({ perm })
    return perm
  }

  /** True when OUR card should be on offer (the caller still decides WHEN to show it). */
  canOffer(): boolean {
    return this.snapshot.available && shouldOffer(this.snapshot.prefs, this.snapshot.perm)
  }

  // -- lifecycle --

  /** Once per app start, shell (or DEV fake) only. Safe to call twice. */
  async start(): Promise<void> {
    if (this.started || !this.snapshot.available) return
    this.started = true

    // The tap listener goes first, before anything awaits the roster: a reminder tapped on a killed app
    // delivers its action once at launch (the plugin retains it until a listener consumes it).
    const box = await bounded(this.env.loadPlugin(), PLUGIN_TIMEOUT_MS)
    if (box) {
      void bounded(
        box.plugin.addListener('localNotificationActionPerformed', (action) => {
          const id = action?.notification?.id
          if (typeof id === 'number' && ((REMINDER_IDS as readonly number[]).includes(id) || id === TEST_REMINDER_ID)) {
            this.env.report('tapOpen')
          }
        }),
        PLUGIN_TIMEOUT_MS,
      )
      // The family is back: clear any reminder still sitting in Notification Center.
      void bounded(box.plugin.removeAllDeliveredNotifications(), PLUGIN_TIMEOUT_MS)
    }

    const perm = await this.refreshPermission()
    const reconciled = reconcilePrefs(this.snapshot.prefs, perm)
    if (reconciled !== this.snapshot.prefs) this.writePrefs(reconciled)
    await this.reschedule()

    try {
      xpBus.subscribe(() => this.scheduleSoon())
      profileStore.subscribe(() => this.scheduleSoon())
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            void this.refreshPermission().then(() => this.reschedule())
          }
        })
      }
    } catch {
      /* subscriptions are best-effort; boot already scheduled */
    }
  }

  /** Debounced reschedule — for the bursty triggers (XP grants, roster changes). */
  scheduleSoon(): void {
    if (!this.snapshot.available) return
    if (this.debounce) clearTimeout(this.debounce)
    this.debounce = setTimeout(() => {
      this.debounce = null
      void this.reschedule()
    }, RESCHEDULE_DEBOUNCE_MS)
  }

  /**
   * Cancel ours, and — only when the adult said yes AND iOS says granted — add the next three.
   * Returns how many are now pending from us (0 when off), or null when the plugin did not answer.
   */
  reschedule(): Promise<number | null> {
    return this.run(async () => {
      if (!this.snapshot.available) return 0
      const box = await bounded(this.env.loadPlugin(), PLUGIN_TIMEOUT_MS)
      if (!box) return null
      const { plugin } = box
      const cancelled = await bounded(
        plugin.cancel({ notifications: REMINDER_IDS.map((id) => ({ id })) }).then(() => true),
        PLUGIN_TIMEOUT_MS,
      )
      if (cancelled === null) return null
      // NEVER schedule on anything but `granted` — the plugin would raise the iOS dialog itself.
      if (!shouldSchedule(this.snapshot.prefs, this.snapshot.perm)) return 0
      let ctx: ReminderContext
      try {
        ctx = this.env.context()
      } catch {
        ctx = { name: null, isGuest: true, near: false }
      }
      const reqs = buildReminders(this.env.now(), ctx)
      const ok = await bounded(
        plugin.schedule({ notifications: reqs.map(toPluginRequest) }).then(() => true),
        PLUGIN_TIMEOUT_MS,
      )
      return ok ? reqs.length : null
    })
  }

  // -- the adult's answers --

  /** Our card was shown. Counted once per showing. */
  noteOffered(): void {
    this.env.report('offered')
  }

  /**
   * "Ja tak" on our card → the iOS dialog. Recorded as `yes` BEFORE the dialog, because the dialog is
   * iOS's, and a never-answered dialog must not leave the card coming back.
   */
  async acceptFromPrompt(): Promise<PermState | null> {
    this.env.report('yes')
    this.writePrefs({ prompt: 'yes', enabled: true })
    return this.requestAndApply()
  }

  /** "Ikke nu" — final (owner, 2026-10-09). Only the Indstillinger switch can turn it on after this. */
  declineFromPrompt(): void {
    this.env.report('notNow')
    this.writePrefs({ prompt: 'not_now', enabled: false })
  }

  /**
   * The Indstillinger switch. Turning it on asks iOS when iOS has never been asked (the adult is behind
   * the parental gate, so no card is needed); returns the resulting permission so the pane can show
   * the "slået fra i iOS" state on `denied`.
   */
  async setEnabled(on: boolean): Promise<PermState | null> {
    this.env.report(on ? 'toggleOn' : 'toggleOff')
    // Any answer in Indstillinger also settles the card: an adult who has chosen here is never asked.
    const prompt: PromptAnswer = this.snapshot.prefs.prompt === 'unasked' ? (on ? 'yes' : 'not_now') : this.snapshot.prefs.prompt
    this.writePrefs({ prompt, enabled: on })
    if (!on) {
      await this.reschedule() // cancels
      return this.snapshot.perm
    }
    return this.requestAndApply()
  }

  private async requestAndApply(): Promise<PermState | null> {
    let perm = this.snapshot.perm ?? (await this.refreshPermission())
    if (isAskable(perm)) {
      const box = await bounded(this.env.loadPlugin(), PLUGIN_TIMEOUT_MS)
      const res = box ? await bounded(box.plugin.requestPermissions(), PERMISSION_DIALOG_TIMEOUT_MS) : null
      perm = res?.display ?? null
      if (perm) {
        this.set({ perm })
        this.env.report(perm === 'granted' ? 'granted' : 'denied')
      }
    }
    await this.reschedule()
    return perm
  }

  /** Owner tool (devTool row): one reminder in a minute, so the banner can be seen without waiting a week. */
  async scheduleTest(): Promise<boolean> {
    return this.run(async () => {
      if (this.snapshot.perm !== 'granted') return false
      const box = await bounded(this.env.loadPlugin(), PLUGIN_TIMEOUT_MS)
      if (!box) return false
      const at = new Date(this.env.now().getTime() + 60_000)
      const ok = await bounded(
        box.plugin
          .schedule({
            notifications: [
              toPluginRequest({ id: TEST_REMINDER_ID, title: REMINDER_TITLE, body: REMINDER_BODIES.generalA, at }),
            ],
          })
          .then(() => true),
        PLUGIN_TIMEOUT_MS,
      )
      return ok === true
    })
  }

  /** "Åbn iPad-indstillinger" — Børnelæring's own page in Settings. False when it could not be opened. */
  async openSystemSettings(): Promise<boolean> {
    const box = await bounded(this.env.loadLauncher(), PLUGIN_TIMEOUT_MS)
    if (!box) return false
    const res = await bounded(box.plugin.openUrl({ url: 'app-settings:' }), PLUGIN_TIMEOUT_MS)
    return res?.completed === true
  }
}

/**
 * `sound: 'default'` — the plugin plays NO sound on iOS when `sound` is omitted, and resolves a name it
 * cannot find to the system default. Owner decision 13: default sound, never a badge.
 */
function toPluginRequest(r: ReminderRequest) {
  return { id: r.id, title: r.title, body: r.body, schedule: { at: r.at }, sound: 'default' }
}

export const reminders = new ReminderService(defaultEnv())
