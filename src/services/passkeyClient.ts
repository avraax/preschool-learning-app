// Passkey register + unlock, shaped so the iOS user-activation rule cannot be violated by accident.
//
// THE RULE (accounts PRD §9, the same one already burned into .claude/rules/audio-system.md for audio
// unlock): iOS consumes the transient user activation across an `await`, so
// `navigator.credentials.create()/get()` called after one silently fails. Therefore:
//
//   * options are FETCHED AHEAD OF TIME (on mount, refreshed every ~4 min) and passed IN,
//   * the two entry points are NON-async functions that reach the WebAuthn call with no `await`
//     before it, so the type system enforces the ordering rather than a comment,
//   * a stale challenge is a clean, retryable error — which is what makes pre-fetching safe.
//
// This is also why we do NOT use better-auth's own passkey client helpers: `authClient.passkey
// .addPasskey()` and `signIn.passkey()` fetch the options and THEN call navigator.credentials.*,
// i.e. exactly the pattern that fails. And `@simplewebauthn/browser`'s `startAuthentication` is
// gesture-safe ONLY with `useBrowserAutofill: false` — autofill mode awaits
// browserSupportsWebAuthnAutofill() before get().

import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser'
import { authStore, type AccountUser } from './authStore'
import { adoptSignedInSession, type PasskeyRequestOptions, type SignInResult } from './authSignIn'

const REGISTER_OPTIONS_PATH = '/api/auth/passkey/generate-register-options'
const VERIFY_REGISTRATION_PATH = '/api/auth/passkey/verify-registration'
const VERIFY_AUTHENTICATION_PATH = '/api/auth/passkey/verify-authentication'

/**
 * Map a WebAuthn failure to Danish adult copy. `NotAllowedError` covers both "the adult cancelled"
 * and "the challenge went stale", so it must not read as a scary failure.
 */
function danishError(e: unknown): string {
  const name = e instanceof Error ? e.name : ''
  const message = e instanceof Error ? e.message : ''
  if (name === 'NotAllowedError') return 'Face ID blev afbrudt. Prøv igen.'
  if (name === 'InvalidStateError') return 'Denne enhed er allerede tilføjet.'
  // The WebAuthn system sheet fails outright if the iPad has no passcode/biometrics set up — say so
  // rather than crashing or showing a generic error (§9).
  if (name === 'NotSupportedError' || name === 'SecurityError') {
    return 'Face ID kan ikke bruges her. Tjek at iPad’en har en kode og Face ID slået til.'
  }
  if (/AbortError/.test(name)) return 'Face ID blev afbrudt. Prøv igen.'
  return message ? `Face ID mislykkedes: ${message}` : 'Face ID mislykkedes. Prøv igen.'
}

// ----- registration (requires a live session) ---------------------------------------------------

export interface PasskeyRegisterOptions {
  fetchedAt: number
  options: PublicKeyCredentialCreationOptionsJSON
}

/**
 * PRE-FETCH the creation options. Call this on mount of the "add Face ID" screen, NOT in the tap
 * handler. `authenticatorAttachment=platform` keeps us on Face ID / Touch ID.
 */
export async function fetchPasskeyRegisterOptions(
  deviceName: string,
): Promise<PasskeyRegisterOptions | null> {
  const token = authStore.sessionToken()
  if (!token) return null
  try {
    const url = `${REGISTER_OPTIONS_PATH}?authenticatorAttachment=platform&name=${encodeURIComponent(deviceName)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const options = (await res.json()) as PublicKeyCredentialCreationOptionsJSON
    if (!options?.challenge) return null
    return { fetchedAt: Date.now(), options }
  } catch {
    return null
  }
}

/**
 * NON-async by design: `startRegistration` is reached with no `await` before it, so the tap's user
 * activation is still live when the system sheet opens.
 */
export function registerPasskey(
  pre: PasskeyRegisterOptions | null,
  deviceName?: string,
): Promise<SignInResult> {
  if (!pre) return Promise.resolve({ ok: false, message: 'Face ID er ikke klar. Prøv igen.' })
  const token = authStore.sessionToken()
  if (!token) return Promise.resolve({ ok: false, message: 'Du er ikke logget ind.' })

  return startRegistration({ optionsJSON: pre.options })
    .then(async (response: RegistrationResponseJSON) => {
      const res = await fetch(VERIFY_REGISTRATION_PATH, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // The label is stored from the VERIFY call, not from the options fetch — passing `name` only
        // on generate-register-options leaves the row's name null.
        body: JSON.stringify(deviceName ? { response, name: deviceName } : { response }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        return { ok: false, message: body?.message ?? 'Face ID kunne ikke gemmes.' }
      }
      // FORCED past the throttle: `passkeyCount` just went from 0 to 1, and that is what makes the lock
      // screen offer Face ID at all.
      await authStore.refreshStatus(true)
      return { ok: true }
    })
    .catch((e: unknown) => ({ ok: false, message: danishError(e) }))
}

// ----- unlock (no session required — the credential is discoverable) ----------------------------

/**
 * NON-async by design, same reason as above. `useBrowserAutofill: false` is mandatory: autofill mode
 * awaits `browserSupportsWebAuthnAutofill()` before `get()`, which spends the gesture.
 */
export function unlockWithPasskey(pre: PasskeyRequestOptions | null): Promise<SignInResult> {
  if (!pre) return Promise.resolve({ ok: false, message: 'Face ID er ikke klar. Prøv igen.' })

  return startAuthentication({ optionsJSON: pre.options, useBrowserAutofill: false })
    .then(async (response: AuthenticationResponseJSON) => {
      const res = await fetch(VERIFY_AUTHENTICATION_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        return { ok: false, message: body?.message ?? 'Face ID blev ikke godkendt.' }
      }
      // The bearer plugin hands the new session token back in a RESPONSE HEADER, never a cookie.
      const token = res.headers.get('set-auth-token')
      const body = (await res.json().catch(() => null)) as { user?: AccountUser } | null
      if (!token) return { ok: false, message: 'Kunne ikke starte en session. Prøv Google i stedet.' }
      adoptSignedInSession(token, body?.user ?? null)
      return { ok: true }
    })
    .catch((e: unknown) => ({ ok: false, message: danishError(e) }))
}

/** True when this browser can do platform WebAuthn at all. Safe to await — it is not in a gesture. */
export async function passkeysUsableHere(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false
    const fn = (
      window.PublicKeyCredential as unknown as {
        isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
      }
    ).isUserVerifyingPlatformAuthenticatorAvailable
    return typeof fn === 'function' ? await fn.call(window.PublicKeyCredential) : false
  } catch {
    return false
  }
}
