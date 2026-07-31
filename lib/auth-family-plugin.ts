// Our own endpoints, as a better-auth PLUGIN rather than as separate Vercel functions.
//
// That choice buys four things at once (accounts PRD §4.3): DB-backed rate limiting shared across
// instances, session resolution for free via `sessionMiddleware`, schema generation for our tables in
// the SAME migration as better-auth's own, and ONE cold start for the whole auth surface.
//
// Explicit `.ts` extensions throughout — dev-server.js loads this graph through Node type-stripping.

import { createAuthEndpoint, sessionMiddleware, APIError } from 'better-auth/api'
import type { BetterAuthPlugin } from 'better-auth'
import * as z from 'zod'
import { signAccessToken } from './access-token.ts'
import { webauthn } from './env.ts'
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
  },
})

/** Shared by the endpoints that take a 4-digit code. Kept here so both PIN routes agree. */
export const pinBodySchema = z.object({ pin: z.string().min(4).max(4) })
