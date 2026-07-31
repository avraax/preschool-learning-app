// Create (or reuse) an allowlisted user + session and print its bearer token.
//
// Google sign-in doesn't exist until W7, and even afterwards it needs a browser — so without this
// there is no way to curl the bearer-guarded surface (/family/access-token, /family/status, the PIN
// routes, /api/progress). Uses better-auth's own internalAdapter, so the row shapes are exactly what
// a real sign-in produces.
//
// LOCAL DEV ONLY: refuses to run against a Vercel deployment, and the email must be on
// AUTH_ALLOWED_EMAILS (the same gate a real sign-up passes).
//
//   node --env-file=.env.local scripts/auth-dev-session.mjs [email]
//
// Prints `TOKEN=<session token>` on the last line so a shell can capture it.

import { serializeSignedCookie } from 'better-call'
import { auth } from '../lib/auth.ts'
import { isEmailAllowed, runtime } from '../lib/env.ts'

if (runtime() !== 'dev' || process.env.VERCEL) {
  console.error('[auth-dev-session] refusing to run outside local dev')
  process.exit(1)
}

const email = (process.argv[2] ?? process.env.AUTH_ALLOWED_EMAILS?.split(',')[0] ?? '').trim()
if (!isEmailAllowed(email)) {
  console.error(`[auth-dev-session] ${email || '(no email)'} is not on AUTH_ALLOWED_EMAILS`)
  process.exit(1)
}

const ctx = await auth.$context
const internal = ctx.internalAdapter

let user = await ctx.adapter.findOne({ model: 'user', where: [{ field: 'email', value: email }] })
if (!user) {
  user = await internal.createUser({
    email,
    name: 'Dev Adult',
    emailVerified: true,
  })
  console.log(`created user ${user.id}`)
} else {
  console.log(`reusing user ${user.id}`)
}

const session = await internal.createSession(user.id, undefined, true)
console.log(`session ${session.id} expires ${new Date(session.expiresAt).toISOString()}`)
// A real sign-in hands the client the SIGNED cookie value (what the bearer plugin exposes as
// `set-auth-token`), not the raw token. Print BOTH — using the raw one in a test is exactly how the
// OAuth claim bug hid behind a green test (see scripts/auth-probe-claim.mjs).
const signed = (
  await serializeSignedCookie('', session.token, process.env.BETTER_AUTH_SECRET)
).replace('=', '')
console.log(`USER_ID=${user.id}`)
console.log(`TOKEN=${session.token}`)
console.log(`SIGNED_TOKEN=${signed}`)
process.exit(0)
