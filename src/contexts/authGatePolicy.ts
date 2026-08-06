// Pure decision for WHICH auth phase the app is in — i.e. whether the blocking lock screen shows,
// whether the child can play, and whether the paid endpoints may be called.
//
// Same shape as `config/audioReadiness.ts` (and its deleted predecessor `audioPromptPolicy.ts`), which
// exists precisely because an iOS re-arm bug was untestable inside React. The rules below encode three
// things that are easy to get
// wrong in an effect and impossible to get wrong here (accounts PRD §4.7 / §7.1):
//
//  1. `invalid` (a 401/403 from the server) ⇒ signed out IMMEDIATELY, ignoring grace. That is the
//     revocation path; softening it would make "sign out everywhere" a lie.
//  2. A network failure is `unreachable`, NEVER `invalid`. Within grace that means full play with
//     paid calls disabled — the app costs nothing offline because the access JWT can't be minted
//     without the server, so a tight grace window would only punish the family.
//  3. `unknown` + a stored token ⇒ optimistically `authed`. `authStore.boot()` hydrates
//     localStorage synchronously and validates in the background, so there is NO boot spinner —
//     the same discipline as progressStore's synchronous hydration.

export type AuthPhase =
  | 'booting'
  | 'signedOut'
  | 'locked'
  | 'authed'
  | 'offlineGrace'
  | 'offlineExpired'
  /**
   * Playing with NO account, progress on this device only (App Store PRD §3.2 / A1). Full play, and
   * the paid endpoints are off — see the note on `canCallPaidApis` in `authGateDecision`.
   */
  | 'guest'

export type ServerVerdict = 'unknown' | 'valid' | 'invalid' | 'unreachable'

export interface AuthGateInputs {
  hasStoredToken: boolean
  serverVerdict: ServerVerdict
  /** When the server last said "valid". `null` = never (a token from a previous install). */
  lastVerifiedAt: number | null
  now: number
  /** 30 days (§4.7). NOT a security parameter — see the note above. */
  graceMs: number
  /** An adult explicitly locked the session (or a profile switch was requested). */
  lockedByAdult: boolean
  /** Reserved for a future idle auto-lock; currently always 0 (no auto-lock by design). */
  idleSinceMs: number
  /** DEV only: `?noauth=1` / `?nogate=1`. */
  devBypass: boolean
  /**
   * This device is playing locally with no account (`utils/guestMode.ts`). Only ever consulted
   * together with `!hasStoredToken` below — guest and a session are mutually exclusive by
   * construction, and reading it that way means a stale verdict from a session that has since been
   * cleared can never turn a guest back into a lock screen.
   */
  guestMode: boolean
}

export interface AuthGateDecision {
  phase: AuthPhase
  canPlay: boolean
  canCallPaidApis: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_GRACE_MS = 30 * DAY_MS

export function authGateDecision(s: AuthGateInputs): AuthGateDecision {
  if (s.devBypass) return { phase: 'authed', canPlay: true, canCallPaidApis: true }

  // GUEST, and it is checked before the revocation branch on purpose. It requires `!hasStoredToken`,
  // so it cannot mask a live session being revoked — but a device that has just cleared its token
  // still holds `verdict: 'invalid'` in memory, and letting that outrank the adult's explicit "spil
  // uden konto" would bounce them straight back to the lock screen they just left.
  //
  // `canCallPaidApis: false` is NOT conservatism, it is the same control as `AUTH_ALLOWED_EMAILS`:
  // /api/tts-azure bills per character and /api/stt per second, and both require a server-minted
  // access JWT that no account-less client can obtain. A guest costs nothing, which is what makes an
  // open guest path safe to ship at all. Every line the app speaks is prebaked (see
  // `.claude/rules/audio-system.md`), so the only thing a guest actually loses is Sig et Ord.
  if (s.guestMode && !s.hasStoredToken) {
    return { phase: 'guest', canPlay: true, canCallPaidApis: false }
  }

  // Revocation beats everything, including grace and including an adult lock.
  if (s.serverVerdict === 'invalid') {
    return { phase: 'signedOut', canPlay: false, canCallPaidApis: false }
  }

  if (!s.hasStoredToken) {
    return { phase: 'signedOut', canPlay: false, canCallPaidApis: false }
  }

  // A deliberate lock (adult menu "lås", or a profile switch) still holds a valid session — the
  // adult just has to prove it's them. Nothing plays behind the lock screen.
  if (s.lockedByAdult) {
    return { phase: 'locked', canPlay: false, canCallPaidApis: false }
  }

  if (s.serverVerdict === 'valid') {
    return { phase: 'authed', canPlay: true, canCallPaidApis: true }
  }

  if (s.serverVerdict === 'unreachable') {
    // `null` lastVerifiedAt means we have a token we've never confirmed — treat the grace clock as
    // already expired rather than granting 30 days to an unverifiable token.
    const withinGrace =
      s.lastVerifiedAt != null && s.now - s.lastVerifiedAt <= s.graceMs
    return withinGrace
      ? { phase: 'offlineGrace', canPlay: true, canCallPaidApis: false }
      : { phase: 'offlineExpired', canPlay: false, canCallPaidApis: false }
  }

  // 'unknown' + a stored token: render optimistically while validate() runs in the background.
  // Paid calls are allowed because they carry their own server-minted JWT — a stale session simply
  // fails to mint one and the client falls back to prebaked narration.
  return { phase: 'authed', canPlay: true, canCallPaidApis: true }
}

/**
 * True for the phases where the blocking overlay must cover the app.
 *
 * `guest` is deliberately absent: it is a full-play phase, so the app renders exactly as it does for a
 * signed-in adult. Listing the blocking phases (rather than negating the playing ones) is what makes
 * that safe to extend — a new phase blocks only if someone says so.
 */
export const gateBlocks = (phase: AuthPhase): boolean =>
  phase === 'signedOut' || phase === 'locked' || phase === 'offlineExpired' || phase === 'booting'

/**
 * Routes that render even while the gate blocks (App Store PRD §3.5, listing §3.1).
 *
 * App Store Connect demands a **Privacy Policy URL** and a **Support URL**, and Apple fetches both
 * without an account — Guideline 2.1(a) explicitly scrubs "empty websites", and 5.1.1(i) requires the
 * policy to be reachable "in an easily accessible manner" from inside the app as well. Both are static
 * text with no account, no child data and nothing to spend, so exempting them costs nothing.
 *
 * Kept HERE, pure and beside the gate, rather than as a string check inside `AuthGate` — the exemption
 * is a policy statement about which URLs are public, and `authGatePolicy.test.ts` pins the list so a
 * third path cannot be waved through in a component edit.
 */
export const PUBLIC_PATHS = ['/privatliv', '/support'] as const

/** Does this pathname render without an account, even when the gate would otherwise block? */
export const isPublicPath = (pathname: string): boolean =>
  (PUBLIC_PATHS as readonly string[]).includes(pathname.replace(/\/+$/, '') || '/')
