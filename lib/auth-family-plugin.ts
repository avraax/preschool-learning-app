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
  },
})

/** Shared by the endpoints that take a 4-digit code. Kept here so both PIN routes agree. */
export const pinBodySchema = z.object({ pin: z.string().min(4).max(4) })
