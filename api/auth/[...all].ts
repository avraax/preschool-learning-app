// The whole better-auth surface, mounted as ONE function (one cold start, one DB pool).
//
// A Web-standard `fetch` export, not the usual `(req, res)` default export: @vercel/node detects it
// and routes through `createWebHandler`, which builds the `Request` with `Readable.toWeb(req)` — the
// raw, unconsumed stream. That is why the classic "body already parsed" problem does not exist here
// (accounts PRD §4.3).
//
// Deliberately NOT wired through applyCors / isAllowedOrigin / rateLimit from lib/server-utils.ts:
// those are `VercelRequest`-shaped, and better-auth already owns origin validation
// (`trustedOrigins`) plus DB-backed rate limiting for these paths.
//
// CORS is therefore its own Response-shaped layer (lib/web-cors.ts), because that exemption is exactly
// what left this surface answering OPTIONS with a bare 404 and no headers after Phase B — dead inside
// the native shell, perfect on the web. See App Store PRD §4.0.1; the reasoning is in web-cors.ts.
//
// NOTE on vercel.json: the `functions` keys are GLOBS, so a `api/auth/[...all].ts` key would parse
// `[...all]` as a character class matching one of `.al` and silently match nothing — maxDuration
// would never apply and a cold DB connect would die at the default timeout. The key is
// `"api/auth/**"`.

import { auth } from '../../lib/auth.js'
import { preflightResponse, withCors } from '../../lib/web-cors.js'

export const fetch = async (request: Request): Promise<Response> => {
  // Short-circuit the preflight: better-auth's router has no OPTIONS route and 404s it.
  const preflight = preflightResponse(request)
  if (preflight) return preflight

  try {
    return withCors(request, await auth.handler(request))
  } catch (e) {
    // Required: the runtime's own catch is a bare UNLOGGED 500, so an auth failure would be
    // invisible in the function logs.
    console.error('[auth] handler error', e)
    // Also CORS'd: without the headers the shell sees an opaque network failure instead of a 500,
    // which is the difference between a diagnosable bug report and "sign-in just does nothing".
    return withCors(
      request,
      new Response(JSON.stringify({ error: 'Auth error' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    )
  }
}

export const config = { runtime: 'nodejs', maxDuration: 15 }
