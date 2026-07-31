// The client-side account/session singleton: the stored session token, the in-memory access JWT, and
// the server verdict that drives the gate.
//
// Mirrors progressStore's discipline exactly — synchronous localStorage hydration, try/catch around
// every storage access, a tiny subscribe model, and NO boot spinner. The gate must never block first
// paint or require a fetch on resume (accounts PRD §4.7), so `boot()` renders optimistically from
// whatever is on disk and validates in the background.
//
// TRANSPORT: a bearer token in localStorage, not a cookie (§4.4). Three independent reasons, not one:
// an installed iOS PWA has its own storage jar; with bearer transport an OAuth *redirect* has no
// response body the SPA can read (so a handoff artefact is structurally required, not a hedge); and
// multi-Set-Cookie correctness through @vercel/node's web-handler depends on an undici special case.
// Accepted trade-off: localStorage is more XSS-exposed than httpOnly. The app has no user-generated
// content, no third-party scripts and no analytics, and W11 adds a CSP. The ACCESS JWT is held in
// memory only — one extra mint per reload, one fewer secret at rest.

import { ACCOUNT_KEY } from '../config/progressSchema'
import {
  authGateDecision,
  DEFAULT_GRACE_MS,
  type AuthPhase,
  type ServerVerdict,
} from '../contexts/authGatePolicy'
import { devNoAuth } from '../utils/devHarness'
import { dropLocalVerifier, dropStaleVerifier } from './pinVerifier'
import { forgetSecret, registerSecret } from './redact'
import type { PasskeyRequestOptions } from './authSignIn'

export interface AccountUser {
  id: string
  /** Kept only to show "logget ind som …" in the adult menu. NEVER put this in a bug report. */
  email?: string
  name?: string
}

export interface AuthMethodInfo {
  methods: string[]
  hasPin: boolean
  pinUpdatedAt: number | null
  passkeyCount: number
  webauthnEnabled: boolean
}

/** What survives a reload (localStorage key `bornelaering-account`). */
interface StoredAccount {
  token: string
  user: AccountUser | null
  lastVerifiedAt: number | null
  status?: AuthMethodInfo | null
}

export interface AuthSnapshot {
  phase: AuthPhase
  canPlay: boolean
  canCallPaidApis: boolean
  user: AccountUser | null
  hasToken: boolean
  serverVerdict: ServerVerdict
  lastVerifiedAt: number | null
  /** From /family/status — which sign-in buttons this device can offer. */
  info: AuthMethodInfo | null
  /** Set while a sign-in attempt is in flight, so the lock screen can say "Venter på Google…". */
  busy: string | null
  error: string | null
}

const ACCESS_TOKEN_PATH = '/api/auth/family/access-token'
const GET_SESSION_PATH = '/api/auth/get-session'
const STATUS_PATH = '/api/auth/family/status'

/** Re-mint a little before the real expiry so a call never races the boundary. */
const ACCESS_TOKEN_SKEW_MS = 60_000

type Listener = () => void

function readStored(): StoredAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredAccount>
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token) return null
    return {
      token: parsed.token,
      user: (parsed.user as AccountUser | null) ?? null,
      lastVerifiedAt:
        typeof parsed.lastVerifiedAt === 'number' ? parsed.lastVerifiedAt : null,
      status: (parsed.status as AuthMethodInfo | null) ?? null,
    }
  } catch {
    return null
  }
}

class AuthStore {
  private token: string | null = null
  private user: AccountUser | null = null
  private lastVerifiedAt: number | null = null
  private info: AuthMethodInfo | null = null
  private verdict: ServerVerdict = 'unknown'
  private lockedByAdult = false
  private busy: string | null = null
  private error: string | null = null

  /** In MEMORY only, deliberately. `expiresAt` is derived from the RELATIVE expiresIn we were told. */
  private access: { token: string; expiresAt: number } | null = null
  private accessInFlight: Promise<string | null> | null = null

  private listeners = new Set<Listener>()
  private snapshot: AuthSnapshot
  private booted = false
  private devBypass = false

  constructor() {
    this.snapshot = this.computeSnapshot()
  }

  // ----- boot / hydration ------------------------------------------------------------------------

  /**
   * Synchronous hydration + background validation. Safe to call more than once (StrictMode
   * double-invokes effects).
   */
  boot(): void {
    if (this.booted) return
    this.booted = true
    this.devBypass = detectDevBypass()

    const stored = readStored()
    if (stored) {
      this.token = stored.token
      this.user = stored.user
      this.lastVerifiedAt = stored.lastVerifiedAt
      this.info = stored.status ?? null
      registerSecret(this.token)
    }
    this.publish()

    if (typeof window !== 'undefined') {
      // Recovery: both events self-heal the moment wi-fi returns, with no reload. NB timers are
      // throttled in a backgrounded PWA, so visibility is the reliable trigger — not an interval.
      window.addEventListener('online', () => void this.validate())
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.validate()
      })
      // Another tab signed out or switched account → follow it.
      window.addEventListener('storage', (e) => {
        if (e.key !== ACCOUNT_KEY) return
        const next = readStored()
        if (!next) {
          this.clearLocal('invalid')
        } else if (next.token !== this.token) {
          this.token = next.token
          this.user = next.user
          this.lastVerifiedAt = next.lastVerifiedAt
          this.info = next.status ?? null
          this.access = null
          registerSecret(this.token)
          this.verdict = 'unknown'
          this.publish()
        }
      })
    }

    if (this.token) {
      // In PARALLEL, not sequentially: pre-minting the access token here means the child's first tap
      // doesn't pay an extra round trip before narration.
      void this.validate()
      void this.getAccessToken()
    }
  }

  // ----- reads -----------------------------------------------------------------------------------

  get(): AuthSnapshot {
    return this.snapshot
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  sessionToken(): string | null {
    return this.token
  }

  isDevBypass(): boolean {
    return this.devBypass
  }

  // ----- session lifecycle -----------------------------------------------------------------------

  /** Adopt a freshly obtained session token (Google claim, passkey unlock). */
  adoptSession(token: string, user: AccountUser | null): void {
    if (this.token && this.token !== token) forgetSecret(this.token)
    this.token = token
    this.user = user
    this.lastVerifiedAt = Date.now()
    this.verdict = 'valid'
    this.lockedByAdult = false
    this.error = null
    this.busy = null
    this.access = null
    registerSecret(token)
    this.persist()
    this.publish()
    void this.refreshStatus()
    void this.getAccessToken()
  }

  /** An adult chose to lock, or a profile switch needs re-proving. Keeps the session. */
  lock(): void {
    if (!this.token) return
    this.lockedByAdult = true
    this.publish()
  }

  unlock(): void {
    if (!this.lockedByAdult) return
    this.lockedByAdult = false
    this.publish()
  }

  isLocked(): boolean {
    return this.lockedByAdult
  }

  /** Full sign-out. Tells the server too, best-effort — a dead network must not trap the adult. */
  async signOut(): Promise<void> {
    const token = this.token
    this.clearLocal('invalid')
    if (!token) return
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
    } catch {
      /* offline sign-out is still a local sign-out */
    }
  }

  private clearLocal(verdict: ServerVerdict): void {
    if (this.token) forgetSecret(this.token)
    if (this.access) forgetSecret(this.access.token)
    this.token = null
    this.user = null
    this.lastVerifiedAt = null
    this.info = null
    this.access = null
    this.lockedByAdult = false
    this.verdict = verdict
    // The cached local PIN verifier belongs to a SESSION on this device. A sign-out (or a revoked
    // session) must not leave an offline-usable adult gate behind for the next person.
    dropLocalVerifier()
    try {
      localStorage.removeItem(ACCOUNT_KEY)
    } catch {
      /* private mode */
    }
    this.publish()
  }

  /**
   * Ask the server whether our session is still real.
   *
   * The verdict mapping is the whole point (§4.7): a 401/403 is `invalid` and signs out IMMEDIATELY,
   * ignoring grace, because that is the revocation path. A fetch that THREW is `unreachable` —
   * never `invalid` — because a flaky network must not log a family out of their own iPad.
   */
  async validate(): Promise<ServerVerdict> {
    if (!this.token) {
      this.verdict = 'unknown'
      this.publish()
      return 'unknown'
    }
    try {
      const res = await fetch(GET_SESSION_PATH, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (res.status === 401 || res.status === 403) {
        this.clearLocal('invalid')
        return 'invalid'
      }
      if (!res.ok) {
        // A 5xx is the SERVER being unhappy, not our session being revoked.
        this.verdict = 'unreachable'
        this.publish()
        return 'unreachable'
      }
      const data = (await res.json()) as { user?: AccountUser; session?: unknown } | null
      if (!data?.user) {
        this.clearLocal('invalid')
        return 'invalid'
      }
      this.user = { id: data.user.id, email: data.user.email, name: data.user.name }
      this.lastVerifiedAt = Date.now()
      this.verdict = 'valid'
      this.persist()
      this.publish()
      void this.refreshStatus()
      return 'valid'
    } catch {
      this.verdict = 'unreachable'
      this.publish()
      return 'unreachable'
    }
  }

  /** /family/status: which methods exist, and the cross-device PIN-change signal. */
  async refreshStatus(): Promise<AuthMethodInfo | null> {
    if (!this.token) return null
    try {
      const res = await fetch(STATUS_PATH, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (!res.ok) return this.info
      const data = (await res.json()) as Partial<AuthMethodInfo>
      this.info = {
        methods: Array.isArray(data.methods) ? data.methods : ['google'],
        hasPin: data.hasPin === true,
        pinUpdatedAt: typeof data.pinUpdatedAt === 'number' ? data.pinUpdatedAt : null,
        passkeyCount: typeof data.passkeyCount === 'number' ? data.passkeyCount : 0,
        webauthnEnabled: data.webauthnEnabled === true,
      }
      // CROSS-DEVICE PIN CHANGE: if the server's PIN is newer than the one this device cached a
      // verifier for, drop that cache so the next adult-gate open forces an online verify. Without
      // this, a PIN changed on the iPhone leaves the iPad honouring the old one indefinitely (§7.2).
      dropStaleVerifier(this.info.pinUpdatedAt)
      this.persist()
      this.publish()
      return this.info
    } catch {
      return this.info
    }
  }

  // ----- PIN (server-authoritative) --------------------------------------------------------------

  /**
   * Server-verified PIN check. `pin_attempt` in Postgres is the authority — the local counter is
   * best-effort only. Returns the Danish message the PIN pad shows, so the routing lives in one place.
   */
  async verifyPinOnServer(pin: string): Promise<{
    ok: boolean
    pinUpdatedAt?: number
    message?: string
  }> {
    if (!this.token) return { ok: false, message: 'Ingen forbindelse til kontoen.' }
    try {
      const res = await fetch('/api/auth/family/pin/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; pinUpdatedAt?: number; message?: string; attemptsLeft?: number; lockedUntil?: number | null }
        | null
      if (res.ok && body?.ok) {
        void this.refreshStatus()
        return { ok: true, pinUpdatedAt: body.pinUpdatedAt }
      }
      if (res.status === 429 || res.status === 423) {
        return { ok: false, message: body?.message ?? 'For mange forsøg. Prøv igen senere.' }
      }
      const left = typeof body?.attemptsLeft === 'number' ? body.attemptsLeft : null
      return {
        ok: false,
        message:
          left != null
            ? `Koden er ikke rigtig. ${left} forsøg tilbage.`
            : body?.message ?? 'Koden er ikke rigtig.',
      }
    } catch {
      // Offline with no local verifier: say so plainly rather than reporting a wrong PIN.
      return { ok: false, message: 'Ingen forbindelse. Prøv igen når du er på nettet.' }
    }
  }

  /** Set or change the PIN. `currentPin` is required (and server-verified) when one already exists. */
  async setPin(
    pin: string,
    currentPin?: string,
  ): Promise<{ ok: boolean; pinUpdatedAt?: number; message?: string }> {
    if (!this.token) return { ok: false, message: 'Ingen forbindelse til kontoen.' }
    try {
      const res = await fetch('/api/auth/family/pin/set', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPin ? { pin, currentPin } : { pin }),
      })
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; pinUpdatedAt?: number; message?: string }
        | null
      if (res.ok && body?.ok) {
        await this.refreshStatus()
        return { ok: true, pinUpdatedAt: body.pinUpdatedAt }
      }
      return { ok: false, message: body?.message ?? 'Koden kunne ikke gemmes.' }
    } catch {
      return { ok: false, message: 'Ingen forbindelse. Prøv igen når du er på nettet.' }
    }
  }

  /**
   * PRE-FETCH the WebAuthn request options.
   *
   * The lock screen calls this on mount and every ~4 minutes, NOT at tap time: iOS consumes the
   * transient user activation across an `await`, so `navigator.credentials.get()` must run in the same
   * task as the tap (§9). A stale challenge is a clean, retryable error, which is what makes
   * pre-fetching safe. Returns null when passkeys aren't available here (e.g. a preview deployment).
   */
  async fetchPasskeyRequestOptions(): Promise<PasskeyRequestOptions | null> {
    try {
      const res = await fetch('/api/auth/passkey/generate-authenticate-options', {
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      })
      if (!res.ok) return null
      const options = (await res.json()) as PasskeyRequestOptions['options']
      if (!options?.challenge) return null
      return { fetchedAt: Date.now(), options }
    } catch {
      return null
    }
  }

  // ----- the access JWT --------------------------------------------------------------------------

  /**
   * The token the PAID endpoints require. Cached in memory until shortly before expiry, and minted
   * LAZILY BEFORE USE rather than on an interval — timers are throttled in a backgrounded PWA, so an
   * interval-based refresh silently stops working when the iPad sleeps (§9).
   */
  async getAccessToken(force = false): Promise<string | null> {
    if (this.devBypass) return null
    if (!this.token) return null
    const now = Date.now()
    if (!force && this.access && this.access.expiresAt - ACCESS_TOKEN_SKEW_MS > now) {
      return this.access.token
    }
    if (this.accessInFlight) return this.accessInFlight

    this.accessInFlight = (async () => {
      try {
        const res = await fetch(ACCESS_TOKEN_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          body: '{}',
        })
        if (res.status === 401 || res.status === 403) {
          this.clearLocal('invalid')
          return null
        }
        if (!res.ok) return null
        const data = (await res.json()) as { token?: string; expiresIn?: number }
        if (typeof data.token !== 'string' || !data.token) return null
        // expiresIn is RELATIVE seconds — we never compare our clock against the server's.
        const ttlMs = Math.max(30, Number(data.expiresIn) || 900) * 1000
        if (this.access) forgetSecret(this.access.token)
        this.access = { token: data.token, expiresAt: Date.now() + ttlMs }
        registerSecret(data.token)
        return data.token
      } catch {
        return null
      } finally {
        this.accessInFlight = null
      }
    })()
    return this.accessInFlight
  }

  /** Drop the cached access token (used by authorizedFetch's single mint-and-retry). */
  invalidateAccessToken(): void {
    if (this.access) forgetSecret(this.access.token)
    this.access = null
  }

  setBusy(label: string | null): void {
    this.busy = label
    this.publish()
  }

  setError(message: string | null): void {
    this.error = message
    this.busy = null
    this.publish()
  }

  // ----- internals -------------------------------------------------------------------------------

  private persist(): void {
    if (!this.token) return
    try {
      const doc: StoredAccount = {
        token: this.token,
        user: this.user,
        lastVerifiedAt: this.lastVerifiedAt,
        status: this.info,
      }
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(doc))
    } catch {
      /* quota / private mode — the session then lasts only this page load */
    }
  }

  private computeSnapshot(): AuthSnapshot {
    const decision = authGateDecision({
      hasStoredToken: !!this.token,
      serverVerdict: this.verdict,
      lastVerifiedAt: this.lastVerifiedAt,
      now: Date.now(),
      graceMs: DEFAULT_GRACE_MS,
      lockedByAdult: this.lockedByAdult,
      idleSinceMs: 0,
      devBypass: this.devBypass,
    })
    return {
      ...decision,
      user: this.user,
      hasToken: !!this.token,
      serverVerdict: this.verdict,
      lastVerifiedAt: this.lastVerifiedAt,
      info: this.info,
      busy: this.busy,
      error: this.error,
    }
  }

  private publish(): void {
    // A NEW object each time so useSyncExternalStore sees the change; the whole snapshot is cheap.
    this.snapshot = this.computeSnapshot()
    this.listeners.forEach((l) => l())
  }
}

/** DEV-only bypass — one source of truth in devHarness, so the screenshot recipes can't drift. */
function detectDevBypass(): boolean {
  try {
    return devNoAuth()
  } catch {
    return false
  }
}

export const authStore = new AuthStore()

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __auth?: AuthStore }).__auth = authStore
}
