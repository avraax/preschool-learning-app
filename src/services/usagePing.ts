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
import {
  ADULT_EVENTS,
  APP_OPEN_EVENT,
  MAX_EVENTS_PER_REQUEST,
  NOTIFY_EVENTS,
  REWARD_STICKER_EVENT,
  SESSION_MARKS,
  eventForPath,
  type AdultStep,
  type NotifyStep,
} from '../config/usageEvents.ts'
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

// ---- the session-depth ladder --------------------------------------------------------------------

/**
 * How often active time is accumulated. Coarse on purpose: the marks are 1/5/15 minutes, so 15-second
 * granularity is ample and the work per tick is one subtraction and a comparison.
 */
const TICK_MS = 15_000

let activeMs = 0
let lastTickAt = Date.now()
let marksSent = 0
let ticker: ReturnType<typeof setInterval> | null = null

/**
 * Accumulate ACTIVE time and emit any mark just passed.
 *
 * THE CAP IS THE POINT. `delta` is clamped to twice the tick, so a device that suspended our timers
 * for an hour — iOS throttles hard in the background, and we cannot rely on `visibilitychange` to tell
 * us it happened — adds one tick, not an hour. Without it a backgrounded iPad would silently award
 * itself `session:15min` for sitting in a pocket.
 */
function tickSession(now: number): void {
  const delta = Math.min(now - lastTickAt, TICK_MS * 2)
  lastTickAt = now
  if (delta <= 0) return
  activeMs += delta
  while (marksSent < SESSION_MARKS.length && activeMs >= SESSION_MARKS[marksSent].afterMs) {
    // Its own request rather than the batch: three per sitting at most, and losing one to a flush
    // that never fires would cost exactly the number this ladder exists to produce.
    post([SESSION_MARKS[marksSent].event], false)
    marksSent++
  }
}

function startTicker(): void {
  if (ticker || typeof setInterval !== 'function') return
  lastTickAt = Date.now()
  ticker = setInterval(() => tickSession(Date.now()), TICK_MS)
  // Node's timer would hold a test process open; a no-op in the browser.
  ;(ticker as unknown as { unref?: () => void }).unref?.()
}

function stopTicker(): void {
  if (!ticker) return
  clearInterval(ticker)
  ticker = null
}

/** A new sitting begins: the ladder restarts from zero. */
function beginSession(now: number): void {
  activeMs = 0
  marksSent = 0
  lastTickAt = now
  startTicker()
}

/** Count a resumed session, at most once per return. */
function maybeCountResume(now: number): void {
  if (!isNewSession(lastHiddenAt, lastActivityAt, now, sessionGapMs)) return
  // Clear BOTH signals, or the route event that follows a visibility resume counts a second time.
  lastHiddenAt = null
  lastActivityAt = now
  post([APP_OPEN_EVENT], true)
  beginSession(now)
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
        const now = Date.now()
        // Bank the time up to this moment, then stop counting: time in the background is not play.
        tickSession(now)
        stopTicker()
        lastHiddenAt = now
        flush(true)
      } else if (document.visibilityState === 'visible' && lastHiddenAt !== null) {
        // Resume the clock from NOW, so the gap away is never counted as play. `maybeCountResume`
        // may restart the whole ladder below if this turned out to be a new sitting.
        lastTickAt = Date.now()
        startTicker()
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
    const now = Date.now()
    lastActivityAt = now
    installHideListeners()
    post([APP_OPEN_EVENT], false)
    beginSession(now)
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
  activeMs = 0
  marksSent = 0
  lastTickAt = Date.now()
  stopTicker()
}

/** Test seam only — shrink the 30-minute session gap so a test need not wait for it. */
export function __setSessionGapForTests(ms: number): void {
  sessionGapMs = ms
}

/** Test seam only — force the pending batch out now. */
export function __flushUsagePingForTests(): void {
  flush(true)
}

/**
 * Stickers actually earned at a ceremony. Called by `RewardOverlay` — the one place that grants —
 * never by `progressStore`, so the DEV seeder cannot manufacture them.
 *
 * `count` is the number handed over in that ceremony, which can be more than one after an offline
 * merge. It is clamped: the caller is our own code, but this is the only place a NUMBER reaches the
 * event stream, and an unclamped loop here would be a way to inflate a count from inside the app.
 */
export function reportStickersEarned(count: number): void {
  try {
    if (!Number.isFinite(count) || count < 1) return
    const n = Math.min(Math.floor(count), 10)
    post(new Array(n).fill(REWARD_STICKER_EVENT), false)
  } catch {
    /* a counter may never break a ceremony */
  }
}

/**
 * Test seam only — fire one tick as if `ms` had elapsed since the last.
 *
 * Deliberately NOT clamped here: the clamp lives inside `tickSession` and is the thing a test needs
 * to be able to exercise, by handing it an hour and asserting only one tick was banked.
 */
export function __tickSessionForTests(ms: number): void {
  tickSession(lastTickAt + ms)
}

/** Test seam only — how much ACTIVE time the ladder has banked, and how many marks it has sent. */
export function __sessionStateForTests(): { activeMs: number; marksSent: number } {
  return { activeMs, marksSent }
}

/**
 * One step of the adult-door funnel — see `ADULT_EVENTS`.
 *
 * TYPED, not a free string: every other reporter here takes a fixed constant, and a `reportUsage(x)`
 * that accepted any string would be a hole straight through the closed allow-list that bounds this
 * table's cardinality.
 *
 * Its own request rather than the batch. These are a handful per session at most, and the one that
 * matters — the adult giving up at the gate — is the moment a sitting is most likely to end, which is
 * exactly when a pending batch is least likely to flush.
 */
export function reportAdultStep(step: AdultStep): void {
  try {
    const event = ADULT_EVENTS[step]
    if (!event) return
    post([event], false)
  } catch {
    /* a counter may never break the adult surface */
  }
}

/**
 * One step of the weekly-reminder funnel — see `NOTIFY_EVENTS`. Typed and unbatched for the same
 * reasons as `reportAdultStep`: a fixed constant only, and `tap_open` is sent at a cold start that may
 * well be the shortest sitting of the week.
 */
export function reportNotifyStep(step: NotifyStep): void {
  try {
    const event = NOTIFY_EVENTS[step]
    if (!event) return
    post([event], false)
  } catch {
    /* a counter may never break a reminder flow */
  }
}
