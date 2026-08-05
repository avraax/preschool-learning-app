// One-time storage sweep for the accounts release.
//
// The owner's decision: **clean sheet everywhere.** Progress from before accounts is NOT migrated —
// there is deliberately no migration path at all (see `.claude/rules/auth.md`). So on the first boot of
// this build, every pre-accounts and per-profile progress key is dropped, along with the cached profile
// roster, the cached session and the cached local PIN verifier.
//
// Sweeping matters for more than tidiness: the roster cache and the PIN verifier live in localStorage,
// so without this a device would keep offering stale child profiles and keep honouring a PIN that no
// longer exists on the server.
//
// Same shape as `sweepLegacyServiceWorkers()` in utils/swCleanup.ts — a marker key makes it run exactly
// once per device, and it must be cheap and never throw (it runs before React).

const SWEEP_MARKER = 'bornelaering-accounts-sweep'
const SWEEP_VERSION = '1'

/** Exact keys to drop. */
const EXACT_KEYS = [
  // Pre-accounts anonymous progress (schema v3). Nothing reads it any more.
  'bornelaering-progress',
  // Session + roster + pointer: re-established by signing in.
  'bornelaering-account',
  'bornelaering-active-profile',
  'bornelaering-profiles',
  // Local PIN state — a verifier for a PIN that no longer exists must not survive.
  'bl-pin-verifier',
  'bl-pin-attempts',
  // A half-finished OAuth flow from before this build.
  'bl-oauth-flow',
  // The adoption marker from the removed migration path.
  'bornelaering-legacy-adoption',
]

/** Any per-profile progress blob, including the old transitional `:local` one. */
const PREFIXES = ['bornelaering-progress:']

/**
 * DELIBERATELY KEPT: `bornelaering-device-id` (identity, not progress — and the ledger key),
 * `bornelaering-theme` (a preference, and the synchronous first-paint hint) and
 * `bl-audio-ever-worked` (a fact about the DEVICE, not the child — Audio activation PRD-01 §4.5; it
 * feeds the adult "Lyd har virket på denne enhed" line and the bug report, and gates nothing).
 *
 * The sweep is marker-guarded and enumerates exact keys plus one prefix, so a new key is untouched by
 * default — this comment is what stops a future session from "tidying" one into `EXACT_KEYS`.
 */
export function sweepPreAccountsStorage(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(SWEEP_MARKER) === SWEEP_VERSION) return

    const doomed: string[] = [...EXACT_KEYS]
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && PREFIXES.some((p) => key.startsWith(p))) doomed.push(key)
    }
    for (const key of doomed) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* keep going — one failure must not abort the sweep */
      }
    }
    localStorage.setItem(SWEEP_MARKER, SWEEP_VERSION)
  } catch {
    /* private mode / quota — there is nothing persisted to sweep anyway */
  }
}
