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

/** Fired once per cold start, from `src/services/usagePing.ts`. */
export const APP_OPEN_EVENT = 'app_open'

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
  // Being removed in a parallel session (2026-09-18). Harmless to leave here once the route is gone —
  // `ROUTE_EVENTS` may hold keys no route maps to; the test only requires the reverse, that every
  // route in App.tsx HAS a key. Delete it with the game.
  '/ordleg/mic': 'route:ordleg_mic',

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

/** Every value the endpoint will accept. Anything else is dropped without a write. */
export const USAGE_EVENTS: readonly string[] = [
  APP_OPEN_EVENT,
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
