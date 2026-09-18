// The client half of the anonymous usage counter (`docs/usage-analytics.md` §6B).
//
// WHAT THIS SENDS, AND NOTHING ELSE: an event key from the closed list in `src/config/usageEvents.ts`
// and the build's version string. No identifier, no device or viewport, no locale, no timestamp — the
// server dates the row itself, to the DAY. Several of those are individually harmless and together a
// fingerprint, which is why the payload is a fixed two-field shape rather than "a bit of context".
//
// NOTHING HERE MAY EVER REACH THE CHILD — not a spinner, not a delay, not an error (owner, 2026-09-18).
// A counter is worth exactly zero of a five-year-old's attention, so this module is built to fail
// silently and completely:
//
//   * DEFERRED off the render commit. A route change is the most animation-sensitive moment in the app
//     (page mount + the themed wipe), so the ping waits for idle instead of competing with it.
//   * NEVER AWAITED, no retry, no queue. A lost count is the intended cost.
//   * EVERY throw contained — synchronous (a malformed URL can make `fetch` throw outright in some
//     WebKit builds), asynchronous (offline, DNS, timeout), and the mapping call itself. A throw
//     escaping into the `useEffect` in `App.tsx` would hit `AppErrorBoundary` and replace the app with
//     a fallback screen BECAUSE A STATISTIC FAILED. That is the specific outcome this guards against.
//   * The response is never inspected. A 4xx, a 5xx and a success are all the same non-event here.
//   * `/api/usage` is excluded from the diagnostics ring in `src/services/diagnosticsBuffer.ts`, so a
//     failing ping cannot put a red line into a parent's bug report or flood the buffer that explains
//     a real one.

// Explicit `.ts` — this module is in the CLIENT/TEST graph, and `usagePing.test.ts` loads it under
// Node's test runner, where an extensionless specifier is ERR_MODULE_NOT_FOUND (CLAUDE.md).
import { BUILD_INFO } from '../config/version.ts'
import { apiUrl } from '../config/apiBase.ts'
import { APP_OPEN_EVENT, eventForPath } from '../config/usageEvents.ts'

/**
 * `apiUrl()` IS LOAD-BEARING, not a nicety. In the native shell the page origin is
 * `capacitor://localhost`, so a bare `/api/usage` resolves against the app BUNDLE and Capacitor's
 * local server answers it with the SPA's index.html — status 200, no error, no exception, and the
 * ping silently never reaches a server. See the full account in `src/config/apiBase.ts`.
 */
const USAGE_PATH = '/api/usage'

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
    // Even the scheduler is allowed to fail. Then the ping simply never happens.
  }
}

function send(event: string): void {
  schedule(() => {
    try {
      const request = fetch(apiUrl(USAGE_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // So a ping fired as the app goes away still leaves the device.
        keepalive: true,
        body: JSON.stringify({ event, appVersion: BUILD_INFO.version }),
        // The endpoint is unauthenticated by design; never send cookies to it.
        credentials: 'omit',
      })
      // `void` + `catch` rather than `await`: nothing downstream waits on this, and an unhandled
      // rejection would surface in the console (and in dev, get forwarded).
      void Promise.resolve(request).catch(() => {})
    } catch {
      /* see the header — a counter may never break a page */
    }
  })
}

let openReported = false

/** Once per cold start. Idempotent, so an accidental second call cannot double-count. */
export function reportAppOpen(): void {
  try {
    if (openReported) return
    openReported = true
    send(APP_OPEN_EVENT)
  } catch {
    /* unreachable today, and still contained — this is called from a useEffect */
  }
}

/**
 * One ping per screen entered. `pathname` is mapped through the closed allow-list; anything unmapped
 * (a 404, a DEV route, an unanticipated deep link) reports nothing at all.
 */
export function reportRoute(pathname: string): void {
  try {
    const event = eventForPath(pathname)
    if (event) send(event)
  } catch {
    /* as above: the mapping is pure, but the guarantee is what matters, not the current code */
  }
}

/** Test seam only — resets the once-per-start latch. */
export function __resetUsagePingForTests(): void {
  openReported = false
}
