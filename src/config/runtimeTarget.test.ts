// The offline-readiness audit, as a test (App Store PRD §3.10 / A4).
//
// Four things in this app assume a network-served SPA, and a bundled native shell changes what each one
// means. Nothing here fails loudly if it regresses — a reload loop inside a shell, or a permanent false
// "en ny version er klar" pill, both look like ordinary behaviour — so each is pinned.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isNativeShell, runtimeTarget, runtimeTargetFor } from './runtimeTarget.ts'

const ROOT = path.join(import.meta.dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    // Comments FIRST: a guard that greps source is otherwise satisfied by the comment explaining the fix.
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

test('capacitor: and ionic: are the shell; everything else is web', () => {
  assert.equal(runtimeTargetFor('capacitor:'), 'shell')
  assert.equal(runtimeTargetFor('CAPACITOR:'), 'shell')
  assert.equal(runtimeTargetFor('ionic:'), 'shell')
  assert.equal(runtimeTargetFor('https:'), 'web')
  assert.equal(runtimeTargetFor('file:'), 'web')
  assert.equal(runtimeTargetFor(undefined), 'web')
  assert.equal(runtimeTargetFor(''), 'web')
})

test('http://localhost is NOT the shell — that is the dev server', () => {
  // Capacitor's iOS hostname IS `localhost` (kept as the default because it grants the secure context
  // getUserMedia needs), so it is tempting to treat localhost as native. Doing so would disable the
  // update banner and the stale-chunk reload in the one environment where they are developed. Only the
  // SCHEME distinguishes them, and iOS is the only target in scope.
  assert.equal(runtimeTargetFor('http:'), 'web')
})

test('outside a browser the answer is web, not a crash', () => {
  // Build scripts and this suite import modules that call it at module scope.
  assert.equal(runtimeTarget(), 'web')
  assert.equal(isNativeShell(), false)
})

test('lazyWithReload never reloads inside the shell', () => {
  // The recovery's whole premise is that a reload fetches a NEWER index.html from Vercel. In a bundled
  // shell the chunks are in the binary, cannot be stale, and a reload re-fetches the bytes that just
  // failed — so it could only loop or mask a real error. It must rethrow and let AppErrorBoundary show
  // "Ups!", exactly as for any non-chunk failure.
  const code = codeOf('utils/lazyWithReload.ts')
  assert.match(code, /isNativeShell\(\)\)\s*throw err/)
  // …and the guard must come BEFORE the reload branch, or it never runs.
  const guardAt = code.indexOf('isNativeShell()')
  const reloadAt = code.indexOf('doReload()')
  assert.ok(guardAt > 0 && guardAt < reloadAt, 'the shell guard sits after the reload it is meant to skip')
})

test('the update checker returns before the fetch inside the shell', () => {
  // A shell binary's version is set by App Store review, not by a push, so comparing it against the
  // deployed commit is meaningless at best and a PERMANENT false update pill at worst — pointing at an
  // apply-update that reloads the same bundled bytes. Returning before the fetch also stops the shell
  // polling /api/version every 10 minutes for an answer it cannot use.
  const code = codeOf('hooks/useUpdateChecker.ts')
  const guardAt = code.indexOf('isNativeShell()')
  const fetchAt = code.indexOf("fetch('/api/version'")
  assert.ok(guardAt > 0, 'the update checker does not consult the runtime target')
  assert.ok(guardAt < fetchAt, 'the shell guard sits after the version fetch it is meant to skip')
})

test('the legacy service-worker sweep is skipped in the shell', () => {
  // Audited as SAFE (every access is feature-detected or inside the try/catch, and both promises carry a
  // .catch) but POINTLESS: a bundled shell never had a web-era service worker to inherit. Two async
  // storage sweeps at every cold boot on a 2017 iPad is not free.
  const code = codeOf('utils/swCleanup.ts')
  assert.match(code, /if \(isNativeShell\(\)\) return/)
})

test('no service worker is registered, and vite-plugin-pwa is not wired in', () => {
  // The app is deliberately network-only (PRD-08 §P3) and `vite-plugin-pwa` sits in `dependencies`
  // without being registered. A service worker inside a Capacitor webview is a category of bug nobody
  // wants to debug on a remote CI machine, so this pins that the plugin stays unwired — in the config
  // AND in the source graph.
  const config = readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8').replace(/\/\/.*$/gm, '')
  assert.ok(!/VitePWA/.test(config), 'vite-plugin-pwa is registered in vite.config.ts')
  assert.ok(!/vite-plugin-pwa/.test(config), 'vite.config.ts imports vite-plugin-pwa')

  // Nothing may register a SW by hand either. `swCleanup` UNregisters, which is the opposite — so match
  // the register call specifically rather than the word "serviceWorker".
  const sw = codeOf('main.tsx') + codeOf('App.tsx')
  assert.ok(!/serviceWorker\.register/.test(sw), 'something registers a service worker')
  assert.ok(!/virtual:pwa-register/.test(sw), 'something imports the vite-plugin-pwa register shim')
})
