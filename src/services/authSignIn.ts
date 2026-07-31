// The two sign-in entry points the lock screen drives.
//
// They live outside the component so the iOS user-activation rule can be enforced by SHAPE rather
// than by discipline: `startPasskeyUnlock` is a NON-async function that takes PRE-FETCHED options,
// because iOS consumes the transient user activation across an `await` and
// `navigator.credentials.get()` after one silently fails (accounts PRD §9 / the same rule already
// burned into .claude/rules/audio-system.md for audio unlock).
//
// This is why we do NOT use better-auth's own passkey client helpers: `authClient.passkey.addPasskey()`
// and `signIn.passkey()` fetch the options and THEN call navigator.credentials.*, which is exactly the
// pattern that fails.

// Type-only, so it costs nothing at runtime — but it means the pre-fetched options we carry around
// are EXACTLY the shape @simplewebauthn/browser accepts, instead of a hand-written near-copy that
// silently drifts (e.g. `transports: string[]` vs its narrower union).
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { authStore, type AccountUser } from './authStore.ts'

export interface SignInResult {
  ok: boolean
  /** Danish, adult-facing. Shown verbatim on the lock screen. */
  message?: string
}

export const OAUTH_FLOW_KEY = 'bl-oauth-flow'
/** The fragment the callback page hands back. Carries NO secret — only "the flow finished". */
export const AUTH_FRAGMENT = 'bl_auth=1'

export interface PendingOAuthFlow {
  flowId: string
  startedAt: number
}

/** How long a started flow stays claimable on this device before we call it stale. */
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000

export function readPendingFlow(): PendingOAuthFlow | null {
  try {
    const raw = localStorage.getItem(OAUTH_FLOW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingOAuthFlow>
    if (typeof parsed?.flowId !== 'string' || !parsed.flowId) return null
    const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : 0
    if (Date.now() - startedAt > OAUTH_FLOW_TTL_MS) {
      clearPendingFlow()
      return null
    }
    return { flowId: parsed.flowId, startedAt }
  } catch {
    return null
  }
}

export function clearPendingFlow(): void {
  try {
    localStorage.removeItem(OAUTH_FLOW_KEY)
  } catch {
    /* private mode */
  }
}

// ----- Google (implemented in W7) ---------------------------------------------------------------

/**
 * Begin the cookie-free PKCE leg. Filled in by W7 — the client generates the `flowId` IN ITS OWN
 * STORAGE CONTEXT before navigating, which is the entire point of the design.
 */
export async function startGoogleSignIn(): Promise<SignInResult> {
  const impl = googleImpl
  if (!impl) {
    return { ok: false, message: 'Google-login er ikke klar på denne enhed endnu.' }
  }
  return impl()
}

let googleImpl: (() => Promise<SignInResult>) | null = null
export function registerGoogleSignIn(fn: (() => Promise<SignInResult>) | null): void {
  googleImpl = fn
}

type ClaimImpl = (flowId: string) => Promise<SignInResult>
let claimImpl: ClaimImpl | null = null
export function registerClaimPendingFlow(fn: ClaimImpl | null): void {
  claimImpl = fn
}

/**
 * Exchange the locally-held `flowId` for the session token the callback parked on the flow row.
 * Driven by OAuthReturnHandler's fast / polling / cold-boot / visibility paths; implemented in W7.
 */
export async function claimPendingFlow(flowId: string): Promise<SignInResult> {
  if (!claimImpl) return { ok: false }
  return claimImpl(flowId)
}

// ----- Passkey (implemented in W6) --------------------------------------------------------------

/** Opaque pre-fetched WebAuthn request options, refreshed on a timer while the lock screen is up. */
export interface PasskeyRequestOptions {
  fetchedAt: number
  options: PublicKeyCredentialRequestOptionsJSON
}

type PasskeyUnlockImpl = (opts: PasskeyRequestOptions) => Promise<SignInResult>
let passkeyImpl: PasskeyUnlockImpl | null = null

export function registerPasskeyUnlock(fn: PasskeyUnlockImpl | null): void {
  passkeyImpl = fn
}

/**
 * NON-async by design. Takes options that were fetched EARLIER (on mount / on a refresh tick), so the
 * `navigator.credentials.get()` inside runs in the same task as the tap and iOS still considers the
 * gesture live. Returns a promise, but does not await anything before the WebAuthn call.
 */
export function startPasskeyUnlock(opts: PasskeyRequestOptions | null): Promise<SignInResult> {
  if (!opts || !passkeyImpl) {
    return Promise.resolve({ ok: false, message: 'Face ID er ikke klar. Prøv igen.' })
  }
  return passkeyImpl(opts)
}

/** Shared by both methods once a session token is in hand. */
export function adoptSignedInSession(token: string, user: AccountUser | null): void {
  authStore.adoptSession(token, user)
}
