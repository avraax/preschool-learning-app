// WHICH BACKEND IS THIS BUILD TALKING TO — production, or staging? (Staging PRD W2.)
//
// This is the `runtimeTarget.ts` of backends, and the same rule applies: ONE module answers the
// question and nobody re-derives it. `runtimeTarget.ts` answers "web or shell"; this one answers
// "whose database", which is a different axis — a web build and a shell build can both be staging.
//
// PURE and Node-importable (explicit `.ts` imports, no React, no `window` read at module scope), so
// `backendTarget.test.ts` can assert every branch without a browser.
//
// THE ONE PROPERTY EVERYTHING ELSE RESTS ON: `backendLabel()` returns `null` for production and a
// host for anything else. The badge renders nothing when it is null, so a production binary — the one
// that goes through App Store review — is badge-free by construction rather than by a flag someone
// remembered to set.

import { isNativeShell } from './runtimeTarget.ts'
import { SHELL_API_ORIGIN } from './apiBase.ts'

export type BuildTier = 'staging' | 'production'

/** The one place these hosts are spelled. A second literal copy anywhere is the bug this prevents. */
export const PRODUCTION_API_ORIGIN = 'https://boernelaering.dk'
export const STAGING_API_ORIGIN = 'https://staging.boernelaering.dk'

// Injected by `vite.config.ts`'s `define` for EVERY mode, so a deploy build gets a literal and this
// whole expression constant-folds. The `typeof` guard exists for plain-Node `--test`, where the
// global does not exist — same shape as `__HARNESS__` in `src/utils/devHarness.ts`, and for the same
// reason: `import.meta.env.DEV` is false in every `vite build`, so it cannot carry build identity.
declare const __BL_TIER__: string | undefined
const RAW_TIER: string = typeof __BL_TIER__ !== 'undefined' ? __BL_TIER__ : 'production'

/**
 * The tier this build was compiled as. Defaults to `production`, because an unrecognised or absent
 * value must be the SAFE one — an unknown build claiming to be staging would suppress nothing, but a
 * staging build claiming production would hide its own badge.
 *
 * The badge does not trust this (see `backendLabel`). It exists because the CI needs it to pick a
 * tuple and the server has its own `tier()` in `lib/env.ts`.
 */
export const BL_TIER: BuildTier = RAW_TIER === 'staging' ? 'staging' : 'production'

/**
 * The origin this build's `/api` calls actually reach.
 *
 * In the shell the compiled constant IS the backend — the page origin is `capacitor://localhost`,
 * i.e. the app bundle, which is exactly the bug `apiUrl()` exists to prevent. On the web the page
 * origin is the backend, because the SPA is served same-origin with its functions.
 *
 * Returns the production origin outside a browser (Node tests) rather than throwing, so importing
 * this module is never itself a failure.
 */
export function effectiveBackend(): string {
  if (isNativeShell()) return SHELL_API_ORIGIN
  if (typeof window === 'undefined' || !window.location) return PRODUCTION_API_ORIGIN
  return window.location.origin
}

/**
 * The host to show, or `null` when this build talks to production.
 *
 * DERIVED FROM THE ORIGIN, NEVER FROM `BL_TIER`, and that is the whole design. A boolean can be
 * wrong: `BL_TIER=production` on a build compiled against the staging host would produce a badge-free
 * binary quietly writing to the wrong database, and nothing in the app would catch it. Reading the
 * effective origin instead makes the badge absent EXACTLY WHEN the backend is production, so a
 * mislabelled build is structurally impossible rather than merely unlikely.
 *
 * The production `preschool-learning-app.vercel.app` fallback host therefore yields a label. That is
 * correct and deliberate — it is a different host answering the same data, and saying so is honest.
 */
export function backendLabel(origin: string = effectiveBackend()): string | null {
  if (origin === PRODUCTION_API_ORIGIN) return null
  return backendHost(origin)
}

/**
 * The bare host, ALWAYS — production included.
 *
 * This is what the adult menu's version chip shows, and it is the only way a PRODUCTION binary can
 * answer "which backend is this?", since by design it has no badge. Same value the badge prints, so
 * the two can never disagree.
 */
export function backendHost(origin: string = effectiveBackend()): string {
  try {
    return new URL(origin).host
  } catch {
    // Not a parseable origin (a stubbed window in a test, a hand-edited constant). Say something
    // rather than nothing: a build we cannot identify is precisely one that must not read as normal.
    return origin
  }
}
