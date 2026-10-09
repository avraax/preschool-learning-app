// The CLOSED set of things the anonymous usage counter may ever record, and the only mapping from a
// URL to one of them.
//
// WHY A CLOSED SET RATHER THAN THE PATHNAME. `/api/usage` is necessarily unauthenticated — the access
// JWT is only mintable behind a session (`lib/auth-family-plugin.ts`), so gating on it would count
// signed-in adults and miss every guest, which is the population the counter exists to see. An
// unauthenticated endpoint that wrote whatever string it was handed would have unbounded cardinality:
// one row per distinct value, forever, chosen by whoever is posting. The allow-list is the hard cap.
// Rows can never exceed `days x USAGE_EVENTS.length x versions`.
//
// It also keeps the table honest. Every value here is a fixed, hand-written identifier that describes a
// SCREEN, never a path segment a child or a URL could put there — so nothing a user types or is given
// can reach the database. That is what lets `docs/usage-analytics.md` call this anonymous by
// construction rather than by promise.
//
// PURE and Node-importable with no imports, because BOTH graphs use it: the client via
// `src/services/usagePing.ts`, and `api/usage.ts` via `'../src/config/usageEvents.js'` (the `.js` is
// mandatory — see `lib/serverImports.test.ts`).

/** Fired once per session — a cold start, or a return after the session gap. */
export const APP_OPEN_EVENT = 'app_open'

/**
 * THE SESSION-DEPTH LADDER. One event the first time a sitting passes each mark, so
 * `app_open → 1min → 5min → 15min` reads as a funnel.
 *
 * WHY IT IS THE MOST USEFUL THING HERE. Counts alone cannot tell "twenty children opened it once and
 * left" from "two children played for an hour", and that is the only question worth asking of an app
 * nobody in the household is playing. The ratio of `session:1min` to `app_open` is a bounce rate.
 *
 * Measured against ACTIVE time, not wall time, and emitted DURING the sitting rather than at its end —
 * so a mark cannot be lost to a hide event that never fires, which on a backgrounded Capacitor
 * WKWebView is still unverified.
 */
export const SESSION_MARKS: ReadonlyArray<{ afterMs: number; event: string }> = [
  { afterMs: 60_000, event: 'session:1min' },
  { afterMs: 5 * 60_000, event: 'session:5min' },
  { afterMs: 15 * 60_000, event: 'session:15min' },
]

/**
 * One per sticker actually earned at a ceremony.
 *
 * `route:album` is already climbing hard (3 → 22 in a week), but that is children LOOKING at the book.
 * This is the only signal that says the reward loop closes — that someone plays far enough to earn
 * one. Counted at the ceremony, never from the store, so the DEV seeder in `devHarness.ts` (which
 * grants through the same store method) cannot manufacture them.
 */
export const REWARD_STICKER_EVENT = 'reward:sticker'

/**
 * THE ADULT-DOOR FUNNEL. The adult area is a `Dialog`, not a route, so `location.pathname` never moves
 * for it and none of it was visible (owner's 2026-09-18 decision to count routes only).
 *
 * Read together these say WHERE an adult gives up, which is the thing the owner cannot see:
 *   • `chip` alone        → they find the pill but the sheet does not read as "adult things are here"
 *   • `door` without `ok` → the parental gate is turning them away
 *   • `gate_fail`         → they are trying and failing, rather than simply not trying
 *
 * `gate_ok` fires when the surface actually opens, gate or no gate — the question is "did anyone get
 * in", not "did a PIN get typed". Expect single digits: adults do this rarely, so do not over-read a
 * change of one.
 */
export const ADULT_EVENTS = {
  /** The identity pill in the title row — `[data-profile-chip]`, opens "Hvem spiller?". */
  chip: 'adult:chip',
  /** The labelled "Indstillinger" row inside that sheet, i.e. the gate is about to appear. */
  door: 'adult:door',
  /** The adult surface actually opened. */
  gateOk: 'adult:gate_ok',
  /** The gate refused or was cancelled. */
  gateFail: 'adult:gate_fail',
} as const

export type AdultStep = keyof typeof ADULT_EVENTS

/**
 * THE WEEKLY-REMINDER FUNNEL (Re-engagement PRD-01 §2.12). Aggregate daily counts like everything else
 * here — no install id, so it answers "how many said yes" and "how many sittings did a reminder start",
 * never "did THIS family come back". That is the price of staying anonymous, and it was paid on purpose.
 *
 *   • `offered` → `yes` / `not_now`     how the adult answers OUR card
 *   • `granted` / `denied`               how they then answer iOS's one-shot dialog
 *   • `tap_open`                         a sitting a reminder actually started — the number that matters
 *   • `toggle_on` / `toggle_off`         the switch in Indstillinger → Påmindelser
 */
export const NOTIFY_EVENTS = {
  offered: 'notify:offered',
  yes: 'notify:yes',
  notNow: 'notify:not_now',
  granted: 'notify:granted',
  denied: 'notify:denied',
  tapOpen: 'notify:tap_open',
  toggleOn: 'notify:toggle_on',
  toggleOff: 'notify:toggle_off',
} as const

export type NotifyStep = keyof typeof NOTIFY_EVENTS

/**
 * Pathname → event key. EXACT matches only.
 *
 * `/learning/memory/:type` is listed by its two real types rather than by its pattern: `:type` is a URL
 * parameter, so accepting it verbatim would put an attacker-controlled string in the table. The
 * optional `/:size` suffix is ignored here exactly as it is ignored by the game (Difficulty PRD-01 W5).
 *
 * DEV-only routes (`/dev/*`, `/audit`) are deliberately absent: they do not exist in a production
 * build, and counting them would mean counting ourselves.
 */
export const ROUTE_EVENTS: Readonly<Record<string, string>> = {
  '/': 'route:home',

  '/alphabet': 'route:alphabet_menu',
  '/alphabet/learn': 'route:alphabet_learn',
  '/alphabet/quiz': 'route:alphabet_quiz',

  '/math': 'route:math_menu',
  '/math/counting': 'route:math_counting',
  '/math/numbers': 'route:math_numbers',
  '/math/addition': 'route:math_addition',
  '/math/subtraction': 'route:math_subtraction',
  '/math/comparison': 'route:math_comparison',
  '/math/patterns': 'route:math_patterns',

  '/farver': 'route:farver_menu',
  '/farver/laer': 'route:farver_laer',
  '/farver/jagt': 'route:farver_jagt',
  '/farver/quiz': 'route:farver_quiz',
  '/farver/ram-farven': 'route:farver_ram_farven',
  '/farver/nuancer': 'route:farver_nuancer',

  '/english': 'route:english_menu',
  '/english/listen': 'route:english_listen',
  '/english/word': 'route:english_word',
  '/english/learn': 'route:english_learn',

  '/ordleg': 'route:ordleg_menu',
  '/ordleg/read': 'route:ordleg_read',
  '/ordleg/spelling': 'route:ordleg_spelling',

  '/learning/memory/letters': 'route:memory_letters',
  '/learning/memory/numbers': 'route:memory_numbers',

  '/album': 'route:album',
  '/privatliv': 'route:privacy',
  '/support': 'route:support',
  '/voicelab': 'route:voicelab',
}

// WHAT IS DELIBERATELY NOT COUNTED (owner decision, 2026-09-18 — a decision, not an oversight):
// every screen that is not a URL. The adult area ("Indstillinger") is a MUI `Dialog`, not a route, so
// `location.pathname` never changes for it; the same is true of the profile picker ("Hvem spiller?"),
// the lock screen, and the sticker ceremony overlay. None of them report anything today. Adding one
// is cheap — a key here plus a call at the point it opens — but it is a scope decision to take
// deliberately rather than by accident, because each one is a new row family forever.

/**
 * How many events one request may carry.
 *
 * Shared by the client (which flushes early rather than exceed it) and the endpoint (which discards
 * the overflow), so the two can never disagree about what a legal batch is. It is also the bound on
 * how much a single poisoned request can inflate a count — with the closed allow-list capping WHICH
 * rows exist and the rate limit capping how many requests arrive, this caps the third dimension.
 */
export const MAX_EVENTS_PER_REQUEST = 50

/** Every value the endpoint will accept. Anything else is dropped without a write. */
export const USAGE_EVENTS: readonly string[] = [
  APP_OPEN_EVENT,
  REWARD_STICKER_EVENT,
  ...Object.values(ADULT_EVENTS),
  ...Object.values(NOTIFY_EVENTS),
  ...SESSION_MARKS.map((m) => m.event),
  ...Object.values(ROUTE_EVENTS),
]

const EVENT_SET = new Set<string>(USAGE_EVENTS)

/** The server's gate. Unknown event → no row. */
export function isUsageEvent(value: unknown): value is string {
  return typeof value === 'string' && EVENT_SET.has(value)
}

/**
 * The client's gate: which event (if any) a pathname reports.
 *
 * Returns null for anything unmapped — a 404, a DEV route, a deep link nobody anticipated. A null is
 * not an error and is never reported; an uncounted screen is strictly better than an unbounded table.
 */
export function eventForPath(pathname: string): string | null {
  if (typeof pathname !== 'string' || !pathname) return null
  // Tolerate a trailing slash so `/math/` and `/math` are the same screen, but never strip `/` itself.
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const direct = ROUTE_EVENTS[clean]
  if (direct) return direct
  // `/learning/memory/<type>/<size>` — the size segment is ignored, the type is not.
  const memory = /^(\/learning\/memory\/[^/]+)\/[^/]+$/.exec(clean)
  return memory ? (ROUTE_EVENTS[memory[1]] ?? null) : null
}

/**
 * `src/config/version.ts` is rewritten by the build, so the value is ours rather than the caller's —
 * but the endpoint still validates it, because the endpoint cannot tell who is calling. Three numeric
 * segments, nothing else: without this, `app_version` is a second unbounded cardinality channel.
 */
export const APP_VERSION_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/

export function isAppVersion(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 14 && APP_VERSION_PATTERN.test(value)
}
