// The client half of the anonymous usage counter (`docs/usage-analytics.md` §6B).
//
// WHAT THIS SENDS, AND NOTHING ELSE: event keys from the closed list in `src/config/usageEvents.ts`
// and the build's version string. No identifier, no device or viewport, no locale, no timestamp — the
// server dates the row itself, to the DAY. Several of those are individually harmless and together a
// fingerprint, which is why the payload is a fixed two-field shape rather than "a bit of context".
//
// TWO SPEEDS, ON PURPOSE (owner, 2026-09-20).
//   * `app_open` goes out IMMEDIATELY, on its own. It is the headline number — "is anyone opening
//     this at all" — and batching it would mean a child who plays for twenty seconds reports nothing
//     when the hide event fails to fire, which on iOS Safari and in a backgrounded Capacitor shell it
//     regularly does. Undercounting opens is the one error the data cannot reveal about itself.
//   * Route events BATCH in memory and flush every 30s, on hide, and when the buffer fills. A sitting
//     produces one request per half-minute instead of one per screen — roughly a 20x reduction.
//
// THE BUFFER IS IN MEMORY AND MUST STAY THERE. Persisting it (localStorage, sessionStorage, IndexedDB,
// a file) would be "storing information on terminal equipment" for a non-essential purpose, which is
// ePrivacy Art. 5(3) — consent required, and the whole consent-free position in the design doc gone
// for the sake of a few counts. Losing a buffer on a hard kill is the accepted price and is why
// `app_open` is not in it.
//
// NOTHING HERE MAY EVER REACH THE CHILD — not a spinner, not a delay, not an error. A counter is
// worth exactly zero of a five-year-old's attention, so this module fails silently and completely:
//   * DEFERRED off the render commit. A route change is the most animation-sensitive moment in the
//     app (page mount + the themed wipe), so a send waits for idle instead of competing with it.
//   * NEVER AWAITED, no retry, no queue beyond the in-memory batch. A lost count is the intended cost.
//   * EVERY throw contained — synchronous (a malformed URL can make `fetch` throw outright in some
//     WebKit builds), asynchronous (offline, DNS, timeout), and the mapping call itself. A throw
//     escaping the `useEffect` in `App.tsx` would hit `AppErrorBoundary` and replace the app with a
//     fallback screen BECAUSE A STATISTIC FAILED. That is the specific outcome this guards against.
//   * The response is never inspected. A 204, a 429 and a 500 are all the same non-event here.
//   * `/api/usage` is excluded from the diagnostics ring in `src/services/diagnosticsBuffer.ts`, so a
//     failing ping cannot put a red line into a parent's bug report or flood the buffer that explains
//     a real one.

// Explicit `.ts` — this module is in the CLIENT/TEST graph, and `usagePing.test.ts` loads it under
// Node's test runner, where an extensionless specifier is ERR_MODULE_NOT_FOUND (CLAUDE.md).
import { BUILD_INFO } from '../config/version.ts'
import { apiUrl } from '../config/apiBase.ts'
import { APP_OPEN_EVENT, MAX_EVENTS_PER_REQUEST, eventForPath } from '../config/usageEvents.ts'
import { devSessionGapMs } from '../utils/devHarness.ts'

/**
 * `apiUrl()` IS LOAD-BEARING, not a nicety. In the native shell the page origin is
 * `capacitor://localhost`, so a bare `/api/usage` resolves against the app BUNDLE and Capacitor's
 * local server answers it with the SPA's index.html — status 200, no error, no exception, and the
 * ping silently never reaches a server. See the full account in `src/config/apiBase.ts`.
 */
const USAGE_PATH = '/api/usage'

/** Long enough to collapse a burst of navigation, short enough that a normal sitting loses nothing. */
const FLUSH_INTERVAL_MS = 30_000

/**
 * How long the app must have been away before coming back counts as a NEW session.
 *
 * WHY THIS EXISTS (owner, 2026-10-03). `app_open` used to fire once per page LOAD, and in the native
 * shell the WebView survives backgrounding — so a child who returns to the app an hour later resumed
 * without a reload and was never counted. Production showed 3 opens against 205 events in one day,
 * which is not three sittings. The number was wrong in the one direction the data cannot reveal about
 * itself, which is why it was worth fixing rather than explaining.
 *
 * 30 minutes is the ordinary session-gap convention. It is deliberately long: a child who puts the
 * iPad down for a minute, or whose screen locks mid-game, is still in the same sitting, and counting
 * that as a new open would inflate the number in the opposite direction.
 *
 * `app_open` therefore means "a session started" from v1.2 on, not "the app cold-started". Nothing
 * else changes — same event name, same allow-list, same privacy answers.
 */
let sessionGapMs = 30 * 60 * 1000

/**
 * Idle if the browser offers it, a macrotask otherwise. `requestIdleCallback` reached Safari 16.4, so
 * it is available on the 17.7 floor device — but it is feature-detected anyway rather than assumed,
 * and the `timeout` guarantees the callback still runs on a page that never goes idle.
 */
function schedule(run: () => void): void {
  try {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback
    if (typeof ric === 'function') ric(run, { timeout: 2000 })
    else setTimeout(run, 0)
  } catch {
    // Even the scheduler is allowed to fail. Then the events are simply never sent.
  }
}

/**
 * POST a batch. `immediate` skips the idle hop — used by the hide handler, where waiting for idle
 * means not going at all, and by `app_open`, which is one request at a moment nothing is animating.
 */
function post(events: string[], immediate: boolean): void {
  if (!events.length) return
  const body = JSON.stringify({ events, appVersion: BUILD_INFO.version })
  const send = () => {
    try {
      const request = fetch(apiUrl(USAGE_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // So a flush fired as the app goes away still leaves the device.
        keepalive: true,
        body,
        // The endpoint is unauthenticated by design; never send cookies to it.
        credentials: 'omit',
      })
      // `void` + `catch` rather than `await`: nothing downstream waits on this, and an unhandled
      // rejection would surface in the console (and in dev, get forwarded).
      void Promise.resolve(request).catch(() => {})
    } catch {
      /* see the header — a counter may never break a page */
    }
  }
  if (immediate) send()
  else schedule(send)
}

// ---- the in-memory batch ------------------------------------------------------------------------

let buffer: string[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function flush(immediate = false): void {
  try {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!buffer.length) return
    // Take the buffer BEFORE posting, so a throw in `post` cannot resend the same events forever.
    const batch = buffer
    buffer = []
    post(batch, immediate)
  } catch {
    /* as everywhere here: counting may never break a page */
  }
}

function arm(): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flush()
  }, FLUSH_INTERVAL_MS)
  // Node's timer keeps the process alive; a test suite would hang on it. Harmless no-op in a browser.
  ;(timer as unknown as { unref?: () => void }).unref?.()
}

// ---- session tracking ---------------------------------------------------------------------------

/** When the app was last backgrounded. Null while it is in the foreground, or after a counted resume. */
let lastHiddenAt: number | null = null
/** When anything was last reported. Seeds the idle path below when no hide event ever arrives. */
let lastActivityAt = Date.now()

/**
 * Has the app been away long enough that coming back is a NEW session?
 *
 * Pure, so the rule can be tested without a clock or a DOM. Takes whichever signal is more recent is
 * NOT what it does — it takes the explicit hide if there was one, and falls back to "nothing has
 * happened at all" otherwise. The fallback is the important half: if `visibilitychange` never fires
 * (unproven on a backgrounded Capacitor WKWebView, and the failure is silent), a child returning and
 * tapping still produces a route event after a long quiet gap, and that counts.
 */
export function isNewSession(
  hiddenAt: number | null,
  activityAt: number,
  now: number,
  gapMs: number,
): boolean {
  return now - (hiddenAt ?? activityAt) >= gapMs
}

/** Count a resumed session, at most once per return. */
function maybeCountResume(now: number): void {
  if (!isNewSession(lastHiddenAt, lastActivityAt, now, sessionGapMs)) return
  // Clear BOTH signals, or the route event that follows a visibility resume counts a second time.
  lastHiddenAt = null
  lastActivityAt = now
  post([APP_OPEN_EVENT], true)
}

let listenersInstalled = false

/**
 * Flush when the app goes away, and count a session when it comes back.
 *
 * BOTH hide events on purpose: `visibilitychange` is the one iOS fires when an app is backgrounded or
 * a tab is switched, and `pagehide` covers a real unload. Either may fail, and a duplicate flush is
 * free because the buffer empties on the first.
 */
function installHideListeners(): void {
  if (listenersInstalled || typeof document === 'undefined') return
  listenersInstalled = true
  // DEV/harness only — `?sessiongap=<ms>` so a probe need not wait 30 minutes. Absent from any
  // deployed build; see devHarness.ts.
  const devGap = devSessionGapMs()
  if (devGap !== null) sessionGapMs = devGap
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now()
        flush(true)
      } else if (document.visibilityState === 'visible' && lastHiddenAt !== null) {
        // ONLY after a real hide. A `visible` event with no preceding `hidden` is not a return, and
        // counting it on elapsed time alone over-counts: a WebKit probe that pinned `visibilityState`
        // produced a third session from one page load, because every later engine-fired event then
        // read as "visible" and the idle clock had moved on. The genuinely-idle case is covered by
        // `reportRoute` below, which needs an actual tap and so cannot fire on its own.
        maybeCountResume(Date.now())
      }
    })
    window.addEventListener('pagehide', () => flush(true))
  } catch {
    /* no document/window (tests, SSR) — the interval still flushes */
  }
}

// ---- public API ---------------------------------------------------------------------------------

let openReported = false

/**
 * Once per cold start, sent on its own and NOT batched — see the header. Idempotent, so an accidental
 * second call cannot double-count.
 */
export function reportAppOpen(): void {
  try {
    if (openReported) return
    openReported = true
    lastActivityAt = Date.now()
    installHideListeners()
    post([APP_OPEN_EVENT], false)
  } catch {
    /* unreachable today, and still contained — this is called from a useEffect */
  }
}

/**
 * One entry per screen entered, buffered. `pathname` is mapped through the closed allow-list; anything
 * unmapped (a 404, a DEV route, an unanticipated deep link) buffers nothing at all.
 */
export function reportRoute(pathname: string): void {
  try {
    const event = eventForPath(pathname)
    if (!event) return
    installHideListeners()
    // BEFORE buffering: a screen entered after a long quiet gap is the start of a new sitting, and
    // this is the only path that still works if the shell never fires `visibilitychange`.
    const now = Date.now()
    maybeCountResume(now)
    lastActivityAt = now
    buffer.push(event)
    // Never let the buffer exceed what one request may carry — flush instead of dropping.
    if (buffer.length >= MAX_EVENTS_PER_REQUEST) flush()
    else arm()
  } catch {
    /* as above: the mapping is pure, but the guarantee is what matters, not the current code */
  }
}

/** Test seam only — resets the once-per-start latch, the buffer, the timer and the session clock. */
export function __resetUsagePingForTests(): void {
  openReported = false
  buffer = []
  if (timer) clearTimeout(timer)
  timer = null
  lastHiddenAt = null
  lastActivityAt = Date.now()
  sessionGapMs = 30 * 60 * 1000
}

/** Test seam only — shrink the 30-minute session gap so a test need not wait for it. */
export function __setSessionGapForTests(ms: number): void {
  sessionGapMs = ms
}

/** Test seam only — force the pending batch out now. */
export function __flushUsagePingForTests(): void {
  flush(true)
}
