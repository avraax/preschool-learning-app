import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __resetUsagePingForTests, reportAppOpen, reportRoute } from './usagePing.ts'

// THE PROMISE THIS PINS (owner, 2026-09-18): a usage ping must never reach the child — not as a delay,
// not as an error, not as a fallback screen. `reportRoute` is called from a `useEffect` in `App.tsx`,
// so a throw escaping it would be caught by `AppErrorBoundary` and replace the whole app with an error
// screen BECAUSE A STATISTIC FAILED. Every test here is that guarantee, one failure mode at a time.

type FetchCall = { url: string; init: RequestInit }

/** Swap in a fake `fetch`, run, restore. Returns what the module tried to send. */
async function withFetch(
  impl: (url: string, init: RequestInit) => Promise<unknown>,
  body: () => void,
): Promise<FetchCall[]> {
  const calls: FetchCall[] = []
  const original = globalThis.fetch
  ;(globalThis as any).fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return impl(url, init)
  }
  try {
    body()
    // The send is deferred; let the macrotask queue drain (Node has no requestIdleCallback, so the
    // module falls back to setTimeout(0) — see `schedule()`).
    await new Promise((r) => setTimeout(r, 10))
  } finally {
    ;(globalThis as any).fetch = original
  }
  return calls
}

test('a synchronous throw from fetch never escapes', async () => {
  __resetUsagePingForTests()
  const calls = await withFetch(
    () => {
      throw new Error('WebKit threw on a malformed URL')
    },
    () => {
      // If this throws, the test fails — which is the whole point.
      reportRoute('/math/addition')
      reportAppOpen()
    },
  )
  assert.equal(calls.length, 2, 'both pings should still have been attempted')
})

test('a rejected fetch produces no unhandled rejection', async () => {
  __resetUsagePingForTests()
  let unhandled: unknown = null
  const onUnhandled = (e: unknown) => {
    unhandled = e
  }
  process.on('unhandledRejection', onUnhandled)
  try {
    await withFetch(
      () => Promise.reject(new Error('offline')),
      () => reportRoute('/farver/jagt'),
    )
    // Give the rejection a turn to surface if it were going to.
    await new Promise((r) => setTimeout(r, 20))
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
  assert.equal(unhandled, null, `a rejected ping surfaced: ${String(unhandled)}`)
})

test('the ping is DEFERRED, not sent during the render commit', async () => {
  __resetUsagePingForTests()
  const calls: string[] = []
  const original = globalThis.fetch
  ;(globalThis as any).fetch = (url: string) => {
    calls.push(url)
    return Promise.resolve({ ok: true })
  }
  try {
    reportRoute('/alphabet/quiz')
    // A route change is the most animation-sensitive moment in the app; the ping must not run inline.
    assert.equal(calls.length, 0, 'the ping fired synchronously inside the effect')
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(calls.length, 1, 'the deferred ping never ran')
  } finally {
    ;(globalThis as any).fetch = original
  }
})

test('an unmapped path sends nothing at all', async () => {
  __resetUsagePingForTests()
  const calls = await withFetch(
    () => Promise.resolve({ ok: true }),
    () => {
      reportRoute('/dev/scene')
      reportRoute('/nope')
      reportRoute("/learning/memory/'; DROP TABLE usage_counter; --")
    },
  )
  assert.equal(calls.length, 0, `unmapped paths produced ${calls.length} request(s)`)
})

test('app_open fires exactly once per cold start', async () => {
  __resetUsagePingForTests()
  const calls = await withFetch(
    () => Promise.resolve({ ok: true }),
    () => {
      reportAppOpen()
      reportAppOpen()
      reportAppOpen()
    },
  )
  assert.equal(calls.length, 1)
  assert.equal(JSON.parse(String(calls[0].init.body)).event, 'app_open')
})

test('the payload carries the event and the version, and nothing else', async () => {
  __resetUsagePingForTests()
  const calls = await withFetch(
    () => Promise.resolve({ ok: true }),
    () => reportRoute('/ordleg/read'),
  )
  assert.equal(calls.length, 1)
  const sent = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>
  assert.deepEqual(Object.keys(sent).sort(), ['appVersion', 'event'])
  assert.equal(sent.event, 'route:ordleg_read')
  // Cookies would make the request identifiable at the edge; the endpoint is unauthenticated by design.
  assert.equal(calls[0].init.credentials, 'omit')
})

test('a 500 is as uneventful as a 204', async () => {
  __resetUsagePingForTests()
  // A stub with no `.ok`, no `.json()` and no `.status`. Nothing may go wrong on any of them.
  //
  // This is a WEAK test on purpose and the re-break pass proved it: because every path is caught,
  // reading the response can never produce an observable failure — so "the module does not inspect the
  // response" is a property of the SOURCE, not of the behaviour, and it is pinned as a source guard in
  // `lib/usageEndpoint.test.ts`. What this still covers is that a bare response object cannot make the
  // ping throw.
  const calls = await withFetch(
    () => Promise.resolve(Object.freeze({})),
    () => reportRoute('/album'),
  )
  assert.equal(calls.length, 1)
})
