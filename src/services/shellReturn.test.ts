import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { boxAppPluginForTest, ensureShellReturnListener } from './shellReturn.ts'

// Two independent ways W5 layer 1 can fail silently, and one guard each.
//
// 1. THE PLUGIN PROXY IS A THENABLE. `registerPlugin` returns a Proxy whose `get` trap answers every
//    property — `then` included — with a method wrapper that ignores both callbacks. An `async`
//    function returning it never settles: no throw, no rejection, nothing to catch, and the sign-in
//    simply stops (report BV9DJ, with @capacitor/browser). `.claude/rules/ios-shell.md` carries it.
//
// 2. THE CAPABILITY MUST BE MEASURED, NOT ASSUMED. `client: 'shell-scheme'` tells the server it may
//    302 to a custom scheme. A binary that never registered the listener cannot receive that, and the
//    redirect would end a SUCCESSFUL sign-in on Safari's "the address is invalid" — worse than the
//    terminal page it replaces. Off the shell the answer must be a plain `false`.

const capacitorStylePluginProxy = () =>
  new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === '$$typeof') return undefined
        return (..._args: unknown[]) => {
          const p = Promise.reject(new Error(`"App.${String(prop)}()" is not implemented on ios`))
          p.catch(() => {})
          return p
        }
      },
    },
  ) as unknown as Record<string, unknown>

const settlesWithin = async (value: unknown, ms = 150): Promise<'settled' | 'HUNG'> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const hung = new Promise<'HUNG'>((r) => {
    timer = setTimeout(() => r('HUNG'), ms)
  })
  const settled = Promise.resolve()
    .then(() => value)
    .then(() => 'settled' as const)
    .catch(() => 'settled' as const)
  const result = await Promise.race([settled, hung])
  clearTimeout(timer)
  return result
}

test('the fake is faithful: a bare App proxy really does hang an async return', async () => {
  // The control. Without it, a boxed value settling proves nothing.
  assert.equal(await settlesWithin(capacitorStylePluginProxy()), 'HUNG')
})

test('boxing the App plugin makes the assimilation structurally impossible', async () => {
  const boxed = boxAppPluginForTest(capacitorStylePluginProxy() as never)
  assert.equal(await settlesWithin(boxed), 'settled')
  assert.equal(boxAppPluginForTest(undefined), null)
})

test('off the shell the capability is a plain false — no plugin is even loaded', async () => {
  // In this suite `runtimeTarget()` is `web` (no window), which is also every browser and PWA install.
  // A truthy answer here would make the server 302 a Safari tab to `bl://`, which is a dead end.
  let called = false
  const can = await ensureShellReturnListener(() => {
    called = true
  })
  assert.equal(can, false)
  assert.equal(called, false)
  // The RESULT is not proof on its own — a web build would also answer `false` by failing to load the
  // plugin, which is the same answer for the wrong reason and costs a dynamic import on every sign-in.
  // The early return is the thing under test.
  const src = readFileSync('src/services/shellReturn.ts', 'utf8')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n')
  assert.match(
    src,
    /if \(!isNativeShell\(\)\) return Promise\.resolve\(false\)/,
    'the shell check must short-circuit before any @capacitor/app import',
  )
})

test('the client only claims `shell-scheme` once the listener is registered', () => {
  // The rollout guarantee, as a source guard: every binary already on the owner's iPad will answer
  // `false` here and must keep getting layer 2's terminal page.
  const src = readFileSync('src/services/googleSignIn.ts', 'utf8')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n')
  assert.match(src, /canReturnToScheme = await ensureShellReturnListener\(/)
  assert.match(
    src,
    /canReturnToScheme \? 'shell-scheme' : 'shell'/,
    'the shell-scheme claim must be gated on the measured capability, never on isNativeShell alone',
  )
  // And the listener must be registered BEFORE /oauth/start is told anything.
  assert.ok(
    src.indexOf('ensureShellReturnListener') < src.indexOf("apiUrl(START_PATH)"),
    'the capability is answered after the flow is registered — the server would be told the wrong thing',
  )
})
