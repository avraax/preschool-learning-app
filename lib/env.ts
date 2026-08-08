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

export type Tier = 'staging' | 'production'

/**
 * WHICH BACKEND IS THIS DEPLOYMENT — production, or staging? (Staging PRD W4.)
 *
 * Orthogonal to `runtime()`, which answers "dev / preview / production *deployment*". Both tiers have
 * a production Vercel environment; what separates them is which database is behind it.
 *
 * DEFAULTS TO PRODUCTION, and an unrecognised value defaults there too. Same argument as the client's
 * `BL_TIER` in `src/config/backendTarget.ts`: a process nobody configured must be the safe one, and
 * "production" is safe here because it is the pairing that the check below will then hold to the
 * strictest origin list.
 */
export function tier(): Tier {
  return process.env.BL_TIER?.trim() === 'staging' ? 'staging' : 'production'
}

/**
 * The origins each tier is allowed to answer on. Two rows, and nothing else is legal.
 *
 * Production keeps `preschool-learning-app.vercel.app` because installed shells cannot follow a domain
 * move (`src/config/apiBase.ts`) — binaries in the field still call it, so it must stay serving.
 * Staging deliberately has no such fallback: staging binaries are disposable (PRD §9.5).
 */
const TIER_ORIGINS: Record<Tier, readonly string[]> = {
  production: ['https://boernelaering.dk', 'https://preschool-learning-app.vercel.app'],
  staging: ['https://staging.boernelaering.dk'],
}

const isLocalOrigin = (url: string): boolean => {
  try {
    const h = new URL(url).hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '::1'
  } catch {
    return false
  }
}

/**
 * Pure, so `env.test.ts` can drive every pairing without re-importing the module.
 *
 * PREVIEW DEPLOYMENTS ARE EXEMPT, deliberately. A preview's `baseURL()` is a per-deployment
 * `*.vercel.app` host that no fixed tuple can name, so the check could only ever produce false
 * failures there — and it would buy nothing anyway, since a preview inherits its own project's
 * `DATABASE_URL` and `BL_TIER` together and therefore cannot cross the tiers. It is also the same
 * environment `webauthn()` already stands down in, for a related reason.
 */
export function tierMatchesBaseURL(
  t: Tier = tier(),
  base: string = baseURL(),
  rt: Runtime = runtime(),
): boolean {
  if (rt === 'preview') return true
  if (t === 'staging') return TIER_ORIGINS.staging.includes(base) || isLocalOrigin(base)
  // Localhost counts as production only in DEV. On a real deployment a localhost `BETTER_AUTH_URL` is
  // a misconfiguration, not a local run, and it must not be waved through.
  return TIER_ORIGINS.production.includes(base) || (rt === 'dev' && isLocalOrigin(base))
}

/**
 * FAIL LOUDLY, AT MODULE INIT, in the same spirit as `isEmailAllowed()` failing closed.
 *
 * The failure this prevents is silent by nature: a deployment whose `BL_TIER` and origin disagree is
 * one where the tier vars were half-applied, and it would serve perfectly well — signing adults in and
 * writing children's progress into whichever database `DATABASE_URL` happens to name. Nothing in the
 * app can notice, because every game works offline by design. A dead deployment is a phone call; a
 * live one writing to the wrong book is a lost Reward Book.
 *
 * Note this is deliberately the OPPOSITE choice from `lib/auth.ts`'s Apple provider, which swallows
 * its init error so a broken Apple key cannot take down every auth route. The difference is blast
 * radius: a misconfigured Apple leaves the rest of the app correct, whereas a misconfigured tier makes
 * every write suspect.
 */
export function assertTierMatchesBaseURL(): void {
  if (tierMatchesBaseURL()) return
  throw new Error(
    `[env] BL_TIER="${tier()}" does not match baseURL "${baseURL()}" (runtime "${runtime()}"). ` +
      `Refusing to serve: a half-applied tier would write to the wrong database. ` +
      `Set BL_TIER and BETTER_AUTH_URL together, then REDEPLOY — env changes never reach a live deployment.`,
  )
}

assertTierMatchesBaseURL()

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

export interface AppleConfig {
  enabled: boolean
  /** The **Services ID** (e.g. `dk.boernelaering.web`), not the app's bundle identifier. */
  clientId: string
  teamId: string
  keyId: string
  /** Contents of the `.p8` file. Newlines survive Vercel env vars; `\n` escapes are also accepted. */
  privateKey: string
}

/**
 * Sign in with Apple — required by App Store Guideline 4.8, which wants a second login option
 * limiting collection to name + email and allowing the address to be kept private, whenever a
 * third-party service (here Google) sets up the primary account. Passkeys do NOT satisfy it: they
 * cannot create an account, and they are unavailable in the shell anyway (the rpID is
 * `boernelaering.dk`, the shell's origin is `capacitor://localhost`). So Google-only was our real
 * state, and it is also a dead end for any adult without a Google account.
 *
 * ALL FOUR VALUES OR NOTHING. A half-configured Apple would render a button that fails at the token
 * exchange — the worst outcome, since the adult would blame their Apple ID. `enabled` therefore gates
 * both the server branch and the button, through `/family/status`'s `methods` list.
 */
export function apple(): AppleConfig {
  const clientId = optionalEnv('APPLE_CLIENT_ID') ?? ''
  const teamId = optionalEnv('APPLE_TEAM_ID') ?? ''
  const keyId = optionalEnv('APPLE_KEY_ID') ?? ''
  // Vercel's env UI keeps real newlines, but a `.env.local` line cannot — so accept both forms rather
  // than shipping a key that parses in dev and fails in production (or the reverse).
  const privateKey = (optionalEnv('APPLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')
  return {
    enabled: !!(clientId && teamId && keyId && privateKey),
    clientId,
    teamId,
    keyId,
    privateKey,
  }
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

/**
 * Origins better-auth will accept requests from (its own CSRF/origin validation).
 *
 * THE NATIVE SHELL IS NOT A BROWSER TAB ON OUR DOMAIN. It runs at `capacitor://localhost` and calls
 * these endpoints CROSS-ORIGIN (App Store PRD §3.1 — the web build is bundled, so it cannot be
 * same-origin with the API by construction). Without the scheme here, better-auth rejects every auth
 * request from the app on origin validation, and the symptom is a sign-in that fails only in the
 * shipped binary — after review, on a device, with the web app perfect.
 *
 * These are ORIGINS, not hosts, so they grant nothing to a browser: no page on the public internet
 * can present `capacitor://localhost` as its origin. `ionic://` is Capacitor's legacy iOS scheme,
 * included because a Capacitor upgrade can flip the default and the failure is silent.
 */
export const SHELL_ORIGINS = ['capacitor://localhost', 'ionic://localhost']

export function trustedOrigins(): string[] {
  const list = [baseURL(), ...SHELL_ORIGINS]
  if (runtime() === 'dev') list.push('http://localhost:5173', 'http://127.0.0.1:5173')
  if (process.env.VERCEL_URL) list.push(`https://${process.env.VERCEL_URL}`)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    list.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }
  return Array.from(new Set(list))
}
