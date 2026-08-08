// "Which buttons may the sign-in screens show?" — asked WITHOUT a session, on purpose.
//
// `/family/status` answers a similar question and is session-gated, which is right for what it carries
// (passkey count, PIN state) and wrong for this one: the adult who needs to know whether Apple exists
// is by definition the adult who has no account yet. Gating the Apple button on `auth.info.methods`
// hid it on the only two surfaces that can create an account — the guest Konto pane and the lock
// screen — which is the entire point of adding it (App Store Guideline 4.8).
//
// FAILS TOWARD GOOGLE. A network blip, an old deployment, a 404 — every one of them resolves to
// `['google']`, i.e. exactly what shipped before Apple existed. The failure mode is a missing button,
// never a button that cannot work.
//
// Explicit `.ts` extension on the relative import: this graph is loaded by plain-Node tests.

import { useEffect, useState } from 'react'
import { apiUrl } from '../config/apiBase.ts'

const PROVIDERS_PATH = '/api/auth/family/providers'

export type SignUpProvider = 'google' | 'apple'

const DEFAULT_PROVIDERS: SignUpProvider[] = ['google']

// Module-level memo: the answer is per-deployment, not per-user, so it cannot change within a page
// load. One request per load however many sign-in surfaces mount — the lock screen and the adult
// Konto pane both ask, and on a cold boot they can mount within a second of each other.
let inFlight: Promise<SignUpProvider[]> | null = null
let resolved: SignUpProvider[] | null = null

export function fetchSignUpProviders(): Promise<SignUpProvider[]> {
  if (resolved) return Promise.resolve(resolved)
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const res = await fetch(apiUrl(PROVIDERS_PATH))
      if (!res.ok) return DEFAULT_PROVIDERS
      const body = (await res.json()) as { providers?: unknown }
      if (!Array.isArray(body.providers)) return DEFAULT_PROVIDERS
      const list = body.providers.filter(
        (p): p is SignUpProvider => p === 'google' || p === 'apple',
      )
      // An empty or unrecognised list must not leave the adult with NO way in.
      return list.includes('google') ? list : DEFAULT_PROVIDERS
    } catch {
      return DEFAULT_PROVIDERS
    } finally {
      inFlight = null
    }
  })().then((list) => {
    resolved = list
    return list
  })
  return inFlight
}

/**
 * React binding. Starts at `['google']` so the primary button renders on the first paint rather than
 * popping in — Apple appears a moment later if this deployment has it.
 */
export function useSignUpProviders(): SignUpProvider[] {
  const [providers, setProviders] = useState<SignUpProvider[]>(resolved ?? DEFAULT_PROVIDERS)
  useEffect(() => {
    let cancelled = false
    void fetchSignUpProviders().then((list) => {
      if (!cancelled) setProviders(list)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return providers
}

/** Tests only. */
export function resetSignUpProvidersCache(): void {
  inFlight = null
  resolved = null
}
