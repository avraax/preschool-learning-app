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

import { ACCOUNT_KEY } from '../config/progressSchema.ts'
import {
  authGateDecision,
  DEFAULT_GRACE_MS,
  type AuthPhase,
  type ServerVerdict,
} from '../contexts/authGatePolicy.ts'
import { devNoAuth } from '../utils/devHarness.ts'
import {
  enterGuestMode,
  exitGuestMode,
  guestModeActive,
  noteSignedIn,
  shouldAutoGuest,
} from '../utils/guestMode.ts'
import { dropLocalVerifier, dropStaleVerifier } from './pinVerifier.ts'
import { forgetSecret, registerSecret } from './redact.ts'
import type { PasskeyRequestOptions } from './authSignIn.ts'

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

/**
 * RESUME BUDGET. `visibilitychange:visible` fires on every app switch on an iPad, and it used to cost
 * a `/get-session` + a `/family/status` + two localStorage writes + a full re-render of everything
 * under the gate — every single time. None of that is free on the oldest device we support, and none
 * of it is useful twice in a minute: session revocation is bounded by the 15-minute access JWT, not by
 * how eagerly we poll.
 */
const VALIDATE_MIN_INTERVAL_MS = 60_000
const STATUS_MIN_INTERVAL_MS = 5 * 60_000
const PERSIST_MIN_INTERVAL_MS = 60_000

type Listener = () => void

/**
 * Is this snapshot materially different from that one? Used to drop a publish that would re-render the
 * whole app for nothing.
 *
 * `lastVerifiedAt` is DELIBERATELY EXCLUDED: it changes on every successful validate, so including it
 * would make every comparison unequal and defeat the whole guard. It is rendered in exactly one place
 * — the "Sidst bekræftet …" line on the offlineExpired lock screen — and the transition INTO that phase
 * changes `phase`, which does force a publish carrying the current value.
 */
function sameSnapshot(a: AuthSnapshot, b: AuthSnapshot): boolean {
  return (
    a.phase === b.phase &&
    a.canPlay === b.canPlay &&
    a.canCallPaidApis === b.canCallPaidApis &&
    a.hasToken === b.hasToken &&
    a.serverVerdict === b.serverVerdict &&
    a.busy === b.busy &&
    a.error === b.error &&
    a.user?.id === b.user?.id &&
    a.user?.email === b.user?.email &&
    a.user?.name === b.user?.name &&
    sameInfo(a.info, b.info)
  )
}

function sameInfo(a: AuthMethodInfo | null, b: AuthMethodInfo | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.hasPin === b.hasPin &&
    a.pinUpdatedAt === b.pinUpdatedAt &&
    a.passkeyCount === b.passkeyCount &&
    a.webauthnEnabled === b.webauthnEnabled &&
    a.methods.length === b.methods.length &&
    a.methods.every((m, i) => m === b.methods[i])
  )
}

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
  /**
   * Fired by `clearLocal()`, i.e. on BOTH sign-out paths — the adult's own, and the server telling us
   * with a 401 that the session is revoked. profileStore subscribes here so the child is detached and
   * the cached roster dropped; it cannot be called directly because profileStore imports THIS module.
   */
  private signOutListeners = new Set<Listener>()
  private snapshot: AuthSnapshot
  private booted = false
  private devBypass = false

  private validateInFlight: Promise<ServerVerdict> | null = null
  private statusInFlight: Promise<AuthMethodInfo | null> | null = null
  private lastValidateAt = 0
  private lastStatusAt = 0
  private lastPersistAt = 0

  constructor() {
    // AUTO-GUEST, decided here and NOT in `boot()` (A1). `boot()` runs from an effect, i.e. after the
    // first paint, so deciding there would flash the lock screen for one frame on the single launch
    // where that matters most: a brand-new install, which is exactly what an App Review reviewer sees.
    // The constructor runs at module import, before React — the same synchronous-hydration discipline
    // as the stored session itself.
    if (shouldAutoGuest() && !readStored()) enterGuestMode()
    this.snapshot = this.computeSnapshot()
  }

  /**
   * "Spil uden konto" on the lock screen. Only offered from `signedOut`, i.e. with no stored token —
   * `locked` and `offlineExpired` still HOLD a session, and letting guest win there would trade an
   * adult's real account (and the child's synced book) for a fresh empty one.
   */
  playAsGuest(): void {
    if (this.token) return
    enterGuestMode()
    this.verdict = 'unknown'
    this.error = null
    this.busy = null
    this.publish()
  }

  /** The adult signed in from guest, or wants the lock screen back. Leaves progress on disk. */
  leaveGuestMode(): void {
    exitGuestMode()
    this.publish()
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

  /** Subscribe to "this device is no longer signed in" — see `signOutListeners`. */
  onSignOut(l: Listener): () => void {
    this.signOutListeners.add(l)
    return () => {
      this.signOutListeners.delete(l)
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
    // A real session takes over from guest play, and the device records that an account has BEEN here
    // — which is what makes a later sign-out land on the lock screen instead of silently dropping the
    // child into an empty guest book (`utils/guestMode.ts`). Both sign-in paths (the Google claim and
    // a passkey unlock) funnel through here, so this is the one place it needs saying.
    exitGuestMode()
    noteSignedIn()
    this.token = token
    this.user = user
    this.lastVerifiedAt = Date.now()
    this.verdict = 'valid'
    this.lockedByAdult = false
    this.error = null
    this.busy = null
    this.access = null
    registerSecret(token)
    // A new session: force BOTH the disk write and the status refresh past their throttles. This is the
    // one moment where "which sign-in methods exist, and is there a PIN yet?" must be re-asked — the
    // mandatory PIN-setup nag hangs off that answer.
    this.lastValidateAt = Date.now()
    this.persist(true)
    this.publish()
    void this.refreshStatus(true)
    void this.getAccessToken()
  }

  /**
   * Suspend play without ending the session — the adult proves it's them and carries on.
   *
   * NO CALLER TODAY, and that is a product decision, not an oversight: the adult menu offers a plain
   * "Log ud" instead (the owner's call), so `phase: 'locked'` — and with it LockScreen's "Velkommen
   * tilbage" branch, its "Brug kode i stedet" button and `pinVerifierFor('unlockSession')` — is
   * currently unreachable. Kept because it is the mechanism a future idle auto-lock would use
   * (`authGatePolicy` already reserves `idleSinceMs` for it), and because a lock is NOT a logout: it
   * keeps the session, so it works offline where signing back in would not.
   *
   * Don't read the lock screen's locked branch as live plumbing. See `.claude/rules/auth.md`.
   */
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
    this.lastValidateAt = 0
    this.lastStatusAt = 0
    this.lastPersistAt = 0
    // The cached local PIN verifier belongs to a SESSION on this device. A sign-out (or a revoked
    // session) must not leave an offline-usable adult gate behind for the next person.
    dropLocalVerifier()
    try {
      localStorage.removeItem(ACCOUNT_KEY)
    } catch {
      /* private mode */
    }
    // BEFORE the publish, so the gate never renders a signed-out phase while a child is still attached:
    // this is what detaches progressStore and drops the cached roster + pointer. Without it the next
    // adult to sign in on this device briefly played as the PREVIOUS adult's child, reading and writing
    // that child's local book until the roster refresh pruned it.
    this.signOutListeners.forEach((l) => l())
    this.publish()
  }

  /**
   * Ask the server whether our session is still real.
   *
   * The verdict mapping is the whole point (§4.7): a 401/403 is `invalid` and signs out IMMEDIATELY,
   * ignoring grace, because that is the revocation path. A fetch that THREW is `unreachable` —
   * never `invalid` — because a flaky network must not log a family out of their own iPad.
   */
  async validate(force = false): Promise<ServerVerdict> {
    if (!this.token) {
      this.verdict = 'unknown'
      this.publish()
      return 'unknown'
    }
    // Two guards, both about the resume path (see the RESUME BUDGET note). Deduping is the important
    // one: `online` and `visibilitychange` can fire together, and two concurrent validates race each
    // other's publish for one answer.
    if (this.validateInFlight) return this.validateInFlight
    const now = Date.now()
    if (!force && this.verdict === 'valid' && now - this.lastValidateAt < VALIDATE_MIN_INTERVAL_MS) {
      return 'valid'
    }

    this.validateInFlight = this.runValidate()
    try {
      return await this.validateInFlight
    } finally {
      this.validateInFlight = null
    }
  }

  private async runValidate(): Promise<ServerVerdict> {
    try {
      const res = await fetch(GET_SESSION_PATH, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      this.lastValidateAt = Date.now()
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
      const identityChanged =
        this.user?.id !== data.user.id ||
        this.user?.email !== data.user.email ||
        this.user?.name !== data.user.name
      this.user = { id: data.user.id, email: data.user.email, name: data.user.name }
      this.lastVerifiedAt = Date.now()
      this.verdict = 'valid'
      this.persist(identityChanged)
      // No-ops when nothing changed, which on a plain resume is the normal case.
      this.publish()
      void this.refreshStatus()
      return 'valid'
    } catch {
      this.verdict = 'unreachable'
      this.publish()
      return 'unreachable'
    }
  }

  /**
   * /family/status: which methods exist, and the cross-device PIN-change signal.
   *
   * Pass `force` after anything that CHANGES the answer (a PIN set, a passkey added or removed, a fresh
   * session). Everything else — including the resume-triggered validate — takes the throttled path,
   * because a credential set that changed on another device is not urgent to the millisecond.
   */
  async refreshStatus(force = false): Promise<AuthMethodInfo | null> {
    if (!this.token) return null
    if (this.statusInFlight) return this.statusInFlight
    const now = Date.now()
    if (!force && this.info && now - this.lastStatusAt < STATUS_MIN_INTERVAL_MS) return this.info

    this.statusInFlight = this.runRefreshStatus()
    try {
      return await this.statusInFlight
    } finally {
      this.statusInFlight = null
    }
  }

  private async runRefreshStatus(): Promise<AuthMethodInfo | null> {
    try {
      const res = await fetch(STATUS_PATH, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (!res.ok) return this.info
      this.lastStatusAt = Date.now()
      const data = (await res.json()) as Partial<AuthMethodInfo>
      const next: AuthMethodInfo = {
        methods: Array.isArray(data.methods) ? data.methods : ['google'],
        hasPin: data.hasPin === true,
        pinUpdatedAt: typeof data.pinUpdatedAt === 'number' ? data.pinUpdatedAt : null,
        passkeyCount: typeof data.passkeyCount === 'number' ? data.passkeyCount : 0,
        webauthnEnabled: data.webauthnEnabled === true,
      }
      const changed = !sameInfo(this.info, next)
      this.info = next
      // CROSS-DEVICE PIN CHANGE: if the server's PIN is newer than the one this device cached a
      // verifier for, drop that cache so the next adult-gate open forces an online verify. Without
      // this, a PIN changed on the iPhone leaves the iPad honouring the old one indefinitely (§7.2).
      // Checked on EVERY answer, not only a changed one — the local cache is what goes stale, and it
      // can be older than an unchanged server value.
      dropStaleVerifier(next.pinUpdatedAt)
      // Only touch disk / re-render when the answer actually moved. On a plain app resume it does not.
      if (changed) {
        this.persist(true)
        this.publish()
      }
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
        // FORCED: `hasPin` and `pinUpdatedAt` just changed, and the mandatory setup nag is gated on
        // exactly those. A throttled refresh here would leave the nag on screen after a successful set.
        await this.refreshStatus(true)
        return { ok: true, pinUpdatedAt: body.pinUpdatedAt }
      }
      return { ok: false, message: body?.message ?? 'Koden kunne ikke gemmes.' }
    } catch {
      return { ok: false, message: 'Ingen forbindelse. Prøv igen når du er på nettet.' }
    }
  }

  /**
   * Delete the account for real (§8.4). Requires the current PIN, verified server-side under the same
   * pin_attempt lockout; ON DELETE CASCADE removes every child, book, credential and counter.
   */
  async deleteAccount(pin: string): Promise<{ ok: boolean; message?: string; fatal?: boolean }> {
    if (!this.token) return { ok: false, message: 'Ingen forbindelse til kontoen.', fatal: true }
    try {
      const res = await fetch('/api/auth/family/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      if (res.ok && body?.ok) return { ok: true }
      return { ok: false, message: body?.message ?? 'Kontoen kunne ikke slettes.', fatal: res.status >= 500 }
    } catch {
      return { ok: false, message: 'Ingen forbindelse. Prøv igen når du er på nettet.', fatal: true }
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

  /**
   * `force` for anything that changes the stored IDENTITY (a new token, a new user, new status). A
   * throttled call carries only a fresher `lastVerifiedAt`, and that timestamp starts a 30-day offline
   * grace window — being a minute stale on disk cannot matter, whereas writing it on every app resume
   * is a real cost on the oldest iPad.
   */
  private persist(force = false): void {
    if (!this.token) return
    const now = Date.now()
    if (!force && now - this.lastPersistAt < PERSIST_MIN_INTERVAL_MS) return
    try {
      const doc: StoredAccount = {
        token: this.token,
        user: this.user,
        lastVerifiedAt: this.lastVerifiedAt,
        status: this.info,
      }
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(doc))
      this.lastPersistAt = now
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
      // Read from localStorage on every snapshot rather than cached in a field: `publish()` already
      // drops a snapshot that didn't change, and a stale cached copy here would mean the gate kept
      // showing the lock screen for one render after "Spil uden konto".
      guestMode: guestModeActive(),
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

  /**
   * A NEW snapshot object whenever something changed, so useSyncExternalStore sees it — and NOTHING
   * when it didn't. AuthProvider's context value is derived from this snapshot and sits above <App />,
   * so every publish re-renders the entire app; a resume used to spend two or three of those on an
   * answer identical to the one already on screen.
   */
  private publish(): void {
    const next = this.computeSnapshot()
    if (sameSnapshot(this.snapshot, next)) return
    this.snapshot = next
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
