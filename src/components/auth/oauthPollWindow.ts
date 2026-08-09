// HOW LONG HAS THE APP ACTUALLY BEEN WATCHING FOR THE SESSION? — pure, so it can be tested.
//
// THE MEASURED FAILURE (sign-in reliability PRD RC4). Report 8AE9T's network ring: `/oauth/claim` 200 at
// +1.8 s, +5 s, +9 s — then **nothing for 210 s** — then a give-up at +220 s. iOS suspends the shell's
// WKWebView while `SFSafariViewController` covers it, so the poll's timer simply stops. The first tick
// after the sheet closed compared `Date.now() - startedAt` against a 3-minute window, found itself past
// it, and threw away a flow the SERVER would still have honoured: the flow TTL is 10 minutes and the
// post-callback claim TTL is 5.
//
// So the window is accumulated in FOREGROUND TIME. Two independent things make that safe:
//
//   * only a sample taken while `visibilityState === 'visible'` counts at all, and
//   * each sample is CAPPED, because a webview that was frozen for 210 s resumes with one enormous
//     delta that is not foreground time no matter what `visibilityState` says at the moment it thaws.
//     Whether iOS fires `visibilitychange` for a covering sheet is UNKNOWN (rung 3 only), so the cap is
//     what makes this correct without knowing.
//
// Steady-state cost of the cap when the app really is in the foreground: nothing — a 3 s tick is well
// under the 6 s ceiling, so the accounting is exact in the normal case and conservative in the frozen
// one.

/** How often the recovery poll asks the server. */
export const POLL_INTERVAL_MS = 3000

/**
 * The give-up ceiling, in FOREGROUND time — deliberately the server's own `OAUTH_FLOW_TTL_MS`, so
 * client and server agree on when a flow is dead instead of the client being pessimistic by 7 minutes.
 */
export const POLL_WINDOW_MS = 10 * 60 * 1000

/** No single sample may contribute more than two ticks. See the freeze note above. */
export const MAX_SAMPLE_MS = POLL_INTERVAL_MS * 2

export interface PollWindow {
  /** Milliseconds this app has spent visible with a flow in flight. */
  foregroundMs: number
  /** When the last sample was taken. */
  lastSampleAt: number
}

export const createPollWindow = (now: number): PollWindow => ({ foregroundMs: 0, lastSampleAt: now })

/**
 * Fold the time since the previous sample into the window.
 *
 * Called on every poll tick AND on every `visibilitychange`, so a long hidden stretch is bounded at both
 * ends rather than at whichever one happened to fire.
 */
export function sampleWindow(w: PollWindow, now: number, visible: boolean): PollWindow {
  const elapsed = Math.max(0, now - w.lastSampleAt)
  return {
    foregroundMs: w.foregroundMs + (visible ? Math.min(elapsed, MAX_SAMPLE_MS) : 0),
    lastSampleAt: now,
  }
}

/** True once the app has genuinely watched for longer than the server would keep the flow. */
export const windowExhausted = (w: PollWindow): boolean => w.foregroundMs > POLL_WINDOW_MS
