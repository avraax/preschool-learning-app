// CORS for the Web-standard `fetch` surface — i.e. `api/auth/[...all].ts`, and only that.
//
// WHY THIS EXISTS AT ALL (App Store PRD §4.0.1). `lib/server-utils.ts`'s `applyCors` is
// `VercelRequest`/`VercelResponse`-shaped, and the auth function is deliberately NOT wrapped in those
// helpers (`.claude/rules/api-endpoints.md`). So when Phase B widened CORS for the native shell, the
// whole auth surface was simply never reached by the fix: measured against the deployed `3ffee23`,
// `OPTIONS /api/auth/*` answered **404 with no CORS headers** and even a 200 `GET` carried no
// `Access-Control-Allow-Origin`. Inside `capacitor://localhost` every auth call is cross-origin and
// carries `Authorization` (never a CORS-safelisted header), so every one of them is preflighted — and a
// 404 preflight is a hard block. Sign-in, profiles, PIN and sync would have been dead in the shipped
// binary while all 24 games kept working, because the games are offline by design.
//
// THE 404 WAS BETTER-AUTH'S ROUTER, NOT VERCEL'S ROUTING. Established before writing this, because
// fixing the wrong layer looks identical locally: the `vercel.json` rewrite matches OPTIONS fine (the
// 404 came back chunked with an empty body, i.e. from the function, whereas Vercel's own 404 is
// `text/plain` with a `content-length`), and `POST /api/auth/sign-out` reaches the handler (415).
// better-auth's router has no OPTIONS route and 404s it. So the fix belongs here, in front of
// `auth.handler` — not in `vercel.json`.
//
// NO DRIFT BY CONSTRUCTION. The allow-list is `trustedOrigins()` itself rather than a second copy of
// `capacitor://localhost`. better-auth validates Origin against exactly that list, so any origin this
// layer echoed but `trustedOrigins()` did not carry would pass the preflight and then be refused by the
// handler — a worse failure than the one being fixed. One list, two consumers.

import { trustedOrigins } from './env.js'

/** Origins are case-insensitive and carry no path; compare them normalised. */
const norm = (o: string): string => o.trim().replace(/\/+$/, '').toLowerCase()

export function isAllowedFetchOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false
  const want = norm(origin)
  return trustedOrigins().some((t) => norm(t) === want)
}

/**
 * Headers for an allowed caller. A DISALLOWED origin gets no `Access-Control-Allow-Origin` at all —
 * deliberately not `applyCors`'s literal `'null'`, which is a real grant: a sandboxed iframe and a
 * `data:` document both present the origin `null` and would match it.
 *
 * Still no `Access-Control-Allow-Credentials`: this app is bearer-token only and never sends cookies
 * cross-origin (`.claude/rules/auth.md`).
 */
export function corsHeadersFor(origin: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (!isAllowedFetchOrigin(origin)) return headers
  headers['Access-Control-Allow-Origin'] = origin as string
  // Every verb better-auth and the family plugin serve. A verb missing here is a request the browser
  // refuses to SEND, so it never reaches any of our code and there is nothing to see in the logs.
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  // The shell's auth calls carry both. `Authorization` is the whole reason they preflight.
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  // The bearer plugin returns the session in a RESPONSE HEADER, and a cross-origin response hides
  // every header not named here — so a shell build would read `null` from a 200. Only trusted origins
  // ever get this far.
  headers['Access-Control-Expose-Headers'] = 'set-auth-token'
  return headers
}

/**
 * Answer a preflight ourselves, BEFORE `auth.handler` ever sees it. Returns `null` for any other
 * method so the caller can fall through.
 */
export function preflightResponse(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null
  const headers = corsHeadersFor(request.headers.get('origin'))
  headers['Access-Control-Max-Age'] = '600'
  return new Response(null, { status: 204, headers })
}

/**
 * Copy the CORS headers onto a real response. Rebuilt rather than mutated: a `Response` can carry an
 * immutable header guard (redirects do), and the auth surface answers the OAuth callback with a 302.
 */
export function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(corsHeadersFor(request.headers.get('origin')))) {
    headers.set(k, v)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
