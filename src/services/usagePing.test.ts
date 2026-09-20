import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_EVENTS_PER_REQUEST } from '../config/usageEvents.ts'
import {
  __flushUsagePingForTests,
  __resetUsagePingForTests,
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
