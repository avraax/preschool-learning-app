// The one better-auth instance. Lives in lib/ (not in api/) so the Vercel function AND dev-server.js
// import the *same* object — otherwise dev and prod drift, which is the failure mode
// `.claude/rules/api-endpoints.md` warns about for every other endpoint.
//
// Explicit `.ts` extensions on relative imports: this module is loaded by Node's type-stripping from
// dev-server.js, and extensionless specifiers don't resolve there (accounts PRD §4.3 trap 4).

import { betterAuth } from 'better-auth'
import { bearer } from 'better-auth/plugins/bearer'
import { passkey } from '@better-auth/passkey'
import { APIError } from 'better-auth/api'
import { getPool } from './db.ts'
import { familyPlugin } from './auth-family-plugin.ts'
import { baseURL, isEmailAllowed, requireEnv, runtime, trustedOrigins, webauthn } from './env.ts'

// `vercel.app` is on the Public Suffix List and a preview origin is not a registrable-domain suffix
// of the production RP ID, so passkeys CANNOT work on a preview deployment (PRD §9). We leave the
// plugin out entirely there rather than shipping a Face ID button that always fails; the client
// learns this from /family/status's `webauthnEnabled`.
const wa = webauthn()

export const auth = betterAuth({
  appName: 'Børnelæring',
  baseURL: baseURL(),
  basePath: '/api/auth',
  secret: requireEnv('BETTER_AUTH_SECRET'),
  database: getPool(),
  trustedOrigins: trustedOrigins(),
  telemetry: { enabled: false },

  // No passwords, by decision (D2/D3): Google OIDC + passkey only.
  emailAndPassword: { enabled: false },

  // Present ONLY so `signInSocial({ idToken })` can verify a token we obtained through our own
  // PKCE leg. We never call /sign-in/social from the browser — see lib/auth-family-plugin.ts and
  // PRD §4.5 (better-auth's own social redirect sets a state cookie *before* a session exists,
  // which is exactly the cookie an installed-PWA OAuth hop loses).
  socialProviders: {
    google: {
      clientId: requireEnv('GOOGLE_CLIENT_ID'),
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    },
  },

  session: {
    // A family tablet must not log itself out. Revocation is bounded by the 15-minute access JWT
    // that guards the paid endpoints instead of by a short session (PRD §4.2b).
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24 * 7,
    cookieCache: { enabled: false },
  },

  rateLimit: {
    // THE answer to "lib/server-utils.ts rateLimit() is a per-instance in-memory Map that resets on
    // every cold start" (PRD §8.2): database-backed, therefore shared across instances.
    enabled: true,
    storage: 'database',
    modelName: 'rateLimit',
    window: 600,
    max: 60,
    customRules: {
      '/family/oauth/start': { window: 600, max: 10 },
      // Deliberately generous: the recovery path polls every 3s for up to 3 minutes (PRD §4.5).
      '/family/oauth/claim': { window: 600, max: 240 },
      // The IP layer only. `pin_attempt` in Postgres is the authoritative lockout.
      '/family/pin/verify': { window: 60, max: 10 },
      '/family/access-token': { window: 600, max: 60 },
    },
  },

  advanced: {
    // Safari refuses to store `Secure` cookies over http://localhost, which would break the passkey
    // challenge cookie in dev.
    useSecureCookies: runtime() !== 'dev',
    defaultCookieAttributes: { sameSite: 'lax' },
  },

  databaseHooks: {
    user: {
      create: {
        // MANDATORY (PRD §4.8). One hook covers every sign-in method, now and in future; without it
        // a stranger can complete Google sign-in on the public URL and legitimately spend our Azure
        // and Google credit. Fails closed when AUTH_ALLOWED_EMAILS is unset (see isEmailAllowed).
        before: async (user) => {
          if (!isEmailAllowed(user.email)) {
            console.warn('[auth] refused sign-up for a non-allowlisted address')
            throw new APIError('FORBIDDEN', { message: 'Denne konto har ikke adgang.' })
          }
          return { data: user }
        },
      },
    },
  },

  plugins: [
    // Session transport is a bearer token in localStorage, not a cookie (PRD §4.4): an installed iOS
    // PWA has its own storage jar and out-of-scope OAuth navigation runs in an in-app browser view,
    // so a Set-Cookie during that hop can land in a context the app can never read.
    bearer(),
    // Our own surface: /family/access-token, /family/status, the PIN routes and (from W7) the
    // cookie-free Google PKCE leg. Also declares our five tables so they migrate together.
    familyPlugin(),
    ...(wa.enabled
      ? [
          passkey({
            rpID: wa.rpID,
            rpName: wa.rpName,
            // An ARRAY on purpose, so adding a custom domain later is config, not code.
            origin: wa.origins,
            authenticatorSelection: {
              // What makes username-less unlock possible at all — the credential is discoverable,
              // so the lock screen needs no account hint.
              residentKey: 'required',
              requireResidentKey: true,
              // Face ID / Touch ID. NOT device lock-in: iCloud Keychain still syncs a platform
              // passkey across the family's Apple devices.
              authenticatorAttachment: 'platform',
              // Safe *because* attachment is platform — Apple always performs user verification.
              // It would be the wrong choice with security keys allowed.
              userVerification: 'required',
            },
          }),
        ]
      : []),
  ],
})

export type Auth = typeof auth
