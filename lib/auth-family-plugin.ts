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
import { signAccessToken } from './access-token.ts'
import { baseURL, requireEnv, webauthn } from './env.ts'
import { hashPin, verifyPin } from './pin-hash.ts'
import {
  attemptsLeft,
  clearAttempts,
  isLockedOut,
  isPinShape,
  registerFailure,
  validateNewPin,
  type LockoutState,
} from '../src/config/pinPolicy.ts'

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

/** The terminal page. NO secret in this HTML or in the URL it navigates to. */
function callbackHtml(message: string, ok: boolean): string {
  const target = ok ? '/#bl_auth=1' : '/'
  return `<!doctype html><html lang="da"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Børnelæring</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;margin:0;
align-items:center;justify-content:center;background:#F8FAFC;color:#1e293b;text-align:center;padding:24px}
main{max-width:22rem}a{display:inline-block;margin-top:1.25rem;padding:.9rem 1.4rem;border-radius:14px;
background:#6d28d9;color:#fff;text-decoration:none;font-weight:600;min-height:44px}</style></head>
<body><main><h1 style="font-size:1.25rem">${message}</h1>
<a href="${target}">Tilbage til Børnelæring</a></main>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`
}

const htmlResponse = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

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

        if (existing) {
          const { row, state } = await readLockout(adapter, userId)
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
        // A successful change clears the attempt counter for the NEW secret.
        const { row } = await readLockout(adapter, userId)
        await writeLockout(adapter, userId, row, clearAttempts(), now)

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
          return htmlResponse(callbackHtml('Login blev afbrudt.', false), 400)
        }

        const row = await adapter.findOne<OauthFlowRow>({
          model: 'oauthFlow',
          where: [{ field: 'state', value: ctx.query.state }],
        })
        if (!row || new Date(row.expiresAt).getTime() < now) {
          return htmlResponse(callbackHtml('Login-linket er udløbet. Prøv igen i appen.', false), 410)
        }
        // Single-use: a replayed callback finds the token already parked and is refused. (One adult,
        // one browser at family scale, so a guarded read is sufficient here.)
        if (row.sessionToken) {
          return htmlResponse(callbackHtml('Dette login er allerede brugt.', false), 410)
        }
        // Invalidate the state BEFORE the network hop, so a double-submit can't exchange twice.
        await adapter.update({
          model: 'oauthFlow',
          where: [{ field: 'id', value: row.id }],
          update: { state: `used:${b64url(16)}` },
        })

        let idToken: string | undefined
        let accessToken: string | undefined
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
            access_token?: string
            error?: string
          }
          if (!tokenRes.ok || !body.id_token) {
            // Deliberately no detail in the page — Google's error text can echo request material.
            console.error('[auth] google token exchange failed', tokenRes.status, body.error)
            return htmlResponse(callbackHtml('Login mislykkedes. Prøv igen i appen.', false), 400)
          }
          idToken = body.id_token
          accessToken = body.access_token
        } catch (e) {
          console.error('[auth] google token exchange threw', e)
          return htmlResponse(callbackHtml('Login mislykkedes. Prøv igen i appen.', false), 500)
        }

        let sessionToken: string | null
        try {
          sessionToken = await signInWithIdToken(idToken, accessToken)
        } catch (e) {
          // The allowlist hook (§4.8) throws FORBIDDEN here for a non-permitted address — the single
          // most important refusal in the whole design, since nothing else stops a stranger from
          // legitimately burning Azure and Google quota.
          const forbidden = e instanceof APIError && e.status === 'FORBIDDEN'
          if (!forbidden) console.error('[auth] signInSocial(idToken) failed', e)
          return htmlResponse(
            callbackHtml(
              forbidden ? 'Denne konto har ikke adgang til Børnelæring.' : 'Login mislykkedes. Prøv igen i appen.',
              false,
            ),
            forbidden ? 403 : 500,
          )
        }
        if (!sessionToken) {
          return htmlResponse(callbackHtml('Login mislykkedes. Prøv igen i appen.', false), 500)
        }

        await adapter.update({
          model: 'oauthFlow',
          where: [{ field: 'id', value: row.id }],
          update: { sessionToken, expiresAt: new Date(now + OAUTH_CLAIM_TTL_MS) },
        })

        return htmlResponse(callbackHtml('Du er logget ind. 👍', true))
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

        const session = await ctx.context.internalAdapter.findSession(row.sessionToken)
        // Delete on successful read: the token is handed over exactly once.
        await adapter.delete({ model: 'oauthFlow', where: [{ field: 'id', value: row.id }] })
        if (!session) throw new APIError('GONE', { message: 'Sessionen findes ikke længere.' })

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
 */
async function signInWithIdToken(
  idToken: string,
  accessToken: string | undefined,
): Promise<string | null> {
  // A DYNAMIC import breaks what would otherwise be a static cycle (lib/auth.ts imports this module
  // to register the plugin). By the time this runs, lib/auth.ts is fully evaluated.
  const { auth } = await import('./auth.ts')
  const res = await auth.api.signInSocial({
    body: {
      provider: 'google',
      idToken: { token: idToken, ...(accessToken ? { accessToken } : {}) },
    },
    asResponse: true,
  })
  if (!(res instanceof Response)) return null
  return res.headers.get('set-auth-token')
}

/** Shared by the endpoints that take a 4-digit code. Kept here so both PIN routes agree. */
export const pinBodySchema = z.object({ pin: z.string().min(4).max(4) })
