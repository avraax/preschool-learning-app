// Our own endpoints, as a better-auth PLUGIN rather than as separate Vercel functions.
//
// That choice buys four things at once (accounts PRD §4.3): DB-backed rate limiting shared across
// instances, session resolution for free via `sessionMiddleware`, schema generation for our tables in
// the SAME migration as better-auth's own, and ONE cold start for the whole auth surface.
//
// Explicit `.ts` extensions throughout — dev-server.js loads this graph through Node type-stripping.

import { createHash, randomBytes } from 'node:crypto'
import { createAuthEndpoint, sessionMiddleware, APIError } from 'better-auth/api'
import type { BetterAuthPlugin } from 'better-auth'
import * as z from 'zod'
import { signAccessToken } from './access-token.js'
import { apple, baseURL, requireEnv, tier, webauthn } from './env.js'
import { returnSchemeUrl } from './oauth-return-scheme.js'
import { appleClientSecret, appleUsable } from './apple-client-secret.js'
import { hashPin, verifyPin } from './pin-hash.js'
import {
  classifySignInFailure,
  readSignInResponse,
  type SignInOutcome,
} from './oauth-signin-outcome.js'
import {
  attemptsLeft,
  clearAttempts,
  isLockedOut,
  isPinShape,
  registerFailure,
  validateNewPin,
  type LockoutState,
} from '../src/config/pinPolicy.js'

/**
 * Our tables, declared here so `npm run auth:migrate` creates them alongside better-auth's.
 *
 * Note better-auth always adds its own `id text primary key`, so where the PRD sketched a natural
 * primary key (`family_pin.user_id`, `pin_attempt.user_id`) we use a UNIQUE column instead — same
 * "one row per user" guarantee, expressed the way this adapter can generate and migrate.
 */
export const familySchema = {
  childProfile: {
    fields: {
      userId: {
        type: 'string' as const,
        required: true,
        index: true,
        references: { model: 'user', field: 'id', onDelete: 'cascade' as const },
      },
      // Optional FIRST name only — no surname, no birthdate, no photo (D9 data minimisation).
      name: { type: 'string' as const, required: false },
      avatarEmoji: { type: 'string' as const, required: true },
      createdAt: { type: 'date' as const, required: true },
      /** Soft delete, so a stale device pointer resolves to "gone" rather than to another child. */
      deletedAt: { type: 'date' as const, required: false },
    },
  },
  profileProgress: {
    fields: {
      profileId: {
        type: 'string' as const,
        required: true,
        unique: true,
        references: { model: 'childProfile', field: 'id', onDelete: 'cascade' as const },
      },
      /** The canonical v4 PersistedProgress document. */
      doc: { type: 'json' as const, required: true },
      rev: { type: 'number' as const, required: true, bigint: true },
      epoch: { type: 'number' as const, required: true },
      updatedAt: { type: 'date' as const, required: true },
    },
  },
  familyPin: {
    fields: {
      userId: {
        type: 'string' as const,
        required: true,
        unique: true,
        references: { model: 'user', field: 'id', onDelete: 'cascade' as const },
      },
      /** scrypt$…$… over HMAC-SHA256(PIN_PEPPER, pin) — see lib/pin-hash.ts. */
      hash: { type: 'string' as const, required: true },
      updatedAt: { type: 'date' as const, required: true },
    },
  },
  pinAttempt: {
    // In POSTGRES, deliberately: lib/server-utils.ts's rateLimit() is a per-instance in-memory Map
    // that resets on every cold start, so it cannot protect a 10 000-value keyspace (PRD §8.2).
    fields: {
      userId: {
        type: 'string' as const,
        required: true,
        unique: true,
        references: { model: 'user', field: 'id', onDelete: 'cascade' as const },
      },
      failedCount: { type: 'number' as const, required: true },
      lastFailedAt: { type: 'date' as const, required: false },
      lockedUntil: { type: 'date' as const, required: false },
      requiresRecovery: { type: 'boolean' as const, required: true },
    },
  },
  oauthFlow: {
    fields: {
      /** sha256(flowId) — the plaintext claim credential is NEVER at rest server-side. */
      flowIdHash: { type: 'string' as const, required: true, unique: true },
      provider: { type: 'string' as const, required: true },
      /** A SEPARATE 32-byte value, so what Google echoes back is not what the client claims with. */
      state: { type: 'string' as const, required: true, unique: true },
      codeVerifier: { type: 'string' as const, required: true },
      sessionToken: { type: 'string' as const, required: false },
      createdAt: { type: 'date' as const, required: true },
      expiresAt: { type: 'date' as const, required: true },
      claimedAt: { type: 'date' as const, required: false },
      /**
       * WHICH APP STARTED THIS FLOW — `web` or `shell`. Recorded so the callback can answer the two
       * runtimes differently (sign-in reliability PRD W5): the shell must never be handed
       * `/#bl_auth=1`, which boots the ENTIRE web app inside the system-browser sheet and then, having
       * no flowId there, correctly renders "Du er allerede logget ind" — the modal the owner read as
       * the app lying to him. NULL means `web`, so existing rows and older clients are unaffected.
       */
      client: { type: 'string' as const, required: false },
      /**
       * A FAILED CALLBACK MUST BE DISTINGUISHABLE FROM "the adult is still at Google" (RC3). Without
       * these the row keeps `state = 'used:…'` and `sessionToken` NULL, which is byte-for-byte what a
       * flow in progress looks like, so `/oauth/claim` answered `{status:'pending'}` and the app polled
       * a permanently dead flow until its own timer expired. Two such orphans sat in staging's
       * `oauthFlow` table on 2026-08-09 and are the measured proof.
       *
       * `failureCode` is the short Fejlkode the adult can read out (null when the failure needed no
       * report, e.g. a cancel or an allowlist refusal); `failureMessage` is the Danish sentence, stored
       * rather than re-derived so the callback page and the app say the SAME thing.
       */
      failureCode: { type: 'string' as const, required: false },
      failureMessage: { type: 'string' as const, required: false },
      failedAt: { type: 'date' as const, required: false },
    },
  },
} as const

export interface FamilyPluginOptions {
  /** Reserved for future flags (email OTP, etc.). */
  reserved?: never
}

interface PinAttemptRow {
  id: string
  userId: string
  failedCount: number
  lastFailedAt: Date | null
  lockedUntil: Date | null
  requiresRecovery: boolean
}

type Adapter = { findOne: <T>(a: unknown) => Promise<T | null> } & Record<string, unknown>

/** Read the persisted lockout, or the zeroed state for a user who has never failed. */
async function readLockout(
  adapter: Adapter,
  userId: string,
): Promise<{ row: PinAttemptRow | null; state: LockoutState }> {
  const row = await (adapter as unknown as {
    findOne: (a: unknown) => Promise<PinAttemptRow | null>
  }).findOne({ model: 'pinAttempt', where: [{ field: 'userId', value: userId }] })
  if (!row) return { row: null, state: clearAttempts() }
  return {
    row,
    state: {
      failedCount: row.failedCount ?? 0,
      lockedUntil: row.lockedUntil ? new Date(row.lockedUntil).getTime() : null,
      requiresRecovery: row.requiresRecovery === true,
    },
  }
}

async function writeLockout(
  adapter: unknown,
  userId: string,
  row: PinAttemptRow | null,
  state: LockoutState,
  now: number,
): Promise<void> {
  const a = adapter as {
    create: (x: unknown) => Promise<unknown>
    update: (x: unknown) => Promise<unknown>
  }
  const data = {
    failedCount: state.failedCount,
    lastFailedAt: state.failedCount > 0 ? new Date(now) : null,
    lockedUntil: state.lockedUntil ? new Date(state.lockedUntil) : null,
    requiresRecovery: state.requiresRecovery,
  }
  if (row) {
    await a.update({ model: 'pinAttempt', where: [{ field: 'userId', value: userId }], update: data })
  } else {
    await a.create({ model: 'pinAttempt', data: { userId, ...data } })
  }
}

// ----- the cookie-free Google PKCE leg (§4.5) ----------------------------------------------------
//
// THIS REPLACES THE OBVIOUS DESIGN, which has a real hole. Two failure modes, both verified or
// reasoned through before this was written:
//
// 1. better-auth's own social redirect cannot work here. `account.storeStateStrategy` defaults to
//    "database" when a DB is configured, and the database strategy STILL sets a signed state cookie
//    when starting the flow and validates the stored state against it on the callback. W1 confirmed
//    this with curl: POST /sign-in/social answers `set-cookie: better-auth.state=…; HttpOnly`. So the
//    cookie we distrust is load-bearing BEFORE any session exists: if the start happens in the PWA
//    context and the callback runs in the in-app browser view, you get state_mismatch and never reach
//    the point where a handoff code would help.
//
// 2. A one-time code in the RETURN URL is a session-theft hole in exactly the scenario being defended
//    against. If the in-app browser view loads /?code=… and does not hand back, the SPA boots INSIDE
//    that view and consumes the code there: the token lands in the wrong localStorage, the adult
//    stares at a lock screen forever, and a live session token sits in a context we don't control.
//
// THE FIX: the claim credential is a `flowId` the app generates IN ITS OWN CONTEXT before navigating
// and keeps in ITS OWN localStorage. The URL then carries no secret at all — only a "flow finished"
// signal, in the FRAGMENT so it never reaches Vercel access logs or a Referer header.

const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000
/** Once the callback has parked a session token, the client has 5 minutes to claim it. */
const OAUTH_CLAIM_TTL_MS = 5 * 60 * 1000

const sha256 = (v: string): string => createHash('sha256').update(v, 'utf8').digest('hex')
const b64url = (n: number): string => randomBytes(n).toString('base64url')

/**
 * Apple gets its OWN callback path, and the reason is structural rather than cosmetic: once any scope
 * is requested, Apple's `response_mode` must be `form_post`, so it answers with an
 * `application/x-www-form-urlencoded` **POST** instead of a redirect with a query string. The Google
 * callback is declared `method: 'GET'` and cannot serve both. Register this exact string in the Apple
 * developer portal's Return URLs.
 */
const APPLE_CALLBACK_PATH = '/api/auth/family/oauth/callback/apple'

/** The two providers that can CREATE an account. Passkeys can only unlock an existing one. */
export type OauthProvider = 'google' | 'apple'

interface OauthFlowRow {
  id: string
  flowIdHash: string
  provider: string
  state: string
  codeVerifier: string
  sessionToken: string | null
  createdAt: Date
  expiresAt: Date
  claimedAt: Date | null
  client: string | null
  failureCode: string | null
  failureMessage: string | null
  failedAt: Date | null
}

/**
 * Which app started a flow, and what it can be handed back.
 *
 * `shell-scheme` is a CAPABILITY, not a preference, and the distinction is what makes the rollout safe:
 * a binary that has not registered `CFBundleURLTypes` cannot receive a custom-scheme redirect, and
 * sending one anyway would end a *successful* sign-in on Safari's "the address is invalid" — strictly
 * worse than the terminal page it replaces. So the client claims it only after the `appUrlOpen`
 * listener is actually registered, and every already-installed binary keeps layer 2's page.
 *
 * NULL on the row (an older client, or a pre-W3 row) means `web`.
 */
export type OauthClient = 'web' | 'shell' | 'shell-scheme'
const clientOf = (row: { client?: string | null }): OauthClient =>
  row.client === 'shell' || row.client === 'shell-scheme' ? row.client : 'web'
/** Both shell values render the shell's pages; only one gets the scheme redirect. */
const isShell = (c: OauthClient): boolean => c !== 'web'

/** Where the app resumes. Carries NO secret — only "the flow finished", and in the FRAGMENT. */
const RETURN_URL = '/#bl_auth=1'

/**
 * SUCCESS IS A REDIRECT, NOT A PAGE — and that is a fix, not a style choice.
 *
 * This used to answer with HTML whose inline `<script>location.replace(…)</script>` performed the
 * hand-back. W11's CSP (`script-src 'self'`) is applied by vercel.json's `/(.*)` rule to EVERY path
 * including this one — verified with `curl -I` against the deployed callback — so that inline script
 * was blocked and the automatic return silently stopped working: the adult had to notice and tap the
 * link. A 302 needs no script, so it needs no CSP exception.
 *
 * Keep it a 302 (not a 303/307): the request is already a GET, and every browser follows it with the
 * fragment intact.
 */
const returnToApp = (client: OauthClient): Response => {
  // THE SHELL MUST NOT BE 302'd INTO THE WEB APP. On the web this redirect lands in the tab that started
  // the flow and the fragment triggers the claim on the next paint — correct, and unchanged. In the
  // native shell the callback is running inside `SFSafariViewController`, so the SAME redirect boots
  // the ENTIRE web app inside the sheet; that copy holds no flowId, so it renders `WrongContextNotice`
  // — "Du er allerede logget ind" — over an app that is not, which is exactly the modal the owner
  // reported.
  //
  // A binary that can receive a custom-scheme link gets one, and iOS brings the app to the front
  // (W5 layer 1). The scheme comes from a tier-keyed table on THIS side — see `oauth-return-scheme.ts`
  // for why it is never taken from the request.
  if (client === 'shell-scheme') {
    return new Response(null, {
      status: 302,
      headers: { location: returnSchemeUrl(tier()), 'cache-control': 'no-store' },
    })
  }
  // Every binary already in the field: a tiny terminal page. The app behind the sheet is polling, and
  // its successful claim calls `closeExternalAuth()` and dismisses this within a tick.
  if (client === 'shell') return htmlResponse(shellDonePage())
  return new Response(null, {
    status: 302,
    headers: { location: RETURN_URL, 'cache-control': 'no-store' },
  })
}

/** Shared chrome for both server-rendered pages. Script-free — see the CSP note above. */
const pageShell = (body: string): string =>
  `<!doctype html><html lang="da"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Børnelæring</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;margin:0;
align-items:center;justify-content:center;background:#F8FAFC;color:#1e293b;text-align:center;padding:24px}
main{max-width:22rem}a{display:inline-block;margin-top:1.25rem;padding:.9rem 1.4rem;border-radius:14px;
background:#6d28d9;color:#fff;text-decoration:none;font-weight:600;min-height:44px}
p.hint{margin-top:1.25rem;color:#475569}</style></head>
<body><main>${body}</main></body></html>`

/**
 * The shell's SUCCESS page. Deliberately terminal and deliberately dull: it is on screen for about as
 * long as one claim poll, because the app behind the sheet dismisses it as soon as it has the session.
 * The line below it is there for the case where the sheet is NOT dismissed automatically — the adult
 * closing it by hand costs one tap and loses nothing, since the claim runs in the app either way.
 */
const shellDonePage = (): string =>
  pageShell(
    `<h1 style="font-size:1.25rem">Færdig</h1>
<p class="hint">Du er logget ind. Luk dette vindue for at vende tilbage til Børnelæring.</p>`,
  )

/**
 * The FAILURE page. Also script-free for the CSP reason above, so the link is genuinely the only way
 * onward — it is not decoration behind an automatic redirect.
 */
function failureHtml(message: string, code?: string | null, client: OauthClient = 'web'): string {
  // The CODE is the whole point of this page beyond the apology. This failure happens on the SERVER —
  // the SPA never boots on this response — so the client-side auto-reporter (`authDiagnostics`) cannot
  // fire, and a failed Google sign-in produced literally no data anywhere. Twice. The adult reads this
  // code out; `reportOauthFailure` has already stored the real cause under it.
  const codeBlock = code
    ? `<p style="margin-top:1rem;font-size:.95rem;color:#475569">Fejlkode: <strong style="font-family:ui-monospace,monospace;letter-spacing:.05em">${escapeHtml(code)}</strong></p>`
    : ''
  // `<a href="/">` IS A DEAD END IN THE SHELL, and worse than nothing. It is root-relative, so it
  // navigates the SFSafariViewController SHEET into the web app rather than returning to the native
  // app — the owner reported tapping "Tilbage til Børnelæring" and getting Børnelæring, inside the
  // sheet, still signed out. There is no URL a script-free page can use to reach the app from here
  // (the custom scheme is W5 layer 1 and needs a new binary), so say the true thing instead.
  // BOTH shell values, which is the whole reason `isShell` exists rather than a `=== 'shell'` test:
  // a `shell-scheme` binary gets the custom-scheme redirect on SUCCESS, but a FAILURE still renders a
  // page in the sheet — and giving that page the root-relative link would put it right back where it
  // was, loading the web app inside SFSafariViewController.
  const onward = isShell(client)
    ? `<p class="hint">Luk dette vindue for at vende tilbage til Børnelæring.</p>`
    : `<a href="/">Tilbage til Børnelæring</a>`
  return pageShell(`<h1 style="font-size:1.25rem">${escapeHtml(message)}</h1>
${codeBlock}
${onward}`)
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The DOMAIN of the address an ID token names — never the address itself.
 *
 * `gmail.com` vs `privaterelay.appleid.com` is exactly the question a refused Apple sign-in leaves open,
 * and it cannot be answered from the database (no Apple `account` row has ever been created) or from the
 * refusal itself (the allowlist hook throws a message with no address in it). A domain is not personal
 * data in the way the address is, and it is the smallest thing that settles "wrong account" vs "Hide My
 * Email".
 *
 * CALLED ONLY ON THE FORBIDDEN PATH, i.e. strictly AFTER better-auth verified the token's signature and
 * issuer — so this reads a claim that has already been checked, and the decode is not a trust decision.
 * The charset test is belt-and-braces on top of `escapeHtml`.
 */
function emailDomainOf(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return null
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: unknown }
    const email = typeof claims.email === 'string' ? claims.email : ''
    const at = email.lastIndexOf('@')
    if (at < 0) return null
    const domain = email.slice(at + 1).toLowerCase()
    return /^[a-z0-9][a-z0-9.-]{0,78}[a-z0-9]$/.test(domain) ? domain : null
  } catch {
    return null
  }
}

/** The allowlist refusal, adult-facing. Same text on the page and in the app (via the flow row). */
const forbiddenMessage = (domain: string | null): string =>
  domain
    ? `Denne konto har ikke adgang til Børnelæring. Adressen slutter på @${domain}.`
    : 'Denne konto har ikke adgang til Børnelæring.'

/**
 * Store WHY the OAuth callback failed, and return a short code to print on the page.
 *
 * The detail (Google's own `error` string, the HTTP status, which branch) goes into the report, NOT into
 * the page — that split is deliberate and preserves the original rule here: Google's error text can echo
 * request material, and this page is rendered to whoever holds the callback URL, while report READS are
 * fail-closed behind `BUG_REPORT_READ_KEY`.
 *
 * Best-effort by construction: it posts to our own `/api/bug-report`, and any failure to store simply
 * means no code on the page — a diagnostic must never turn a handled error into a broken response.
 */
async function reportOauthFailure(
  reason: string,
  detail: {
    /** MANDATORY. Three reports said `no-session-token-after-signin` and none of them said which
     *  provider, so a Google fault and an Apple fault were indistinguishable in the listing. */
    provider: OauthProvider
    status?: number
    /** The PROVIDER's own `error` string from a token exchange (`invalid_client`, …). */
    providerError?: string
    /** better-auth's own error `code` (`FORBIDDEN`, `INVALID_TOKEN`, …) — see `signInWithIdToken`. */
    code?: string
    message?: string
  },
): Promise<string | null> {
  try {
    const res = await fetch(`${baseURL()}/api/bug-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        report: {
          schema: 1,
          type: 'auth',
          category: 'login',
          createdAt: new Date().toISOString(),
          sessionId: 'server',
          // The note is what shows in the report LISTING, so the provider goes in it — that is the
          // question every one of these reports failed to answer.
          note: `OAuth callback mislykkedes: ${detail.provider} — ${reason}`,
          auth: {
            stage: 'oauth-callback',
            reason,
            provider: detail.provider,
            status: detail.status,
            code: detail.code ?? detail.providerError,
            // Message text only — never a token, a code or a URL with a query.
            errorName: detail.message?.slice(0, 200),
            trail: [
              `server ${new Date().toISOString()} ${detail.provider} ${reason}` +
                (detail.status !== undefined ? ` status=${detail.status}` : '') +
                (detail.code ? ` code=${detail.code}` : ''),
            ],
          },
          app: { route: '/api/auth/family/oauth/callback', online: true },
          diagnostics: { console: [], network: [], breadcrumbs: [] },
        },
      }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { id?: string }
    return body.id ?? null
  } catch {
    return null
  }
}

const htmlResponse = (body: string, status = 200): Response =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })

/**
 * KILL THE FLOW, THEN RENDER ITS PAGE. Every failure branch that HAS a row goes through here.
 *
 * The page alone was never enough: it is rendered in the system browser / the other tab, while the app
 * that is polling sits behind it with no way to learn anything. Stamping the row is what lets
 * `/oauth/claim` answer 410-with-a-reason instead of `{status:'pending'}`, which is the difference
 * between the adult seeing a Danish sentence immediately and the app polling a dead flow for its whole
 * window (RC3).
 *
 * Best-effort on the write, deliberately: if the update throws we still render the page, and the client
 * degrades to exactly the pre-W3 behaviour rather than losing the message too.
 */
async function failFlow(
  adapter: Adapter & { update: (x: unknown) => Promise<unknown> },
  row: OauthFlowRow,
  opts: { message: string; code?: string | null; status?: number },
): Promise<Response> {
  try {
    await adapter.update({
      model: 'oauthFlow',
      where: [{ field: 'id', value: row.id }],
      update: {
        failureCode: opts.code ?? null,
        failureMessage: opts.message,
        failedAt: new Date(),
      },
    })
  } catch (e) {
    console.error('[auth] could not mark the oauth flow as failed', e)
  }
  return htmlResponse(failureHtml(opts.message, opts.code, clientOf(row)), opts.status ?? 400)
}

export const familyPlugin = (): BetterAuthPlugin => ({
  id: 'family',
  schema: familySchema,
  endpoints: {
    /**
     * Mint the short-lived access JWT that /api/tts-azure and /api/stt require.
     *
     * Held in memory only on the client — one extra mint per reload, one fewer secret at rest
     * (§4.4). `expiresIn` is RELATIVE seconds so the client never compares its own clock against
     * the server's.
     */
    familyAccessToken: createAuthEndpoint(
      '/family/access-token',
      { method: 'POST', use: [sessionMiddleware] },
      async (ctx) => {
        const session = ctx.context.session
        if (!session) throw new APIError('UNAUTHORIZED')
        const { token, expiresIn } = await signAccessToken(
          session.user.id,
          session.session.id,
        )
        return ctx.json({ token, expiresIn })
      },
    ),

    /**
     * Which providers can CREATE an account here — and deliberately UNAUTHENTICATED.
     *
     * `/family/status` below is session-gated, which is correct for it (passkey count, PIN state) and
     * useless for this question: the adult who needs to know which sign-up buttons exist is precisely
     * the one with no session. Keying the Apple button off `status.methods` hid it on the only two
     * surfaces that offer sign-up — the guest Konto pane and the lock screen.
     *
     * Leaks nothing: "this deployment has Apple configured" is visible from the button itself. No
     * secrets, no email, no per-user state, so no session and no rate-limit rule beyond the default.
     */
    familyProviders: createAuthEndpoint(
      '/family/providers',
      { method: 'GET' },
      async (ctx) => ctx.json({ providers: ['google', ...(appleUsable() ? ['apple'] : [])] }),
    ),

    /**
     * What this device may offer the adult. No secrets, and deliberately no email — the client only
     * needs to know which buttons to render.
     */
    familyStatus: createAuthEndpoint(
      '/family/status',
      { method: 'GET', use: [sessionMiddleware] },
      async (ctx) => {
        const session = ctx.context.session
        if (!session) throw new APIError('UNAUTHORIZED')
        const adapter = ctx.context.adapter
        const userId = session.user.id

        const pin = await adapter.findOne<{ updatedAt: Date }>({
          model: 'familyPin',
          where: [{ field: 'userId', value: userId }],
        })

        // The passkey table only exists once the passkey plugin is registered; count defensively so
        // a preview deployment (where passkeys are disabled outright) can still answer.
        const passkeyCount = await adapter
          .count({ model: 'passkey', where: [{ field: 'userId', value: userId }] })
          .catch(() => 0)

        const wa = webauthn()
        // `apple` appears only once all four APPLE_* env vars are set — a half-configured Apple would
        // render a button that dies at the token exchange, and the adult would blame their Apple ID.
        const methods = [
          'google',
          ...(appleUsable() ? ['apple'] : []),
          ...(wa.enabled ? ['passkey'] : []),
        ]

        return ctx.json({
          hasPin: !!pin,
          // Drives the cross-device PIN-change detection: a client whose cached local verifier is
          // older than this drops it and forces an online verify (§7.2).
          pinUpdatedAt: pin ? new Date(pin.updatedAt).getTime() : null,
          methods,
          passkeyCount,
          webauthnEnabled: wa.enabled,
        })
      },
    ),

    /**
     * Set or change the 4-digit adult PIN.
     *
     * Changing an existing PIN requires the CURRENT one (§7.2: a credential change is always
     * server-verified) and goes through the same lockout as a verify, so `pin/set` can't be used as
     * an unthrottled oracle for the old PIN.
     */
    familyPinSet: createAuthEndpoint(
      '/family/pin/set',
      {
        method: 'POST',
        use: [sessionMiddleware],
        body: z.object({ pin: z.string(), currentPin: z.string().optional() }),
      },
      async (ctx) => {
        const session = ctx.context.session
        if (!session) throw new APIError('UNAUTHORIZED')
        const adapter = ctx.context.adapter as unknown as Adapter
        const userId = session.user.id
        const now = Date.now()

        const check = validateNewPin(ctx.body.pin)
        if (!check.ok) {
          throw new APIError('BAD_REQUEST', { message: check.message, code: check.reason })
        }

        const existing = await adapter.findOne<{ id: string; hash: string }>({
          model: 'familyPin',
          where: [{ field: 'userId', value: userId }],
        })

        // ONE read of the attempt row, reused by both the verify below and the clear at the end. It
        // used to be read twice on the success path, i.e. an extra round trip per PIN change.
        const lockout = await readLockout(adapter, userId)

        if (existing) {
          const { row, state } = lockout
          if (isLockedOut(state, now)) {
            throw new APIError('LOCKED', {
              message: 'For mange forsøg. Prøv igen senere.',
              lockedUntil: state.lockedUntil,
            })
          }
          const ok = isPinShape(ctx.body.currentPin)
            ? await verifyPin(ctx.body.currentPin as string, existing.hash)
            : false
          if (!ok) {
            const next = registerFailure(state, now)
            await writeLockout(adapter, userId, row, next, now)
            throw new APIError('UNAUTHORIZED', {
              message: 'Den nuværende kode er ikke rigtig.',
              attemptsLeft: attemptsLeft(next),
              lockedUntil: next.lockedUntil,
            })
          }
        }

        const hash = await hashPin(ctx.body.pin)
        const updatedAt = new Date(now)
        if (existing) {
          await (adapter as unknown as { update: (x: unknown) => Promise<unknown> }).update({
            model: 'familyPin',
            where: [{ field: 'userId', value: userId }],
            update: { hash, updatedAt },
          })
        } else {
          await (adapter as unknown as { create: (x: unknown) => Promise<unknown> }).create({
            model: 'familyPin',
            data: { userId, hash, updatedAt },
          })
        }
        // A successful change clears the attempt counter for the NEW secret — but only if there is a
        // counter to clear. Writing one for a user who has never failed would create the row on every
        // first-run PIN setup for nothing.
        if (lockout.row) {
          await writeLockout(adapter, userId, lockout.row, clearAttempts(), now)
        }

        return ctx.json({ ok: true, pinUpdatedAt: now })
      },
    ),

    /**
     * Server-authoritative PIN verification.
     *
     * ORDER MATTERS: the lockout is checked BEFORE the hash is compared, so a CORRECT PIN inside a
     * lock window is still refused. Otherwise knowing the PIN would bypass the very lockout that
     * protects a 10 000-value keyspace (§8.2). This is the one thing in here not to "optimise".
     */
    familyPinVerify: createAuthEndpoint(
      '/family/pin/verify',
      { method: 'POST', use: [sessionMiddleware], body: pinBodySchema },
      async (ctx) => {
        const session = ctx.context.session
        if (!session) throw new APIError('UNAUTHORIZED')
        const adapter = ctx.context.adapter as unknown as Adapter
        const userId = session.user.id
        const now = Date.now()

        const { row, state } = await readLockout(adapter, userId)
        if (isLockedOut(state, now)) {
          throw new APIError('LOCKED', {
            message: 'For mange forsøg. Prøv igen senere.',
            lockedUntil: state.lockedUntil,
            requiresRecovery: state.requiresRecovery,
          })
        }

        const stored = await adapter.findOne<{ hash: string; updatedAt: Date }>({
          model: 'familyPin',
          where: [{ field: 'userId', value: userId }],
        })
        // No PIN set yet: report it plainly rather than burning an attempt on an impossible check.
        if (!stored) throw new APIError('BAD_REQUEST', { message: 'Der er ikke lavet en kode endnu.', code: 'no_pin' })

        const ok = isPinShape(ctx.body.pin) && (await verifyPin(ctx.body.pin, stored.hash))
        if (!ok) {
          const next = registerFailure(state, now)
          await writeLockout(adapter, userId, row, next, now)
          // The attempt that STARTS a lock window answers 423 too, so the client renders a countdown
          // rather than "3 forsøg tilbage" on the one attempt where that would be wrong.
          throw new APIError(next.lockedUntil ? 'LOCKED' : 'UNAUTHORIZED', {
            message: next.lockedUntil ? 'For mange forsøg. Prøv igen senere.' : 'Koden er ikke rigtig.',
            attemptsLeft: attemptsLeft(next),
            lockedUntil: next.lockedUntil,
            requiresRecovery: next.requiresRecovery,
          })
        }

        if (state.failedCount > 0 || state.lockedUntil) {
          await writeLockout(adapter, userId, row, clearAttempts(), now)
        }
        // `pinUpdatedAt` lets the client stamp its LOCAL verifier cache, which is how a PIN changed on
        // another device invalidates this one's offline capability (§7.2).
        return ctx.json({ ok: true, pinUpdatedAt: new Date(stored.updatedAt).getTime() })
      },
    ),

    /**
     * Delete the whole account, for real (§8.4: "deletion that actually deletes rows").
     *
     * ON DELETE CASCADE on every table that references `user` means one delete removes the sessions,
     * the OAuth accounts, the passkeys, the PIN, the attempt counter, the child profiles and — through
     * childProfile — every progress document. Requires the current PIN, because this is the most
     * destructive account-scoped mutation there is.
     */
    familyDeleteAccount: createAuthEndpoint(
      '/family/delete-account',
      { method: 'POST', use: [sessionMiddleware], body: pinBodySchema },
      async (ctx) => {
        const session = ctx.context.session
        if (!session) throw new APIError('UNAUTHORIZED')
        const adapter = ctx.context.adapter as unknown as Adapter
        const userId = session.user.id
        const now = Date.now()

        const { row, state } = await readLockout(adapter, userId)
        if (isLockedOut(state, now)) {
          throw new APIError('LOCKED', { message: 'For mange forsøg. Prøv igen senere.' })
        }
        const stored = await adapter.findOne<{ hash: string }>({
          model: 'familyPin',
          where: [{ field: 'userId', value: userId }],
        })
        // NO PIN, no deletion — but say WHY. The PIN stays mandatory here (this is the most destructive
        // account-scoped mutation there is, so it does not fall back to the session alone), and an
        // account that somehow has none would otherwise be told "Koden er ikke rigtig" about a code
        // that does not exist, and would look undeletable for no stated reason.
        if (!stored) {
          throw new APIError('BAD_REQUEST', {
            message: 'Lav en kode først — den skal bruges for at bekræfte sletningen.',
            code: 'no_pin',
          })
        }
        const ok = isPinShape(ctx.body.pin) && (await verifyPin(ctx.body.pin, stored.hash))
        if (!ok) {
          const next = registerFailure(state, now)
          await writeLockout(adapter, userId, row, next, now)
          throw new APIError('UNAUTHORIZED', { message: 'Koden er ikke rigtig.' })
        }

        await (adapter as unknown as { delete: (x: unknown) => Promise<void> }).delete({
          model: 'user',
          where: [{ field: 'id', value: userId }],
        })
        return ctx.json({ ok: true })
      },
    ),

    /**
     * Step 2 of §4.5: the app has already written `flowId` into its OWN localStorage (step 1 — that
     * write happening in the app's storage context is the entire point). We store only sha256(flowId),
     * so the plaintext claim credential is never at rest server-side, and generate a SEPARATE random
     * `state`, so the value Google echoes back is not the value the client claims with.
     */
    familyOauthStart: createAuthEndpoint(
      '/family/oauth/start',
      {
        method: 'POST',
        body: z.object({
          flowId: z.string().min(20).max(200),
          // Optional + defaulted so an older client (or a shell binary mid-rollout) keeps working
          // unchanged — it simply never asks for Apple.
          provider: z.enum(['google', 'apple']).optional(),
          /**
           * WHICH APP IS ASKING, AND WHAT IT CAN RECEIVE. Optional and defaulted to `web` for the same
           * rollout reason.
           *
           * A CAPABILITY, never a destination. `shell-scheme` says only "this binary has an `appUrlOpen`
           * listener registered"; WHICH scheme it then gets comes from a tier-keyed table on the server
           * (`oauth-return-scheme.ts`), exactly as the PROVIDER is read off the stored row rather than
           * off the request. Echoing a caller-supplied scheme would make this an open redirect into an
           * arbitrary app at the moment a session token is in flight.
           */
          client: z.enum(['web', 'shell', 'shell-scheme']).optional(),
        }),
      },
      async (ctx) => {
        const adapter = ctx.context.adapter as unknown as Adapter & {
          create: (x: unknown) => Promise<unknown>
          deleteMany: (x: unknown) => Promise<number>
        }
        const now = Date.now()

        // Cheap opportunistic sweep — no cron needed for a family-scale table.
        await adapter
          .deleteMany({
            model: 'oauthFlow',
            where: [{ field: 'expiresAt', value: new Date(now), operator: 'lt' }],
          })
          .catch(() => 0)

        const state = b64url(32)
        const codeVerifier = b64url(32)
        const challenge = createHash('sha256').update(codeVerifier).digest('base64url')

        const provider = ctx.body.provider ?? 'google'
        if (provider === 'apple' && !appleUsable()) {
          throw new APIError('BAD_REQUEST', {
            message: 'Apple-login er ikke sat op på denne server.',
            code: 'apple_not_configured',
          })
        }

        await adapter.create({
          model: 'oauthFlow',
          data: {
            flowIdHash: sha256(ctx.body.flowId),
            provider,
            state,
            codeVerifier,
            sessionToken: null,
            createdAt: new Date(now),
            expiresAt: new Date(now + OAUTH_FLOW_TTL_MS),
            claimedAt: null,
            client: ctx.body.client ?? 'web',
            failureCode: null,
            failureMessage: null,
            failedAt: null,
          },
        })

        if (provider === 'apple') {
          const url = new URL('https://appleid.apple.com/auth/authorize')
          url.searchParams.set('response_type', 'code')
          url.searchParams.set('client_id', apple().clientId)
          // A SEPARATE redirect URI, because Apple's response is a POST — see the callback below.
          url.searchParams.set('redirect_uri', `${baseURL()}${APPLE_CALLBACK_PATH}`)
          // `email` only. `name` would buy a display name we never show (the CHILD's name is what the
          // app uses, and that is typed locally), and 4.8 is about collecting LESS.
          url.searchParams.set('scope', 'email')
          url.searchParams.set('state', state)
          // MANDATORY once any scope is requested: Apple then POSTs the result as a form instead of
          // redirecting with a query string. This is the whole reason Apple needs its own callback.
          url.searchParams.set('response_mode', 'form_post')
          // NO PKCE: Apple's authorize endpoint does not document `code_challenge`, and the exchange
          // is already authenticated by the signed client secret. Sending it would be cargo cult.
          return ctx.json({ authorizeUrl: url.toString() })
        }

        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        url.searchParams.set('response_type', 'code')
        url.searchParams.set('client_id', requireEnv('GOOGLE_CLIENT_ID'))
        url.searchParams.set('redirect_uri', `${baseURL()}/api/auth/family/oauth/callback`)
        url.searchParams.set('scope', 'openid email profile')
        url.searchParams.set('state', state)
        url.searchParams.set('code_challenge', challenge)
        url.searchParams.set('code_challenge_method', 'S256')
        // `select_account` so a shared iPad can switch adult; `online` because we only ever consume a
        // one-shot id_token — which is also why the consent screen's 7-day refresh-token expiry on a
        // Testing-status app does not apply to us.
        url.searchParams.set('prompt', 'select_account')
        url.searchParams.set('access_type', 'online')

        return ctx.json({ authorizeUrl: url.toString() })
      },
    ),

    /**
     * Step 4–5: Google redirects here. We exchange the code with the stored verifier and complete
     * sign-in IN-PROCESS via `signInSocial({ idToken })` — the docs are explicit that when an ID token
     * is provided no redirection happens. The resulting session token is PARKED on the flow row; the
     * page we return carries no secret at all.
     */
    familyOauthCallback: createAuthEndpoint(
      '/family/oauth/callback',
      {
        method: 'GET',
        query: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
        }),
      },
      async (ctx) => {
        const adapter = ctx.context.adapter as unknown as Adapter & {
          update: (x: unknown) => Promise<unknown>
        }
        return completeOauthCallback(adapter, {
          code: ctx.query?.code,
          state: ctx.query?.state,
          error: ctx.query?.error,
        })
      },
    ),

    /**
     * Apple's leg of the SAME flow. It exists as a second endpoint only because Apple POSTs:
     * `response_mode=form_post` is mandatory once a scope is requested, so there is no query string to
     * read and the Google endpoint's `method: 'GET'` cannot serve it.
     *
     * Everything downstream is shared with Google — `completeOauthCallback` does the state lookup, the
     * single-use invalidation, the token exchange, `signInSocial({ idToken })` and the parking. The
     * `user` field Apple includes on the FIRST authorization only (the display name) is deliberately
     * not read: we never show an adult's name, and 4.8 is about collecting less.
     */
    familyOauthCallbackApple: createAuthEndpoint(
      APPLE_CALLBACK_PATH.replace('/api/auth', ''),
      {
        method: 'POST',
        // WITHOUT THIS, APPLE SIGN-IN IS A 415 BEFORE THIS HANDLER EVER RUNS. better-auth configures
        // its router with `allowedMediaTypes: ["application/json"]`, and better-call enforces that in
        // `getBody()` *inside the router*, so the endpoint's own zod `body` schema never gets a look:
        // Apple's `response_mode=form_post` POST answered
        // `{"code":"UNSUPPORTED_MEDIA_TYPE","message":"Content-Type \"application/x-www-form-urlencoded\"
        // is not allowed…"}` as raw JSON in the browser. A per-endpoint `metadata.allowedMediaTypes`
        // overrides the router-wide list (better-call `router.mjs`), and `getBody` then parses the form
        // into the same object shape the schema below expects.
        metadata: { allowedMediaTypes: ['application/x-www-form-urlencoded'] },
        body: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
          user: z.string().optional(),
        }),
      },
      async (ctx) => {
        const adapter = ctx.context.adapter as unknown as Adapter & {
          update: (x: unknown) => Promise<unknown>
        }
        return completeOauthCallback(adapter, {
          code: ctx.body?.code,
          state: ctx.body?.state,
          error: ctx.body?.error,
        })
      },
    ),


    /**
     * Step 6: the app claims with the `flowId` only IT has. A wrong flowId can never yield a token,
     * which is what makes the wrong-context case (an in-app browser view that loaded `#bl_auth=1`)
     * harmless: it has no flowId to claim with.
     */
    familyOauthClaim: createAuthEndpoint(
      '/family/oauth/claim',
      { method: 'POST', body: z.object({ flowId: z.string().min(20).max(200) }) },
      async (ctx) => {
        const adapter = ctx.context.adapter as unknown as Adapter & {
          delete: (x: unknown) => Promise<void>
        }
        const now = Date.now()
        const row = await adapter.findOne<OauthFlowRow>({
          model: 'oauthFlow',
          where: [{ field: 'flowIdHash', value: sha256(ctx.body.flowId) }],
        })
        // 404, not 410: a wrong flowId must be indistinguishable from "never existed".
        if (!row) throw new APIError('NOT_FOUND', { message: 'Ukendt login-forsøg.' })
        if (new Date(row.expiresAt).getTime() < now || row.claimedAt) {
          await adapter.delete({ model: 'oauthFlow', where: [{ field: 'id', value: row.id }] })
          throw new APIError('GONE', { message: 'Login-forsøget er udløbet.' })
        }
        // THE CALLBACK ALREADY FAILED (W3). Before this branch existed, a dead flow was indistinguishable
        // from a live one — same `state: 'used:…'`, same NULL `sessionToken` — so this endpoint answered
        // `{status:'pending'}` and the app polled a corpse until its own timer gave up 220 s later
        // (report 8AE9T). 410 is a status the client already treats as decisive; the message and the
        // Fejlkode ride along so the adult reads the same sentence in the app that the callback page
        // showed in the browser.
        //
        // The row is deliberately NOT deleted here: a claim answer that never arrives (a dropped
        // response is exactly the situation this whole flow exists for) must be re-askable. It expires
        // on its own and the next `/oauth/start` sweeps it.
        if (row.failedAt) {
          throw new APIError('GONE', {
            message: row.failureMessage ?? 'Login mislykkedes. Prøv igen.',
            code: row.failureCode ?? undefined,
          })
        }
        // The callback hasn't finished yet — this is the normal answer while the adult is on Google's
        // consent screen, and what the client's 3s poll expects.
        if (!row.sessionToken) return ctx.json({ status: 'pending' as const })

        // `set-auth-token` carries the session COOKIE value, i.e. the SIGNED form
        // `<rawToken>.<hmacSignature>` — but `findSession()` takes the RAW token. Looking the signed
        // value up directly always returns null, which made every real Google sign-in throw GONE here
        // and bounce the adult back to the lock screen even though the session had been created.
        // (The bearer plugin accepts either form on the way IN, which is why the passkey path — which
        // hands the same signed value straight to the client — worked.)
        const rawToken = row.sessionToken.split('.')[0]
        const session =
          (await ctx.context.internalAdapter.findSession(rawToken)) ??
          // Fallback in case a future better-auth stops signing the cookie value.
          (await ctx.context.internalAdapter.findSession(row.sessionToken))
        // Only a SUCCESSFUL read consumes the flow. Deleting before this check meant a transient
        // database hiccup burned the flow permanently and sent the adult back through Google, even
        // though the session existed — while single-use is still guaranteed, because the one path that
        // hands the token over is also the one that deletes. An unclaimed row expires in 5 minutes and
        // the next /oauth/start sweeps it.
        if (!session) throw new APIError('GONE', { message: 'Sessionen findes ikke længere.' })
        await adapter.delete({ model: 'oauthFlow', where: [{ field: 'id', value: row.id }] })

        return ctx.json({
          token: row.sessionToken,
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
          },
        })
      },
    ),
  },
})

/**
 * Complete sign-in from a verified Google ID token, in-process. Returns the bearer session token the
 * `bearer` plugin puts in the `set-auth-token` RESPONSE HEADER — with bearer transport a redirect has
 * no body the SPA could read, which is why the handoff artefact is structurally required (§4.4).
 *
 * **NO GOOGLE TOKEN IS PERSISTED SERVER-SIDE, and the omission below is the mechanism** (App Store PRD
 * §3.2 / A7). Guideline 5.1.1(v): "An app may not store credentials or tokens to social networks off of
 * the device and may only use such credentials or tokens to directly connect to the social network from
 * the app itself while the app is in use." Whether Apple reads "social networks" as covering
 * Google-as-identity-provider is UNKNOWN (PRD §6 #18) — so the safe design, which costs nothing:
 *
 *   * **Refresh token: never issued.** The authorization URL above sets `access_type=online`, and Google
 *     only returns a refresh token for `access_type=offline`. There is nothing to store.
 *   * **Access token: deliberately not forwarded.** better-auth's `signInSocial` accepts
 *     `idToken.accessToken` and writes it straight to `account.accessToken`
 *     (`api/routes/sign-in.mjs` → `handleOAuthUserInfo`), i.e. off-device at rest in Neon. Nothing in
 *     this repo ever reads it: Google's own `getUserInfo` decodes the ID TOKEN and ignores the access
 *     token entirely (`@better-auth/core/src/social-providers/google.ts`), and every API call we make
 *     carries our own session token or the 15-minute access JWT. So passing it bought nothing and stored
 *     a live Google credential.
 *
 * Guarded by `lib/googleTokens.test.ts`. If a future feature genuinely needs a Google API call, do it
 * from the client while the app is in use — do not re-add server-side storage.
 */
/**
 * Everything after the provider hands a code back — shared by Google (GET) and Apple (POST), because
 * only the transport and the token endpoint differ. The PROVIDER is read off the stored flow row, not
 * off the request, so a caller cannot pick which token endpoint we talk to.
 *
 * Order is load-bearing and mostly unchanged from the Google-only version: look the flow up by `state`,
 * refuse a replay, invalidate the state BEFORE the network hop, exchange, sign in, then park the
 * session token for the app to claim with its own `flowId`.
 *
 * ONE THING DID MOVE (W3): the "cancelled / no code" check used to run FIRST, before the row was ever
 * read, and therefore returned a page while leaving the flow row looking exactly like a flow still in
 * progress. Every branch that can identify a row now runs through `failFlow`, so the polling app learns
 * the outcome instead of waiting out its own timer.
 */
async function completeOauthCallback(
  adapter: Adapter & { update: (x: unknown) => Promise<unknown> },
  input: { code?: string; state?: string; error?: string },
): Promise<Response> {
  const now = Date.now()

  // No state at all: there is no flow to identify, let alone mark. Nothing can be done for the app here.
  if (!input.state) {
    return htmlResponse(failureHtml('Login blev afbrudt.'), 400)
  }

  const row = await adapter.findOne<OauthFlowRow>({
    model: 'oauthFlow',
    where: [{ field: 'state', value: input.state }],
  })
  if (!row || new Date(row.expiresAt).getTime() < now) {
    return htmlResponse(failureHtml('Login-linket er udløbet. Prøv igen i appen.'), 410)
  }
  const client = clientOf(row)
  // Single-use: a replayed callback finds the token already parked and is refused. (One adult,
  // one browser at family scale, so a guarded read is sufficient here.)
  if (row.sessionToken) {
    return htmlResponse(failureHtml('Dette login er allerede brugt.', null, client), 410)
  }
  // A replayed callback for a flow that ALREADY failed re-renders its recorded verdict rather than
  // starting a second exchange — same page, same Fejlkode, so the adult can still read the code out.
  if (row.failedAt) {
    return htmlResponse(
      failureHtml(row.failureMessage ?? 'Login mislykkedes. Prøv igen i appen.', row.failureCode, client),
      410,
    )
  }
  // The adult tapped "Annullér" at the provider, or the provider sent no code. NOT a fault: no report
  // and no Fejlkode — but decisive, so the app stops polling at once instead of waiting out its window.
  if (input.error || !input.code) {
    return failFlow(adapter, row, { message: 'Login blev afbrudt.', status: 400 })
  }
  // Bound to a local: narrowing a parameter's property does not survive the `await`s below in any way
  // worth relying on, and this value is handed to a network call.
  const authCode: string = input.code
  // Invalidate the state BEFORE the network hop, so a double-submit can't exchange twice.
  await adapter.update({
    model: 'oauthFlow',
    where: [{ field: 'id', value: row.id }],
    update: { state: `used:${b64url(16)}` },
  })

  const provider: OauthProvider = row.provider === 'apple' ? 'apple' : 'google'

  let idToken: string | undefined
  try {
    const tokenRes = await fetch(
      provider === 'apple' ? 'https://appleid.apple.com/auth/token' : 'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(
          provider === 'apple'
            ? {
                code: authCode,
                client_id: apple().clientId,
                // NOT a stored string — a freshly signed ES256 JWT. See `apple-client-secret.ts`.
                client_secret: appleClientSecret(now),
                redirect_uri: `${baseURL()}${APPLE_CALLBACK_PATH}`,
                grant_type: 'authorization_code',
              }
            : {
                code: authCode,
                client_id: requireEnv('GOOGLE_CLIENT_ID'),
                client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
                redirect_uri: `${baseURL()}/api/auth/family/oauth/callback`,
                grant_type: 'authorization_code',
                code_verifier: row.codeVerifier,
              },
        ),
      },
    )
    const body = (await tokenRes.json()) as { id_token?: string; error?: string }
    if (!tokenRes.ok || !body.id_token) {
      // Deliberately no detail in the PAGE — the provider's error text can echo request material. The
      // detail goes into the report instead, which is read-gated; the page shows only its code.
      console.error(`[auth] ${provider} token exchange failed`, tokenRes.status, body.error)
      const code = await reportOauthFailure('token-exchange-rejected', {
        provider,
        status: tokenRes.status,
        providerError: body.error,
      })
      return failFlow(adapter, row, { message: 'Login mislykkedes. Prøv igen i appen.', code, status: 400 })
    }
    // The access token the provider also returns here is DELIBERATELY DROPPED — see
    // `signInWithIdToken` below. Not read, not stored, not forwarded.
    idToken = body.id_token
  } catch (e) {
    console.error(`[auth] ${provider} token exchange threw`, e)
    const code = await reportOauthFailure('token-exchange-threw', {
      provider,
      message: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    })
    return failFlow(adapter, row, { message: 'Login mislykkedes. Prøv igen i appen.', code, status: 500 })
  }

  let outcome: SignInOutcome
  try {
    outcome = await signInWithIdToken(idToken, provider)
  } catch (e) {
    // A GENUINE THROW is now rare and therefore informative: `asResponse` converts every APIError into
    // a Response (see `SignInOutcome`), so what lands here is a fault OUTSIDE the endpoint contract —
    // the database being down, the dynamic `./auth.js` import failing, a bug. It keeps its historical
    // slug so old report codes still resolve to the same thing.
    const forbidden = e instanceof APIError && e.status === 'FORBIDDEN'
    if (!forbidden) console.error('[auth] signInSocial(idToken) threw', e)
    const code = forbidden
      ? null
      : await reportOauthFailure('signin-with-id-token-failed', {
          provider,
          message: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        })
    return failFlow(adapter, row, {
      message: forbidden
        ? forbiddenMessage(emailDomainOf(idToken))
        : 'Login mislykkedes. Prøv igen i appen.',
      code,
      status: forbidden ? 403 : 500,
    })
  }

  if (!outcome.ok) {
    // THE ALLOWLIST REFUSAL (§4.8) — the single most important refusal in the design, since nothing
    // else stops a stranger from completing sign-in on the public URL and legitimately burning Azure
    // and Google quota. It arrives as a 403 RESPONSE, not as a throw, which is precisely why this copy
    // was unreachable through OAuth until now.
    //
    // APPLE MAKES IT REACHABLE IN A NEW WAY: "Hide My Email" mints an `@privaterelay.appleid.com`
    // address, which is not on the list and never will be. So the page names the address's DOMAIN —
    // `gmail.com` vs `privaterelay.appleid.com` — which is what separates "wrong account" from "Hide My
    // Email" without ever printing the address. It stays a WORKING refusal: no Fejlkode, no report.
    const verdict = classifySignInFailure(outcome)
    if (verdict.kind === 'forbidden') {
      const domain = emailDomainOf(idToken)
      console.warn(`[auth] ${provider} sign-in refused by the allowlist (domain: ${domain ?? 'unknown'})`)
      return failFlow(adapter, row, { message: forbiddenMessage(domain), status: 403 })
    }
    console.error(`[auth] ${provider} signInSocial(idToken) refused`, outcome.status, outcome.code)
    const reason = verdict.reason
    const code = await reportOauthFailure(reason, {
      provider,
      status: outcome.status,
      code: outcome.code,
      message: outcome.message,
    })
    return failFlow(adapter, row, { message: 'Login mislykkedes. Prøv igen i appen.', code, status: 500 })
  }
  const sessionToken = outcome.token

  await adapter.update({
    model: 'oauthFlow',
    where: [{ field: 'id', value: row.id }],
    update: { sessionToken, expiresAt: new Date(now + OAUTH_CLAIM_TTL_MS) },
  })

  // Straight back into the app — no interstitial, no inline script, nothing for a CSP to block. The
  // shell gets a terminal page instead of the 302; see `returnToApp`.
  return returnToApp(client)
}

async function signInWithIdToken(idToken: string, provider: OauthProvider): Promise<SignInOutcome> {
  // A DYNAMIC import breaks what would otherwise be a static cycle (lib/auth.ts imports this module
  // to register the plugin). By the time this runs, lib/auth.ts is fully evaluated.
  //
  // **`.js`, NOT `.ts`** — this is the trap in `.claude/rules/api-endpoints.md`, and it took Google
  // sign-in down in production while every local check stayed green. Vercel compiles each file to a
  // sibling `.js` and rewrites NO specifiers, so `'./auth.ts'` shipped verbatim and threw
  // `ERR_MODULE_NOT_FOUND: /var/task/lib/auth.ts` at the one moment it is reached — after the Google
  // round trip, inside the callback. `dev-server.js` runs the real `.ts` off disk under type stripping,
  // so it can never reproduce this; a DYNAMIC import also can't be caught by `typecheck:server`, which
  // resolves `.ts` happily under `allowImportingTsExtensions`. Guarded now by `serverImports.test.ts`.
  const { auth } = await import('./auth.js')
  const res = await auth.api.signInSocial({
    body: {
      // `idToken` ONLY. Adding `accessToken` here is what would persist a provider credential in Neon
      // — see the header. There is no `refreshToken` to add.
      provider,
      idToken: { token: idToken },
    },
    asResponse: true,
  })
  // READ THE BODY — `asResponse` RETURNS an APIError rather than throwing it, so this is the only place
  // the real reason exists. See `lib/oauth-signin-outcome.ts`, which owns that reading and is unit-
  // testable against real Response objects.
  return readSignInResponse(res)
}

/** Shared by the endpoints that take a 4-digit code. Kept here so both PIN routes agree. */
export const pinBodySchema = z.object({ pin: z.string().min(4).max(4) })
