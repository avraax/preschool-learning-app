// WHERE each PIN reason is verified — THE table (accounts PRD §7.2), in ONE pure module.
//
// The table itself is UNCHANGED; it simply no longer lives inside `AuthContext.tsx`. It moved here so
// a plain-Node test can import it: `src/config/adultSettingsIa.test.ts` asserts that every
// account-scoped destructive setting is verified against the SERVER, and a test that re-declares the
// server set itself would pass vacuously. `AuthContext` imports and re-exports these, so every
// existing call site (`requirePin('…')`, `pinVerifierFor(...)`) is untouched.
//
// PURE: no React, no DOM, no side effects. Relative imports would need explicit `.ts` extensions —
// there are none.
//
// THE PRINCIPLE, stated so it survives future contributors: a LOCALLY-verified PIN may authorise
// anything whose blast radius is this device's local state; a SERVER-verified PIN is required whenever
// the outcome is a credential, a spend, or an account-scoped mutation.

/** Every action that can demand the adult PIN. */
export type PinReason =
  | 'adultMenu'
  | 'resetProgress'
  | 'switchProfile'
  | 'unlockSession'
  | 'changePin'
  | 'manageCredentials'
  | 'revokeSessions'

export type PinVerifier = 'local' | 'server'

/**
 * `unlockSession` is the one entry that depends on connectivity: online it mints a new access token,
 * which spends money, so it needs server authority; offline it unlocks LOCAL play only and the paid
 * endpoints stay 401 until the network returns.
 */
export function pinVerifierFor(reason: PinReason, online: boolean): PinVerifier {
  switch (reason) {
    case 'adultMenu': // must work on a plane; blast radius is this device's UI
    case 'resetProgress': // progressStore is localStorage — local data, local authority
    case 'switchProfile': // ditto
      return 'local'
    case 'unlockSession':
      return online ? 'server' : 'local'
    // NOTE: `revokeSessions` HAS NO CALLER since 2026-08-09 — "Log ud alle steder" is verified by its
    // confirm dialog alone, at the owner's decision (both log-outs are reversible and destroy nothing).
    // Kept rather than deleted, like `authStore.lock()`: the row is one line, and the next
    // account-scoped mutation — a revoke triggered from somewhere the parental gate has NOT already
    // been passed, say — will want exactly it. Do not read it as live.
    case 'changePin': // a credential
    case 'manageCredentials': // adding/removing a sign-in method
    case 'revokeSessions': // account-scoped mutation
      return 'server'
  }
}

/** Every reason, so a test can sweep the table exhaustively. */
export const PIN_REASONS: readonly PinReason[] = [
  'adultMenu',
  'resetProgress',
  'switchProfile',
  'unlockSession',
  'changePin',
  'manageCredentials',
  'revokeSessions',
] as const
