// WHEN the weekly reminder fires and WHAT it says (Re-engagement PRD-01 §2). PURE: no imports, no
// clock, no plugin — `src/services/reminders.ts` is the only thing that touches iOS, and it builds
// every request through `buildReminders` below so the rules here are the rules that ship.
//
// THE WHOLE SCHEDULE IS "THREE REQUESTS FROM NOW". Every reschedule cancels our three fixed ids and
// re-adds days 7, 14 and 21 counted from the moment it runs. That one shape gives all three owner
// decisions with no background execution at all:
//   * an active family never gets one (each open pushes day 7 a week further out),
//   * a lapsed family gets at most three, a week apart,
//   * then silence — nothing is left to fire until the app is opened again, which restarts the cycle.
//
// THE COPY IS ADDRESSED TO THE FAMILY ("I"), never to the child and never in the mascot's voice. It
// carries NO DIGITS: the ring's "never a distance" rule (`RewardRing.tsx`) is held for the parent copy
// too, so "tæt på", never "2 opgaver til" — `ti` is spelled out for that reason, and the test asserts
// it over every variant. Do not add a line that claims something the app cannot back ("nye opgaver"
// would be false: the games are endless, not new). Seasonal / "Ugens bogstav" lines are out of v1 on
// purpose (PRD §8) until there is real content behind them.

/** Our three request ids, fixed so a reschedule can always cancel exactly what it scheduled. */
export const REMINDER_IDS = [7101, 7102, 7103] as const

/** The owner-only "send a test reminder in a minute" row (devTool). Separate id: never cancelled by a reschedule. */
export const TEST_REMINDER_ID = 7199

/** Days after the last open on which each reminder fires. */
export const REMINDER_DAYS = [7, 14, 21] as const

/** Local send times — after school/daycare on weekdays, a weekend morning otherwise. */
export const WEEKDAY_TIME = { hour: 16, minute: 30 } as const
export const WEEKEND_TIME = { hour: 10, minute: 0 } as const

/** The notification title. iOS also prints the app name; the title repeats it so the banner reads as one sentence. */
export const REMINDER_TITLE = 'Børnelæring'

/** "Near the next sticker" — the ring's own fill, at or past half, while there is a sticker left to earn. */
export const NEAR_FILL = 0.5

/** The pre-prompt card (§2.1) — adult-addressed, silent, no gate. */
export const REMINDER_PROMPT = {
  overline: 'Til den voksne',
  title: 'Må vi minde jer om Børnelæring?',
  body:
    'Hvis appen ikke har været åbnet i en uge, sender vi en venlig påmindelse — højst én om ugen, og ' +
    'aldrig mere end tre i træk. Påmindelserne laves på iPad’en; der sendes ingen data. I kan slå dem ' +
    'fra under Indstillinger.',
  yes: 'Ja tak',
  no: 'Ikke nu',
} as const

export const REMINDER_BODIES = {
  nearNamed: (name: string) => `${name} er tæt på sit næste klistermærke. Har I ti minutter i dag?`,
  nearGuest: 'Der er et klistermærke tæt på i Børnelæring. Har I ti minutter i dag?',
  generalA: 'Bogstaver, tal og farver venter. Har I ti minutter i dag?',
  generalB: 'Klar til en lille runde? Børnelæring er der, når I er.',
  generalC: 'Et par minutter med bogstaver eller tal kan gøre en god dag lidt bedre.',
} as const

export interface ReminderContext {
  /** The attached child's name, or null when none. */
  name: string | null
  /** The local guest profile — whose name is literally "Gæst", so it must never be printed. */
  isGuest: boolean
  /** `isNear(...)` at schedule time. */
  near: boolean
}

export interface ReminderRequest {
  id: number
  title: string
  body: string
  at: Date
}

const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6

/**
 * The send moment `days` calendar days after `from`, at that day's local send time.
 *
 * Built from LOCAL CALENDAR FIELDS, never `from + days * 86 400 000`: across the late-March and
 * late-October DST switches a millisecond offset lands an hour off.
 */
export function sendTimeAfter(from: Date, days: number): Date {
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  const t = isWeekend(day) ? WEEKEND_TIME : WEEKDAY_TIME
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.hour, t.minute, 0, 0)
}

/** The three send moments counted from `from` (normally "now", i.e. the last open). */
export function reminderTimes(from: Date): Date[] {
  return REMINDER_DAYS.map((d) => sendTimeAfter(from, d))
}

/** The ring's nearness, read as the parent copy reads it. A full book is never "near". */
export function isNear(fill: number, grantedSlots: number, totalSlots: number): boolean {
  if (!Number.isFinite(fill) || grantedSlots >= totalSlots) return false
  return fill >= NEAR_FILL
}

/**
 * The body for reminder #index (0-based). Only #0 may carry the progress line: by #1 and #2 nobody has
 * played (any open would have rescheduled), so progress cannot have changed and repeating it is nagging.
 */
export function reminderBody(index: number, ctx: ReminderContext): string {
  if (index === 0) {
    if (ctx.near) {
      const name = ctx.name?.trim()
      return !ctx.isGuest && name ? REMINDER_BODIES.nearNamed(name) : REMINDER_BODIES.nearGuest
    }
    return REMINDER_BODIES.generalA
  }
  return index === 1 ? REMINDER_BODIES.generalB : REMINDER_BODIES.generalC
}

/** Everything one reschedule hands to iOS. */
export function buildReminders(from: Date, ctx: ReminderContext): ReminderRequest[] {
  return reminderTimes(from).map((at, i) => ({
    id: REMINDER_IDS[i],
    title: REMINDER_TITLE,
    body: reminderBody(i, ctx),
    at,
  }))
}
