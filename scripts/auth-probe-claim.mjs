// Regression probe for the OAuth claim, using the token shape a REAL callback produces.
//
// WHY THIS EXISTS: the W7 test parked a RAW `session.token` on the flow row, but the callback parks
// whatever the bearer plugin puts in `set-auth-token` — which is the session COOKIE value, i.e. the
// SIGNED form `<rawToken>.<hmacSignature>`. `internalAdapter.findSession()` takes the RAW token, so the
// signed value always looked up as null and every real Google sign-in threw GONE and bounced the adult
// back to the lock screen. Seeding the wrong shape is exactly why the test passed while the product
// was broken.
//
//   node --env-file=.env.local scripts/auth-probe-claim.mjs
//
// Local dev only. Exits non-zero if the claim does not hand back a usable session token.

import { serializeSignedCookie } from 'better-call'
import { auth } from '../lib/auth.ts'
import { baseURL, isEmailAllowed, requireEnv, runtime } from '../lib/env.ts'

if (runtime() !== 'dev' || process.env.VERCEL) {
  console.error('[probe] refusing to run outside local dev')
  process.exit(1)
}

const API = process.env.PROBE_API ?? 'http://127.0.0.1:3001'
const email = (process.env.AUTH_ALLOWED_EMAILS ?? '').split(',')[0]?.trim()
if (!isEmailAllowed(email)) {
  console.error('[probe] no allowlisted email configured')
  process.exit(1)
}

const ctx = await auth.$context
let user = await ctx.adapter.findOne({ model: 'user', where: [{ field: 'email', value: email }] })
if (!user) user = await ctx.internalAdapter.createUser({ email, name: 'Probe Adult', emailVerified: true })

// 1. A real session, exactly as the callback's signInSocial() would create.
const session = await ctx.internalAdapter.createSession(user.id, undefined, true)

// 2. The SIGNED value the bearer plugin exposes as `set-auth-token`.
const signed = (await serializeSignedCookie('', session.token, requireEnv('BETTER_AUTH_SECRET'))).replace('=', '')
console.log(`raw token    : ${session.token.slice(0, 12)}… (len ${session.token.length})`)
console.log(`set-auth-token: ${signed.slice(0, 12)}… (len ${signed.length}, signed=${signed.includes('.')})`)
if (!signed.includes('.')) {
  console.error('[probe] expected a signed value — better-auth changed shape; re-check the claim lookup')
  process.exit(1)
}

// 3. Start a flow and park that signed token on it, exactly as the callback does.
const flowId = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
const start = await fetch(`${API}/api/auth/family/oauth/start`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ flowId }),
})
if (!start.ok) {
  console.error('[probe] oauth/start failed', start.status, await start.text())
  process.exit(1)
}
const { createHash } = await import('node:crypto')
await ctx.adapter.update({
  model: 'oauthFlow',
  where: [{ field: 'flowIdHash', value: createHash('sha256').update(flowId, 'utf8').digest('hex') }],
  update: { sessionToken: signed },
})

// 4. Claim it — this is the line that was broken.
const claim = await fetch(`${API}/api/auth/family/oauth/claim`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ flowId }),
})
const body = await claim.json().catch(() => null)
console.log(`claim        : ${claim.status} ${JSON.stringify(body)?.slice(0, 90)}`)
if (!claim.ok || !body?.token) {
  console.error('[probe] FAIL — the claim did not return a token')
  process.exit(1)
}

// 5. And the returned token must actually authenticate (what the client does next).
const check = await fetch(`${API}/api/auth/get-session`, {
  headers: { Authorization: `Bearer ${body.token}` },
})
const who = await check.json().catch(() => null)
console.log(`get-session  : ${check.status} user=${who?.user?.email ?? 'none'}`)
if (!who?.user?.id) {
  console.error('[probe] FAIL — the claimed token does not authenticate')
  process.exit(1)
}
console.log(`\nPASS — claim → bearer works end to end against ${baseURL()}`)
process.exit(0)
