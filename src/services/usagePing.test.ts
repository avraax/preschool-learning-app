import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_EVENTS_PER_REQUEST } from '../config/usageEvents.ts'
import {
  __flushUsagePingForTests,
  __resetUsagePingForTests,
  __sessionStateForTests,
  __setSessionGapForTests,
  __tickSessionForTests,
  isNewSession,
  reportStickersEarned,
  reportAppOpen,
  reportRoute,
} from './usagePing.ts'

// THE PROMISE THIS PINS (owner, 2026-09-18, restated 2026-09-20): a usage ping must never reach the
// child — not as a delay, not as an error, not as a fallback screen. `reportRoute` is called from a
// `useEffect` in `App.tsx`, so a throw escaping it would be caught by `AppErrorBoundary` and replace
// the whole app with an error screen BECAUSE A STATISTIC FAILED.
//
// Plus the batching contract (2026-09-20): `app_open` is never batched, routes always are, and the
// request carries NAMES rather than counts so the caller can never supply an increment.

type FetchCall = { url: string; init: RequestInit }

function installFetch(impl: (url: string, init: RequestInit) => unknown): {
  calls: FetchCall[]
  restore: () => void
} {
  const calls: FetchCall[] = []
  const original = globalThis.fetch
  ;(globalThis as any).fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return impl(url, init)
  }
  return { calls, restore: () => { (globalThis as any).fetch = original } }
}

const ok = () => Promise.resolve({ ok: true })
const settle = () => new Promise((r) => setTimeout(r, 15))
const bodyOf = (c: FetchCall) => JSON.parse(String(c.init.body)) as { events: string[], appVersion: string }

// ---- the batching contract ----------------------------------------------------------------------

test('app_open is sent IMMEDIATELY and alone, never batched', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    // The headline number must not wait for a flush that a backgrounded iOS app may never run.
    assert.equal(f.calls.length, 1, 'app_open did not go out on its own')
    assert.deepEqual(bodyOf(f.calls[0]).events, ['app_open'])
  } finally {
    f.restore()
  }
})

test('route events are BUFFERED, not sent per screen', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportRoute('/math/addition')
    reportRoute('/farver/jagt')
    reportRoute('/album')
    await settle()
    assert.equal(f.calls.length, 0, 'a route event was sent immediately — batching is not happening')
  } finally {
    f.restore()
  }
})

test('a flush sends the whole batch as ONE request', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportRoute('/math/addition')
    reportRoute('/farver/jagt')
    reportRoute('/album')
    __flushUsagePingForTests()
    await settle()
    assert.equal(f.calls.length, 1, `expected one batched request, got ${f.calls.length}`)
    assert.deepEqual(bodyOf(f.calls[0]).events, [
      'route:math_addition',
      'route:farver_jagt',
      'route:album',
    ])
  } finally {
    f.restore()
  }
})

test('a repeated screen appears once per visit — the server counts, the client does not', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportRoute('/math/addition')
    reportRoute('/math')
    reportRoute('/math/addition')
    __flushUsagePingForTests()
    await settle()
    const events = bodyOf(f.calls[0]).events
    assert.equal(events.filter((e) => e === 'route:math_addition').length, 2)
    // No count field anywhere: an increment the caller can choose is the thing this shape avoids.
    assert.deepEqual(Object.keys(bodyOf(f.calls[0])).sort(), ['appVersion', 'events'])
    assert.ok(!/"count"|"n"/.test(String(f.calls[0].init.body)), 'the body carries a number')
  } finally {
    f.restore()
  }
})

test('the buffer flushes itself at the cap rather than growing or dropping', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    for (let i = 0; i < MAX_EVENTS_PER_REQUEST; i++) reportRoute('/album')
    await settle()
    assert.equal(f.calls.length, 1, 'reaching the cap did not flush')
    assert.equal(bodyOf(f.calls[0]).events.length, MAX_EVENTS_PER_REQUEST)
    // And nothing was lost or double-sent on the way.
    __flushUsagePingForTests()
    await settle()
    assert.equal(f.calls.length, 1, 'the cap flush left events behind')
  } finally {
    f.restore()
  }
})

test('flushing an empty buffer sends nothing', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    __flushUsagePingForTests()
    await settle()
    assert.equal(f.calls.length, 0)
  } finally {
    f.restore()
  }
})

test('an unmapped path buffers nothing at all', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportRoute('/dev/scene')
    reportRoute('/nope')
    reportRoute("/learning/memory/'; DROP TABLE usage_counter; --")
    __flushUsagePingForTests()
    await settle()
    assert.equal(f.calls.length, 0, 'an unmapped path reached the buffer')
  } finally {
    f.restore()
  }
})

test('app_open fires exactly once per cold start', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportAppOpen()
    reportAppOpen()
    reportAppOpen()
    await settle()
    assert.equal(f.calls.length, 1)
  } finally {
    f.restore()
  }
})

test('the payload carries the events and the version, and nothing else', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportRoute('/ordleg/read')
    __flushUsagePingForTests()
    await settle()
    const sent = bodyOf(f.calls[0])
    assert.deepEqual(Object.keys(sent).sort(), ['appVersion', 'events'])
    assert.deepEqual(sent.events, ['route:ordleg_read'])
    // Cookies would make the request identifiable at the edge; the endpoint is unauthenticated by design.
    assert.equal(f.calls[0].init.credentials, 'omit')
  } finally {
    f.restore()
  }
})

// ---- nothing may ever reach the child ------------------------------------------------------------

test('a synchronous throw from fetch never escapes', async () => {
  __resetUsagePingForTests()
  const f = installFetch(() => {
    throw new Error('WebKit threw on a malformed URL')
  })
  try {
    // If any of these throws, the test fails — which is the whole point.
    reportAppOpen()
    reportRoute('/math/addition')
    __flushUsagePingForTests()
    await settle()
    assert.equal(f.calls.length, 2, 'both sends should still have been attempted')
  } finally {
    f.restore()
  }
})

test('a rejected fetch produces no unhandled rejection', async () => {
  __resetUsagePingForTests()
  let unhandled: unknown = null
  const onUnhandled = (e: unknown) => { unhandled = e }
  process.on('unhandledRejection', onUnhandled)
  const f = installFetch(() => Promise.reject(new Error('offline')))
  try {
    reportRoute('/farver/jagt')
    __flushUsagePingForTests()
    await settle()
    await settle()
  } finally {
    f.restore()
    process.off('unhandledRejection', onUnhandled)
  }
  assert.equal(unhandled, null, `a rejected ping surfaced: ${String(unhandled)}`)
})

test('a throw does not resend the same events forever', async () => {
  // The buffer is taken BEFORE the post, so a failing send loses that batch rather than retrying it
  // into a loop. Losing counts is the designed cost; a hot loop on a child's iPad is not.
  __resetUsagePingForTests()
  const f = installFetch(() => { throw new Error('boom') })
  try {
    reportRoute('/album')
    __flushUsagePingForTests()
    await settle()
    __flushUsagePingForTests()
    await settle()
    assert.equal(f.calls.length, 1, 'the failed batch was resent')
  } finally {
    f.restore()
  }
})

test('the ping is DEFERRED, not sent during the render commit', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportAppOpen()
    // A route change is the most animation-sensitive moment in the app; nothing may run inline.
    assert.equal(f.calls.length, 0, 'app_open fired synchronously inside the effect')
    await settle()
    assert.equal(f.calls.length, 1, 'the deferred send never ran')
  } finally {
    f.restore()
  }
})

test('a 500 is as uneventful as a 204', async () => {
  __resetUsagePingForTests()
  // A stub with no `.ok`, no `.json()` and no `.status`. Nothing may go wrong on any of them.
  //
  // This is a WEAK test on purpose and the re-break pass proved it: because every path is caught,
  // reading the response can never produce an observable failure — so "the module does not inspect the
  // response" is a property of the SOURCE, not of the behaviour, and it is pinned as a source guard in
  // `lib/usageEndpoint.test.ts`.
  const f = installFetch(() => Promise.resolve(Object.freeze({})))
  try {
    reportRoute('/album')
    __flushUsagePingForTests()
    await settle()
    assert.equal(f.calls.length, 1)
  } finally {
    f.restore()
  }
})

// ---- sessions: app_open must count a RESUME, not just a cold start -------------------------------
//
// Owner, 2026-10-03. Production showed 3 opens against 205 events in a day. In the native shell the
// WebView survives backgrounding, so a child returning hours later resumed WITHOUT a page load and was
// never counted — the number was wrong in the one direction the data cannot reveal about itself.
//
// Node has no `document`, so these install a fake one. Plain assignment is safe here (unlike
// `navigator`, which Node ≥21 defines and which needs defineProperty — see CLAUDE.md).

const domListeners: Record<string, Array<() => void>> = {}
const fakeDoc = {
  visibilityState: 'visible' as 'visible' | 'hidden',
  addEventListener: (t: string, fn: () => void) => { (domListeners[t] ||= []).push(fn) },
}
;(globalThis as any).document = fakeDoc
;(globalThis as any).window = {
  addEventListener: (t: string, fn: () => void) => { (domListeners[t] ||= []).push(fn) },
}

/** Drive the real listeners the module registered. */
function visibility(state: 'visible' | 'hidden'): void {
  fakeDoc.visibilityState = state
  ;(domListeners['visibilitychange'] || []).forEach((f) => f())
}

const opens = (calls: FetchCall[]) =>
  calls.flatMap((c) => (JSON.parse(String(c.init.body)) as { events: string[] }).events)
    .filter((e) => e === 'app_open').length

test('isNewSession: the rule itself', () => {
  const GAP = 1000
  // An explicit hide is the signal when there was one.
  assert.equal(isNewSession(0, 0, GAP, GAP), true, 'away exactly the gap counts')
  assert.equal(isNewSession(0, 0, GAP - 1, GAP), false, 'away less than the gap does not')
  // The hide wins over activity, even when activity is more recent.
  assert.equal(isNewSession(0, 900, GAP, GAP), true, 'a long hide counts despite recent activity')
  // With no hide at all, a long quiet gap is the fallback signal.
  assert.equal(isNewSession(null, 0, GAP, GAP), true, 'idle for the gap counts')
  assert.equal(isNewSession(null, 500, GAP, GAP), false, 'idle for less than the gap does not')
})

test('backgrounding and returning AFTER the gap counts a new session', async () => {
  __resetUsagePingForTests()
  __setSessionGapForTests(40)
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    assert.equal(opens(f.calls), 1, 'the cold start should count once')

    visibility('hidden')
    await new Promise((r) => setTimeout(r, 60)) // longer than the gap
    visibility('visible')
    await settle()
    assert.equal(opens(f.calls), 2, 'the resume was not counted — this is the bug being fixed')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('a BRIEF interruption is the same sitting, not a new one', async () => {
  __resetUsagePingForTests()
  __setSessionGapForTests(10_000) // a real 30-min-style gap: nothing here should reach it
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    visibility('hidden')
    await new Promise((r) => setTimeout(r, 20))
    visibility('visible')
    await settle()
    assert.equal(opens(f.calls), 1, 'a 20ms glance away must not inflate the count')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('the resume is counted ONCE, not again by the route that follows it', async () => {
  __resetUsagePingForTests()
  __setSessionGapForTests(40)
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    visibility('hidden')
    await new Promise((r) => setTimeout(r, 60))
    visibility('visible')
    reportRoute('/alphabet/quiz')      // the child taps straight back in
    __flushUsagePingForTests()
    await settle()
    assert.equal(opens(f.calls), 2, 'the return was double-counted')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('FALLBACK: a tap after a long quiet gap counts, even if visibilitychange never fires', async () => {
  // This is the path that matters on a backgrounded Capacitor WKWebView, where whether
  // `visibilitychange` fires at all is unverified — and fails silently if it does not.
  __resetUsagePingForTests()
  __setSessionGapForTests(40)
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    await new Promise((r) => setTimeout(r, 60)) // no hide event at all, just quiet
    reportRoute('/album')
    __flushUsagePingForTests()
    await settle()
    assert.equal(opens(f.calls), 2, 'an idle return produced no session')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('continuous play never counts a second session', async () => {
  __resetUsagePingForTests()
  __setSessionGapForTests(10_000)
  const f = installFetch(ok)
  try {
    reportAppOpen()
    for (const p of ['/math', '/math/addition', '/math', '/farver', '/album', '/']) reportRoute(p)
    __flushUsagePingForTests()
    await settle()
    assert.equal(opens(f.calls), 1, 'navigating around inflated the session count')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('a resumed session is sent IMMEDIATELY, never left in the batch', async () => {
  // Same reason the cold start is unbatched: a short visit whose flush never fires must still report.
  __resetUsagePingForTests()
  __setSessionGapForTests(40)
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    const before = f.calls.length
    visibility('hidden')
    await new Promise((r) => setTimeout(r, 60))
    visibility('visible')
    await settle()
    const body = JSON.parse(String(f.calls[before].init.body)) as { events: string[] }
    assert.deepEqual(body.events, ['app_open'], 'the resume did not go out on its own')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('a visibility event never throws into the app', async () => {
  __resetUsagePingForTests()
  __setSessionGapForTests(40)
  const f = installFetch(() => { throw new Error('offline') })
  try {
    reportAppOpen()
    visibility('hidden')
    await new Promise((r) => setTimeout(r, 60))
    visibility('visible')   // must not throw
    await settle()
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('a "visible" event with NO preceding hide never counts', async () => {
  // Found by a WebKit probe: it produced THREE sessions from one page load, because the probe pinned
  // `visibilityState` to 'visible' and every later engine-fired event then looked like a return once
  // the idle clock had moved on. A return requires an actual hide; idle-then-tap is handled by
  // reportRoute, which cannot fire without a child doing something.
  __resetUsagePingForTests()
  __setSessionGapForTests(40)
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    await new Promise((r) => setTimeout(r, 60)) // long enough that the gap would otherwise be met
    visibility('visible')                        // …but we were never hidden
    visibility('visible')
    await settle()
    assert.equal(opens(f.calls), 1, 'a bare "visible" event inflated the session count')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

// ---- the session-depth ladder --------------------------------------------------------------------
//
// The number this exists to produce: `app_open → 1min → 5min → 15min` as a funnel, because counts
// alone cannot tell "twenty children opened it once and left" from "two played for an hour".

const marks = (calls: FetchCall[]) =>
  calls.flatMap((c) => (JSON.parse(String(c.init.body)) as { events: string[] }).events)
    .filter((e) => e.startsWith('session:'))

test('the ladder emits each mark once, in order, as active time accrues', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    assert.deepEqual(marks(f.calls), [], 'a mark fired before any time had passed')

    for (let i = 0; i < 4; i++) __tickSessionForTests(15_000)   // 1 minute
    await settle()
    assert.deepEqual(marks(f.calls), ['session:1min'])

    for (let i = 0; i < 16; i++) __tickSessionForTests(15_000)  // 5 minutes total
    await settle()
    assert.deepEqual(marks(f.calls), ['session:1min', 'session:5min'])

    for (let i = 0; i < 40; i++) __tickSessionForTests(15_000)  // 15 minutes total
    await settle()
    assert.deepEqual(marks(f.calls), ['session:1min', 'session:5min', 'session:15min'])

    for (let i = 0; i < 40; i++) __tickSessionForTests(15_000)  // keep playing
    await settle()
    assert.equal(marks(f.calls).length, 3, 'a mark repeated — the ladder is not once-per-session')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('BACKGROUND TIME IS NOT PLAY: one suspended tick banks one tick, not an hour', async () => {
  // iOS throttles timers hard in the background, and `visibilitychange` may never tell us. Without
  // the clamp an iPad in a pocket would award itself session:15min.
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportAppOpen()
    await settle()
    __tickSessionForTests(60 * 60_000)   // the device was asleep for an hour
    await settle()
    assert.deepEqual(marks(f.calls), [], 'an hour in the background counted as play')
    assert.ok(
      __sessionStateForTests().activeMs <= 30_000,
      `banked ${__sessionStateForTests().activeMs}ms from one suspended tick`,
    )
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('a new session restarts the ladder from zero', async () => {
  __resetUsagePingForTests()
  __setSessionGapForTests(40)
  const f = installFetch(ok)
  try {
    reportAppOpen()
    for (let i = 0; i < 4; i++) __tickSessionForTests(15_000)
    await settle()
    assert.deepEqual(marks(f.calls), ['session:1min'])

    visibility('hidden')
    await new Promise((r) => setTimeout(r, 60))
    visibility('visible')                       // a new sitting
    await settle()
    assert.equal(__sessionStateForTests().activeMs, 0, 'the ladder kept the old session time')
    assert.equal(__sessionStateForTests().marksSent, 0, 'the ladder did not reset its marks')

    for (let i = 0; i < 4; i++) __tickSessionForTests(15_000)
    await settle()
    assert.deepEqual(marks(f.calls), ['session:1min', 'session:1min'], 'the second sitting never reached a minute')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

// ---- stickers actually earned ---------------------------------------------------------------------

const stickers = (calls: FetchCall[]) =>
  calls.flatMap((c) => (JSON.parse(String(c.init.body)) as { events: string[] }).events)
    .filter((e) => e === 'reward:sticker').length

test('a ceremony reports one event per sticker handed over', async () => {
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    reportStickersEarned(1)
    await settle()
    assert.equal(stickers(f.calls), 1)
    reportStickersEarned(3)                     // an offline merge can owe several at once
    await settle()
    assert.equal(stickers(f.calls), 4)
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('a nonsense sticker count reports nothing, and a huge one is clamped', async () => {
  // The caller is our own code, but this is the only place a NUMBER reaches the event stream.
  __resetUsagePingForTests()
  const f = installFetch(ok)
  try {
    for (const bad of [0, -1, NaN, Infinity, -Infinity]) reportStickersEarned(bad as number)
    await settle()
    assert.equal(stickers(f.calls), 0, `a nonsense count produced ${stickers(f.calls)} sticker(s)`)
    reportStickersEarned(99999)
    await settle()
    assert.equal(stickers(f.calls), 10, 'the clamp did not hold')
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})

test('reporting a sticker never throws into the ceremony', async () => {
  __resetUsagePingForTests()
  const f = installFetch(() => { throw new Error('offline') })
  try {
    reportStickersEarned(2)   // must not throw
    await settle()
  } finally {
    f.restore()
    __resetUsagePingForTests()
  }
})
