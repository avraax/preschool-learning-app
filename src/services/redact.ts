// Credential scrubbing for everything that can leave the device.
//
// THE THREAT (accounts PRD §8.1, the highest-severity item in the auth build): diagnosticsBuffer
// records 300 console lines and 100 network entries; bugReporter bundles them with a snapdom
// screenshot and POSTs to a PUBLIC-access Vercel Blob. Anything that reaches a console line or the
// DOM is one adult tap away from being world-readable.
//
// THE APPROACH: a literal secret REGISTRY beats regexes. authStore calls registerSecret() on the
// session token, every access JWT and every flowId at the moment of creation, so those values are
// caught **by identity, not by pattern** — a token format change can't silently defeat it. The
// pattern rules below are only a backstop for anything unregistered.
//
// Dependency-free on purpose: diagnosticsBuffer imports this and must stay evaluable before
// everything else. No `window` at module scope (also keeps it Node-testable).

const REDACTED = '«redacted»'
const EMAIL_MARK = '«email»'

// Below this length a "secret" is more likely to be a common substring than a credential, and
// blind-replacing it would mangle unrelated log lines.
const MIN_SECRET_LENGTH = 9

const secrets = new Set<string>()

/** Register a live credential. Call at the moment of CREATION, not at first use. */
export function registerSecret(v: string | null | undefined): void {
  if (typeof v !== 'string') return
  const s = v.trim()
  if (s.length < MIN_SECRET_LENGTH) return
  secrets.add(s)
  // Bound the registry: a long session rotates the access JWT every 15 minutes, and an unbounded
  // Set would keep every one of them alive forever.
  if (secrets.size > 64) {
    const first = secrets.values().next()
    if (!first.done) secrets.delete(first.value)
  }
}

/** Forget a rotated credential (it no longer needs redacting, and the registry stays small). */
export function forgetSecret(v: string | null | undefined): void {
  if (typeof v === 'string') secrets.delete(v.trim())
}

/** DEV/testing only. */
export function clearSecrets(): void {
  secrets.clear()
}

export function registeredSecretCount(): number {
  return secrets.size
}

// Backstop patterns for values that were never registered (a future contributor's new token, a
// third-party error message quoting an Authorization header, …).
const BACKSTOPS: Array<[RegExp, string]> = [
  // A JWT shape: three base64url segments starting with the `{"` header prefix.
  [/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, REDACTED],
  [/Bearer\s+[\w.~+/=-]{12,}/gi, `Bearer ${REDACTED}`],
  [/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g, EMAIL_MARK],
]

/**
 * Replace every registered secret and every backstop match. Cheap enough to run on each recorded
 * console line and once more over the whole serialised bug-report body as a last net.
 */
export function redactText(s: string): string {
  if (typeof s !== 'string' || !s) return s
  let out = s
  // Longest first, so a token that contains another registered value can't be half-replaced.
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    if (out.includes(secret)) out = out.split(secret).join(REDACTED)
  }
  for (const [re, replacement] of BACKSTOPS) out = out.replace(re, replacement)
  return out
}

/** Deep-redact an already-structured payload (keys are kept, string values scrubbed). */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redactText(value) as unknown as T
  if (Array.isArray(value)) return value.map(redactDeep) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactDeep(v)
    return out as unknown as T
  }
  return value
}

// ----- URLs -------------------------------------------------------------------------------------

/** Query/fragment parameters that must never be recorded, on ANY path. */
const SENSITIVE_PARAMS = ['code', 'token', 'access_token', 'id_token', 'otp', 'pin', 'flow', 'flowId', 'state']

const AUTH_PATH = /\/api\/auth(\/|$|\?)/

/** True for URLs whose *entire* query and fragment are considered credential-bearing. */
export function isSensitiveUrl(u: string): boolean {
  if (typeof u !== 'string') return false
  return AUTH_PATH.test(u)
}

/**
 * Make a URL safe to record. On auth paths the whole query+fragment goes; everywhere else only the
 * sensitive parameter names are replaced. Relative URLs are supported (that's what the network ring
 * actually holds), and a URL we can't parse is truncated to its path prefix rather than kept.
 */
export function sanitizeUrl(u: string): string {
  if (typeof u !== 'string' || !u) return ''
  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(u)
  let parsed: URL
  try {
    parsed = new URL(u, isAbsolute ? undefined : 'http://l')
  } catch {
    // Unparseable: keep only what precedes the first ? or #.
    return u.split(/[?#]/)[0]
  }

  const path = isAbsolute ? `${parsed.origin}${parsed.pathname}` : parsed.pathname

  if (isSensitiveUrl(parsed.pathname)) {
    // Keep the path (that's the diagnosable part — which endpoint failed) and nothing else.
    return path
  }

  for (const p of SENSITIVE_PARAMS) {
    if (parsed.searchParams.has(p)) parsed.searchParams.set(p, REDACTED)
  }
  const qs = parsed.searchParams.toString()
  // The fragment can carry an OAuth-style credential in other designs; never record it.
  return qs ? `${path}?${decodeURIComponent(qs)}` : path
}
