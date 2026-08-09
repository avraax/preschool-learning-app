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
import { getPool } from './db.js'
import { familyPlugin } from './auth-family-plugin.js'
import {
  apple,
  baseURL,
  fakeProviderEnabled,
  isEmailAllowed,
  optionalEnv,
  requireEnv,
  runtime,
  trustedOrigins,
  webauthn,
} from './env.js'
import { appleClientSecret, appleUsable } from './apple-client-secret.js'
import { FAKE_PROVIDER_SLOT, fakeSocialProvider } from './fake-oidc.js'
import { ALLOWLIST_REFUSED_MESSAGE } from './oauth-signin-outcome.js'

// `vercel.app` is on the Public Suffix List and a preview origin is not a registrable-domain suffix
// of the production RP ID, so passkeys CANNOT work on a preview deployment (PRD §9). We leave the
// plugin out entirely there rather than shipping a Face ID button that always fails; the client
// learns this from /family/status's `webauthnEnabled`.
const wa = webauthn()

/**
 * Sign in with Apple's provider config, or `null` if it cannot be built.
 *
 * BUILT INSIDE A TRY/CATCH ON PURPOSE. `appleClientSecret()` calls `createPrivateKey`, which throws on
 * a malformed `.p8` — and this runs at MODULE INIT, so an unthrown error here would take down every
 * auth route in the app (sign-in, PIN, profiles, progress sync), not just Apple. A key pasted with a
 * missing header line is a plausible one-time mistake; a total auth outage is not a proportionate
 * consequence. Failing to `null` degrades to exactly the state we shipped yesterday: Google only.
 *
 * It is logged loudly, because the symptom otherwise is a button that silently never appears.
 */
const appleProvider = (() => {
  const cfg = apple()
  if (!appleUsable()) return null
  try {
    return {
      clientId: cfg.clientId,
      // better-auth needs this only to VERIFY an id_token we already hold; our own token exchange
      // mints its own short-lived JWT in `apple-client-secret.ts`.
      clientSecret: appleClientSecret(),
      // EXPLICIT `audience`, AND NEVER `appBundleIdentifier` — that spread is what killed Apple
      // sign-in on staging (sign-in reliability PRD RC1). better-auth resolves the expected `aud` as
      //   options.audience?.length ? options.audience : options.appBundleIdentifier ? options.appBundleIdentifier : options.clientId
      // (`@better-auth/core/dist/social-providers/apple.mjs`, verifyIdToken), so the bundle id
      // REPLACES the Services ID rather than joining it. Our `response_mode=form_post` web token
      // carries `aud` = the Services ID, so `jwtVerify` threw, `verifyIdToken` returned false, and
      // `signInSocial` raised UNAUTHORIZED/INVALID_TOKEN — with APPLE_BUNDLE_ID *set*, which it is on
      // staging. The old comment ("harmless when unset") was true as written and missed that it is
      // harmful when set.
      //
      // An ARRAY accepts both: the Services ID for the web sheet we ship today, and a bundle id for a
      // future native one. `audience` wins the precedence chain outright, which is the whole point —
      // do not go back to relying on `appBundleIdentifier` being absent. Guarded by
      // `lib/appleAudience.test.ts`, which also re-reads that expression out of node_modules so a
      // better-auth bump that changes it fails here rather than on the owner's iPad.
      audience: [cfg.clientId, optionalEnv('APPLE_BUNDLE_ID')].filter(
        (a): a is string => !!a,
      ),
    }
  } catch (e) {
    console.error('[auth] APPLE_* is set but the client secret could not be signed — Apple disabled', e)
    return null
  }
})()

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
  //
  // Apple is registered CONDITIONALLY. Its config is what better-auth verifies the ID token's `aud`
  // against, so a stub entry with empty strings would reject every real Apple token — and the four
  // APPLE_* vars genuinely may not exist yet (the owner has to create a Services ID and a .p8 key in
  // the Apple developer portal first). Absent config ⇒ no provider ⇒ `/family/status` omits `apple`
  // ⇒ no button. One switch, all the way down.
  socialProviders: {
    google: {
      clientId: requireEnv('GOOGLE_CLIENT_ID'),
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    },
    ...(appleProvider ? { apple: appleProvider } : {}),
    // THE FAKE PROVIDER (sign-in reliability PRD W7), and it can only appear off production — the gate
    // is three independent conditions in `lib/env.ts`, each failing closed, pinned by `fakeOidc.test.ts`.
    // It rides the `microsoft` slot because `signInSocial` resolves its provider from better-auth's own
    // registry and drops an invented key, and only its `verifyIdToken`/`getUserInfo` are ours — so the
    // allowlist hook, the session creation and the `set-auth-token` shape all stay under test.
    ...(fakeProviderEnabled() ? { [FAKE_PROVIDER_SLOT]: fakeSocialProvider() } : {}),
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
            // THE MESSAGE IS A CONTRACT, not copy — see ALLOWLIST_REFUSED_MESSAGE. better-auth discards
            // the FORBIDDEN status and the code on the OAuth path (it re-throws as 401
            // `OAUTH_LINK_ERROR`), so this string is the only thing the callback can recognise the
            // refusal by. It is internal; the adult reads `forbiddenMessage(domain)` instead.
            throw new APIError('FORBIDDEN', { message: ALLOWLIST_REFUSED_MESSAGE })
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
