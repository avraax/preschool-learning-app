// WHERE DOES `/api/...` LIVE — same origin, or across the network? (App Store PRD §3.1.)
//
// THE BUG THIS EXISTS TO PREVENT, because it is invisible everywhere except on the device:
// on the web the SPA is served from the same origin as its functions, so `fetch('/api/progress')`
// resolves against `https://preschool-learning-app.vercel.app` and is correct. Inside the native
// shell the page origin is `capacitor://localhost`, so the SAME call resolves against the app
// BUNDLE — and Capacitor's local server answers it with the SPA's index.html rather than failing.
// So there is no error, no 404 and no exception: sign-in, progress sync, "Sig et Ord" and bug
// reports just quietly never reach a server, while every game keeps working perfectly because the
// games are offline by design. A build like that looks completely healthy.
//
// The shell must therefore address the API ABSOLUTELY. Everything else is unchanged: `apiUrl()`
// returns its argument untouched on the web, so the deployment keeps same-origin requests, no
// preflight, and no CORS surface.
//
// PURE and Node-importable (explicit `.ts`), so `apiBase.test.ts` can assert the composition and
// sweep the source for call sites that skipped it.

import { isNativeShell } from './runtimeTarget.ts'

/**
 * The deployment the shell talks to.
 *
 * HARDCODED ON PURPOSE, and this is the one place in the app where that is unavoidable: the value is
 * baked into a binary that goes through App Store review, so it cannot be an environment variable —
 * there is no environment to read, and no way to change it without shipping a new build.
 *
 * THAT MAKES A DOMAIN MOVE ASYMMETRIC, which is the trap worth stating. On the web a move is
 * env-only (`BETTER_AUTH_URL`, per `.claude/rules/auth.md`) and every already-loaded client follows
 * it on the next request. An installed shell CANNOT follow: every binary in the field keeps calling
 * whatever host was compiled into it. So the OLD host must keep answering until those installs are
 * replaced through review — which is exactly why `preschool-learning-app.vercel.app` staying alive as
 * a fallback matters more once this ships than it does today.
 *
 * Production became `boernelaering.dk` on 2026-08-07; both hosts answered `/api/version` with 200
 * when this was written. The canonical one is used, because it is what `baseURL()` reports and
 * therefore what better-auth's `trustedOrigins` and the Google redirect URIs are keyed to.
 */
export const SHELL_API_ORIGIN = 'https://boernelaering.dk'

/**
 * Resolve an app-relative API path for whichever target this build is.
 *
 * Web → unchanged (same-origin). Shell → absolute against the deployment.
 *
 * Takes and returns a string rather than wrapping `fetch`, so it composes with `authorizedFetch`'s
 * retry, with `keepalive` unload pushes, and with anything else a call site needs to do.
 */
export function apiUrl(path: string): string {
  // Defensive rather than paranoid: a caller that already passes an absolute URL (the diagnostics
  // uploader builds one) must not have an origin prepended to it twice.
  if (!path.startsWith('/')) return path
  return isNativeShell() ? SHELL_API_ORIGIN + path : path
}
