// The LOCAL PIN verifier — what makes the adult gate work on a plane.
//
// WebCrypto PBKDF2-SHA256, 150 000 iterations, 16-byte salt, 256-bit output. Supported in Safari 17
// (our compatibility floor) and ~150 ms on an A10X iPad, which is the right cost for a gate a parent
// opens a few times a day.
//
// THE RULE that makes this safe (accounts PRD §7.2): the verifier is cached ONLY AFTER a successful
// ONLINE verify on this device. So a device gains offline adult-gate capability only once the adult has
// actually proven the PIN there — a stolen iPad with no prior unlock has nothing to attack locally.
//
// And the corollary: a locally-verified PIN may authorise anything whose blast radius is this device's
// local state (the adult menu, a per-child reset, switching profile). A credential change, a spend, or
// an account-scoped mutation always goes to the server.

import {
  clearAttempts,
  isLockedOut,
  registerFailure,
  type LockoutState,
} from '../config/pinPolicy'

const VERIFIER_KEY = 'bl-pin-verifier'
const ATTEMPTS_KEY = 'bl-pin-attempts'

const ITERATIONS = 150_000
const SALT_BYTES = 16
const KEY_BITS = 256

interface StoredVerifier {
  v: 1
  saltB64: string
  hashB64: string
  iterations: number
  /** The server's `familyPin.updatedAt` when this cache was written — the staleness signal. */
  pinUpdatedAt: number
  createdAt: number
}

const toB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

const fromB64 = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations },
    material,
    KEY_BITS,
  )
  return toB64(bits)
}

function readVerifier(): StoredVerifier | null {
  try {
    const raw = localStorage.getItem(VERIFIER_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<StoredVerifier>
    if (p?.v !== 1 || typeof p.saltB64 !== 'string' || typeof p.hashB64 !== 'string') return null
    return {
      v: 1,
      saltB64: p.saltB64,
      hashB64: p.hashB64,
      iterations: typeof p.iterations === 'number' ? p.iterations : ITERATIONS,
      pinUpdatedAt: typeof p.pinUpdatedAt === 'number' ? p.pinUpdatedAt : 0,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
    }
  } catch {
    return null
  }
}

export const hasLocalVerifier = (): boolean => readVerifier() !== null

export const localVerifierPinUpdatedAt = (): number | null => readVerifier()?.pinUpdatedAt ?? null

export function dropLocalVerifier(): void {
  try {
    localStorage.removeItem(VERIFIER_KEY)
  } catch {
    /* private mode */
  }
}

/** Call ONLY after the SERVER has confirmed this exact PIN on this device. */
export async function storeLocalVerifier(pin: string, pinUpdatedAt: number): Promise<void> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const hashB64 = await derive(pin, salt, ITERATIONS)
    const doc: StoredVerifier = {
      v: 1,
      saltB64: toB64(salt.buffer as ArrayBuffer),
      hashB64,
      iterations: ITERATIONS,
      pinUpdatedAt,
      createdAt: Date.now(),
    }
    localStorage.setItem(VERIFIER_KEY, JSON.stringify(doc))
  } catch {
    /* no local cache → the adult gate simply requires the network on this device */
  }
}

/**
 * Cross-device PIN-change detection. Without this, a PIN changed on the iPhone leaves the iPad
 * honouring the old one indefinitely. Called after every successful `validate()`.
 */
export function dropStaleVerifier(serverPinUpdatedAt: number | null): boolean {
  const stored = readVerifier()
  if (!stored) return false
  if (serverPinUpdatedAt == null) return false
  if (serverPinUpdatedAt > stored.pinUpdatedAt) {
    dropLocalVerifier()
    return true
  }
  return false
}

// ----- local attempt throttling -----------------------------------------------------------------
// BEST-EFFORT ONLY. An adult with devtools can clear it, which is acceptable precisely because the
// local gate guards only local UI; `pin_attempt` in Postgres is the authoritative counter.

function readAttempts(): LockoutState {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY)
    if (!raw) return clearAttempts()
    const p = JSON.parse(raw) as Partial<LockoutState>
    return {
      failedCount: typeof p?.failedCount === 'number' ? p.failedCount : 0,
      lockedUntil: typeof p?.lockedUntil === 'number' ? p.lockedUntil : null,
      requiresRecovery: p?.requiresRecovery === true,
    }
  } catch {
    return clearAttempts()
  }
}

function writeAttempts(state: LockoutState): void {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export const localLockout = (): LockoutState => readAttempts()

export interface LocalVerifyResult {
  ok: boolean
  /** Set when the local lockout refused the attempt without even comparing. */
  lockedOut?: boolean
  lockout: LockoutState
}

/**
 * Verify against the cached verifier. Returns `ok: false` with `lockedOut` when the local window is
 * still closed — and, as on the server, the lockout is checked BEFORE the comparison, so knowing the
 * PIN cannot shorten the wait.
 */
export async function verifyLocally(pin: string): Promise<LocalVerifyResult> {
  const now = Date.now()
  const state = readAttempts()
  if (isLockedOut(state, now)) return { ok: false, lockedOut: true, lockout: state }

  const stored = readVerifier()
  if (!stored) return { ok: false, lockout: state }

  let candidate: string
  try {
    candidate = await derive(pin, fromB64(stored.saltB64), stored.iterations)
  } catch {
    return { ok: false, lockout: state }
  }

  // Constant-time-ish compare. WebCrypto has no timingSafeEqual; the values are equal-length base64
  // digests and the local gate is not the boundary that matters, but don't short-circuit anyway.
  let diff = candidate.length ^ stored.hashB64.length
  for (let i = 0; i < Math.max(candidate.length, stored.hashB64.length); i++) {
    diff |= (candidate.charCodeAt(i) || 0) ^ (stored.hashB64.charCodeAt(i) || 0)
  }
  if (diff !== 0) {
    const next = registerFailure(state, now)
    writeAttempts(next)
    return { ok: false, lockout: next }
  }
  const cleared = clearAttempts()
  writeAttempts(cleared)
  return { ok: true, lockout: cleared }
}

/** Clear the local counter after a SERVER-verified success (the server already cleared its own). */
export function clearLocalAttempts(): void {
  writeAttempts(clearAttempts())
}
