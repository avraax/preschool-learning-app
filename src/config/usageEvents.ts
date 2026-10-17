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
  /** "Bedøm appen" tapped — the App Store was asked to open. Not proof a review was written. */
  rate: 'adult:rate',
} as const

export type AdultStep = keyof typeof ADULT_EVENTS

/**
 * WHICH PANE OF THE SETTINGS AREA A PARENT ACTUALLY OPENED.
 *
 * `adult:gate_ok` says someone got in and then the data went dark: we could not see whether anyone
 * reaches Læring to set a difficulty, whether the "Send feedback" door is ever found, or what parents
 * come in here for at all. One key per pane closes that for seven rows a day.
 *
 * ONE PER PANE, NEVER ONE PER CONTROL. Dozens of per-control keys would be a permanent row family for
 * a surface a handful of adults open — at these volumes almost all of them would read 0 or 1, which is
 * noise dressed as data. It also keeps the two DANGER blocks uncounted by construction: at single-digit
 * volumes "someone pressed Slet kontoen helt" plus a date is the most identifying thing this table
 * could hold, and there is no question today that needs it.
 *
 * The keys mirror `AdultGroupId` in `src/config/adultSettingsIa.ts` plus the footer's `feedback`
 * destination, which is deliberately not a group there. They are spelled out rather than derived
 * because this module must stay import-free for `api/usage.ts` (see the header) — so
 * `usageEvents.test.ts` asserts the two sets match exactly and fails if the IA gains or loses a group.
 */
export const SETTINGS_PANE_EVENTS = {
  konto: 'settings:konto',
  laering: 'settings:laering',
  lyd: 'settings:lyd',
  paamindelser: 'settings:paamindelser',
  udseende: 'settings:udseende',
  privatliv: 'settings:privatliv',
  /** The rail FOOTER's message form — not a settings group, and the one door we most want counted. */
  feedback: 'settings:feedback',
} as const

export type SettingsPane = keyof typeof SETTINGS_PANE_EVENTS

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
 * THE SIGN-IN OFFER. Twenty-three days of production had 3,996 events, 8 adults inside Indstillinger
 * and ZERO accounts created — and nothing in the data could say why, because the offer itself was
 * invisible to it. `adult:gate_ok` says an adult got in; it does not say they ever saw the ask.
 *
 * Two counters, and the RATIO is the whole point, because the two readings need opposite fixes:
 *   • few `offer` against `gate_ok` → they never reach the Konto pane. A DISCOVERY problem.
 *   • many `offer`, few `tap`       → they read the ask and decline it. A PERSUASION problem.
 *
 * `offer` fires once per time the pane is opened by a guest, not per render — "how many adults saw
 * it", not "how many times React drew it". `tap` is the button press, before the round trip: whether
 * sign-in then SUCCEEDED is already visible as a row in the accounts table, and counting it here
 * would pay cardinality for something we can already see.
 */
export const SIGNIN_EVENTS = {
  /** A guest opened Konto and the offer rendered. */
  offer: 'signin:offer',
  /** "Log ind med Google"/"…Apple" pressed. Not proof an account exists. */
  tap: 'signin:tap',
} as const

export type SignInStep = keyof typeof SIGNIN_EVENTS

/**
 * A FINISHED KREA PIECE — one per piece completed, at the ✓ press that grants its XP.
 *
 * `route:krea_*` already says a child OPENED an activity. This says they carried one to the end, so
 * `finished / opened` is a completion rate per activity, which is the only thing that separates "Krea
 * works" from "Krea gets opened and abandoned". Split three ways because the three are different
 * activities with different costs, and three keys are free.
 *
 * Fri Tegning is absent BY DESIGN and must stay absent: it has no finish and earns nothing (Lepper
 * 1973 — an expected award made preschoolers draw less; `.claude/rules/games-krea.md`). Counting a
 * "finish" there would mean inventing one.
 */
export const KREA_EVENTS = {
  /** Tegn med Mig — a guided piece completed. */
  guide: 'krea:finished_guide',
  /** Farvelæg — every region coloured. */
  color: 'krea:finished_color',
  /** Perleplade — a PATTERN finished. The free board has no finish and earns nothing. */
  beads: 'krea:finished_beads',
} as const

export type KreaPiece = keyof typeof KREA_EVENTS

/**
 * Pathname → event key. EXACT matches only.
 *
 * `/learning/memory/:type` is listed by its two real types rather than by its pattern: `:type` is a URL
 * parameter, so accepting it verbatim would put an attacker-controlled string in the table. The
 * optional `/:size` suffix is ignored here exactly as it is ignored by the game (Difficulty PRD-01 W5).
 *
 * DEV-only routes (`/dev/*`, `/audit`) are deliberately absent: they do not exist in a production
 * build, and counting them would mean counting ourselves.
 *
 * THE FOUR MENU ROUTES WERE RENAMED IN 1.3, and the rename IS the point (`docs/usage-analytics.md`
 * §9.1). Four doors replace six home cards, and a merged door lives at its primary section's old menu
 * route (`doors.ts` A2): `/alphabet` stopped being "the Alfabetet menu" and became "Bogstaver og Ord",
 * which also holds Ordleg; `/farver` likewise swallowed Krea. The other two kept their contents but
 * not their denominator — a door is one of FOUR cards where a menu was one of six, so every
 * menu→game conversion rate changes meaning on the same day.
 *
 * None of that is visible in a row. `day` cannot show it and `app_version` only could if someone
 * remembered, for the life of the table, to split on it — so the old names would quietly average a
 * six-card world with a four-door one and the number would look comparable while being wrong. New
 * names make the two eras disjoint BY CONSTRUCTION; a query that wants the whole history unions them
 * deliberately, which is the correct amount of work for a question that genuinely spans the change.
 */
export const ROUTE_EVENTS: Readonly<Record<string, string>> = {
  '/': 'route:home',

  '/alphabet': 'route:door_letters',
  '/alphabet/learn': 'route:alphabet_learn',
  '/alphabet/quiz': 'route:alphabet_quiz',

  '/math': 'route:door_math',
  '/math/counting': 'route:math_counting',
  '/math/boat': 'route:math_boat',
  '/math/numbers': 'route:math_numbers',
  '/math/addition': 'route:math_addition',
  '/math/subtraction': 'route:math_subtraction',
  '/math/comparison': 'route:math_comparison',
  '/math/patterns': 'route:math_patterns',

  '/farver': 'route:door_colors',
  '/farver/laer': 'route:farver_laer',
  '/farver/jagt': 'route:farver_jagt',
  '/farver/quiz': 'route:farver_quiz',
  '/farver/ram-farven': 'route:farver_ram_farven',
  '/farver/nuancer': 'route:farver_nuancer',

  '/english': 'route:door_english',
  '/english/listen': 'route:english_listen',
  '/english/word': 'route:english_word',
  '/english/learn': 'route:english_learn',

  // `/ordleg` and `/krea` are still real routes, but under four doors nothing LINKS to them — their
  // games stand behind Bogstaver og Ord and Farver og Krea, and every back arrow goes there
  // (`menuRouteFor`). They are kept mapped because a bookmark or a deep link still reaches them; the
  // count collapsing to near zero in 1.3 is the expected reading, not a regression.
  '/ordleg': 'route:ordleg_menu',
  '/ordleg/read': 'route:ordleg_read',
  '/ordleg/spelling': 'route:ordleg_spelling',
  '/krea': 'route:krea_menu',
  '/krea/tegn': 'route:krea_draw',
  '/krea/tegnmedmig': 'route:krea_guide',
  '/krea/farvelaeg': 'route:krea_color',
  '/krea/perler': 'route:krea_beads',

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
 * THE SAME FOUR ROUTES UNDER THE SIX-CARD HOME — what 1.0–1.2 reported, and what THIS build still
 * reports while the doors are gated off.
 *
 * WHY THE NAME IS CHOSEN AT RUNTIME RATHER THAN AT THE RENAME. The doors ride `fourDoorsShown()`
 * (→ the Krea gate), so one build renders both worlds: production shows six cards until the gate is
 * deleted, staging and dev already show four — and `master` deploys the WEB on every push, days
 * before the 1.3 binary clears review. A name baked in at build time would therefore have emitted
 * `route:door_letters` from a six-card page for that whole window, contaminating the split by exactly
 * the mechanism the split exists to prevent. The event follows what is ON SCREEN; that is the only
 * version of this that cannot drift.
 *
 * These names also have to stay in the allow-list for good: an iPad that never takes the 1.3 update
 * goes on posting them for years, and dropping one would silently discard that family's counts while
 * the endpoint kept answering 204.
 */
export const PRE_DOOR_ROUTE_EVENTS: Readonly<Record<string, string>> = {
  '/alphabet': 'route:alphabet_menu',
  '/math': 'route:math_menu',
  '/english': 'route:english_menu',
  '/farver': 'route:farver_menu',
}

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
  ...Object.values(SETTINGS_PANE_EVENTS),
  ...Object.values(NOTIFY_EVENTS),
  ...Object.values(SIGNIN_EVENTS),
  ...Object.values(KREA_EVENTS),
  ...SESSION_MARKS.map((m) => m.event),
  ...Object.values(ROUTE_EVENTS),
  ...Object.values(PRE_DOOR_ROUTE_EVENTS),
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
 *
 * `fourDoors` is what the child is actually looking at (`fourDoorsShown()` at the call site), and it
 * only ever changes the four menu routes — see `PRE_DOOR_ROUTE_EVENTS` for why the name is chosen
 * here rather than baked in. It DEFAULTS TO THE SIX-CARD WORLD because that is what production
 * renders today, so a caller that forgets it under-reports the new names rather than attributing a
 * six-card screen to a door; the call site itself is pinned by `lib/usageEndpoint.test.ts`.
 */
export function eventForPath(pathname: string, fourDoors = false): string | null {
  if (typeof pathname !== 'string' || !pathname) return null
  // Tolerate a trailing slash so `/math/` and `/math` are the same screen, but never strip `/` itself.
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const direct = fourDoors ? ROUTE_EVENTS[clean] : (PRE_DOOR_ROUTE_EVENTS[clean] ?? ROUTE_EVENTS[clean])
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
