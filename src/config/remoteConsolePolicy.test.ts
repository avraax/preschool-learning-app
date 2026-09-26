import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { remoteConsoleEnabled } from './remoteConsolePolicy.ts'

const web = { dev: false, protocol: 'https:', hostname: 'boernelaering.dk', search: '' }

test('the native shell NEVER forwards its console — its origin is capacitor://localhost', () => {
  // The defect: a hostname-only test read `localhost` and switched it on in every App Store build.
  assert.equal(remoteConsoleEnabled({ dev: false, protocol: 'capacitor:', hostname: 'localhost', search: '' }), false)
  assert.equal(remoteConsoleEnabled({ dev: true, protocol: 'capacitor:', hostname: 'localhost', search: '' }), false)
  assert.equal(remoteConsoleEnabled({ dev: false, protocol: 'ionic:', hostname: 'localhost', search: '' }), false)
  assert.equal(
    remoteConsoleEnabled({ dev: false, protocol: 'capacitor:', hostname: 'localhost', search: '?enable-console=true' }),
    false,
  )
})

test('a production web build is off, including on a local host (vite preview / harness build)', () => {
  assert.equal(remoteConsoleEnabled(web), false)
  assert.equal(remoteConsoleEnabled({ ...web, protocol: 'http:', hostname: '127.0.0.1' }), false)
  assert.equal(remoteConsoleEnabled({ ...web, protocol: 'http:', hostname: 'localhost' }), false)
})

test('the Vite dev server on a local host is on, and the explicit switches still work', () => {
  assert.equal(remoteConsoleEnabled({ dev: true, protocol: 'http:', hostname: 'localhost', search: '' }), true)
  assert.equal(remoteConsoleEnabled({ dev: true, protocol: 'http:', hostname: '127.0.0.1', search: '' }), true)
  assert.equal(remoteConsoleEnabled({ ...web, search: '?enable-console=true' }), true)
  assert.equal(
    remoteConsoleEnabled({ dev: true, protocol: 'http:', hostname: 'localhost', search: '?disable-console=true' }),
    false,
  )
})

// The two loop breakers are wiring, not policy, so they are pinned against the source (comments
// stripped, or a prose mention of the fix would keep this green after the fix itself was removed).
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

test('remoteConsole reports its OWN failures through the un-patched console', () => {
  const src = strip(readFileSync(new URL('../utils/remoteConsole.ts', import.meta.url), 'utf8'))
  assert.ok(src.includes('remoteConsoleEnabled('), 'the constructor must use the policy')
  assert.ok(!/window\.console\??\.error/.test(src), 'a catch handler reading window.console.error re-enters the patch')
})

test('the fetch interceptor passes /api/log-error straight through', () => {
  const src = strip(readFileSync(new URL('../utils/errorCapture.ts', import.meta.url), 'utf8'))
  const body = src.slice(src.indexOf('export function setupNetworkInterceptor'))
  assert.match(body, /if \(isLogEndpoint\(requestInfo\.url\)\) return originalFetch\.apply/)
})
