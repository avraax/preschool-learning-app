// The 4-digit adult PIN's rules: what counts as an acceptable PIN, and the escalating lockout curve.
//
// PURE and shared by BOTH the client and the Vercel functions (lib/auth-family-plugin.ts imports this
// exact file) so client-side validation and server-side enforcement cannot drift apart. No DOM, no
// Date.now() — every time input is passed in. Explicit `.ts` extensions on relative imports because
// the server half loads this graph in plain Node.
//
// WHY the lockout, and not a bigger KDF: for a 4-digit PIN the keyspace is 10 000, so the work factor
// is nearly irrelevant — a GPU walks it in microseconds either way. The real controls are the
// server-side PIN_PEPPER (a database dump alone can't enumerate candidates) and the PERSISTED
// escalating lockout below. Do not "optimise" the lockout away.

/** The ~20 statistically most-used 4-digit codes. */
export const DENYLISTED_PINS = [
  '1234', '1111', '0000', '1212', '7777', '1004', '2000', '4444', '2222', '6969',
  '9999', '3333', '5555', '6666', '1122', '1313', '8888', '4321', '2001', '1010',
] as const

export type PinRejection =
  | 'not-four-digits'
  | 'all-same'
  | 'sequence'
  | 'too-common'

export interface PinValidation {
  ok: boolean
  reason?: PinRejection
  /** Danish, child-free adult copy — shown verbatim in the PIN setup dialog. */
  message?: string
}

const MESSAGES: Record<PinRejection, string> = {
  'not-four-digits': 'Koden skal være præcis 4 cifre.',
  'all-same': 'Vælg en kode med forskellige cifre.',
  sequence: 'Vælg en kode der ikke er 4 cifre i rækkefølge.',
  'too-common': 'Den kode er for almindelig. Vælg en anden.',
}

/** True when the four digits run consecutively up or down, wraparound included (0123, 9876, 0987). */
function isRun(pin: string): boolean {
  const d = [...pin].map(Number)
  const step = (a: number, b: number, dir: number) => (a + dir + 10) % 10 === b
  const up = d.every((_, i) => i === 0 || step(d[i - 1], d[i], 1))
  const down = d.every((_, i) => i === 0 || step(d[i - 1], d[i], -1))
  return up || down
}

export function validateNewPin(pin: string): PinValidation {
  const reject = (reason: PinRejection): PinValidation => ({
    ok: false,
    reason,
    message: MESSAGES[reason],
  })
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return reject('not-four-digits')
  if (new Set(pin).size === 1) return reject('all-same')
  if (isRun(pin)) return reject('sequence')
  if ((DENYLISTED_PINS as readonly string[]).includes(pin)) return reject('too-common')
  return { ok: true }
}

/** Shape check only — used on the VERIFY path, where a denylisted PIN must still be checkable. */
export const isPinShape = (pin: unknown): pin is string =>
  typeof pin === 'string' && /^\d{4}$/.test(pin)

// ----- Lockout curve (accounts PRD §8.2) --------------------------------------------------------
// 4 free attempts, then escalating. ≥9 closes the PIN path entirely until Google/passkey reopens it.
export const FREE_ATTEMPTS = 4
export const RECOVERY_AT_FAILURES = 9

const MIN = 60_000
const LOCK_MS: Record<number, number> = {
  5: 1 * MIN,
  6: 5 * MIN,
  7: 15 * MIN,
  8: 60 * MIN,
}
const RECOVERY_LOCK_MS = 24 * 60 * MIN

export interface LockoutState {
  failedCount: number
  lockedUntil: number | null
  /** The PIN path is closed; only Google sign-in or a passkey reopens it. */
  requiresRecovery: boolean
}

/**
 * Fold ONE failed attempt into the counter and return the new state.
 * `failedCount` never resets on its own — only a successful verify clears it (`clearAttempts`).
 */
export function registerFailure(prev: LockoutState, now: number): LockoutState {
  const failedCount = Math.max(0, prev.failedCount) + 1
  if (failedCount >= RECOVERY_AT_FAILURES) {
    return { failedCount, lockedUntil: now + RECOVERY_LOCK_MS, requiresRecovery: true }
  }
  const ms = LOCK_MS[failedCount]
  return {
    failedCount,
    lockedUntil: ms ? now + ms : null,
    requiresRecovery: false,
  }
}

export const clearAttempts = (): LockoutState => ({
  failedCount: 0,
  lockedUntil: null,
  requiresRecovery: false,
})

/**
 * Is the PIN path currently closed? A CORRECT PIN inside a lock window must STILL be refused —
 * otherwise knowing the PIN bypasses the very lockout that protects it. Call this BEFORE comparing.
 */
export const isLockedOut = (s: LockoutState, now: number): boolean =>
  s.lockedUntil != null && s.lockedUntil > now

/** Attempts left before the next lock window (0 once the lock has started). */
export const attemptsLeft = (s: LockoutState): number =>
  Math.max(0, FREE_ATTEMPTS - Math.max(0, s.failedCount))

/** Danish countdown copy for the PIN pad. Whole minutes, rounded up; seconds under a minute. */
export function lockoutMessage(s: LockoutState, now: number): string {
  if (s.requiresRecovery) {
    return 'Kodelåsen er slået fra. Log ind med Google eller Face ID for at lave en ny kode.'
  }
  if (!isLockedOut(s, now)) return ''
  const ms = (s.lockedUntil as number) - now
  if (ms < 60_000) return `Prøv igen om ${Math.ceil(ms / 1000)} sekunder.`
  const mins = Math.ceil(ms / 60_000)
  return mins === 1 ? 'Prøv igen om 1 minut.' : `Prøv igen om ${mins} minutter.`
}
