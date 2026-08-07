// The ONLY way the client calls a paid endpoint.
//
// DELIBERATELY NOT A `fetch` MONKEY-PATCH (accounts PRD §4.6). diagnosticsBuffer and remoteConsole
// already patch `window.fetch`; a third layer would make the ordering unauditable — and one of those
// layers is what records URLs into a ring that ends up in a public bug-report blob. An explicit
// wrapper at five call sites is auditable; a hidden interceptor is not.
//
// The retry contract: a 401 carrying `code: 'need_access_token'` means "your JWT expired", NOT "your
// session is gone". So we re-mint ONCE and retry once. Anything else is returned to the caller
// untouched, which is what lets ttsClient's circuit breaker and Web Speech fallback keep working.

import { authStore } from './authStore'
import { apiUrl } from '../config/apiBase'

const NEED_TOKEN = 'need_access_token'

function withAuth(init: RequestInit | undefined, token: string | null): RequestInit {
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

/**
 * Attach the short-lived access JWT, minting it lazily if needed, and transparently recover from one
 * expiry. Never throws for auth reasons — a network failure propagates exactly as `fetch` would, so
 * callers keep their existing error handling.
 */
export async function authorizedFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  // Resolved ONCE, here, so both the first attempt and the retry below hit the same URL — and so the
  // four paid-endpoint call sites (ttsClient, useSpeechInput, VoiceLab, AuditHarness) need no change.
  // No-op on the web; absolute inside the shell, where a relative path would hit the app bundle.
  const url = apiUrl(input)
  const token = await authStore.getAccessToken()
  const first = await fetch(url, withAuth(init, token))
  if (first.status !== 401) return first

  // Read the body from a CLONE: the caller may still want the original 401 if the retry also fails.
  const code = await first
    .clone()
    .json()
    .then((body) => (body as { code?: string })?.code ?? null)
    .catch(() => null)
  if (code !== NEED_TOKEN) return first

  authStore.invalidateAccessToken()
  const fresh = await authStore.getAccessToken(true)
  // No fresh token means the session itself is gone (authStore has already signed out). Hand the
  // original 401 back rather than firing a second doomed request.
  if (!fresh) return first
  return fetch(url, withAuth(init, fresh))
}
