// A Capacitor plugin proxy is a THENABLE, and returning one from an async function hangs forever.
//
// Report BV9DJ (iPad Pro 5th gen 12.9", shell build b99afb6): tapping "Log ind med Google" in the
// native shell disabled the button and then nothing happened, ever. `loadBrowser()` was an `async`
// function returning `mod.Browser` — the proxy — so the promise machinery tried to assimilate it and
// called `Browser.then(resolve, reject)`. Capacitor's wrapper ignores both callbacks, so the outer
// promise NEVER SETTLED: no throw, no rejection, nothing for the `try/catch` in `googleSignIn.ts` to
// catch, and a permanently disabled button. Its own orphaned promise rejected with
// `"Browser.then()" is not implemented on ios`, which is the only reason a report exists at all.
//
// The fake below is the REAL shape, taken from `@capacitor/core`'s `registerPlugin`: a `Proxy` whose
// `get` trap answers every property with a method wrapper. Capacitor special-cases `$$typeof` and
// `toJSON` to dodge exactly this class of bug — and not `then`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boxPluginForTest } from './shellBrowser.ts'

/** A stand-in for what `registerPlugin('Browser')` hands back on a device. */
const capacitorStylePluginProxy = () =>
  new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === '$$typeof') return undefined
        // EVERY other property, `then` included, is a method wrapper that neither resolves nor
        // rejects the caller's promise — it returns one of its own that rejects unheld.
        return (..._args: unknown[]) => {
          const p = Promise.reject(
            new Error(`"Browser.${String(prop)}()" is not implemented on ios`),
          )
          p.catch(() => {}) // keep THIS test process clean; the app is what saw it unhandled
          return p
        }
      },
    },
  ) as unknown as Record<string, unknown>

/** Resolves to 'settled' or 'HUNG' — never rejects, so a hang is a value, not a timeout. */
const settlesWithin = async (value: unknown, ms = 150): Promise<'settled' | 'HUNG'> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const hung = new Promise<'HUNG'>((r) => {
    timer = setTimeout(() => r('HUNG'), ms)
  })
  // The bug lives in exactly this step: resolving a promise WITH the value.
  const settled = Promise.resolve()
    .then(() => value)
    .then(() => 'settled' as const)
    .catch(() => 'settled' as const)
  const result = await Promise.race([settled, hung])
  clearTimeout(timer)
  return result
}

test('the fake is faithful: a bare plugin proxy really does hang an async return', async () => {
  // The control. Without this the test below proves nothing — a boxed value settling is unremarkable
  // unless the unboxed one demonstrably does not.
  assert.equal(await settlesWithin(capacitorStylePluginProxy()), 'HUNG')
})

test('boxing the plugin makes the async return settle', async () => {
  const boxed = boxPluginForTest(capacitorStylePluginProxy() as never)
  assert.equal(await settlesWithin(boxed), 'settled')
})

test('the box keeps the plugin reachable, and maps absent → null', () => {
  const proxy = capacitorStylePluginProxy() as never
  assert.equal(boxPluginForTest(proxy)?.plugin, proxy)
  assert.equal(boxPluginForTest(undefined), null)
})

test('the box itself is not a thenable', () => {
  // A container that happened to expose a `then` would reintroduce the whole bug one level up.
  const boxed = boxPluginForTest(capacitorStylePluginProxy() as never)
  assert.equal(typeof (boxed as unknown as { then?: unknown }).then, 'undefined')
})
