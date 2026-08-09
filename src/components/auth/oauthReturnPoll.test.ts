import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createPollWindow,
  MAX_SAMPLE_MS,
  POLL_INTERVAL_MS,
  POLL_WINDOW_MS,
  sampleWindow,
  windowExhausted,
} from './oauthPollWindow.ts'

// OAuthReturnHandler's poll is the ONLY thing that finishes a sign-in when the app page survives the
// round trip — an installed PWA (and the shell) open the authorize URL in a separate view with its own
// storage jar, so the context that comes back holds no flowId and the context that does hold one is the
// app sitting behind it. Three shapes broke that, all silently, and all are guarded here.
//
// The accounting is tested for REAL (the pure module below); the wiring is a SOURCE guard, because there
// is no DOM in this suite. Comments are stripped first so the rationale above a fix cannot satisfy the
// guard (same reason as authOverlayZ.test.ts).

const src = readFileSync('src/components/auth/OAuthReturnHandler.tsx', 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
  .join('\n')

const effect = src.slice(src.indexOf('useEffect(() => {'), src.indexOf('}, [attempt])'))
const ARM = 'const onVisible'

test('the poll and the visibility listener are armed unconditionally', () => {
  // They used to be installed only when a flow was ALREADY pending at mount. A sign-in started later in
  // the same page lifetime therefore got no recovery at all, and the parked session was never claimed
  // (report F9BJX + four identical ones). Nothing may return out of the effect before the arming.
  assert.ok(effect.includes(ARM), 'the arming block is gone — this guard would pass vacuously')
  assert.match(effect.slice(effect.indexOf(ARM)), /setInterval\(/)
  assert.match(effect.slice(effect.indexOf(ARM)), /addEventListener\('visibilitychange'/)

  const NOTE = "noteAuthStep('google-return'"
  const beforeArming = effect.slice(effect.indexOf(NOTE) + NOTE.length, effect.indexOf(ARM))
  assert.ok(effect.includes(NOTE) && beforeArming.length > 0, 'the fragment branch moved — re-anchor this guard')
  // `[\s{;]` rather than `\b`, or the stage name "google-return" satisfies the pattern by itself.
  assert.doesNotMatch(
    beforeArming,
    /[\s{;]return\b/,
    'an early return between the fragment branch and the arming disables recovery for any flow started after mount',
  )
})

test('the tick CLAIMS before it evaluates the give-up window', () => {
  // RC4's second half. The tick used to test the window first and `return` — so the one tick that would
  // have succeeded, the first after the sign-in sheet closed, was spent throwing the flow away instead.
  const tick = effect.slice(effect.indexOf('setInterval('))
  const claimAt = tick.indexOf('attempt()')
  const giveUpAt = tick.indexOf('windowExhausted(')
  assert.ok(claimAt > 0, 'the tick no longer claims at all')
  assert.ok(giveUpAt > 0, 'the give-up test is gone — this guard would pass vacuously')
  assert.ok(
    claimAt < giveUpAt,
    'the give-up window is evaluated before the claim — a flow the server would still honour is discarded',
  )
  // And the give-up must sit INSIDE the claim's continuation, not merely after it in source order.
  assert.match(
    tick.slice(claimAt, giveUpAt),
    /\.then\(/,
    'the give-up must run after the claim RESOLVES, or it races the answer it is waiting for',
  )
})

test('the give-up is measured in foreground time, never wall-clock', () => {
  // The measured shape (report 8AE9T): three polls, a 210 s gap while iOS suspended the webview behind
  // the sign-in sheet, then a give-up. Wall-clock accounting cannot tell that gap from three minutes of
  // an adult staring at the screen.
  const tick = effect.slice(effect.indexOf('setInterval('))
  assert.doesNotMatch(
    tick,
    /Date\.now\(\) - current\.startedAt/,
    'wall-clock accounting is back — a suspended webview will discard a live flow again',
  )
  assert.match(tick, /sample\(\)/, 'the tick must fold elapsed time into the window')
  // The SAMPLER, not merely the file: `visibilityState` also appears in the visibility listener, so a
  // guard for the bare token stayed green with the sampler passing a hardcoded `true` (found by
  // re-breaking this very assertion).
  assert.match(
    effect,
    /sampleWindow\(pollWindow, Date\.now\(\), document\.visibilityState === 'visible'\)/,
    'the sampler must be told whether the page is actually visible — only visible time may count',
  )
  assert.doesNotMatch(src, /useRef<number>\(Date\.now\(\)\)/, 'the mount-time window ref is back')
})

test('a decisive server answer stops the poll SILENTLY; a timer expiry still reports', () => {
  // The server now answers 410-with-a-reason for a failed flow (W3), and the claim path already cleared
  // the flow and told the adult. A second report here would duplicate one the server stored.
  const tick = effect.slice(effect.indexOf('setInterval('))
  const guard = tick.indexOf('readPendingFlow()', tick.indexOf('.then('))
  const report = tick.indexOf("reportAuthFailure('google-claim'")
  assert.ok(guard > 0 && report > guard, 'the poll must re-check the flow before reporting a give-up')
  assert.match(tick.slice(guard, report), /poll-window-exhausted|windowExhausted/)
})

// ----- the accounting itself, for real ------------------------------------------------------------

test('foreground time accumulates a tick at a time while visible', () => {
  let w = createPollWindow(0)
  for (let i = 1; i <= 10; i++) w = sampleWindow(w, i * POLL_INTERVAL_MS, true)
  assert.equal(w.foregroundMs, 10 * POLL_INTERVAL_MS)
  assert.equal(windowExhausted(w), false)
})

test('hidden time does not count at all', () => {
  let w = createPollWindow(0)
  w = sampleWindow(w, 3000, true) // one visible tick
  w = sampleWindow(w, 600_000, false) // ten minutes hidden
  assert.equal(w.foregroundMs, 3000, 'time spent hidden was charged to the window')
  assert.equal(windowExhausted(w), false)
})

test('THE FROZEN CLOCK: a 210 s suspension cannot exhaust the window', () => {
  // Report 8AE9T, reproduced. Three polls, then iOS suspends the webview while SFSafariViewController
  // covers it, then it thaws. Whether `visibilitychange` fires for a covering sheet is UNKNOWN (rung 3
  // only), so this asserts the WORST case: the page claims to have been visible the whole time and the
  // per-sample cap is the only thing standing between the adult and a discarded flow.
  let w = createPollWindow(0)
  w = sampleWindow(w, 1_800, true)
  w = sampleWindow(w, 5_000, true)
  w = sampleWindow(w, 9_000, true)
  const beforeFreeze = w.foregroundMs
  w = sampleWindow(w, 219_000, true) // the 210 s gap, resuming as "visible"
  assert.ok(
    w.foregroundMs <= beforeFreeze + MAX_SAMPLE_MS,
    `a frozen tick contributed ${w.foregroundMs - beforeFreeze}ms — the per-sample cap is not holding`,
  )
  assert.equal(windowExhausted(w), false, 'the flow would have been thrown away at +220 s, exactly as it was')
})

test('the window does eventually close, in real foreground time', () => {
  // It is a give-up window, not an infinite loop: an adult who genuinely watches the lock screen for
  // longer than the server keeps the flow gets a reported failure rather than silence.
  let w = createPollWindow(0)
  let t = 0
  while (!windowExhausted(w) && t < 60 * 60 * 1000) {
    t += POLL_INTERVAL_MS
    w = sampleWindow(w, t, true)
  }
  assert.equal(windowExhausted(w), true, 'the window never closes')
  assert.ok(t > POLL_WINDOW_MS && t <= POLL_WINDOW_MS + POLL_INTERVAL_MS, `closed after ${t}ms`)
})

test('the client ceiling matches the SERVER flow TTL', () => {
  // They were 3 minutes and 10 minutes, and the client's shorter one was discarding flows the server was
  // still holding. Read from the server source rather than restated, so the two cannot drift apart.
  const server = readFileSync('lib/auth-family-plugin.ts', 'utf8')
  const m = server.match(/const OAUTH_FLOW_TTL_MS = (\d+) \* (\d+) \* (\d+)/)
  assert.ok(m, 'OAUTH_FLOW_TTL_MS moved — re-anchor this guard')
  assert.equal(POLL_WINDOW_MS, Number(m![1]) * Number(m![2]) * Number(m![3]))
})
