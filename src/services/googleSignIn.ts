// The client half of the cookie-free Google PKCE leg (accounts PRD §4.5 steps 1–3 and 6).
//
// STEP 1 IS THE WHOLE POINT: the `flowId` is generated and written into THIS context's localStorage
// BEFORE navigating away. Nothing that comes back carries a secret — only `#bl_auth=1` in the
// fragment — so an in-app browser view that loads the return URL cannot steal the session: it has no
// flowId to claim with.

import {
  clearPendingFlow,
  OAUTH_FLOW_KEY,
  registerClaimPendingFlow,
  registerGoogleSignIn,
  type SignInResult,
} from './authSignIn'
import { authStore, type AccountUser } from './authStore'
import { registerSecret } from './redact'

const START_PATH = '/api/auth/family/oauth/start'
const CLAIM_PATH = '/api/auth/family/oauth/claim'

function newFlowId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function startGoogle(): Promise<SignInResult> {
  const flowId = newFlowId()
  try {
    // Write FIRST, in our own storage context. If we navigated before this landed there would be
    // nothing to claim with when we came back.
    localStorage.setItem(OAUTH_FLOW_KEY, JSON.stringify({ flowId, startedAt: Date.now() }))
  } catch {
    return {
      ok: false,
      message: 'Kan ikke gemme login på denne enhed. Slå privat browsing fra og prøv igen.',
    }
  }
  // The flowId is a live credential for ~10 minutes — never let it reach a console line or a report.
  registerSecret(flowId)

  try {
    const res = await fetch(START_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId }),
    })
    if (!res.ok) {
      clearPendingFlow()
      return { ok: false, message: 'Kunne ikke starte Google-login. Prøv igen.' }
    }
    const { authorizeUrl } = (await res.json()) as { authorizeUrl?: string }
    if (!authorizeUrl) {
      clearPendingFlow()
      return { ok: false, message: 'Kunne ikke starte Google-login. Prøv igen.' }
    }

    // ALWAYS location.assign, NEVER window.open: in standalone (installed-PWA) mode a popup can
    // escape to Safari and lose the return path entirely (§9). It is also popup-blocker-proof as a
    // bonus, and navigation needs no user activation — so the `await` above is harmless.
    window.location.assign(authorizeUrl)
    // The lock screen switches to "Venter på Google…" and starts polling; we never resolve "ok" here.
    return { ok: true }
  } catch {
    clearPendingFlow()
    return { ok: false, message: 'Ingen forbindelse. Prøv igen når du er på nettet.' }
  }
}

async function claim(flowId: string): Promise<SignInResult> {
  try {
    const res = await fetch(CLAIM_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId }),
    })
    if (res.status === 404 || res.status === 410) {
      // Expired, already claimed, or never existed → stop polling and let the adult retry cleanly.
      clearPendingFlow()
      authStore.setError('Login-forsøget udløb. Prøv igen.')
      return { ok: false }
    }
    if (!res.ok) return { ok: false }

    const body = (await res.json()) as
      | { status: 'pending' }
      | { token: string; user: AccountUser }
    // Still on Google's consent screen — the expected answer for most polls.
    if ('status' in body && body.status === 'pending') return { ok: false }
    if (!('token' in body) || !body.token) return { ok: false }

    clearPendingFlow()
    authStore.adoptSession(body.token, body.user ?? null)
    return { ok: true }
  } catch {
    // A network blip mid-poll is not a failure; the next tick tries again.
    return { ok: false }
  }
}

registerGoogleSignIn(startGoogle)
registerClaimPendingFlow(claim)
