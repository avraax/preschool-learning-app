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
// NOTE on vercel.json: the `functions` keys are GLOBS, so a `api/auth/[...all].ts` key would parse
// `[...all]` as a character class matching one of `.al` and silently match nothing — maxDuration
// would never apply and a cold DB connect would die at the default timeout. The key is
// `"api/auth/**"`.

import { auth } from '../../lib/auth.js'

export const fetch = async (request: Request): Promise<Response> => {
  try {
    return await auth.handler(request)
  } catch (e) {
    // Required: the runtime's own catch is a bare UNLOGGED 500, so an auth failure would be
    // invisible in the function logs.
    console.error('[auth] handler error', e)
    return new Response(JSON.stringify({ error: 'Auth error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export const config = { runtime: 'nodejs', maxDuration: 15 }
