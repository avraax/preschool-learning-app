// Server-side environment resolution — the single place that decides "where am I running?".
//
// Imported by lib/auth.ts, the api/* functions AND dev-server.js (which loads it through Node's
// type-stripping), so this file must stay dependency-free and use explicit `.ts` extensions on any
// relative import it ever grows (accounts PRD §4.3 trap 4).
//
// NOTE: nothing here is a VITE_* variable. The browser learns what it needs from
// /api/auth/family/status, so no environment-specific value is ever baked into the client bundle.

export type Runtime = 'dev' | 'preview' | 'production'

/**
 * `dev` = a local process (no VERCEL), `production` = the production deployment,
 * `preview` = every other Vercel deployment. Used for cookie security, the dev bypass gate and
 * whether passkeys can work at all (a preview origin can't satisfy the prod RP ID — PRD §9).
 */
export function runtime(): Runtime {
  if (!process.env.VERCEL) return 'dev'
  return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview'
}

/**
 * Resolution order (PRD §4.9): explicit BETTER_AUTH_URL → the production alias → this deployment's
 * own URL → localhost:5173.
 *
 * The dev value is deliberately the **Vite** port, not the API port: Google's `redirect_uri` has to
 * be a URL the *browser* can reach, and Vite proxies /api → 127.0.0.1:3001. Pointing it at :3001
 * makes every callback look like it worked while never reaching the app (PRD §9).
 */
export function baseURL(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:5173'
}

/** Throw loudly at module init rather than fail mysteriously on the first request. */
export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`[env] missing required environment variable ${name}`)
  return v
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

/**
 * The closed signup list (PRD §4.8). **Mandatory**: a hard gate without it stops nobody from
 * completing Google sign-in on the public URL and then legitimately burning Azure/Google quota.
 * Enforced in `databaseHooks.user.create.before`, which covers every sign-in method at once.
 */
export function allowedEmails(): string[] {
  return (process.env.AUTH_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const list = allowedEmails()
  // Empty list = misconfiguration. Fail CLOSED: better nobody can sign up than everybody can.
  if (!list.length) return false
  return !!email && list.includes(email.trim().toLowerCase())
}

/**
 * Local-only escape hatch for driving the app headlessly. Triple-gated: the flag, "not Vercel", and
 * runtime() === 'dev'. lib/paid-guard.test.ts asserts it is impossible once VERCEL is set (PRD §4.9).
 */
export function devBypassEnabled(): boolean {
  return process.env.AUTH_DEV_BYPASS === '1' && !process.env.VERCEL && runtime() === 'dev'
}

export interface WebAuthnConfig {
  enabled: boolean
  rpID: string
  rpName: string
  origins: string[]
}

/**
 * `vercel.app` is on the Public Suffix List and a preview origin is not a registrable-domain suffix
 * of the production RP ID, so **passkeys cannot work on preview deployments at all** (PRD §9). We
 * disable them there rather than shipping a Face ID button that always fails.
 *
 * `origins` stays an ARRAY so adding a custom domain later is a config change, not a code change.
 */
/**
 * DEV GOTCHA, verified the hard way: with `WEBAUTHN_RP_ID=localhost` the browser must be on
 * `http://localhost:5173`, NOT `http://127.0.0.1:5173`. WebAuthn requires the RP ID to be a
 * registrable suffix of the page's effective domain, and `127.0.0.1` is not `localhost` — the
 * `navigator.credentials.create()` call fails with a SecurityError that looks exactly like "this
 * device doesn't support Face ID". Drive passkey tests from `localhost`.
 */
export function webauthn(): WebAuthnConfig {
  const rpID = optionalEnv('WEBAUTHN_RP_ID') ?? (runtime() === 'dev' ? 'localhost' : '')
  const rpName = optionalEnv('WEBAUTHN_RP_NAME') ?? 'Børnelæring'
  const base = baseURL()
  const origins = runtime() === 'dev' ? [base, 'http://localhost:5173'] : [base]
  return {
    enabled: runtime() !== 'preview' && !!rpID,
    rpID,
    rpName,
    origins: Array.from(new Set(origins)),
  }
}

/** Origins better-auth will accept requests from (its own CSRF/origin validation). */
export function trustedOrigins(): string[] {
  const list = [baseURL()]
  if (runtime() === 'dev') list.push('http://localhost:5173', 'http://127.0.0.1:5173')
  if (process.env.VERCEL_URL) list.push(`https://${process.env.VERCEL_URL}`)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    list.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }
  return Array.from(new Set(list))
}
