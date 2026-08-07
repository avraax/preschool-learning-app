// The auth surface's CORS layer (App Store PRD §4.0.1).
//
// This is the failure class where a green suite is worth the least: the defect it guards was invisible
// to every local check and to the whole web deployment, and only ever showed as "sign-in does nothing"
// inside a reviewed binary. So it asserts BEHAVIOUR — real `Request`/`Response` objects through the
// real functions — and reads source only for the two things that are pure ordering.

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { SHELL_ORIGINS, trustedOrigins } from './env.ts'
import { corsHeadersFor, isAllowedFetchOrigin, preflightResponse, withCors } from './web-cors.ts'

const ROOT = path.join(import.meta.dirname, '..')

/**
 * Comments stripped: the "why" prose below each fix names every identifier the greps look for.
 *
 * Line comments go FIRST, and block comments are only recognised at the start of a line — because the
 * usual `/\/\*[\s\S]*?\*\//` swallowed this file whole. `app.all('/api/auth/*splat', …)` contains a
 * literal `/*`, so a naive strip deleted everything from the auth mount to the next block-comment END
 * three hundred lines later, and the guard failed claiming dev-server had no CORS layer at all — a false
 * RED,
 * which is the same defect as a false green in a guard nobody can reproduce by hand.
 */
const codeOf = (rel: string): string =>
  readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, ' ')

const SHELL = 'capacitor://localhost'

const preflight = (origin: string | null): Response => {
  const headers: Record<string, string> = {
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'authorization,content-type',
  }
  if (origin) headers.origin = origin
  const res = preflightResponse(new Request('https://boernelaering.dk/api/auth/family/status', {
    method: 'OPTIONS',
    headers,
  }))
  assert.ok(res, 'preflightResponse returned null for an OPTIONS request')
  return res
}

beforeEach(() => {
  for (const k of ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
    delete process.env[k]
  }
  process.env.BETTER_AUTH_URL = 'https://boernelaering.dk'
})

// ---- the defect itself ---------------------------------------------------------------------------

test('OPTIONS from the shell is answered here, with the shell origin allowed', () => {
  // Measured against the deployed 3ffee23 BEFORE this existed: 404, no headers at all. Inside
  // `capacitor://localhost` every auth call carries `Authorization`, so every one of them preflights,
  // and a 404 preflight is a hard block — sign-in, profiles, PIN and sync all dead at once.
  const res = preflight(SHELL)
  assert.equal(res.status, 204, 'the preflight is not a success status')
  assert.equal(res.headers.get('access-control-allow-origin'), SHELL)
  assert.match(res.headers.get('access-control-allow-headers') ?? '', /Authorization/i)
  assert.equal(res.headers.get('vary'), 'Origin')
})

test('every verb the auth surface serves is advertised', () => {
  // A verb missing here is a request the browser refuses to SEND — it fails before reaching any of our
  // code, so there is nothing in the function log to find it by.
  const allowed = (preflight(SHELL).headers.get('access-control-allow-methods') ?? '').toUpperCase()
  for (const verb of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.ok(allowed.includes(verb), `${verb} is not advertised to the preflight`)
  }
})

test('a REAL response carries the headers too, not just the preflight', () => {
  // The other half of the measured defect, and the one §4.0.1 did not name: `GET /api/auth/ok` answered
  // 200 with no `Access-Control-Allow-Origin`, so it was blocked even though nothing 404'd. Passing the
  // preflight and then dropping the header on the answer is still a dead surface.
  const req = new Request('https://boernelaering.dk/api/auth/ok', { headers: { origin: SHELL } })
  const out = withCors(req, new Response('{"ok":true}', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))
  assert.equal(out.headers.get('access-control-allow-origin'), SHELL)
  assert.equal(out.headers.get('content-type'), 'application/json', 'the original headers were dropped')
  assert.equal(out.status, 200)
})

test('withCors survives an IMMUTABLE header guard — the OAuth callback answers with a 302', () => {
  // `Response.redirect()` returns immutable headers, so a `.headers.set()` implementation throws (or
  // silently no-ops) on exactly the response the Google return depends on. Rebuilding is why it does
  // not. `.claude/rules/auth.md`: that callback MUST stay a redirect, so this path is permanent.
  const req = new Request('https://boernelaering.dk/api/auth/family/oauth/callback', {
    headers: { origin: SHELL },
  })
  const out = withCors(req, Response.redirect('https://boernelaering.dk/#bl_auth=1', 302))
  assert.equal(out.status, 302)
  assert.equal(out.headers.get('location'), 'https://boernelaering.dk/#bl_auth=1')
  assert.equal(out.headers.get('access-control-allow-origin'), SHELL)
})

test('the session header is EXPOSED, or a cross-origin 200 reads back as null', () => {
  // The bearer plugin returns the session in `set-auth-token`. A cross-origin response hides every
  // header not named in Expose-Headers, so without this the shell gets a successful sign-in it cannot
  // read — the silent-dead-end shape, with a 200 in the logs.
  assert.match(preflight(SHELL).headers.get('access-control-expose-headers') ?? '', /set-auth-token/)
})

// ---- what must NOT be allowed --------------------------------------------------------------------

test('an untrusted origin gets no Allow-Origin, and `null` is never granted', () => {
  // A blanket `*` is impossible here anyway (§4.0.1, and api-endpoints.md killed it for all of /api),
  // but the subtler one is echoing the literal string `null`: a sandboxed iframe and a `data:` document
  // both present that as their origin, so it is a real grant, not a placeholder.
  for (const bad of ['https://evil.example', 'capacitor://evil', 'null', 'http://boernelaering.dk']) {
    const res = preflight(bad)
    assert.equal(res.headers.get('access-control-allow-origin'), null, `${bad} was granted CORS`)
  }
  const res = preflight(null)
  assert.equal(res.headers.get('access-control-allow-origin'), null, 'a missing Origin was granted CORS')
})

test('a non-OPTIONS request falls through — this layer must not swallow real traffic', () => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    const req = new Request('https://boernelaering.dk/api/auth/ok', { method })
    assert.equal(preflightResponse(req), null, `${method} was short-circuited before auth.handler`)
  }
})

// ---- the no-drift constraint ---------------------------------------------------------------------

test('the allow-list IS trustedOrigins(), not a second copy of the shell origin', () => {
  // §4.0.1's third constraint. If this layer echoed an origin `trustedOrigins()` did not carry, the
  // preflight would pass and better-auth would then refuse the request on its own origin validation —
  // a worse failure than the 404, because it looks like a credential problem.
  for (const o of trustedOrigins()) {
    assert.ok(isAllowedFetchOrigin(o), `${o} is trusted by better-auth but refused by CORS`)
  }
  for (const o of SHELL_ORIGINS) {
    assert.ok(isAllowedFetchOrigin(o), `${o} is a shell origin and must be allowed`)
  }
  // …and it tracks trustedOrigins() rather than hardcoding: production drops the localhost entries.
  process.env.VERCEL = '1'
  process.env.VERCEL_ENV = 'production'
  assert.equal(isAllowedFetchOrigin('http://localhost:5173'), false, 'dev origins leak into production')
  assert.ok(isAllowedFetchOrigin(SHELL), 'the shell origin was lost in production')
  assert.ok(isAllowedFetchOrigin('https://boernelaering.dk'), 'the web origin was lost in production')
})

test('origins compare normalised — a trailing slash or capital is the same origin', () => {
  assert.ok(isAllowedFetchOrigin('CAPACITOR://LOCALHOST'))
  assert.ok(isAllowedFetchOrigin('https://boernelaering.dk/'))
})

// ---- ordering, which only source can show --------------------------------------------------------

test('the function answers OPTIONS BEFORE auth.handler', () => {
  // The ordering is the fix. A CORS layer that runs after the handler still returns better-auth's 404,
  // with headers on it — which is a preflight the browser rejects just the same.
  const code = codeOf('api/auth/[...all].ts')
  const preflightAt = code.indexOf('preflightResponse(request)')
  const handlerAt = code.indexOf('auth.handler(request)')
  assert.ok(preflightAt > 0, 'the auth function never short-circuits the preflight')
  assert.ok(handlerAt > 0, 'the auth function no longer calls auth.handler')
  assert.ok(preflightAt < handlerAt, 'the preflight is answered after better-auth has already 404ed it')
  // Computing it and dropping it is the same 404. Found by re-break: without this line, deleting the
  // early return left the ordering assertion above perfectly green with the fix gone.
  assert.match(code, /if \(preflight\) return preflight/, 'the preflight is computed but never returned')
  assert.match(code, /withCors\(request, await auth\.handler\(request\)\)/, 'real responses lost CORS')
  // The server graph ships as compiled siblings, so the specifier must be `.js` (api-endpoints.md).
  assert.match(code, /from '\.\.\/\.\.\/lib\/web-cors\.js'/, 'the import will not resolve in production')
})

test('dev-server mirrors it, and mounts it ABOVE the auth handler', () => {
  // The general `/api` CORS middleware sits BELOW the auth mount and therefore never runs for these
  // paths — which is how dev had the identical hole. An unmirrored fix is a 404 only in dev, the shape
  // api-endpoints.md records as how profile creation once failed silently.
  const code = codeOf('dev-server.js')
  const corsAt = code.indexOf("app.use('/api/auth'")
  const mountAt = code.indexOf("app.all('/api/auth/*splat'")
  assert.ok(corsAt > 0, 'dev-server has no CORS layer for the auth surface')
  assert.ok(mountAt > 0, 'the dev-server auth mount moved — re-check this guard')
  assert.ok(corsAt < mountAt, 'dev-server mounts CORS after the auth handler, so it never runs')
  assert.match(code, /corsHeadersFor/, 'dev-server rolled its own headers instead of sharing the source')
  // Same vacuity as the function's guard: setting the headers and then falling through to better-auth
  // still 404s the preflight, and the mount-ordering assertion above cannot see that.
  assert.match(code, /res\.status\(204\)\.end\(\)/, 'dev-server never answers the preflight itself')
  // It spreads `corsHeadersFor` onto the Express response, so the two mirrors cannot say different
  // things — that shared function is what makes reading source here sufficient.
  const shared = corsHeadersFor(SHELL)
  assert.equal(shared['Access-Control-Allow-Origin'], SHELL)
  assert.equal(shared['Access-Control-Allow-Headers'], 'Content-Type, Authorization')
})
