// The one place a component asks "may this happen, and how do I prove it?".
//
// Everything auth-shaped that a component can DO lives here: start Google sign-in, unlock with a
// passkey, and — critically — `requirePin(reason)`, which routes a verification to the LOCAL verifier
// or to the SERVER according to a single table (accounts PRD §7.2). One table in one place is what
// stops the rule from drifting per call site.
//
// THE PRINCIPLE, stated so it survives future contributors: a LOCALLY-verified PIN may authorise
// anything whose blast radius is this device's local state; a SERVER-verified PIN is required whenever
// the outcome is a credential, a spend, or an account-scoped mutation.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { authStore } from '../services/authStore'
import { useAuth } from '../hooks/useAuth'
import type { AuthSnapshot } from '../services/authStore'
import { pinVerifierFor, type PinReason, type PinVerifier } from '../config/pinReasons.ts'

// The reason TABLE itself now lives in `src/config/pinReasons.ts` — PURE, so a plain-Node test can
// import it (`adultSettingsIa.test.ts` asserts every account-scoped destructive setting is
// server-verified, and a test that re-declares the server set would pass vacuously). The values are
// unchanged; it is re-exported here so every existing call site keeps importing it from this module.
export { pinVerifierFor }
export type { PinReason, PinVerifier }

/** How long an adult stays unlocked after proving the PIN once (§7.3). */
export const ADULT_UNLOCK_MS = 5 * 60 * 1000

export interface AuthActions {
  /** Ask the adult to prove the PIN (or Face ID) for `reason`. Resolves true when proven. */
  requirePin: (reason: PinReason) => Promise<boolean>
  /** True while the adult is inside the ~5-minute unlocked window. */
  adultUnlocked: boolean
  /** Mark the adult as freshly proven (called by the PIN dialog on success). */
  markAdultUnlocked: () => void
  /** Drop the unlocked window immediately. */
  clearAdultUnlocked: () => void
  /**
   * Whether ANY auth dialog is open. AdultCorner's hold gesture is disabled while it is true, so a
   * PIN screen can never be screenshotted into a public bug-report blob (§8.1 layer a).
   */
  authUiOpen: boolean
  setAuthUiOpen: (open: boolean) => void
}

export type AuthContextValue = AuthSnapshot & AuthActions

const AuthCtx = createContext<AuthContextValue | null>(null)

/** Registered by PinDialog's host so `requirePin` can drive it from anywhere. */
type PinPrompt = (reason: PinReason, verifier: PinVerifier) => Promise<boolean>
let pinPrompt: PinPrompt | null = null

export function registerPinPrompt(fn: PinPrompt | null): void {
  pinPrompt = fn
}

/**
 * The GUEST parental gate (App Store PRD §3.2 / A1) — registered by the same host as the PIN dialog.
 *
 * A guest has no account, so there is no PIN and no server to check one against: `requirePin` would
 * route to the LOCAL verifier, find nothing cached (it is only written after an ONLINE verify), fall
 * through to the server, and fail — locking a guest out of "Til de voksne" entirely. The account-less
 * equivalent is an arithmetic challenge, which is also what Apple's Kids Category means by a parental
 * gate ("adult-level tasks"). See `src/config/guestAdultGate.ts`.
 */
type GuestPrompt = () => Promise<boolean>
let guestPrompt: GuestPrompt | null = null

export function registerGuestAdultPrompt(fn: GuestPrompt | null): void {
  guestPrompt = fn
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const snapshot = useAuth()
  const [authUiOpen, setAuthUiOpen] = useState(false)
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    authStore.boot()
  }, [])

  const clearAdultUnlocked = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setUnlockedAt(null)
  }, [])

  const markAdultUnlocked = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setUnlockedAt(Date.now())
    timerRef.current = setTimeout(() => setUnlockedAt(null), ADULT_UNLOCK_MS)
  }, [])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const adultUnlocked = unlockedAt != null && Date.now() - unlockedAt < ADULT_UNLOCK_MS

  const requirePin = useCallback(
    async (reason: PinReason): Promise<boolean> => {
      // The dev bypass exists so `ui-screenshot` can drive the adult surfaces headlessly.
      if (authStore.isDevBypass()) return true

      // GUEST: no account ⇒ no PIN to prove. The arithmetic gate stands in, and the same ~5-minute
      // unlock window applies so an adult adjusting two settings is not asked twice. Everything a guest
      // can actually reach is device-local by definition (there is no credential, no spend and no
      // account-scoped mutation without an account), so this cannot downgrade a server-verified action
      // — the reasons that demand the server are unreachable in this phase.
      if (snapshot.phase === 'guest') {
        if (adultUnlocked) return true
        if (!guestPrompt) return false
        const ok = await guestPrompt()
        if (ok) markAdultUnlocked()
        return ok
      }

      // Already proven recently → don't re-ask for the same 5 minutes. Server-verified reasons ALWAYS
      // re-ask: a credential change or a spend is not covered by an earlier local unlock.
      const verifier = pinVerifierFor(reason, navigator.onLine)
      if (verifier === 'local' && adultUnlocked) return true
      if (!pinPrompt) return false
      const ok = await pinPrompt(reason, verifier)
      if (ok && verifier === 'local') markAdultUnlocked()
      return ok
    },
    [adultUnlocked, markAdultUnlocked, snapshot.phase],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      ...snapshot,
      requirePin,
      adultUnlocked,
      markAdultUnlocked,
      clearAdultUnlocked,
      authUiOpen,
      setAuthUiOpen,
    }),
    [snapshot, requirePin, adultUnlocked, markAdultUnlocked, clearAdultUnlocked, authUiOpen],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

/**
 * Never throws when the provider is absent — the DEV screenshot routes and the audit harness mount
 * pieces of the app outside it, and a hard throw there would be a crash instead of a missing gate.
 */
export function useAuthContext(): AuthContextValue | null {
  return useContext(AuthCtx)
}
