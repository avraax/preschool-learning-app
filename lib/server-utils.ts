import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Decide whether a request's Origin is allowed to call our TTS/STT endpoints.
 *
 * A cross-origin caller must come from localhost (dev) or the request's own host (the browser
 * app / installed PWA POST from the same deployment — prod and each preview both satisfy this
 * because the Origin matches the host they were served from). We deliberately DROPPED the old
 * blanket `*.vercel.app` allow (PRD-03 §P3) — anyone can deploy a `*.vercel.app` site and proxy
 * our paid endpoints. Requests with no Origin (server-to-server, curl, the /debug-report skill)
 * are still allowed here; the real billing/abuse guard for those is the per-IP rate limiter.
 * This is a light guard, not hard auth.
 */
export function isAllowedOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    const url = new URL(origin)
    // THE NATIVE SHELL, EXPLICITLY. It calls these endpoints cross-origin from
    // `capacitor://localhost` (App Store PRD §3.1). It already passed the hostname test below purely
    // because that origin's hostname happens to parse as `localhost` — i.e. it worked BY ACCIDENT,
    // and any future tightening of the localhost rule (scheme check, dev-only guard) would have
    // killed "Sig et Ord" and TTS in the shipped app with no local symptom. Say it on purpose.
    if (SHELL_SCHEMES.includes(url.protocol)) return true
    const host = url.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true
    if (req.headers.host && host === req.headers.host.split(':')[0]) return true
    return false
  } catch {
    return false
  }
}

/** Capacitor's iOS scheme and its legacy one, as `URL.protocol` reports them (trailing colon). */
const SHELL_SCHEMES = ['capacitor:', 'ionic:']

/** Best-effort client IP for rate limiting (Vercel sets x-forwarded-for). */
export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  const raw = Array.isArray(fwd) ? fwd[0] : fwd
  const first = raw?.split(',')[0]?.trim()
  return first || req.socket?.remoteAddress || 'unknown'
}

// Fixed-window per-IP counters. In-memory is fine: Fluid Compute reuses instances, and this is a
// billing GUARD, not a wall — state resetting on a cold start is acceptable (PRD-03 §5).
interface RateBucket {
  count: number
  resetAt: number
}
const rateBuckets = new Map<string, RateBucket>()

/**
 * Fixed-window rate limit. Returns true if the request is allowed; on refusal it has already
 * written a 429 (with Retry-After) to `res`, so the caller should just `return`.
 *
 * `subject` (accounts PRD §4.6): once a route requires a verified access JWT, key the bucket on the
 * token's `sub` instead of the IP. Two iPads behind one CGNAT then stop sharing a bucket, and the
 * limit finally means something per ACCOUNT rather than per network.
 */
export function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  opts: { scope: string; limit: number; windowMs: number; subject?: string }
): boolean {
  const now = Date.now()
  const key = `${opts.scope}:${opts.subject || clientIp(req)}`

  // Opportunistic prune so the map can't grow unbounded across a long-lived instance.
  if (rateBuckets.size > 5000) {
    for (const [k, b] of rateBuckets) {
      if (b.resetAt <= now) rateBuckets.delete(k)
    }
  }

  let bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs }
    rateBuckets.set(key, bucket)
  }
  bucket.count++

  if (bucket.count > opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
    res.status(429).json({ error: 'Too many requests' })
    return false
  }
  return true
}

/** CORS headers scoped to the caller's own origin (not a blanket '*'). */
export function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin
  res.setHeader('Access-Control-Allow-Origin', origin && isAllowedOrigin(req) ? origin : 'null')
  res.setHeader('Vary', 'Origin')
  // Every method any endpoint behind this helper actually serves: `profiles` answers GET/POST/PATCH/
  // DELETE, `progress` GET/PUT, `bug-report` GET/POST. It advertised POST only, which was harmless
  // while nothing was cross-origin — and is not any more: the shell preflights ALL of them, because
  // they carry an `Authorization` header, which makes even a GET non-simple. A missing verb here is a
  // request the browser refuses to send, so it fails before it reaches any of our code.
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  // `Authorization` is needed by the paid endpoints' access JWT. This USED TO BE correctness-only
  // (accounts PRD §8.3) — on the web the SPA is same-origin with /api, and in dev Vite proxies
  // /api → 127.0.0.1:3001, so the browser never preflights. **The native shell made it
  // load-bearing**: it is served from the app bundle, so every API call is cross-origin by
  // construction and every one of them preflights.
  //
  // Still NO Access-Control-Allow-Credentials — we never send cookies cross-origin.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
 * Record a server-side error. Always writes to the Vercel function log (console.error, the
 * primary record) and, best-effort, POSTs to /api/log-error using an ABSOLUTE URL derived from
 * the request host. The previous code used a relative URL, which throws `TypeError: Failed to
 * parse URL` in a serverless function (no origin) — silently dropping every server error for a
 * year (PRD §1.1). This never throws.
 */
export async function logServerError(req: VercelRequest, scope: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[${scope}] server error:`, error)

  try {
    const host = req.headers.host
    if (!host) return
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    await fetch(`${proto}://${host}/api/log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: `${scope} API Error: ${message}`,
        data: { stack: error instanceof Error ? error.stack : undefined },
        device: 'Server API',
        url: req.url || `/api/${scope.toLowerCase()}`,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // Never let logging failures affect the response.
  }
}
