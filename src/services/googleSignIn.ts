// The client half of the cookie-free Google PKCE leg (accounts PRD §4.5 steps 1–3 and 6).
//
// STEP 1 IS THE WHOLE POINT: the `flowId` is generated and written into THIS context's localStorage
// BEFORE navigating away. Nothing that comes back carries a secret — only `#bl_auth=1` in the
// fragment — so an in-app browser view that loads the return URL cannot steal the session: it has no
// flowId to claim with.

import {
  clearPendingFlow,
  OAUTH_FLOW_KEY,
  readPendingFlow,
  registerClaimPendingFlow,
  registerGoogleSignIn,
  type SignInResult,
} from './authSignIn'
import { authStore, type AccountUser } from './authStore'
import { registerSecret } from './redact'
import { noteAuthStep, reportAuthFailure, resetAuthTrail } from './authDiagnostics'
import { isNativeShell } from '../config/runtimeTarget'
import { closeExternalAuth, openExternalAuthUrl } from './shellBrowser'

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
  noteAuthStep('google-start', 'begin')
  try {
    // Write FIRST, in our own storage context. If we navigated before this landed there would be
    // nothing to claim with when we came back.
    localStorage.setItem(OAUTH_FLOW_KEY, JSON.stringify({ flowId, startedAt: Date.now() }))
  } catch {
    void reportAuthFailure('google-start', 'localstorage-unavailable')
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
      void reportAuthFailure('google-start', 'start-http-error', { status: res.status })
      return { ok: false, message: 'Kunne ikke starte Google-login. Prøv igen.' }
    }
    const { authorizeUrl } = (await res.json()) as { authorizeUrl?: string }
    if (!authorizeUrl) {
      clearPendingFlow()
      void reportAuthFailure('google-start', 'no-authorize-url', { status: res.status })
      return { ok: false, message: 'Kunne ikke starte Google-login. Prøv igen.' }
    }
    noteAuthStep('google-start', 'ok', { status: res.status })

    // NATIVE SHELL: the authorize URL must NOT be loaded in the app's own webview (App Store PRD §3.3
    // / B5). Google rejects OAuth in a WKWebView with `disallowed_useragent`, so `location.assign`
    // here — the correct call on the web — is a 403 the owner cannot work around. The system browser
    // is Google's own prescribed approach.
    //
    // Nothing else about the flow changes, and that is the point: the session is claimed with the
    // `flowId` already written to THIS context's localStorage above, so the system browser never needs
    // to hand a secret back. There is therefore no deep link, no custom URL scheme and no second
    // Google client to register — the sheet's dismissal is a nudge, and the existing poll is the
    // guarantee.
    if (isNativeShell()) {
      const opened = await openExternalAuthUrl(authorizeUrl, () => {
        // Returned from the sheet. Claim NOW rather than waiting up to 3s for the next poll tick.
        const pending = readPendingFlow()
        if (pending) void claim(pending.flowId)
      })
      if (!opened) {
        clearPendingFlow()
        void reportAuthFailure('google-start', 'shell-browser-unavailable')
        return { ok: false, message: 'Kunne ikke åbne Google-login. Prøv igen.' }
      }
      return { ok: true }
    }

    // ALWAYS location.assign, NEVER window.open: in standalone (installed-PWA) mode a popup can
    // escape to Safari and lose the return path entirely (§9). It is also popup-blocker-proof as a
    // bonus, and navigation needs no user activation — so the `await` above is harmless.
    window.location.assign(authorizeUrl)
    // The lock screen switches to "Venter på Google…" and starts polling; we never resolve "ok" here.
    return { ok: true }
  } catch (e) {
    clearPendingFlow()
    void reportAuthFailure('google-start', 'start-network-error', {
      errorName: e instanceof Error ? e.name : undefined,
    })
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
      // This is a DECISIVE failure and one of the shapes the owner sees as "login didn't work", so it
      // reports rather than just setting a message.
      clearPendingFlow()
      authStore.setError('Login-forsøget udløb. Prøv igen.')
      void reportAuthFailure('google-claim', 'flow-expired-or-claimed', { status: res.status })
      return { ok: false }
    }
    if (!res.ok) {
      // A 5xx here used to be indistinguishable from a normal "still pending" poll — the loop just kept
      // going and the adult waited. Report it (deduped by stage|reason, so a 60-poll window sends one).
      void reportAuthFailure('google-claim', 'claim-http-error', { status: res.status })
      return { ok: false }
    }

    const body = (await res.json()) as
      | { status: 'pending' }
      | { token: string; user: AccountUser }
    // Still on Google's consent screen — the expected answer for most polls, and NOT a failure.
    if ('status' in body && body.status === 'pending') return { ok: false }
    if (!('token' in body) || !body.token) {
      void reportAuthFailure('google-claim', 'claim-ok-but-no-token', { status: res.status })
      return { ok: false }
    }

    clearPendingFlow()
    noteAuthStep('google-claim', 'ok', { status: res.status })
    // Dismiss the system browser BEFORE adopting the session, so the adult sees the app change state
    // rather than a sheet that lingers over an app which has already signed in. No-op off the shell.
    void closeExternalAuth()
    authStore.adoptSession(body.token, body.user ?? null)
    resetAuthTrail()
    return { ok: true }
  } catch (e) {
    // A network blip mid-poll is not a failure; the next tick tries again. Recorded, not reported.
    noteAuthStep('google-claim', 'fail', {
      note: 'poll-network-blip',
      errorName: e instanceof Error ? e.name : undefined,
    })
    return { ok: false }
  }
}

registerGoogleSignIn(startGoogle)
registerClaimPendingFlow(claim)
