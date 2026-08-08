// WHICH BACKEND — and the one property the App Store depends on (Staging PRD W8).
//
// The badge exists so a build announces the database it writes to. Its safety property is inverted
// from what it looks like: the interesting case is not "staging shows a pill", it is "PRODUCTION SHOWS
// NOTHING". `backendLabel()` returning null for exactly one origin is what keeps a "TEST" pill off the
// binary that goes through review, so every assertion about null here is load-bearing.
//
// The other half is the DEFAULT. `BL_TIER` and `__BL_API_ORIGIN__` are build environment, and an
// absent environment must resolve to production — a build nobody configured is the safe one. Plain
// Node has no Vite `define`, so importing this module in `--test` reads exactly that fallback branch.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  BL_TIER,
  PRODUCTION_API_ORIGIN,
  STAGING_API_ORIGIN,
  backendHost,
  backendLabel,
  effectiveBackend,
} from './backendTarget.ts'
import { SHELL_API_ORIGIN } from './apiBase.ts'

const SRC = path.join(import.meta.dirname, '..')
const ROOT = path.join(SRC, '..')

// Line comments, JSX blocks, and JSDoc — but NOT bare `/* … */` anywhere it appears.
//
// `apiBase.test.ts` explains at length why blanket block-comment stripping is unsafe on this codebase:
// `dev-server.js` holds `app.all('/api/auth/*splat', …)`, a STRING LITERAL containing a slash-star, and
// a naive strip reads it as a comment opener and swallows 12 KB. The anchored `^\s*\/\*\*` form dodges
// that — a JSDoc block only ever starts a line — and it is needed here, because the host is discussed
// in prose in `passkeyClient.ts`'s and `apiBase.ts`'s doc comments and a bare `includes()` would flag
// them as re-declarations. A guard that greps source must strip comments first or it measures prose.
const stripComments = (s: string): string =>
  s
    .replace(/^\s*\/\*\*[\s\S]*?\*\//gm, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')

/** Stand up a fake browser at `origin`, run `fn`, and put the world back exactly as it was. */
function withWindow<T>(location: Record<string, string>, fn: () => T): T {
  const had = 'window' in globalThis
  const previous = (globalThis as { window?: unknown }).window
  try {
    ;(globalThis as { window?: unknown }).window = { location }
    return fn()
  } finally {
    if (had) (globalThis as { window?: unknown }).window = previous
    else delete (globalThis as { window?: unknown }).window
  }
}

test('null means production, and NOTHING ELSE means production', () => {
  // THE App Store property. If this ever returns a string for the production origin, the reviewed
  // binary grows a "TEST" pill; if it returns null for anything else, a staging build looks like the
  // real one and can quietly write to the wrong database with nobody able to tell by looking.
  assert.equal(backendLabel(PRODUCTION_API_ORIGIN), null)
  assert.equal(backendLabel(STAGING_API_ORIGIN), 'staging.boernelaering.dk')
  assert.equal(backendLabel('http://localhost:5173'), 'localhost:5173')
  // The production `.vercel.app` fallback deliberately DOES get a label: it is a different host
  // answering the same data, and saying so is honest rather than a bug (PRD §4.3).
  assert.equal(
    backendLabel('https://preschool-learning-app.vercel.app'),
    'preschool-learning-app.vercel.app',
  )
  // A near-miss must not pass for production — subdomain, scheme and trailing slash all count.
  for (const near of [
    'https://www.boernelaering.dk',
    'http://boernelaering.dk',
    'https://boernelaering.dk/',
    'https://boernelaering.dk.evil.test',
  ]) {
    assert.notEqual(backendLabel(near), null, `${near} was accepted as production`)
  }
})

test('the DEFAULT tier is production — an unconfigured build is the safe one', () => {
  // No Vite `define` exists here, so this is the fallback branch a build with no `BL_TIER` takes.
  assert.equal(BL_TIER, 'production')
  assert.equal(SHELL_API_ORIGIN, PRODUCTION_API_ORIGIN, 'the default backend is not production')
  // …and an unrecognised value must fall back to production too, not be trusted verbatim. Asserted on
  // source because the constant is resolved at import: a `=== 'staging' ? … : 'production'` shape can
  // only ever produce one of the two, whereas a cast would let `BL_TIER=prod` through as a third.
  const src = stripComments(readFileSync(path.join(SRC, 'config', 'backendTarget.ts'), 'utf8'))
  assert.match(src, /RAW_TIER === 'staging' \? 'staging' : 'production'/)
})

test('in the shell the COMPILED CONSTANT is the backend, not the page origin', () => {
  // The page origin inside the shell is `capacitor://localhost` — the app BUNDLE, which is the exact
  // bug `apiUrl()` exists to prevent. A badge reading that would say "localhost" on a binary happily
  // talking to production, and the version chip would be wrong on every TestFlight build.
  withWindow({ protocol: 'capacitor:', origin: 'capacitor://localhost' }, () => {
    assert.equal(effectiveBackend(), SHELL_API_ORIGIN)
    assert.equal(backendLabel(), null, 'a production-compiled shell must show no badge')
  })
  // On the web the page origin IS the backend — the SPA is served same-origin with its functions.
  withWindow({ protocol: 'https:', origin: STAGING_API_ORIGIN }, () => {
    assert.equal(effectiveBackend(), STAGING_API_ORIGIN)
    assert.equal(backendLabel(), 'staging.boernelaering.dk')
  })
  withWindow({ protocol: 'http:', origin: 'http://localhost:5173' }, () => {
    assert.equal(backendLabel(), 'localhost:5173')
  })
  // …and the world is back, or every later test in this process inherits a fake browser.
  assert.equal(effectiveBackend(), PRODUCTION_API_ORIGIN)
})

test('the version chip can answer the question on a build that has no badge', () => {
  // `backendHost` is the production binary's ONLY way to say which backend it uses, since it renders
  // no pill by construction. It must never return null/empty for the case the badge stays silent on.
  assert.equal(backendHost(PRODUCTION_API_ORIGIN), 'boernelaering.dk')
  assert.equal(backendHost(STAGING_API_ORIGIN), 'staging.boernelaering.dk')
  assert.ok(backendHost('not a url').length > 0, 'an unparseable origin must still say something')
})

test('the two origins are distinct, https, and slash-free', () => {
  assert.notEqual(PRODUCTION_API_ORIGIN, STAGING_API_ORIGIN)
  for (const o of [PRODUCTION_API_ORIGIN, STAGING_API_ORIGIN]) {
    assert.ok(o.startsWith('https://'), `${o} is not https`)
    assert.ok(!o.endsWith('/'), `${o} has a trailing slash — the join would produce //api/...`)
  }
})

test('the badge is NOT DEV-gated, and its early return is intact', () => {
  // `import.meta.env.DEV` is false in every `vite build` regardless of mode (`harnessBuild.test.ts`),
  // so gating the badge on DEV would strip it from precisely the builds that need it — the TestFlight
  // ones. This is the "simplification" a future session is most likely to reach for.
  const badge = stripComments(
    readFileSync(path.join(SRC, 'components', 'common', 'BackendBadge.tsx'), 'utf8'),
  )
  assert.ok(!/import\.meta\.env/.test(badge), 'the badge reads import.meta.env — it would vanish in a build')
  assert.ok(!/__HARNESS__/.test(badge), 'the badge is harness-gated — TestFlight builds are not harness builds')
  assert.match(badge, /const label = backendLabel\(\)/)
  assert.match(badge, /if \(!label\) return null/, 'the production early-return is gone')
  // It must not eat a tap meant for the board underneath.
  assert.match(badge, /pointerEvents: 'none'/)

  // Mounted ONCE, UNCONDITIONALLY, and ABOVE THE GATE — anchored to its own line, which is the whole
  // assertion. A bare count of `<BackendBadge />` is satisfied by `{false && <BackendBadge />}` and by
  // any other wrapper, so it passed against exactly the mutation it exists to catch (found by
  // re-breaking). The component decides for itself whether to render; nothing upstream of it may.
  const main = stripComments(readFileSync(path.join(SRC, 'main.tsx'), 'utf8'))
  assert.equal(
    (main.match(/^[ \t]*<BackendBadge \/>[ \t]*$/gm) ?? []).length,
    1,
    'the badge is not mounted exactly once, unconditionally, in main.tsx',
  )
  // ABOVE `<AuthGate>`, not inside it. The gate renders `<LockScreen />` INSTEAD of `<App />`, so a
  // badge below it is invisible on the one screen where an adult is about to hand credentials to a
  // backend — which is when knowing WHICH backend matters most (owner, 2026-08-08).
  assert.ok(
    main.indexOf('<BackendBadge />') < main.indexOf('<AuthGate>'),
    'the badge is mounted inside the auth gate — it would vanish on the lock screen',
  )
  // …and NOT also in App.tsx, or a signed-in adult gets two pills.
  const app = stripComments(readFileSync(path.join(SRC, 'App.tsx'), 'utf8'))
  assert.ok(!/<BackendBadge/.test(app), 'the badge is mounted twice — main.tsx and App.tsx')
})

test('vite defines both constants for EVERY mode, defaulting to production', () => {
  // Same reasoning as `__HARNESS__`: a `define` that only exists in one mode leaves the global
  // undefined elsewhere, so the `typeof` guard survives instead of constant-folding — and the value
  // then becomes settable at runtime, which is the one thing a compiled-in backend must never be.
  const vite = stripComments(readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8'))
  assert.match(
    vite,
    /__BL_API_ORIGIN__: JSON\.stringify\(process\.env\.BL_API_ORIGIN \?\? 'https:\/\/boernelaering\.dk'\)/,
    'the API-origin define is missing or no longer defaults to production',
  )
  assert.match(
    vite,
    /__BL_TIER__: JSON\.stringify\(process\.env\.BL_TIER \?\? 'production'\)/,
    'the tier define is missing or no longer defaults to production',
  )
  // The defines must sit in the UNCONDITIONAL part of the block, not behind the harness spread.
  const defineAt = vite.indexOf('__BL_API_ORIGIN__')
  const harnessSpread = vite.indexOf('...(harness ?')
  assert.ok(defineAt > 0 && defineAt < harnessSpread, 'the backend defines are conditional on a mode')
})

test('the hosts are declared ONCE — no second literal copy anywhere in src/', () => {
  // The whole point of `backendTarget.ts` is that one module answers this. A component or service that
  // re-spells the host drifts silently on a domain move, and the badge's production check is an exact
  // string equality — a stray copy is how that check starts comparing against the wrong constant.
  const allowed = new Set([
    path.join(SRC, 'config', 'backendTarget.ts'), // the declarations themselves
    path.join(SRC, 'config', 'apiBase.ts'), // the `typeof` guard's Node fallback, required by W1
  ])
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !allowed.has(full)) {
        if (/boernelaering\.dk/.test(stripComments(readFileSync(full, 'utf8')))) {
          offenders.push(path.relative(ROOT, full))
        }
      }
    }
  }
  walk(SRC)
  assert.deepEqual(offenders, [], `these re-spell the backend host:\n${offenders.join('\n')}`)
})
