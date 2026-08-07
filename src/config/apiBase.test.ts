// The shell talks to the API across the network (App Store PRD §3.1).
//
// This is the guard for the worst failure mode Phase B had: a relative `/api/...` call inside the
// shell resolves against `capacitor://localhost`, i.e. the app BUNDLE, and Capacitor's local server
// answers it with the SPA's index.html. No 404, no exception, no console error — sign-in, progress
// sync, "Sig et Ord" and bug reports simply never reach a server, while every game keeps working
// because the games are offline by design. The build looks completely healthy and is not.
//
// It cannot be caught by a type, a lint rule, a browser harness or a local build, because on the web
// the same code is correct. So it is caught by sweeping the source.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { apiUrl, SHELL_API_ORIGIN } from './apiBase.ts'
import { runtimeTargetFor } from './runtimeTarget.ts'

const SRC = path.join(import.meta.dirname, '..')
const ROOT = path.join(SRC, '..')

/** Every .ts/.tsx under src/, minus tests — comments stripped, because they discuss `/api` paths. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out)
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

// NO BARE BLOCK-COMMENT STRIPPING, deliberately — it is not safe on this codebase.
//
// `dev-server.js` contains `app.all('/api/auth/*splat', …)`: a STRING LITERAL holding a slash-star. A
// naive block-comment strip reads that as a comment opener and swallows 12 KB, up to the next real
// terminator — which deleted the very lines this file asserts about and reported them as missing from
// source that plainly contains them. That fails OPEN, because these assertions test for PRESENCE, so
// it reads as a product bug rather than a test bug. (`lib/env.ts` has the same shape with `'//'`
// inside URLs, which is what the `[^:]` guard below is for.)
//
// Line comments plus JSX `{/* … */}` blocks are enough: with only those stripped the sweep below
// finds ZERO offenders across 266 files, i.e. no JSDoc in this repo mentions a `fetch('/api…')` call
// in prose. If one is ever added, this test will point straight at it.
const stripComments = (s: string): string =>
  s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')

test('apiUrl is identity on the web and absolute in the shell', () => {
  // Node has no window.location, so this asserts the WEB half directly: unchanged, same-origin, no
  // preflight, no CORS surface. That "no-op on the web" property is what makes it safe to apply at
  // ~30 call sites at once.
  assert.equal(apiUrl('/api/progress'), '/api/progress')
  assert.equal(apiUrl('/api/auth/get-session'), '/api/auth/get-session')
  // An already-absolute URL must not be prefixed twice.
  assert.equal(apiUrl('https://example.test/api/x'), 'https://example.test/api/x')
  assert.equal(runtimeTargetFor('capacitor:'), 'shell')
  assert.ok(!SHELL_API_ORIGIN.endsWith('/'), 'a trailing slash would produce //api/...')
  assert.ok(SHELL_API_ORIGIN.startsWith('https://'), 'the shell must not call the API over plaintext')
})

test('apiUrl ACTUALLY REWRITES when the page is the shell', () => {
  // THE ONE THAT MATTERS, and the first version of this file did not have it: every other assertion
  // here passed with `apiUrl` gutted to `return path`, because Node has no window and so only the
  // web branch was ever executed. Found by re-breaking. So stand up a window with the shell's
  // protocol — `runtimeTarget()` reads exactly `window.location.protocol` — and restore it after.
  //
  // Assignment, not `Object.defineProperty`: Node ships no global `window` (unlike `navigator`, which
  // it has had since 21), so there is no existing descriptor to preserve.
  const had = 'window' in globalThis
  const previous = (globalThis as { window?: unknown }).window
  try {
    ;(globalThis as { window?: unknown }).window = { location: { protocol: 'capacitor:' } }
    assert.equal(apiUrl('/api/progress'), 'https://boernelaering.dk/api/progress')
    assert.equal(
      apiUrl('/api/auth/family/oauth/claim'),
      `${SHELL_API_ORIGIN}/api/auth/family/oauth/claim`,
    )
    // Exactly one origin, and no doubled slash where they join.
    assert.ok(!apiUrl('/api/x').includes('//api'), 'the join produced a doubled slash')
    assert.equal(apiUrl('/api/x').match(/https:\/\//g)?.length, 1, 'the origin was applied twice')
    // An absolute URL still passes through untouched, even in the shell.
    assert.equal(apiUrl('https://example.test/api/x'), 'https://example.test/api/x')
  } finally {
    if (had) (globalThis as { window?: unknown }).window = previous
    else delete (globalThis as { window?: unknown }).window
  }

  // …and the world is back as it was, or every later test in this process inherits a fake browser.
  assert.equal(apiUrl('/api/progress'), '/api/progress')
})

test('NO source file calls a relative /api path directly', () => {
  // THE load-bearing test. `apiUrl()` only helps if every call site goes through it, and the next one
  // will be written months from now by someone who has never heard of `capacitor://localhost`.
  const offenders: string[] = []
  for (const file of sourceFiles(SRC)) {
    if (file.endsWith(path.join('config', 'apiBase.ts'))) continue // the helper itself
    const code = stripComments(readFileSync(file, 'utf8'))
    // `fetch('/api…')`, `fetch("/api…")` and `fetch(`/api…`)` — the shapes that skip the helper.
    for (const m of code.matchAll(/fetch\(\s*['"`]\/api[^'"`]*['"`]/g)) {
      offenders.push(`${path.relative(ROOT, file)}: ${m[0]}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these call the API relatively and would hit the app bundle in the shell:\n${offenders.join('\n')}`,
  )
})

test('the paid-endpoint wrapper resolves the URL once, and uses it for the retry too', () => {
  // `authorizedFetch` covers ttsClient, useSpeechInput, VoiceLab and AuditHarness in one place. Its
  // 401 path fires a SECOND fetch; resolving per-call instead of once would leave that retry relative
  // — so the first request would work in the shell and only the token-expiry retry would fail, which
  // is a bug that shows up an hour into a play-test and nowhere else.
  const code = stripComments(readFileSync(path.join(SRC, 'services', 'authorizedFetch.ts'), 'utf8'))
  assert.match(code, /const url = apiUrl\(input\)/, 'authorizedFetch does not resolve its input')
  assert.ok(!/fetch\(input,/.test(code), 'a fetch still uses the raw input instead of the resolved url')
  assert.equal((code.match(/fetch\(url,/g) ?? []).length, 2, 'both the first attempt and the retry must use it')
})

test('the SERVER trusts the shell origin — the other half of the same bug', () => {
  // Making the client's URLs absolute is not enough: better-auth validates the request Origin, and
  // `capacitor://localhost` is not the deployment. Without this the app reaches the server and is
  // refused, which is the same user-visible failure with a different cause. These are origins, not
  // hosts — no page on the public internet can present them.
  // Matched on RAW source with statement-shaped patterns rather than stripped text — see the note on
  // `stripComments`. `export const SHELL_ORIGINS = [` cannot occur in prose by accident.
  const env = readFileSync(path.join(ROOT, 'lib', 'env.ts'), 'utf8')
  assert.match(env, /export const SHELL_ORIGINS = \[/, 'lib/env.ts does not declare the shell origins')
  assert.match(env, /'capacitor:\/\/localhost'/)
  assert.match(env, /const list = \[baseURL\(\), \.\.\.SHELL_ORIGINS\]/, 'trustedOrigins omits them')

  // …and the light origin guard on the paid endpoints must allow the scheme ON PURPOSE. It passed
  // before only because `new URL('capacitor://localhost').hostname` happens to be `localhost`.
  const utils = readFileSync(path.join(ROOT, 'lib', 'server-utils.ts'), 'utf8')
  assert.match(utils, /const SHELL_SCHEMES = \[/, 'server-utils has no explicit shell-scheme allowance')
  assert.match(utils, /'capacitor:'/)
  const schemeAt = utils.indexOf('if (SHELL_SCHEMES.includes(url.protocol)) return true')
  const hostAt = utils.indexOf("if (host === 'localhost'")
  assert.ok(schemeAt > 0, 'the shell scheme is never checked')
  assert.ok(schemeAt < hostAt, 'the scheme check is not reached before the host check')
})

test('CORS advertises every method the endpoints actually serve', () => {
  // The shell preflights EVERY call, because they all carry Authorization — which makes even a GET
  // non-simple. `profiles` serves GET/POST/PATCH/DELETE and `progress` GET/PUT, so an
  // Allow-Methods of "POST, OPTIONS" means the browser refuses to send them and no server code runs.
  for (const [label, file] of [
    ['lib/server-utils.ts', path.join(ROOT, 'lib', 'server-utils.ts')],
    ['dev-server.js', path.join(ROOT, 'dev-server.js')],
  ] as const) {
    // Raw source, matched as a real `setHeader` call — see the note on `stripComments`.
    const code = readFileSync(file, 'utf8')
    const m = code.match(/setHeader\(\s*'Access-Control-Allow-Methods',\s*'([^']+)'/)
    assert.ok(m, `${label}: no Access-Control-Allow-Methods`)
    for (const verb of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      assert.ok(m[1].includes(verb), `${label}: Allow-Methods omits ${verb}`)
    }
  }
})

test('dev-server mirrors the shell allowance, as the trust boundary requires', () => {
  // `.claude/rules/api-endpoints.md`: the api/* guards are mirrored in dev-server.js. A mirror that
  // drifts is how a guard gets "verified" locally against code production does not run.
  const dev = readFileSync(path.join(ROOT, 'dev-server.js'), 'utf8')
  assert.match(
    dev,
    /url\.protocol === 'capacitor:'/,
    'dev-server does not allow the shell origin',
  )
})
