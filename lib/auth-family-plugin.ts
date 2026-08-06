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
import { baseURL, requireEnv, webauthn } from './env.js'
import { hashPin, verifyPin } from './pin-hash.js'
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
}

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
const returnToApp = (): Response =>
  new Response(null, {
    status: 302,
    headers: { location: RETURN_URL, 'cache-control': 'no-store' },
  })

/**
 * The FAILURE page. Also script-free for the CSP reason above, so the link is genuinely the only way
 * onward — it is not decoration behind an automatic redirect.
 */
function failureHtml(message: string, code?: string | null): string {
  // The CODE is the whole point of this page beyond the apology. This failure happens on the SERVER —
  // the SPA never boots on this response — so the client-side auto-reporter (`authDiagnostics`) cannot
  // fire, and a failed Google sign-in produced literally no data anywhere. Twice. The adult reads this
  // code out; `reportOauthFailure` has already stored the real cause under it.
  const codeBlock = code
    ? `<p style="margin-top:1rem;font-size:.95rem;color:#475569">Fejlkode: <strong style="font-family:ui-monospace,monospace;letter-spacing:.05em">${escapeHtml(code)}</strong></p>`
    : ''
  return `<!doctype html><html lang="da"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Børnelæring</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;margin:0;
align-items:center;justify-content:center;background:#F8FAFC;color:#1e293b;text-align:center;padding:24px}
main{max-width:22rem}a{display:inline-block;margin-top:1.25rem;padding:.9rem 1.4rem;border-radius:14px;
background:#6d28d9;color:#fff;text-decoration:none;font-weight:600;min-height:44px}</style></head>
<body><main><h1 style="font-size:1.25rem">${escapeHtml(message)}</h1>
${codeBlock}
<a href="/">Tilbage til Børnelæring</a></main></body></html>`
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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
  detail: { status?: number; googleError?: string; message?: string },
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
          note: `OAuth callback mislykkedes: ${reason}`,
          auth: {
            stage: 'oauth-callback',
            reason,
            status: detail.status,
            code: detail.googleError,
            // Message text only — never a token, a code or a URL with a query.
            errorName: detail.message?.slice(0, 200),
            trail: [`server ${new Date().toISOString()} ${reason}`],
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
        const methods = ['google', ...(wa.enabled ? ['passkey'] : [])]

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
      { method: 'POST', body: z.object({ flowId: z.string().min(20).max(200) }) },
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

        await adapter.create({
          model: 'oauthFlow',
          data: {
            flowIdHash: sha256(ctx.body.flowId),
            provider: 'google',
            state,
            codeVerifier,
            sessionToken: null,
            createdAt: new Date(now),
            expiresAt: new Date(now + OAUTH_FLOW_TTL_MS),
            claimedAt: null,
          },
        })

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
        const now = Date.now()

        if (ctx.query?.error || !ctx.query?.code || !ctx.query?.state) {
          return htmlResponse(failureHtml('Login blev afbrudt.'), 400)
        }

        const row = await adapter.findOne<OauthFlowRow>({
          model: 'oauthFlow',
          where: [{ field: 'state', value: ctx.query.state }],
        })
        if (!row || new Date(row.expiresAt).getTime() < now) {
          return htmlResponse(failureHtml('Login-linket er udløbet. Prøv igen i appen.'), 410)
        }
        // Single-use: a replayed callback finds the token already parked and is refused. (One adult,
        // one browser at family scale, so a guarded read is sufficient here.)
        if (row.sessionToken) {
          return htmlResponse(failureHtml('Dette login er allerede brugt.'), 410)
        }
        // Invalidate the state BEFORE the network hop, so a double-submit can't exchange twice.
        await adapter.update({
          model: 'oauthFlow',
          where: [{ field: 'id', value: row.id }],
          update: { state: `used:${b64url(16)}` },
        })

        let idToken: string | undefined
        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code: ctx.query.code,
              client_id: requireEnv('GOOGLE_CLIENT_ID'),
              client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
              redirect_uri: `${baseURL()}/api/auth/family/oauth/callback`,
              grant_type: 'authorization_code',
              code_verifier: row.codeVerifier,
            }),
          })
          const body = (await tokenRes.json()) as {
            id_token?: string
            error?: string
          }
          if (!tokenRes.ok || !body.id_token) {
            // Deliberately no detail in the PAGE — Google's error text can echo request material. The
            // detail goes into the report instead, which is read-gated; the page shows only its code.
            console.error('[auth] google token exchange failed', tokenRes.status, body.error)
            const code = await reportOauthFailure('token-exchange-rejected', {
              status: tokenRes.status,
              googleError: body.error,
            })
            return htmlResponse(failureHtml('Login mislykkedes. Prøv igen i appen.', code), 400)
          }
          // The access token Google also returns here is DELIBERATELY DROPPED — see
          // `signInWithIdToken` below. Not read, not stored, not forwarded.
          idToken = body.id_token
        } catch (e) {
          console.error('[auth] google token exchange threw', e)
          const code = await reportOauthFailure('token-exchange-threw', {
            message: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
          })
          return htmlResponse(failureHtml('Login mislykkedes. Prøv igen i appen.', code), 500)
        }

        let sessionToken: string | null
        try {
          sessionToken = await signInWithIdToken(idToken)
        } catch (e) {
          // The allowlist hook (§4.8) throws FORBIDDEN here for a non-permitted address — the single
          // most important refusal in the whole design, since nothing else stops a stranger from
          // legitimately burning Azure and Google quota.
          const forbidden = e instanceof APIError && e.status === 'FORBIDDEN'
          if (!forbidden) console.error('[auth] signInSocial(idToken) failed', e)
          // A forbidden address is a WORKING refusal, not a fault — it already says exactly what is
          // wrong, so it needs no code and no report. Everything else is a fault we cannot otherwise see.
          const code = forbidden
            ? null
            : await reportOauthFailure('signin-with-id-token-failed', {
                message: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
              })
          return htmlResponse(
            failureHtml(
              forbidden ? 'Denne konto har ikke adgang til Børnelæring.' : 'Login mislykkedes. Prøv igen i appen.',
              code,
            ),
            forbidden ? 403 : 500,
          )
        }
        if (!sessionToken) {
          const code = await reportOauthFailure('no-session-token-after-signin', {})
          return htmlResponse(failureHtml('Login mislykkedes. Prøv igen i appen.', code), 500)
        }

        await adapter.update({
          model: 'oauthFlow',
          where: [{ field: 'id', value: row.id }],
          update: { sessionToken, expiresAt: new Date(now + OAUTH_CLAIM_TTL_MS) },
        })

        // Straight back into the app — no interstitial, no inline script, nothing for a CSP to block.
        return returnToApp()
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
async function signInWithIdToken(idToken: string): Promise<string | null> {
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
      // `idToken` ONLY. Adding `accessToken` here is what would persist a Google credential in Neon —
      // see the header. There is no `refreshToken` to add.
      provider: 'google',
      idToken: { token: idToken },
    },
    asResponse: true,
  })
  if (!(res instanceof Response)) return null
  return res.headers.get('set-auth-token')
}

/** Shared by the endpoints that take a 4-digit code. Kept here so both PIN routes agree. */
export const pinBodySchema = z.object({ pin: z.string().min(4).max(4) })
